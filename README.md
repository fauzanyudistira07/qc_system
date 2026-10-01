# QC Maestro

QC automation platform lokal untuk menjalankan flow web melalui Playwright dan Android melalui Maestro. QC Flow adalah format canonical; artefak Playwright/Maestro merupakan hasil kompilasi.

## Rancangan QC lintas proyek

[Paket rancangan general](docs/RANCANGAN_QC_GENERAL.md) memisahkan [QC website](docs/RANCANGAN_QC_WEBSITE_GENERAL.md) dan [QC mobile](docs/RANCANGAN_QC_MOBILE_GENERAL.md), dengan [kontrak report, screenshot, video, dan JSON](docs/KONTRAK_QC_GENERAL_REPORT_EVIDENCE.md). Rancangan mencakup deep CRUD, warna/layout, responsive tablet, serta coverage dan evidence per assertion. Format draft di dalamnya belum menjadi input runner saat ini.

## Baseline lokal

Baseline ini menyediakan dashboard React + TypeScript dengan project intake dan live preview, API Fastify + TypeScript, QC Flow schema/validator, normalized flow, run simulation, Playwright web adapter, serta PostgreSQL, Redis, dan MinIO untuk infrastruktur lokal.

Project dan ringkasan run disimpan lokal di `.qc-artifacts/qc-state.json`; flow mentah tidak disimpan karena dapat berisi credential test. Ini single-instance local persistence, belum storage untuk beberapa server. Maestro YAML compiler dan adapter Maestro/ADB tersedia; eksekusi Android tetap memerlukan Maestro CLI serta device/emulator yang terhubung. Nina generation worker belum aktif. API tetap dapat dijalankan tanpa GitHub key dan Solu AI key.

## Menjalankan lokal

```powershell
Copy-Item .env.example .env
npm install
npm run infra:up
npm run playwright:install
```

Terminal 1:

```powershell
npm run dev:demo
```

Terminal 2:

```powershell
npm run dev
```

Buka Dashboard di http://localhost:5173, API health di http://localhost:4100/health, dan demo app di http://localhost:4173/login. Wizard website mendukung tiga sumber target:

- `Existing target`: isi URL/port yang sudah berjalan. QC melakukan health check dan membuka browser Playwright baru.
- `Folder kerja lokal`: isi path folder project. Jika port target belum aktif, QC menyalin folder ke workspace sementara, mendeteksi frontend/backend, lalu menyalakan service otomatis.
- `GitHub`: isi repository dan branch/ref. Jika port target belum aktif, QC melakukan shallow clone ke workspace sementara, bukan ke Desktop, lalu menyalakan service otomatis.

Untuk mode managed-local, `Auto-detect stack` mendukung Laravel/PHP, Node, Python/Django/ASGI, dan Go, termasuk manifest di subfolder. Service custom harus mengisi `Docker runtime image` di Advanced settings. Docker Compose dan Dockerfile auto-run sementara ditolak karena belum punya policy build/network yang aman. Service runtime tetap hidup selama discovery, browser flow, dan quality audit, kemudian dibersihkan. Panel preview menampilkan progress service, status fase, dan screenshot dari sesi browser yang sama.

Runtime policy saat ini membatasi maksimal 2 project aktif (`QC_MAX_ACTIVE_PROJECTS=2`). Clone GitHub yang dipakai managed-local disimpan di bucket `.qc-artifacts/clones` selama 7 hari secara default untuk inspeksi/re-run, sedangkan report/evidence non-clone disimpan maksimal 30 hari. Nilai retention dapat diubah melalui `QC_CLONE_RETENTION_DAYS`, `QC_ARTIFACT_RETENTION_DAYS`, dan interval cleanup melalui `QC_RETENTION_CLEANUP_INTERVAL_HOURS`. Screenshot, video, trace, dan log flow Playwright dipisahkan ke folder artifact masing-masing.

Quality Audit website menjalankan deep web layer otomatis setelah baseline: navigation/performance budget, form boundary dan password autocomplete, safe GET API contract, parallel GET stability, runtime authorization/session bila route protected terdeteksi, network recovery bila route memiliki fetch/XHR, upload/download affordance, security response headers, console/page errors, dan failed network request. Audit juga menyimpan `human-review-checklist.md`; keputusan UX subjektif dan verifikasi screen reader nyata tetap harus dilakukan reviewer manusia.

Jika opsi `Review Business Flow sebelum eksekusi` aktif, discovery menyusun `business-flow-map.json` secara adaptif dari capability, domain hint, role/action matrix, CRUD resource, route, API, dan elemen yang terobservasi. Dashboard menampilkan actor, trigger, langkah, expected outcome, negative/recovery path, confidence, evidence, dan limitation; reviewer menyetujui map sebelum Playwright flow dijalankan. Mode `auto` tetap tersedia untuk CI atau run tanpa human gate, tetapi kandidat inferensi tetap dicatat sebagai limitation.

Install/start berjalan di container Linux dengan batas CPU, memori, jumlah proses, kapabilitas yang dibuang, dan jaringan khusus per run. Port service hanya dipublish ke loopback host; container tidak diberi Docker socket. Docker Desktop harus aktif. Service dalam satu run dapat saling mengakses melalui alias/container network; sesuaikan host database/API di `.env` bila sebelumnya menunjuk ke `localhost`. Dependency eksternal yang diwajibkan repository—misalnya database, Redis, API online, atau kredensial—tetap perlu disediakan dan tidak dibuat otomatis.

`Working directory` bersifat relatif terhadap root repository hasil clone: gunakan `.` jika `artisan`, `composer.json`, atau `package.json` berada di root; gunakan `backend` atau `frontend` jika berada di subfolder. Pada auto-detect, runner mengisi ini sendiri; Advanced settings hanya diperlukan bila struktur repository atau command-nya tidak umum. `Docker runtime image` harus berupa image Linux dengan `/bin/sh`; command hanya dijalankan di container itu. `Project .env file` harus bernama `.env` atau `.env.<environment>` dan disalin sementara ke clone agar aplikasi bisa membaca konfigurasinya. Untuk repository private, isi `GITHUB_TOKEN` di `.env` API.

Contoh flow tersedia di `docs/examples/login.yaml`. Flow dapat divalidasi lalu dijalankan dengan mode Simulation atau Playwright. Contoh Android tersedia di `docs/examples/android-login.yaml` dan dapat dikompilasi melalui endpoint Maestro.

`.env.example` hanya berisi nama variable dan nilai dummy. Secret nyata harus masuk ke secret store lokal/IT Ops, bukan ke repository. Child process host hanya mendapat environment allowlist; GitHub token hanya diteruskan ke Git, tidak ke dependency/app containers. Nilai secret yang dikenali dari `.env` dimasking pada log/error. Sandbox bukan batas keamanan absolut: container mendapat akses egress internet agar dependency/API online berfungsi dan dapat membaca `.env` project; gunakan secret khusus testing, bukan kredensial production. API default hanya bind ke `127.0.0.1`; authentication tim dan egress allowlist belum tersedia.

Editor menerima QC Flow YAML saja. Tombol `Generate Playwright file` menghasilkan dan mengunduh `.spec.ts` sebagai output terpisah; hasil step dan artifact run dapat dipilih dari riwayat run.
