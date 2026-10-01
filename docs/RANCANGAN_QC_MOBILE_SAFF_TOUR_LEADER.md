# Rancangan QC Mobile — SAFF Tour Leader

Catatan: dokumen ini merupakan contoh konfigurasi satu proyek. Acuan engine lintas proyek ada pada [rancangan mobile general](RANCANGAN_QC_MOBILE_GENERAL.md), [website general](RANCANGAN_QC_WEBSITE_GENERAL.md), dan [kontrak report/evidence](KONTRAK_QC_GENERAL_REPORT_EVIDENCE.md). Status, fixture ownership, dan evidence policy pada rancangan general menjadi acuan pengembangan berikutnya.

Dokumen ini menjadi blueprint QC Maestro untuk memverifikasi APK SAFF Tour Leader secara menyeluruh: fungsi, tombol, navigasi, state, desain visual, responsive layout, permission Android, API/network, data integrity, serta evidence JSON, screenshot, video, logcat, dan report.

## 1. Target dan prinsip

| Item | Target |
|---|---|
| Platform | Android APK |
| Package | `com.saff.tourleader` |
| Device baseline | `192.168.10.22:5555` |
| Backend lokal | `http://192.168.10.67:8000` |
| QC API | `http://127.0.0.1:4100` |
| Runner | Maestro + ADB + UIAutomator |
| Output | JSON, PNG, video, logcat, API snapshot, report HTML/PDF |

Status harus dibedakan dengan tegas:

- `PASSED`: assertion UI/API/data berhasil.
- `OBSERVED`: layar terlihat, tetapi kontrak fungsi belum lengkap.
- `FAILED`: assertion yang diharapkan tidak terpenuhi.
- `BLOCKED`: dependency/device/backend tidak tersedia.
- `LIMITED`: sebagian berhasil, tetapi ada dependency atau evidence yang belum tersedia.
- `NOT_RUN`: belum dieksekusi.
- `NOT_APPLICABLE`: tidak relevan, wajib ada alasan.

Screen yang terlihat saja tidak boleh dianggap PASS.

Mutation hanya boleh memakai fixture yang memiliki marker `QC-PATCH`/`QC_PATCH`, dapat di-reset, dan cleanup-nya diverifikasi sampai count marker = 0.

## 2. Coverage map

| ID | Modul | Cakupan wajib |
|---|---|---|
| AUTH | Autentikasi | launch, login valid/invalid, loading, retry, logout, session expiry |
| SYSTEM | Android/system | notification, location, background service, battery, relaunch, kill, rotation |
| COMM | Komunikasi | ruang suara, chat, room kosong/aktif, mulai/end call, participant count |
| JAMAAH | Jamaah | empty group, group, filter, search, list, detail, refresh, back |
| PRAYER | Doa & Ibadah | kategori, sort, detail, play/pause, playlist, upload, error/retry |
| TRACK | Tracking | darurat, ditemukan, peta, group selector, marker, pinpoint, zoom |
| SOS | Emergency | form, required field, submit, active alert, update/resolve, duplicate guard |
| PROFILE | Profil | summary, edit, photo, credential, valid/invalid save, logout |
| DATA | Integritas | API schema, auth, role/tenant access, before/after snapshot, cleanup |

Bottom navigation wajib memiliki assertion untuk lima tab: `Komunikasi`, `Jamaah`, `Doa`, `Lacak`, `Profil`. Untuk tiap tab: selected state, screen title/landmark, no crash, refresh, back, dan relaunch.

## 3. Matriks fitur dan tombol

### AUTH dan SYSTEM

| Aksi/kontrol | Assertion PASS |
|---|---|
| Launch app | App foreground, package benar, tidak ada FATAL exception |
| Nomor telepon/password | Input menerima format yang benar, masking password, tidak overflow |
| Masuk valid | Loading selesai, dashboard muncul, token/session tersimpan |
| Masuk invalid | Error terlihat, tetap di login, tidak crash |
| Lokasi allow | Permission result tercatat dan flow berlanjut |
| Lokasi deny | State error/retry/pengaturan jelas dan tidak loop modal |
| Background location/battery | Service state dapat diverifikasi; permission dialog tidak memblokir permanen |
| Kill/relaunch | Route dan session sesuai, tidak crash |
| Logout | Token hilang, protected API ditolak, kembali login |

### COMM

| Aksi/kontrol | Assertion PASS |
|---|---|
| Tab Ruang Suara | Tab selected, list/empty state sesuai API |
| Tab Chat | Group/participant/empty state sesuai API |
| Card room | Kode room, TA, TL, listener count konsisten |
| Mulai Panggilan | Screen call aktif, room id benar, start API 2xx, status data active |
| Join LiveKit | token dan ws URL valid, connection/participant event terbukti |
| Mute/speaker/end | UI state/audio state berubah, session berakhir, tidak duplicate |
| Refresh | Tidak ada stale room atau count |

### JAMAAH

| Aksi/kontrol | Assertion PASS |
|---|---|
| Group card | Batch-room dan leader benar |
| Empty state | Pesan dan action contact TA benar |
| Semua/Lansia/Dewasa/Anak-anak | Count/list sesuai fixture |
| Search | Exact/partial/empty result benar, stale item hilang |
| Detail jamaah | `id_jamaah`, identitas, batch, hotel benar |
| Back/refresh | Kembali ke parent dan data konsisten |

### PRAYER

| Aksi/kontrol | Assertion PASS |
|---|---|
| Kategori dan sort | Data, urutan terbaru/A-Z, empty state benar |
| Detail/play/pause/seek | Audio metadata dan state player berubah |
| Unggah Audio | picker, permission, MIME/size validation, progress, result |
| Buat Playlist | required field, duplicate guard, persistence |
| Retry | Timeout/error dapat pulih tanpa duplicate |

### TRACK dan SOS

| Aksi/kontrol | Assertion PASS |
|---|---|
| Darurat/Ditemukan | Count/list/status sesuai endpoint |
| Peta Anggota | Selector group, map, marker identity/count benar |
| Lokasiku/zoom | Permission, center, zoom, controls tidak tertutup system bar |
| Form SOS | Required field, target jamaah, koordinat, validation |
| Submit SOS | 2xx, active alert muncul, row DB terbentuk |
| Update/resolve | UI/API/DB state berubah dan unauthorized ditolak |
| Double submit | Hanya satu alert, button loading/disabled |

### PROFILE

| Aksi/kontrol | Assertion PASS |
|---|---|
| Summary | user, role, phone, batch benar |
| Edit | Form terisi dari server |
| Ubah foto | picker/permission/file validation/progress/result |
| Simpan valid | 2xx, response berubah, relaunch tetap menyimpan |
| Simpan invalid | Error per-field, DB tidak berubah |
| Logout | Session invalid setelah logout |

## 4. Contract per flow

Setiap flow harus memuat actor, fixture, precondition, scenario, steps, assertions, evidence, dan cleanup.

```yaml
id: mobile-sos-create
platform: android
appId: com.saff.tourleader
device: 192.168.10.22:5555
actor: tour_leader
fixture: qc-patch-active-room
preconditions:
  - backend_health_200
  - adb_device_ready
  - authenticated_session
  - active_batch_room
scenarios: [happy, negative, permission, recovery, duplicate, integrity]
assertions:
  ui: [sos_form_visible, active_alert_visible]
  api: [post_emergency_2xx, get_emergency_2xx]
  data: [ems_row_created, marker_cleanup_verified]
evidence:
  screenshots: required
  video: required
  api_snapshot: required
  logcat: required_on_failure
cleanup:
  marker: QC-PATCH
  required: true
```

Scenario minimum untuk setiap fitur: happy, invalid/negative, boundary, permission/role, offline/timeout/retry, back/relaunch/refresh, duplicate/concurrency, dan data integrity.

## 5. Responsive dan device matrix

Android responsive bukan hanya browser viewport. Ukur resolusi, density, orientation, system bars, keyboard, font scale, dan tab/layout.

| Profile | Target |
|---|---|
| D1 | TECNO CM5 baseline, portrait, font 1.0 |
| D2 | small screen 360x640 dp, portrait |
| D3 | standard 393x852 dp, portrait |
| D4 | tablet/600+ dp |
| D5 | baseline landscape |
| D6 | font scale 1.3/1.5 |
| D7 | system theme/dark jika didukung |

Assertion per profile:

- tidak ada clipping, overlap, text truncation, atau CTA keluar layar;
- bottom nav tetap bisa disentuh saat keyboard tampil;
- dialog/modal memiliki CTA yang terlihat dan dapat ditutup;
- target sentuh ditargetkan minimal 48dp;
- room code, nama panjang, unicode, dan error message wrap;
- map, player, SOS, dan call control tidak tertutup system/navigation bar;
- rotation tidak menghilangkan input, token, selected tab, atau unsaved warning;
- screenshot menyimpan metadata profile, resolusi, density, font scale, dan orientation.

## 6. Visual/design QC

### Automated

- baseline PNG per `flow + screen + device profile + orientation`;
- pixel diff dengan threshold yang disetujui;
- UIAutomator bounds check untuk target penting;
- clipping/overlap heuristic;
- screenshot state loading, empty, error, success, disabled, selected, active call;
- screenshot failure otomatis.

### Manual review

- hierarki typography dan spacing konsisten;
- primary/secondary/destructive action jelas;
- status darurat, active call, error, success tidak ambigu;
- semua icon punya semantic label/content description;
- loading tidak terasa hang;
- copy Indonesia tidak terpotong dan mudah dipahami;
- map/audio/dialog/form nyaman dipakai satu tangan;
- TalkBack hanya dinyatakan verified bila benar-benar dijalankan dan ada transcript/evidence.

Baseline hanya boleh di-update setelah UI change disetujui.

## 7. Screenshot, JSON, video, log

Struktur artifact:

```text
.qc-artifacts/mobile-runs/<project>/<runId>/
  manifest.json
  summary.json
  report.json
  report.html
  report.pdf
  flows/*.yaml
  screenshots/<profile>/*.png
  videos/*.mp4
  videos/*.video.json
  api/requests.jsonl
  api/responses-sanitized.jsonl
  api/schema-results.json
  device/adb-devices.txt
  device/build-info.txt
  device/permissions.txt
  device/ui-before.xml
  device/ui-after.xml
  device/logcat.txt
  data/before.json
  data/after.json
  data/cleanup.json
  findings/*.json
```

JSON minimum:

```json
{
  "reportVersion": "mobile-1.0",
  "target": {
    "platform": "android",
    "package": "com.saff.tourleader",
    "deviceId": "192.168.10.22:5555",
    "backend": "http://192.168.10.67:8000",
    "appVersion": "1.1.0"
  },
  "summary": { "verified": 0, "failed": 0, "blocked": 0, "limited": 0, "notRun": 0 },
  "features": [],
  "findings": [],
  "cleanup": { "status": "NOT_RUN", "marker": "QC-PATCH", "remainingRows": null }
}
```

Setiap feature result menyimpan `featureId`, `scenario`, status, precondition, assertions UI/API/data, screenshot paths, video path, logcat path, API snapshot, limitation, dan cleanup result. Token, password, bearer header, dan PII harus dimasking.

Video wajib untuk flow kritis: login/permission, call, jamaah detail, map, SOS, edit profile, dan offline recovery. Android memakai `adb shell screenrecord`; file diberi sidecar JSON:

```json
{
  "flowId": "mobile-profile-edit-save",
  "runId": "run-2026-09-29-001",
  "deviceId": "192.168.10.22:5555",
  "resolution": "1080x2436",
  "durationMs": 12000,
  "file": "videos/mobile-profile-edit-save.mp4",
  "status": "PASSED",
  "stepsCovered": ["open_profile", "tap_edit", "change_name", "save", "assert_persisted"]
}
```

Jika screenrecord gagal, flow tidak boleh otomatis PASS; status evidence menjadi `LIMITED` dan alasan disimpan.

## 8. Arsitektur tooling yang perlu dibangun

### A. Android runner foundation

- `MobileRunContext`: runId, device, package/version, profile, backend, fixture, orientation.
- Preflight: ADB connected, package/version, screen size/density, permissions, battery, backend health.
- Commands: screenshot, UI dump, logcat window, screenrecord start/stop, orientation, keyboard, network state.
- Collector yang hanya mengambil screenshot dari run aktif, bukan folder Maestro global yang stale.
- Artifact type Android harus mendukung `video` dan sidecar metadata.

### B. Flow compiler/contract

Tambahkan aksi/assertion: `waitFor`, `assertNotVisible`, `assertText`, `assertApi`, `assertDbSnapshot`, `captureUiDump`, `recordStart`, `recordStop`, `setOrientation`, `setNetwork`.

Selector priority:

1. resource-id;
2. content-desc/accessibility id;
3. semantic text;
4. coordinate fallback.

Coordinate fallback wajib mencatat `selectorQuality: fallback-coordinate` dan tidak boleh menjadi satu-satunya selector untuk fitur kritis.

### C. Fixture/data lifecycle

- manifest fixture versioned untuk TL, TA, batch, room, jamaah, location, prayer, chat, SOS;
- setup idempotent dengan unique run marker;
- cleanup hanya marker milik run;
- snapshot before/after;
- cleanup count 0 sebagai gate;
- cleanup gagal menghasilkan `FAILED_CLEANUP`.

### D. Report/dashboard

Dashboard harus memiliki filter platform/device/feature/status, coverage matrix feature x scenario x device, screenshot viewer, video link, UI dump, API request, finding, retest, serta pemisahan `observed` dan `verified`.

## 9. Urutan flow eksekusi

1. `M01-preflight-device-backend`
2. `M02-launch-permission`
3. `M03-login-valid-invalid`
4. `M04-dashboard-bottom-navigation`
5. `M05-communication-room-chat`
6. `M06-start-end-call`
7. `M07-jamaah-filter-search-detail`
8. `M08-prayer-sort-player-playlist`
9. `M09-tracking-group-map-marker`
10. `M10-sos-create-update-resolve`
11. `M11-profile-edit-save-invalid`
12. `M12-offline-timeout-retry`
13. `M13-background-location-relaunch-kill`
14. `M14-responsive-device-profiles`
15. `M15-cleanup-final-report`

Flow dependent tidak dijalankan jika precondition gagal; hasilnya `BLOCKED`, bukan PASS palsu.

## 10. Definition of Done

- seluruh screen, tab, semantic button, icon action, modal, form, dan system interaction ada di inventory;
- setiap fitur punya happy, negative, permission, recovery, dan integrity scenario;
- responsive matrix menghasilkan screenshot setiap profile wajib;
- JSON, screenshot, video, UI dump, API snapshot, logcat, dan cleanup report tersedia;
- tidak ada PASS yang hanya berdasarkan elemen terlihat;
- setiap BLOCKED/LIMITED punya dependency dan langkah reproduksi;
- fixture/token tidak bocor;
- cleanup terverifikasi 0 marker row;
- report dapat membedakan lulus, gagal, belum dijalankan, dan terblokir.

## 11. Gap yang harus dibuktikan pada eksekusi berikutnya

Berdasarkan runtime terakhir, dashboard, navigasi, komunikasi, jamaah, doa, tracking, peta, dan profil sudah pernah diamati. Namun item berikut belum boleh dianggap verified penuh sebelum ada evidence baru:

- LiveKit audio/websocket real-time;
- submit/update SOS melalui UI;
- save edit profile sampai persistence setelah relaunch;
- video Android dari runner;
- responsive lintas device/orientation/font scale;
- backend preflight stabil;
- report JSON khusus mobile dan cleanup gate.
