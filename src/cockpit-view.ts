import { ItemView, WorkspaceLeaf, TFile, FileSystemAdapter, debounce, setIcon } from 'obsidian';
import { CockpitPanel, CockpitContext } from './cockpit/panel';
import { BacklogPanel } from './cockpit/backlog-panel';
import { ProjectsPanel } from './cockpit/projects-panel';
import { WriteupsPanel } from './cockpit/writeups-panel';
import { VaultPanel } from './cockpit/vault-panel';
import { projectPathOf, renderLaunchButtons } from './cockpit/util';
import brandMark from '@site/brand-mark';

export const COCKPIT_VIEW_TYPE = 'severino-cockpit';

export interface CockpitActions {
  openPreview: () => void | Promise<void>;
}

// The cockpit shell: a brand-skinned, tabbed host. The chrome (logo header,
// context bar, tabs) is built once; only the active panel's body re-renders, so
// switching tabs and auto-refresh don't reset scroll. The context bar reacts to
// the active file (a writeup → open preview; a project → launch). Panels derive
// their data from the MCP; the shell owns only the chrome + the open/preview
// seams.
const PANELS: CockpitPanel[] = [new BacklogPanel(), new ProjectsPanel(), new WriteupsPanel(), new VaultPanel()];

export class CockpitView extends ItemView {
  private activeId = PANELS[0].id;
  private contextEl: HTMLElement | null = null;
  private tabBarEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly actions: CockpitActions,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return COCKPIT_VIEW_TYPE;
  }
  getDisplayText(): string {
    return 'Severino cockpit';
  }
  getIcon(): string {
    return 'layout-dashboard';
  }

  async onOpen(): Promise<void> {
    this.buildChrome();
    // Auto-refresh: re-pull the active panel when the vault changes (debounced),
    // and re-read context on file switches.
    this.registerEvent(this.app.metadataCache.on('changed', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('rename', () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.renderContext()));
    this.renderContext();
    await this.renderActive();
  }

  private scheduleRefresh = debounce(() => {
    this.renderContext();
    void this.renderActive();
  }, 500, true);

  private vaultPath(): string {
    const adapter = this.app.vault.adapter;
    return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : '';
  }

  private context(): CockpitContext {
    return {
      app: this.app,
      vaultPath: this.vaultPath(),
      openFile: async (relativePath) => {
        const file = this.app.vault.getAbstractFileByPath(relativePath);
        if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
      },
    };
  }

  private buildChrome(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('svo-cockpit');

    const header = contentEl.createDiv({ cls: 'svo-cockpit-header' });
    // The real brand mark (bundled trusted asset, not user input).
    header.createSpan({ cls: 'svo-cockpit-logo' }).innerHTML = brandMark;
    header.createSpan({ cls: 'svo-cockpit-heading', text: 'Cockpit' });
    const refresh = header.createEl('button', { cls: 'svo-cockpit-refresh' });
    setIcon(refresh, 'refresh-cw');
    refresh.setAttr('aria-label', 'Refresh');
    refresh.onclick = () => {
      this.renderContext();
      void this.renderActive();
    };

    this.contextEl = contentEl.createDiv({ cls: 'svo-cockpit-context' });

    this.tabBarEl = contentEl.createDiv({ cls: 'svo-cockpit-tabs' });
    for (const panel of PANELS) {
      const tab = this.tabBarEl.createEl('button', { cls: 'svo-cockpit-tab', text: panel.title });
      tab.dataset.id = panel.id;
      tab.toggleClass('is-active', panel.id === this.activeId);
      tab.onclick = () => this.selectTab(panel.id);
    }

    this.bodyEl = contentEl.createDiv({ cls: 'svo-cockpit-body' });
  }

  private selectTab(id: string): void {
    this.activeId = id;
    for (const tab of Array.from(this.tabBarEl?.children ?? [])) {
      (tab as HTMLElement).toggleClass('is-active', (tab as HTMLElement).dataset.id === id);
    }
    void this.renderActive();
  }

  private async renderActive(): Promise<void> {
    const body = this.bodyEl;
    if (!body) return;
    body.empty();
    const panel = PANELS.find((p) => p.id === this.activeId) ?? PANELS[0];
    try {
      await panel.render(body, this.context());
    } catch (err) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: `Panel error: ${String(err)}` });
    }
  }

  // The context bar reflects the active file: a writeup gets an Open-preview
  // button; a project doc gets its launch buttons.
  private renderContext(): void {
    const el = this.contextEl;
    if (!el) return;
    el.empty();
    const path = this.app.workspace.getActiveFile()?.path ?? '';

    const writeup = /^05 Writeups\/([^/]+)\//.exec(path);
    if (writeup) {
      el.removeClass('is-empty');
      el.createSpan({ cls: 'svo-cockpit-context-label', text: writeup[1] });
      const btn = el.createEl('button', { cls: 'svo-cockpit-context-btn', text: 'Open preview' });
      btn.onclick = () => void this.actions.openPreview();
      return;
    }

    const project = /^01 Projects\/([^/]+)\//.exec(path);
    if (project) {
      const repoPath = projectPathOf(this.app, project[1]);
      if (repoPath) {
        el.removeClass('is-empty');
        el.createSpan({ cls: 'svo-cockpit-context-label', text: project[1] });
        renderLaunchButtons(el, repoPath);
        return;
      }
    }

    el.addClass('is-empty');
  }

  // Public so the plugin can refresh it after a write (create / move / promote).
  async refresh(): Promise<void> {
    this.renderContext();
    await this.renderActive();
  }
}
