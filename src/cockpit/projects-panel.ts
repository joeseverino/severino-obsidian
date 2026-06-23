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
      // One line: name (left), launch icons (right, on hover), count (far right).
      const row = body.createDiv({ cls: 'svo-proj' });
      const name = row.createSpan({ cls: 'svo-proj-name', text: project.slug });
      name.onclick = () => void ctx.openFile(`01 Projects/${project.slug}/index.md`);
      if (path) renderLaunchButtons(row, path);
      row.createSpan({ cls: 'svo-proj-count', text: project.open ? String(project.open) : '' });
    }
  }
}
