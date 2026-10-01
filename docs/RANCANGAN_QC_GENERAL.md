# Paket Rancangan QC General — Website dan Mobile

Status: rancangan, bukan laporan hasil pengujian. Dibuat 29 September 2026.

## Dokumen utama

| Kebutuhan | Dokumen |
|---|---|
| Pengujian website dari inventory sampai deep CRUD dan responsive | [Rancangan website](RANCANGAN_QC_WEBSITE_GENERAL.md) |
| Pengujian Android/iOS/native/hybrid, tablet, offline, lifecycle | [Rancangan mobile](RANCANGAN_QC_MOBILE_GENERAL.md) |
| Status, coverage, JSON, screenshot, video, report berwarna, fixture, gate | [Kontrak report dan evidence](KONTRAK_QC_GENERAL_REPORT_EVIDENCE.md) |

Rancangan SAFF sebelumnya menjadi contoh proyek tertentu. Paket ini menjadi acuan untuk engine umum. Nama screen, selector, API, role, tabel, IP, dan package harus berasal dari profile setiap proyek.

## Peta kebutuhan pengguna

| Kebutuhan | Website | Mobile | Report/bukti |
|---|---|---|---|
| Semua fitur/tombol | Inventory route/control/state + crawl per role | Screen/control/system UI + gestures per role | Requirement-to-assertion coverage |
| CRUD mendalam | Relasi, concurrency, transaksi, import/export, restore | Seluruh lifecycle ditambah offline queue/local persistence | UI/API/data snapshots dan invariants |
| Warna | Token/CSS/contrast per state | Native token atau pixel sample berconfidence | Swatch expected/actual, crop, ratio |
| Layout | Grid, spacing, typography, layer, dense data | Insets, keyboard, hit target, pane, scaling | Bounds, diff, annotated screenshot |
| Responsive ke tablet | Browser viewport/breakpoints/zoom/touch | Phone/tablet/foldable/split-screen/orientation | Matrix screenshot dan functional assertions |
| Screenshot | Viewport/full-page/component/state | Native screen/scroll sequence/state | Actual/baseline/diff dengan metadata |
| Video | Browser recording dan trace timeline | Device recording bersegmen dan timeline | Player timestamp per step |
| JSON | Common versioned report | Common versioned report + device context | Assertion, finding, evidence, cleanup |
| Multi-proyek | Stack-independent driver + domain module | Platform driver + domain module | Config/build provenance |
| Dokumentasi akhir | HTML/PDF/ZIP | HTML/PDF/ZIP | Category views, retest, limitations |

## Template rencana yang dapat dibaca mesin

- [Profile website](examples/qc-web-general.plan.json)
- [Profile mobile](examples/qc-mobile-general.plan.json)

Keduanya menggunakan format draft dan menyatakan executable=false. File ini dapat dipakai untuk mereview desain dan memulai implementasi schema berikutnya. Jangan memasukkannya ke runner QC Flow v1 yang ada sekarang.

## Contoh alur pemakaian produk setelah implementasi

1. Buat project dan pilih website atau mobile.
2. Isi target/build, environment, akun role, dependency, dan sumber desain.
3. Discovery menampilkan fitur/control/resource serta item unresolved.
4. Pemilik run mereview aturan bisnis dan coverage sesuai mekanisme review yang sudah ada.
5. Pilih full-documentation dan device/browser matrix.
6. Preflight memeriksa environment, fixture, dan recorder.
7. Jalankan functional/deep CRUD/design/responsive suites.
8. Buka report per kategori, klik screenshot atau timestamp video.
9. Retest finding pada build/run baru.
10. Cleanup terverifikasi dan gate memberi PASSED/FAILED/INCOMPLETE.

## Perbaikan konsep dari rancangan lama

- Marker fixture memakai ownerRunId dan object IDs unik, bukan prefix nama tetap.
- Semua UI scenarios pada mode dokumentasi penuh menghasilkan video, termasuk yang pass.
- Status observed, hasil test, dan kelengkapan evidence merupakan dimensi berbeda.
- CRUD API/DB tidak diasumsikan tersedia untuk semua target; requirement dengan observer yang hilang tetap tampil.
- Tidak menganggap simulasi ukuran phone sebagai bukti tablet fisik.
- Report tidak menganggap seluruh step pass hanya karena flow exit code 0.
- Video mempertahankan aspect ratio dan memiliki capture-gap metadata.
- Denominator coverage mencakup blocked dan belum dijalankan.
- Domain plug-in dapat menambah rules tanpa mengubah core runner.
- Rancangan platform lain tidak menjadi klaim bahwa driver sudah tersedia.

## Urutan implementasi lintas platform

1. Common contract, status, evidence ownership, coverage, dan validators.
2. Perbaiki hasil step dan assertion runner yang ada.
3. Recorder/collector/report JSON yang lengkap.
4. Resource contract, fixture ledger, deep CRUD observers.
5. Design token/layout engine dan responsive matrix.
6. Dashboard report berwarna dengan screenshot/video timeline.
7. Domain modules, mobile hardware/lifecycle/offline extensions.
8. Cross-platform conformance, CI gates, retention dan retest.

Tidak perlu menunggu device untuk mengerjakan schema, report UI, fixture contract, dan conformance driver palsu. Runtime mobile kembali dilakukan ketika device tersedia dan pekerjaan eksekusi dilanjutkan.

