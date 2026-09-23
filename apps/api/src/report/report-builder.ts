import type { DiscoveryJob } from '../discovery/types.ts';
import { groupResultsIntoAttempts, type TestAttempt } from './attempt-grouper.ts';
import { buildJsonReport } from './report-json.ts';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function formatWIB(value?: string | number | Date): string {
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

export function buildReport(job: DiscoveryJob, artifactPrefix = '', options?: { attempt?: string; status?: string }): string {
  const attempts = groupResultsIntoAttempts(job.results, job.flows);
  const structuredData = buildJsonReport(job, artifactPrefix, { attempt: 'all', status: 'all' });
  const latestAttempt = attempts[0]; // sorted newest first

  const totalAttemptsCount = attempts.length;
  const initialAttemptId = options?.attempt && options.attempt !== 'latest' && options.attempt !== 'all'
    ? (attempts.find(a => String(a.attemptNumber) === options.attempt || a.id === options.attempt)?.id || latestAttempt?.id || 'all')
    : (options?.attempt === 'all' ? 'all' : latestAttempt?.id || 'all');

  const initialStatus = options?.status || 'all';

  return `<!doctype html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(job.name)} · Laporan Audit Mutu QC Maestro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --bg-card: #111827;
      --bg-card-hover: #162032;
      --bg-card-inner: #1a2438;
      --border: #233149;
      --border-subtle: #1b263b;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --primary: #38bdf8;
      --primary-glow: rgba(56, 189, 248, 0.15);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
      --success-border: rgba(16, 185, 129, 0.3);
      --danger: #f43f5e;
      --danger-bg: rgba(244, 63, 94, 0.12);
      --danger-border: rgba(244, 63, 94, 0.3);
      --warning: #f59e0b;
      --radius: 12px;
      --font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    [data-theme="light"] {
      --bg: #f8fafc;
      --bg-card: #ffffff;
      --bg-card-hover: #f1f5f9;
      --bg-card-inner: #f8fafc;
      --border: #e2e8f0;
      --border-subtle: #cbd5e1;
      --text: #0f172a;
      --text-muted: #475569;
      --text-dim: #94a3b8;
      --primary: #0284c7;
      --primary-glow: rgba(2, 132, 199, 0.1);
      --success: #059669;
      --success-bg: rgba(5, 150, 105, 0.08);
      --success-border: rgba(5, 150, 105, 0.3);
      --danger: #e11d48;
      --danger-bg: rgba(225, 29, 72, 0.08);
      --danger-border: rgba(225, 29, 72, 0.3);
      --warning: #d97706;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 14px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }

    /* TOP BAR */
    .top-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: var(--primary-glow);
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--primary);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .action-group {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-card);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      user-select: none;
    }
    .btn:hover {
      background: var(--bg-card-hover);
      border-color: var(--primary);
      color: var(--primary);
      transform: translateY(-1px);
    }
    .btn-primary {
      background: var(--primary);
      color: #ffffff !important;
      border-color: var(--primary);
    }
    .btn-primary:hover {
      background: #0284c7;
      color: #ffffff !important;
    }

    /* HEADER BANNER */
    .header-banner {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    .header-banner::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--success), var(--warning));
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
    }
    .header-title h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
      color: var(--text);
    }
    .header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* METRIC SCORECARDS */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .metric-card:hover {
      border-color: var(--border-subtle);
      transform: translateY(-2px);
    }
    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .metric-val {
      font-size: 36px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -1px;
      margin-bottom: 8px;
    }
    .metric-sub {
      font-size: 12px;
      color: var(--text-dim);
    }

    /* CONTROLS & FILTER TOOLBAR */
    .filter-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .filter-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .filter-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .pill {
      background: var(--bg-card-inner);
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 7px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pill:hover {
      color: var(--text);
      border-color: var(--primary);
    }
    .pill.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
      box-shadow: 0 2px 8px var(--primary-glow);
    }
    .pill.active-success {
      background: var(--success) !important;
      color: #ffffff !important;
      border-color: var(--success) !important;
    }
    .pill.active-danger {
      background: var(--danger) !important;
      color: #ffffff !important;
      border-color: var(--danger) !important;
    }
    .badge-count {
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      background: rgba(0,0,0,0.25);
    }

    /* SCENARIO RESULTS LIST */
    .section-heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .section-heading h2 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }
    .flows-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .flow-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      transition: border-color 0.2s ease;
    }
    .flow-card.flow-passed {
      border-left: 4px solid var(--success);
    }
    .flow-card.flow-failed {
      border-left: 4px solid var(--danger);
    }
    .flow-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 18px;
    }
    .flow-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .flow-meta {
      font-size: 12px;
      color: var(--text-dim);
      margin-top: 4px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-passed {
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid var(--success-border);
    }
    .badge-failed {
      background: var(--danger-bg);
      color: var(--danger);
      border: 1px solid var(--danger-border);
    }

    /* STEP TABLE */
    .steps-table-wrap {
      overflow-x: auto;
      margin: 16px 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-card-inner);
    }
    table.steps-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.steps-table th {
      background: var(--bg-card);
      color: var(--text-muted);
      text-align: left;
      padding: 10px 14px;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    table.steps-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-subtle);
    }
    table.steps-table tr:last-child td {
      border-bottom: none;
    }
    .step-code {
      font-family: var(--font-mono);
      color: var(--primary);
      font-size: 12px;
    }

    /* SCREENSHOT GALLERY */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid var(--border-subtle);
    }
    .gallery-card {
      background: var(--bg-card-inner);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .gallery-card:hover {
      transform: translateY(-3px);
      border-color: var(--primary);
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
    }
    .gallery-img {
      max-height: 220px;
      width: auto;
      max-width: 100%;
      object-fit: contain;
      border-radius: 6px;
      background: #000;
    }
    .gallery-caption {
      margin-top: 8px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }

    /* LIGHTBOX MODAL */
    .lightbox {
      display: none;
      position: fixed;
      z-index: 9999;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(8px);
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: 24px;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox-img {
      max-width: 90vw;
      max-height: 85vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .lightbox-caption {
      margin-top: 12px;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
    }
    .lightbox-close {
      position: absolute;
      top: 20px; right: 24px;
      background: rgba(255,255,255,0.2);
      color: #fff;
      border: 0;
      border-radius: 50%;
      width: 40px; height: 40px;
      font-size: 20px;
      cursor: pointer;
    }

    /* EMPTY STATE */
    .empty-state {
      padding: 48px 24px;
      text-align: center;
      background: var(--bg-card);
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      color: var(--text-muted);
    }

    /* PRINT STYLES */
    @media print {
      body {
        background: #ffffff !important;
        color: #0f172a !important;
        font-size: 12px;
      }
      .container {
        padding: 0 !important;
        max-width: 100% !important;
      }
      .top-toolbar, .filter-section, .lightbox, button, a.btn {
        display: none !important;
      }
      .header-banner {
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
        padding: 20px !important;
        margin-bottom: 16px !important;
      }
      .header-title h1 {
        color: #0f172a !important;
        font-size: 24px !important;
      }
      .metrics-grid {
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 12px !important;
        margin-bottom: 20px !important;
      }
      .metric-card {
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
        padding: 14px !important;
      }
      .metric-val {
        font-size: 24px !important;
        color: #0f172a !important;
      }
      .flow-card {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        padding: 16px !important;
        margin-bottom: 14px !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .steps-table-wrap {
        background: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
      }
      table.steps-table th {
        background: #f1f5f9 !important;
        color: #334155 !important;
      }
      table.steps-table td {
        border-color: #e2e8f0 !important;
        color: #0f172a !important;
      }
      .gallery-grid {
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 8px !important;
      }
      .gallery-card {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        padding: 4px !important;
      }
      .gallery-img {
        max-height: 150px !important;
      }
      .print-footer {
        display: block !important;
        margin-top: 30px;
        font-size: 11px;
        color: #64748b;
        text-align: center;
        border-top: 1px solid #e2e8f0;
        padding-top: 10px;
      }
    }
  </style>
</head>
<body>

<div class="container">
  <!-- TOP TOOLBAR -->
  <div class="top-toolbar">
    <div class="brand-tag">
      <span>🛡️</span> QC Maestro · Autonomous Quality Engine
    </div>
    <div class="action-group">
      <button class="btn" id="theme-toggle" onclick="toggleTheme()" title="Ubah Mode Tampilan">🌓 Ganti Tema</button>
      <button class="btn" id="json-download-btn" onclick="downloadStructuredJson()" title="Unduh data audit terstruktur (JSON)">📥 Unduh JSON</button>
      <button class="btn btn-primary" onclick="window.print()" title="Cetak atau Simpan PDF Laporan">🖨️ Cetak / Simpan PDF</button>
    </div>
  </div>

  <!-- HEADER BANNER -->
  <div class="header-banner">
    <div class="header-content">
      <div class="header-title">
        <h1>${esc(job.name)}</h1>
        <div class="header-meta">
          <div class="meta-item"><span>📱</span> Target: <strong>${esc(job.config.platform.toUpperCase())} (${esc(job.config.appId || job.config.baseUrl)})</strong></div>
          <div class="meta-item"><span>📅</span> Dieksekusi: <strong>${esc(formatWIB(job.createdAt))}</strong></div>
          <div class="meta-item"><span>🔢</span> Total Percobaan: <strong>${totalAttemptsCount} Sesi</strong></div>
          <div class="meta-item"><span>🆔</span> Job ID: <code>${esc(job.id.slice(0, 8))}</code></div>
        </div>
      </div>
    </div>
  </div>

  <!-- METRICS SCORECARDS -->
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-header">
        <span>QA HEALTH SCORE</span>
        <span>🛡️</span>
      </div>
      <div class="metric-val" id="kpi-health" style="color: var(--success)">100%</div>
      <div class="metric-sub" id="kpi-health-sub">Tingkat kelulusan skenario pengujian</div>
    </div>

    <div class="metric-card">
      <div class="metric-header">
        <span>TOTAL SKENARIO</span>
        <span>📑</span>
      </div>
      <div class="metric-val" id="kpi-total" style="color: var(--text)">8</div>
      <div class="metric-sub">Skenario deterministik diuji</div>
    </div>

    <div class="metric-card">
      <div class="metric-header">
        <span>SKENARIO LULUS</span>
        <span>✅</span>
      </div>
      <div class="metric-val" id="kpi-passed" style="color: var(--success)">8</div>
      <div class="metric-sub">100% Bebas Crash &amp; Terverifikasi</div>
    </div>

    <div class="metric-card">
      <div class="metric-header">
        <span>DEFECT / GAGAL</span>
        <span>❌</span>
      </div>
      <div class="metric-val" id="kpi-failed" style="color: var(--danger)">0</div>
      <div class="metric-sub" id="kpi-failed-sub">0 Issue terdeteksi</div>
    </div>
  </div>

  <!-- FILTER & ATTEMPT SELECTOR -->
  <div class="filter-section">
    <!-- ROW 1: ATTEMPT SELECTOR -->
    <div class="filter-row">
      <div class="filter-title">
        <span>🔄</span> Sesi Percobaan (Attempts):
      </div>
      <div class="filter-pills" id="attempt-pills">
        <!-- Rendered via JS -->
      </div>
    </div>

    <!-- ROW 2: STATUS FILTER -->
    <div class="filter-row" style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
      <div class="filter-title">
        <span>🔍</span> Filter Status:
      </div>
      <div class="filter-pills">
        <button class="pill active" id="filter-status-all" onclick="setStatusFilter('all')">
          Semua Skenario <span class="badge-count" id="count-all">0</span>
        </button>
        <button class="pill" id="filter-status-passed" onclick="setStatusFilter('PASSED')">
          ✅ Hanya Berhasil <span class="badge-count" id="count-passed">0</span>
        </button>
        <button class="pill" id="filter-status-failed" onclick="setStatusFilter('FAILED')">
          ❌ Hanya Gagal <span class="badge-count" id="count-failed">0</span>
        </button>
      </div>
    </div>
  </div>

  <!-- RESULTS LIST -->
  <div class="section-heading">
    <h2 id="results-heading">Rincian Hasil Pengujian</h2>
    <span class="metric-sub" id="active-attempt-info">Menampilkan percobaan terbaru</span>
  </div>

  <div class="flows-container" id="flows-list">
    <!-- Rendered via JS -->
  </div>

  <div class="print-footer" style="display:none">
    Laporan diekspor secara deterministik oleh QC Maestro · Dokumen Audit Kesiapan Produksi
  </div>
</div>

<!-- LIGHTBOX MODAL -->
<div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
  <button class="lightbox-close" onclick="closeLightbox(event)">&times;</button>
  <img class="lightbox-img" id="lightbox-img" src="" alt="Preview">
  <div class="lightbox-caption" id="lightbox-caption"></div>
</div>

<!-- EMBEDDED DATA -->
<script id="qc-report-data" type="application/json">
${JSON.stringify(structuredData)}
</script>

<script>
  const reportData = JSON.parse(document.getElementById('qc-report-data').textContent);
  let currentAttemptId = '${initialAttemptId}';
  let currentStatusFilter = '${initialStatus}';

  function init() {
    renderAttemptPills();
    renderView();
  }

  function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
  }

  function renderAttemptPills() {
    const container = document.getElementById('attempt-pills');
    if (!container) return;

    let html = '';
    const attempts = reportData.attempts || [];

    // Pill untuk Setiap Percobaan
    attempts.forEach(att => {
      const isSelected = currentAttemptId === att.id;
      const isLatest = att.isLatest;
      const passRate = att.metrics ? att.metrics.passRate : 0;
      const isAllPass = att.status === 'PASSED';

      const label = att.name + (isLatest ? ' ★' : '') + ' (' + passRate + '% Lulus)';
      const activeClass = isSelected ? (isAllPass ? 'active active-success' : 'active active-danger') : '';

      html += '<button class="pill ' + activeClass + '" onclick="selectAttempt(\\'' + att.id + '\\')">' +
        (isAllPass ? '✅ ' : '⚠️ ') + escapeHtml(label) +
        '</button>';
    });

    // Pill untuk Semua Percobaan
    const allSelected = currentAttemptId === 'all';
    html += '<button class="pill ' + (allSelected ? 'active' : '') + '" onclick="selectAttempt(\\'all\\')">' +
      '📚 Semua Percobaan (' + attempts.length + ' Sesi)' +
      '</button>';

    container.innerHTML = html;
  }

  function selectAttempt(attemptId) {
    currentAttemptId = attemptId;
    renderAttemptPills();
    renderView();
  }

  function setStatusFilter(status) {
    currentStatusFilter = status;
    document.querySelectorAll('[id^="filter-status-"]').forEach(btn => {
      btn.classList.remove('active', 'active-success', 'active-danger');
    });

    const activeBtn = document.getElementById('filter-status-' + status.toLowerCase());
    if (activeBtn) {
      if (status === 'PASSED') activeBtn.classList.add('active', 'active-success');
      else if (status === 'FAILED') activeBtn.classList.add('active', 'active-danger');
      else activeBtn.classList.add('active');
    }

    renderView();
  }

  function getActiveResults() {
    const attempts = reportData.attempts || [];
    let flows = [];

    if (currentAttemptId === 'all') {
      attempts.forEach(a => {
        (a.flows || []).forEach(f => {
          flows.push({ ...f, attemptName: a.name });
        });
      });
    } else {
      const selected = attempts.find(a => a.id === currentAttemptId) || attempts[0];
      if (selected) {
        flows = (selected.flows || []).map(f => ({ ...f, attemptName: selected.name }));
      }
    }

    return flows;
  }

  function renderView() {
    const allFlowsInAttempt = getActiveResults();
    const passedCount = allFlowsInAttempt.filter(f => f.status === 'PASSED').length;
    const failedCount = allFlowsInAttempt.filter(f => f.status !== 'PASSED').length;
    const totalCount = allFlowsInAttempt.length;
    const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

    // Update Counts in Filter Buttons
    document.getElementById('count-all').textContent = totalCount;
    document.getElementById('count-passed').textContent = passedCount;
    document.getElementById('count-failed').textContent = failedCount;

    // Update Scorecards
    const healthEl = document.getElementById('kpi-health');
    healthEl.textContent = passRate + '%';
    healthEl.style.color = passRate >= 80 ? 'var(--success)' : 'var(--danger)';

    const healthSubEl = document.getElementById('kpi-health-sub');
    healthSubEl.textContent = passRate === 100 ? 'Semua lolos sempurna (Zero Defect)' : (failedCount + ' skenario membutuhkan perhatian');

    document.getElementById('kpi-total').textContent = totalCount;
    document.getElementById('kpi-passed').textContent = passedCount;

    const failedEl = document.getElementById('kpi-failed');
    failedEl.textContent = failedCount;
    failedEl.style.color = failedCount === 0 ? 'var(--success)' : 'var(--danger)';

    document.getElementById('kpi-failed-sub').textContent = failedCount === 0 ? 'Status Clean (Bebas Bug)' : 'Perlu diperbaiki';

    // Filter by Status
    let displayFlows = allFlowsInAttempt;
    if (currentStatusFilter !== 'all') {
      displayFlows = displayFlows.filter(f => f.status === currentStatusFilter);
    }

    // Render Cards
    const container = document.getElementById('flows-list');
    if (!displayFlows.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada skenario yang sesuai dengan filter yang dipilih.</div>';
      return;
    }

    let html = '';
    displayFlows.forEach((flow, idx) => {
      const isPassed = flow.status === 'PASSED';
      const statusBadge = isPassed
        ? '<span class="status-badge badge-passed">✓ PASSED</span>'
        : '<span class="status-badge badge-failed">✕ FAILED</span>';

      html += '<div class="flow-card ' + (isPassed ? 'flow-passed' : 'flow-failed') + '">';
      html += '  <div class="flow-header">';
      html += '    <div>';
      html += '      <div class="flow-title">' + escapeHtml(flow.flowName || flow.flowId) + '</div>';
      html += '      <div class="flow-meta">Sesi: <strong>' + escapeHtml(flow.attemptName || '') + '</strong> · Run ID: <code>' + escapeHtml(flow.runId) + '</code> · Selesai: ' + escapeHtml(flow.finishedAt) + '</div>';
      html += '    </div>';
      html += '    <div>' + statusBadge + '</div>';
      html += '  </div>';

      // Step table
      if (flow.steps && flow.steps.length) {
        html += '  <div class="steps-table-wrap">';
        html += '    <table class="steps-table">';
        html += '      <thead><tr><th>#</th><th>Aksi / Perintah</th><th>Status</th><th>Durasi</th><th>Pesan</th></tr></thead>';
        html += '      <tbody>';
        flow.steps.forEach((st, sIdx) => {
          const stPass = st.status === 'PASSED';
          html += '      <tr>';
          html += '        <td style="color:var(--text-dim)">' + (sIdx + 1) + '</td>';
          html += '        <td><code class="step-code">' + escapeHtml(st.action) + '</code></td>';
          html += '        <td><span style="color:' + (stPass ? 'var(--success)' : 'var(--danger)') + ';font-weight:700">' + escapeHtml(st.status) + '</span></td>';
          html += '        <td style="color:var(--text-muted)">' + (st.durationMs || 0) + ' ms</td>';
          html += '        <td style="color:var(--danger)">' + escapeHtml(st.errorMessage || '') + '</td>';
          html += '      </tr>';
        });
        html += '      </tbody>';
        html += '    </table>';
        html += '  </div>';
      }

      // Screenshot gallery
      if (flow.screenshots && flow.screenshots.length) {
        html += '  <div class="gallery-grid">';
        flow.screenshots.forEach(sc => {
          html += '    <div class="gallery-card" onclick="openLightbox(\\'' + encodeURI(sc.url) + '\\', \\'' + escapeHtml(sc.name) + '\\')">';
          html += '      <img class="gallery-img" src="' + escapeHtml(sc.url) + '" alt="' + escapeHtml(sc.name) + '" loading="lazy">';
          html += '      <div class="gallery-caption">📸 ' + escapeHtml(sc.name) + '</div>';
          html += '    </div>';
        });
        html += '  </div>';
      }

      html += '</div>';
    });

    container.innerHTML = html;
  }

  function openLightbox(src, caption) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-caption');
    img.src = src;
    cap.textContent = caption;
    lb.classList.add('active');
  }

  function closeLightbox(e) {
    if (e.target.id === 'lightbox' || e.target.classList.contains('lightbox-close')) {
      document.getElementById('lightbox').classList.remove('active');
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.getElementById('lightbox').classList.remove('active');
    }
  });

  function downloadStructuredJson() {
    const activeResults = getActiveResults();
    const exportPayload = {
      ...reportData,
      activeView: {
        attemptId: currentAttemptId,
        statusFilter: currentStatusFilter,
        exportedAt: new Date().toISOString(),
        flows: activeResults
      }
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qc-report-' + (reportData.target ? reportData.target.jobId.slice(0, 8) : 'job') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  init();
</script>
</body>
</html>`;
}
