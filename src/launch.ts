import { execFile } from 'child_process';

// Open a project's repo in an external app. The plugin owns only this UI action;
// the path comes from the project's `project_path` frontmatter (derive, don't
// hand-maintain), and the GitHub URL from that repo's git remote — read on click.
export type LaunchTarget = 'finder' | 'vscode' | 'iterm' | 'github';

export const LAUNCH_TARGETS: { target: LaunchTarget; label: string }[] = [
  { target: 'finder', label: 'Finder' },
  { target: 'vscode', label: 'VS Code' },
  { target: 'iterm', label: 'iTerm' },
  { target: 'github', label: 'GitHub' },
];

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout).trim());
    });
  });
}

// git remote (ssh or https) → the https web URL.
function webUrl(remote: string): string | null {
  const r = remote.trim().replace(/\.git$/, '');
  const ssh = /^git@([^:]+):(.+)$/.exec(r);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  if (r.startsWith('http')) return r;
  return null;
}

export async function launchProject(target: LaunchTarget, projectPath: string): Promise<void> {
  switch (target) {
    case 'finder':
      await run('/usr/bin/open', [projectPath]);
      return;
    case 'vscode':
      await run('/usr/bin/open', ['-a', 'Visual Studio Code', projectPath]);
      return;
    case 'iterm':
      await run('/usr/bin/open', ['-a', 'iTerm', projectPath]);
      return;
    case 'github': {
      const remote = await run('/usr/bin/git', ['-C', projectPath, 'remote', 'get-url', 'origin']);
      const url = webUrl(remote);
      if (!url) throw new Error('no GitHub remote on this repo');
      await run('/usr/bin/open', [url]);
      return;
    }
  }
}
