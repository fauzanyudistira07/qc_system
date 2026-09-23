export const jobPath = (id: string) => `/api/v1/discovery/jobs/${encodeURIComponent(id)}`;
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
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
export function artifactUrl(id: string, path: string) {
  const prefix = `${jobPath(id)}/artifacts/`;
  if (path.startsWith(prefix)) return path;
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (/^(?:[a-z]+:|\/\/)/i.test(clean) || clean.split('/').includes('..')) return undefined;
  return `${prefix}${clean.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
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
