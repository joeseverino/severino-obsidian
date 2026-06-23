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
  counts: { stale: number };
  tasks: Task[];
  shipped: Task[];
  shipped_days: number;
}

// The backlog, scoped to context. In a project it shows that project's open work
// + what it shipped; the Project/All toggle flips to the whole fleet. Thin over
// `severino-vault-mcp task-list [--project X]` — the MCP filters, this paints.
export class BacklogPanel implements CockpitPanel {
  id = 'backlog';
  title = 'Backlog';
  private mode: 'project' | 'all' = 'project';

  async render(body: HTMLElement, ctx: CockpitContext): Promise<void> {
    const activeProject = this.activeProject(ctx);
    const scope = this.mode === 'project' && activeProject ? activeProject : null;

    // Header: actions + Project/All toggle.
    const head = body.createDiv({ cls: 'svo-panel-actions' });
    head.createEl('button', { cls: 'svo-panel-action mod-cta', text: '+ New' }).onclick = () => ctx.newTask();
    head.createEl('button', { cls: 'svo-panel-action', text: 'View all' }).onclick = () => void ctx.openFile('Backlog.base');
    const toggle = head.createDiv({ cls: 'svo-toggle' });
    const projTab = toggle.createEl('button', { cls: 'svo-toggle-btn', text: 'Project' });
    projTab.toggleClass('is-active', scope !== null);
    projTab.disabled = !activeProject;
    projTab.onclick = () => {
      this.mode = 'project';
      ctx.refresh();
    };
    const allTab = toggle.createEl('button', { cls: 'svo-toggle-btn', text: 'All' });
    allTab.toggleClass('is-active', scope === null);
    allTab.onclick = () => {
      this.mode = 'all';
      ctx.refresh();
    };

    const args = scope ? ['task-list', '--project', scope] : ['task-list'];
    const board = (await runToolJson<Board>('severino-vault-mcp', args, { cwd: ctx.vaultPath })).data;
    if (!board?.ok) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'Could not load the backlog.' });
      return;
    }

    const staleCount = board.tasks.filter((t) => t.stale).length;
    const stat = body.createDiv({ cls: 'svo-cockpit-summary' });
    stat.createSpan({ cls: 'svo-scope', text: scope ?? 'All projects' });
    stat.createSpan({ cls: 'svo-cockpit-stat', text: `${board.count} open` });
    const staleStat = stat.createSpan({ cls: 'svo-cockpit-stat', text: `${staleCount} stale` });
    if (staleCount) staleStat.addClass('svo-cockpit-stat-warn');

    // Open work — a project shows all of its open tasks; the fleet view curates
    // (stale first, else the top of the queue).
    const stale = board.tasks.filter((t) => t.stale);
    const open = scope ? board.tasks : stale.length ? stale : board.tasks.slice(0, 8);
    body.createDiv({ cls: 'svo-cockpit-rowhead', text: !scope && stale.length ? 'Stale — needs a look' : 'Open work' });
    if (!open.length) body.createDiv({ cls: 'svo-cockpit-empty', text: 'Nothing open here. Clear.' });
    for (const t of open) {
      const row = body.createDiv({ cls: 'svo-cockpit-row' });
      row.createSpan({ cls: 'svo-cockpit-row-title', text: t.title });
      row.createSpan({ cls: 'svo-cockpit-row-meta', text: scope ? (t.stale ? `${t.age_days}d` : '') : t.project });
      row.onclick = () => void ctx.openFile(t.relative_path);
    }

    if (board.shipped.length) {
      body.createDiv({ cls: 'svo-cockpit-rowhead', text: `Shipped (${board.shipped_days}d)` });
      for (const t of board.shipped.slice(0, 12)) {
        const row = body.createDiv({ cls: 'svo-cockpit-row svo-shipped-row' });
        row.createSpan({ cls: 'svo-cockpit-row-title', text: t.title });
        row.createSpan({ cls: 'svo-cockpit-row-meta', text: scope ? '' : t.project });
        row.onclick = () => void ctx.openFile(t.relative_path);
      }
    }
  }

  private activeProject(ctx: CockpitContext): string | null {
    const path = ctx.app.workspace.getActiveFile()?.path ?? '';
    const m = /^01 Projects\/([^/]+)\//.exec(path);
    return m ? m[1] : null;
  }
}
