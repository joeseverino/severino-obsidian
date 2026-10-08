import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isRecord, isString, type Guard } from './guards.ts';

// The plugin's bridge to the rest of the system: it invokes the same CLIs the
// `site` TUI and AI sessions use (severino-vault-mcp, site, brand, diagram) and
// consumes their output. It never reimplements their logic.
//
// Obsidian is GUI-launched, so it inherits a minimal PATH. Tools resolve to
// ~/.local/bin explicitly and get an augmented PATH so the bash CLIs can reach
// their own dependencies.
const HOME = process.env.HOME ?? '';
const BIN = `${HOME}/.local/bin`;
const PATH = [BIN, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH ?? '']
  .filter(Boolean)
  .join(':');

const execFileAsync = promisify(execFile);

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

export async function runTool(bin: string, args: string[], opts: RunOpts): Promise<ToolResult> {
  const pending = execFileAsync(`${BIN}/${bin}`, args, {
    cwd: opts.cwd,
    env: { ...process.env, PATH, HOME, ...opts.env },
    signal: AbortSignal.timeout(120_000),
    maxBuffer: 16 * 1024 * 1024,
  });
  // A tool that exits without reading stdin raises EPIPE here; its exit status is the result.
  pending.child.stdin?.on('error', () => {});
  pending.child.stdin?.end(opts.input ?? '');
  try {
    const { stdout, stderr } = await pending;
    return { ok: true, stdout, stderr };
  } catch (err) {
    // execFile rejects with the captured output attached to the error.
    const out = isRecord(err) ? err : {};
    const message = err instanceof Error ? err.message : '';
    return {
      ok: false,
      stdout: isString(out.stdout) ? out.stdout : '',
      stderr: (isString(out.stderr) ? out.stderr : '') || message || String(err),
    };
  }
}

export async function runToolJson<T>(
  bin: string,
  args: string[],
  isT: Guard<T>,
  opts: RunOpts,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const r = await runTool(bin, args, opts);
  // The MCP console prints JSON to stdout even on a handled error result, so
  // stdout is parsed regardless of exit code; stderr is the fallback.
  if (r.stdout.trim()) {
    try {
      const parsed: unknown = JSON.parse(r.stdout);
      if (isT(parsed)) return { ok: true, data: parsed };
    } catch {
      // not JSON: fall through to the error result
    }
  }
  return { ok: false, error: r.stderr || 'No parseable output' };
}
