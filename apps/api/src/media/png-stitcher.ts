import { copyFile, mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { runFfmpeg } from '../video-policy.ts';

export type PngDimensions = { width: number; height: number; colorType: number; bitDepth: number };

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function parsePngDimensions(buf: Buffer): PngDimensions {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error('Buffer bukan file PNG yang valid.');
  }
  const chunkType = buf.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    throw new Error(`Header PNG tidak diawali IHDR (${chunkType}).`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf.readUInt8(24),
    colorType: buf.readUInt8(25),
  };
}

export async function readPngDimensions(filePath: string): Promise<PngDimensions> {
  const buf = await readFile(filePath);
  return parsePngDimensions(buf);
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePngPixels(buf: Buffer): { width: number; height: number; bpp: number; pixels: Uint8Array } {
  const meta = parsePngDimensions(buf);
  if (meta.bitDepth !== 8 || (meta.colorType !== 2 && meta.colorType !== 6)) {
    throw new Error(`Unsupported PNG format (colorType=${meta.colorType}, bitDepth=${meta.bitDepth})`);
  }
  const bpp = meta.colorType === 6 ? 4 : 3;
  const idatChunks: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IDAT') {
      idatChunks.push(buf.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = meta.width * bpp;
  const pixels = new Uint8Array(meta.height * stride);
  let inIdx = 0;

  for (let y = 0; y < meta.height; y++) {
    const filter = raw[inIdx++];
    const rowStart = y * stride;
    const prevRowStart = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const val = raw[inIdx++];
      const a = x >= bpp ? pixels[rowStart + x - bpp] : 0;
      const b = y > 0 ? pixels[prevRowStart + x] : 0;
      const c = y > 0 && x >= bpp ? pixels[prevRowStart + x - bpp] : 0;
      let decoded = val;
      if (filter === 1) decoded = (val + a) & 0xff;
      else if (filter === 2) decoded = (val + b) & 0xff;
      else if (filter === 3) decoded = (val + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) decoded = (val + paethPredictor(a, b, c)) & 0xff;
      pixels[rowStart + x] = decoded;
    }
  }

  return { width: meta.width, height: meta.height, bpp, pixels };
}

function rowSignature(
  pixels: Uint8Array,
  width: number,
  bpp: number,
  y: number
): number[] {
  // Downsample 16 evenly spaced pixel samples across the row (avoiding edge borders)
  const samples = 16;
  const out: number[] = [];
  const startByte = y * width * bpp;
  for (let i = 0; i < samples; i++) {
    const col = Math.floor(((i + 1) / (samples + 1)) * width);
    const idx = startByte + col * bpp;
    out.push(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
  }
  return out;
}

function rowsRoughlyEqual(a: number[], b: number[], tolerance = 6): boolean {
  let diffSum = 0;
  for (let i = 0; i < a.length; i++) {
    diffSum += Math.abs(a[i] - b[i]);
  }
  return diffSum / a.length <= tolerance;
}

/**
 * Computes exact vertical cropTop for `nextPng` so continuous scrolling on mobile/web
 * stitches cleanly without repeating fixed headers/bottom nav bars or overlapping rows.
 */
export function computeScrollSliceCropTop(
  prevBuf: Buffer,
  nextBuf: Buffer,
  options?: { topChromeRatio?: number; bottomChromeRatio?: number }
): { cropTop: number; prevCropBottom: number; identical: boolean } {
  try {
    const prev = decodePngPixels(prevBuf);
    const next = decodePngPixels(nextBuf);
    if (prev.width !== next.width || prev.height !== next.height || prev.bpp !== next.bpp) {
      return { cropTop: 0, prevCropBottom: 0, identical: false };
    }

    const h = prev.height;
    const topChrome = Math.round(h * (options?.topChromeRatio ?? 0.09));
    const bottomChrome = Math.round(h * (options?.bottomChromeRatio ?? 0.08));
    const usableStart = topChrome;
    const usableEnd = h - bottomChrome;

    // Detect completely identical mid-viewport (meaning reached bottom / cannot scroll further)
    let sameMid = 0;
    const checkLines = 12;
    for (let i = 0; i < checkLines; i++) {
      const y = Math.round(usableStart + ((i + 1) / (checkLines + 1)) * (usableEnd - usableStart));
      if (rowsRoughlyEqual(rowSignature(prev.pixels, prev.width, prev.bpp, y), rowSignature(next.pixels, next.width, next.bpp, y), 4)) {
        sameMid++;
      }
    }
    if (sameMid === checkLines) {
      return { cropTop: 0, prevCropBottom: 0, identical: true };
    }

    // Take a 24px content band just below topChrome in `next`, and search upward in `prev`
    const bandHeight = 20;
    const nextProbeY = usableStart + 12;
    const nextBands = Array.from({ length: bandHeight }, (_, dy) =>
      rowSignature(next.pixels, next.width, next.bpp, nextProbeY + dy)
    );

    for (let y = usableEnd - bandHeight - 20; y >= usableStart + 40; y -= 2) {
      let matched = true;
      for (let dy = 0; dy < bandHeight; dy += 4) {
        const prevSig = rowSignature(prev.pixels, prev.width, prev.bpp, y + dy);
        if (!rowsRoughlyEqual(prevSig, nextBands[dy], 7)) {
          matched = false;
          break;
        }
      }
      if (matched) {
        // The line y in prev corresponds to nextProbeY in next!
        // Trim overlapping portion from prev bottom and crop chrome header from next top
        const overlapFromPrev = Math.max(0, h - y);
        const prevCropBottom = Math.max(bottomChrome, Math.min(h - topChrome - 40, overlapFromPrev));
        const cropTop = Math.max(topChrome, nextProbeY);
        return { cropTop, prevCropBottom, identical: false };
      }
    }

    // Fallback when exact band match fails (e.g. parallax/gradient cards): keep top chrome stripped only
    return { cropTop: topChrome, prevCropBottom: bottomChrome, identical: false };
  } catch {
    return { cropTop: 0, prevCropBottom: 0, identical: false };
  }
}

export type PngSegmentInput = {
  path: string;
  cropTop?: number;
  cropBottom?: number;
};

export async function stitchPngSegmentsVertically(
  segments: PngSegmentInput[],
  outputPath: string
): Promise<{ width: number; height: number; segmentCount: number }> {
  if (segments.length === 0) {
    throw new Error('Tidak ada segmen PNG untuk digabungkan.');
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp.png`;
  await rm(tempPath, { force: true }).catch(() => undefined);

  if (segments.length === 1 && !segments[0].cropTop && !segments[0].cropBottom) {
    await copyFile(segments[0].path, tempPath);
    await rename(tempPath, outputPath);
    const dims = await readPngDimensions(outputPath);
    return { width: dims.width, height: dims.height, segmentCount: 1 };
  }

  const args: string[] = ['-hide_banner', '-loglevel', 'error', '-y'];
  const filterParts: string[] = [];
  const stackInputs: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    args.push('-i', seg.path);
    const dims = await readPngDimensions(seg.path);
    const top = Math.max(0, Math.min(dims.height - 8, Math.round(seg.cropTop ?? 0)));
    const bottom = Math.max(0, Math.min(dims.height - top - 8, Math.round(seg.cropBottom ?? 0)));
    const keepH = Math.max(8, dims.height - top - bottom);
    const label = `v${i}`;
    filterParts.push(`[${i}:v]crop=${dims.width}:${keepH}:0:${top}[${label}]`);
    stackInputs.push(`[${label}]`);
  }

  if (segments.length === 1) {
    const filter = filterParts[0].replace('[v0]', '');
    args.push('-vf', filter, tempPath);
  } else {
    const complex = `${filterParts.join(';')};${stackInputs.join('')}vstack=inputs=${segments.length}[out]`;
    args.push('-filter_complex', complex, '-map', '[out]', '-frames:v', '1', tempPath);
  }

  try {
    await runFfmpeg(args, 90_000);
    await rename(tempPath, outputPath);
    const finalDims = await readPngDimensions(outputPath);
    return { width: finalDims.width, height: finalDims.height, segmentCount: segments.length };
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}
