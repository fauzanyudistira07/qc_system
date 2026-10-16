import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

export interface NextcloudConfig {
  url: string;
  username: string;
  password: string;
  baseFolder: string;
}

export interface MediaUploadItem {
  url: string;
  featureName: string;
  type: 'photo' | 'video';
  fileName?: string;
  title?: string;
}

export interface CheckFolderResult {
  exists: boolean;
  projectName: string;
  targetFolder: string;
  fullPath: string;
  suggestedNewFolder: string;
  webUrl: string;
}

export interface UploadBatchResult {
  success: boolean;
  uploadedCount: number;
  failedCount: number;
  targetFolder: string;
  fullPath: string;
  webUrl: string;
  files: Array<{
    name: string;
    feature: string;
    type: 'photo' | 'video';
    remotePath: string;
    status: 'uploaded' | 'failed';
    error?: string;
  }>;
}

export function getNextcloudConfig(): NextcloudConfig {
  return {
    url: (process.env.NEXTCLOUD_URL || 'https://158.140.181.43:8443').replace(/\/+$/, ''),
    username: process.env.NEXTCLOUD_USERNAME || 'fauzan_cmms',
    password: process.env.NEXTCLOUD_PASSWORD || 'IRR251hf25uo',
    baseFolder: (process.env.NEXTCLOUD_BASE_DIR || 'CMM Service/Timbang Image and Video').replace(/^\/+|\/+$/g, '')
  };
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function sanitizePathComponent(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}

function buildWebDavPath(config: NextcloudConfig, subpath: string): string {
  const cleanSub = subpath.replace(/^\/+|\/+$/g, '');
  const segments = cleanSub ? cleanSub.split('/').map(encodeURIComponent).join('/') : '';
  return `/remote.php/dav/files/${encodeURIComponent(config.username)}/${segments}${cleanSub ? '/' : ''}`;
}

function buildWebDavUrl(config: NextcloudConfig, subpath: string, isFile = false): string {
  const cleanSub = subpath.replace(/^\/+|\/+$/g, '');
  const segments = cleanSub ? cleanSub.split('/').map(encodeURIComponent).join('/') : '';
  const trail = isFile ? '' : '/';
  return `${config.url}/remote.php/dav/files/${encodeURIComponent(config.username)}/${segments}${trail}`;
}

export function getNextcloudWebUrl(config: NextcloudConfig, folderPath: string): string {
  const fullFolder = folderPath ? `/${folderPath.replace(/^\/+|\/+$/g, '')}` : '';
  return `${config.url}/apps/files/?dir=${encodeURIComponent(fullFolder)}`;
}

function webdavRequest(
  method: string,
  urlStr: string,
  config: NextcloudConfig,
  body?: Buffer,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const reqHeaders: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      ...headers
    };
    if (body) {
      reqHeaders['Content-Length'] = String(body.length);
    }

    const req = https.request(parsed, {
      method,
      agent: httpsAgent,
      headers: reqHeaders
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Memeriksa apakah sebuah folder sudah ada di dalam base directory Nextcloud
 */
export async function checkNextcloudFolder(projectName: string): Promise<CheckFolderResult> {
  const config = getNextcloudConfig();
  const cleanProject = sanitizePathComponent(projectName);
  const targetSubpath = `${config.baseFolder}/${cleanProject}`;
  const url = buildWebDavUrl(config, targetSubpath, false);

  let exists = false;
  try {
    const res = await webdavRequest('PROPFIND', url, config, undefined, { 'Depth': '0' });
    exists = res.status === 200 || res.status === 207;
  } catch (err) {
    exists = false;
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const suggestedNewFolder = `${cleanProject} (${dateStr} ${timeStr})`;

  return {
    exists,
    projectName: cleanProject,
    targetFolder: cleanProject,
    fullPath: targetSubpath,
    suggestedNewFolder,
    webUrl: getNextcloudWebUrl(config, targetSubpath)
  };
}

/**
 * Memastikan struktur folder hierarki bertingkat telah dibuat dengan MKCOL
 */
export async function ensureNextcloudDirectory(config: NextcloudConfig, fullRelativePath: string): Promise<void> {
  const parts = fullRelativePath.replace(/^\/+|\/+$/g, '').split('/');
  let current = '';

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const url = buildWebDavUrl(config, current, false);
    try {
      const checkRes = await webdavRequest('PROPFIND', url, config, undefined, { 'Depth': '0' });
      if (checkRes.status === 200 || checkRes.status === 207) {
        continue;
      }
      // Jika belum ada, buat dengan MKCOL
      const mkRes = await webdavRequest('MKCOL', url, config);
      if (mkRes.status !== 201 && mkRes.status !== 405) {
        console.warn(`[Nextcloud WebDAV] MKCOL untuk "${current}" menghasilkan status ${mkRes.status}`);
      }
    } catch (err) {
      console.warn(`[Nextcloud WebDAV] Gagal memastikan folder "${current}":`, err);
    }
  }
}

/**
 * Mencari dan membaca buffer artifact di disk
 */
export async function resolveArtifactBuffer(
  itemUrl: string,
  artifactRoot: string,
  jobId?: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const candidates: string[] = [];

  if (path.isAbsolute(itemUrl) && fs.existsSync(itemUrl)) {
    candidates.push(itemUrl);
  }

  // /api/v1/discovery/jobs/:id/artifacts/:rel
  const jobArtifactMatch = itemUrl.match(/\/api\/v1\/discovery\/jobs\/([^/]+)\/artifacts\/(.+)/);
  if (jobArtifactMatch) {
    const jId = jobArtifactMatch[1];
    const rel = decodeURIComponent(jobArtifactMatch[2]).replace(/\?.*$/, '');
    candidates.push(path.join(artifactRoot, 'jobs', jId, rel));
    candidates.push(path.join(artifactRoot, rel));
  }

  // /api/v1/zannora-evidence/artifacts/:rel
  const zannoraMatch = itemUrl.match(/\/api\/v1\/zannora-evidence\/artifacts\/(.+)/);
  if (zannoraMatch) {
    const rel = decodeURIComponent(zannoraMatch[1]).replace(/\?.*$/, '');
    candidates.push(path.join(artifactRoot, rel));
  }

  if (jobId) {
    const cleanUrl = itemUrl.replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/\?.*$/, '').replace(/^\/+/, '');
    const basename = path.basename(cleanUrl);
    candidates.push(path.join(artifactRoot, 'jobs', jobId, cleanUrl));
    candidates.push(path.join(artifactRoot, 'jobs', jobId, basename));
  }

  const clean = itemUrl.replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/\?.*$/, '').replace(/^\/+/, '');
  candidates.push(path.join(artifactRoot, clean));
  candidates.push(path.join(artifactRoot, path.basename(clean)));

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const buffer = await fs.promises.readFile(cand);
        const ext = path.extname(cand).toLowerCase();
        const mime = ext === '.png' ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.mp4' ? 'video/mp4'
          : ext === '.webm' ? 'video/webm'
          : 'application/octet-stream';
        return { buffer, mime };
      }
    } catch {}
  }

  // Fallback: jika berupa URL HTTP aktif
  if (itemUrl.startsWith('http://') || itemUrl.startsWith('https://')) {
    try {
      const res = await fetch(itemUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const mime = res.headers.get('content-type') || 'application/octet-stream';
        return { buffer, mime };
      }
    } catch {}
  }

  return null;
}

/**
 * Mengunggah satu file ke Nextcloud melalui WebDAV PUT
 */
export async function uploadFileToNextcloud(
  config: NextcloudConfig,
  remoteSubpath: string,
  buffer: Buffer,
  mime: string
): Promise<{ success: boolean; error?: string }> {
  const url = buildWebDavUrl(config, remoteSubpath, true);
  try {
    const res = await webdavRequest('PUT', url, config, buffer, {
      'Content-Type': mime
    });
    if (res.status === 201 || res.status === 204 || res.status === 200) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Mengunggah sekumpulan media (foto dan video) dengan struktur folder:
 * [Base Folder] / [Project Folder] / [Feature Subfolder] / [foto|video] / [filename]
 */
export async function uploadMediaBatch(
  folderName: string,
  items: MediaUploadItem[],
  artifactRoot: string,
  jobId?: string
): Promise<UploadBatchResult> {
  const config = getNextcloudConfig();
  const cleanFolder = sanitizePathComponent(folderName);
  const projectBasePath = `${config.baseFolder}/${cleanFolder}`;

  const results: UploadBatchResult['files'] = [];
  let uploadedCount = 0;
  let failedCount = 0;

  // Pastikan folder proyek utama sudah ada
  await ensureNextcloudDirectory(config, projectBasePath);

  const ensuredDirs = new Set<string>();
  ensuredDirs.add(projectBasePath);

  for (const item of items) {
    const featureClean = sanitizePathComponent(item.featureName || 'General');
    const typeFolder = item.type === 'video' ? 'video' : 'foto';
    const targetDir = `${projectBasePath}/${featureClean}/${typeFolder}`;

    // Pastikan subfolder fitur + type sudah dibuat
    if (!ensuredDirs.has(targetDir)) {
      await ensureNextcloudDirectory(config, targetDir);
      ensuredDirs.add(targetDir);
    }

    // Resolusi nama file
    let fileName = sanitizePathComponent(item.fileName || path.basename(item.url.replace(/\?.*$/, '')));
    if (!fileName.includes('.')) {
      fileName += item.type === 'video' ? '.mp4' : '.png';
    }

    const remoteFilePath = `${targetDir}/${fileName}`;

    // Baca data file
    const resolved = await resolveArtifactBuffer(item.url, artifactRoot, jobId);
    if (!resolved) {
      failedCount++;
      results.push({
        name: fileName,
        feature: featureClean,
        type: item.type,
        remotePath: remoteFilePath,
        status: 'failed',
        error: 'File artifact tidak ditemukan di server lokal'
      });
      continue;
    }

    // Upload via WebDAV PUT
    const uploadRes = await uploadFileToNextcloud(config, remoteFilePath, resolved.buffer, resolved.mime);
    if (uploadRes.success) {
      uploadedCount++;
      results.push({
        name: fileName,
        feature: featureClean,
        type: item.type,
        remotePath: remoteFilePath,
        status: 'uploaded'
      });
    } else {
      failedCount++;
      results.push({
        name: fileName,
        feature: featureClean,
        type: item.type,
        remotePath: remoteFilePath,
        status: 'failed',
        error: uploadRes.error
      });
    }
  }

  return {
    success: uploadedCount > 0 && failedCount === 0,
    uploadedCount,
    failedCount,
    targetFolder: cleanFolder,
    fullPath: projectBasePath,
    webUrl: getNextcloudWebUrl(config, projectBasePath),
    files: results
  };
}
