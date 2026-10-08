import { runToolJson } from '../exec.ts';
import { arrayOf, isBoolean, isString, optional, shape, type Infer } from '../guards.ts';
import type { CockpitContext, CockpitPanel } from './panel.ts';

const writeupSpec = {
  slug: isString,
  title: optional(isString),
  published: optional(isBoolean),
};
type Writeup = Infer<typeof writeupSpec>;

const isWriteupsResult = shape({ writeups: optional(arrayOf(shape(writeupSpec))) });

// The writeup pipeline at a glance — drafts first (what needs finishing), then
// published. Derived from `severino-vault-mcp list-writeups`; each row opens the
// writeup. Pairs with the context bar's "Open preview" when you're in one.
export class WriteupsPanel implements CockpitPanel {
  id = 'writeups';
  title = 'Writeups';

  async render(body: HTMLElement, ctx: CockpitContext): Promise<void> {
    const r = await runToolJson('severino-vault-mcp', ['list-writeups', '--filter', 'all'], isWriteupsResult, { cwd: ctx.vaultPath });
    const writeups = r.data?.writeups ?? [];
    if (!writeups.length) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'No writeups.' });
      return;
    }
    const drafts = writeups.filter((w) => !w.published);
    const published = writeups.filter((w) => w.published);

    const section = (label: string, list: Writeup[]) => {
      if (!list.length) return;
      body.createDiv({ cls: 'svo-cockpit-rowhead', text: `${label} (${list.length})` });
      for (const w of list) {
        const row = body.createDiv({ cls: 'svo-cockpit-row' });
        row.createSpan({ cls: 'svo-cockpit-row-title', text: w.title || w.slug });
        row.createSpan({ cls: 'svo-cockpit-row-meta', text: w.published ? 'published' : 'draft' });
        row.onclick = () => void ctx.openFile(`05 Writeups/${w.slug}/index.md`);
      }
    };
    section('Drafts', drafts);
    section('Published', published);
  }
}
