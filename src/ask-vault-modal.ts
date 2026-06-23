import { App, SuggestModal, TFile } from 'obsidian';
import { runToolJson } from './exec';

interface Hit {
  doc_id: string;
  title: string;
  obsidian_path: string;
  heading?: string;
  section_summary?: string;
}

interface FindResult {
  hits?: Hit[];
}

// Ask the vault: the MCP's `find_runbook` ranking, surfaced through Obsidian's
// own quick-switcher (SuggestModal). The MCP answers "how do I X"; this only
// renders the menu and opens the hit. One owner (the MCP search), a native face.
export class AskVaultModal extends SuggestModal<Hit> {
  private lastQuery = '';
  private lastHits: Hit[] = [];

  constructor(
    app: App,
    private readonly vaultPath: string,
  ) {
    super(app);
    this.setPlaceholder('Ask the vault — find a runbook, doc, or section…');
  }

  async getSuggestions(query: string): Promise<Hit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    if (q === this.lastQuery) return this.lastHits; // dedupe — don't re-exec per keystroke
    const r = await runToolJson<FindResult>(
      'severino-vault-mcp',
      ['find', q, '--limit', '8'],
      { cwd: this.vaultPath },
    );
    this.lastQuery = q;
    this.lastHits = r.data?.hits ?? [];
    return this.lastHits;
  }

  renderSuggestion(hit: Hit, el: HTMLElement): void {
    el.createDiv({ cls: 'svo-ask-title', text: hit.heading || hit.title });
    const sub = el.createDiv({ cls: 'svo-ask-meta' });
    sub.createSpan({ text: hit.doc_id });
    if (hit.section_summary) {
      el.createDiv({ cls: 'svo-ask-summary', text: hit.section_summary });
    }
  }

  onChooseSuggestion(hit: Hit): void {
    const file = this.app.vault.getAbstractFileByPath(hit.obsidian_path);
    if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
  }
}
