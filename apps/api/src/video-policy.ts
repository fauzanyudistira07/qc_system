import { spawn } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export const VIDEO_POLICY = {
  fps: 30,
  width: 1280,
  height: 720,
  crf: 23,
  codec: 'libvpx-vp9'
} as const;

export const VIDEO_RECORDING = {
  viewport: { width: VIDEO_POLICY.width, height: VIDEO_POLICY.height },
  recordVideo: { size: { width: VIDEO_POLICY.width, height: VIDEO_POLICY.height } }
} as const;

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    process.once('error', reject);
    process.once('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code ?? 'unknown'}`)));
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
      '-cpu-used', '5',
      '-an',
      tempPath
    ]);
    await rename(tempPath, targetPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}
