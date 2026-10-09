# Panduan Lengkap Input Form "New QC Run" — QC Maestro

Dokumen ini menjelaskan secara menyeluruh setiap formulir (*field & parameter input*) yang ada pada halaman **New QC Run** di QC Maestro, mencakup data apa yang diminta, alasan/tujuannya bagi engine autonomous, contoh data yang diinput, serta contoh output hasil yang dihasilkan oleh sistem.

---

## Daftar Isi
1. [Langkah 01: Target & Backend Service](#langkah-01-target--backend-service)
   - [1.1 Nama Project / Pengujian](#11-nama-project--pengujian)
   - [1.2 Platform Target Pengujian (Web vs Android APK)](#12-platform-target-pengujian-web-vs-android-apk)
   - [1.3 Target Binary Aplikasi .APK (Khusus Mobile)](#13-target-binary-aplikasi-apk-khusus-mobile)
   - [1.4 Application ID / Package Name (Khusus Mobile)](#14-application-id--package-name-khusus-mobile)
   - [1.5 Target Device / Emulator (Khusus Mobile)](#15-target-device--emulator-khusus-mobile)
   - [1.6 URL Website Target (Khusus Web)](#16-url-website-target-khusus-web)
   - [1.7 Mode Koneksi Backend & API](#17-mode-koneksi-backend--api)
   - [1.8 Runtime Stack Framework](#18-runtime-stack-framework)
   - [1.9 URL Endpoint Backend API](#19-url-endpoint-backend-api)
   - [1.10 Folder Kerja Lokal (Analisis Kode AST)](#110-folder-kerja-lokal-analisis-kode-ast)
   - [1.11 Repository GitHub & Branch](#111-repository-github--branch)
2. [Langkah 02: Akun Login & Data Pengujian](#langkah-02-akun-login--data-pengujian)
   - [2.1 Kredensial Akun Pengujian (Testing Accounts)](#21-kredensial-akun-pengujian-testing-accounts)
   - [2.2 Database Engine](#22-database-engine)
   - [2.3 Metode Sumber Database (Backend Aktif / SQL Dump / Auto-Seed)](#23-metode-sumber-database-backend-aktif--sql-dump--auto-seed)
3. [Langkah 03: Review & Pengaturan Quality Audit](#langkah-03-review--pengaturan-quality-audit)
   - [3.1 Mode Alur Eksekusi (Auto-Approve vs Jeda Review)](#31-mode-alur-eksekusi-auto-approve-vs-jeda-review)
   - [3.2 Preset Kedalaman Quality Audit](#32-preset-kedalaman-quality-audit)
   - [3.3 Perangkat Layar (Viewports)](#33-perangkat-layar-viewports)
   - [3.4 Mesin Browser (Browsers)](#34-mesin-browser-browsers)
   - [3.5 Include & Exclude Paths (Filter Rute)](#35-include--exclude-paths-filter-rute)
4. [Tabel Matriks Ringkasan Input & Output](#tabel-matriks-ringkasan-input--output)

---

## Langkah 01: Target & Backend Service

### 1.1 Nama Project / Pengujian
* **Data yang diminta**: Teks nama pengenal (string).
* **Untuk apa**: Digunakan sebagai nama suite, nama direktori penyimpanan evidence (`.qc-artifacts/projects/{slug}`), serta pengelompokan riwayat di sidebar dan laporan eksekutif.
* **Contoh Input**:
  ```text
  Tasdig Flutter Mobile QC
  ```
  *(Atau untuk Web: `Jamaahku Travel Agent Web QC`)*
* **Contoh Output**:
  - Judul di Topbar dan Sidebar Project Switcher: `Tasdig Flutter Mobile QC`.
  - Folder penyimpanan artifact: `.qc-artifacts/projects/tasdig-flutter-mobile-qc/runs/...`.
  - Badge monogram avatar di kartu: `TA` / `FL`.

---

### 1.2 Platform Target Pengujian (Web vs Android APK)
* **Data yang diminta**: Pilihan platform:
  - 🌐 `Web Application / Portal`
  - 📱 `Mobile App (Flutter / Android APK)`
* **Untuk apa**: Menentukan engine runner yang diaktifkan oleh Maestro Engine:
  - Web mengaktifkan **Playwright Browser Runner** (Chromium/Firefox/WebKit).
  - Mobile mengaktifkan **Maestro CLI Runner** + **Android ADB Bridge** + **Headless Emulator Auto-Starter**.
* **Contoh Input**:
  - Klik kartu `Mobile App (Flutter / Android APK)`.
* **Contoh Output**:
  - Form menyesuaikan otomatis memunculkan upload APK dan port emulator.
  - Saat dijalankan, log terminal menampilkan:
    `[MOBILE_ORCHESTRATOR] Initializing Android ADB target device emulator-5554...`

---

### 1.3 Target Binary Aplikasi .APK (Khusus Mobile)
* **Data yang diminta**: Berkas file biner `.apk` Android (bisa via upload browser atau Instant Local Path).
* **Untuk apa**: Binary aplikasi yang akan otomatis diinstall ke emulator/device target oleh ADB untuk diuji secara interaktif.
* **Contoh Input**:
  - *Instant Local Path (0.1 detik)*:
    ```text
    C:\Users\admin\Documents\PKL- SOLU\taskia_digital\tasdig_app_flutter\build\app\outputs\flutter-apk\app-release.apk
    ```
* **Contoh Output**:
  - Deteksi otomatis Package ID: `com.taskia.digital`.
  - Ukuran file: `69.6 MB`.
  - Aplikasi otomatis terpasang di emulator internal Pixel Android 14.

---

### 1.4 Application ID / Package Name (Khusus Mobile)
* **Data yang diminta**: Package identifier Android (string reverse domain).
* **Untuk apa**: Digunakan oleh Maestro dan ADB untuk perintah `adb shell monkey -p <pkg>` atau `maestro test` saat membuka/menutup aplikasi.
* **Contoh Input**:
  ```text
  com.taskia.digital
  ```
* **Contoh Output**:
  - Engine menjalankan flow:
    ```yaml
    appId: com.taskia.digital
    ---
    - launchApp
    ```

---

### 1.5 Target Device / Emulator (Khusus Mobile)
* **Data yang diminta**: Serial ID ADB (string).
* **Untuk apa**: Menentukan ke emulator atau perangkat fisik mana perintah ADB dikirim.
* **Contoh Input**:
  ```text
  emulator-5554
  ```
* **Contoh Output**:
  - Status koneksi terverifikasi: `device online (API 34, Android 14)`.

---

### 1.6 URL Website Target (Khusus Web)
* **Data yang diminta**: URL protokol HTTP/HTTPS lengkap.
* **Untuk apa**: Alamat awal yang dibuka oleh crawler Playwright untuk menjelajahi halaman web, menelusuri link navigasi, dan mengisi form.
* **Contoh Input**:
  ```text
  http://localhost:5174
  ```
* **Contoh Output**:
  - Browser Playwright membuka `http://localhost:5174/`.
  - Terdeteksi rute: `/login`, `/dashboard`, `/data-master/batch`, `/transaksi`, dll.

---

### 1.7 Mode Koneksi Backend & API
* **Data yang diminta**: Pilihan mode backend:
  1. `Folder Kerja Backend Lokal`: QC Maestro membaca file source code lokal untuk analisis AST (Abstract Syntax Tree).
  2. `Backend Lokal Aktif (Localhost API)`: Menggunakan server backend yang sudah menyala.
  3. `Clone Repo GitHub`: Meng-clone repository remote ke folder isolasi.
* **Untuk apa**: Menghubungkan front-end dengan backend API pendukung otentikasi dan data bisnis.
* **Contoh Input**:
  - Pilih: `Folder Kerja Backend Lokal`.
* **Contoh Output**:
  - Analyzer membaca rute API Laravel/Node langsung dari disk, menemukan 67 endpoint API dan 49 tabel relasional.

---

### 1.8 Runtime Stack Framework
* **Data yang diminta**: Pilihan framework: `Auto Detect`, `Laravel / PHP`, atau `Custom`.
* **Untuk apa**: Mengarahkan runner bagaimana mengeksekusi service, membaca `.env`, atau menjalankan migrasi database.
* **Contoh Input**:
  ```text
  Laravel / PHP
  ```
* **Contoh Output**:
  - Runner mengenali file `artisan`, folder `app/Http/Controllers`, dan rute `routes/api.php`.

---

### 1.9 URL Endpoint Backend API
* **Data yang diminta**: URL endpoint server API (string).
* **Untuk apa**: Untuk mobile emulator, network host komputer diakses melalui gateway khusus Android `10.0.2.2`. QC Maestro juga otomatis menjalankan `adb reverse tcp:PORT tcp:PORT`.
* **Contoh Input**:
  - Untuk Android Emulator:
    ```text
    http://10.0.2.2:8001
    ```
  - Untuk Web:
    ```text
    http://localhost:8000
    ```
* **Contoh Output**:
  - Aplikasi Flutter di emulator dapat melakukan HTTP POST login ke `http://10.0.2.2:8001/api/login` tanpa error koneksi network.

---

### 1.10 Folder Kerja Lokal (Analisis Kode AST)
* **Data yang diminta**: Absolute path direktori project di komputer (string).
* **Untuk apa**: Mesin pemindai (scanner) menganalisis struktur komponen (Vue, React, Blade, Controller) untuk menemukan tombol, modal, dan alur tersembunyi tanpa harus menunggu halaman di-render.
* **Contoh Input**:
  ```text
  E:\projek\jamaahku_website\jamaahku_frontend\jamaahku-travel-agent
  ```
* **Contoh Output**:
  - Inventory menghasilkan: `55 Screen / Halaman terpetakan, 77 Alur Flow siap uji`.

---

## Langkah 02: Akun Login & Data Pengujian

### 2.1 Kredensial Akun Pengujian (Testing Accounts)
* **Data yang diminta**: Daftar akun penguji (Email/Username, Password, dan Role).
* **Untuk apa**: Robot penguji otomatis login dengan kredensial ini untuk menguji hak akses (RBAC), mengisi form berdasarkan otoritas pengguna, dan menguji isolasi role.
* **Contoh Input**:
  | Role | Email / Username | Password |
  | :--- | :--- | :--- |
  | `user` | `12345678` | `123456` |
  | `admin` | `guru@tasdig.com` | `123456` |
  | `tester`| `staff@taskia.id` | `123456` |
* **Contoh Output**:
  - Robot berhasil melewati halaman form login (`HTTP 200/302 Redirect`).
  - Skenario pengujian mengeksekusi dashboard Siswa, Guru, dan Admin secara terpisah.
  - Video rekaman login sukses tersimpan di folder Media Evidence.

---

### 2.2 Database Engine & 2.3 Metode Sumber Database
* **Data yang diminta**: 
  - Engine: `none`, `mysql`, `postgres`, atau `sqlite`.
  - Metode Sumber:
    * `Database Backend Aktif`: Menggunakan database yang saat ini menyala (contoh: SQLite lokal atau MySQL aktif).
    * `Upload File SQL Dump`: Unggah file `.sql` berukuran hingga 50 MB.
    * `Auto-Seed Dataset Lengkap`: Perintah migrasi / seeder (`npm run seed:jamaahku` atau `php artisan db:seed`).
* **Untuk apa**: Menjamin data uji tersedia lengkap (misal tabel paket umrah, jadwal keberangkatan, transaksi, jamaah) sehingga pengujian fitur formulir dan tabel tidak kosong (*empty state*).
* **Contoh Input**:
  - Metode: `Database Backend Aktif`.
* **Contoh Output**:
  - Runner mendeteksi file database aktif (`database.sqlite`, 819 KB, 67 tabel).
  - Seluruh data siswa, kelas, guru, dan sarpras langsung siap diuji tanpa gagal otentikasi.

---

## Langkah 03: Review & Pengaturan Quality Audit

### 3.1 Mode Alur Eksekusi (Auto-Approve vs Jeda Review)
* **Data yang diminta**: Pilihan mode:
  - ⚡ `Langsung Jalankan Non-Stop (Auto-Approve)`
  - ⏸️ `Jeda Review Alur Manual`
* **Untuk apa**:
  - Jika `Auto-Approve`: Setelah rute dan alur bisnis dipetakan, engine **langsung** mengeksekusi seluruh pengujian Playwright/Maestro secara otonom tanpa berhenti meminta konfirmasi tombol.
  - Jika `Jeda Review`: Engine berhenti di fase `WAITING_REVIEW` agar manusia memeriksa alur terlebih dahulu.
* **Contoh Input**:
  - Pilih: `⚡ Langsung Jalankan Non-Stop`.
* **Contoh Output**:
  - Status Job langsung beralih dari `SYNTHESIZING_FLOWS` → `APPROVED` → `EXECUTING_TESTS`.

---

### 3.2 Preset Kedalaman Quality Audit
* **Data yang diminta**: Pilihan preset:
  - 🛡️ `Mendalam & Komprehensif`: Depth 8, 100 rute, uji form boundary, visual audit, negative testing.
  - ⚡ `Cepat & Esensial`: Maksimal 20 rute, cek status HTTP dasar, durasi singkat.
* **Untuk apa**: Menyesuaikan kebutuhan waktu dan kelengkapan bukti uji.
* **Contoh Input**:
  - Pilih: `Mendalam & Komprehensif`.
* **Contoh Output**:
  - Dihasilkan 100+ screenshot checkpoint, video rekaman alur, dan audit WCAG accessibility.

---

### 3.3 Perangkat Layar (Viewports) & 3.4 Mesin Browser
* **Data yang diminta**: Checkbox pilihan layar (`Desktop 1440px`, `Tablet 768px`, `Mobile 375px`) dan browser (`Chromium`, `Firefox`, `WebKit`).
* **Untuk apa**: Menguji responsivitas tampilan antarmuka (UI) terhadap berbagai ukuran layar gawai dan mesin render browser web.
* **Contoh Input**:
  - Layar: `Desktop (1440px)` dan `Mobile (375px)`.
  - Browser: `Chromium`.
* **Contoh Output**:
  - Laporan perbandingan visual responsif: deteksi teks terpotong (*text overflow*), tombol bertumpuk, atau layout bergeser pada layar mobile.

---

### 3.5 Include & Exclude Paths (Filter Rute)
* **Data yang diminta**: Baris-baris URL path pattern (string satu per baris).
* **Untuk apa**: 
  - `Include Paths`: Halaman penting yang diprioritaskan untuk diuji lebih dulu.
  - `Exclude Paths`: Mencegah robot menekan tombol berbahaya yang dapat merusak sesi (seperti `/logout`, `/delete`, `/reset-data`).
* **Contoh Input**:
  ```text
  Include:
  /dashboard
  /data-master/batch
  /transaksi

  Exclude:
  /logout
  /delete
  ```
* **Contoh Output**:
  - Crawler menjelajahi modul dashboard dan batch secara mendalam.
  - Crawler tidak pernah mengeklik link logout selama pengujian berlangsung sehingga sesi tetap login.

---

## Tabel Matriks Ringkasan Input & Output

| Bagian Form | Data yang Diminta | Tujuan / Fungsi Utama | Contoh Input | Contoh Output Hasil |
| :--- | :--- | :--- | :--- | :--- |
| **Project Name** | Nama proyek (teks) | Label laporan & folder artifact | `Tasdig Flutter Mobile QC` | Folder `.qc-artifacts/projects/tasdig-...` |
| **Platform** | Web atau Android APK | Memilih runner (Playwright vs Maestro) | `Mobile App (Android APK)` | Emulator Android 14 otomatis dinyalakan |
| **Target APK** | File `.apk` atau path lokal | Binary aplikasi yang diuji | `.../app-release.apk` | Aplikasi terinstall di emulator via ADB |
| **Base URL** | URL website target | Titik awal crawler web | `http://localhost:5174` | Browser membuka dan menelusuri 55 halaman |
| **Backend API** | URL endpoint server | Koneksi API backend data | `http://10.0.2.2:8001` | Flutter connect ke backend tanpa CORS/Network error |
| **Akun Tester** | Email, password, role | Otentikasi login & uji RBAC | `12345678 / 123456 (user)` | Robot otomatis login dan masuk ke Dashboard |
| **Database** | Mode SQLite / MySQL / Seed | Menjamin data uji tersedia | `Database Backend Aktif` | Form dan tabel terisi data relasional lengkap |
| **Alur Eksekusi** | Auto-Approve / Manual | Melewati jeda konfirmasi user | `⚡ Langsung Jalankan Non-Stop` | Job langsung jalan ke fase eksekusi tes |
| **Quality Audit** | Viewports & Browsers | Uji multi-layar & cross-browser | `Desktop 1440px + Mobile 375px` | Bukti screenshot responsive & audit WCAG |
| **Path Exclude** | Rute yang dilarang | Mencegah logout / aksi destruktif | `/logout`, `/delete` | Robot tidak terputus dari sesi login |

---
*Dokumen ini digenerate secara otomatis oleh QC Maestro Documentation Engine.*
