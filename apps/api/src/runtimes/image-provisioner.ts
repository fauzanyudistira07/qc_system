import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function runCommand(cmd: string, args: string[], onOutput?: (msg: string) => void): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: false, windowsHide: true });
    
    child.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line && onOutput) onOutput(line);
    });

    child.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line && onOutput) onOutput(line);
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}

/**
 * Cek apakah image sudah tersimpan di library Docker lokal laptop server
 */
export async function isImageAvailable(imageName: string): Promise<boolean> {
  const code = await runCommand('docker', ['image', 'inspect', imageName]);
  return code === 0;
}

/**
 * Generate Dockerfile khusus untuk PHP + Composer + PDO MySQL + Common Extensions
 */
function generatePhpDockerfile(version: string): string {
  // Versi PHP yang didukung: 8.0, 8.1, 8.2, 8.3
  return `FROM php:${version}-cli-alpine
RUN apk add --no-cache git curl unzip bash libzip-dev libpng-dev oniguruma-dev linux-headers \\
    && docker-php-ext-install pdo_mysql bcmath zip gd mbstring \\
    && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
WORKDIR /workspace
`;
}

/**
 * Menyiapkan runtime library secara otomatis:
 * - Cek apakah sudah ada di library server (Cache Hit).
 * - Jika belum ada (Cache Miss), download / bangun otomatis dan simpan ke library.
 */
export async function ensureRuntimeImage(
  imageName: string,
  onOutput?: (msg: string) => void
): Promise<string> {
  // 1. Cek Ketersediaan di Library Lokal
  const available = await isImageAvailable(imageName);
  if (available) {
    onOutput?.(`[Runtime Library] Menggunakan image yang sudah tersedia: ${imageName} (Cache Hit)`);
    return imageName;
  }

  onOutput?.(`[Runtime Library] Image ${imageName} belum ada di server. Menyiapkan library otomatis...`);

  // 2. Jika target adalah custom PHP runtime (qc-runtime:php-X.X)
  const phpMatch = imageName.match(/^qc-runtime:php-(8\.[0-3])$/);
  if (phpMatch) {
    const phpVersion = phpMatch[1];
    const buildContextDir = path.join(tmpdir(), `qc-build-php-${phpVersion}-${Date.now()}`);

    try {
      await mkdir(buildContextDir, { recursive: true });
      const dockerfileContent = generatePhpDockerfile(phpVersion);
      await writeFile(path.join(buildContextDir, 'Dockerfile'), dockerfileContent, 'utf8');

      onOutput?.(`[Runtime Library] Membangun image ${imageName} (PHP ${phpVersion} + Composer + PDO MySQL)...`);
      const buildCode = await runCommand('docker', ['build', '-t', imageName, buildContextDir], (msg) => {
        onOutput?.(`[Docker Build] ${msg}`);
      });

      if (buildCode === 0) {
        onOutput?.(`[Runtime Library] Sukses! Image ${imageName} tersimpan permanen di library server.`);
        return imageName;
      }

      onOutput?.(`[Runtime Library] Build Dockerfile gagal; mencoba fallback image resmi...`);
    } catch (err) {
      onOutput?.(`[Runtime Library] Error build context: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await rm(buildContextDir, { recursive: true, force: true }).catch(() => {});
    }

    // Fallback jika build gagal: pull php cli resmi
    const fallbackImage = `php:${phpVersion}-cli`;
    onOutput?.(`[Runtime Library] Mengunduh image fallback: ${fallbackImage}...`);
    await runCommand('docker', ['pull', fallbackImage], onOutput);
    return fallbackImage;
  }

  // 3. Image Standar (Node, Python, Go, dll.) -> Langsung Docker Pull
  onOutput?.(`[Runtime Library] Mengunduh ${imageName} dari registry...`);
  const pullCode = await runCommand('docker', ['pull', imageName], (msg) => {
    onOutput?.(`[Docker Pull] ${msg}`);
  });

  if (pullCode === 0) {
    onOutput?.(`[Runtime Library] Image ${imageName} berhasil diunduh dan tersimpan di server.`);
    return imageName;
  }

  // Jika pull gagal (misal koneksi lambat/offline), coba inspect fallback
  onOutput?.(`[Runtime Library] Peringatan: Tidak dapat mengunduh ${imageName}, menggunakan runtime yang tersedia.`);
  return imageName;
}
