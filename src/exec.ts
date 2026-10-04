import { execFile } from 'child_process';

// The plugin's bridge to the rest of the system: it invokes the same CLIs the
// `site` TUI and AI sessions use (severino-vault-mcp, site, brand, diagram) and
// consumes their output. It never reimplements their logic.
//
// Obsidian is GUI-launched, so it inherits a minimal PATH — we resolve tools to
// ~/.local/bin explicitly and pass an augmented PATH so the bash CLIs can reach
// their own dependencies.
const HOME = process.env.HOME ?? '';
const BIN = `${HOME}/.local/bin`;
const PATH = [BIN, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH ?? '']
  .filter(Boolean)
  .join(':');

export interface ToolResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export interface RunOpts {
  cwd: string;
  /** Extra env vars (e.g. SVMC_VAULT_PATH for the MCP). */
  env?: Record<string, string>;
  /** Written to the tool's stdin, then closed. */
  input?: string;
}

export function runTool(bin: string, args: string[], opts: RunOpts): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = execFile(
      `${BIN}/${bin}`,
      args,
      {
        cwd: opts.cwd,
        env: { ...process.env, PATH, HOME, ...(opts.env ?? {}) },
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) resolve({ ok: false, stdout: stdout ?? '', stderr: stderr || err.message || String(err) });
        else resolve({ ok: true, stdout, stderr });
      },
    );
    child.stdin?.end(opts.input ?? '');
  });
}

export async function runToolJson<T = unknown>(
  bin: string,
  args: string[],
  opts: RunOpts,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const r = await runTool(bin, args, opts);
  // The MCP console prints JSON to stdout even on a handled error result, so we
  // try to parse stdout regardless of exit code; only fall back to stderr.
  if (r.stdout.trim()) {
    try {
      return { ok: true, data: JSON.parse(r.stdout) as T };
    } catch {
      /* fall through */
    }
  }
  return { ok: false, error: r.stderr || 'No parseable output' };
}
