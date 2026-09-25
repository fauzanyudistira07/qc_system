# QC Maestro — Flow Update dari Awal sampai Sekarang

Dokumen ini adalah ringkasan perjalanan folder `qc_maestro` yang siap dipindahkan menjadi Project, Initiative, Epic, atau Issue di Plane.

> Roadmap eksekusi utama yang menggabungkan seluruh gap QC tersedia di [QC_MAESTRO_MASTER_PHASES.md](./QC_MAESTRO_MASTER_PHASES.md).

## 1. Tujuan produk

QC Maestro adalah platform QC lokal untuk menerima input repository/website, menyiapkan environment, melakukan discovery, menyusun flow berdasarkan capability aplikasi, menjalankan browser/mobile test, memeriksa kualitas UI, mengumpulkan screenshot/video/report, lalu menyajikan milestone dan finding secara realtime.

Prinsip penting:

- Target repository bersifat read-only selama audit.
- Engine melaporkan error dan bukti; engine tidak memperbaiki source target secara otomatis.
- Flow dibuat domain-neutral agar dapat dipakai untuk airline, commerce, SaaS, education, healthcare, finance, CMS, dan aplikasi umum lainnya.
- Setiap run mempunyai folder project/run sendiri serta manifest milestone.

## 2. Alur end-to-end

```text
Input project/repository/URL
        ↓
Validasi konfigurasi, akun, backend, database, dan target
        ↓
Setup environment / container / browser / database fixture
        ↓
Discovery: static scan + dynamic crawl + route/page inventory
        ↓
Capability profile + domain hints + negative scenario plan
        ↓
Test design: generate flow yang sesuai fitur yang terdeteksi
        ↓
Execution: Playwright / Maestro + runtime log + screenshot/video
        ↓
Quality audit: responsive, contrast, typography, accessibility,
visual regression, dense data, dan negative testing aman
        ↓
Evidence center: report, screenshot, video, trace, folder terstruktur
        ↓
Finding & Retest: open → in progress → ready for retest → passed
        ↓
Final report + CI/CD regression gate
```

## 3. Perjalanan update folder

### Fase 0 — Fondasi repository

Status: selesai sebagai baseline.

Output utama:

- Monorepo `apps/api`, `apps/web`, `packages/flow-schema`.
- Dashboard React + API Fastify + TypeScript.
- QC Flow YAML sebagai format canonical.
- Validator dan compiler ke Playwright/Maestro.
- Persistence lokal di `.qc-artifacts`.
- Infrastruktur PostgreSQL, Redis, dan MinIO melalui Docker Compose.

### Fase 1 — Flow engine dan runner

Status: selesai untuk web; Android tersedia dengan dependensi device/CLI.

Output utama:

- Simulation runner.
- Playwright web adapter.
- Maestro/ADB adapter untuk Android.
- Screenshot, video, trace, step result, retry, dan error diagnostic.
- Managed-local runner untuk repository dengan service frontend/backend.
- Runtime password dikirim sementara saat run dan tidak disimpan ke job.

### Fase 2 — Project intake dan setup environment

Status: selesai dan berjalan di dashboard.

Input yang didukung:

- Nama project.
- Repository URL dan branch/ref.
- Base URL target.
- Existing target atau managed local.
- Akun audit.
- Database engine, SQL dump, migration, seed, dan environment upload.
- Browser dan viewport Quality Audit.

Output:

- Project config tanpa password di folder input.
- Workspace project/run.
- Runtime service status.
- Live progress dan runtime log.

### Fase 3 — Discovery dan application inventory

Status: selesai dan sudah dipakai pada Zannora serta Cakrawala.

Engine melakukan:

- Static source scan jika repository lokal tersedia.
- Dynamic Playwright crawl jika target berupa URL/existing target.
- Deteksi route, halaman, form, tombol, link, tabel, modal, dan status authentication.
- Penyimpanan `application-inventory.json`.
- Live log per tahap discovery.

### Fase 4 — Capability intelligence dan test design

Status: selesai dan sudah diperluas.

Capability yang dapat dikenali antara lain:

- Authentication dan authorization.
- Form, search/filter, pagination, modal, wizard.
- CRUD, tabel, upload/download, catalog, cart, checkout.
- Payment, reservation, scheduling, approval workflow.
- Notification, messaging, ticket/support.
- Dashboard/reporting, CMS, media, API, realtime, localization.

Output tambahan:

- Domain hints.
- Confidence dan evidence tiap capability.
- Flow generik berdasarkan fitur yang benar-benar terdeteksi.
- Negative scenario plan, termasuk duplicate record, delete data terpakai, payment failed/refund/expired, cancellation, conflict scheduling, dan empty result.

### Fase 5 — Dashboard, milestone, dan live orchestration

Status: selesai secara UI dan sudah terhubung ke job aktif.

Bagian utama:

- Project selector.
- New QC Run/wizard.
- Milestone Flow dengan delapan checkpoint.
- Discovery & Inventory.
- App Map.
- Test Design.
- Execution Runs.
- Live Viewport.
- Findings & Retest.
- Evidence Center.
- Final Report.
- Settings & Engines.

Milestone menyimpan output ke:

```text
.qc-artifacts/projects/<project-slug>/runs/<run-label>/
├── input/
├── milestones/
│   ├── 01-start-analysis/
│   ├── 02-setup-environment/
│   ├── 03-discovery-inventory/
│   ├── 04-test-design/
│   ├── 05-execution/
│   ├── 06-responsive-ui/
│   ├── 07-evidence-retest/
│   └── 08-final-report/
├── evidence/
│   ├── screenshots/
│   ├── videos/
│   └── reports/
├── findings/
├── runtime-artifacts/
├── manifest.json
├── progress.json
└── timeline.json
```

### Fase 6 — Evidence dan reporting

Status: selesai dan sudah digunakan.

Evidence yang dihasilkan:

- Screenshot per route, browser, viewport, dan checkpoint.
- Video standar 30 FPS 720p.
- Trace Playwright jika tersedia.
- JSON report.
- HTML/PDF report.
- Folder evidence per project dan run.
- Inline evidence inspector di dashboard.
- Finding dapat membuka screenshot sesuai route, viewport, browser, dan area error.

### Fase 7 — Quality Audit UI dan cross-browser

Status: engine selesai; target masih memiliki finding.

Rule yang sudah diterapkan:

- HTTP response.
- WCAG contrast heuristic.
- Typography, clipping, overlap, line-height, dan control size.
- Responsive overflow desktop/tablet/mobile.
- Label form dan accessible name.
- Duplicate ID dan broken ARIA reference.
- Keyboard focus indicator dan heading structure.
- Screen-reader semantic tree heuristic.
- Chromium, Firefox, dan WebKit.
- Visual regression PNG pixel-by-pixel.
- Dense table/form stress.
- Empty/invalid form validation.
- Network failure probe dengan mutating request di-abort.
- Double-submit guard.

Mode visual regression:

- `capture`: baseline dibuat jika belum ada, lalu dibandingkan jika sudah ada.
- `required`: baseline wajib ada; baseline hilang menjadi finding.
- `off`: pemeriksaan pixel dimatikan.

### Fase 8 — Run Zannora dan Cakrawala (Website Testing)

Status: audit sudah berjalan; perbaikan target tidak dilakukan otomatis.

Zannora (Website Testing):

- Latest functional flow per flow: 13/13 pass.
- Evidence screenshot/video/report tersedia.
- Quality finding tetap diperlakukan sebagai finding sampai ada retest.

Cakrawala (Website Testing):

- Target berjalan di `http://localhost:8080`.
- QC Dashboard berjalan di `http://localhost:4101`.
- Audit terbaru: 1.123/1.332 pass, 209 finding.
- 90 checkpoint visual pada tiga browser dan tiga viewport.
- 90/90 visual regression check tercatat.
- Source repository Cakrawala tidak diubah.

## 4. Struktur issue yang bisa dimasukkan ke Plane

### EPIC A — Foundation & Runtime

- A1 — Canonical QC Flow schema dan validator — Done.
- A2 — Playwright web adapter — Done.
- A3 — Maestro/ADB adapter — Partial; membutuhkan CLI dan device.
- A4 — Managed local service runner — Done untuk stack yang didukung.
- A5 — Container, artifact storage, dan browser cache di drive terpisah — Done.

### EPIC B — Project Intake & Discovery

- B1 — Project wizard/repository intake — Done.
- B2 — Database/env/account configuration — Done.
- B3 — Static source scanner — Done untuk repository lokal.
- B4 — Dynamic UI crawler — Done.
- B5 — Application inventory dan app map — Done.
- B6 — Live runtime log dan progress milestone — Done.

### EPIC C — Capability & Test Design

- C1 — Capability catalog domain-neutral — Done.
- C2 — Flow generation berdasarkan capability — Done.
- C3 — Negative scenario plan — Done.
- C4 — Fixture adapter untuk skenario destructive/transactional — Backlog.

### EPIC D — Execution & Evidence

- D1 — Run flow dari dashboard — Done.
- D2 — Runtime screenshot/video/trace — Done.
- D3 — Folder project/run/milestone — Done.
- D4 — Inline evidence dropdown berdasarkan lokasi finding — Done.
- D5 — Full-flow video stitching/timeline — Partial; perlu penyatuan video lintas flow yang konsisten.

### EPIC E — UI Quality & Accessibility

- E1 — Responsive desktop/tablet/mobile — Done sebagai rule audit.
- E2 — Contrast WCAG — Done sebagai rule audit; target masih punya finding.
- E3 — Typography, clipping, spacing, alignment — Done sebagai rule audit; target masih punya finding.
- E4 — Keyboard/focus/screen-reader heuristic — Done.
- E5 — Visual regression baseline — Done; baseline pertama sudah dibuat.
- E6 — Dense table/form stress — Done.
- E7 — Cross-browser Chromium/Firefox/WebKit — Done.
- E8 — State testing hover/focus/disabled/loading/empty/error secara interaktif — Backlog.
- E9 — Screen reader OS nyata/NVDA/VoiceOver — Backlog; saat ini memakai semantic-tree heuristic.

### EPIC F — Negative Testing & Business Flow

- F1 — Empty/invalid input — Done.
- F2 — Duplicate submit/network failure — Done dengan safe probe.
- F3 — Duplicate record — Planned; membutuhkan fixture/API contract.
- F4 — Delete data terpakai — Planned; membutuhkan fixture dependency.
- F5 — Payment failed/expired/refund — Planned; membutuhkan sandbox payment/fixture.
- F6 — Reservation expired/cancellation/restore capacity — Planned; membutuhkan fixture transaksi.
- F7 — Role/action matrix per target — Partial; capability terdeteksi, coverage target-specific perlu diperluas.

### EPIC G — Reporting & CI/CD

- G1 — JSON/HTML/PDF report — Done.
- G2 — Findings & retest workflow — Done.
- G3 — Category summary pada report — Done.
- G4 — `qc:gate` exit-code regression gate — Done.
- G5 — GitHub Actions workflow — Done di QC Maestro.
- G6 — Adapter CI/CD per repository target — Backlog; target repository tetap tidak diubah otomatis.
- G7 — History/trend antar run — Partial; artifact history ada, grafik trend belum lengkap.

## 5. Kondisi saat ini

```text
QC Maestro source update     : working tree berubah, belum di-commit
API                         : localhost:4101
Target Cakrawala            : localhost:8080
Plane project               : LCMMS / Lainnya
Plane module                : QC System
Functional discovery        : berjalan
Quality audit engine        : aktif
Target source mutation      : tidak dilakukan
Latest Cakrawala audit      : 1.123/1.332 pass, 209 finding
Overall target status       : FAILED sampai finding ditangani dan retest pass
```

## 6. Urutan pekerjaan berikutnya

1. Jadikan baseline visual sebagai `required` pada regression run berikutnya.
2. Kelompokkan 209 finding berdasarkan root cause CSS/component agar tidak memperbaiki item satu per satu secara buta.
3. Tambahkan fixture adapter untuk duplicate record, delete dependency, payment failure/refund/expiry, dan cancellation.
4. Tambahkan interactive state audit: hover, focus, disabled, loading, empty, dan error.
5. Tambahkan real screen-reader pass dengan NVDA/VoiceOver pada environment yang mendukung.
6. Tambahkan history/trend dan artifact retention policy.
7. Hubungkan report JSON ke CI target melalui input artifact atau API, tanpa memodifikasi source target.
8. Commit perubahan QC Maestro setelah review, lalu jadikan `qc:gate` sebagai regression gate.

## 7. Acceptance criteria final

QC Maestro dianggap siap dipakai lintas repository jika:

- Discovery tidak bergantung pada domain airline.
- Semua halaman/route yang ditemukan masuk inventory dan test design.
- Functional flow, negative flow, dan quality audit mempunyai evidence.
- Finding selalu menyimpan area, route, browser, viewport, detail, dan screenshot.
- Visual regression dapat membedakan baseline hilang, baseline berubah, dan baseline lulus.
- CI gate mengembalikan exit code gagal bila quality budget terlampaui.
- Target repository tetap tidak dimodifikasi oleh engine audit.
- Final report menyatakan dengan jelas pass, finding, retest, dan coverage yang belum applicable.
