import { Plugin, Notice, Editor, TFile, FileSystemAdapter, debounce } from 'obsidian';
import { SitePreviewView, PREVIEW_VIEW_TYPE } from './preview-view';
import { getActiveWriteup } from './writeup';
import { assetReport } from './assets';
import { insertBlock, BlockKind } from './dsl';
import { OBSIDIAN_COMMANDS } from './commands.mjs';
import { gateWriteup, syncToSite } from './system';
import { graphicsStatus, renderGraphics } from './graphics';
import { effectFor, needsConfirm, Effect } from './cordon';
import { fetchSchema, lintFrontmatter } from './schema';
import { ResultModal, ResultSection } from './result-modal';
import { NewTaskModal, ProjectOption } from './new-task-modal';
import { CockpitView, COCKPIT_VIEW_TYPE } from './cockpit-view';
import { AskVaultModal } from './ask-vault-modal';
import { RelationEditorModal } from './relation-editor-modal';
import { runToolJson } from './exec';

const INDEXED_DIRS = ['01 Projects/', '02 Infrastructure/', '03 Runbooks/'];

const SITE_BASE = 'https://jseverino.com';

interface GateFrontmatter {
  published?: boolean;
  featured?: boolean;
  published_at?: string;
}

export default class SeverinoObsidianPlugin extends Plugin {
  private gateEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    // ── Flagship: the site preview pane ──────────────────────────────────────
    this.registerView(PREVIEW_VIEW_TYPE, (leaf) => new SitePreviewView(leaf));
    this.registerView(COCKPIT_VIEW_TYPE, (leaf) => new CockpitView(leaf));
    this.addRibbonIcon('eye', 'Severino: site preview', () => void this.openPreview());
    this.addRibbonIcon('layout-dashboard', 'Severino: cockpit', () => void this.openCockpit());
    // Register every command from the single-source surface (src/commands.mjs)
    // — the same array the cordon contract is emitted from. Only the handler
    // wiring lives here; the id/name/effect metadata has one home.
    const callbacks: Partial<Record<string, () => void>> = {
      'open-site-preview': () => void this.openPreview(),
      'publish-gate': () => void this.runGateCheck(),
      'asset-doctor': () => void this.runAssetDoctor(),
      'graphics-status': () => void this.runGraphicsStatus(),
      'graphics-render': () => void this.runGraphicsRender(),
      'sync-to-site': () => void this.runSyncToSite(),
      'schema-check': () => void this.runSchemaCheck(),
      'open-on-site': () => void this.openOnSite(),
      'copy-slug': () => void this.copySlug(),
      'new-task': () => void this.runNewTask(),
      'open-cockpit': () => void this.openCockpit(),
      'ask-the-vault': () => new AskVaultModal(this.app, this.vaultPath()).open(),
      'edit-relations': () => void this.runRelationEditor(),
    };
    for (const spec of OBSIDIAN_COMMANDS) {
      if (spec.type === 'editor') {
        const kind = spec.id.replace(/^insert-/, '') as BlockKind;
        this.addCommand({
          id: spec.id,
          name: spec.name,
          editorCallback: (editor: Editor) => insertBlock(editor, kind),
        });
      } else {
        const callback = callbacks[spec.id];
        if (callback) this.addCommand({ id: spec.id, name: spec.name, callback });
      }
    }

    // ── Gate badge (status bar) ──────────────────────────────────────────────
    this.gateEl = this.addStatusBarItem();
    this.gateEl.addClass('svo-gate');

    // ── Backlog badge (status bar): open + stale + inbox; click → cockpit ─────
    this.backlogEl = this.addStatusBarItem();
    this.backlogEl.addClass('svo-gate', 'svo-backlog-badge');
    this.backlogEl.onClickEvent(() => void this.openCockpit());

    // ── Reactivity: refresh preview + gate on context / content changes ───────
    const debouncedRefresh = debounce(() => void this.onContextChange(), 250, true);
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => void this.onContextChange()));
    this.registerEvent(this.app.workspace.on('editor-change', () => debouncedRefresh()));
    this.registerEvent(this.app.metadataCache.on('changed', () => void this.updateGate()));

    this.app.workspace.onLayoutReady(() => void this.onContextChange());
    // Warm the project list so the New-task modal opens instantly.
    this.app.workspace.onLayoutReady(() => void this.taskProjects());
    this.app.workspace.onLayoutReady(() => void this.updateBacklogBadge());
  }

  private backlogEl: HTMLElement | null = null;

  // The anti-forgetting nudge: open + stale + inbox, glanceable in the status
  // bar. Derived from the vault brief (one read); refreshed on load + on create.
  private async updateBacklogBadge(): Promise<void> {
    if (!this.backlogEl) return;
    const r = await runToolJson<{
      ok: boolean;
      tasks?: { open: number; stale: number };
      inbox?: { count: number };
    }>('severino-vault-mcp', ['brief', '--days', '7'], { cwd: this.vaultPath() });
    const brief = r.data;
    if (!brief?.ok) {
      this.backlogEl.setText('');
      return;
    }
    const stale = brief.tasks?.stale ?? 0;
    const open = brief.tasks?.open ?? 0;
    const inbox = brief.inbox?.count ?? 0;
    const bits = [`${open} open`];
    if (stale) bits.push(`${stale} stale`);
    if (inbox) bits.push(`${inbox} inbox`);
    this.backlogEl.setText(`⚑ ${bits.join(' · ')}`);
    const needsAttention = stale > 0 || inbox > 0;
    this.backlogEl.toggleClass('svo-gate-draft', needsAttention);
    this.backlogEl.toggleClass('svo-gate-published', !needsAttention);
  }

  // ── New task ───────────────────────────────────────────────────────────────
  // The project universe comes from the MCP (`task-projects`) — the plugin owns
  // no vault-layout knowledge. Cached after the first read; invalidated on a
  // create, since the open counts change.
  private projectCache: ProjectOption[] | null = null;

  private async taskProjects(): Promise<ProjectOption[]> {
    if (this.projectCache) return this.projectCache;
    const r = await runToolJson<{ ok: boolean; projects?: ProjectOption[] }>(
      'severino-vault-mcp',
      ['task-projects'],
      { cwd: this.vaultPath() },
    );
    this.projectCache = r.data?.ok ? r.data.projects ?? [] : [];
    return this.projectCache;
  }

  // Smart default: if the active file lives in a project, preselect it.
  private contextProject(): string | null {
    const path = this.app.workspace.getActiveFile()?.path ?? '';
    const m = /^01 Projects\/([^/]+)\//.exec(path);
    return m ? m[1] : null;
  }

  private async runNewTask(): Promise<void> {
    const projects = await this.taskProjects();
    if (!projects.length) {
      new Notice('No projects found — is severino-vault-mcp installed?', 6000);
      return;
    }
    new NewTaskModal(this.app, projects, this.contextProject(), async (input) => {
      const args = ['task-add', input.title, '--effort', input.effort, '--priority', input.priority];
      if (input.project) args.push('--project', input.project);
      const r = await runToolJson<{ ok: boolean; doc_id?: string; relative_path?: string; error?: string }>(
        'severino-vault-mcp',
        args,
        { cwd: this.vaultPath() },
      );
      const data = r.data;
      if (!data?.ok) {
        new Notice(`Task not created: ${data?.error ?? r.error ?? 'unknown error'}`, 8000);
        return;
      }
      this.projectCache = null; // open counts changed
      void this.updateBacklogBadge();
      new Notice(`Created ${data.doc_id}`);
      if (data.relative_path) await this.openCreated(data.relative_path);
    }).open();
  }

  private async runRelationEditor(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
      new Notice('Open a markdown doc first.');
      return;
    }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const current = {
      doc_type: String(fm.doc_type ?? ''),
      related_projects: Array.isArray(fm.related_projects) ? fm.related_projects.map(String) : [],
      status: String(fm.status ?? ''),
      sensitivity: String(fm.sensitivity ?? ''),
    };
    const [projects, schema] = await Promise.all([this.taskProjects(), fetchSchema(this.vaultPath())]);
    if (!schema) {
      new Notice('Could not load the schema from severino-vault-mcp.');
      return;
    }
    new RelationEditorModal(
      this.app,
      file,
      current,
      projects.map((p) => p.slug),
      { statuses: schema.statuses, task_statuses: schema.task_statuses, sensitivities: schema.sensitivities },
      async (changes) => {
        const args = ['update-frontmatter', file.path, '--set-related-projects', ...changes.related_projects];
        if (changes.status) args.push('--status', changes.status);
        if (changes.sensitivity) args.push('--sensitivity', changes.sensitivity);
        const r = await runToolJson<{ ok: boolean; error?: string }>('severino-vault-mcp', args, {
          cwd: this.vaultPath(),
        });
        if (r.data?.ok) new Notice('Relations updated.');
        else new Notice(`Update failed: ${r.data?.error ?? r.error ?? 'unknown'}`, 8000);
      },
    ).open();
  }

  // The MCP writes the file straight to disk; give Obsidian a moment to index it,
  // then open it in a new tab.
  private async openCreated(relPath: string): Promise<void> {
    for (let i = 0; i < 15; i++) {
      const file = this.app.vault.getAbstractFileByPath(relPath);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(true).openFile(file);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    new Notice(`Created — open ${relPath} from the file list shortly.`, 6000);
  }

  private async onContextChange(): Promise<void> {
    await this.updateGate();
    for (const leaf of this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof SitePreviewView) await view.refresh();
    }
  }

  private async openPreview(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      leaf = right;
      await leaf.setViewState({ type: PREVIEW_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
    await this.onContextChange();
  }

  private async openCockpit(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(COCKPIT_VIEW_TYPE)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      leaf = right;
      await leaf.setViewState({ type: COCKPIT_VIEW_TYPE, active: true });
    } else if (leaf.view instanceof CockpitView) {
      await leaf.view.refresh(); // re-pull fleet/vault state when re-opened
    }
    workspace.revealLeaf(leaf);
  }

  private async updateGate(): Promise<void> {
    if (!this.gateEl) return;
    const writeup = await getActiveWriteup(this.app);
    if (!writeup) {
      this.gateEl.setText('');
      this.gateEl.removeClass('svo-gate-published', 'svo-gate-draft');
      return;
    }
    const fm = writeup.frontmatter as GateFrontmatter;
    const published = fm.published === true;
    const bits = [
      published ? 'published' : 'draft',
      fm.featured === true ? '★ featured' : '',
      fm.published_at ? String(fm.published_at) : '',
    ].filter(Boolean);
    this.gateEl.setText(`◆ ${writeup.slug}: ${bits.join(' · ')}`);
    this.gateEl.toggleClass('svo-gate-published', published);
    this.gateEl.toggleClass('svo-gate-draft', !published);
  }

  private vaultPath(): string {
    const adapter = this.app.vault.adapter;
    return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : '';
  }

  private async runGateCheck(): Promise<void> {
    const writeup = await getActiveWriteup(this.app);
    if (!writeup) {
      new Notice('Open a writeup first.');
      return;
    }
    new Notice(`Running publish gate for ${writeup.slug}…`);
    const report = await gateWriteup(writeup.slug, this.vaultPath());
    if (report.error) {
      new Notice(`Gate failed to run: ${report.error}`, 8000);
      return;
    }
    const sections: ResultSection[] = [
      {
        heading: report.ok ? '✓ Passes the publish gate (draft mode)' : '✗ Blocked',
        lines: [],
        tone: report.ok ? 'ok' : 'error',
      },
    ];
    if (report.blockers.length) sections.push({ heading: 'Blockers', lines: report.blockers, tone: 'error' });
    if (report.missingTechSlugs.length)
      sections.push({ heading: 'Unknown technology tags', lines: report.missingTechSlugs, tone: 'error' });
    if (report.missingImages.length)
      sections.push({ heading: 'Missing images', lines: report.missingImages, tone: 'error' });
    if (report.unresolvedRefs.length)
      sections.push({ heading: 'Unresolved references', lines: report.unresolvedRefs, tone: 'error' });
    if (report.nits.length) sections.push({ heading: 'Nits', lines: report.nits, tone: 'warn' });
    new ResultModal(this.app, `Publish gate — ${writeup.slug}`, sections).open();
  }

  // D: derive blast radius from the cordon contract; only prompt for
  // remote_write / deploy. read / local_write / vault_write just run.
  private async confirmIfRisky(action: string, effect: Effect): Promise<boolean> {
    if (!needsConfirm(effect)) return true;
    return window.confirm(`${action}\n\nThis is a ${effect} action. Continue?`);
  }

  private async runGraphicsStatus(): Promise<void> {
    const writeup = await getActiveWriteup(this.app);
    if (!writeup) {
      new Notice('Open a writeup first.');
      return;
    }
    const status = graphicsStatus(this.app, writeup.file);
    const sections: ResultSection[] = [];
    if (!status.items.length) {
      sections.push({ heading: 'No graphics sources', lines: ['graphics/*.figure.json or *.mmd'], tone: 'muted' });
    } else {
      sections.push({
        heading: `Rendered (${status.items.length - status.unrendered.length})`,
        lines: status.items.filter((i) => i.isRendered).map((i) => i.rendered),
        tone: 'ok',
      });
      sections.push({
        heading: `Unrendered (${status.unrendered.length})`,
        lines: status.unrendered.map((i) => i.source),
        tone: status.unrendered.length ? 'warn' : 'muted',
      });
    }
    new ResultModal(this.app, `Graphics — ${writeup.slug}`, sections).open();
  }

  private async runGraphicsRender(): Promise<void> {
    const writeup = await getActiveWriteup(this.app);
    if (!writeup) {
      new Notice('Open a writeup first.');
      return;
    }
    const effect = await effectFor('brand', 'figure', this.vaultPath());
    if (!(await this.confirmIfRisky('Render graphics', effect))) return;
    new Notice(`Rendering graphics · ${effect}…`);
    const res = await renderGraphics(this.app, writeup.file, this.vaultPath());
    const sections: ResultSection[] = [];
    if (res.rendered.length) sections.push({ heading: `Rendered (${res.rendered.length})`, lines: res.rendered, tone: 'ok' });
    if (res.errors.length) sections.push({ heading: `Errors (${res.errors.length})`, lines: res.errors, tone: 'error' });
    if (!res.rendered.length && !res.errors.length)
      sections.push({ heading: 'Nothing to render — all sources already in images/', lines: [], tone: 'muted' });
    new ResultModal(this.app, `Graphics render — ${writeup.slug}`, sections).open();
    await this.onContextChange(); // surface freshly rendered images in the preview
  }

  private async runSchemaCheck(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
      new Notice('Open a markdown doc first.');
      return;
    }
    if (!INDEXED_DIRS.some((dir) => file.path.startsWith(dir))) {
      new Notice(
        'The frontmatter schema applies to docs under 01 Projects / 02 Infrastructure / 03 Runbooks. Writeups use the publish gate instead.',
        8000,
      );
      return;
    }
    const schema = await fetchSchema(this.vaultPath());
    if (!schema) {
      new Notice('Could not load the schema from severino-vault-mcp.');
      return;
    }
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const lint = lintFrontmatter(frontmatter, schema);
    const sections: ResultSection[] = [
      {
        heading: lint.ok ? '✓ Frontmatter matches the schema' : '✗ Issues',
        lines: [],
        tone: lint.ok ? 'ok' : 'error',
      },
    ];
    if (lint.missingRequired.length)
      sections.push({ heading: 'Missing required fields', lines: lint.missingRequired, tone: 'error' });
    if (lint.invalidEnums.length)
      sections.push({ heading: 'Invalid enum values', lines: lint.invalidEnums, tone: 'error' });
    new ResultModal(this.app, `Schema check — ${file.basename}`, sections).open();
  }

  private async runSyncToSite(): Promise<void> {
    const effect = await effectFor('site', 'sync', this.vaultPath());
    if (!(await this.confirmIfRisky('Sync writeups to the site repo', effect))) return;
    new Notice(`Syncing to site repo · ${effect}…`);
    const r = await syncToSite(this.vaultPath());
    if (r.ok) new Notice(`✓ Sync complete · ${effect}`, 6000);
    else new Notice(`Sync failed: ${(r.stderr || '').trim().slice(0, 300)}`, 10000);
  }

  private async runAssetDoctor(): Promise<void> {
    const writeup = await getActiveWriteup(this.app);
    if (!writeup) {
      new Notice('Asset doctor: open a writeup first.');
      return;
    }
    const report = assetReport(this.app, writeup.file, writeup.markdown);
    if (!report.orphans.length && !report.missing.length) {
      new Notice(
        `Asset doctor ✓ ${writeup.slug}: ${report.present.length} images, all referenced, none missing.`,
      );
      return;
    }
    const lines = [`Asset doctor — ${writeup.slug}`];
    if (report.missing.length) lines.push(`Missing (referenced, no file): ${report.missing.join(', ')}`);
    if (report.orphans.length) lines.push(`Orphans (file, unreferenced): ${report.orphans.join(', ')}`);
    new Notice(lines.join('\n'), 10000);
    console.log(`[severino-obsidian] ${lines.join('\n')}`);
  }

  private async openOnSite(): Promise<void> {
    const writeup = await getActiveWriteup(this.app);
    if (!writeup) {
      new Notice('Open a writeup first.');
      return;
    }
    window.open(`${SITE_BASE}/portfolio/${writeup.slug}/`, '_blank');
  }

  private async copySlug(): Promise<void> {
    const writeup = await getActiveWriteup(this.app);
    if (!writeup) {
      new Notice('Open a writeup first.');
      return;
    }
    await navigator.clipboard.writeText(writeup.slug);
    new Notice(`Copied slug: ${writeup.slug}`);
  }
}
