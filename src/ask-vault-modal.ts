import { App, SuggestModal, TFile } from 'obsidian';
import { runToolJson } from './exec.ts';
import { arrayOf, isString, optional, shape, type Infer } from './guards.ts';

const hitSpec = {
  doc_id: isString,
  title: isString,
  obsidian_path: isString,
  heading: optional(isString),
  section_summary: optional(isString),
};
type Hit = Infer<typeof hitSpec>;

const isFindResult = shape({ hits: optional(arrayOf(shape(hitSpec))) });

// Ask the vault: the vault MCP's `find` ranking, surfaced through Obsidian's
// own quick-switcher (SuggestModal). The MCP answers "how do I X"; this only
// renders the menu and opens the hit. One owner (the MCP search), a native face.
export class AskVaultModal extends SuggestModal<Hit> {
  private lastQuery = '';
  private lastHits: Hit[] = [];

  private readonly vaultPath: string;

  constructor(app: App, vaultPath: string) {
    super(app);
    this.vaultPath = vaultPath;
    this.setPlaceholder('Ask the vault — find a runbook, doc, or section…');
  }

  override async getSuggestions(query: string): Promise<Hit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    if (q === this.lastQuery) return this.lastHits; // dedupe — don't re-exec per keystroke
    const r = await runToolJson(
      'severino-vault-mcp',
      ['find', q, '--limit', '8'],
      isFindResult,
      { cwd: this.vaultPath },
    );
    this.lastQuery = q;
    this.lastHits = r.data?.hits ?? [];
    return this.lastHits;
  }

  override renderSuggestion(hit: Hit, el: HTMLElement): void {
    el.createDiv({ cls: 'svo-ask-title', text: hit.heading || hit.title });
    const sub = el.createDiv({ cls: 'svo-ask-meta' });
    sub.createSpan({ text: hit.doc_id });
    if (hit.section_summary) {
      el.createDiv({ cls: 'svo-ask-summary', text: hit.section_summary });
    }
  }

  override onChooseSuggestion(hit: Hit): void {
    const file = this.app.vault.getAbstractFileByPath(hit.obsidian_path);
    if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
  }
}
