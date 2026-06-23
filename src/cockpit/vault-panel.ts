import { Notice } from 'obsidian';
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

// Vault health, derived from `severino-vault-mcp brief` — doc count, docs overdue
// for review, inbox pileup — plus a one-click idempotent fix (backfill-aliases).
// Read-first; fixes reuse the MCP, the plugin only renders + triggers.
export class VaultPanel implements CockpitPanel {
  title = 'Vault';

  async render(body: HTMLElement, ctx: CockpitContext): Promise<void> {
    const r = await runToolJson<Brief>('severino-vault-mcp', ['brief', '--days', '7'], { cwd: ctx.vaultPath });
    const brief = r.data;
    if (!brief?.ok) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'Could not load the vault brief.' });
      return;
    }
    const review = brief.docs_to_review ?? { count: 0, docs: [] };
    const inbox = brief.inbox?.count ?? 0;

    const summary = body.createDiv({ cls: 'svo-cockpit-summary' });
    summary.createSpan({ cls: 'svo-cockpit-stat', text: `${brief.vault_doc_count ?? 0} docs` });
    const reviewStat = summary.createSpan({ cls: 'svo-cockpit-stat', text: `${review.count} to review` });
    if (review.count > 0) reviewStat.addClass('svo-cockpit-stat-warn');
    const inboxStat = summary.createSpan({ cls: 'svo-cockpit-stat', text: `${inbox} inbox` });
    if (inbox > 0) inboxStat.addClass('svo-cockpit-stat-warn');

    if (review.count) {
      body.createDiv({ cls: 'svo-cockpit-rowhead', text: 'Overdue for review' });
      for (const doc of review.docs.slice(0, 6)) {
        const row = body.createDiv({ cls: 'svo-cockpit-row' });
        row.createSpan({ cls: 'svo-cockpit-row-title', text: doc.title });
        row.createSpan({ cls: 'svo-cockpit-row-meta', text: `${doc.age_days}d` });
        row.onclick = () => void ctx.openFile(doc.obsidian_path);
      }
    } else {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'Nothing overdue. Clean.' });
    }

    const fixes = body.createDiv({ cls: 'svo-cockpit-actions svo-cockpit-fixes' });
    const aliasBtn = fixes.createEl('button', { cls: 'svo-cockpit-launch', text: 'Backfill aliases' });
    aliasBtn.setAttr('title', 'Repair folder-note aliases (severino-vault-mcp backfill-aliases)');
    aliasBtn.onclick = async () => {
      aliasBtn.disabled = true;
      const res = await runTool('severino-vault-mcp', ['backfill-aliases'], { cwd: ctx.vaultPath });
      new Notice(res.ok ? 'Aliases backfilled.' : `Backfill failed: ${res.stderr.slice(0, 200)}`, 6000);
      aliasBtn.disabled = false;
    };
  }
}
