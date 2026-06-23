import { runToolJson } from '../exec';
import { CockpitContext, CockpitPanel } from './panel';

interface Task {
  slug: string;
  title: string;
  project: string;
  relative_path: string;
  stale: boolean;
  age_days: number;
}

interface Board {
  ok: boolean;
  count: number;
  total: number;
  counts: { stale: number };
  tasks: Task[];
}

// The backlog at a glance — open + stale counts, then the work that needs a
// look (stale first, else the top open items), each row opening the task. Thin
// over `severino-vault-mcp task-list`: the MCP is the brain, this only paints.
export class BacklogPanel implements CockpitPanel {
  id = 'backlog';
  title = 'Backlog';

  async render(body: HTMLElement, ctx: CockpitContext): Promise<void> {
    const r = await runToolJson<Board>('severino-vault-mcp', ['task-list'], { cwd: ctx.vaultPath });
    const board = r.data;
    if (!board?.ok) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'Could not load the backlog.' });
      return;
    }

    const summary = body.createDiv({ cls: 'svo-cockpit-summary' });
    summary.createSpan({ cls: 'svo-cockpit-stat', text: `${board.count} open` });
    const staleStat = summary.createSpan({ cls: 'svo-cockpit-stat', text: `${board.counts.stale} stale` });
    if (board.counts.stale > 0) staleStat.addClass('svo-cockpit-stat-warn');

    const staleTasks = board.tasks.filter((t) => t.stale);
    const showing = staleTasks.length ? staleTasks : board.tasks.slice(0, 8);
    body.createDiv({
      cls: 'svo-cockpit-rowhead',
      text: staleTasks.length ? 'Stale — needs a look' : 'Open work',
    });
    if (!showing.length) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'Nothing open. Clear.' });
      return;
    }
    for (const t of showing) {
      const row = body.createDiv({ cls: 'svo-cockpit-row' });
      row.createSpan({ cls: 'svo-cockpit-row-title', text: t.title });
      row.createSpan({
        cls: 'svo-cockpit-row-meta',
        text: t.stale ? `${t.project} · ${t.age_days}d` : t.project,
      });
      row.onclick = () => void ctx.openFile(t.relative_path);
    }
  }
}
