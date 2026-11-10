import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { DiscoveryJob } from '../discovery/types.ts';
import { groupResultsIntoAttempts, type TestAttempt } from './attempt-grouper.ts';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function withTimeout<T>(action: Promise<T>, timeoutMs = 60_000): Promise<T> {
  return Promise.race<T>([
    action,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`PDF operation timed out after ${timeoutMs}ms`)), timeoutMs)),
  ]);
}

async function closeWithTimeout(action: Promise<void> | undefined, timeoutMs = 8_000): Promise<void> {
  if (!action) return;
  await Promise.race([
    action.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function formatWIB(value?: string | number | Date): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d) + ' WIB';
  } catch {
    return String(value);
  }
}

async function fileToBase64(filePath: string): Promise<string | null> {
  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

type QualityCheck = {
  area?: string;
  name?: string;
  detail?: string;
  passed?: boolean;
  outcome?: string;
  applicable?: boolean;
  route?: string;
  browser?: string;
  viewport?: string;
  screenshots?: Array<string | { path?: string; name?: string }>;
  screenshot?: string;
};

type QualityFindingGroup = {
  route: string;
  browser: string;
  viewport: string;
  checks: QualityCheck[];
  screenshots: Array<{ name: string; base64: string }>;
};

async function readQualityReport(job: DiscoveryJob, artifactRoot: string) {
  const reportPath = job.qualityAudit?.reportPath;
  if (!reportPath) return null;
  const absoluteRoot = path.resolve(artifactRoot);
  const absoluteReport = path.resolve(absoluteRoot, reportPath.replace(/[\\/]+/g, path.sep));
  const relative = path.relative(absoluteRoot, absoluteReport);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  try {
    const report = JSON.parse(await readFile(absoluteReport, 'utf8'));
    return { report, directory: path.dirname(absoluteReport) };
  } catch {
    return null;
  }
}

async function buildQualityFindingGroups(checks: QualityCheck[], reportDirectory: string): Promise<QualityFindingGroup[]> {
  const failedChecks = checks.filter((check) => check.outcome === 'FAILED' || (check.passed === false && check.outcome !== 'NOT_APPLICABLE'));
  const screenshotRoot = path.resolve(reportDirectory, 'screenshots');
  const groups = new Map<string, QualityFindingGroup>();
  const evidenceChecks = checks.filter((check) => check.area === 'visual-evidence');
  const imageCache = new Map<string, string | null>();

  const addScreenshot = async (group: QualityFindingGroup, reference: string | { path?: string; name?: string }) => {
    const value = typeof reference === 'string' ? reference : reference.path || reference.name || '';
    if (!value) return;
    const filename = value.replace(/[?#].*$/, '').replace(/\\/g, '/').split('/').pop() || '';
    if (!/\.(png|jpe?g|webp)$/i.test(filename) || group.screenshots.some((image) => image.name === filename)) return;
    const candidates = [path.resolve(screenshotRoot, filename)];
    if (!path.isAbsolute(value)) {
      const relativeCandidate = path.resolve(reportDirectory, value);
      const relative = path.relative(reportDirectory, relativeCandidate);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) candidates.push(relativeCandidate);
    }
    for (const candidate of candidates) {
      let image = imageCache.get(candidate);
      if (image === undefined) {
        image = await fileToBase64(candidate);
        imageCache.set(candidate, image);
      }
      if (image) {
        group.screenshots.push({ name: filename, base64: image });
        return;
      }
    }
  };

  for (const check of failedChecks) {
    const route = check.route || 'Route tidak dicatat';
    const browser = check.browser || 'Browser tidak dicatat';
    const viewport = check.viewport || 'Viewport tidak dicatat';
    const key = [route, browser, viewport].join('|');
    let group = groups.get(key);
    if (!group) {
      group = { route, browser, viewport, checks: [], screenshots: [] };
      groups.set(key, group);
    }
    group.checks.push(check);

    const evidence = evidenceChecks.find((item) => item.route === check.route && item.browser === check.browser && item.viewport === check.viewport);
    const refs = [
      ...(Array.isArray(check.screenshots) ? check.screenshots : []),
      ...(check.screenshot ? [check.screenshot] : []),
      ...(evidence?.detail ? [evidence.detail] : []),
    ];
    for (const reference of refs) await addScreenshot(group, reference);
  }

  return [...groups.values()];
}

export async function buildPdfHtml(
  job: DiscoveryJob,
  artifactRoot: string,
  options?: { attempt?: string; status?: string }
): Promise<string> {
  const attempts = groupResultsIntoAttempts(job.results, job.flows);
  const latestAttempt = attempts[0];

  // Pilih sesi percobaan yang ingin ditampilkan di PDF
  let selectedAttempt: TestAttempt | undefined;
  if (options?.attempt && options.attempt !== 'latest' && options.attempt !== 'all') {
    const num = parseInt(options.attempt, 10);
    selectedAttempt = !isNaN(num)
      ? attempts.find(a => a.attemptNumber === num)
      : attempts.find(a => a.id === options.attempt);
  }
  if (!selectedAttempt) {
    selectedAttempt = latestAttempt || attempts[0];
  }

  // Filter status jika diminta (misal hanya yang berhasil)
  let rawFlowResults = selectedAttempt ? selectedAttempt.results : [];
  if (options?.status && options.status !== 'all') {
    rawFlowResults = rawFlowResults.filter(r => r.status === options.status);
  }

  const passedCount = (selectedAttempt?.results || []).filter(r => r.status === 'PASSED').length;
  const failedCount = (selectedAttempt?.results || []).filter(r => r.status !== 'PASSED').length;
  const totalCount = (selectedAttempt?.results || []).length;
  const healthScore = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : null;

  const qualityData = await readQualityReport(job, artifactRoot);
  const qualityReport = qualityData?.report;
  const qualityChecks: QualityCheck[] = Array.isArray(qualityReport?.checks) ? qualityReport.checks : [];
  const qualityFindings = qualityData ? await buildQualityFindingGroups(qualityChecks, qualityData.directory) : [];
  const checkFailureCount = qualityChecks.filter((check) => check.outcome === 'FAILED' || (check.passed === false && check.outcome !== 'NOT_APPLICABLE')).length;
  const qualityFailedCount = qualityChecks.length ? checkFailureCount : Number(qualityReport?.failed ?? job.qualityAudit?.failed ?? 0);
  const qualityPassedCount = Number(qualityReport?.passed ?? job.qualityAudit?.passed ?? 0);
  const qualityTotalCount = Number(qualityReport?.total ?? job.qualityAudit?.total ?? 0);

  const jobDir = path.resolve(artifactRoot, 'jobs', job.id);
  const resolveJobArtifactBase64 = async (rawPathOrUrl?: string): Promise<string | null> => {
    if (!rawPathOrUrl) return null;
    let rel = rawPathOrUrl.trim();
    const apiPrefix = `/api/v1/discovery/jobs/${job.id}/artifacts/`;
    if (rel.startsWith(apiPrefix)) {
      rel = rel
        .slice(apiPrefix.length)
        .split('/')
        .map((seg) => {
          try { return decodeURIComponent(seg); } catch { return seg; }
        })
        .join(path.sep);
    }
    const candidates = path.isAbsolute(rel)
      ? [rel]
      : [
          path.resolve(jobDir, rel),
          path.resolve(jobDir, 'screenshots', 'long', path.basename(rel)),
          path.resolve(jobDir, 'screenshots', path.basename(rel)),
        ];
    for (const cand of candidates) {
      const resolved = path.resolve(cand);
      if (!resolved.startsWith(jobDir)) continue;
      const b64 = await fileToBase64(resolved);
      if (b64) return b64;
    }
    return null;
  };

  const phase1LongScreenshots = await Promise.all(
    (job.longScreenshots || []).slice(0, 60).map(async (ss) => ({
      ...ss,
      base64: ss.status === 'CAPTURED' ? await resolveJobArtifactBase64(ss.path || ss.url) : null,
    }))
  );
  const phase1GapsWithMedia = await Promise.all(
    (job.coverageGaps || []).map(async (gap) => ({
      ...gap,
      errorBase64: await resolveJobArtifactBase64(gap.errorScreenshotUrl),
    }))
  );

  const hasPhase1Artifacts = Boolean(
    job.reconSummary ||
    (job.longScreenshots && job.longScreenshots.length > 0) ||
    (job.roleVideos && job.roleVideos.length > 0) ||
    (job.coverageGaps && job.coverageGaps.length > 0)
  );
  const ssTotalPhase1 = job.longScreenshots?.length ?? job.reconSummary?.batch1TotalScreenshots ?? 0;
  const ssCapturedPhase1 = job.longScreenshots?.filter((s) => s.status === 'CAPTURED').length ?? job.reconSummary?.batch1CapturedCount ?? 0;
  const vidTotalPhase1 = job.roleVideos?.length ?? job.reconSummary?.batch2TotalRoleVideos ?? 0;
  const vidRecordedPhase1 = job.roleVideos?.filter((v) => v.status === 'RECORDED').length ?? job.reconSummary?.batch2RecordedCount ?? 0;
  const gapsCountPhase1 = job.coverageGaps?.length ?? 0;

  const auditStatus = job.qualityAudit?.status || 'NOT_RUN';
  const auditLabel = job.config.qualityAudit?.enabled !== false && auditStatus !== 'NOT_RUN' && auditStatus !== 'SKIPPED'
    ? (auditStatus === 'PASSED'
        ? 'QUALITY AUDIT LULUS'
        : auditStatus === 'PASSED_WITH_LIMITATIONS'
          ? 'LULUS DENGAN BATASAN'
          : auditStatus === 'FAILED'
            ? 'ADA TEMUAN · PERLU PERBAIKAN'
            : auditStatus === 'RUNNING' || auditStatus === 'QUEUED'
              ? 'AUDIT BELUM SELESAI'
              : 'QUALITY AUDIT ERROR')
    : hasPhase1Artifacts
      ? (gapsCountPhase1 === 0 && ssCapturedPhase1 > 0 && vidRecordedPhase1 > 0
          ? 'CAKUPAN FASE 1 LENGKAP'
          : gapsCountPhase1 > 0
            ? `CAKUPAN FASE 1 · ${gapsCountPhase1} KENDALA`
            : 'AUDIT CAKUPAN FASE 1')
      : 'BELUM DIAUDIT';

  const auditColor = auditStatus === 'PASSED' || (hasPhase1Artifacts && gapsCountPhase1 === 0 && vidRecordedPhase1 > 0)
    ? '#047857'
    : (gapsCountPhase1 > 0 || auditStatus === 'PASSED_WITH_LIMITATIONS')
      ? '#a16207'
      : '#be123c';

  // Baca screenshot ke Base64 untuk setiap flow
  const flowsWithMedia = await Promise.all(
    rawFlowResults.map(async (res: any) => {
      const flowDef = job.flows.find(f => f.id === res.flowId);
      const screenshots: Array<{ name: string; base64: string }> = [];

      for (const a of res.artifacts || []) {
        const aPath = typeof a === 'string' ? a : a.path || '';
        const isPng = aPath.toLowerCase().endsWith('.png') || aPath.toLowerCase().endsWith('.jpg') || (typeof a !== 'string' && a.type === 'screenshot');
        if (isPng) {
          const fileName = aPath.split(/[/\\]/).pop() || 'screenshot.png';
          // Resolve file path lokal
          let absolutePath = aPath;
          if (!path.isAbsolute(absolutePath)) {
            absolutePath = path.resolve(jobDir, res.runId || '', fileName);
          }
          let base64 = await fileToBase64(absolutePath);
          if (!base64 && !path.isAbsolute(aPath)) {
            // Coba alternatif path
            base64 = await fileToBase64(path.resolve(jobDir, aPath));
          }
          if (base64) {
            screenshots.push({
              name: fileName,
              base64
            });
          }
        }
      }

      return {
        ...res,
        flowName: flowDef?.name || res.flowId,
        screenshots
      };
    })
  );

  const qualityCategoryRows = Object.entries(qualityReport?.categories || {}).map(([category, metrics]: [string, any]) => `
    <tr><td>${esc(category)}</td><td>${Number(metrics.total || 0)}</td><td style="color:#047857">${Number(metrics.passed || 0)}</td><td style="color:${Number(metrics.failed || 0) ? '#be123c' : '#64748b'}">${Number(metrics.failed || 0)}</td><td>${Number(metrics.notApplicable || 0)}</td></tr>
  `).join('');

  const phase1SummarySectionHtml = hasPhase1Artifacts ? `
    <div class="section-title">Cakupan Penuh Fase 1 (Stage 1 Recon → Long SS → Video Role)</div>
    ${job.reconSummary?.aiExecutiveSummary ? `
      <div class="p1-pdf-ai-banner">
        <div class="p1-pdf-ai-label">✨ Ringkasan Eksekutif Gemini AI</div>
        <p>${esc(job.reconSummary.aiExecutiveSummary)}</p>
      </div>
    ` : ''}
    <div class="quality-summary">
      <div><span>Role Terdeteksi</span><strong>${job.reconSummary?.totalRoles ?? 0}</strong></div>
      <div><span>Halaman / Layar Unik</span><strong>${job.reconSummary?.totalPages ?? 0}</strong></div>
      <div><span>Tab / Fitur Interaktif</span><strong>${job.reconSummary?.totalInteractiveFeatures ?? 0}</strong></div>
      <div><span>Batch 1 Long SS</span><strong style="color:#047857">${ssCapturedPhase1}/${ssTotalPhase1}</strong></div>
      <div><span>Batch 2 Video Role</span><strong style="color:#0284c7">${vidRecordedPhase1}/${vidTotalPhase1}</strong></div>
    </div>

    ${(job.envProvisioning?.entries?.length || job.provisionedAccounts?.length) ? `
      <div class="section-title">Provisioning .env Demo &amp; Akun Role Runtime</div>
      ${job.envProvisioning?.entries?.length ? `
        <table class="data-table">
          <thead><tr><th>Direktori</th><th>Template → Target</th><th>Key Terisi</th><th>Dibantu Gemini</th></tr></thead>
          <tbody>
            ${job.envProvisioning.entries.map((entry) => `
              <tr>
                <td><code>${esc(entry.directory || '.')}</code></td>
                <td><code>${esc(entry.templateFile)}</code> → <code>${esc(entry.targetEnvFile)}</code></td>
                <td>${entry.keysPopulated.length} keys</td>
                <td>${entry.aiInferredKeys.length} keys</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      ${job.provisionedAccounts?.length ? `
        <table class="data-table">
          <thead><tr><th>Role</th><th>Identifier</th><th>Sumber</th><th>Verifikasi</th><th>Rute</th></tr></thead>
          <tbody>
            ${job.provisionedAccounts.map((acc) => `
              <tr>
                <td><strong>${esc(acc.role)}</strong></td>
                <td><code>${esc(acc.identifier || '—')}</code></td>
                <td>${esc(acc.source)}</td>
                <td style="color:${acc.verified ? '#047857' : '#a16207'};font-weight:700">${acc.verified ? '✓ TERVERIFIKASI' : 'BELUM'}</td>
                <td><code>${esc(acc.homePath || acc.loginPath || '/')}</code></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    ` : ''}

    ${phase1LongScreenshots.length > 0 ? `
      <div class="section-title">Batch 1: Long Screenshot Full-Page per Role (${ssCapturedPhase1}/${ssTotalPhase1})</div>
      <div class="p1-pdf-ss-grid">
        ${phase1LongScreenshots.map((ss) => `
          <figure class="p1-pdf-ss-card">
            ${ss.base64
              ? `<img src="${ss.base64}" alt="${esc(ss.pageTitle || ss.pagePath)}">`
              : `<div class="p1-pdf-ss-fail">✕ Gagal: ${esc(ss.error || 'Tidak ada gambar')}</div>`
            }
            <figcaption>
              <div><strong>[${esc((ss.role || 'user').toUpperCase())}] ${esc(ss.pageTitle || ss.pagePath)}</strong></div>
              <div><code>${esc(ss.pagePath)}</code> · ${ss.width}×${ss.height}px · ${ss.segmentCount || 1} seg</div>
            </figcaption>
          </figure>
        `).join('')}
      </div>
      ${(job.longScreenshots?.length || 0) > 60 ? `<p class="quality-empty">Catatan: Menampilkan 60 dari ${job.longScreenshots?.length} Long Screenshot pertama pada dokumen PDF. Lihat HTML report untuk galeri lengkap.</p>` : ''}
    ` : ''}

    ${(job.roleVideos && job.roleVideos.length > 0) ? `
      <div class="section-title">Batch 2: Video Perjalanan Lengkap per Role (${vidRecordedPhase1}/${vidTotalPhase1})</div>
      <table class="data-table">
        <thead><tr><th>Role</th><th>File Video</th><th>Durasi / Ukuran</th><th>Status</th><th>Chapters Halaman &amp; Tab</th></tr></thead>
        <tbody>
          ${job.roleVideos.map((v) => `
            <tr>
              <td><strong>${esc(v.role)}</strong></td>
              <td><code>${esc(v.filename)}</code></td>
              <td>${v.durationSec || 0}s · ${v.sizeBytes ? Math.round(v.sizeBytes / 1024) : 0} KB</td>
              <td style="color:${v.status === 'RECORDED' ? '#047857' : '#be123c'};font-weight:700">${v.status === 'RECORDED' ? '✓ RECORDED' : '✕ FAILED'}</td>
              <td style="font-size:8pt">${v.chapters && v.chapters.length ? v.chapters.map((ch) => `[${ch.startSec}s] ${esc(ch.page)}${ch.feature ? ' → ' + esc(ch.feature) : ''}`).join(' · ') : esc(v.error || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <div class="section-title">Halaman Tidak Bisa Dicek &amp; Kendala Detail (${gapsCountPhase1})</div>
    ${phase1GapsWithMedia.length > 0 ? `
      <div class="quality-finding-list">
        ${phase1GapsWithMedia.map((gap, idx) => `
          <article class="quality-finding-group">
            <div class="quality-finding-heading">
              <strong>${idx + 1}. [${esc((gap.role || 'public').toUpperCase())}] ${esc(gap.pageTitle || gap.pagePath)}</strong>
              <span>${esc(gap.phaseFailed)} · ${esc(gap.category)}${gap.httpStatus ? ` · HTTP ${gap.httpStatus}` : ''}</span>
            </div>
            <ul>
              <li><strong>Path Target:</strong> <code>${esc(gap.pagePath)}</code>${gap.redirectedTo ? ` · Redirect → <code>${esc(gap.redirectedTo)}</code>` : ''}</li>
              <li><strong>Kendala Teknis:</strong> ${esc(gap.technicalReason)}</li>
              ${gap.failedApiCalls?.length ? `<li><strong>API Gagal:</strong> ${gap.failedApiCalls.map((a) => `<code>${esc(`${a.method} ${a.url} → ${a.status}`)}</code>`).join(' · ')}</li>` : ''}
              ${gap.consoleOrDeviceErrors?.length ? `<li><strong>Console / Device Error:</strong> <small>${esc(gap.consoleOrDeviceErrors.join(' | '))}</small></li>` : ''}
              ${gap.aiDiagnosis ? `<li><strong>✨ Diagnosis Gemini AI (${esc(gap.aiDiagnosis.ownerRole)}):</strong> ${esc(gap.aiDiagnosis.summaryId)}<small>Penyebab: ${esc(gap.aiDiagnosis.likelyCause)} · Saran: ${esc(gap.aiDiagnosis.recommendedFix)}</small></li>` : ''}
            </ul>
            ${gap.errorBase64 ? `<div class="quality-evidence-grid"><figure><img src="${gap.errorBase64}" alt="Error snapshot ${esc(gap.pagePath)}"><figcaption>Snapshot error pada ${esc(gap.pagePath)}</figcaption></figure></div>` : ''}
          </article>
        `).join('')}
      </div>
    ` : '<p class="quality-empty">✅ Tidak ada halaman yang gagal diakses atau direkam pada eksekusi Fase 1 ini.</p>'}
  ` : '';

  const qualitySectionHtml = job.qualityAudit && job.config.qualityAudit?.enabled !== false && (job.qualityAudit.status !== 'SKIPPED' || qualityData) ? `
    <div class="section-title">UI Quality Audit</div>
    <div class="quality-summary">
      <div><span>Status</span><strong style="color:${auditColor}">${esc(auditLabel)}</strong></div>
      <div><span>Total pemeriksaan</span><strong>${qualityTotalCount}</strong></div>
      <div><span>Lulus</span><strong style="color:#047857">${qualityPassedCount}</strong></div>
      <div><span>Temuan gagal</span><strong style="color:${qualityFailedCount ? '#be123c' : '#047857'}">${qualityFailedCount}</strong></div>
      <div><span>Tidak berlaku</span><strong>${Number(qualityReport?.notApplicable ?? job.qualityAudit?.notApplicable ?? 0)}</strong></div>
    </div>
    ${qualityCategoryRows ? `<table class="data-table quality-categories"><thead><tr><th>Kategori</th><th>Total</th><th>Lulus</th><th>Temuan</th><th>N/A</th></tr></thead><tbody>${qualityCategoryRows}</tbody></table>` : ''}
    ${qualityFindings.length > 0 ? `
      <div class="quality-finding-list">
        ${qualityFindings.map((group, index) => `
          <article class="quality-finding-group">
            <div class="quality-finding-heading"><strong>${index + 1}. ${esc(group.route)}</strong><span>${esc(group.browser)} · ${esc(group.viewport)}</span></div>
            <ul>${group.checks.map((check) => `<li><strong>${esc(check.area || 'quality')}</strong> — ${esc(check.name || 'UI check gagal')}<small>${esc(check.detail || 'Tidak ada detail yang dilaporkan.')}</small></li>`).join('')}</ul>
            ${group.screenshots.length ? `<div class="quality-evidence-grid">${group.screenshots.map((image) => `<figure><img data-report-evidence src="${image.base64}" alt="Screenshot ${esc(image.name)}"><figcaption>${esc(image.name)} · ${esc(group.route)} · ${esc(group.browser)} / ${esc(group.viewport)}</figcaption></figure>`).join('')}</div>` : '<p class="quality-no-image">Screenshot checkpoint tidak ditemukan pada artifact run ini.</p>'}
          </article>
        `).join('')}
      </div>
    ` : qualityData && qualityFailedCount > 0
      ? `<p class="quality-empty">${qualityFailedCount} pemeriksaan gagal dilaporkan, tetapi detail checks tidak tersedia dalam file report.</p>`
      : qualityData
        ? '<p class="quality-empty">Tidak ada pemeriksaan UI/quality berstatus gagal pada report ini.</p>'
      : `<p class="quality-empty">${qualityFailedCount ? `Report detail tidak tersedia; ${qualityFailedCount} temuan tercatat, tetapi detail dan screenshot tidak dapat dimuat.` : 'Detail pemeriksaan dan screenshot belum tersedia untuk sesi ini.'}</p>`}
    ${job.qualityAudit?.message ? `<p class="quality-empty">Catatan audit: ${esc(job.qualityAudit.message)}</p>` : ''}
  ` : (hasPhase1Artifacts ? '' : `
    <div class="section-title">UI Quality Audit</div>
    <p class="quality-empty">Quality Audit UI belum dijalankan pada sesi ini.</p>
  `);

  const releaseLabel = qualityFailedCount > 0 || failedCount > 0 || gapsCountPhase1 > 0
    ? `Perlu perhatian · ${qualityFailedCount + failedCount + gapsCountPhase1} temuan / kendala cakupan`
    : hasPhase1Artifacts && ssCapturedPhase1 > 0 && vidRecordedPhase1 > 0
      ? `Cakupan Fase 1 lengkap · ${ssCapturedPhase1} Long SS & ${vidRecordedPhase1} Video Role`
      : auditStatus === 'PASSED' && totalCount > 0
        ? 'Lulus pemeriksaan yang dijalankan'
        : 'Belum dinilai untuk kesiapan rilis';

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Laporan Audit Mutu PDF — ${esc(job.name)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 16mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* HEADER & BRANDING */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 14px;
    }
    .header-table td {
      vertical-align: middle;
    }
    .brand-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0284c7;
      font-size: 8pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .report-badge-passed {
      background: #ecfdf5;
      border: 1.5px solid #10b981;
      color: #047857;
      font-size: 11pt;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 6px;
      text-align: center;
      display: inline-block;
    }

    /* METADATA GRID */
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .meta-grid {
      display: table;
      width: 100%;
    }
    .meta-row {
      display: table-row;
    }
    .meta-cell {
      display: table-cell;
      padding: 4px 8px;
      font-size: 9.5pt;
    }
    .meta-cell strong {
      color: #334155;
    }

    /* KPI SCORECARDS */
    .kpi-container {
      display: table;
      width: 100%;
      margin-bottom: 24px;
    }
    .kpi-cell {
      display: table-cell;
      width: 25%;
      padding: 0 6px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      text-align: center;
    }
    .kpi-card.kpi-highlight {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .kpi-val {
      font-size: 20pt;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 2px;
    }
    .kpi-val.val-passed {
      color: #059669;
    }
    .kpi-label {
      font-size: 8pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* HISTORY / ATTEMPTS TABLE */
    .section-title {
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
      margin: 20px 0 10px 0;
      border-left: 4px solid #0284c7;
      padding-left: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      font-size: 9pt;
    }
    table.data-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
    }
    table.data-table td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
    }
    table.data-table tr.active-row {
      background: #f0fdf4;
      font-weight: 600;
    }

    /* FLOW CARDS */
    .flow-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      margin-bottom: 16px;
      padding: 14px 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .flow-card.card-passed {
      border-left: 5px solid #10b981;
    }
    .flow-header {
      display: table;
      width: 100%;
      margin-bottom: 10px;
    }
    .flow-title {
      display: table-cell;
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
    }
    .flow-status-pill {
      display: table-cell;
      text-align: right;
      font-size: 8.5pt;
      font-weight: 700;
      color: #059669;
    }

    /* STEPS TABLE */
    table.steps-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin: 8px 0 12px 0;
    }
    table.steps-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 5px 8px;
      border-bottom: 1px solid #cbd5e1;
    }
    table.steps-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .step-code {
      font-family: monospace;
      color: #0284c7;
      font-size: 8pt;
    }

    /* SCREENSHOT EVIDENCE */
    .gallery-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
    }
    .gallery-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px;
      background: #f8fafc;
      text-align: center;
      width: 130px;
      page-break-inside: avoid;
    }
    .gallery-img {
      max-width: 100%;
      height: 180px;
      object-fit: contain;
      border-radius: 4px;
      background: #000000;
      display: block;
      margin: 0 auto;
    }
    .gallery-caption {
      font-size: 7pt;
      font-weight: 600;
      color: #475569;
      margin-top: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .report-badge-status { display:inline-block; max-width:250px; padding:7px 12px; border:1.5px solid ${auditColor}; border-radius:6px; color:${auditColor}; background:#fff; font-size:9pt; font-weight:800; text-align:center; }
    .quality-summary { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; margin:8px 0 12px; }
    .quality-summary > div { padding:9px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc; }
    .quality-summary span,.quality-summary strong { display:block; }
    .quality-summary span { color:#64748b; font-size:7pt; text-transform:uppercase; }
    .quality-summary strong { margin-top:4px; font-size:10pt; }
    .quality-categories { margin-top:8px; }
    .quality-finding-group { margin:12px 0; padding:11px; border:1px solid #fecdd3; border-left:4px solid #e11d48; border-radius:6px; break-inside:avoid; page-break-inside:avoid; }
    .quality-finding-heading { display:flex; justify-content:space-between; gap:10px; margin-bottom:7px; font-size:9pt; }
    .quality-finding-heading span { color:#64748b; font-size:8pt; }
    .quality-finding-group ul { padding-left:18px; }
    .quality-finding-group li { margin:5px 0; font-size:8.5pt; }
    .quality-finding-group li small { display:block; margin-top:2px; color:#475569; white-space:pre-wrap; overflow-wrap:anywhere; }
    .quality-evidence-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:8px; margin-top:9px; }
    .quality-evidence-grid figure { margin:0; padding:4px; border:1px solid #cbd5e1; border-radius:5px; break-inside:avoid; page-break-inside:avoid; }
    .quality-evidence-grid img { display:block; width:100%; max-height:300px; object-fit:contain; background:#111827; }
    .quality-evidence-grid figcaption { padding:4px 2px; color:#475569; font-size:7pt; overflow-wrap:anywhere; }
    .quality-empty { margin:8px 0 14px; padding:10px; border:1px solid #cbd5e1; border-radius:6px; color:#475569; background:#f8fafc; font-size:9pt; }
    .p1-pdf-ai-banner { margin:8px 0 12px; padding:10px 12px; border:1px solid #bae6fd; border-left:4px solid #0284c7; border-radius:6px; background:#f0f9ff; break-inside:avoid; page-break-inside:avoid; }
    .p1-pdf-ai-label { font-size:8pt; font-weight:800; text-transform:uppercase; letter-spacing:0.4px; color:#0284c7; margin-bottom:4px; }
    .p1-pdf-ai-banner p { font-size:8.8pt; color:#0f172a; line-height:1.45; white-space:pre-line; }
    .p1-pdf-ss-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin:8px 0 14px; }
    .p1-pdf-ss-card { margin:0; padding:6px; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; break-inside:avoid; page-break-inside:avoid; }
    .p1-pdf-ss-card img { display:block; width:100%; max-height:360px; object-fit:contain; border-radius:4px; background:#0f172a; }
    .p1-pdf-ss-card figcaption { margin-top:5px; font-size:7.5pt; color:#334155; overflow-wrap:anywhere; }
    .p1-pdf-ss-fail { padding:24px 8px; text-align:center; color:#be123c; background:#fff1f2; border-radius:4px; font-size:8pt; }

    /* FOOTER */
    .audit-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      font-size: 8pt;
      color: #64748b;
      display: table;
      width: 100%;
    }
    .audit-footer-left {
      display: table-cell;
    }
    .audit-footer-right {
      display: table-cell;
      text-align: right;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td>
        <div class="brand-badge">QC MAESTRO · AUTONOMOUS QA AUDIT</div>
        <div class="brand-title">${esc(job.name)}</div>
      </td>
      <td style="text-align: right;">
        <div class="report-badge-status">${esc(auditLabel)}</div>
      </td>
    </tr>
  </table>

  <!-- METADATA BOX -->
  <div class="meta-box">
    <div class="meta-grid">
      <div class="meta-row">
        <div class="meta-cell">📱 <strong>Target:</strong> ${esc(job.config.platform.toUpperCase())} (${esc(job.config.appId || job.config.baseUrl)})</div>
        <div class="meta-cell">🔄 <strong>Sesi Percobaan:</strong> <span style="color:#0284c7;font-weight:700">${esc(selectedAttempt?.name || 'Sesi Fase 1')}</span></div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">📅 <strong>Waktu Pengujian:</strong> ${esc(formatWIB(selectedAttempt?.finishedAt || job.finishedAt))}</div>
        <div class="meta-cell">🆔 <strong>Job ID:</strong> <code>${esc(job.id.slice(0, 8))}</code></div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">🔧 <strong>Lingkungan Runner:</strong> ${esc(job.config.platform === 'android' ? (job.config.useServerEmulator !== false ? `Server Headless Emulator (${job.config.deviceId || 'qc_worker_headless'})` : (job.config.deviceId || 'Emulator')) : (job.qualityAudit?.browsers?.join(', ') || 'Chromium Headless Playwright'))}</div>
        <div class="meta-cell">📦 <strong>Mode / Repo:</strong> ${esc(job.config.runMode)} ${job.config.frontendTarget?.repositoryUrl || job.config.mobileTarget?.repositoryUrl || job.config.repositoryUrl ? `(${esc(job.config.frontendTarget?.repositoryUrl || job.config.mobileTarget?.repositoryUrl || job.config.repositoryUrl)})` : ''}</div>
      </div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div class="kpi-container">
    <div class="kpi-cell">
      <div class="kpi-card kpi-highlight">
        <div class="kpi-val ${healthScore !== null && healthScore === 100 ? 'val-passed' : ''}" style="color:${healthScore === null ? '#64748b' : healthScore === 100 ? '#059669' : '#e11d48'}">${healthScore === null ? (ssTotalPhase1 > 0 ? `${Math.round((ssCapturedPhase1 / ssTotalPhase1) * 100)}%` : '—') : `${healthScore}%`}</div>
        <div class="kpi-label">${healthScore === null && ssTotalPhase1 > 0 ? 'Long SS Rate' : 'Flow Pass Rate'}</div>
      </div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-card">
        <div class="kpi-val" style="color:#0f172a">${totalCount}</div>
        <div class="kpi-label">Skenario Diuji</div>
      </div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-card">
        <div class="kpi-val val-passed">${passedCount}</div>
        <div class="kpi-label">Skenario Lulus</div>
      </div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-card">
        <div class="kpi-val" style="color:${failedCount === 0 && gapsCountPhase1 === 0 ? '#059669' : '#e11d48'}">${failedCount + gapsCountPhase1}</div>
        <div class="kpi-label">Kendala / Defect</div>
      </div>
    </div>
  </div>

  <!-- RIWAYAT PERCOBAAN -->
  <div class="section-title">Riwayat Sesi Percobaan (Attempt Separation)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Sesi Percobaan</th>
        <th>Waktu Eksekusi</th>
        <th>Total Skenario</th>
        <th>Lulus</th>
        <th>Gagal</th>
        <th>Pass Rate</th>
        <th>Status Akhir</th>
      </tr>
    </thead>
    <tbody>
      ${attempts.map(att => {
        const isCurrent = att.id === selectedAttempt?.id;
        const passRate = att.metrics?.passRate ?? 0;
        const isPassed = att.status === 'PASSED';
        return `
        <tr class="${isCurrent ? 'active-row' : ''}">
          <td><strong>${esc(att.name)}</strong> ${isCurrent ? '👈 (Laporan Ini)' : ''}</td>
          <td>${esc(formatWIB(att.finishedAt))}</td>
          <td>${att.metrics.total}</td>
          <td style="color:#059669;font-weight:700">${att.metrics.passed}</td>
          <td style="color:${att.metrics.failed > 0 ? '#e11d48' : '#64748b'}">${att.metrics.failed}</td>
          <td><strong>${passRate}%</strong></td>
          <td><span style="color:${isPassed ? '#059669' : '#e11d48'};font-weight:700">${isPassed ? '✓ PASSED' : '✕ FAILED'}</span></td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  ${phase1SummarySectionHtml}

  ${qualitySectionHtml}

  <!-- DETAIL SKENARIO -->
  <div class="section-title">Rincian Skenario Terverifikasi (${esc(selectedAttempt?.name || '')})</div>

  ${flowsWithMedia.map((flow: any, idx: number) => {
    const isPassed = flow.status === 'PASSED';
    return `
    <div class="flow-card ${isPassed ? 'card-passed' : ''}">
      <div class="flow-header">
        <div class="flow-title">
          ${idx + 1}. ${esc(flow.flowName || flow.flowId)}
        </div>
        <div class="flow-status-pill">
          ${isPassed ? '✓ CLEAR / PASSED' : '✕ FAILED'}
        </div>
      </div>

      <!-- Tabel Langkah -->
      <table class="steps-table">
        <thead>
          <tr>
            <th style="width: 25px">#</th>
            <th>Perintah / Aksi Interaksi</th>
            <th style="width: 70px">Status</th>
            <th style="width: 70px">Durasi</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${(flow.steps || []).map((s: any, sIdx: number) => `
            <tr>
              <td style="color:#64748b">${sIdx + 1}</td>
              <td><span class="step-code">${esc(s.action)}</span></td>
              <td><span style="color:${s.status === 'PASSED' ? '#059669' : '#e11d48'};font-weight:700">${esc(s.status)}</span></td>
              <td style="color:#64748b">${s.durationMs || 0} ms</td>
              <td style="color:${s.errorMessage ? '#e11d48' : '#64748b'}">${esc(s.errorMessage || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Bukti Screenshot -->
      ${flow.screenshots && flow.screenshots.length > 0 ? `
        <div class="gallery-row">
          ${flow.screenshots.map((sc: any) => `
            <div class="gallery-box">
              <img class="gallery-img" src="${sc.base64}" alt="${esc(sc.name)}">
              <div class="gallery-caption">📸 ${esc(sc.name)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
    `;
  }).join('')}

  <!-- AUDIT FOOTER -->
  <div class="audit-footer">
    <div class="audit-footer-left">
      Ringkasan ini hanya mencakup pemeriksaan dan bukti yang benar-benar tersedia pada sesi QC ini.
    </div>
    <div class="audit-footer-right">
      ${esc(releaseLabel)}
    </div>
  </div>

</body>
</html>`;
}

export async function generatePdfReport(
  job: DiscoveryJob,
  artifactRoot: string,
  options?: { attempt?: string; status?: string }
): Promise<Buffer> {
  const html = await buildPdfHtml(job, artifactRoot, options);
  const tempDir = path.resolve(artifactRoot, 'temp');
  await mkdir(tempDir, { recursive: true });
  const tempFile = path.resolve(tempDir, `pdf-render-${job.id.slice(0, 8)}-${Date.now()}.html`);
  await writeFile(tempFile, html, 'utf8');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1024 }
    });

    const fileUrl = `file://${tempFile.replace(/\\/g, '/')}`;
    await withTimeout(page.goto(fileUrl, { waitUntil: 'load', timeout: 60_000 }), 60_000);
    await withTimeout(page.evaluate(async () => {
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('img')).map((image) => image.decode().catch(() => undefined)));
    }), 25_000);

    const pdfBuffer = await withTimeout<Buffer>(page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        bottom: '14mm',
        left: '12mm',
        right: '12mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 8pt; width: 100%; text-align: center; color: #94a3b8; font-family: sans-serif; border-top: 1px solid #e2e8f0; padding-top: 4px; margin: 0 12mm;">
          <span>QC Maestro · ${esc(job.name)} · Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span>
        </div>
      `
    }), 60_000);

    return pdfBuffer;
  } finally {
    await closeWithTimeout(browser.close());
    await unlink(tempFile).catch(() => undefined);
  }
}
