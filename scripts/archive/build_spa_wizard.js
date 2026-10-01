const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../apps/unique-demo/server.js');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Add Wizard CSS styles
const wizardCss = `
  /* ================= SPA WIZARD STYLES ================= */
  .wizard-header-steps {
    display: flex;
    list-style: none;
    padding: 0;
    margin: 0 0 24px;
    gap: 12px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 16px;
  }
  @media (max-width: 640px) {
    .wizard-header-steps { flex-direction: column; gap: 8px; }
  }
  .wizard-step-tab {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    border-radius: var(--radius);
    background: var(--bg-sub);
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 650;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .wizard-step-tab:hover {
    border-color: var(--primary);
    color: var(--text);
  }
  .wizard-step-tab.active {
    background: var(--bg-card);
    border-color: var(--primary);
    color: var(--text);
    box-shadow: 0 0 0 1px var(--primary);
  }
  .wizard-step-tab.active .step-badge {
    background: var(--primary);
    color: #FFFFFF;
  }
  .wizard-step-tab.done .step-badge {
    background: var(--success);
    color: #FFFFFF;
  }
  .step-badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--border);
    color: var(--text-dim);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    font-family: var(--mono);
  }

  /* Choice Cards (Platform & Source) */
  .choice-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 18px;
  }
  @media (max-width: 768px) {
    .choice-grid { grid-template-columns: 1fr; }
  }
  .choice-card-item {
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    cursor: pointer;
    background: var(--bg-sub);
    transition: all 0.15s ease;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    text-align: left;
  }
  .choice-card-item:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }
  .choice-card-item.selected {
    border-color: var(--primary);
    background: var(--bg-card);
    box-shadow: 0 0 0 1px var(--primary);
  }
  .choice-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-main);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    font-size: 20px;
  }
  .choice-card-item.selected .choice-card-icon {
    background: rgba(2, 132, 199, 0.15);
  }
  .choice-card-content strong {
    display: block;
    font-size: 13.5px;
    font-weight: 750;
    margin-bottom: 2px;
    color: var(--text);
  }
  .choice-card-content p {
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* Backend Mode Pills */
  .backend-pill-group {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .backend-pill-btn {
    padding: 8px 14px;
    border-radius: 99px;
    background: var(--bg-sub);
    border: 1px solid var(--border);
    font-size: 12px;
    font-weight: 650;
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s ease;
  }
  .backend-pill-btn:hover {
    border-color: var(--primary);
    color: var(--text);
  }
  .backend-pill-btn.active {
    background: var(--primary);
    border-color: var(--primary);
    color: #FFFFFF;
    font-weight: 700;
  }

  /* URL Preset Buttons */
  .url-presets-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
  .preset-pill-btn {
    padding: 3px 9px;
    border-radius: 4px;
    background: var(--bg-sub);
    border: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .preset-pill-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  /* Accounts List */
  .account-row-item {
    background: var(--bg-sub);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    margin-bottom: 10px;
    display: grid;
    grid-template-columns: 28px 1.2fr 1fr 1fr 34px;
    gap: 10px;
    align-items: center;
  }
  @media (max-width: 768px) {
    .account-row-item { grid-template-columns: 1fr; }
  }
  .account-row-item .acc-num {
    font-size: 11px;
    font-weight: 800;
    font-family: var(--mono);
    color: var(--primary);
  }

  /* Review Summary Grid */
  .review-summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 18px 0;
  }
  @media (max-width: 768px) {
    .review-summary-grid { grid-template-columns: 1fr; }
  }
  .summary-item-box {
    background: var(--bg-sub);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
  }
  .summary-item-box .sum-kicker {
    font-size: 10.5px;
    font-weight: 750;
    text-transform: uppercase;
    color: var(--text-dim);
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .summary-item-box strong {
    font-size: 14px;
    display: block;
    color: var(--text);
  }
  .summary-item-box small {
    font-size: 11.5px;
    color: var(--text-muted);
  }
`;

// Insert wizardCss into css string
if (!code.includes('/* ================= SPA WIZARD STYLES ================= */')) {
  code = code.replace('.milestone-box-desc {\n    font-size: 11px;\n    color: var(--text-muted);\n    line-height: 1.35;\n  }\n', '.milestone-box-desc {\n    font-size: 11px;\n    color: var(--text-muted);\n    line-height: 1.35;\n  }\n' + wizardCss);
}

// 2. Build the SPA-Compliant 3-Step Wizard View
const spaWizardView = `// 2. Form Uji Baru View (SPA-Compliant 3-Step Wizard)
function viewNewTest(user) {
  return layout('Uji Baru (+)', \`
    <div style="max-width:820px; margin:0 auto;">
      <!-- Header Wizard -->
      <div style="margin-bottom:20px;">
        <h1 style="font-size:22px; font-weight:800; margin-bottom:4px;">Konfigurasi Pengujian Kualitas Website</h1>
        <p style="color:var(--text-muted); font-size:13px;">Ikuti 3 langkah terstandarisasi untuk menghubungkan target, mengatur kredensial login, dan mengonfigurasi pilar audit kualitas.</p>
      </div>

      <!-- 3-Step Stepper Progress Bar (Persis seperti di SPA wizard.tsx) -->
      <ul class="wizard-header-steps">
        <li class="wizard-step-tab active" id="stepTab0" onclick="goToStep(0)">
          <span class="step-badge">01</span>
          <span>Target &amp; Backend Service</span>
        </li>
        <li class="wizard-step-tab" id="stepTab1" onclick="goToStep(1)">
          <span class="step-badge">02</span>
          <span>Akun &amp; Data Uji</span>
        </li>
        <li class="wizard-step-tab" id="stepTab2" onclick="goToStep(2)">
          <span class="step-badge">03</span>
          <span>Review &amp; Jalankan</span>
        </li>
      </ul>

      <div class="card" style="padding:24px;">
        <form action="/new" method="post" id="wizardForm">
          <!-- Hidden Inputs for Step Tracking -->
          <input type="hidden" name="platform" id="inputPlatform" value="web">
          <input type="hidden" name="sourceType" id="inputSourceType" value="existing-target">
          <input type="hidden" name="deviceType" id="inputDeviceType" value="desktop">

          <!-- ================= STEP 0: TARGET & BACKEND SERVICE ================= -->
          <div id="stepSection0">
            <div style="margin-bottom:20px;">
              <span style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.06em;">LANGKAH 01 / 03</span>
              <h2 style="font-size:18px; margin:4px 0;">Target Aplikasi &amp; Backend Service</h2>
              <p style="font-size:12.5px; color:var(--text-muted);">Tentukan website target yang ingin diuji serta opsi backend API pendukung.</p>
            </div>

            <!-- Nama Project / Pengujian -->
            <div class="form-group">
              <label for="projectName">Nama Project / Pengujian</label>
              <input type="text" id="projectName" name="projectName" class="form-control" placeholder="Contoh: Zannora Travel Portal atau Northstar Web Shop" required value="Zannora Travel Portal">
              <div class="form-help">Beri nama pengenal untuk folder dan run pengujian ini.</div>
            </div>

            <!-- Platform Target Pengujian (Web vs Mobile App) -->
            <div class="form-group">
              <label>Platform Target Pengujian</label>
              <div class="choice-grid">
                <div class="choice-card-item selected" id="platWeb" onclick="selectPlatform('web')">
                  <div class="choice-card-icon">🌐</div>
                  <div class="choice-card-content">
                    <strong>Web Application / Portal</strong>
                    <p>Pengujian website responsif pada browser Chromium menggunakan Playwright engine.</p>
                  </div>
                </div>

                <div class="choice-card-item" id="platAndroid" onclick="selectPlatform('android')">
                  <div class="choice-card-icon">📱</div>
                  <div class="choice-card-content">
                    <strong>Mobile App (Flutter / Android APK)</strong>
                    <p>Pengujian aplikasi mobile native pada Emulator atau device fisik dengan Maestro engine.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- URL Website Target (Frontend) -->
            <div class="form-group">
              <label for="targetUrl">URL Website Target (Frontend)</label>
              <input type="text" id="targetUrl" name="targetUrl" class="form-control" placeholder="http://127.0.0.1:8000 atau https://app.example.com" required value="http://127.0.0.1:8000">
              <div class="form-help">URL yang dapat diakses oleh browser engine saat pengujian berlangsung.</div>
            </div>

            <!-- Koneksi Backend & API Service (3 Pilihan SPA: Live Port, Folder Lokal, GitHub) -->
            <div style="border-top:1px solid var(--border); padding-top:18px; margin-top:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div>
                  <strong style="font-size:14px;">Koneksi Backend &amp; Sumber Kode</strong>
                  <div style="font-size:11.5px; color:var(--text-muted);">Pilih bagaimana backend dan source code disediakan untuk runner.</div>
                </div>
                <span class="status-badge status-running" id="sourceBadge">Live Target Port</span>
              </div>

              <!-- 3 Mode Pills Sesuai SPA wizard.tsx -->
              <div class="backend-pill-group">
                <button type="button" class="backend-pill-btn active" id="btnModeExisting" onclick="selectSourceMode('existing-target')">
                  <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--success);"></span>
                  <span>Backend Sedang Berjalan (Existing API)</span>
                </button>

                <button type="button" class="backend-pill-btn" id="btnModeLocal" onclick="selectSourceMode('local-folder')">
                  <span>📁 Folder Kerja Lokal (Install Lokal)</span>
                </button>

                <button type="button" class="backend-pill-btn" id="btnModeGithub" onclick="selectSourceMode('github')">
                  <span>🐙 Clone dari GitHub</span>
                </button>
              </div>

              <!-- Dynamic Field: Folder Kerja Lokal -->
              <div class="form-group" id="groupLocalFolder" style="display:none;">
                <label for="localPath">Folder Kerja Lokal (Path Direktori)</label>
                <input type="text" id="localPath" name="localPath" class="form-control" placeholder="E:/projek/zannora atau D:/work/my-app" value="E:/projek/zannora">
                <div class="form-help">Path folder project di komputer ini untuk pemetaan source, route, dan dependency.</div>
              </div>

              <!-- Dynamic Field: GitHub Repository -->
              <div class="form-group" id="groupGithub" style="display:none;">
                <div style="display:grid; grid-template-columns:1.8fr 1fr; gap:12px;">
                  <div>
                    <label for="repositoryUrl">URL Repository GitHub</label>
                    <input type="text" id="repositoryUrl" name="repositoryUrl" class="form-control" placeholder="https://github.com/acme/zannora-web" value="https://github.com/acme/zannora-web">
                    <div class="form-help">Repository akan di-clone ke workspace QC sementara, folder kerja asli tetap utuh.</div>
                  </div>
                  <div>
                    <label for="branchRef">Branch / Ref</label>
                    <input type="text" id="branchRef" name="branchRef" class="form-control" placeholder="main" value="main">
                    <div class="form-help">Branch untuk checkout.</div>
                  </div>
                </div>
              </div>

              <!-- Backend Endpoint URL & Preset Cepat -->
              <div class="form-group" style="margin-top:14px;">
                <label for="backendUrl">URL Endpoint Backend API</label>
                <input type="text" id="backendUrl" name="backendUrl" class="form-control" placeholder="http://127.0.0.1:8000" value="http://127.0.0.1:8000">
                
                <div class="url-presets-row">
                  <span style="font-size:11px; color:var(--text-dim); margin-right:4px;">Preset Cepat:</span>
                  <button type="button" class="preset-pill-btn" onclick="applyBackendPreset('http://127.0.0.1:8000')">💻 127.0.0.1:8000 (Lokal)</button>
                  <button type="button" class="preset-pill-btn" onclick="applyBackendPreset('http://localhost:8080')">🔌 localhost:8080 (Cakrawala)</button>
                  <button type="button" class="preset-pill-btn" onclick="applyBackendPreset('https://alhikmah.sopan.solu.co.id:8530')">🚀 Staging Al-Hikmah (:8530)</button>
                  <button type="button" class="preset-pill-btn" onclick="applyBackendPreset('http://10.0.2.2:8000')">⚡ 10.0.2.2:8000 (Android Emu)</button>
                </div>
              </div>

              <!-- Runtime Stack -->
              <div class="form-group" style="margin-top:14px;">
                <label for="stack">Runtime Stack</label>
                <select id="stack" name="stack" class="form-control">
                  <option value="auto">Auto Detect Framework (Laravel / Node.js / HTML)</option>
                  <option value="laravel" selected>Laravel / PHP Backend</option>
                  <option value="node">Node.js / Express / Next.js</option>
                  <option value="custom">Custom Runtime Services</option>
                </select>
                <div class="form-help">Auto mendeteksi framework; pilih manual jika backend memiliki konfigurasi khusus.</div>
              </div>
            </div>

            <!-- Tombol Navigasi Step 0 -->
            <div style="margin-top:28px; display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--border); padding-top:16px;">
              <a href="/projects" class="btn btn-secondary">Batal</a>
              <button type="button" class="btn btn-primary" onclick="goToStep(1)">Lanjut ke Akun &amp; Data Uji →</button>
            </div>
          </div>

          <!-- ================= STEP 1: AKUN & DATA UJI ================= -->
          <div id="stepSection1" style="display:none;">
            <div style="margin-bottom:20px;">
              <span style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.06em;">LANGKAH 02 / 03</span>
              <h2 style="font-size:18px; margin:4px 0;">Akun Login &amp; Data Pengujian</h2>
              <p style="font-size:12.5px; color:var(--text-muted);">Atur akun pengujian untuk simulasi login otomatis, database, dan pilar audit kualitas.</p>
            </div>

            <!-- Akun Pengujian (Testing Credentials) -->
            <div class="form-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <strong style="font-size:13.5px;">Akun Pengujian (Testing Credentials)</strong>
                  <div style="font-size:11.5px; color:var(--text-muted);">Kredensial login yang digunakan oleh runner untuk menguji protected routes.</div>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" onclick="addAccountRow()">+ Tambah Akun</button>
              </div>

              <div id="accountsContainer">
                <div class="account-row-item">
                  <span class="acc-num">01</span>
                  <div>
                    <input type="text" name="accEmail[]" class="form-control" placeholder="admin@example.com" value="admin@zannora.com">
                  </div>
                  <div>
                    <input type="password" name="accPassword[]" class="form-control" placeholder="Password" value="admin12345">
                  </div>
                  <div>
                    <select name="accRole[]" class="form-control">
                      <option value="admin" selected>Administrator</option>
                      <option value="user">User / Standard</option>
                      <option value="qa">QA Tester</option>
                    </select>
                  </div>
                  <div style="text-align:center;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="removeAccountRow(this)" style="padding:4px 8px;">✕</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Target Viewport & Emulasi Perangkat -->
            <div class="form-group" style="border-top:1px solid var(--border); padding-top:18px; margin-top:20px;">
              <label>Pilih Target Perangkat (Device Viewport)</label>
              <div class="choice-grid">
                <div class="choice-card-item selected" id="devDesktop" onclick="selectDeviceType('desktop')">
                  <div class="choice-card-icon">💻</div>
                  <div class="choice-card-content">
                    <strong>Layar Browser Desktop</strong>
                    <p>1920 × 1080 (Chromium Desktop)</p>
                  </div>
                </div>

                <div class="choice-card-item" id="devMobile" onclick="selectDeviceType('mobile')">
                  <div class="choice-card-icon">📱</div>
                  <div class="choice-card-content">
                    <strong>Layar HP (Mobile Viewport)</strong>
                    <p>375 × 812 (Touch Emulation 390px)</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Database & Data Awal (Opsional) -->
            <div class="form-group" style="border-top:1px solid var(--border); padding-top:18px;">
              <label>Database &amp; Data Awal</label>
              <div class="choice-grid">
                <div class="choice-card-item selected" id="dbModeActive" onclick="selectDbMode('active')">
                  <div class="choice-card-icon">🗄️</div>
                  <div class="choice-card-content">
                    <strong>Gunakan Database Backend Aktif (Tanpa Reset)</strong>
                    <p>Paling praktis: engine langsung memakai database yang saat ini terhubung ke backend server.</p>
                  </div>
                </div>

                <div class="choice-card-item" id="dbModeSql" onclick="selectDbMode('sql')">
                  <div class="choice-card-icon">📥</div>
                  <div class="choice-card-content">
                    <strong>Import File SQL Dump (.sql)</strong>
                    <p>Inisialisasi schema atau data master khusus dari file dump database lokal.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 5 Kategori Quality Audit Sesuai Kebutuhan QC Website -->
            <div class="form-group" style="border-top:1px solid var(--border); padding-top:18px;">
              <label>Cakupan Analisis Ketidaksesuaian Web (Quality Audit)</label>
              <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
                Memeriksa 5 pilar kualitas website secara menyeluruh:
              </p>

              <div class="scope-grid">
                <label class="scope-item">
                  <input type="checkbox" name="checkColor" checked>
                  <div>
                    <strong>Pewarnaan &amp; Kontras Visual</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Validasi WCAG AA rasio kontras teks &amp; tombol</div>
                  </div>
                </label>

                <label class="scope-item">
                  <input type="checkbox" name="checkResponsive" checked>
                  <div>
                    <strong>Responsifitas Layar</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Deteksi horizontal scrollbar &amp; overflow flex</div>
                  </div>
                </label>

                <label class="scope-item">
                  <input type="checkbox" name="checkText" checked>
                  <div>
                    <strong>Teks &amp; Tipografi</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Pemeriksaan label form &amp; placeholder</div>
                  </div>
                </label>

                <label class="scope-item">
                  <input type="checkbox" name="checkLayout" checked>
                  <div>
                    <strong>Tata Letak (Layout &amp; Grid)</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Konsistensi card padding &amp; kerapatan tabel</div>
                  </div>
                </label>

                <label class="scope-item" style="grid-column:1/-1;">
                  <input type="checkbox" name="checkError" checked>
                  <div>
                    <strong>Error Sistem &amp; Penjelasan Teknis</strong>
                    <div style="font-size:11px; color:var(--text-dim);">Audit respons HTTP 4xx/5xx, CORS, dan same-origin sandbox policy</div>
                  </div>
                </label>
              </div>
            </div>

            <!-- Tombol Navigasi Step 1 -->
            <div style="margin-top:28px; display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--border); padding-top:16px;">
              <button type="button" class="btn btn-secondary" onclick="goToStep(0)">← Kembali</button>
              <button type="button" class="btn btn-primary" onclick="goToStep(2)">Lanjut ke Review &amp; Jalankan →</button>
            </div>
          </div>

          <!-- ================= STEP 2: REVIEW & JALANKAN ================= -->
          <div id="stepSection2" style="display:none;">
            <div style="margin-bottom:20px;">
              <span style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.06em;">LANGKAH 03 / 03</span>
              <h2 style="font-size:18px; margin:4px 0;">Tinjau &amp; Mulai Pengujian</h2>
              <p style="font-size:12.5px; color:var(--text-muted);">Periksa ringkasan konfigurasi sebelum autonomous engine mulai menjalankan pengujian.</p>
            </div>

            <!-- Review Banner (Sama persis seperti di SPA wizard.tsx) -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 20px; background:var(--bg-sub); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:18px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size:32px;">🛡️</div>
                <div>
                  <strong style="font-size:17px; display:block;" id="revProjectName">Zannora Travel Portal</strong>
                  <span style="font-size:12px; color:var(--text-muted);" id="revTargetInfo">Web Application · http://127.0.0.1:8000</span>
                </div>
              </div>
              <span class="status-badge status-success" id="revBadge">Web Playwright</span>
            </div>

            <!-- Review Summary Grid -->
            <div class="review-summary-grid">
              <div class="summary-item-box">
                <span class="sum-kicker">Target Aplikasi</span>
                <strong id="revTargetApp">Web Application (Chromium)</strong>
                <small id="revTargetUrl">http://127.0.0.1:8000</small>
              </div>

              <div class="summary-item-box">
                <span class="sum-kicker">Backend &amp; API Service</span>
                <strong id="revBackendUrl">http://127.0.0.1:8000</strong>
                <small id="revSourceMode">Mode: Live Target Port</small>
              </div>

              <div class="summary-item-box">
                <span class="sum-kicker">Akun Login Uji</span>
                <strong id="revAccountCount">1 Akun Terdaftar</strong>
                <small id="revAccountPrimary">admin@zannora.com (admin)</small>
              </div>

              <div class="summary-item-box">
                <span class="sum-kicker">Cakupan Quality Audit</span>
                <strong>5 Pilar Kualitas Aktif</strong>
                <small>Kontras, Responsifitas, Teks, Layout, dan Error Sistem</small>
              </div>
            </div>

            <!-- Notice Kesiapan -->
            <div style="padding:14px 16px; border-radius:var(--radius); background:rgba(2,132,199,0.1); border:1px solid rgba(2,132,199,0.25); color:var(--text); font-size:12.5px; line-height:1.5; margin-bottom:24px;">
              <strong>Autonomous Engine Siap:</strong> Begitu tombol di bawah ditekan, sistem akan menguji konektivitas endpoint, memetakan alur login dan routing, menjalankan simulasi tampilan, dan langsung menampilkan progres interaktif di <strong>Live Monitor (CMD &amp; Viewport)</strong>.
            </div>

            <!-- Tombol Eksekusi Akhir -->
            <div style="display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--border); padding-top:16px;">
              <button type="button" class="btn btn-secondary" onclick="goToStep(1)">← Kembali ke Akun Uji</button>
              <button type="submit" class="btn btn-primary" style="padding:12px 28px; font-size:14px; font-weight:700;">
                Jalankan Autonomous QC Engine →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Client-side Wizard Interactive Engine -->
    <script>
      let currentWizardStep = 0;

      function goToStep(step) {
        // Validate required fields on step 0
        if (step > 0 && currentWizardStep === 0) {
          const name = document.getElementById('projectName').value.trim();
          const target = document.getElementById('targetUrl').value.trim();
          if (!name) {
            alert('Mohon masukkan Nama Project / Pengujian terlebih dahulu.');
            document.getElementById('projectName').focus();
            return;
          }
          if (!target) {
            alert('Mohon masukkan URL Website Target.');
            document.getElementById('targetUrl').focus();
            return;
          }
        }

        currentWizardStep = step;
        document.getElementById('stepSection0').style.display = (step === 0 ? 'block' : 'none');
        document.getElementById('stepSection1').style.display = (step === 1 ? 'block' : 'none');
        document.getElementById('stepSection2').style.display = (step === 2 ? 'block' : 'none');

        // Update step tabs
        for (let i = 0; i < 3; i++) {
          const tab = document.getElementById('stepTab' + i);
          tab.classList.toggle('active', i === step);
          tab.classList.toggle('done', i < step);
        }

        // When entering Review Step 2, update summary
        if (step === 2) {
          const name = document.getElementById('projectName').value.trim() || 'Untitled Project';
          const target = document.getElementById('targetUrl').value.trim() || 'http://127.0.0.1:8000';
          const backend = document.getElementById('backendUrl').value.trim() || target;
          const plat = document.getElementById('inputPlatform').value;
          const srcType = document.getElementById('inputSourceType').value;
          const devType = document.getElementById('inputDeviceType').value;

          document.getElementById('revProjectName').textContent = name;
          document.getElementById('revTargetInfo').textContent = (plat === 'android' ? 'Mobile App' : 'Web Application') + ' · ' + target;
          document.getElementById('revBadge').textContent = plat === 'android' ? 'Android Maestro' : 'Web Playwright';
          document.getElementById('revTargetApp').textContent = plat === 'android' ? 'Flutter / Android Native' : ('Web App (' + (devType === 'mobile' ? 'Mobile 375px' : 'Desktop 1920px') + ')');
          document.getElementById('revTargetUrl').textContent = target;
          document.getElementById('revBackendUrl').textContent = backend;
          document.getElementById('revSourceMode').textContent = 'Mode: ' + (srcType === 'local-folder' ? 'Folder Kerja Lokal' : srcType === 'github' ? 'Repository GitHub' : 'Live Target Port');

          const emails = Array.from(document.querySelectorAll('input[name="accEmail[]"]')).map(i => i.value).filter(Boolean);
          document.getElementById('revAccountCount').textContent = emails.length + ' Akun Terdaftar';
          document.getElementById('revAccountPrimary').textContent = emails[0] || 'admin@example.com';
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function selectPlatform(plat) {
        document.getElementById('inputPlatform').value = plat;
        document.getElementById('platWeb').classList.toggle('selected', plat === 'web');
        document.getElementById('platAndroid').classList.toggle('selected', plat === 'android');
        if (plat === 'android') {
          selectDeviceType('mobile');
        }
      }

      function selectSourceMode(mode) {
        document.getElementById('inputSourceType').value = mode;
        document.getElementById('btnModeExisting').classList.toggle('active', mode === 'existing-target');
        document.getElementById('btnModeLocal').classList.toggle('active', mode === 'local-folder');
        document.getElementById('btnModeGithub').classList.toggle('active', mode === 'github');

        document.getElementById('groupLocalFolder').style.display = (mode === 'local-folder' ? 'block' : 'none');
        document.getElementById('groupGithub').style.display = (mode === 'github' ? 'block' : 'none');

        const badge = document.getElementById('sourceBadge');
        if (mode === 'local-folder') badge.textContent = 'Folder Lokal';
        else if (mode === 'github') badge.textContent = 'GitHub Workspace';
        else badge.textContent = 'Live Target Port';
      }

      function selectDeviceType(dev) {
        document.getElementById('inputDeviceType').value = dev;
        document.getElementById('devDesktop').classList.toggle('selected', dev === 'desktop');
        document.getElementById('devMobile').classList.toggle('selected', dev === 'mobile');
      }

      function selectDbMode(m) {
        document.getElementById('dbModeActive').classList.toggle('selected', m === 'active');
        document.getElementById('dbModeSql').classList.toggle('selected', m === 'sql');
      }

      function applyBackendPreset(url) {
        document.getElementById('backendUrl').value = url;
      }

      function addAccountRow() {
        const c = document.getElementById('accountsContainer');
        const count = c.children.length + 1;
        const countStr = count < 10 ? '0' + count : count;
        const div = document.createElement('div');
        div.className = 'account-row-item';
        div.innerHTML = '<span class="acc-num">' + countStr + '</span>' +
          '<div><input type="text" name="accEmail[]" class="form-control" placeholder="user@example.com"></div>' +
          '<div><input type="password" name="accPassword[]" class="form-control" placeholder="Password" value="password123"></div>' +
          '<div><select name="accRole[]" class="form-control"><option value="user" selected>User / Standard</option><option value="admin">Administrator</option><option value="qa">QA Tester</option></select></div>' +
          '<div style="text-align:center;"><button type="button" class="btn btn-sm btn-secondary" onclick="removeAccountRow(this)" style="padding:4px 8px;">✕</button></div>';
        c.appendChild(div);
      }

      function removeAccountRow(btn) {
        const row = btn.closest('.account-row-item');
        const c = document.getElementById('accountsContainer');
        if (c.children.length > 1) {
          row.remove();
        } else {
          alert('Minimal satu akun pengujian diperlukan.');
        }
      }
    </script>
  \`, 'new', user);
}
`;

// Replace viewNewTest in server.js
const oldViewNewTestPattern = /\/\/ 2\. Form Uji Baru View[\s\S]*?function viewNewTest\(user\) {[\s\S]*?^}/m;
code = code.replace(oldViewNewTestPattern, spaWizardView);

// 3. Update POST /new handler to capture all SPA fields (platform, sourceType, localPath, repositoryUrl, targetUrl, backendUrl, deviceType, accEmail)
const oldPostNewPattern = /\/\/ Route: Uji Baru[\s\S]*?if \(pathname === '\/new'\) {[\s\S]*?projectRuns\.set\(runId, newRun\);[\s\S]*?return redirect\(res, `\/monitor\?id=\${runId}`\);[\s\S]*?}/m;

const newPostNewRoute = `// Route: Uji Baru (Handles SPA Wizard Submission)
  if (pathname === '/new') {
    if (method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(viewNewTest(user));
    }
    if (method === 'POST') {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const projectName = (params.get('projectName') || 'Projek Web').trim();
      const platform = params.get('platform') || 'web';
      const sourceType = params.get('sourceType') || 'existing-target';
      const localPath = (params.get('localPath') || '').trim();
      const repositoryUrl = (params.get('repositoryUrl') || '').trim();
      const targetUrl = (params.get('targetUrl') || 'http://127.0.0.1:8000').trim();
      const backendUrl = (params.get('backendUrl') || targetUrl).trim();
      const deviceType = params.get('deviceType') || (platform === 'android' ? 'mobile' : 'desktop');

      const runId = 'QC-' + (100 + projectRuns.size + 1);
      const now = new Date();
      const timeStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const sourceDisplay = sourceType === 'local-folder' ? (localPath || 'Folder Lokal') :
                            sourceType === 'github' ? (repositoryUrl || 'GitHub Repo') :
                            targetUrl;

      // Generate realistic logs
      const logs = [
        { time: '10:00:01', type: 'info', text: \`Memulai runner QC Maestro untuk projek: \${projectName} [\${platform.toUpperCase()}]\` },
        { time: '10:00:02', type: 'info', text: \`Menghubungkan sumber \${sourceDisplay} (Mode: \${sourceType})...\` },
        { time: '10:00:03', type: 'ok', text: \`Target online (HTTP 200 OK) pada \${targetUrl}. Backend: \${backendUrl}\` },
        { time: '10:00:04', type: 'info', text: \`Menginisialisasi Playwright Chromium: viewport \${deviceType === 'mobile' ? '375x812 (Mobile HP Viewport)' : '1920x1080 (Desktop)'}\` },
        { time: '10:00:05', type: 'ok', text: \`Discovery selesai: routes dan form elements teridentifikasi.\` },
        { time: '10:00:06', type: 'warn', text: \`Audit Pewarnaan: Rasio kontras teks tombol pada latar belakang dianalisis (WCAG AA).\` },
        { time: '10:00:07', type: 'ok', text: \`Audit Responsifitas: Kontainer adaptif dan dokumen bebas dari horizontal scrollbar.\` },
        { time: '10:00:08', type: 'ok', text: \`Audit Teks: 0 missing labels pada kontrol input form.\` },
        { time: '10:00:09', type: 'ok', text: \`Screenshot evidence dan rekaman simulasi disimpan ke folder \${runId}.\` },
        { time: '10:00:10', type: 'ok', text: \`Laporan audit lengkap berhasil dikompilasi ke format JSON dan text.\` }
      ];

      const categories = {
        color: {
          title: 'Pewarnaan & Kontras Visual',
          status: 'PASSED',
          badge: 'status-success',
          badgeText: '✓ Lulus Standar WCAG',
          items: [
            { title: 'Kontras Warna Memenuhi Standar WCAG AA', desc: 'Rasio kontras teks dan tombol rata-rata 5.1:1, terbaca jelas di berbagai pencahayaan.' }
          ]
        },
        responsive: {
          title: deviceType === 'mobile' ? 'Responsifitas Layar (Mobile HP 390×844)' : 'Responsifitas Layar (Desktop 1920×1080)',
          status: 'PASSED',
          badge: 'status-success',
          badgeText: '✓ Bebas Overflow',
          items: [
            { title: 'Viewport Sesuai Target Tanpa Horizontal Scroll', desc: \`Kontainer beradaptasi penuh pada lebar layar \${deviceType === 'mobile' ? '390px' : '1920px'}.\` }
          ]
        },
        text: {
          title: 'Teks & Tipografi',
          status: 'PASSED',
          badge: 'status-success',
          badgeText: '✓ 0 Label Hilang',
          items: [
            { title: 'Struktur Label Form dan Kontrol Lengkap', desc: 'Semua input form memiliki pasangan label dan atribut aksesibilitas yang valid.' }
          ]
        },
        layout: {
          title: 'Tata Letak (Layout & Grid)',
          status: 'PASSED',
          badge: 'status-success',
          badgeText: '✓ Rapi & Teratur',
          items: [
            { title: 'Jarak Spacing dan Density Data Table Terjaga', desc: 'Sistem grid dan flexbox menyesuaikan kontainer dengan padding seragam.' }
          ]
        },
        error: {
          title: 'Error Sistem & Penjelasan Teknis',
          status: 'RESOLVED',
          badge: 'status-warn',
          badgeText: '1 Catatan Ringan',
          items: [
            { title: 'Same-Origin Policy Sandboxing', desc: '<strong>Penyebab:</strong> External third-party requests disaring sesuai standar keamanan isolasi QC.<br><strong>Status:</strong> Teratasi dengan isolasi lokal.' }
          ]
        }
      };

      const newRun = {
        id: runId,
        name: projectName,
        platform,
        targetUrl,
        sourceType,
        source: sourceDisplay,
        frontend: targetUrl,
        backend: backendUrl,
        deviceType,
        status: 'COMPLETED',
        createdBy: user.email,
        createdByName: user.name,
        createdAt: timeStr,
        businessFlows: makeFlows(),
        logs,
        categories
      };

      projectRuns.set(runId, newRun);
      return redirect(res, \`/monitor?id=\${runId}\`);
    }`;

code = code.replace(oldPostNewPattern, newPostNewRoute);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully upgraded /new with the complete SPA-compliant 3-step Wizard!');
