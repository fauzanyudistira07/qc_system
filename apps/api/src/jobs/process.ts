import { spawn } from 'node:child_process';

export function cleanEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) if (/^(path|pathext|systemroot|windir|temp|tmp|userprofile|home|appdata|localappdata|programdata|programfiles|comspec|lang|java_home|android_home|android_sdk_root)$/i.test(key)) env[key] = value;
  return env;
}
export function command(file: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal; timeout?: number; input?: string; log?: (text: string) => void } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error('Cancelled'));
    const child = spawn(file, args, { cwd: options.cwd, env: options.env ?? cleanEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let failure: Error | undefined;
    const stop = (reason: string) => { failure = new Error(reason); if (process.platform === 'win32' && child.pid) { const kill = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' }); kill.on('error', () => child.kill()); } else child.kill('SIGKILL'); };
    const timer = setTimeout(() => stop(`${file}: timeout`), options.timeout ?? 120000);
    const abort = () => stop('Cancelled'); options.signal?.addEventListener('abort', abort, { once: true });
    const finish = () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
    const collect = (chunk: Buffer) => { const text = chunk.toString(); output = (output + text).slice(-64000); options.log?.(text); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', error => { finish(); reject(error); });
    child.on('close', code => { finish(); if (failure) reject(failure); else if (code !== 0) reject(new Error(`${file} exit ${code}: ${output.slice(-2000)}`)); else resolve(output.trim()); });
    child.stdin.on('error', () => undefined); child.stdin.end(options.input);
  });
}
export function scrub(text: string, secrets: string[] = []): string {
  let safe = text;
  for (const secret of [...secrets, ...Object.entries(process.env).filter(([key]) => /password|token|secret|api.?key/i.test(key)).map(([, value]) => value ?? '')].filter(value => value.length > 2).sort((a, b) => b.length - a.length)) safe = safe.replaceAll(secret, '[REDACTED]');
  return safe.replace(/((?:password|token|secret|authorization|api[_-]?key)\s*[:=]\s*)[^\s&,]+/gi, '$1[REDACTED]');
}
