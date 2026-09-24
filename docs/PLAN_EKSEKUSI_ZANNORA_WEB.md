# Rencana Eksekusi QC End-to-End Zannora Web

Dokumen ini adalah rencana kerja bersama Codex dan Antigravity untuk pengujian
Zannora Web pada environment staging. Fokus tahap ini hanya web. Android,
Maestro mobile, ADB, dan pengujian hardware ditunda sampai web stabil.

## 1. Tujuan

Target utama:

1. Zannora staging dapat diakses dan login berhasil.
2. 71 halaman hasil source scan diklasifikasikan berdasarkan status runtime.
3. Runtime discovery dapat menemukan halaman dan elemen interaktif setelah login.
4. Flow login, navigasi, smoke test halaman, dan CRUD prioritas dapat berjalan.
5. Setiap kegagalan memiliki screenshot, pesan error, dan klasifikasi penyebab.
6. Report membedakan halaman yang ditemukan, dikunjungi, diverifikasi, gagal,
   terblokir, dan belum diuji.
7. QC Maestro memiliki flow dan pola reusable untuk website berikutnya.

## 2. Kondisi Awal yang Harus Dipahami

Report sebelumnya menunjukkan:

```text
259 file scanned
71 route/screen discovered
1 scenario tested
1 scenario passed
0 interactive elements detected
```

Angka 71 belum berarti 71 halaman sudah diuji end-to-end. Status awal yang
lebih akurat adalah:

```text
71 halaman terdeteksi dari source
1 skenario login berhasil
70 halaman belum tervalidasi
0 elemen interaktif berhasil diekstraksi runtime
```

Fokus awal adalah mencari penyebab `0 interactive elements`, lalu memastikan
discovery dilakukan setelah login dan setelah halaman selesai melakukan render.

## 3. Pembagian Tugas

### 3.1 Tugas Antigravity

Antigravity berperan sebagai operator eksplorasi dan validator aplikasi.

Tugas:

- menjalankan dan memeriksa Zannora di `http://127.0.0.1:8000`;
- melakukan login manual dengan akun staging;
- menelusuri menu dan sidebar;
- membuka halaman satu per satu;
- menguji tombol, form, modal, tabel, filter, dan pagination;
- menjalankan CRUD menggunakan data `QC_TEST`;
- mengambil screenshot bukti;
- mencatat bug aplikasi;
- mencatat kebutuhan role/permission;
- memvalidasi apakah flow otomatis sesuai perilaku nyata aplikasi.

Antigravity tidak perlu mengubah engine QC Maestro kecuali ada instruksi
khusus. Hasil eksplorasi ditulis ke folder artifact bersama.

### 3.2 Tugas Codex

Codex berperan sebagai pengembang engine dan automation QC.

Tugas:

- memeriksa kondisi repository, runner, schema, dan reporter;
- menjalankan smoke test login;
- memperbaiki runtime discovery;
- menghubungkan hasil source scan dan runtime discovery;
- membuat flow YAML;
- memperbaiki locator dan wait;
- membuat assertion URL, teks, visible, tabel, dan error;
- memperbaiki screenshot dan artifact;
- menambahkan cleanup data test;
- menyiapkan eksekusi paralel setelah flow stabil;
- menjalankan regression test;
- membuat template reusable untuk website berikutnya.

## 4. Struktur Komunikasi Bersama

Codex tidak mengirim pesan langsung ke jendela Antigravity. Koordinasi
dilakukan melalui file dan artifact pada workspace bersama.

Folder yang digunakan:

```text
.qc-artifacts/
└── zannora/
    ├── inventory.json
    ├── runtime-discovery.json
    ├── exploration-report.md
    ├── bug-list.md
    ├── handoff-antigravity.md
    ├── handoff-codex.md
    ├── screenshots/
    ├── bug-evidence/
    ├── flows/
    └── runs/
```

Antigravity hanya menulis hasil eksplorasi dan bukti ke `.qc-artifacts/zannora/`.
Codex mengubah source code, flow YAML, dan engine di `apps/`, `packages/`,
`scripts/`, serta folder flow yang sudah disepakati.

## 5. Format Handoff Antigravity

File: `.qc-artifacts/zannora/handoff-antigravity.md`

```markdown
# Handoff Antigravity

## Status
RUNNING | BLOCKED | COMPLETE

## URL
http://127.0.0.1:8000

## Login
- account: tersedia/tidak
- login result: PASS/FAIL

## Pages Explored
- /dashboard: PASS
- /users: PASS
- /settings: BLOCKED

## Bugs
- BUG-001:
  - page:
  - action:
  - expected:
  - actual:
  - evidence:

## Notes
...
```

## 6. Format Handoff Codex

File: `.qc-artifacts/zannora/handoff-codex.md`

```markdown
# Handoff Codex

## Smoke Test
PASS/FAIL

## Automated Flows
- login: PASS
- navigation: PASS
- user-crud: FAIL

## Framework Changes
- ...

## Needs Validation
- ...
```

## 7. Urutan Eksekusi

### Fase 0 — Persiapan Environment

Estimasi: 30–45 menit.

Checklist:

- laptop terhubung charger;
- mode sleep dimatikan;
- Zannora staging berjalan di port `8000`;
- database staging terpisah dari production;
- email, payment, webhook, dan integrasi eksternal tidak mengirim efek nyata;
- akun testing tersedia;
- Playwright browser tersedia;
- repository dan perubahan terdokumentasi;
- folder artifact dibuat;
- tidak ada proses lain memakai folder run yang sama.

Pengecekan minimum:

```powershell
Invoke-WebRequest http://127.0.0.1:8000 -UseBasicParsing
npm run check
```

Jika Zannora belum berjalan, cari perintah start atau URL staging yang benar.
Jangan mengasumsikan perintah start tanpa memeriksa project Zannora.

### Fase 1 — Smoke Test Login

Estimasi: 15–30 menit.

Flow:

```text
open /login
input email
input password
click submit
assert /dashboard
assert dashboard visible
screenshot
```

Acceptance criteria:

- login berhasil;
- redirect benar;
- dashboard termuat;
- screenshot dapat dibuka;
- artifact tersimpan;
- report tidak menampilkan gambar rusak.

Jika fase ini gagal, jangan lanjut ke full discovery sebelum penyebabnya jelas.

### Fase 2 — Audit Source dan Runtime

Estimasi: 45–90 menit.

Inventory harus membedakan source discovery dan runtime discovery.

Contoh model data:

```json
{
  "route": "/users",
  "sourceDiscovered": true,
  "runtimeVisited": false,
  "requiresAuth": true,
  "interactiveElements": [],
  "status": "NOT_TESTED",
  "errors": []
}
```

Status yang digunakan:

```text
SOURCE_DISCOVERED
RUNTIME_VISITED
VERIFIED
FAILED
BLOCKED
NOT_TESTED
SKIPPED
```

Periksa penyebab `0 interactive elements`:

- crawler belum login sebelum discovery;
- halaman belum selesai render;
- menu/sidebar belum diklik;
- route baru muncul setelah API selesai;
- selector crawler terlalu terbatas;
- URL runtime berbeda dari source route;
- iframe atau dialog belum ditangani;
- error JavaScript menghentikan render;
- screenshot/artifact tidak terhubung ke reporter.

### Fase 3 — Runtime Discovery Setelah Login

Estimasi: 1–3 jam.

Alur:

```text
open login
login
wait dashboard
capture dashboard
read navigation menu
open menu item
wait page ready
capture visible elements
record links/buttons/forms/tables/dialogs
follow safe internal links
repeat
```

Discovery mencatat:

- URL;
- judul dan heading halaman;
- menu aktif;
- tombol dan link;
- input, select, checkbox, tab, dialog;
- tabel, filter, dan pagination;
- error console;
- request gagal;
- screenshot;
- status halaman.

Discovery tidak boleh mengklik tombol destruktif secara otomatis sebelum
diberi klasifikasi.

### Fase 4 — Klasifikasi Aksi

#### SAFE

- membuka halaman;
- membuka tab atau modal;
- filter dan search;
- pagination;
- expand/collapse;
- breadcrumb dan back.

#### MUTATING

- create;
- edit;
- submit;
- approve;
- publish.

Boleh diuji di staging dengan data khusus.

#### DESTRUCTIVE

- delete;
- cancel order;
- reset;
- revoke;
- remove access.

Hanya diuji terhadap data ber-prefix `QC_TEST` dan harus memiliki cleanup.

### Fase 5 — Eksplorasi Manual Antigravity

Estimasi: 2–4 jam, paralel dengan Codex.

Urutan modul:

1. Dashboard.
2. Master data.
3. User, role, dan permission.
4. Modul transaksi utama.
5. Detail dan edit.
6. Report, filter, dan search.
7. Setting.
8. Logout dan session expiry.

Untuk setiap fitur, catat:

```text
Page
Precondition
Action
Expected
Actual
Status
Screenshot
Data created
Cleanup required
```

Semua data pengujian menggunakan format:

```text
QC_TEST_<timestamp>
```

### Fase 6 — Pembuatan Automation Flow Codex

Flow dibuat berlapis.

#### Layer 1: Authentication

```text
login
logout
session restore
invalid login
empty credential
```

#### Layer 2: Navigation

```text
dashboard
menu utama
submenu
back
breadcrumb
direct route
unauthorized route
```

#### Layer 3: Page Smoke

```text
open
assert URL
assert heading
assert primary content
assert no fatal console error
screenshot
```

#### Layer 4: Functional CRUD

```text
Create
Verify list/detail
Read
Edit
Verify changed value
Delete
Verify removed
Cleanup
```

#### Layer 5: Validation

```text
field wajib kosong
format salah
duplikasi data
data terlalu panjang
cancel form
retry submit
server error
```

Prioritas locator:

```text
testId
role + name
label
placeholder
id
css
text
```

Hindari ketergantungan pada `nth-child`, class CSS acak, posisi visual, atau
text yang mudah berubah.

### Fase 7 — Perbaikan Engine

#### P0 — Wajib

- login flow;
- route navigation;
- runtime discovery setelah login;
- screenshot artifact;
- assertion;
- error message;
- report status;
- cleanup data test.

#### P1 — Penting

- locator fallback;
- session reuse;
- retry terbatas;
- wait untuk loading;
- console error capture;
- network failure capture;
- flow parameterization;
- report per modul.

#### P2 — Setelah Baseline Stabil

- parallel workers;
- visual regression;
- network mocking;
- performance metrics;
- standalone HTML report;
- CI/CD integration.

Jangan memasukkan semua fitur roadmap sebelum masalah runtime discovery dan
screenshot report selesai.

### Fase 8 — Eksekusi Paralel

Jika flow dan data isolation sudah stabil, gunakan empat worker:

```text
Worker 1: auth + dashboard + navigation
Worker 2: master data + users + roles
Worker 3: transaction CRUD
Worker 4: reports + settings + validation
```

Syarat:

- data test unik;
- session terpisah;
- folder artifact terpisah;
- tidak ada dependency antar-worker;
- database staging mampu menangani beban;
- cleanup satu worker tidak menghapus data worker lain.

Jika syarat belum terpenuhi, gunakan satu worker agar hasil tidak rancu.

### Fase 9 — Regression Run

Estimasi: 30 menit–2 jam.

Urutan:

1. Login.
2. Navigation.
3. Smoke semua route.
4. CRUD prioritas.
5. Validation.
6. Screenshot/checkpoint.
7. Cleanup.
8. Report aggregation.

Kategori hasil:

```text
APP_BUG
TEST_BUG
ENVIRONMENT_ERROR
DATA_ERROR
PERMISSION_ERROR
EXPECTED_FAILURE
```

## 8. Acceptance Criteria

Tahap web dianggap berhasil jika:

- Zannora staging dapat diakses;
- login otomatis berhasil;
- screenshot report tampil dengan benar;
- hasil `0 interactive elements` sudah dijelaskan atau diperbaiki;
- seluruh 71 halaman memiliki status yang jelas;
- semua halaman utama sudah smoke-tested;
- minimal satu modul CRUD selesai end-to-end;
- bug memiliki bukti screenshot;
- data test dapat dibersihkan;
- flow dapat dijalankan ulang;
- tersedia template flow untuk website berikutnya;
- report tidak menyebut semua 71 halaman fully audited jika belum benar-benar diuji.

## 9. Estimasi Waktu

Jika staging stabil:

```text
Smoke login                 : 15–30 menit
Runtime discovery            : 1–3 jam
Inventory dan klasifikasi    : 1–2 jam
Flow halaman utama           : 2–4 jam
CRUD prioritas               : 2–5 jam
Regression pertama           : 30 menit–2 jam
```

Target satu hari adalah menghasilkan:

```text
login
+ runtime discovery
+ inventory valid
+ smoke test halaman utama
+ satu CRUD end-to-end
+ report dan bug evidence
```

Full coverage seluruh 71 halaman tidak boleh dipaksakan selesai jika setiap
halaman memiliki interaksi kompleks. Prioritasnya adalah baseline yang benar,
repeatable, dan dapat dilanjutkan.

## 10. Risiko dan Rencana Cadangan

### Zannora tidak tersedia di port 8000

Antigravity memeriksa perintah start atau URL staging yang benar. Codex dapat
memperbaiki engine dengan demo app, tetapi tidak boleh mengklaim Zannora telah
diuji.

### Login berhasil tetapi halaman kosong

Periksa API backend, environment variable, database, request gagal, console
error, role akun, dan route guard.

### Runtime discovery tetap menemukan nol elemen

Gunakan pendekatan manual-assisted:

1. Antigravity membuat inventory dari browser.
2. Screenshot dan URL disimpan.
3. Codex mengubah inventory menjadi flow.
4. Crawler diperbaiki setelah flow pertama berhasil.

### CRUD berisiko mengubah data

Pastikan database staging, prefix `QC_TEST`, cleanup, dan mock integrasi
eksternal tersedia sebelum melanjutkan.

### Konflik dua agent

Gunakan pembagian:

```text
Antigravity → .qc-artifacts/zannora/
Codex       → apps/, packages/, scripts/, flow YAML
```

Jangan mengedit file source yang sama secara bersamaan.

## 11. Fokus Keberhasilan Besok

Besok tidak mengejar Android, CI/CD, visual AI, atau profiling hardware.
Fokusnya adalah membuktikan:

```text
1. Zannora dapat ditemukan dengan benar.
2. Zannora dapat diuji secara runtime, bukan hanya dipindai source.
3. QC Maestro dapat mengubah hasil discovery menjadi flow E2E reusable.
```

Jika tiga hal ini berhasil, website kedua dan seterusnya dapat menggunakan
fondasi yang sama dengan waktu setup yang jauh lebih singkat.
