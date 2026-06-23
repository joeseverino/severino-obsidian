import { Notice, TFile } from 'obsidian';
import { runToolJson } from '../exec';
import { launchProject, LAUNCH_TARGETS } from '../launch';
import { CockpitContext, CockpitPanel } from './panel';

interface Project {
  slug: string;
  open: number;
}

interface ProjectsResult {
  ok: boolean;
  projects?: Project[];
}

// The live project inventory + launcher. Projects + open counts come from the
// MCP (`task-projects`); each project's repo path is its `project_path`
// frontmatter (read straight from the vault — derive, don't hand-maintain). The
// launch buttons open that repo in Finder / VS Code / iTerm / GitHub.
export class ProjectsPanel implements CockpitPanel {
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
      const path = this.projectPath(ctx, project.slug);
      const row = body.createDiv({ cls: 'svo-cockpit-row svo-cockpit-project' });

      const name = row.createDiv({ cls: 'svo-cockpit-proj-name' });
      const label = name.createSpan({ cls: 'svo-cockpit-proj-label', text: project.slug });
      label.onclick = () => void ctx.openFile(`01 Projects/${project.slug}/index.md`);
      if (project.open) name.createSpan({ cls: 'svo-cockpit-badge', text: String(project.open) });

      const actions = row.createDiv({ cls: 'svo-cockpit-actions' });
      if (!path) {
        actions.createSpan({ cls: 'svo-cockpit-row-meta', text: 'no project_path' });
        continue;
      }
      for (const target of LAUNCH_TARGETS) {
        const btn = actions.createEl('button', { cls: 'svo-cockpit-launch', text: target.label });
        btn.setAttr('title', `Open ${project.slug} in ${target.label}`);
        btn.onclick = async () => {
          try {
            await launchProject(target.target, path);
          } catch (err) {
            new Notice(`${target.label}: ${String(err)}`, 6000);
          }
        };
      }
    }
  }

  private projectPath(ctx: CockpitContext, slug: string): string | null {
    const file = ctx.app.vault.getAbstractFileByPath(`01 Projects/${slug}/index.md`);
    if (!(file instanceof TFile)) return null;
    const value = ctx.app.metadataCache.getFileCache(file)?.frontmatter?.project_path;
    return typeof value === 'string' ? value : null;
  }
}
