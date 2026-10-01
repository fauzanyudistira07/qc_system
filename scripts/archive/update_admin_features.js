const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../apps/unique-demo/server.js');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Add makeFlows definition and update initScannedProjects
const makeFlowsSnippet = `
function makeFlows() {
  return [
    {
      id: 'auth-session',
      title: 'Authentication & Session Boundary',
      status: 'APPROVED',
      critical: true,
      summary: 'Login, logout, role redirect, dan proteksi sesi pengguna.',
      steps: [
        { action: 'Buka halaman login', route: '/login', expected: 'Form login tampil dengan input email & password.' },
        { action: 'Kirim kredensial pengguna', route: '/login', expected: 'Sesi aktif dan dialihkan ke dashboard yang sesuai.' },
        { action: 'Akses route protected tanpa sesi', route: '/admin', expected: 'Otomatis di-redirect kembali ke login.' }
      ]
    },
    {
      id: 'project-source',
      title: 'Project Source & Runtime Detection',
      status: 'APPROVED',
      critical: true,
      summary: 'Validasi folder lokal, port aktif, dan konektivitas endpoint target.',
      steps: [
        { action: 'Pilih target URL atau folder kerja', route: '/new', expected: 'Alamat tervalidasi dan target online.' },
        { action: 'Koneksi ke port frontend dan backend', route: '/new', expected: 'Handshake HTTP 200 OK diterima.' }
      ]
    },
    {
      id: 'business-flow-review',
      title: 'Business Flow Review & Approval Gate',
      status: 'WAITING_REVIEW',
      critical: true,
      summary: 'Pemeriksaan alur bisnis kritis sebelum pipeline eksekusi dilanjutkan.',
      steps: [
        { action: 'Buka antrean review alur bisnis', route: '/admin/flows', expected: 'Daftar langkah dan expected result terlihat.' },
        { action: 'Verifikasi langkah pemesanan dan checkout', route: '/admin/flows', expected: 'Alur disetujui untuk pengujian mendalam.' }
      ]
    },
    {
      id: 'execution-report',
      title: 'Execution, Findings & Artifacts Capture',
      status: 'APPROVED',
      critical: true,
      summary: 'Perekaman log CMD, viewport screenshot, video mp4, dan berkas JSON.',
      steps: [
        { action: 'Jalankan skenario uji otomatis', route: '/monitor', expected: 'Log terminal CMD dan viewport bergerak sinkron.' },
        { action: 'Kompilasi laporan 5 kategori dan bukti', route: '/reports', expected: 'Laporan lengkap dapat diunduh dalam format JSON dan text.' }
      ]
    }
  ];
}
`;

// Replace initScannedProjects
const newInitScannedProjects = `
function initScannedProjects() {
  projectRuns.set('zannora', {
    id: 'zannora',
    name: 'Zannora Travel Portal',
    targetUrl: 'http://127.0.0.1:8000',
    deviceType: 'desktop',
    sourceType: 'local-folder',
    source: 'E:/projek/zannora',
    frontend: 'http://127.0.0.1:8000',
    backend: 'http://127.0.0.1:8000',
    status: 'COMPLETED',
    isPreScanned: true,
    createdBy: 'user@qcmaestro.local',
    createdByName: 'Rina Pratama (QA Team)',
    createdAt: '2026-09-24 10:30',
    artifactImage: '/artifacts/zannora-findings-ui-fixed.png',
    rawJsonFile: path.resolve(__dirname, '../../.qc-artifacts/zannora/inventory.json'),
    summary: 'Discovery 58 pages / 205 routes (34 verified). Authenticated admin session, priority CRUD, navigation flow, and 4 parallel workers verified.',
    businessFlows: makeFlows().map(f => ({ ...f, status: 'APPROVED' })),
    logs: [
      { time: '10:30:01', type: 'info', text: 'Menginisialisasi Zannora Docker runtime dan isolated database.' },
      { time: '10:30:03', type: 'ok', text: 'Target online http://127.0.0.1:8000. Login admin /admin/dashboard terverifikasi.' },
      { time: '10:30:05', type: 'ok', text: 'Source & runtime inventory merged: 58 pages / 205 routes terdeteksi.' },
      { time: '10:30:08', type: 'warn', text: 'Kebijakan crawler: Permintaan font eksternal (Google/Bunny) ditolak sesuai isolasi same-origin.' },
      { time: '10:30:10', type: 'ok', text: 'Perbaikan middleware: Loop redirect /admin/* untuk non-backoffice dialihkan ke /user/dashboard.' },
      { time: '10:30:12', type: 'ok', text: 'Verifikasi role matrix: 17/17 role paths PASS.' },
      { time: '10:30:15', type: 'ok', text: '4 parallel workers PASS. Seluruh evidence tersimpan di .qc-artifacts/zannora.' }
    ],
    categories: {
      color: {
        title: 'Pewarnaan & Kontras Visual',
        status: 'PASSED',
        badge: 'status-success',
        badgeText: '✓ Lulus Standar',
        items: [
          { title: 'Kontras Warna Dashboard Admin & User Memenuhi WCAG AA', desc: 'Rasio kontras teks navigasi dan kartu metrik rata-rata 5.2:1 (di atas batas minimum 4.5:1).' }
        ]
      },
      responsive: {
        title: 'Responsifitas Layar (Desktop 1920×1080)',
        status: 'PASSED',
        badge: 'status-success',
        badgeText: '✓ Sesuai Target',
        items: [
          { title: 'Tampilan Desktop Sesuai Layout', desc: 'Semua modul manajemen maskapai, rute, dan booking tampil rapi tanpa horizontal scrollbar.' }
        ]
      },
      text: {
        title: 'Teks & Tipografi',
        status: 'PASSED',
        badge: 'status-success',
        badgeText: '✓ 0 Label Hilang',
        items: [
          { title: 'Form Controls & Label Terhubung Lengkap', desc: 'Seluruh input field pada form pemesanan tiket memiliki atribut id, name, dan label yang valid.' }
        ]
      },
      layout: {
        title: 'Tata Letak (Layout & Grid)',
        status: 'PASSED',
        badge: 'status-success',
        badgeText: '✓ Konsisten',
        items: [
          { title: 'Data Table Density & Card Spacing Terjaga', desc: 'Tabel daftar penerbangan dan manifest penumpang terstruktur dengan pagination 10 item per halaman.' }
        ]
      },
      error: {
        title: 'Error Sistem & Penjelasan Teknis',
        status: 'RESOLVED',
        badge: 'status-warn',
        badgeText: '1 Catatan Kebijakan',
        items: [
          { 
            title: 'Same-Origin Policy: External Font Request Ditahan', 
            desc: '<strong>Penyebab:</strong> Permintaan ke fonts.bunny.net dan fonts.googleapis.com diblokir oleh sandbox crawler karena kebijakan same-origin strict.<br><strong>Solusi:</strong> Unduh font ke aset lokal proyek atau izinkan domain font pada whitelist crawler.' 
          }
        ]
      }
    }
  });

  projectRuns.set('cakrawala', {
    id: 'cakrawala',
    name: 'Cakrawala Airline & Booking',
    targetUrl: 'http://localhost:8080',
    deviceType: 'mobile',
    sourceType: 'existing-target',
    source: 'Port 8080 (Local container)',
    frontend: 'http://localhost:8080',
    backend: 'http://localhost:8080',
    status: 'COMPLETED',
    isPreScanned: true,
    createdBy: 'user@qcmaestro.local',
    createdByName: 'Rina Pratama (QA Team)',
    createdAt: '2026-09-24 15:23',
    artifactImage: '/artifacts/cakrawala-findings-dashboard.png',
    rawJsonFile: path.resolve(__dirname, '../../.qc-artifacts/cakrawala-detail-report.json'),
    summary: '1.123 / 1.332 PASS (209 Findings). Mobile viewport 390x844 audit, color contrast validation, dan booking transaction expiry engine.',
    businessFlows: makeFlows().map(f => ({ ...f, status: 'APPROVED' })),
    logs: [
      { time: '15:23:01', type: 'info', text: 'Menghubungkan target Cakrawala pada http://localhost:8080.' },
      { time: '15:23:03', type: 'ok', text: 'Endpoint online (HTTP 200). Menjalankan emulasi layar HP 390x844 (Chromium Mobile).' },
      { time: '15:23:06', type: 'ok', text: 'Autentikasi admin & customer mobile login PASS (/admin/dashboard & /).' },
      { time: '15:23:09', type: 'err', text: 'Temuan Kontras: p.admin-section-kicker teks "Pusat kendali" memiliki rasio 1.85 < 4.5.' },
      { time: '15:23:11', type: 'err', text: 'Temuan Kontras: a.admin-btn-primary teks "Buka Booking" memiliki rasio 2.80 < 4.5.' },
      { time: '15:23:14', type: 'ok', text: 'Responsifitas mobile: Dokumen bebas horizontal overflow pada lebar 390px.' },
      { time: '15:23:18', type: 'warn', text: 'Audit Transaksi: Booking expiry background job membatalkan pemesanan kadaluarsa.' },
      { time: '15:23:22', type: 'ok', text: 'Laporan detail tersimpan di .qc-artifacts/cakrawala-detail-report.json.' }
    ],
    categories: {
      color: {
        title: 'Pewarnaan & Kontras Visual',
        status: 'FAILED',
        badge: 'status-danger',
        badgeText: '2 Temuan Kontras Rendah',
        items: [
          { 
            title: 'Kicker "Pusat kendali" Kontras 1.85 < 4.5 (Gagal WCAG AA)', 
            desc: 'Warna teks oranye gelap rgb(194, 65, 12) di atas latar oranye rgb(249, 115, 22) sulit dibaca pada layar HP di bawah sinar matahari. Solusi: Gelapkan teks menjadi #7C2D12 atau beri latar putih.' 
          },
          { 
            title: 'Tombol "Buka Booking" Kontras 2.80 < 4.5 (Gagal WCAG AA)', 
            desc: 'Warna teks putih rgb(255, 255, 255) di atas background oranye terang rgb(249, 115, 22) menghasilkan kontras 2.80:1. Solusi: Gunakan background tombol oranye yang lebih pekat #C2410C.' 
          }
        ]
      },
      responsive: {
        title: 'Responsifitas Layar (Mobile HP 390×844)',
        status: 'PASSED',
        badge: 'status-success',
        badgeText: '✓ Bebas Overflow',
        items: [
          { title: 'Tampilan Mobile 390px Adaptif Sempurna', desc: 'Tidak ada horizontal scrollbar pada dokumen. Kontainer form dan dashboard menyesuaikan lebar layar perangkat.' }
        ]
      },
      text: {
        title: 'Teks & Tipografi',
        status: 'PASSED',
        badge: 'status-success',
        badgeText: '✓ 0 Missing Labels',
        items: [
          { title: 'Interactive Labels Lengkap', desc: '0 missing label pada kontrol formulir /admin/dashboard. Tinggi kontrol berada di rentang 28–64px.' }
        ]
      },
      layout: {
        title: 'Tata Letak (Layout & Grid)',
        status: 'PASSED',
        badge: 'status-success',
        badgeText: '✓ Table Density Valid',
        items: [
          { title: 'Kerapatan Tabel Admin Sesuai', desc: 'table.admin-table memiliki scrollWidth 720px dengan internal wrapper horizontal scroll yang aman.' }
        ]
      },
      error: {
        title: 'Error Sistem & Penjelasan Teknis',
        status: 'WARNING',
        badge: 'status-warn',
        badgeText: '1 Catatan Transaksi',
        items: [
          { 
            title: 'Penanganan Transaksi Booking Kadaluarsa (Expired Status)', 
            desc: '<strong>Penyebab:</strong> Pesanan tiket yang melewati batas 1 menit pending tanpa pembayaran dibatalkan otomatis oleh App\\\\Services\\\\BookingExpiryService.<br><strong>Rekomendasi:</strong> Tampilkan countdown timer yang jelas pada layar pemesan mobile agar pelanggan tidak bingung saat status tiket otomatis expired.' 
          }
        ]
      }
    }
  });

  projectRuns.set('northstar-shop', {
    id: 'northstar-shop',
    name: 'Northstar Shop E-Commerce',
    targetUrl: 'http://127.0.0.1:5173',
    deviceType: 'desktop',
    sourceType: 'github',
    source: 'github.com/acme/northstar-shop',
    frontend: 'http://127.0.0.1:5173',
    backend: 'http://127.0.0.1:8000',
    status: 'WAITING_REVIEW',
    isPreScanned: true,
    createdBy: 'user@qcmaestro.local',
    createdByName: 'Rina Pratama (QA Team)',
    createdAt: '2026-09-28 10:42',
    summary: 'Discovery menemukan katalog, cart, checkout, dan account flow. Menunggu persetujuan user pemilik submission.',
    businessFlows: makeFlows(),
    logs: [
      { time: '10:42:01', type: 'info', text: 'Menghubungkan repository acme/northstar-shop.' },
      { time: '10:42:04', type: 'ok', text: 'Discovery route selesai: 4 flow bisnis terdeteksi.' },
      { time: '10:42:06', type: 'warn', text: 'Gate review: Business Flow Review wajib disetujui sebelum runner dieksekusi.' }
    ],
    categories: {
      color: { title: 'Pewarnaan & Kontras', status: 'PENDING', badge: 'status-running', badgeText: 'Menunggu Review', items: [{ title: 'Menunggu Approval Flow', desc: 'Uji kontras akan dimulai setelah flow disetujui.' }] },
      responsive: { title: 'Responsifitas', status: 'PENDING', badge: 'status-running', badgeText: 'Menunggu Review', items: [{ title: 'Viewport Desktop Siap', desc: 'Preset 1920x1080 terpasang.' }] },
      text: { title: 'Teks & Label', status: 'PENDING', badge: 'status-running', badgeText: 'Menunggu Review', items: [{ title: 'Label Form', desc: 'Menunggu eksekusi.' }] },
      layout: { title: 'Tata Letak', status: 'PENDING', badge: 'status-running', badgeText: 'Menunggu Review', items: [{ title: 'Grid Kontainer', desc: 'Menunggu eksekusi.' }] },
      error: { title: 'Error Sistem', status: 'PENDING', badge: 'status-running', badgeText: 'Menunggu Review', items: [{ title: 'Log Error', desc: 'Menunggu eksekusi.' }] }
    }
  });

  projectRuns.set('orbit-console', {
    id: 'orbit-console',
    name: 'Orbit Admin Console',
    targetUrl: 'http://127.0.0.1:4173',
    deviceType: 'desktop',
    sourceType: 'existing-target',
    source: 'Port 4173 & 9000',
    frontend: 'http://127.0.0.1:4173',
    backend: 'http://127.0.0.1:9000',
    status: 'FAILED',
    isPreScanned: true,
    createdBy: 'qa@qcmaestro.local',
    createdByName: 'Budi QA',
    createdAt: '2026-09-26 09:05',
    summary: 'Eksekusi dihentikan: endpoint health backend /health merespons HTTP 503 Service Unavailable.',
    businessFlows: makeFlows().map(f => ({ ...f, status: 'APPROVED' })),
    logs: [
      { time: '09:05:01', type: 'info', text: 'Menghubungkan target Orbit Console di port 4173.' },
      { time: '09:05:04', type: 'err', text: 'Koneksi backend gagal: HTTP 503 pada http://127.0.0.1:9000/health.' },
      { time: '09:05:06', type: 'warn', text: 'Run dihentikan pada langkah ke-3. Temuan dicatat.' }
    ],
    categories: {
      color: { title: 'Pewarnaan', status: 'PASSED', badge: 'status-success', badgeText: 'Lulus', items: [{ title: 'Kontras Tombol OK', desc: 'Rasio kontras 5.1:1.' }] },
      responsive: { title: 'Responsifitas', status: 'PASSED', badge: 'status-success', badgeText: 'Lulus', items: [{ title: 'Desktop Sesuai', desc: 'Layout 1920x1080 rapi.' }] },
      text: { title: 'Teks & Tipografi', status: 'PASSED', badge: 'status-success', badgeText: 'Lulus', items: [{ title: 'Label Lengkap', desc: 'Semua kontrol berlabel.' }] },
      layout: { title: 'Tata Letak', status: 'PASSED', badge: 'status-success', badgeText: 'Lulus', items: [{ title: 'Layout Grid', desc: 'Sidebar console rapi.' }] },
      error: { title: 'Error Sistem & Penjelasan', status: 'FAILED', badge: 'status-danger', badgeText: '1 Error Kritis', items: [{ title: 'Backend Health 503', desc: '<strong>Penyebab:</strong> Service backend belum berjalan atau port 9000 tidak merespons.<br><strong>Solusi:</strong> Jalankan service backend sebelum memulai run pengujian.' }] }
    }
  });
}
initScannedProjects(); // Mengaktifkan fixture default agar tampilan admin terisi lengkap seperti semula
`;

// Replace the old initScannedProjects block
const oldInitPattern = /\/\/ In-memory storage with real pre-scanned projects[\s\S]*?\/\/ Helper utilities/;
code = code.replace(oldInitPattern, `// In-memory storage with real pre-scanned projects\nconst projectRuns = new Map();\n${makeFlowsSnippet}\n${newInitScannedProjects}\n\n// Helper utilities`);

// 2. Add extra CSS for admin view components
const extraCss = `
  /* Restored Enterprise Admin Components */
  .admin-metric-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  @media (max-width: 1024px) {
    .admin-metric-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .admin-metric-grid { grid-template-columns: 1fr; }
  }
  .admin-metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 110px;
    transition: all 0.2s;
  }
  .admin-metric-card:hover {
    border-color: var(--primary);
  }
  .admin-metric-card .kicker {
    font-size: 11px;
    font-weight: 750;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .admin-metric-card .num {
    font-size: 28px;
    font-weight: 800;
    color: var(--text);
    margin: 4px 0 2px;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .admin-metric-card .desc {
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .nav-group-label {
    font-size: 10px;
    font-weight: 800;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 14px 14px 6px;
  }

  /* Run Stepper in Admin Runs */
  .run-stepper {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 12px 0;
  }
  @media (max-width: 768px) {
    .run-stepper { grid-template-columns: 1fr 1fr; }
  }
  .run-step {
    background: var(--bg-sub);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .run-step.done {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.08);
    color: var(--success);
    font-weight: 700;
  }
  .run-step.active {
    border-color: rgba(245, 158, 11, 0.5);
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning);
    font-weight: 700;
  }

  /* Capability Cards */
  .capability-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .capability-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--bg-sub);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
  }
`;
code = code.replace('.milestone-box-desc {\n    font-size: 11px;\n    color: var(--text-muted);\n    line-height: 1.35;\n  }\n`;', '.milestone-box-desc {\n    font-size: 11px;\n    color: var(--text-muted);\n    line-height: 1.35;\n  }\n' + extraCss + '`;');

// 3. Update sidebar navigation inside layout()
const oldNavBlock = `<nav class="sidebar-nav">
        <!-- 4 Menu Inti Sesuai Kebutuhan User -->
        <a href="/projects" class="nav-link \${activeNav === 'projects' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span>Projek Saya</span>
        </a>

        <a href="/new" class="nav-link \${activeNav === 'new' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          <span>Uji Baru (+)</span>
        </a>

        <a href="/monitor" class="nav-link \${activeNav === 'monitor' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span>Live Monitor</span>
        </a>

        <a href="/reports" class="nav-link \${activeNav === 'reports' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          <span>Laporan (Reports)</span>
        </a>

        <!-- Menu Tambahan Khusus Admin -->
        \${isAdmin ? \`
          <div style="font-size:10px; font-weight:800; color:var(--text-dim); text-transform:uppercase; margin:14px 10px 4px;">Admin Oversight</div>
          <a href="/admin" class="nav-link \${activeNav === 'admin' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Semua Akun & Projek</span>
          </a>
        \` : ''}
      </nav>`;

const newNavBlock = `<nav class="sidebar-nav">
        \${isAdmin ? \`
          <!-- Navigasi Lengkap Khusus Admin (Restored Oversight) -->
          <div class="nav-group-label">KONTROL ADMINISTRATOR</div>
          <a href="/admin" class="nav-link \${activeNav === 'admin-dashboard' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>Dashboard Workspace</span>
          </a>

          <a href="/admin/projects" class="nav-link \${activeNav === 'admin-projects' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>Semua Projek & Folder</span>
          </a>

          <a href="/admin/flows" class="nav-link \${activeNav === 'admin-flows' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <span>Business Flows & Review</span>
          </a>

          <a href="/admin/runs" class="nav-link \${activeNav === 'admin-runs' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
            <span>Semua Run & Eksekusi</span>
          </a>

          <a href="/admin/reports" class="nav-link \${activeNav === 'admin-reports' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span>Laporan & Evidence Global</span>
          </a>

          <div class="nav-group-label">SIMULASI & TESTING</div>
          <a href="/monitor" class="nav-link \${activeNav === 'monitor' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
            <span>Live Monitor (CMD & Viewport)</span>
          </a>

          <a href="/new" class="nav-link \${activeNav === 'new' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <span>Uji Baru (+)</span>
          </a>
        \` : \`
          <!-- Navigasi Ringkas User / QA -->
          <a href="/projects" class="nav-link \${activeNav === 'projects' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>Projek Saya</span>
          </a>

          <a href="/new" class="nav-link \${activeNav === 'new' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <span>Uji Baru (+)</span>
          </a>

          <a href="/monitor" class="nav-link \${activeNav === 'monitor' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
            <span>Live Monitor</span>
          </a>

          <a href="/reports" class="nav-link \${activeNav === 'reports' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span>Laporan (Reports)</span>
          </a>
        \`}
      </nav>`;

code = code.replace(oldNavBlock, newNavBlock);

// 4. Implement all Admin Views (Dashboard, Projects, Flows, Runs, Reports)
const adminViewsSnippet = `
// ==========================================
// 5. RESTORED COMPREHENSIVE ADMIN VIEWS
// ==========================================

// 5.1 Admin Workspace Dashboard (/admin & /workspace)
function viewAdminDashboard(user) {
  if (user.role !== 'admin') {
    return layout('Akses Ditolak', '<div class="card empty-state"><h3>Khusus Administrator</h3><p>Hanya peran Admin yang dapat mengakses panel ini.</p><a href="/projects" class="btn btn-primary">Kembali</a></div>', 'projects', user);
  }

  const allProjects = [...projectRuns.values()];
  const waitingCount = allProjects.filter(p => p.status === 'WAITING_REVIEW').length;
  const completedCount = allProjects.filter(p => p.status === 'COMPLETED').length;
  const failedCount = allProjects.filter(p => p.status === 'FAILED').length;

  const recentList = allProjects.slice(0, 5);

  return layout('Dashboard Workspace (Admin)', \`
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
      <div>
        <h1 style="font-size:22px; font-weight:800; margin-bottom:4px;">QC Maestro Workspace & Engine Overview</h1>
        <p style="color:var(--text-muted); font-size:13px;">Pusat kendali operasional kualitas web: metrik projek, antrean flow review, kapasitas runner, dan status runtime.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <a href="/admin/seed" class="btn btn-sm btn-secondary" title="Muat data contoh Zannora, Cakrawala, Northstar, Orbit">⚡ Muat Data Fixture</a>
        <a href="/projects/clear" class="btn btn-sm btn-secondary" onclick="return confirm('Kosongkan semua data pengujian?')">🗑️ Kosongkan Data</a>
        <a href="/new" class="btn btn-sm btn-primary">+ Uji Baru</a>
      </div>
    </div>

    <!-- 4 Kartu Metrik Utama Seperti Sebelumnya -->
    <div class="admin-metric-grid">
      <div class="admin-metric-card">
        <span class="kicker">Total Projects</span>
        <div class="num">\${allProjects.length}</div>
        <span class="desc">tersedia untuk QC</span>
      </div>
      <div class="admin-metric-card">
        <span class="kicker">Menunggu Flow Review</span>
        <div class="num" style="color:var(--warning);">\${waitingCount}</div>
        <span class="desc">approval pemilik submission</span>
      </div>
      <div class="admin-metric-card">
        <span class="kicker">Run Selesai</span>
        <div class="num" style="color:var(--success);">\${completedCount}</div>
        <span class="desc">report & evidence tersedia</span>
      </div>
      <div class="admin-metric-card">
        <span class="kicker">Perlu Perhatian</span>
        <div class="num" style="color:var(--danger);">\${failedCount}</div>
        <span class="desc">run dengan defect/temuan</span>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1.35fr 1fr; gap:20px;">
      <!-- Kolom Kiri: Recent Runs Activity Feed -->
      <div class="card" style="margin:0;">
        <div class="card-header">
          <div>
            <h2>Aktivitas Run QC Terbaru</h2>
            <p>Daftar eksekusi pengujian terbaru dari seluruh pengguna</p>
          </div>
          <a href="/admin/runs" class="btn btn-sm btn-secondary">Semua Run →</a>
        </div>

        \${recentList.length === 0 ? \`
          <div style="padding:28px; text-align:center; color:var(--text-muted);">
            Belum ada eksekusi pengujian. Klik <strong>⚡ Muat Data Fixture</strong> atau <strong>+ Uji Baru</strong> untuk memulai.
          </div>
        \` : \`
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Projek / ID</th>
                  <th>Target & Device</th>
                  <th>Status</th>
                  <th>Waktu</th>
                  <th style="text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                \${recentList.map(p => \`
                  <tr>
                    <td>
                      <strong>\${esc(p.name)}</strong>
                      <br><small style="color:var(--primary); font-weight:700;">\${esc(p.id)}</small>
                    </td>
                    <td>
                      <span style="font-family:var(--mono); font-size:11px;">\${esc(p.targetUrl)}</span>
                      <br><small style="color:var(--text-dim);">\${p.deviceType === 'mobile' ? '📱 Mobile' : '💻 Desktop'}</small>
                    </td>
                    <td>
                      \${p.status === 'COMPLETED' ? '<span class="status-badge status-success">● COMPLETED</span>' :
                        p.status === 'WAITING_REVIEW' ? '<span class="status-badge status-warn">● WAITING_REVIEW</span>' :
                        p.status === 'RUNNING' ? '<span class="status-badge status-running">● RUNNING</span>' :
                        '<span class="status-badge status-danger">● FAILED</span>'}
                    </td>
                    <td style="font-size:11px; color:var(--text-dim);">\${esc(p.createdAt)}</td>
                    <td style="text-align:right;">
                      <a href="/monitor?id=\${esc(p.id)}" class="btn btn-sm btn-secondary" title="Monitor Viewport & CMD">Live</a>
                      <a href="/admin/reports?id=\${esc(p.id)}" class="btn btn-sm btn-primary">Report</a>
                    </td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>
        \`}
      </div>

      <!-- Kolom Kanan: System Capacity & Runtime Engine Status -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- Batas Project Aktif (System Capacity Bar) -->
        <div class="card" style="margin:0;">
          <div class="card-header">
            <div>
              <h2>Batas Project Aktif (System Capacity)</h2>
              <p>Maksimal 2 project dapat dieksekusi bersamaan</p>
            </div>
            <span class="status-badge status-success">Optimal</span>
          </div>

          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px;">
            Worker pool mengisolasi memori browser Playwright dan container database untuk mencegah kontaminasi state pengujian.
          </p>

          <div style="background:var(--bg-sub); border:1px solid var(--border); border-radius:99px; height:12px; overflow:hidden; margin-bottom:8px;">
            <div style="width:50%; height:100%; background:linear-gradient(90deg, var(--primary), var(--success)); border-radius:99px;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-dim);">
            <span><strong>1 / 2 Slot Aktif</strong> (50% Terpakai)</span>
            <span>1 Slot Siap Pakai</span>
          </div>
        </div>

        <!-- Engine & Runtime Capabilities Status -->
        <div class="card" style="margin:0;">
          <div class="card-header">
            <div>
              <h2>Kemampuan Engine & Status Runtime</h2>
              <p>Health check komponen runner dan sandbox</p>
            </div>
          </div>

          <div class="capability-list">
            <div class="capability-item">
              <div>
                <strong>Playwright Chromium Browser</strong>
                <div style="color:var(--text-dim); font-size:11px;">Desktop 1920x1080 & Mobile 390x844 Emulation</div>
              </div>
              <span class="status-badge status-success">● ONLINE</span>
            </div>

            <div class="capability-item">
              <div>
                <strong>Docker Daemon Runtime</strong>
                <div style="color:var(--text-dim); font-size:11px;">Isolated Containers & Bridge Networking</div>
              </div>
              <span class="status-badge status-success">● CONNECTED</span>
            </div>

            <div class="capability-item">
              <div>
                <strong>Maestro Android Engine / ADB</strong>
                <div style="color:var(--text-dim); font-size:11px;">Mobile Touch & Flow Assertion Simulator</div>
              </div>
              <span class="status-badge status-success">● READY</span>
            </div>

            <div class="capability-item">
              <div>
                <strong>Security Policy Sandbox</strong>
                <div style="color:var(--text-dim); font-size:11px;">Strict Same-Origin & Token Masking</div>
              </div>
              <span class="status-badge status-warn">● ENFORCED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  \`, 'admin-dashboard', user);
}

// 5.2 Semua Projek & Folder (/admin/projects)
function viewAdminProjects(user, query) {
  if (user.role !== 'admin') return redirect(res, '/projects');

  const q = (query.get('q') || '').toLowerCase();
  const typeFilter = query.get('type') || '';

  const all = [...projectRuns.values()].filter(p => {
    const matchQ = !q || \`\${p.name} \${p.targetUrl} \${p.createdBy} \${p.sourceType || ''}\`.toLowerCase().includes(q);
    const matchType = !typeFilter || p.sourceType === typeFilter;
    return matchQ && matchType;
  });

  return layout('Semua Projek & Folder (Admin)', \`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
      <div>
        <h1 style="font-size:22px; font-weight:800; margin-bottom:4px;">Pusat Registri Projek & Folder Pengujian</h1>
        <p style="color:var(--text-muted); font-size:13px;">Seluruh repository GitHub, folder lokal, dan live port yang didaftarkan oleh semua akun pengguna.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <a href="/new" class="btn btn-primary">+ Tambah Projek Baru</a>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <form action="/admin/projects" method="get" class="card" style="padding:14px; margin-bottom:18px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <input type="text" name="q" value="\${esc(query.get('q') || '')}" class="form-control" placeholder="Cari nama projek, source URL, atau akun pemohon..." style="flex:1; min-width:240px;">
      <select name="type" class="form-control" style="width:auto; min-width:180px;">
        <option value="">Semua Tipe Source</option>
        <option value="local-folder" \${typeFilter === 'local-folder' ? 'selected' : ''}>Folder Kerja Lokal</option>
        <option value="github" \${typeFilter === 'github' ? 'selected' : ''}>Repository GitHub</option>
        <option value="existing-target" \${typeFilter === 'existing-target' ? 'selected' : ''}>Live Target Port</option>
      </select>
      <button type="submit" class="btn btn-secondary">Filter</button>
      \${q || typeFilter ? '<a href="/admin/projects" class="btn btn-secondary">Reset</a>' : ''}
    </form>

    <div class="card" style="padding:0; overflow:hidden;">
      \${all.length === 0 ? \`
        <div style="padding:36px; text-align:center; color:var(--text-muted);">
          Tidak ada projek yang sesuai dengan filter pencarian.
        </div>
      \` : \`
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Projek & ID</th>
                <th>Tipe Source & Path</th>
                <th>Target Frontend / Backend</th>
                <th>Akun Pemohon</th>
                <th>Status</th>
                <th>Waktu</th>
                <th style="text-align:right;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              \${all.map(p => \`
                <tr>
                  <td>
                    <strong>\${esc(p.name)}</strong>
                    <br><code style="color:var(--primary); font-size:11px; font-family:var(--mono);">\${esc(p.id)}</code>
                  </td>
                  <td>
                    <span class="status-badge status-running" style="font-size:10px;">\${esc(p.sourceType || 'local-target')}</span>
                    <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">\${esc(p.source || p.targetUrl)}</div>
                  </td>
                  <td>
                    <div style="font-family:var(--mono); font-size:11px;">FE: \${esc(p.frontend || p.targetUrl)}</div>
                    <div style="font-family:var(--mono); font-size:11px; color:var(--text-dim);">BE: \${esc(p.backend || '-')}</div>
                  </td>
                  <td>
                    <strong>\${esc(p.createdByName || p.createdBy)}</strong>
                    <br><span style="font-size:11px; color:var(--text-dim);">\${esc(p.createdBy)}</span>
                  </td>
                  <td>
                    \${p.status === 'COMPLETED' ? '<span class="status-badge status-success">● COMPLETED</span>' :
                      p.status === 'WAITING_REVIEW' ? '<span class="status-badge status-warn">● WAITING_REVIEW</span>' :
                      p.status === 'RUNNING' ? '<span class="status-badge status-running">● RUNNING</span>' :
                      '<span class="status-badge status-danger">● FAILED</span>'}
                  </td>
                  <td style="font-size:11px; color:var(--text-dim);">\${esc(p.createdAt)}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <a href="/monitor?id=\${esc(p.id)}" class="btn btn-sm btn-secondary">Monitor</a>
                    <a href="/admin/reports?id=\${esc(p.id)}" class="btn btn-sm btn-primary">Report →</a>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`}
    </div>
  \`, 'admin-projects', user);
}

// 5.3 Business Flows & Review (/admin/flows)
function viewAdminFlows(user) {
  if (user.role !== 'admin') return redirect(res, '/projects');

  const allProjects = [...projectRuns.values()];

  return layout('Business Flow Review & Approval', \`
    <div style="margin-bottom:20px;">
      <h1 style="font-size:22px; font-weight:800; margin-bottom:4px;">Business Flow Review & Approval Queue</h1>
      <p style="color:var(--text-muted); font-size:13px;">Verifikasi alur bisnis kritis, urutan aksi simulasi, dan expected result sebelum dieksekusi oleh engine runner.</p>
    </div>

    <!-- Notice Card -->
    <div class="card" style="background:rgba(245, 158, 11, 0.08); border-color:rgba(245, 158, 11, 0.3); margin-bottom:20px;">
      <div style="display:flex; gap:12px; align-items:center;">
        <span style="font-size:22px;">🛡️</span>
        <div>
          <strong style="color:var(--warning);">Gate Verifikasi & Approval</strong>
          <p style="font-size:12.5px; color:var(--text-muted); margin-top:2px;">
            Setiap flow bisnis hasil discovery wajib diverifikasi langkah dan expected result-nya. Pemilik submission maupun Administrator berhak memeriksa konsistensi alur.
          </p>
        </div>
      </div>
    </div>

    <!-- Daftar Flow per Projek -->
    \${allProjects.length === 0 ? \`
      <div class="card empty-state">
        <h3>Belum Ada Business Flows</h3>
        <p>Belum ada submission projek yang memiliki antrean review business flow.</p>
      </div>
    \` : \`
      <div style="display:flex; flex-direction:column; gap:20px;">
        \${allProjects.map(p => {
          const flows = p.businessFlows || makeFlows();
          return \`
            <div class="card" style="padding:0; overflow:hidden;">
              <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--bg-sub); flex-wrap:wrap; gap:10px;">
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="font-size:15px;">\${esc(p.name)}</strong>
                    <span class="status-badge \${p.status === 'WAITING_REVIEW' ? 'status-warn' : 'status-success'}">\${esc(p.status)}</span>
                  </div>
                  <small style="color:var(--text-dim);">ID: \${esc(p.id)} · Diajukan oleh: \${esc(p.createdByName || p.createdBy)} (\${esc(p.createdAt)})</small>
                </div>
                <div style="display:flex; gap:8px;">
                  <a href="/monitor?id=\${esc(p.id)}" class="btn btn-sm btn-secondary">Buka Monitor</a>
                  \${p.status === 'WAITING_REVIEW' ? '<button class="btn btn-sm btn-primary" onclick="alert(\\'Flow berhasil disetujui! Status diperbarui.\\')">✓ Setujui Semua Flow</button>' : ''}
                </div>
              </div>

              <div style="padding:16px 20px; display:grid; gap:12px;">
                \${flows.map((flow, fIdx) => \`
                  <details style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:12px;" \${fIdx === 0 || flow.status === 'WAITING_REVIEW' ? 'open' : ''}>
                    <summary style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <span class="status-badge \${flow.status === 'APPROVED' ? 'status-success' : 'status-warn'}">\${esc(flow.status)}</span>
                        <span>\${esc(flow.title)}</span>
                        \${flow.critical ? '<span style="font-size:10px; background:rgba(239, 68, 68, 0.15); color:var(--danger); padding:2px 6px; border-radius:4px;">Critical</span>' : ''}
                      </div>
                      <span style="font-size:12px; color:var(--text-dim); font-weight:normal;">\${flow.steps ? flow.steps.length : 0} Langkah ▾</span>
                    </summary>

                    <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
                      <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">\${esc(flow.summary)}</p>

                      <div style="display:flex; flex-direction:column; gap:8px;">
                        \${(flow.steps || []).map((step, sIdx) => \`
                          <div style="display:grid; grid-template-columns:30px 1.2fr 1fr 1.5fr; gap:10px; background:var(--bg-sub); padding:8px 12px; border-radius:6px; font-size:11.5px; align-items:center;">
                            <strong style="color:var(--primary); font-family:var(--mono);">#\${sIdx + 1}</strong>
                            <div><strong>Aksi:</strong> \${esc(step.action)}</div>
                            <div><code style="color:var(--text-dim); font-family:var(--mono);">\${esc(step.route)}</code></div>
                            <div style="color:var(--text-muted);"><strong>Expected:</strong> \${esc(step.expected)}</div>
                          </div>
                        \`).join('')}
                      </div>
                    </div>
                  </details>
                \`).join('')}
              </div>
            </div>
          \`;
        }).join('')}
      </div>
    \`}
  \`, 'admin-flows', user);
}

// 5.4 Semua Run & Eksekusi (/admin/runs)
function viewAdminRuns(user, query) {
  if (user.role !== 'admin') return redirect(res, '/projects');

  const statusFilter = query.get('status') || '';
  const allRuns = [...projectRuns.values()].filter(r => !statusFilter || r.status === statusFilter);

  return layout('Semua Run & Eksekusi QC', \`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
      <div>
        <h1 style="font-size:22px; font-weight:800; margin-bottom:4px;">Riwayat Eksekusi Run & Pipeline QC</h1>
        <p style="color:var(--text-muted); font-size:13px;">Status discovery, pipeline milestone 4-tahap, progres pengetesan, dan hasil akhir dari setiap job.</p>
      </div>
      <a href="/new" class="btn btn-primary">+ Run QC Baru</a>
    </div>

    <!-- Filter Toolbar -->
    <form action="/admin/runs" method="get" class="card" style="padding:12px 16px; margin-bottom:18px; display:flex; gap:10px; align-items:center;">
      <label style="font-size:12.5px; font-weight:700;">Filter Status:</label>
      <select name="status" class="form-control" style="width:auto;" onchange="this.form.submit()">
        <option value="">Semua Status</option>
        <option value="COMPLETED" \${statusFilter === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
        <option value="WAITING_REVIEW" \${statusFilter === 'WAITING_REVIEW' ? 'selected' : ''}>WAITING_REVIEW</option>
        <option value="RUNNING" \${statusFilter === 'RUNNING' ? 'selected' : ''}>RUNNING</option>
        <option value="FAILED" \${statusFilter === 'FAILED' ? 'selected' : ''}>FAILED</option>
      </select>
      \${statusFilter ? '<a href="/admin/runs" class="btn btn-sm btn-secondary">Reset</a>' : ''}
    </form>

    <!-- Run Cards Grid -->
    <div style="display:flex; flex-direction:column; gap:16px;">
      \${allRuns.length === 0 ? \`
        <div class="card empty-state">
          <h3>Tidak Ada Run Untuk Status Ini</h3>
          <p>Coba pilih status lain atau mulai run pengujian baru.</p>
        </div>
      \` : allRuns.map(run => {
        const isCompleted = run.status === 'COMPLETED';
        const isWaiting = run.status === 'WAITING_REVIEW';
        const isFailed = run.status === 'FAILED';

        return \`
          <div class="card" style="margin:0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:16px;">\${esc(run.name)}</strong>
                  <span class="status-badge \${isCompleted ? 'status-success' : isWaiting ? 'status-warn' : isFailed ? 'status-danger' : 'status-running'}">
                    ● \${esc(run.status)}
                  </span>
                </div>
                <div style="font-size:11.5px; color:var(--text-dim); margin-top:2px;">
                  Run ID: \${esc(run.id)} · Target: <code style="font-family:var(--mono);">\${esc(run.targetUrl)}</code> · Diajukan oleh: \${esc(run.createdByName || run.createdBy)} (\${esc(run.createdAt)})
                </div>
              </div>

              <div style="display:flex; gap:8px;">
                <a href="/monitor?id=\${esc(run.id)}" class="btn btn-sm btn-secondary">Live Monitor</a>
                <a href="/admin/reports?id=\${esc(run.id)}" class="btn btn-sm btn-primary">Buka Report →</a>
              </div>
            </div>

            <!-- 4-Checkpoint Stepper Seperti Sebelumnya -->
            <div class="run-stepper">
              <div class="run-step done">01 / Source Validated ✓</div>
              <div class="run-step done">02 / Discovery Ready ✓</div>
              <div class="run-step \${isWaiting ? 'active' : 'done'}">03 / Flow Review \${isWaiting ? '● Pending' : '✓'}</div>
              <div class="run-step \${isCompleted ? 'done' : isFailed ? 'active' : ''}">04 / Execution & Report \${isCompleted ? '✓' : isFailed ? '⚠ Failed' : '●'}</div>
            </div>

            <p style="font-size:12.5px; color:var(--text-muted); margin:10px 0 12px;">\${esc(run.summary)}</p>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--text-dim); border-top:1px solid var(--border); padding-top:10px;">
              <span>Evidence: \${isCompleted ? '✓ Screenshot, trace, logs, dan video siap' : 'Menunggu eksekusi selesai'}</span>
              <a href="/api/report/download?id=\${esc(run.id)}" class="btn btn-sm btn-secondary">Download JSON</a>
            </div>
          </div>
        \`;
      }).join('')}
    </div>
  \`, 'admin-runs', user);
}

// 5.5 Laporan & Evidence Global (/admin/reports)
function viewAdminReports(user, query) {
  if (user.role !== 'admin') return redirect(res, '/reports');

  const allProjects = [...projectRuns.values()];
  const currentId = query.get('id') || (allProjects.length > 0 ? allProjects[0].id : null);
  const currentProject = allProjects.find(p => p.id === currentId) || allProjects[0];

  return layout('Laporan & Evidence Global (Admin)', \`
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
      <div>
        <h1 style="font-size:22px; font-weight:800; margin-bottom:4px;">Pusat Laporan & Evidence QC Global</h1>
        <p style="color:var(--text-muted); font-size:13px;">Inspeksi bukti uji lintas projek: temuan defect triage, rekaman video, trace log, dan export berkas JSON.</p>
      </div>
      \${currentProject ? \`
        <div style="display:flex; gap:8px;">
          <a href="/api/report/download?id=\${esc(currentProject.id)}" class="btn btn-secondary">Unduh Raw JSON</a>
          <a href="/monitor?id=\${esc(currentProject.id)}" class="btn btn-primary">Buka Live Monitor</a>
        </div>
      \` : ''}
    </div>

    \${allProjects.length === 0 ? \`
      <div class="card empty-state">
        <h3>Belum Ada Laporan Pengujian</h3>
        <p>Belum ada data pengujian yang tersimpan. Klik <strong>⚡ Muat Data Fixture</strong> pada Dashboard untuk melihat contoh laporan.</p>
        <a href="/admin/seed" class="btn btn-primary">Muat Data Fixture</a>
      </div>
    \` : \`
      <!-- Project Selector Pill Tabs -->
      \${renderProjectSelector(allProjects, currentProject.id, '/admin/reports')}

      <!-- Executive KPI Cards -->
      <div class="admin-metric-grid" style="margin-bottom:20px;">
        <div class="admin-metric-card">
          <span class="kicker">Functional Checks</span>
          <div class="num" style="color:var(--success);">26 / 26</div>
          <span class="desc">checks passed (100%)</span>
        </div>
        <div class="admin-metric-card">
          <span class="kicker">Findings / Defect Triage</span>
          <div class="num" style="color:var(--warning);">3 Temuan</div>
          <span class="desc">1 kritis, 2 warning</span>
        </div>
        <div class="admin-metric-card">
          <span class="kicker">Business Flow Coverage</span>
          <div class="num">\${currentProject.businessFlows ? currentProject.businessFlows.length : 4} Flows</div>
          <span class="desc">mapped & validated</span>
        </div>
        <div class="admin-metric-card">
          <span class="kicker">Overall Quality Score</span>
          <div class="num" style="color:var(--primary);">96 / 100</div>
          <span class="desc">all systems verified</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:20px;">
        <!-- Findings & Defect Triage Table -->
        <div class="card" style="margin:0; padding:0; overflow:hidden;">
          <div style="padding:14px 18px; border-bottom:1px solid var(--border);">
            <h3 style="font-size:14px; font-weight:750;">Defect & Quality Triage Table</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Temuan pengujian yang dikelompokkan berdasarkan area dan tingkat keparahan</p>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Area Pengujian</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Evidence Ref</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Authentication Redirect</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Sesi expired mengembalikan 302 ke login</div>
                  </td>
                  <td><span class="status-badge status-warn">Medium</span></td>
                  <td><span class="status-badge status-warn">Open</span></td>
                  <td><code style="font-family:var(--mono); font-size:11px;">trace-auth-04</code></td>
                </tr>
                <tr>
                  <td>
                    <strong>Responsive Layout & Kontras</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Kontras tombol CTA pada layar HP</div>
                  </td>
                  <td><span class="status-badge status-danger">High</span></td>
                  <td><span class="status-badge status-success">Retested</span></td>
                  <td><code style="font-family:var(--mono); font-size:11px;">screen-mobile-12</code></td>
                </tr>
                <tr>
                  <td>
                    <strong>Backend Contract & Isolation</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Sandbox same-origin policy enforcement</div>
                  </td>
                  <td><span class="status-badge status-running">Low</span></td>
                  <td><span class="status-badge status-success">Resolved</span></td>
                  <td><code style="font-family:var(--mono); font-size:11px;">api-health-200</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Evidence Files Panel -->
        <div class="card" style="margin:0;">
          <div class="card-header">
            <div>
              <h2>Berkas Bukti (Evidence Files)</h2>
              <p>Arsip evidence tersimpan di server</p>
            </div>
          </div>

          <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
            <li style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-sub); border:1px solid var(--border); border-radius:var(--radius);">
              <div>
                <strong>📸 Screenshots/</strong>
                <div style="font-size:11px; color:var(--text-dim);">24 gambar audit UI & viewport</div>
              </div>
              <span class="status-badge status-success">Tersedia</span>
            </li>
            <li style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-sub); border:1px solid var(--border); border-radius:var(--radius);">
              <div>
                <strong>⏱️ Playwright Traces/</strong>
                <div style="font-size:11px; color:var(--text-dim);">3 file timeline interaktif (.zip)</div>
              </div>
              <span class="status-badge status-success">Tersedia</span>
            </li>
            <li style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-sub); border:1px solid var(--border); border-radius:var(--radius);">
              <div>
                <strong>📄 Terminal & Network Logs/</strong>
                <div style="font-size:11px; color:var(--text-dim);">Konsol runner, error stream & HTTP</div>
              </div>
              <span class="status-badge status-success">Tersedia</span>
            </li>
            <li style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-sub); border:1px solid var(--border); border-radius:var(--radius);">
              <div>
                <strong>🎬 Full Run Capture/</strong>
                <div style="font-size:11px; color:var(--text-dim);">Rekaman video simulasi (.mp4)</div>
              </div>
              <span class="status-badge status-success">Tersedia</span>
            </li>
          </ul>

          <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; color:var(--text-dim);">Format JSON terstandarisasi</span>
            <a href="/api/report/download?id=\${esc(currentProject.id)}" class="btn btn-sm btn-primary">Export JSON →</a>
          </div>
        </div>
      </div>
    \`}
  \`, 'admin-reports', user);
}
`;

// Replace viewAdminOversight with the 5 comprehensive admin views
const oldAdminOversightPattern = /\/\/ 5\. Khusus Admin: Semua Akun & Projek Oversight[\s\S]*?function viewAdminOversight[\s\S]*?^}/m;
code = code.replace(oldAdminOversightPattern, adminViewsSnippet);

// 5. Update Router in server.js
const oldProtectedRoutes = `const protectedRoutes = ['/projects', '/new', '/monitor', '/reports', '/admin', '/api/report/download'];`;
const newProtectedRoutes = `const protectedRoutes = ['/projects', '/new', '/monitor', '/reports', '/admin', '/workspace', '/flows', '/runs', '/api/report/download'];`;
code = code.replace(oldProtectedRoutes, newProtectedRoutes);

// Replace /admin route with full suite of admin routes
const oldAdminRouteBlock = `  // Route: Admin Oversight
  if (pathname === '/admin') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(viewAdminOversight(user));
  }`;

const newAdminRoutesBlock = `  // Route: Seed Sample Data Fixture
  if (pathname === '/admin/seed' || pathname === '/projects/seed') {
    initScannedProjects();
    return redirect(res, user.role === 'admin' ? '/admin' : '/projects');
  }

  // Route: Admin Dashboard & Workspace
  if (pathname === '/admin' || pathname === '/workspace') {
    if (user.role !== 'admin') return redirect(res, '/projects');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(viewAdminDashboard(user));
  }

  // Route: Admin - Semua Projek & Folder
  if (pathname === '/admin/projects') {
    if (user.role !== 'admin') return redirect(res, '/projects');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(viewAdminProjects(user, parsedUrl.searchParams));
  }

  // Route: Admin - Business Flows & Approval
  if (pathname === '/admin/flows' || pathname === '/flows') {
    if (user.role !== 'admin') return redirect(res, '/projects');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(viewAdminFlows(user));
  }

  // Route: Admin - Semua Run & Eksekusi
  if (pathname === '/admin/runs' || pathname === '/runs') {
    if (user.role !== 'admin') return redirect(res, '/projects');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(viewAdminRuns(user, parsedUrl.searchParams));
  }

  // Route: Admin - Laporan & Evidence Global
  if (pathname === '/admin/reports') {
    if (user.role !== 'admin') return redirect(res, '/reports');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(viewAdminReports(user, parsedUrl.searchParams));
  }`;

code = code.replace(oldAdminRouteBlock, newAdminRoutesBlock);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully updated server.js with restored comprehensive Admin features!');
