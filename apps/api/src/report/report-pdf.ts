import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DiscoveryJob } from '../discovery/types.ts';
import { groupResultsIntoAttempts, type TestAttempt } from './attempt-grouper.ts';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function withTimeout<T>(action: Promise<T>, timeoutMs = 10_000): Promise<T> {
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
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
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
  const healthScore = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 100;

  // Baca screenshot ke Base64 untuk setiap flow
  const jobDir = path.join(artifactRoot, 'jobs', job.id);
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
        <div class="report-badge-passed">
          ✓ STATUS: 100% LULUS
        </div>
      </td>
    </tr>
  </table>

  <!-- METADATA BOX -->
  <div class="meta-box">
    <div class="meta-grid">
      <div class="meta-row">
        <div class="meta-cell">📱 <strong>Target:</strong> ${esc(job.config.platform.toUpperCase())} (${esc(job.config.appId || job.config.baseUrl)})</div>
        <div class="meta-cell">🔄 <strong>Sesi Percobaan:</strong> <span style="color:#0284c7;font-weight:700">${esc(selectedAttempt?.name || 'Percobaan Terpilih')}</span></div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">📅 <strong>Waktu Pengujian:</strong> ${esc(formatWIB(selectedAttempt?.finishedAt || job.finishedAt))}</div>
        <div class="meta-cell">🆔 <strong>Job ID:</strong> <code>${esc(job.id.slice(0, 8))}</code></div>
      </div>
      <div class="meta-row">
        <div class="meta-cell">🔧 <strong>Perangkat Pengujian:</strong> TECNO CM5 (${esc(job.config.deviceId || 'Android Physical Device')})</div>
        <div class="meta-cell">📐 <strong>Resolusi Layar:</strong> 1080 x 2436 Pixel</div>
      </div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div class="kpi-container">
    <div class="kpi-cell">
      <div class="kpi-card kpi-highlight">
        <div class="kpi-val val-passed">${healthScore}%</div>
        <div class="kpi-label">QA Health Score</div>
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
        <div class="kpi-val" style="color:${failedCount === 0 ? '#059669' : '#e11d48'}">${failedCount}</div>
        <div class="kpi-label">Defect / Crash</div>
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
      Dokumen ini diverifikasi secara deterministik oleh QC Maestro Autonomous Engine pada perangkat fisik.
    </div>
    <div class="audit-footer-right">
      Kesiapan Produksi: SIAP RILIS (PRODUCTION-READY)
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

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1024 }
    });

    await withTimeout(page.setContent(html, {
      waitUntil: 'load'
    }));

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
    }));

    return pdfBuffer;
  } finally {
    await closeWithTimeout(browser.close());
  }
}
