# Kontrak bersama QC lintas proyek: coverage, evidence, dan report

Status: rancangan implementasi, 29 September 2026. Contoh JSON/YAML pada paket rancangan ini adalah kontrak usulan; belum menjadi input yang didukung runner saat ini.

Dokumen pendamping:
- [Rancangan website](RANCANGAN_QC_WEBSITE_GENERAL.md)
- [Rancangan mobile](RANCANGAN_QC_MOBILE_GENERAL.md)

## 1. Tujuan produk

Satu proyek dapat memasukkan URL, source repository, build mobile, spesifikasi bisnis, akun uji, dan fixture. QC membentuk inventory, menyusun kontrak hasil yang diharapkan, mengeksekusi scenario, mengumpulkan screenshot/video/JSON, dan menghasilkan laporan yang dapat ditelusuri sampai bukti per langkah.

Konfigurasi domain dipisahkan dari engine. Nama layar, endpoint, selector, tabel, role, jumlah tab, package aplikasi, dan alamat device berasal dari project profile.

Cakupan general berarti engine dapat diperluas mengikuti kemampuan proyek. Fitur yang membutuhkan hardware, layanan eksternal, atau aturan bisnis tambahan tetap memiliki requirement dan status eksplisit.

## 2. Model data inti

| Entity | Field penting | Tujuan |
|---|---|---|
| ProjectProfile | projectId, platforms, sourceRefs, environmentRefs, domainModules | Mengidentifikasi proyek dan integrasi |
| Build | buildId, commit, binaryHash, version, configHash | Menentukan aplikasi yang benar-benar diuji |
| Capability | id, provenance, confidence, applicability | Kemampuan yang ditemukan atau didefinisikan |
| Screen | screenId, route/deepLink, landmarks, variants | Halaman atau layar dan state-nya |
| Control | controlId, screenId, locator, action, conditions | Tombol, link, field, gesture, icon |
| Resource | resourceId, fields, relations, operations, invariants | Model data bisnis |
| Requirement | id, expected, source, priority, owner | Aturan yang menjadi dasar assertion |
| Scenario | id, requirementIds, actor, fixture, steps, expected | Test case yang dapat dijalankan |
| ExecutionCell | scenarioId, role, tenant, device/browser, state | Satu kombinasi pengujian wajib |
| Attempt | attemptId, cellId, buildId, startedAt, result | Satu percobaan; retry membuat attempt baru |
| Assertion | assertionId, expected, actual, outcome, evidenceIds | Bukti hasil, termasuk assertion negatif |
| Evidence | id, type, path, hash, timestamps, dimensions | File yang terhubung ke assertion |
| Finding | id, severity, observed, expected, reproduction, retest | Temuan yang bisa ditindaklanjuti |
| FixtureLedger | ownerRunId, objectIds, before, created, cleanup | Menelusuri mutation dan cleanup |

ID stabil melintasi run. Label yang berubah tidak otomatis membuat fitur baru. Instance baris list menyimpan entity key; satu template tombol delete dan sepuluh instance data dicatat terpisah.

## 3. Pemisahan status

Hindari mencampur confidence discovery, keberhasilan fungsi, dan kelengkapan evidence dalam satu boolean.

### 3.1 Discovery

- CANDIDATE: hipotesis dari source, screenshot, atau inferensi.
- OBSERVED: node/route/state benar-benar diamati.
- CONTRACTED: expected result sudah ditentukan dari requirement.
- UNRESOLVED: aturan bisnis atau locator belum cukup.

### 3.2 Hasil assertion/scenario

- PASSED: assertion benar-benar dieksekusi dan hasil cocok.
- FAILED: actual bertentangan dengan expected.
- BLOCKED: prasyarat tertentu tidak terpenuhi; blockerId wajib.
- NOT_RUN: belum dicoba.
- SKIPPED: sengaja tidak dijalankan; alasan dan penanggung jawab wajib.
- NOT_APPLICABLE: terbukti tidak relevan menurut scope/kapabilitas.
- CANCELLED: run dihentikan sebelum assertion selesai.

Infra error masuk execution.errorKind = INFRA dan outcome BLOCKED untuk test yang belum sempat menilai aplikasi. Assertion yang sudah gagal tetap FAILED.

### 3.3 Dimensi tambahan

- evidenceStatus: COMPLETE / PARTIAL / MISSING.
- cleanupStatus: NOT_REQUIRED / PENDING / PASSED / FAILED.
- reproducibility: STABLE / FLAKY / UNKNOWN.
- verificationLevel: UI / UI_API / UI_API_DATA / MANUAL_OBSERVED.
- dependencyMode: REAL / SANDBOX / STUB / MOCK.
- runStatus: QUEUED / PREFLIGHT / RUNNING / FINALIZING / COMPLETED / INTERRUPTED.
- gateStatus: PASSED / FAILED / INCOMPLETE.

LIMITED digunakan sebagai label ringkasan untuk hasil parsial; per-assertion tetap memakai outcome di atas. FAILED_CLEANUP pada tampilan lama dipetakan ke cleanupStatus=FAILED dan gateStatus=FAILED.

NOT_APPLICABLE tidak digunakan untuk permission belum tersedia, test dinonaktifkan, atau device sedang offline.

## 4. Coverage yang tidak menyesatkan

Denominator dibekukan sebelum eksekusi setelah inventory/requirement direkonsiliasi. Tambahan fitur saat exploration menambah revisi inventory; report menunjukkan revisinya.

Misalkan E = jumlah execution cell wajib setelah pengecualian NOT_APPLICABLE yang memiliki alasan. Cell BLOCKED/NOT_RUN/SKIPPED/CANCELLED tetap termasuk E.

- Executed coverage = (PASSED + FAILED) / E.
- Verified coverage = PASSED dengan evidence lengkap dan assertion wajib lengkap / E.
- Pass rate executed = PASSED / (PASSED + FAILED).
- Evidence completeness = artifact wajib yang valid / artifact wajib yang direncanakan.
- Control coverage = control-state wajib dengan aksi DAN hasil terverifikasi / seluruh control-state wajib.
- Mutation integrity coverage = scenario mutation yang memenuhi semua invariant / seluruh scenario mutation wajib.
- Matrix coverage = execution cell terverifikasi / semua cell wajib, ditampilkan per browser/device/role.

Bila denominator 0, tampilkan N/A, bukan 100%. Contoh: 8 pass, 2 fail, 90 belum dijalankan berarti executed coverage 10%, verified maksimal 8%, pass rate executed 80%.

Laporan wajib menunjukkan count dan denominator, bukan hanya satu health score.

## 5. Oracle: cara menentukan hasil yang benar

Urutan sumber expected:
1. acceptance criteria/API contract/design system yang disepakati;
2. aturan bisnis yang dikonfigurasi pemilik proyek;
3. invariant teknis yang jelas;
4. inference dari source/UI sebagai kandidat untuk direview.

Response 2xx dan toast sukses tidak cukup untuk mutation. Verifikasi juga independent read, state setelah reload/relaunch, dan side effect yang diwajibkan kontrak.

DB observation bersifat opsional menurut akses. Jika invariant transaksi memerlukan DB/event audit tetapi connector tidak tersedia, assertion tersebut BLOCKED. Report boleh menyatakan UI_API lulus, tetapi tidak menaikkan klaim menjadi UI_API_DATA.

## 6. Evidence wajib

| Kejadian | Screenshot | Video | JSON/log tambahan |
|---|---|---|---|
| Awal scenario | State awal + context | Mulai recording | Preconditions dan fixture IDs |
| Aksi penting | Before/after state | Rekam aksi + outcome | Step timestamps, target, actual |
| Visual check | Actual, baseline, diff, crop | Flow terkait | Bounds, warna, font, threshold |
| Mutation | Form dan hasil readback | Dari submit sampai readback | Sanitized request/response, before/after |
| Error/recovery | Error, retry, recovered | Seluruh urutan | Dependency/event log |
| Failure | Last reliable screenshot | Simpan segmen tersedia | Failed assertion, stack/log, data state |
| Cancellation/offline | Capture terakhir jika tersedia | Finalisasi segmen | Gap dan partial evidence |
| Cleanup | Bila UI relevan | Opsional terpisah | Ledger dan verification count |

Mode full-documentation sesuai permintaan: screenshot setiap state penting, video setiap scenario yang mengeksekusi UI, JSON seluruh run termasuk yang blocked. Mode smoke opsional lebih ringan harus bernama berbeda dan mencantumkan omission.

PNG asli menjadi evidence visual utama. Gambar beranotasi adalah turunan dengan sourceEvidenceId. JPEG preview tidak menggantikan PNG baseline.

## 7. Struktur penyimpanan yang diusulkan

Gunakan bucket test-runs yang sudah dikenal retention saat ini; final layout memerlukan migrasi collector.

~~~text
.qc-artifacts/test-runs/<projectId>/<runId>/
  manifest.json
  report.json
  summary.json
  coverage.json
  plan/
    inventory.json
    requirements.json
    execution-matrix.json
    effective-config.redacted.json
  flows/<scenarioId>/flow.redacted.yaml
  attempts/<attemptId>/
    steps.jsonl
    screenshots/<stepId>-<state>.png
    visual/<checkId>/{actual,baseline,diff,annotated}.png
    videos/segment-001.mp4
    videos/timeline.json
    snapshots/
    logs/
    network/
    data/
  findings/
  cleanup/ledger.json
  cleanup/result.json
  export/report.html
  export/report.pdf
~~~

Path di JSON relatif ke run root, hash SHA-256 per file, sizeBytes, MIME type, capture timestamp UTC, projectId/runId/attemptId/stepId. Tidak mencari artifact berdasarkan folder global terbaru. Timestamp saja tidak membuktikan ownership.

Export HTML/ZIP menyertakan manifest dan relative links. PDF menyertakan gambar, ringkasan, timestamp video, serta link ke video/JSON; PDF tidak dianggap player video.

## 8. Format JSON usulan v3

Contoh struktur, bukan hasil test aktual:

~~~json
{
  "schemaVersion": "qc-report/3.0-draft",
  "example": true,
  "run": {
    "id": "example-run",
    "projectId": "example-project",
    "platform": "web",
    "buildId": "example-build",
    "runStatus": "COMPLETED",
    "gateStatus": "FAILED"
  },
  "context": {
    "role": "editor",
    "tenant": "fixture-tenant-a",
    "profileId": "desktop-default",
    "dependencyMode": "SANDBOX"
  },
  "coverage": {
    "requiredCells": 2,
    "passed": 1,
    "failed": 1,
    "blocked": 0,
    "notRun": 0,
    "verifiedCells": 1
  },
  "assertions": [
    {
      "id": "assert-create-readback",
      "scenarioId": "resource-create",
      "attemptId": "attempt-1",
      "stepId": "readback",
      "requirementIds": ["resource-persists"],
      "outcome": "PASSED",
      "expected": {"countDelta": 1},
      "actual": {"countDelta": 1},
      "verificationLevel": "UI_API",
      "evidenceStatus": "COMPLETE",
      "evidenceIds": ["ss-readback", "video-create", "api-readback"]
    },
    {
      "id": "assert-label-contrast",
      "scenarioId": "resource-create",
      "attemptId": "attempt-1",
      "stepId": "inspect-form",
      "requirementIds": ["normal-text-contrast"],
      "outcome": "FAILED",
      "expected": {"minimumRatio": 4.5},
      "actual": {"ratio": 2.32},
      "evidenceIds": ["ss-label"]
    }
  ],
  "findings": [
    {
      "id": "finding-1",
      "category": "color",
      "severity": "medium",
      "assertionId": "assert-label-contrast",
      "expected": "Rasio teks normal minimal 4.5:1",
      "observed": "Contoh rasio 2.32:1",
      "reproduction": ["Buka form", "Periksa label pada tema light"],
      "retestAttemptId": null
    }
  ],
  "evidence": [
    {"id": "ss-readback", "type": "screenshot", "path": "attempts/attempt-1/screenshots/readback.png"},
    {"id": "video-create", "type": "video", "path": "attempts/attempt-1/videos/segment-001.mp4", "startMs": 0, "endMs": 12000},
    {"id": "api-readback", "type": "network", "path": "attempts/attempt-1/network/readback.json"},
    {"id": "ss-label", "type": "screenshot", "path": "attempts/attempt-1/screenshots/label.png"}
  ],
  "cleanup": {"status": "PASSED", "remainingOwnedObjects": 0}
}
~~~

Validator produksi mewajibkan metadata file lengkap dari bagian 7, timestamp, build provenance, dan semua reference resolve. Contoh di atas dipersingkat untuk membaca struktur.

Assertions visual menambahkan expected/actual CSS atau native bounds, unit, warna RGBA, token path, sampling method, threshold, confidence, baselineId, ignoredRegions, dan source of expected.

## 9. Rancangan tampilan report

### 9.1 Header dan ringkasan

Identitas proyek/build/environment, waktu, platform, dependency mode, matrix target, gate decision, executed/verified coverage, blocker, severity, cleanup, evidence completeness.

### 9.2 Tab report

1. Overview: gate, count, coverage, perubahan dari run pembanding.
2. Features & controls: fitur → layar → tombol → scenario → assertion.
3. CRUD & workflows: operation, relation, transaction, roles, before/after.
4. Colors & design: swatch expected/actual, token mismatch, contrast, screenshot crop.
5. Layout & responsive: viewport/device grid, overlap, overflow, state per breakpoint.
6. Accessibility: automated checks, keyboard/screen reader manual evidence.
7. API & data: payload tersanitasi, schema, authorization, conflict, persistence.
8. Evidence: screenshot gallery, baseline slider, video player, timestamp steps.
9. Findings & retest: before/after, severity, owner, issue references.
10. Limitations & cleanup: blocker, omitted cell, dependencies, ledger.

Filter konsisten: platform, build, browser/device, orientation, role, tenant, locale, theme, state, scenario, category, severity, outcome.

### 9.3 Pewarnaan report

Warna usulan harus diuji kontras saat implementasi UI report:
- PASSED: hijau dengan ikon centang dan label.
- FAILED: merah dengan ikon silang dan label.
- BLOCKED: kuning/amber dengan ikon lock dan alasan.
- NOT_RUN/SKIPPED: abu dengan label masing-masing.
- RUNNING: biru dengan progress.
- FLAKY: ungu dengan badge retry history.

Gunakan warna bersama teks/ikon; print grayscale tetap bermakna. Report mobile/tablet memiliki filter drawer dan gallery satu kolom. Card finding wajib menampilkan expected, actual, reproduction, scope, dan evidence.

## 10. Recording dan sinkronisasi

- Recorder start harus mendapat acknowledgement sebelum aksi pertama yang perlu evidence.
- Simpan monotonic timestamp untuk step-to-video, UTC untuk korelasi lintas worker.
- Recorder menghasilkan manifest segmen start/end/gap/droppedFrames bila terukur.
- Verifikasi video dapat dibuka, durasi masuk akal, dimensi dan codec tersedia, serta mencakup aksi yang diklaim.
- Simpan native aspect ratio. Preview dapat memakai padding; jangan meregangkan portrait menjadi landscape.
- Audio playback tidak terbukti hanya oleh video tanpa audio; gunakan audio probe terpisah bila merupakan requirement.
- Transcoding tidak boleh menghapus raw sebelum turunan lolos verifikasi.
- Missing/corrupt recording membuat evidenceStatus PARTIAL/MISSING dan gate INCOMPLETE untuk evidence wajib.
- Retry mempertahankan evidence percobaan pertama. Last-pass tidak menghapus intermittent failure.

## 11. Fixture dan cleanup lintas domain

Fixture contract berisi:
- adapter setup/reset/observe/cleanup;
- ownership projectId/runId dan object IDs;
- akun role dan dua tenant bila multi-tenant;
- data normal, batas, kosong, relasi, archived, conflict, dan large dataset;
- expected side effects termasuk file, queue, search index, event, notification;
- scope akun/API/database yang digunakan;
- recovery TTL dan janitor untuk run yang terputus.

Setup membuat fixture unik, menyimpan ID hasil create sebelum langkah selanjutnya. Cleanup mengikuti urutan dependency terbalik dan memeriksa file/event terkait. Record bersama yang diubah harus dikembalikan ke before snapshot atau diganti fixture milik run.

Dilarang menjadikan matching nama umum sebagai ownership. Ledger memerlukan ID dan run marker. Restore global DB/device reset memerlukan environment fixture yang memang dikhususkan.

## 12. Quality gate

Default full-suite:
- critical/high finding terbuka = 0;
- semua scenario kritis wajib = PASSED;
- mandatory control/requirement/matrix cell tidak boleh BLOCKED/NOT_RUN;
- mandatory evidence lengkap dan file valid;
- cleanup PASS;
- flaky critical unresolved menggagalkan gate;
- baseline required tersedia dan perubahan disetujui;
- manual acceptance wajib sudah direview.

Gate FAILED jika ada assertion wajib gagal atau cleanup gagal. Gate INCOMPLETE jika tidak ada failure tetapi coverage/evidence/prasyarat belum lengkap. Gate PASSED hanya jika semua syarat scope terpenuhi.

Scope terbatas boleh memiliki gate sendiri, misalnya smoke. Report tetap menampilkan bahwa full-suite belum dieksekusi.

## 13. Generalisasi domain

Domain module menyediakan vocabulary, fixture builders, invariants, business workflows, comparator, dan oracle. Engine menyediakan driver, scheduler, evidence, coverage, report.

Contoh:
- e-commerce: harga, stok, pembayaran, refund;
- ERP/CRM: relasi master-detail, bulk operation, approval, audit;
- CMS: draft/publish/version/preview;
- booking: kapasitas, timezone, benturan jadwal, cancel;
- finance: decimal, ledger balance, reconciliation;
- pendidikan: enrolment, grading, permission;
- healthcare: identitas record, consent workflow, audit;
- social/chat: ordering, delivered/read, moderation;
- map/logistics: stale location, geofence, itinerary;
- AI application: streaming, cancel, structured output, evaluation dataset dan variasi hasil;
- offline/IoT: queue, conflict, device pairing, reconnect.

Modul dipilih berdasarkan inventory dan kebutuhan pengguna; kemampuan yang tidak ditemukan tidak otomatis dihapus dari requirement.

## 14. Integrasi dengan repo sekarang

Observasi source pada 29 September 2026; ini bukan hasil menjalankan test baru.

| Area | Bukti source | Perubahan yang direncanakan |
|---|---|---|
| Canonical flow | packages/flow-schema/src/index.ts | Contract assertion/API/data, profile, evidence metadata; migrasi versi |
| Feature plan | apps/api/src/discovery/feature-contract.ts | Contract per fitur/resource/action, bukan hanya capability besar |
| Web audit | scripts/test-target-quality.cjs | Pisahkan heuristic dari verified; tambah token/layout evidence |
| CRUD | scripts/run-crud-mutations.cjs | Lifecycle ledger, independent read, concurrency, cleanup verification |
| Android | apps/api/src/android/index.ts | Hasil nyata per step, recorder, device lease, artifact ownership |
| Report JSON | apps/api/src/report/report-json.ts | Video/snapshot/network arrays dan statuses typed |
| PDF | apps/api/src/report/report-pdf.ts | Design/CRUD/matrix sections, link video |
| Video | apps/api/src/video-policy.ts | Aspect-preserving profile; current 1280x720 normalization tidak cocok semua device |
| Retention | apps/api/src/runtime-policy.ts | Protect active run, pinned baselines, dangling references |
| Web dashboard | apps/web/src | Report tabs, coverage matrix, evidence timeline |

Web audit-only tetap menjadi mode discovery/inspection. Deep CRUD menjadi suite mutation fixture tersendiri dengan report gabungan. Akun/viewer/admin report mengikuti dokumen PRODUCT_REQUIREMENTS_MULTIUSER.md; keputusan bisnis mengikuti review flow yang sudah dikonfigurasi.

## 15. Penerimaan engine QC sendiri

Gunakan target conformance yang sengaja memuat:
1. Tombol tidak melakukan apa pun: outcome harus FAILED.
2. Toast sukses dengan data tidak tersimpan: integrity FAILED.
3. Delete record yang salah: FAILED walau record lain hilang.
4. Unauthorized API menerima request: FAILED.
5. Video kosong tetapi test UI pass: evidence missing, gate INCOMPLETE.
6. Artifact milik run lain lebih baru: tidak boleh dikoleksi.
7. Missing baseline: tidak dianggap visual regression lulus.
8. ADB disconnect: assertion sebelumnya tetap, sisa BLOCKED.
9. Retry kedua pass: attempt pertama tetap terlihat, reproducibility FLAKY.
10. Nested scroll sah: tidak otomatis disebut page overflow.
11. Batch import partial sesuai kontrak: hasil dibandingkan per item.
12. Cleanup API mengembalikan sukses namun data tersisa: cleanup FAILED.

Kontrak generik belum selesai bila engine hanya lulus di satu proyek. Acceptance membutuhkan beberapa target dengan struktur/stack berbeda untuk tiap platform.

## 16. Referensi yang digunakan

- Kemampuan trace action/DOM/network Playwright: [Trace Viewer](https://playwright.dev/docs/trace-viewer).
- Finalisasi video memerlukan penutupan browser context: [Playwright videos](https://playwright.dev/docs/videos).
- Kontras teks normal 4.5:1 dan teks besar 3:1 memiliki aturan penerapan/pengecualian: [WCAG Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Web target size 24 CSS px memiliki alternatif spacing dan pengecualian; bukan aturan 48px universal: [WCAG Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Kemampuan/limit capture Android perlu dideteksi menurut device/toolchain: [Android ADB](https://developer.android.com/tools/adb).

Threshold lain dalam rancangan adalah default usulan proyek dan harus disimpan pada effective-config setiap run.

