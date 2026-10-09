# QC Maestro — Task List untuk Plane

Dokumen ini adalah versi granular dari flow update QC Maestro. Setiap item dapat dibuat sebagai satu issue/task di Plane.

> Gunakan [QC_MAESTRO_MASTER_PHASES.md](./QC_MAESTRO_MASTER_PHASES.md) sebagai urutan phase utama dan Definition of Done keseluruhan.

## Mapping ke Plane yang sudah dicek

- Project tujuan: `Lainnya (Internal BU Customized Maintenance Managed Service)` (`LCMMS`).
- Work Items saat ini: 10 task.
- Cycle yang tersedia: `SIMPUL - Update Workflow`.
- Module yang tersedia: `SIMPUL`, `LINTAS`, `KULIK`, dan `QC System`.
- Module task QC: `QC System`, agar task QC tidak bercampur dengan task operasional lain.
- Assignee task QC: `Fauzan Yudistira` saja.
- Cycle task QC: kosong untuk sementara agar tidak tercampur sprint operasional.
- Status yang dipakai sistem: `TO DO`, `IN PROGRESS`, dan `DONE`.

Format status yang digunakan:

- `DONE` — pekerjaan sudah tersedia dan sudah diverifikasi.
- `IN PROGRESS` — pekerjaan sudah dimulai, tetapi masih ada bagian yang harus dilengkapi.
- `TO DO` — pekerjaan belum diselesaikan.

Target repository tetap read-only. Engine menghasilkan audit, finding, dan evidence; engine tidak memperbaiki source target secara otomatis.

## Phase 0 — Fondasi proyek

### P0-01 — Buat struktur monorepo QC Maestro

**Description:** Siapkan `apps/api`, `apps/web`, dan `packages/flow-schema` sebagai fondasi API, dashboard, dan schema flow.

**Status:** `DONE`

### P0-02 — Buat canonical QC Flow schema

**Description:** Tetapkan format YAML/JSON canonical untuk project, milestone, flow, step, assertion, viewport, dan evidence.

**Status:** `DONE`

### P0-03 — Tambahkan validator dan compiler flow

**Description:** Validasi konfigurasi QC lalu compile flow menjadi executable Playwright/Maestro scenario.

**Status:** `DONE`

### P0-04 — Siapkan penyimpanan artifact per project dan run

**Description:** Simpan input, milestone, screenshot, video, report, finding, log, manifest, progress, dan timeline dalam folder run terpisah.

**Status:** `DONE`

### P0-05 — Siapkan service Docker dan browser cache

**Description:** Sediakan API, web, PostgreSQL, Redis, MinIO, browser runtime, dan cache yang dapat digunakan ulang oleh engine.

**Status:** `DONE`

## Phase 1 — Runner dan runtime

### P1-01 — Implementasikan Playwright web adapter

**Description:** Jalankan open, click, fill, select, assert, screenshot, video, trace, retry, dan diagnostic error pada target web.

**Status:** `DONE`

### P1-02 — Implementasikan Maestro/ADB adapter

**Description:** Sediakan jalur eksekusi Android menggunakan Maestro/ADB ketika CLI dan device/emulator tersedia.

**Status:** `DONE`

### P1-03 — Implementasikan managed-local runner

**Description:** Jalankan repository lokal beserta service frontend/backend yang diperlukan sebelum audit dimulai.

**Status:** `DONE`

### P1-04 — Simpan runtime log secara realtime

**Description:** Kirim log bertag `SYSTEM`, `DATABASE`, `BROWSER`, dan `RUNNER` ke dashboard dengan timestamp dan filter.

**Status:** `DONE`

### P1-05 — Tambahkan runtime secret sementara

**Description:** Teruskan password atau credential hanya selama job berjalan dan jangan menyimpannya di job/artifact permanen.

**Status:** `DONE`

### P1-06 — Tambahkan timeout dan cleanup runner

**Description:** Pastikan browser, video, trace, PDF, dan service ditutup dengan aman ketika job selesai, gagal, atau dihentikan.

**Status:** `DONE`

## Phase 2 — Project intake dan environment

### P2-01 — Buat wizard input project

**Description:** Sediakan input nama project, repository URL, branch/ref, target URL, mode existing-target atau managed-local, dan akun audit.

**Status:** `DONE`

### P2-02 — Tambahkan konfigurasi database

**Description:** Dukung engine database, connection setting, SQL dump, migration, seed, fixture, reset, dan cleanup.

**Status:** `DONE`

### P2-03 — Tambahkan konfigurasi browser dan viewport

**Description:** Izinkan pemilihan Chromium, Firefox, WebKit serta desktop, tablet, dan mobile viewport dari dashboard.

**Status:** `DONE`

### P2-04 — Tampilkan status environment

**Description:** Tampilkan status target, container, database, browser, akun uji, dan service dependency sebelum run dimulai.

**Status:** `DONE`

### P2-05 — Reset dan cleanup fixture otomatis

**Description:** Reset database atau fixture ke kondisi awal dan membersihkan data sementara setelah run selesai tanpa mengubah source target.

**Status:** `DONE`

## Phase 3 — Discovery dan inventory

### P3-01 — Jalankan static source scan

**Description:** Deteksi route, controller, form, komponen, API, model, dan konfigurasi dari repository lokal jika source tersedia.

**Status:** `DONE`

### P3-02 — Jalankan dynamic Playwright crawl

**Description:** Crawl halaman target dengan batas halaman yang dapat dikonfigurasi dan catat DOM, route, link, tombol, form, tabel, modal, dan auth state.

**Status:** `DONE`

### P3-03 — Buat application inventory

**Description:** Simpan daftar halaman, route, endpoint, komponen interaktif, status HTTP, screenshot awal, dan metadata viewport/browser.

**Status:** `DONE`

### P3-04 — Tampilkan App Map

**Description:** Sajikan halaman dan hubungan navigasinya di dashboard, termasuk jumlah route serta status coverage.

**Status:** `DONE`

### P3-05 — Tampilkan Discovery Pipeline dan Live Terminal

**Description:** Tampilkan lima tahap discovery: runtime init, database bootstrap, static scan, dynamic crawl, dan flow synthesis/reporting.

**Status:** `DONE`

## Phase 4 — Capability intelligence dan test design

### P4-01 — Buat capability catalog domain-neutral

**Description:** Kenali authentication, authorization, form, search, filter, pagination, modal, wizard, CRUD, upload, download, catalog, checkout, payment, reservation, approval, notification, report, CMS, API, realtime, dan localization.

**Status:** `DONE`

### P4-02 — Buat capability profile dari hasil discovery

**Description:** Simpan capability, confidence, evidence route/selector, domain hint, dan fitur yang belum dapat dipastikan.

**Status:** `DONE`

### P4-03 — Generate test flow berdasarkan capability

**Description:** Hasilkan test design sesuai fitur yang benar-benar ditemukan agar engine tidak bergantung pada domain airline saja.

**Status:** `DONE`

### P4-04 — Generate role dan action matrix

**Description:** Petakan role, permission, visible action, enabled action, dan pembatasan akses pada setiap halaman/fitur.

**Status:** `DONE`

### P4-05 — Generate negative scenario plan

**Description:** Susun skenario empty/invalid input, duplicate, delete in-use, payment failure, expired transaction, cancellation, conflict, dan empty result.

**Status:** `DONE`

### P4-06 — Tambahkan fixture adapter untuk transaksi

**Description:** Sediakan fixture/API contract aman untuk skenario yang membutuhkan data nyata seperti duplicate record, delete dependency, payment, refund, expiry, dan cancellation.

**Status:** `DONE`

## Phase 5 — Dashboard dan milestone

### P5-01 — Buat project selector dan current project context

**Description:** Semua halaman dashboard harus membaca project aktif yang sama dan tidak mencampur artifact antar repository.

**Status:** `DONE`

### P5-02 — Buat Milestone Flow delapan checkpoint

**Description:** Tampilkan Start & Analysis, Setup Environment, Discovery & Inventory, Test Design, Execution, Responsive & UI Quality, Evidence & Retest, dan Defect & Final Report.

**Status:** `DONE`

### P5-03 — Hubungkan milestone ke data realtime

**Description:** Status, progress, jumlah output, dan milestone aktif harus berubah mengikuti job yang sedang berjalan.

**Status:** `DONE`

### P5-04 — Tampilkan detail milestone sebagai floating card

**Description:** Klik milestone membuka detail substep, branch, output, log, evidence, dan status tanpa memindahkan user ke halaman yang tidak relevan.

**Status:** `DONE`

### P5-05 — Tambahkan animasi flow yang informatif

**Description:** Gunakan connector line yang bergerak hanya pada jalur aktif, node completed/active/blocked/queued yang jelas, dan dukungan reduced-motion.

**Status:** `DONE`

### P5-06 — Hilangkan dekorasi animasi yang membingungkan

**Description:** Hapus lingkaran berulang, node duplikat, overlap, dan milestone latar belakang yang tidak mewakili status pekerjaan.

**Status:** `DONE`

## Phase 6 — Execution dan evidence

### P6-01 — Jalankan semua flow dari dashboard

**Description:** User dapat memulai discovery, test flow, quality audit, dan report dari dashboard dengan satu project context.

**Status:** `DONE`

### P6-02 — Simpan screenshot per checkpoint

**Description:** Screenshot harus memiliki project, run, flow, route, viewport, browser, timestamp, dan area pemeriksaan.

**Status:** `DONE`

### P6-03 — Simpan video standar 30 FPS 720p

**Description:** Semua video audit menggunakan standar 30 FPS dan 720p dengan nama project/flow yang terstruktur, bukan ID acak saja.

**Status:** `DONE`

### P6-04 — Simpan trace dan JSON report

**Description:** Simpan trace Playwright bila tersedia, step result, request error, assertion error, dan metadata eksekusi.

**Status:** `DONE`

### P6-05 — Buat Evidence Center per project dan run

**Description:** Tampilkan folder evidence, video, screenshot, report, dan link download sesuai project aktif.

**Status:** `DONE`

### P6-06 — Gabungkan video menjadi full-flow timeline

**Description:** Gabungkan potongan video per flow menjadi video lengkap dengan urutan checkpoint dan marker timeline.

**Status:** `DONE`

### P6-07 — Tampilkan evidence inline di Findings & Retest

**Description:** Klik `Lihat bukti` membuka dropdown/inline panel berisi screenshot, route, viewport, browser, diagnosis, dan file terkait tanpa pindah halaman.

**Status:** `DONE`

## Phase 7 — Quality audit

### P7-01 — Audit responsive dan overflow

**Description:** Periksa clipping, overflow horizontal, tabel keluar layar, tombol terpotong, form terlalu lebar, dan layout dashboard pada desktop/tablet/mobile.

**Status:** `DONE`

### P7-02 — Audit warna dan contrast WCAG

**Description:** Evaluasi warna teks, background, border, button, placeholder, badge, disabled state, dan contrast ratio berdasarkan aturan WCAG.

**Status:** `DONE`

### P7-03 — Audit typography dan alignment

**Description:** Periksa ukuran teks, line-height, font consistency, spacing, alignment, text clipping, dan control size 28–64px.

**Status:** `DONE`

### P7-04 — Audit accessibility semantic

**Description:** Periksa label form, accessible name, heading structure, duplicate ID, broken ARIA reference, hidden interactive element, dan semantic tree.

**Status:** `DONE`

### P7-05 — Audit keyboard dan focus

**Description:** Periksa tab order, keyboard reachability, visible focus indicator, modal focus behavior, dan interactive control yang dapat diakses tanpa mouse.

**Status:** `DONE`

### P7-06 — Tambahkan screen reader nyata

**Description:** Lengkapi heuristic dengan pengujian NVDA/VoiceOver/TalkBack pada environment yang mendukung.

**Status:** `IN PROGRESS`

### P7-07 — Audit visual regression pixel-by-pixel

**Description:** Capture baseline PNG, bandingkan pixel, hitung diff, laporkan baseline hilang/berubah/lulus, dan simpan screenshot diff.

**Status:** `DONE`

### P7-08 — Jadikan visual baseline required

**Description:** Setelah baseline stabil, ubah mode dari `capture` menjadi `required` agar baseline yang hilang menjadi finding.

**Status:** `DONE`

### P7-09 — Audit state interaktif

**Description:** Periksa hover, focus, disabled, loading, empty, error, success, validation, modal, tooltip, dan skeleton state secara interaktif.

**Status:** `DONE`

### P7-10 — Audit dense data

**Description:** Uji tabel/form dengan banyak baris, teks panjang, pagination, filter, action column, dan data kosong untuk mendeteksi layout rusak.

**Status:** `DONE`

### P7-11 — Jalankan cross-browser audit

**Description:** Jalankan checkpoint pada Chromium, Firefox, dan WebKit untuk setiap viewport yang dikonfigurasi.

**Status:** `DONE`

## Phase 8 — Negative testing dan retest

### P8-01 — Jalankan empty dan invalid input test

**Description:** Uji submit form kosong, format salah, batas minimum/maksimum, dan validasi error tanpa membuat data target yang tidak diinginkan.

**Status:** `DONE`

### P8-02 — Jalankan network failure probe

**Description:** Simulasikan kegagalan request non-mutating dan pastikan UI menampilkan error, retry, atau empty state yang jelas.

**Status:** `DONE`

### P8-03 — Jalankan duplicate submit probe

**Description:** Uji double click atau submit berulang secara aman dan catat apakah UI mencegah request ganda.

**Status:** `DONE`

### P8-04 — Jalankan duplicate record test

**Description:** Uji penolakan atau penanganan data duplikat dengan fixture yang dapat di-reset.

**Status:** `DONE`

### P8-05 — Jalankan delete data terpakai test

**Description:** Uji penghapusan record yang masih dipakai record lain dan periksa pesan/error dependency.

**Status:** `IN PROGRESS`

### P8-06 — Jalankan payment failure, expiry, dan refund test

**Description:** Uji pembayaran gagal, timeout/expired, refund, status transisi, dan pesan kepada user menggunakan sandbox/fixture.

**Status:** `DONE`

### P8-07 — Jalankan cancellation dan capacity restore test

**Description:** Uji pembatalan pending/paid, pengembalian kapasitas/seat, dan konsistensi status setelah cancellation.

**Status:** `DONE`

### P8-08 — Implementasikan Findings & Retest workflow

**Description:** Kelola status finding `Open → In Progress → Ready for Retest → Passed` dengan evidence sebelum dan sesudah retest.

**Status:** `DONE`

## Phase 9 — Reporting dan CI/CD

### P9-01 — Buat JSON, HTML, dan PDF report

**Description:** Generate report yang berisi coverage, pass/fail, finding, severity, route, viewport, browser, evidence, dan limitation.

**Status:** `DONE`

### P9-02 — Tambahkan category summary

**Description:** Kelompokkan hasil berdasarkan authentication, HTTP, contrast, responsive, typography, accessibility, visual, dense-data, dan negative testing.

**Status:** `DONE`

### P9-03 — Buat quality regression gate

**Description:** `qc:gate` membaca report dan mengembalikan exit code gagal jika finding melebihi quality budget.

**Status:** `DONE`

### P9-04 — Buat workflow CI GitHub Actions

**Description:** Jalankan typecheck, quality audit, dan regression gate pada pipeline QC Maestro.

**Status:** `DONE`

### P9-05 — Buat adapter CI untuk repository target

**Description:** Sediakan cara menjalankan audit repository lain melalui artifact/config tanpa mengubah source target secara otomatis.

**Status:** `DONE`

### P9-06 — Buat history dan trend antar-run

**Description:** Tampilkan perubahan pass rate, jumlah finding, severity, coverage, dan waktu eksekusi antar run.

**Status:** `DONE`

### P9-07 — Buat retention dan cleanup policy

**Description:** Atur masa simpan screenshot, video, trace, report, dan log serta cleanup yang aman berdasarkan project/run.

**Status:** `DONE`

## Phase 10 — Audit target saat ini

### P10-01 — Jalankan audit Zannora (Website Testing) end-to-end

**Description:** Jalankan discovery, test design, functional flow, UI quality, evidence, findings, retest, dan final report untuk Zannora.

**Status:** `DONE`

### P10-02 — Jalankan audit Cakrawala (Website Testing) end-to-end

**Description:** Jalankan audit pada target Cakrawala tanpa memodifikasi source repository dan simpan semua evidence berdasarkan project/run.

**Status:** `DONE`

### P10-03 — Tampilkan hasil Cakrawala di project context yang benar

**Description:** Pastikan selector project, milestone, findings, evidence, video, report, dan runtime log Cakrawala tidak menampilkan artifact Zannora.

**Status:** `DONE`

### P10-04 — Kelompokkan finding Cakrawala berdasarkan lokasi

**Description:** Setiap finding harus menampilkan judul, deskripsi kesalahan, area, route, viewport, browser, severity, screenshot, dan video terkait.

**Status:** `DONE`

### P10-05 — Jadikan Cakrawala sebagai regression baseline

**Description:** Simpan baseline visual dan quality report Cakrawala agar run berikutnya dapat dibandingkan secara konsisten.

**Status:** `DONE`

## Phase 11 — Full CRUD & Capture Lifecycle (Kamis, 1 Oktober 2026)

### P11-01 — Full CRUD Test Suite & 3-Choice Auto-Seeder

**Description:** Mengintegrasikan 3 metode inisialisasi basis data: Auto-seed Laravel, unggah berkas SQL dump, dan koneksi ke Live DB existing untuk pengujian CRUD lengkap.

**Status:** `DONE`

### P11-02 — Continuous 720p 30 FPS Lossless Video Recording

**Description:** Implementasi perekaman video Playwright terpadu resolusi 720p pada 30 FPS untuk merekam seluruh sesi pengujian aplikasi web secara lossless.

**Status:** `DONE`

### P11-03 — Staging Admin Authentication Gate & HMAC Session Token

**Description:** Menambahkan gerbang login admin staging dengan otentikasi token session HMAC berbasis backend Fastify dan pembersihan field awal demi keamanan kredensial.

**Status:** `DONE`

### P11-04 — Pemulihan Arsitektur Flagging Mobile Support (Android)

**Description:** Mengamankan dan memulihkan feature flag ENABLE_MOBILE_SUPPORT untuk kontrol fitur target mobile Android pada monorepo QC Maestro.

**Status:** `DONE`

## Phase 12 — Mobile Android Subsystem (Jumat, 2 Oktober 2026)

### P12-01 — Android Emulator Subsystem Bridge (ADB & Runner)

**Description:** Merancang dan mengimplementasikan modul jembatan emulator Android: adb.ts, emulator-runner.ts, dan sistem deteksi perangkat mobile otomatis.

**Status:** `DONE`

### P12-02 — Mobile QC Run Wizard Form (APK Upload & ADB Verify)

**Description:** Menyediakan form input pengujian aplikasi Android di Wizard: upload file APK, deteksi otomatis packageId dan version, serta verifikasi koneksi ADB.

**Status:** `DONE`

### P12-03 — Maestro YAML Runner Engine & Mobile Pipeline

**Description:** Menyiapkan engine eksekutor sintaks Maestro YAML untuk pengetesan alur aplikasi mobile native Android dan milestone pipeline execution.

**Status:** `DONE`

## Phase 13 — Live Viewport & Context Isolation (Sabtu, 3 Oktober 2026)

### P13-01 — Headless Live Viewport & Remote Stream Control Center

**Description:** Membangun komponen Live Viewport streaming visual interaktif untuk memantau aksi browser Playwright secara realtime selama audit berlangsung.

**Status:** `DONE`

### P13-02 — Multi-Project Context Isolation & Active Run Switcher

**Description:** Mengisolasi penyimpanan artefak, log, dan riwayat attempt antar target audit (Zannora, Cakrawala, Taskia, Jamaahku) dengan dropdown context switcher.

**Status:** `DONE`

## Phase 14 — Visual Evidence & Defect Triage (Minggu, 4 Oktober 2026)

### P14-01 — Visual Evidence Gallery & Multi-Media Trace Center

**Description:** Menyediakan galeri bukti uji komprehensif: screenshot thumbnail, video playback, Playwright trace viewer zip, dan bundle manifest terstruktur.

**Status:** `DONE`

### P14-02 — Automated Defect Triage & Instant Retest Workflow

**Description:** Implementasi manajemen siklus defect triage (Open -> In Progress -> Ready for Retest -> Passed) dengan komparasi bukti sebelum dan sesudah verifikasi.

**Status:** `DONE`

## Phase 15 — Discovery Engine & Flow Synthesis (Senin, 5 Oktober 2026)

### P15-01 — Deep Crawler & Autonomous Route Inventory Discovery

**Description:** Mengembangkan crawler otonom untuk memindai seluruh rute, link tersembunyi, form action, dan elemen interaktif web aplikasi tanpa batasan.

**Status:** `DONE`

### P15-02 — Dynamic Business Flow Synthesis & Functional State Generator

**Description:** Sintesis otomatis peta alur bisnis aplikasi (BusinessFlowMap) yang mengelompokkan alur fungsional berdasarkan kategori dan aktor.

**Status:** `DONE`

## Phase 16 — Live Terminal & Telemetry (Selasa, 6 Oktober 2026)

### P16-01 — Real-Time Interactive Discovery Terminal & ANSI Visualizer

**Description:** Terminal telemetri langsung discovery dengan parser kode warna ANSI, filter log bertag (SYSTEM, RUNNER, BROWSER, DATABASE), dan auto-scroll.

**Status:** `DONE`

### P16-02 — Granular Network & Database Activity Monitoring Telemetry

**Description:** Pencatatan telemetri request/response HTTP, status code API, dan query mutasi database yang terjadi selama penelusuran alur pengujian.

**Status:** `DONE`

## Phase 17 — Wizard Streamline, Flow Gate & Error Attribution (Rabu, 7 Oktober 2026)

### P17-01 — Streamline Wizard Form (Prioritas DB & Form Akun Kedua)

**Description:** Menata ulang Langkah 1 Wizard QC Maestro: penempatan metode inisialisasi basis data di paling atas (Seksi 1) dan form kredensial akun di seksi kedua.

**Status:** `DONE`

### P17-02 — Eliminasi Clutter Form & Enforce 100% Deep Testing Matrix

**Description:** Membersihkan seluruh saklar/pill clutter form dan mengaktifkan 100% kapabilitas pengujian mendalam (3 browser, 3 viewport, max depth 8, unconstrained routes) di balik layar.

**Status:** `DONE`

### P17-03 — Mandatory Business Flow Review Gate & Auto-Switch Terminal

**Description:** Jeda review wajib (WAITING_REVIEW) setelah sintesis alur bisnis sebelum eksekusi terminal berjalan. Otomatis redirect ke Flow visualizer dan kembali ke live terminal setelah acc.

**Status:** `DONE`

### P17-04 — Modernisasi Papan Review Linear-Style Wizard Langkah 2

**Description:** Mendesain ulang papan review konfirmasi akhir Linear-style yang merangkum seluruh form: Target Frontend/API probe, Database method, Akun audit, dan matrix kapabilitas 100%.

**Status:** `DONE`

### P17-05 — Sistem Pelaporan Mutu & Atribusi Error (User App vs QC Engine)

**Description:** Perhitungan persentase skor kelulusan dinamis dan pemisahan tegas sumber defek antara bug kode aplikasi user vs runner engine QC Maestro pada kartu KPI dan laporan.

**Status:** `DONE`

### P17-06 — Integrasi Defect Ledger & Verifikasi Monorepo QC Maestro

**Description:** Menambahkan tabel Defect Ledger lengkap dengan jejak diagnosis teknis, failure thumbnail zoom, dan advice perbaikan pada dashboard dan ekspor PDF/HTML, serta verifikasi build monorepo.

**Status:** `DONE`

## Phase 18 — Incremental Testing & Enhanced UX (Rencana Berjalan)

### P18-01 — Selective Delta Re-Testing via GitHub Push (Change-Impact Analysis)

**Description:** Mekanisme pengujian diferensial selektif saat user melakukan git push ke GitHub. Engine mendeteksi file dan komponen yang mengalami perubahan (git diff/tree impact), lalu hanya menguji ulang modul dan rute terkait tanpa perlu menjalankan audit keseluruhan web.

**Status:** `IN PROGRESS`

### P18-02 — Redesain UX & UI Seluruh Tab Navigasi agar Lebih User-Friendly

**Description:** Modernisasi antarmuka seluruh tab kontrol QC Maestro (Setup, Discovery, Terminal, Flow, Quality, Findings, Evidence, Reports) menjadi lebih intuitif, user-friendly, bebas clutter, dan responsif dengan visual feedback real-time.

**Status:** `IN PROGRESS`

## Kondisi runtime saat ini

- QC Dashboard/API: `http://localhost:4101`
- Target Cakrawala: `http://localhost:8080`
- Latest Cakrawala audit: `1.123/1.332` pass dan `209` finding.
- Target source: tidak dimodifikasi oleh engine.

## Acceptance criteria keseluruhan

QC Maestro siap dipakai lintas repository apabila semua task `IN PROGRESS` menjadi `DONE`, task `TO DO` yang relevan sudah dikerjakan, seluruh route hasil discovery memiliki coverage, setiap finding memiliki evidence yang dapat dibuka inline, dan regression gate dapat menggagalkan build ketika quality budget terlampaui.
