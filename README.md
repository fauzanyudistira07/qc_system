# QC Maestro

QC automation platform lokal untuk menjalankan flow web melalui Playwright dan Android melalui Maestro. QC Flow adalah format canonical; artefak Playwright/Maestro merupakan hasil kompilasi.

## Baseline lokal

Baseline ini menyediakan dashboard React + TypeScript dengan project intake dan live preview, API Fastify + TypeScript, QC Flow schema/validator, normalized flow, run simulation, Playwright web adapter, serta PostgreSQL, Redis, dan MinIO untuk infrastruktur lokal.

Project dan ringkasan run disimpan lokal di `.qc-artifacts/qc-state.json`; flow mentah tidak disimpan karena dapat berisi credential test. Ini single-instance local persistence, belum storage untuk beberapa server. Maestro YAML compiler tersedia, tetapi Maestro CLI/device runner dan Nina generation worker belum aktif. API tetap dapat dijalankan tanpa GitHub key dan Solu AI key.

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

Buka Dashboard di http://localhost:5173, API health di http://localhost:4100/health, dan demo app di http://localhost:4173/login. Untuk repository baru, biarkan `Auto-detect stack` aktif, isi repository URL dan target Base URL, lalu klik `Run Playwright`. Mode `QC managed local` akan mengambil repository, checkout ref, menyalin file `.env` project jika diisi, mendeteksi manifest runtime, menjalankan install/start command di container terbatas per service, menunggu health check, lalu menjalankan flow Playwright. Auto-detect mendukung Laravel/PHP, Node, Python/Django/ASGI, dan Go, termasuk manifest di subfolder. Service custom harus mengisi `Docker runtime image` di Advanced settings. Docker Compose dan Dockerfile auto-run sementara ditolak karena belum punya policy build/network yang aman. Panel preview menampilkan progress service, status fase, dan screenshot dari sesi browser yang sama.

Install/start berjalan di container Linux dengan batas CPU, memori, jumlah proses, kapabilitas yang dibuang, dan jaringan khusus per run. Port service hanya dipublish ke loopback host; container tidak diberi Docker socket. Docker Desktop harus aktif. Service dalam satu run dapat saling mengakses melalui alias/container network; sesuaikan host database/API di `.env` bila sebelumnya menunjuk ke `localhost`. Dependency eksternal yang diwajibkan repository—misalnya database, Redis, API online, atau kredensial—tetap perlu disediakan dan tidak dibuat otomatis.

`Working directory` bersifat relatif terhadap root repository hasil clone: gunakan `.` jika `artisan`, `composer.json`, atau `package.json` berada di root; gunakan `backend` atau `frontend` jika berada di subfolder. Pada auto-detect, runner mengisi ini sendiri; Advanced settings hanya diperlukan bila struktur repository atau command-nya tidak umum. `Docker runtime image` harus berupa image Linux dengan `/bin/sh`; command hanya dijalankan di container itu. `Project .env file` harus bernama `.env` atau `.env.<environment>` dan disalin sementara ke clone agar aplikasi bisa membaca konfigurasinya. Untuk repository private, isi `GITHUB_TOKEN` di `.env` API.

Contoh flow tersedia di `docs/examples/login.yaml`. Flow dapat divalidasi lalu dijalankan dengan mode Simulation atau Playwright. Contoh Android tersedia di `docs/examples/android-login.yaml` dan dapat dikompilasi melalui endpoint Maestro.

`.env.example` hanya berisi nama variable dan nilai dummy. Secret nyata harus masuk ke secret store lokal/IT Ops, bukan ke repository. Child process host hanya mendapat environment allowlist; GitHub token hanya diteruskan ke Git, tidak ke dependency/app containers. Nilai secret yang dikenali dari `.env` dimasking pada log/error. Sandbox bukan batas keamanan absolut: container mendapat akses egress internet agar dependency/API online berfungsi dan dapat membaca `.env` project; gunakan secret khusus testing, bukan kredensial production. API default hanya bind ke `127.0.0.1`; authentication tim dan egress allowlist belum tersedia.

Editor menerima QC Flow YAML saja. Tombol `Generate Playwright file` menghasilkan dan mengunduh `.spec.ts` sebagai output terpisah; hasil step dan artifact run dapat dipilih dari riwayat run.
