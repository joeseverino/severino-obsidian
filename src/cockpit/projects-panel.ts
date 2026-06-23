import { runToolJson } from '../exec';
import { CockpitContext, CockpitPanel } from './panel';
import { projectPathOf, renderLaunchButtons } from './util';

interface Project {
  slug: string;
  open: number;
}

interface ProjectsResult {
  ok: boolean;
  projects?: Project[];
}

// The live project inventory + launcher. Projects + open counts from the MCP
// (`task-projects`); each project's repo path from its `project_path`
// frontmatter (derive, don't hand-maintain). Launch buttons open Finder / VS
// Code / iTerm / GitHub.
export class ProjectsPanel implements CockpitPanel {
  id = 'projects';
  title = 'Projects';

  async render(body: HTMLElement, ctx: CockpitContext): Promise<void> {
    const r = await runToolJson<ProjectsResult>('severino-vault-mcp', ['task-projects'], { cwd: ctx.vaultPath });
    const projects = (r.data?.projects ?? []).slice();
    if (!projects.length) {
      body.createDiv({ cls: 'svo-cockpit-empty', text: 'No projects found.' });
      return;
    }
    // Projects with open work first, then alphabetical.
    projects.sort((a, b) => b.open - a.open || a.slug.localeCompare(b.slug));

    for (const project of projects) {
      const path = projectPathOf(ctx.app, project.slug);
      const card = body.createDiv({ cls: 'svo-proj' });

      const head = card.createDiv({ cls: 'svo-proj-head' });
      const name = head.createSpan({ cls: 'svo-proj-name', text: project.slug });
      name.onclick = () => void ctx.openFile(`01 Projects/${project.slug}/index.md`);
      const count = head.createSpan({ cls: 'svo-proj-count' });
      if (project.open) count.setText(String(project.open));

      if (path) renderLaunchButtons(card, path);
      else card.createDiv({ cls: 'svo-cockpit-row-meta', text: 'no project_path' });
    }
  }
}
