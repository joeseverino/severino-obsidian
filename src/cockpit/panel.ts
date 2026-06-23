import { App } from 'obsidian';

// The cockpit is an extensible host: each pane implements CockpitPanel and is
// listed in the view's registry. A panel renders read-only fleet/vault state
// (derived from the MCP / CLIs — it owns no logic) and may open a file. New
// panels (fleet renders, inbox triage, the relation editor) just add to the
// registry; the shell stays unchanged.
export interface CockpitContext {
  app: App;
  vaultPath: string;
  /** Open a vault file by its vault-relative path (e.g. a task). */
  openFile: (relativePath: string) => Promise<void>;
}

export interface CockpitPanel {
  title: string;
  render(body: HTMLElement, ctx: CockpitContext): Promise<void>;
}
