import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export type DetectedRuntime = {
  ecosystem: 'laravel' | 'php' | 'node' | 'python' | 'go' | 'custom';
  frameworkName?: string;
  frameworkVersion?: string;
  runtimeVersion: string;
  recommendedImage: string;
  installCommand: string;
  startCommandTemplate: (port: number) => string;
  cacheVolumes: string[];
};

async function fileExists(filePath: string): Promise<boolean> {
  return Boolean(await stat(filePath).catch(() => undefined));
}

async function readJsonSafe(filePath: string): Promise<any> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Deteksi versi PHP optimal berdasarkan require composer.json
 */
function resolvePhpVersionForLaravel(laravelReq: string, phpReq: string): string {
  // Parsing versi Laravel (e.g. "^8.0", "~9.2", "10.*", "^11.0")
  const laravelMajor = laravelReq.match(/\b(8|9|10|11|12)\b/)?.[1];
  
  if (laravelMajor === '8') return '8.0';
  if (laravelMajor === '9') return '8.1';
  if (laravelMajor === '10') return '8.2';
  if (laravelMajor === '11') return '8.3';
  if (laravelMajor === '12') return '8.3';

  // Jika bukan major di atas, cek spesifikasi requirement PHP langsung
  if (phpReq.includes('8.3')) return '8.3';
  if (phpReq.includes('8.2')) return '8.2';
  if (phpReq.includes('8.1')) return '8.1';
  if (phpReq.includes('8.0')) return '8.0';
  if (phpReq.includes('7.4')) return '8.0'; // Laravel 8 compatibility default

  return '8.2'; // Safe modern default
}

/**
 * Deteksi versi Node optimal berdasarkan package.json & .nvmrc
 */
function resolveNodeVersion(enginesNode?: string, nvmrc?: string): string {
  const source = nvmrc || enginesNode || '';
  if (source.includes('18')) return '18';
  if (source.includes('20')) return '20';
  if (source.includes('22')) return '22';
  if (source.includes('16')) return '18'; // Upgrade safe to 18
  return '22'; // Modern LTS default
}

/**
 * Mendeteksi runtime dan spesifikasi dependensi proyek secara otomatis
 */
export async function detectProjectRuntime(sourceDir: string): Promise<DetectedRuntime> {
  // 1. Cek Kompatibilitas PHP / Laravel (composer.json)
  const composerPath = path.join(sourceDir, 'composer.json');
  if (await fileExists(composerPath)) {
    const composer = await readJsonSafe(composerPath);
    const requireDeps = { ...composer?.require, ...composer?.['require-dev'] };

    const laravelReq = requireDeps['laravel/framework'] || requireDeps['illuminate/support'];
    const phpReq = requireDeps['php'] || '';

    if (laravelReq) {
      const phpVersion = resolvePhpVersionForLaravel(String(laravelReq), String(phpReq));
      const laravelVersion = String(laravelReq).replace(/[^0-9.]/g, '') || 'Auto';

      return {
        ecosystem: 'laravel',
        frameworkName: 'Laravel',
        frameworkVersion: laravelVersion,
        runtimeVersion: phpVersion,
        recommendedImage: `qc-runtime:php-${phpVersion}`,
        installCommand: 'composer install --no-interaction --prefer-dist --ignore-platform-reqs',
        startCommandTemplate: (port) => `php artisan serve --host=0.0.0.0 --port=${port}`,
        cacheVolumes: ['qc-composer-cache:/tmp/composer/cache']
      };
    }

    // Generic PHP
    const phpVersion = phpReq.includes('8.1') ? '8.1' : (phpReq.includes('8.0') ? '8.0' : '8.2');
    return {
      ecosystem: 'php',
      frameworkName: 'PHP Generic',
      runtimeVersion: phpVersion,
      recommendedImage: `qc-runtime:php-${phpVersion}`,
      installCommand: 'composer install --no-interaction --prefer-dist --ignore-platform-reqs',
      startCommandTemplate: (port) => `php -S 0.0.0.0:${port}`,
      cacheVolumes: ['qc-composer-cache:/tmp/composer/cache']
    };
  }

  // 2. Cek Node.js (package.json)
  const packageJsonPath = path.join(sourceDir, 'package.json');
  if (await fileExists(packageJsonPath)) {
    const pkg = await readJsonSafe(packageJsonPath);
    const nvmrcPath = path.join(sourceDir, '.nvmrc');
    const nvmrc = (await fileExists(nvmrcPath)) ? (await readFile(nvmrcPath, 'utf8')).trim() : undefined;

    const nodeVersion = resolveNodeVersion(pkg?.engines?.node, nvmrc);
    const hasNext = Boolean(pkg?.dependencies?.next || pkg?.devDependencies?.next);
    const hasVite = Boolean(pkg?.dependencies?.vite || pkg?.devDependencies?.vite);

    let frameworkName = 'Node.js';
    if (hasNext) frameworkName = 'Next.js';
    else if (hasVite) frameworkName = 'Vite';

    return {
      ecosystem: 'node',
      frameworkName,
      frameworkVersion: pkg?.version || '1.0.0',
      runtimeVersion: nodeVersion,
      recommendedImage: `node:${nodeVersion}-alpine`,
      installCommand: 'npm ci || npm install --legacy-peer-deps',
      startCommandTemplate: (port) => `npm run start -- -p ${port} || npm run dev -- -p ${port}`,
      cacheVolumes: ['qc-npm-cache:/tmp/npm-cache']
    };
  }

  // 3. Cek Python (requirements.txt / pyproject.toml)
  const reqTxtPath = path.join(sourceDir, 'requirements.txt');
  const pyProjectPath = path.join(sourceDir, 'pyproject.toml');
  if (await fileExists(reqTxtPath) || await fileExists(pyProjectPath)) {
    return {
      ecosystem: 'python',
      frameworkName: 'Python',
      runtimeVersion: '3.11',
      recommendedImage: 'python:3.11-slim',
      installCommand: (await fileExists(reqTxtPath)) ? 'pip install -r requirements.txt' : 'pip install .',
      startCommandTemplate: (port) => `python -m uvicorn app:app --host 0.0.0.0 --port ${port}`,
      cacheVolumes: ['qc-pip-cache:/tmp/pip-cache']
    };
  }

  // 4. Cek Go (go.mod)
  const goModPath = path.join(sourceDir, 'go.mod');
  if (await fileExists(goModPath)) {
    return {
      ecosystem: 'go',
      frameworkName: 'Go',
      runtimeVersion: '1.22',
      recommendedImage: 'golang:1.22-alpine',
      installCommand: 'go mod download',
      startCommandTemplate: (port) => `go run . -port ${port}`,
      cacheVolumes: ['qc-go-cache:/tmp/go-cache']
    };
  }

  // 5. Default Fallback
  return {
    ecosystem: 'custom',
    runtimeVersion: 'latest',
    recommendedImage: 'node:22-alpine',
    installCommand: 'true',
    startCommandTemplate: (port) => `sleep 3600`,
    cacheVolumes: []
  };
}
