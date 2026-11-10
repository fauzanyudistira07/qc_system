import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ffmpegStaticPath from 'ffmpeg-static';

export const VIDEO_POLICY = {
  fps: 30,
  width: 1280,
  height: 720,
  crf: 23,
  codec: 'libvpx-vp9',
  minBytes: 8192
} as const;

export const VIDEO_RECORDING = {
  viewport: { width: VIDEO_POLICY.width, height: VIDEO_POLICY.height },
  recordVideo: { size: { width: VIDEO_POLICY.width, height: VIDEO_POLICY.height } }
} as const;

export function resolveFfmpegBin(): string {
  const envBin = process.env.FFMPEG_PATH?.trim();
  if (envBin && existsSync(envBin)) return envBin;
  if (typeof ffmpegStaticPath === 'string' && ffmpegStaticPath && existsSync(ffmpegStaticPath)) {
    return ffmpegStaticPath;
  }
  return 'ffmpeg';
}

export function runFfmpeg(args: string[], timeoutMs = 120_000): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const ffmpegBin = resolveFfmpegBin();
    const proc = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-8192);
    });
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
      reject(new Error(`ffmpeg timeout after ${timeoutMs}ms: ${stderr.slice(-400)}`));
    }, timeoutMs);
    proc.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stderr });
      else reject(new Error(`ffmpeg exited with code ${code ?? 'unknown'}: ${stderr.slice(-400)}`));
    });
  });
}

/**
 * Playwright captures WebM at Chromium's native cadence. Normalize every retained
 * video at the artifact boundary so stored videos follow the project policy.
 */
export async function normalizeVideo(sourcePath: string, targetPath: string) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp.webm`;
  await rm(tempPath, { force: true }).catch(() => undefined);
  try {
    await runFfmpeg([
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', sourcePath,
      '-vf', `fps=${VIDEO_POLICY.fps},scale=${VIDEO_POLICY.width}:${VIDEO_POLICY.height}:flags=lanczos`,
      '-c:v', VIDEO_POLICY.codec,
      '-crf', String(VIDEO_POLICY.crf),
      '-b:v', '0',
      '-deadline', 'good',
      '-cpu-used', '6',
      '-an',
      tempPath
    ]);
    await rename(tempPath, targetPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function concatVideos(inputPaths: string[], targetPath: string, faststartMp4 = true): Promise<string> {
  const validInputs = inputPaths.filter((p) => existsSync(p));
  if (validInputs.length === 0) {
    throw new Error('Tidak ada segmen video valid untuk digabungkan.');
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  const ext = faststartMp4 ? '.mp4' : path.extname(targetPath) || '.webm';
  const tempOut = `${targetPath}.tmp${ext}`;
  const concatListPath = `${targetPath}.concat.txt`;
  await rm(tempOut, { force: true }).catch(() => undefined);
  await rm(concatListPath, { force: true }).catch(() => undefined);

  try {
    if (validInputs.length === 1) {
      await runFfmpeg([
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-i', validInputs[0],
        '-c', 'copy',
        ...(faststartMp4 ? ['-movflags', '+faststart'] : []),
        tempOut,
      ]);
    } else {
      const listBody = validInputs.map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`).join('\n');
      await writeFile(concatListPath, `${listBody}\n`, 'utf8');
      await runFfmpeg([
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        ...(faststartMp4 ? ['-movflags', '+faststart'] : []),
        tempOut,
      ]);
    }
    await rename(tempOut, targetPath);
    return targetPath;
  } finally {
    await rm(tempOut, { force: true }).catch(() => undefined);
    await rm(concatListPath, { force: true }).catch(() => undefined);
  }
}

export async function assertValidVideo(filePath: string, minBytes = 8192): Promise<{ sizeBytes: number }> {
  const info = await stat(filePath).catch(() => null);
  if (!info || !info.isFile()) {
    throw new Error(`File video tidak ditemukan: ${filePath}`);
  }
  if (info.size < minBytes) {
    throw new Error(`File video rusak atau terlalu kecil (${info.size} bytes < ${minBytes} bytes): ${filePath}`);
  }
  return { sizeBytes: info.size };
}
