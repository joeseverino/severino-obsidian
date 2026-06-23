import { ItemView, WorkspaceLeaf, TFile, FileSystemAdapter } from 'obsidian';
import { CockpitPanel, CockpitContext } from './cockpit/panel';
import { BacklogPanel } from './cockpit/backlog-panel';

export const COCKPIT_VIEW_TYPE = 'severino-cockpit';

// The cockpit shell: a brand-skinned host that renders a registry of panels.
// It owns only the chrome (header, layout, refresh) and the file-open seam;
// every panel derives its data from the MCP / CLIs. To add a panel, append it
// here — the shell does not change.
const PANELS: CockpitPanel[] = [new BacklogPanel()];

export class CockpitView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
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
    await this.refresh();
  }

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

  async refresh(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('svo-cockpit');

    const header = contentEl.createDiv({ cls: 'svo-cockpit-header' });
    header.createSpan({ cls: 'svo-cockpit-brand', text: 'Severino' });
    header.createSpan({ cls: 'svo-cockpit-heading', text: 'Cockpit' });
    const refresh = header.createEl('button', { cls: 'svo-cockpit-refresh', text: 'Refresh' });
    refresh.onclick = () => void this.refresh();

    const ctx = this.context();
    for (const panel of PANELS) {
      const section = contentEl.createDiv({ cls: 'svo-cockpit-panel' });
      section.createDiv({ cls: 'svo-cockpit-panel-title', text: panel.title });
      const panelBody = section.createDiv({ cls: 'svo-cockpit-panel-body' });
      try {
        await panel.render(panelBody, ctx);
      } catch (err) {
        panelBody.createDiv({ cls: 'svo-cockpit-empty', text: `Panel error: ${String(err)}` });
      }
    }
  }
}
