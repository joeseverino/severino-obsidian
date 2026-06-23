import { App, Notice, TFile, setIcon } from 'obsidian';
import { LAUNCH_TARGETS, launchProject } from '../launch';

// A project's repo path = its `project_path` frontmatter (the owner). One reader,
// shared by the Projects panel and the context bar.
export function projectPathOf(app: App, slug: string): string | null {
  const file = app.vault.getAbstractFileByPath(`01 Projects/${slug}/index.md`);
  if (!(file instanceof TFile)) return null;
  const value = app.metadataCache.getFileCache(file)?.frontmatter?.project_path;
  return typeof value === 'string' ? value : null;
}

const LAUNCH_ICON: Record<string, string> = {
  finder: 'folder',
  vscode: 'code',
  iterm: 'square-terminal',
  github: 'github',
};

// Icon-only launch buttons (Finder / VS Code / iTerm / GitHub). Shared by the
// Projects panel and the context bar so the launcher renders one way.
export function renderLaunchButtons(container: HTMLElement, projectPath: string): void {
  const group = container.createDiv({ cls: 'svo-launch' });
  for (const target of LAUNCH_TARGETS) {
    const btn = group.createEl('button', { cls: 'svo-launch-btn' });
    setIcon(btn, LAUNCH_ICON[target.target] ?? 'external-link');
    btn.setAttr('aria-label', `Open in ${target.label}`);
    btn.setAttr('title', `Open in ${target.label}`);
    btn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await launchProject(target.target, projectPath);
      } catch (err) {
        new Notice(`${target.label}: ${String(err)}`, 6000);
      }
    };
  }
}
