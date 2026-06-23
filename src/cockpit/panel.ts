import { App } from 'obsidian';

// The cockpit is a tabbed host: each pane implements CockpitPanel and is listed
// in the view's registry. A panel renders read-only fleet/vault state (derived
// from the MCP / CLIs — it owns no logic) and may open a file. New panels just
// add to the registry; the shell stays unchanged.
export interface CockpitContext {
  app: App;
  vaultPath: string;
  /** Open a vault file by its vault-relative path. */
  openFile: (relativePath: string) => Promise<void>;
  /** Open the New-task modal. */
  newTask: () => void;
  /** Promote a note (e.g. an inbox capture) into a task via the MCP. */
  promoteNote: (relativePath: string) => void;
  /** Archive a note to 99 Archive/ (Obsidian-managed move). */
  archiveNote: (relativePath: string) => Promise<void>;
  /** Re-render the active panel (after a panel action mutates state). */
  refresh: () => void;
}

export interface CockpitPanel {
  id: string;
  title: string;
  render(body: HTMLElement, ctx: CockpitContext): Promise<void>;
}
