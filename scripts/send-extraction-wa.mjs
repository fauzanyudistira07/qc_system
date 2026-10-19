import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  const config = {
    FONNTE_TOKEN: 'eE8DG7vGPArkv1SewzJd',
    FONNTE_TARGET: '089508717179,08882017549',
    PORT: '4180'
  };

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key in config && val) {
          config[key] = val;
        }
      }
    }
  }
  return config;
}

function getTunnelUrl() {
  try {
    const file = path.join(rootDir, 'active-tunnel-url.txt');
    if (fs.existsSync(file)) {
      const url = fs.readFileSync(file, 'utf8').trim();
      if (url.startsWith('http')) return url;
    }
  } catch {}
  return 'https://terminal-record-terminal-llp.trycloudflare.com';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendMessage(token, target, text, partLabel) {
  console.log(`[Fonnte] Mengirim ${partLabel} ke ${target}...`);
  const formData = new URLSearchParams();
  formData.append('target', target);
  formData.append('message', text);
  formData.append('countryCode', '62');

  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { 'Authorization': token },
    body: formData
  });

  const data = await res.json();
  console.log(`[Fonnte] Response ${partLabel}:`, JSON.stringify(data));
  return data;
}

async function main() {
  const env = loadEnv();
  const token = env.FONNTE_TOKEN;
  // Target: aja buang ingus (089508717179) and Jann / Anda (08882017549)
  const target = process.argv[2] || '089508717179,08882017549';
  const tunnelUrl = getTunnelUrl();

  const messages = [
    // PART 1
`*[TIMBANG — MASTER SYSTEM EXTRACTION (1/5)]*
🏛️ *ARSITEKTUR UTAMA & TOPOLOGI MONOREPO*
-----------------------------------------
Hasil rekonstruksi Source of Truth teknis aplikasi *Timbang (QC Maestro)* berdasarkan audit implementasi aktual pada branch \`main\`.

🎯 *Tujuan Ekstraksi:*
Menghasilkan spesifikasi teknis portable yang berlandaskan implementasi nyata untuk memandu redesign UI/UX (termasuk via Figma Make) tanpa merusak fungsionalitas inti.

🏗️ *Tech Stack Terverifikasi:*
• *Backend Engine:* Fastify v5.2, Node.js v24 (ESM), TypeScript v5.9, SQLite / PostgreSQL (Prisma-ready), Redis queue adapter.
• *Frontend SPA:* React v19, Vite v6, Tailwind CSS v4, Lucide/Radix Icons, Tabular Numbers font system.
• *Test Execution Engines:* Playwright v1.49 (Web Headless/Headed), Maestro CLI + Android ADB (Mobile APK/Emulator).
• *AI Intelligence:* Google Gemini REST API v1beta (\`gemini-3.5-flash\`, fallback \`gemini-1.5-flash\`).
• *Cloud Storage:* Nextcloud WebDAV (\`158.140.181.43:8443\`).

📦 *Modul & Struktur Monorepo:*
• \`apps/api/\`: Fastify server, discovery crawler, flow compiler, gemini evaluator, audit runner, webhook listener.
• \`apps/web/\`: React 19 UI, dashboard cockpit, wizard run builder, log stream terminal, report viewer, visual tree.
• \`packages/flow-schema/\`: Zod canonical schema untuk flow pengujian lintas platform (Web & Mobile).
• \`packages/runner-core/\`: Abstraksi eksekutor pengujian, lifecycle hooks, evidence recorder.
• \`apps/runner-playwright/\`: Web test execution engine berbasis Playwright.
• \`apps/runner-maestro/\`: Mobile test execution engine berbasis Maestro YAML & ADB.

🔄 *End-to-End Orchestration Journey:*
1. *Trigger:* Manual via UI Wizard / API POST / GitHub Webhook.
2. *Discovery Crawl:* Autonomous URL traversal & DOM capability profiling.
3. *Flow Compilation:* Penerjemahan spesifikasi abstrak ke Playwright scripts / Maestro YAML.
4. *Execution:* Eksekusi tes paralel dengan isolasi browser context / mobile device.
5. *Evidence Capture:* Checkpoint screenshots, video trace .webm, console error logs, network timeline.
6. *AI Quality Evaluation:* Analisis Gemini AI terhadap visual regression & severity defect.
7. *Sync & Export:* Sinkronisasi artefak ke Nextcloud SOLU & notifikasi WhatsApp via Fonnte.`,

    // PART 2
`*[TIMBANG — MASTER SYSTEM EXTRACTION (2/5)]*
🗺️ *PETA LENGKAP 13 RUTE & LAYAR APLIKASI*
-----------------------------------------
Setiap tampilan telah dipetakan dengan guard otentikasi, binding state reaktif, komponen anak, dan aksi pengguna:

1️⃣ \`/\` — *Root Redirection*
Otomatis mengarahkan ke run aktif terbaru atau ke wizard run jika tidak ada job berjalan.

2️⃣ \`/runs/new\` — *Run Creation Wizard*
Wizard 4 langkah: (1) Target Project & Environment, (2) Mode Pengujian (Smoke, Regression, Autonomous AI, CRUD), (3) Runner Configuration (Browser/Device), (4) Review & Trigger.

3️⃣ \`/runs/:id\` — *Live Execution Cockpit*
Layar monitoring real-time: status badge, interactive progress gauge, live terminal output via WebSocket, action button (Pause, Resume, Abort/Cancel).

4️⃣ \`/runs/:id/report\` — *Aggregated Quality Report*
Ringkasan eksekutif skor kualitas, metrik Pass/Fail, visual regression status, filter severity defect (Critical, High, Medium, Low), download report (HTML/PDF/ZIP).

5️⃣ \`/runs/:id/evidence\` — *Evidence & Media Gallery*
Galeri tangkapan layar bertahap, video playback \`.webm\`, download trace zip, sync to Nextcloud SOLU button.

6️⃣ \`/runs/:id/tree\` — *Visual Flow Step Graph*
Pohon hierarki eksekusi step flow pengujian, menampilkan dependensi step, durasi eksekusi per step, dan status visual.

7️⃣ \`/discovery\` — *Autonomous Discovery Visualizer*
Visualisasi URL frontier hasil crawling, peta simpul komponen yang ditemukan (Forms, Tables, Modals, Buttons).

8️⃣ \`/flows\` — *Flow Library & Template Catalog*
Daftar template skenario pengujian tersimpan, filtering berdasarkan kategori, pencarian nama flow, tag manajemen.

9️⃣ \`/flows/:id/builder\` — *Visual Flow Builder*
Editor step visual berdampingan dengan YAML/JSON canonical editor, drag-and-drop step sequencing, parameter inspector.

🔟 \`/settings\` — *Global Platform Configuration*
Pengaturan API Key (Gemini, GitHub Token), integrasi Nextcloud WebDAV, konfigurasi WhatsApp Fonnte, timeout parameter.

1️⃣1️⃣ \`/devices\` — *Device & Emulator Farm*
Status koneksi ADB mobile device, serial number, resolusi layar, battery status, restart emulator launcher.

1️⃣2️⃣ \`/history\` — *Run History & Analytics*
Tabel komparasi histori pengujian, grafik tren skor kualitas antar build, filter waktu & status.

1️⃣3️⃣ \`/login\` — *HMAC / Admin Authentication Gate*
Form login admin, token storage (localStorage), session validation, brute-force guard.`,

    // PART 3
`*[TIMBANG — MASTER SYSTEM EXTRACTION (3/5)]*
⚙️ *LOGIKA BISNIS, STATE MACHINE & KAPABILITAS*
-----------------------------------------

🔄 *State Machine Siklus Hidup Job:*
\`[PENDING]\` ➔ \`[QUEUED]\` ➔ \`[DISCOVERY]\` ➔ \`[COMPILING]\` ➔ \`[RUNNING]\` ➔ \`[ANALYZING]\` ➔ \`[SYNCING]\` ➔ \`[COMPLETED]\`
• Status Kegagalan/Terminasi: \`[FAILED]\`, \`[ABORTED]\`, \`[TIMEOUT]\`.
• Transisi atomik terjaga: Abort sinyal langsung menghentikan child process runner dan menandai run status dalam database.

🛡️ *Aturan Keamanan Autonomous Discovery:*
• *Max Depth Limit:* Default 3 level traversal untuk mencegah infinite loop.
• *Rate Limiting:* 500ms delay antar request untuk menjaga stabilitas target server.
• *Domain Boundary:* Strictly whitelist domain yang didaftarkan (tidak pernah keluar domain).
• *Destructive Blacklist:* Tombol teks/elemen seperti \`Hapus\`, \`Delete\`, \`Logout\`, \`Keluar\`, \`Format\`, \`Drop\` otomatis dikecualikan dari auto-click saat discovery.

🧩 *27 Matriks Kapabilitas Standar:*
1. Authentication (Login/Logout/SSO)
2. Form Input Text & Number
3. Select & Dropdown Picker
4. Checkbox & Radio Toggle
5. Date & Time Picker
6. File Upload & Drag-Drop
7. Data Table Pagination & Sorting
8. Modal Dialog & Drawer Confirmation
9. Toast & Alert Notification Inspection
10. Tab Navigation & Accordion
11. Search & Filter Bar Query
12. Export Data (CSV, Excel, PDF)
13. Infinite Scroll Traversal
14. Multi-Step Form Wizard
15. Dynamic Form Field Addition
16. CRUD Create Mutation
17. CRUD Read Query
18. CRUD Update Mutation
19. CRUD Delete Mutation (in sandbox)
20. Responsive Viewport Adaptability
21. Network Request Interception & Mocking
22. Visual Regression Snapshot Comparison
23. Console Error & Warning Trap
24. Broken Link & 404 Detection
25. Performance Metrics (FCP, LCP, CLS)
26. Mobile Touch Gesture (Swipe, Pinch)
27. AI Vision Screen Understanding`,

    // PART 4
`*[TIMBANG — MASTER SYSTEM EXTRACTION (4/5)]*
🛡️ *BATASAN PERUBAHAN UX & 15 INVARIANTS INTI*
-----------------------------------------
Pedoman ketat untuk desainer / AI Agent (Figma Make) agar redesign UI tidak merusak logika aplikasi:

📌 *Register 15 Invariants Teknis:*
• \`INV-001\`: *Immutable Job IDs* — ID dan Hash pengujian tidak boleh dimutasi di frontend.
• \`INV-002\`: *Monospace Terminal Output* — Log mentah konsol wajib dirender menggunakan font monospace dengan tabular-nums tanpa text-wrap liar.
• \`INV-003\`: *WebSocket Stream Resilience* — UI terminal wajib tahan reconnect jika koneksi live stream terputus sesaat.
• \`INV-004\`: *Dual-Platform Isolation* — Konfigurasi runner Web (Playwright) dan Mobile (Maestro) tidak boleh dicampur dalam satu schema eksekusi.
• \`INV-005\`: *Safe Zone Click Blacklist* — UI action buttons tidak boleh memicu aksi destructive di server tanpa confirmation modal.
• \`INV-006\`: *Evidence Cryptographic Integrity* — Nama file artefak dan path hash tidak boleh diubah karena digunakan untuk verifikasi integritas.
• \`INV-007\`: *Quality Metric Determinism* — Formula agregasi skor kualitas (Pass rate, defect severity) dihitung secara deterministik, bukan diestimasi frontend.
• \`INV-008\`: *Tabular Figures Everywhere* — Semua durasi (ms/s), status code HTTP, dan angka metrik wajib menggunakan tabular font styling.
• \`INV-009\`: *Nextcloud WebDAV Path Hierarchy* — Struktur folder sinkronisasi cloud (\`projects/<name>/runs/<id>\`) adalah kontrak baku.
• \`INV-010\`: *AI Context Sanitization* — Sensitive token, password, dan auth cookie wajib disensor sebelum payload dikirim ke evaluasi Gemini AI.
• \`INV-011\`: *Wizard Step Transition Guards* — Pengguna tidak dapat melompat ke langkah berikutnya sebelum validasi step aktif terpenuhi.
• \`INV-012\`: *Instant Abort Signaling* — Tombol 'Stop/Abort' wajib mengirim sinyal pembatalan prioritas tinggi ke backend tanpa delay.
• \`INV-013\`: *Artifact ZIP Bundling* — Endpoint unduh zip mengemas seluruh folder run tanpa kompresi parsial.
• \`INV-014\`: *ADB State Synchronization* — Status device mobile (online/offline/unauthorized) harus merefleksikan telemetry real-time ADB.
• \`INV-015\`: *Semantic Color Alignment* — Status sukses wajib Emerald (#22C55E), live Sky (#38BDF8), warning Amber (#F59E0B), dan fail Coral (#EF4444).

🛑 *ZONA TERLINDUNGI (Dilarang Ubah Binding/Logic):*
• Form Field IDs & Data Attributes (\`data-testid\`, \`name\`).
• Struktur Payload API request/response.
• Log stream buffer & WebSocket subscription hooks.
• WebSocket event listener signatures.

🟢 *ZONA BEBAS REDESIGN (Figma Make Aman):*
• Layout visual, grid hierarchy, dan padding.
• Tipografi visual, kartu metrik, dan micro-interactions.
• Dark mode precision styling, glassmorphism, dan borders.
• Ilustrasi empty state, filter controls, dan icon styling.`,

    // PART 5
`*[TIMBANG — MASTER SYSTEM EXTRACTION (5/5)]*
📊 *HASIL UJI EMPIRIS, GAP REGISTER & AKSES DOKUMEN*
-----------------------------------------

🧪 *Hasil Uji Empiris Repo Terkini:*
1. \`npm run check\`: ⚠️ *TS2724 Gap*
   - Ditemukan missing export \`readFileSync\` pada deklarasi ambient \`apps/api/src/ambient.d.ts\`. Ini adalah isu tipe pra-ada yang telah dicatat pada Gap Register.
2. \`npm run validate:example\`: ✅ *PASSED (Exit Code 0)*
   - Validasi skema kanonik flow pengujian berhasil 100% tanpa anomali.
3. \`npm run build\`: ✅ *PASSED (Exit Code 0)*
   - Bundle production \`apps/web/dist\` berhasil dikompilasi dalam 5.01 detik.

📁 *7 Dokumen Spesifikasi Lengkap di Repositori:*
1. \`docs/timbang/MASTER_SPEC.md\` (19.5 KB)
2. \`docs/timbang/ROUTE_AND_SCREEN_MAP.md\` (16.5 KB)
3. \`docs/timbang/BUSINESS_LOGIC.md\` (13.8 KB)
4. \`docs/timbang/API_AND_DATA_CONTRACTS.md\` (14.0 KB)
5. \`docs/timbang/UX_CHANGE_BOUNDARIES.md\` (13.3 KB)
6. \`docs/timbang/EVIDENCE_AND_GAPS.md\` (7.4 KB)
7. \`docs/timbang/REGRESSION_CHECKLIST.md\` (6.0 KB)

📦 *Download Paket ZIP Lengkap Spesifikasi:*
• *Remote URL:*
${tunnelUrl}/api/v1/zannora-evidence/artifacts/timbang-system-spec.zip
• *LAN Wi-Fi Lokal:*
http://192.168.10.66:4180/api/v1/zannora-evidence/artifacts/timbang-system-spec.zip

🌐 *Akses Dashboard QC Maestro:*
• URL: ${tunnelUrl}
• Akun: \`admin@qcmaestro.com\` / \`admin12345\`
-----------------------------------------
✅ *PROSES EKSTRAKSI SISTEM TIMBANG SELESAI & TERVERIFIKASI*`
  ];

  console.log(`[SendExtractionWA] Memulai pengiriman 5 bagian ekstraksi ke: ${target}`);

  for (let i = 0; i < messages.length; i++) {
    const label = `Bagian (${i + 1}/${messages.length})`;
    await sendMessage(token, target, messages[i], label);
    if (i < messages.length - 1) {
      console.log('[SendExtractionWA] Menunggu 2 detik sebelum mengirim pesan berikutnya...');
      await sleep(2000);
    }
  }

  console.log('[SendExtractionWA] Semua 5 bagian berhasil dikirim!');
}

main().catch(console.error);
