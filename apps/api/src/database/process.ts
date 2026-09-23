import { spawn } from 'node:child_process';

export type ProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  reason?: 'aborted' | 'timeout' | 'output-limit' | 'spawn';
};

/** No shell, bounded buffers/time, and no raw command/output in thrown errors. */
export function boundedProcess(command: string, args: string[], options: {
  cwd?: string; env?: NodeJS.ProcessEnv; input?: string;
  signal?: AbortSignal; timeoutMs?: number; maxOutputBytes?: number;
} = {}): Promise<ProcessResult> {
  if (options.signal?.aborted) return Promise.resolve({ code: null, stdout: '', stderr: '', reason: 'aborted' });
  return new Promise((resolve) => {
    let stdout = '', stderr = '', size = 0, settled = false;
    let reason: ProcessResult['reason'];
    let hardStop: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(command, args, {
      cwd: options.cwd, env: options.env ?? process.env, shell: false,
      windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe']
    });
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearTimeout(hardStop);
      options.signal?.removeEventListener('abort', abort);
      resolve({ code, stdout, stderr, reason });
    };
    const stop = (why: ProcessResult['reason']) => {
      if (settled || reason) return;
      reason = why;
      if (child.pid) {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          killer.on('error', () => { child.kill('SIGKILL'); });
          killer.unref();
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        }
      }
      child.stdin.destroy();
      hardStop = setTimeout(() => {
        child.stdout.destroy(); child.stderr.destroy(); child.unref(); finish(null);
      }, 5_000);
    };
    const abort = () => stop('aborted');
    const timer = setTimeout(() => stop('timeout'), options.timeoutMs ?? 30_000);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    for (const [stream, kind] of [[child.stdout, 'out'], [child.stderr, 'err']] as const) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        size += Buffer.byteLength(chunk);
        if (size > (options.maxOutputBytes ?? 1_048_576)) { stop('output-limit'); return; }
        if (kind === 'out') stdout += chunk; else stderr += chunk;
      });
    }
    child.stdin.on('error', () => { /* EPIPE is reported by the child's exit status. */ });
    child.on('error', () => { reason = 'spawn'; finish(null); });
    child.on('close', finish);
    child.stdin.end(options.input);
  });
}
