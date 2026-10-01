const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../apps/unique-demo/server.js');
let code = fs.readFileSync(targetPath, 'utf8');

// Update viewNewTest to restore the Source Type options: GitHub, Install/Folder Lokal, and Port Lokal
const oldViewNewTestPattern = /\/\/ 2\. Form Uji Baru View[\s\S]*?function viewNewTest\(user\) {[\s\S]*?^}/m;

const newViewNewTest = `// 2. Form Uji Baru View
function viewNewTest(user) {
  return layout('Uji Baru (+)', \`
    <div style="max-width:760px; margin:0 auto;">
      <div style="margin-bottom:20px;">
        <h1 style="font-size:22px; font-weight:800; margin-bottom:4px;">Mulai Pengujian Projek Baru</h1>
        <p style="color:var(--text-muted); font-size:13px;">Pilih tipe sumber projek (Folder Lokal, GitHub, atau Port Aktif), atur endpoint target, dan jalankan simulasi otomatis.</p>
      </div>

      <div class="card">
        <form action="/new" method="post">
          <div class="form-group">
            <label for="projectName">Nama Projek / Folder Pengujian</label>
            <input type="text" id="projectName" name="projectName" class="form-control" placeholder="Contoh: Northstar Shop Web / Saff Travel Agent" required value="Saff Travel Agent">
            <div class="form-help">Nama projek dan folder untuk menyimpan hasil video, screenshot, dan report.</div>
          </div>

          <!-- Pilihan Tipe Sumber: Install Lokal, GitHub, Port Lokal -->
          <div class="form-group">
            <label>Pilih Tipe Sumber Projek (Source Web)</label>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; margin-bottom:12px;">
              <label class="device-option selected" id="optLocal" onclick="selectSourceType('local-folder')">
                <input type="radio" name="sourceType" value="local-folder" checked>
                <div>
                  <strong>📁 Folder / Install Lokal</strong>
                  <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">Folder kerja di komputer ini</div>
                </div>
              </label>

              <label class="device-option" id="optGithub" onclick="selectSourceType('github')">
                <input type="radio" name="sourceType" value="github">
                <div>
                  <strong>🐙 Repository GitHub</strong>
                  <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">Kloning dari repository GitHub</div>
                </div>
              </label>

              <label class="device-option" id="optPort" onclick="selectSourceType('existing-target')">
                <input type="radio" name="sourceType" value="existing-target">
                <div>
                  <strong>🌐 Port Lokal / URL Aktif</strong>
                  <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">Frontend/backend sudah berjalan</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Dynamic Source Path / GitHub Repo Field -->
          <div class="form-group" id="sourcePathGroup">
            <label for="sourcePath" id="sourcePathLabel">Path Folder Kerja Lokal (Install Lokal)</label>
            <input type="text" id="sourcePath" name="sourcePath" class="form-control" placeholder="Contoh: E:/projek/saff-travel atau D:/work/my-app" value="E:/projek/saff-travel">
            <div class="form-help" id="sourcePathHelp">Direktori proyek di komputer lokal yang akan dipetakan source code dan rutenya.</div>
          </div>

          <!-- Frontend & Backend Endpoints -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
            <div class="form-group" style="margin:0;">
              <label for="targetUrl">Port / URL Frontend</label>
              <input type="text" id="targetUrl" name="targetUrl" class="form-control" placeholder="http://127.0.0.1:5173 atau 3000" required value="http://127.0.0.1:5173">
              <div class="form-help">Endpoint antarmuka web yang diuji browser.</div>
            </div>

            <div class="form-group" style="margin:0;">
              <label for="backendUrl">Port / URL Backend (Opsional)</label>
              <input type="text" id="backendUrl" name="backendUrl" class="form-control" placeholder="http://127.0.0.1:8000 atau 8080" value="http://127.0.0.1:8000">
              <div class="form-help">Endpoint API backend jika ada komunikasi server.</div>
            </div>
          </div>

          <!-- Target Device Selection -->
          <div class="form-group">
            <label>Pilih Target Perangkat (Device Viewport)</label>
            <div class="device-grid">
              <label class="device-option selected" id="optDesktop" onclick="selectDevice('desktop')">
                <input type="radio" name="deviceType" value="desktop" checked>
                <div>
                  <strong>💻 Layar Browser Desktop</strong>
                  <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">1920 × 1080 (Chromium Desktop)</div>
                </div>
              </label>

              <label class="device-option" id="optMobile" onclick="selectDevice('mobile')">
                <input type="radio" name="deviceType" value="mobile">
                <div>
                  <strong>📱 Layar HP (Mobile Viewport)</strong>
                  <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">375 × 812 (Touch Emulation)</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Quality Checks Scope -->
          <div class="form-group">
            <label>Cakupan Analisis Ketidaksesuaian (Quality Checks)</label>
            <div class="scope-grid">
              <label class="scope-item">
                <input type="checkbox" name="checkColor" checked>
                <span>Pewarnaan & Kontras</span>
              </label>
              <label class="scope-item">
                <input type="checkbox" name="checkResponsive" checked>
                <span>Responsifitas Layar</span>
              </label>
              <label class="scope-item">
                <input type="checkbox" name="checkText" checked>
                <span>Teks & Tipografi</span>
              </label>
              <label class="scope-item">
                <input type="checkbox" name="checkLayout" checked>
                <span>Tata Letak (Layout)</span>
              </label>
              <label class="scope-item">
                <input type="checkbox" name="checkError" checked>
                <span>Error & Penjelasan</span>
              </label>
            </div>
          </div>

          <div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">
            <a href="/projects" class="btn btn-secondary">Batal</a>
            <button type="submit" class="btn btn-primary" style="padding:10px 22px;">Jalankan Pengujian Sekarang →</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      function selectSourceType(type) {
        document.querySelectorAll('input[name="sourceType"]').forEach(r => {
          const match = (r.value === type);
          r.checked = match;
          r.closest('.device-option').classList.toggle('selected', match);
        });

        const label = document.getElementById('sourcePathLabel');
        const input = document.getElementById('sourcePath');
        const help = document.getElementById('sourcePathHelp');
        const group = document.getElementById('sourcePathGroup');

        if (type === 'github') {
          group.style.display = 'block';
          label.textContent = 'URL Repository GitHub';
          input.placeholder = 'https://github.com/organization/repository-name';
          if (!input.value.startsWith('http')) input.value = 'https://github.com/acme/saff-travel';
          help.textContent = 'Repository GitHub akan disalin ke workspace QC sementara. Folder kerja asli tetap utuh.';
        } else if (type === 'local-folder') {
          group.style.display = 'block';
          label.textContent = 'Path Folder Kerja Lokal (Install Lokal)';
          input.placeholder = 'Contoh: E:/projek/saff-travel atau D:/work/project-name';
          if (input.value.startsWith('http')) input.value = 'E:/projek/saff-travel';
          help.textContent = 'Folder kerja di komputer ini untuk pemetaan source, route, dan dependency.';
        } else {
          group.style.display = 'none';
        }
      }

      function selectDevice(dev) {
        document.querySelectorAll('input[name="deviceType"]').forEach(r => {
          const match = (r.value === dev);
          r.checked = match;
          r.closest('.device-option').classList.toggle('selected', match);
        });
      }
    </script>
  \`, 'new', user);
}`;

code = code.replace(oldViewNewTestPattern, newViewNewTest);

// Also update POST /new handling to capture sourceType, sourcePath, backendUrl
const oldPostNewPattern = /const projectName = \(params\.get\('projectName'\)[\s\S]*?const newRun = {[\s\S]*?};/m;

const newPostNewSnippet = `const projectName = (params.get('projectName') || 'Projek Web').trim();
      const sourceType = params.get('sourceType') || 'local-folder';
      const sourcePath = (params.get('sourcePath') || '').trim();
      const targetUrl = (params.get('targetUrl') || 'http://127.0.0.1:5173').trim();
      const backendUrl = (params.get('backendUrl') || '').trim();
      const deviceType = params.get('deviceType') || 'desktop';

      const runId = 'QC-' + (100 + projectRuns.size + 1);
      const now = new Date();
      const timeStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // Generate realistic logs
      const logs = [
        { time: '10:00:01', type: 'info', text: \`Memulai runner untuk projek: \${projectName} [\${sourceType}]\` },
        { time: '10:00:02', type: 'info', text: \`Menghubungkan sumber \${sourcePath || targetUrl}...\` },
        { time: '10:00:03', type: 'ok', text: \`Target online (200 OK) pada \${targetUrl}. Backend: \${backendUrl || 'None'}\` },
        { time: '10:00:04', type: 'info', text: \`Mengatur viewport ke \${deviceType === 'mobile' ? '375x812 (Mobile HP Viewport)' : '1920x1080 (Desktop)'}\` },
        { time: '10:00:05', type: 'ok', text: \`Pemetaan halaman & route discovery selesai. 14 elemen interaktif ditemukan.\` },
        { time: '10:00:06', type: 'warn', text: \`Audit Pewarnaan: 1 elemen dengan rasio kontras < 4.5:1 terdeteksi.\` },
        { time: '10:00:07', type: 'ok', text: \`Audit Responsifitas: Kontainer adaptif dan tidak ada horizontal scroll.\` },
        { time: '10:00:08', type: 'err', text: \`Audit Error: Permintaan GET /favicon.ico menghasilkan status 404 Not Found.\` },
        { time: '10:00:09', type: 'ok', text: \`Screenshot dan rekaman video berhasil disimpan ke folder \${runId}.\` },
        { time: '10:00:10', type: 'ok', text: \`Berkas audit_result.json berhasil disusun.\` }
      ];

      const categories = {
        color: {
          title: 'Pewarnaan & Kontras Visual',
          status: 'PASSED',
          badge: 'status-success',
          badgeText: '✓ Lulus Standar',
          items: [
            { title: 'Kontras Warna Memenuhi Standar WCAG AA', desc: 'Rasio kontras teks dan tombol rata-rata 4.9:1, terbaca jelas.' }
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
          badgeText: '1 Peringatan Ringan',
          items: [
            { title: 'Permintaan GET /favicon.ico (404)', desc: '<strong>Penyebab:</strong> File favicon belum ditautkan pada tag &lt;head&gt;.<br><strong>Solusi:</strong> Tambahkan &lt;link rel="icon" href="..."&gt; untuk mencegah error 404.' }
          ]
        }
      };

      const newRun = {
        id: runId,
        name: projectName,
        targetUrl,
        sourceType,
        source: sourcePath || targetUrl,
        frontend: targetUrl,
        backend: backendUrl || 'Not configured',
        deviceType,
        status: 'COMPLETED',
        createdBy: user.email,
        createdByName: user.name,
        createdAt: timeStr,
        businessFlows: makeFlows(),
        logs,
        categories
      };`;

code = code.replace(oldPostNewPattern, newPostNewSnippet);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully added source options (GitHub, Folder Lokal, Port) to viewNewTest!');
