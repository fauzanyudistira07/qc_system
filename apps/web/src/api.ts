export const jobPath = (id: string) => `/api/v1/discovery/jobs/${encodeURIComponent(id)}`;

export function getAuthToken(): string | null {
  return localStorage.getItem('qc_admin_token');
}

export function getAdminUser(): { email: string; name: string; role: string } | null {
  try {
    const raw = localStorage.getItem('qc_admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: { email: string; name: string; role: string }) {
  localStorage.setItem('qc_admin_token', token);
  localStorage.setItem('qc_admin_user', JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem('qc_admin_token');
  localStorage.removeItem('qc_admin_user');
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...init?.headers }
  });

  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/config')) {
    clearAuthSession();
    window.dispatchEvent(new CustomEvent('qc:unauthorized'));
  }

  const raw = await response.text();
  let body: unknown;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { throw new Error(`API mengembalikan respons bukan JSON (${response.status}). Periksa server API dan proxy.`); }
  if (!response.ok) {
    const error = body as { error?: unknown; message?: string; validation?: { errors?: { path: string; message: string }[] } } | undefined;
    const details = error?.validation?.errors?.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(details || error?.message || (typeof error?.error === 'string' ? error.error : `Request gagal (${response.status})`));
  }
  return body as T;
}

export const send = <T,>(path: string, body: unknown = {}, method = 'POST') => request<T>(path, { method, body: JSON.stringify(body) });
export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
export const active = (status: string) => !['COMPLETED', 'COMPLETE', 'PASSED', 'FAILED', 'CANCELLED', 'CANCELED', 'INFRA_ERROR', 'ERROR', 'READY', 'PARTIAL'].includes(status.toUpperCase());

export function artifactUrl(id: string, path?: string | null): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const prefix = `${jobPath(id)}/artifacts/`;
  const token = getAuthToken();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/api/')) return `${path}${path.includes('?') ? '' : tokenQuery}`;
  if (path.startsWith(prefix)) return `${path}${path.includes('?') ? '' : tokenQuery}`;

  const normalized = path.replace(/\\/g, '/');
  const jobMarker = `/jobs/${id}/`;
  const markerIdx = normalized.indexOf(jobMarker);
  let cleanRel = '';
  if (markerIdx !== -1) {
    cleanRel = normalized.slice(markerIdx + jobMarker.length);
  } else {
    const generalJobMatch = normalized.match(/\/jobs\/[^/]+\/(.+)$/);
    if (generalJobMatch) {
      cleanRel = generalJobMatch[1];
    } else if (normalized.includes('/run-') || normalized.startsWith('run-')) {
      const runIdx = normalized.indexOf('run-');
      cleanRel = normalized.slice(runIdx);
    } else {
      cleanRel = normalized.replace(/^[a-zA-Z]:[/\\]+/, '').replace(/^\.\//, '').replace(/^\/+/, '');
      if (cleanRel.includes('.qc-artifacts/')) {
        cleanRel = cleanRel.split('.qc-artifacts/')[1].replace(/^jobs\/[^/]+\//, '');
      }
    }
  }

  cleanRel = cleanRel.replace(/^\/+/, '');
  if (!cleanRel || cleanRel.split('/').includes('..')) return undefined;
  const encodedPath = cleanRel.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${prefix}${encodedPath}${tokenQuery}`;
}

export function download(content: string | Blob, filename: string, type = 'text/plain') {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadReport(id: string, format: string, attempt?: string, status?: string) {
  const params = new URLSearchParams({ format });
  if (attempt) params.set('attempt', attempt);
  if (status) params.set('status', status);
  const token = getAuthToken();
  if (token) params.set('token', token);
  const response = await fetch(`${jobPath(id)}/report?${params.toString()}`);
  if (!response.ok) { const text = await response.text(); let message = text; try { const body = JSON.parse(text); message = body.message || body.error || text; } catch { /* preserve response */ } throw new Error(message || `Export gagal (${response.status})`); }
  download(await response.blob(), `qc-report-${id.slice(0, 8)}.${format}`);
}

export const date = (value?: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  try {
    const formatted = new Date(value).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return `${formatted} WIB`;
  } catch {
    return value;
  }
};

export const duration = (start: string, end?: string) => { const s = Math.max(0, Math.round(((end ? Date.parse(end) : Date.now()) - Date.parse(start)) / 1000)); return Number.isFinite(s) ? s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s` : '—'; };

export interface NextcloudConfigInfo {
  configured: boolean;
  url: string;
  username: string;
  baseFolder: string;
}

export interface NextcloudFolderCheck {
  exists: boolean;
  projectName: string;
  targetFolder: string;
  fullPath: string;
  suggestedNewFolder: string;
  webUrl: string;
  existingFolders?: string[];
}

export interface NextcloudUploadPayload {
  folderName: string;
  items: Array<{
    url: string;
    featureName: string;
    type: 'photo' | 'video';
    fileName?: string;
    title?: string;
  }>;
  jobId?: string;
}

export interface NextcloudUploadResponse {
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

export async function getNextcloudConfig(): Promise<NextcloudConfigInfo> {
  return request<NextcloudConfigInfo>('/api/v1/nextcloud/config');
}

export async function checkNextcloudFolder(projectName: string): Promise<NextcloudFolderCheck> {
  return send<NextcloudFolderCheck>('/api/v1/nextcloud/check-folder', { projectName });
}

export async function uploadToNextcloud(payload: NextcloudUploadPayload): Promise<NextcloudUploadResponse> {
  return send<NextcloudUploadResponse>('/api/v1/nextcloud/upload-media', payload);
}

export async function downloadMediaZip(payload: {
  projectName: string;
  items: Array<{
    url: string;
    featureName: string;
    type: 'photo' | 'video';
    title?: string;
    fileName?: string;
    viewport?: string;
  }>;
  jobId?: string;
}): Promise<void> {
  const token = getAuthToken();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch('/api/v1/media/download-zip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || text;
    } catch {}
    throw new Error(message || `Gagal mengunduh ZIP (${res.status})`);
  }

  const blob = await res.blob();
  const cleanName = payload.projectName.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'qc-media';
  download(blob, `${cleanName}-media.zip`, 'application/zip');
}

export interface GenerationStatus {
  enabled: boolean;
  provider: 'gemini' | 'solu-ai';
  model: string;
  keyMasked?: string;
  status: 'configured' | 'waiting-for-key';
}

export async function getGenerationStatus(): Promise<GenerationStatus> {
  const token = getAuthToken();
  const res = await fetch('/api/v1/generation/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Gagal memeriksa status AI generation');
  return res.json();
}

export async function testGeminiConnection(): Promise<{
  success: boolean;
  model: string;
  message: string;
  latencyMs: number;
}> {
  const token = getAuthToken();
  const res = await fetch('/api/v1/ai/test-connection', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return res.json();
}

export async function generateFlowWithAi(payload: {
  prompt: string;
  platform: 'web' | 'android';
  baseUrl?: string;
  appId?: string;
}): Promise<{
  id: string;
  status: string;
  provider: string;
  flow?: {
    name: string;
    platform: 'web' | 'android';
    yaml: string;
    explanation: string;
    valid: boolean;
    validationErrors?: string[];
  };
}> {
  const token = getAuthToken();
  const res = await fetch('/api/v1/generation/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Gagal menghasilkan flow (${res.status})`);
  }
  return data;
}

export async function diagnoseFailureWithAi(payload: {
  flowName: string;
  stepName?: string;
  error: string;
  logs?: string[];
  pageUrl?: string;
}): Promise<{
  rootCause: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionableSteps: string[];
}> {
  const token = getAuthToken();
  const res = await fetch('/api/v1/ai/diagnose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Gagal menganalisis kegagalan (${res.status})`);
  }
  return data;
}


