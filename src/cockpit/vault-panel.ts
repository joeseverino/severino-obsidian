import { Notice, TFile, TFolder, setIcon } from 'obsidian';
import { runTool, runToolJson } from '../exec';
import { CockpitContext, CockpitPanel } from './panel';

interface ReviewDoc {
  doc_id: string;
  title: string;
  obsidian_path: string;
  age_days: number;
}

interface Brief {
  ok: boolean;
  vault_doc_count?: number;
  docs_to_review?: { count: number; docs: ReviewDoc[] };
  inbox?: { count: number };
}

// Vault health + inbox triage. Health from `severino-vault-mcp brief` (docs to
// review, doc count); triage lists 00 Inbox/ captures with one-action
// promote (→ task) / archive; a one-click alias fix at the bottom. Read-first;
// writes reuse the MCP / Obsidian — the panel only renders + triggers.
export class VaultPanel implements CockpitPanel {
  id = 'vault';
  title = 'Vault';

  async render(body: HTMLElement, ctx: CockpitContext): Promise<void> {
    const r = await runToolJson<Brief>('severino-vault-mcp', ['brief', '--days', '7'], { cwd: ctx.vaultPath });
    const brief = r.data;
    if (!brief?.ok) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'Could not load the vault brief.' });
      return;
    }
    const review = brief.docs_to_review ?? { count: 0, docs: [] };

    // Inbox triage — list captures (top-level 00 Inbox/*.md).
    const inboxFolder = ctx.app.vault.getAbstractFileByPath('00 Inbox');
    const notes =
      inboxFolder instanceof TFolder
        ? inboxFolder.children.filter(
            (c): c is TFile => c instanceof TFile && c.extension === 'md' && !c.name.startsWith('_'),
          )
        : [];

    const summary = body.createDiv({ cls: 'svo-cockpit-summary' });
    summary.createSpan({ cls: 'svo-cockpit-stat', text: `${brief.vault_doc_count ?? 0} docs` });
    const reviewStat = summary.createSpan({ cls: 'svo-cockpit-stat', text: `${review.count} to review` });
    if (review.count > 0) reviewStat.addClass('svo-cockpit-stat-warn');
    const inboxStat = summary.createSpan({ cls: 'svo-cockpit-stat', text: `${notes.length} inbox` });
    if (notes.length > 0) inboxStat.addClass('svo-cockpit-stat-warn');

    if (notes.length) {
      body.createDiv({ cls: 'svo-cockpit-rowhead', text: 'Inbox — triage' });
      for (const note of notes) {
        const row = body.createDiv({ cls: 'svo-cockpit-row' });
        const title = row.createSpan({ cls: 'svo-cockpit-row-title', text: note.basename });
        title.onclick = () => void ctx.openFile(note.path);
        const acts = row.createDiv({ cls: 'svo-launch' });
        const promote = acts.createEl('button', { cls: 'svo-launch-btn' });
        setIcon(promote, 'list-plus');
        promote.setAttr('aria-label', 'Promote to task');
        promote.onclick = (e) => {
          e.stopPropagation();
          ctx.promoteNote(note.path);
        };
        const archive = acts.createEl('button', { cls: 'svo-launch-btn' });
        setIcon(archive, 'archive');
        archive.setAttr('aria-label', 'Archive');
        archive.onclick = async (e) => {
          e.stopPropagation();
          await ctx.archiveNote(note.path);
          ctx.refresh();
        };
      }
    }

    if (review.count) {
      body.createDiv({ cls: 'svo-cockpit-rowhead', text: 'Overdue for review' });
      for (const doc of review.docs.slice(0, 6)) {
        const row = body.createDiv({ cls: 'svo-cockpit-row' });
        row.createSpan({ cls: 'svo-cockpit-row-title', text: doc.title });
        row.createSpan({ cls: 'svo-cockpit-row-meta', text: `${doc.age_days}d` });
        row.onclick = () => void ctx.openFile(doc.obsidian_path);
      }
    }

    const fixes = body.createDiv({ cls: 'svo-cockpit-fixes' });
    const aliasBtn = fixes.createEl('button', { text: 'Backfill aliases' });
    aliasBtn.setAttr('aria-label', 'Repair folder-note aliases (severino-vault-mcp backfill-aliases)');
    aliasBtn.onclick = async () => {
      aliasBtn.disabled = true;
      const res = await runTool('severino-vault-mcp', ['backfill-aliases'], { cwd: ctx.vaultPath });
      new Notice(res.ok ? 'Aliases backfilled.' : `Backfill failed: ${res.stderr.slice(0, 200)}`, 6000);
      aliasBtn.disabled = false;
    };
  }
}
