# Rancangan QC Mobile General

Status: rancangan implementasi lintas proyek, 29 September 2026.

Dokumen ini mencakup aplikasi native Android/iOS, Flutter, React Native, hybrid/WebView, tablet, foldable, dan aplikasi mobile dengan backend atau penyimpanan lokal. Package, bundle ID, nama layar, jumlah tab, API, role, resource, serta device berasal dari project profile.

Baca juga [kontrak report/evidence](KONTRAK_QC_GENERAL_REPORT_EVIDENCE.md) dan [rancangan website](RANCANGAN_QC_WEBSITE_GENERAL.md). Target kualitas fungsi, CRUD, visual, screenshot, video, dan JSON setara, dengan mekanisme pengujian yang sesuai mobile.

## 1. Scope dan kemampuan engine

Engine mobile memiliki:
1. Project/build intake.
2. Driver registry dan capability probe.
3. Device lab/lease/scheduler.
4. Screen/control/state inventory.
5. Business contract dan resource contract.
6. Runner UI/API/data/device events.
7. Visual/adaptive-layout inspector.
8. Screenshot/video/log collector.
9. Coverage, report, retest, cleanup.

Generalisasi dilakukan melalui driver dan project modules. Dukungan iOS atau hardware khusus adalah target arsitektur; repo saat ini baru memiliki platform schema web/android dan runner Android. Host Windows tidak diasumsikan dapat menjalankan seluruh toolchain iOS lokal.

## 2. Keadaan source saat rancangan dibuat

Hasil pembacaan source:
- Android runner memakai Maestro dan ADB.
- UIAutomator membantu membaca text/content-desc dan bounds.
- APK inspection dan install tersedia.
- Screenshot dan runner log dapat dikoleksi.
- Raw flow dan compiled flow memiliki jalur eksekusi berbeda.
- Compiled flow masih menurunkan status langkah dari exit code keseluruhan.
- Artifact Android belum memasukkan video pada daftar type lokal.
- Generator Android masih memuat flow aplikasi tertentu.
- Device probe dapat melaporkan tool tersedia berdasarkan file meskipun version command gagal.

Semua ini menjadi backlog perbaikan: status nyata per-step, capability probe, flow generik, artifact ownership, video, dan hasil test yang tidak menebak step pass.

## 3. Project intake lintas aplikasi

| Area | Input |
|---|---|
| Build | APK/build Android, installed package, atau build iOS sesuai target worker |
| Identity | package/bundle ID, version/build number, binary hash/signing metadata |
| Source optional | repository/ref, route/navigation map, semantic keys, model/schema |
| Backend optional | environment URL, service dependencies, test API, observability |
| Local-only | local storage schema/test hooks atau UI persistence oracle |
| Actors | roles, tenant, test accounts, authentication method |
| Capabilities | camera, files, location, audio, notification, BLE, NFC, biometric, etc. |
| Devices | OS/version/API, model, form factor, orientation, input/accessibility profile |
| Design | tokens, native theme, reference screenshots, component rules |
| Data | resource contracts, fixture adapters, local/server cleanup |
| Evidence | screenshot/video/JSON full-documentation policy |
| Domain | workflow modules dan dependencies |

Input secrets berupa references. APK-only masih bisa diuji via semantics/UI; source meningkatkan discoverability dan pengukuran token tetapi bukan syarat untuk smoke.

## 4. Driver architecture

### 4.1 Interface driver usulan

- probeCapabilities(): tools, version, target availability, supported operations.
- acquireDevice(): lock pada stable device identity.
- inspectBuild()/install()/launch()/terminate().
- getHierarchy()/findControl()/performAction().
- waitForCondition()/assertState().
- screenshot()/startRecording()/stopRecording().
- getLogs()/observeNetwork() jika tersedia.
- setOrientation()/setWindowProfile()/setFontScale() jika supported.
- transitionLifecycle()/setPermission()/injectFixtureInput() sesuai platform.
- restoreDeviceState()/releaseDevice().

Setiap metode menghasilkan actual timestamps, outcome, errorKind, dan evidence. Unsupported method menghasilkan BLOCKED/UNSUPPORTED capability; tidak diam-diam menjadi no-op.

### 4.2 Adapter selection

| Target | Strategi awal | Hal yang harus diprobe |
|---|---|---|
| Android native | Maestro/ADB/UIAutomator adapter | Semantics, gesture, recording, logs |
| Flutter | Driver UI dengan accessibility tree; source hooks bila tersedia | Merged semantics, custom canvas, stable IDs |
| React Native | Accessibility/test identifiers dari build | Accessible grouping dan target resolution |
| Hybrid/WebView | Native driver + web context adapter | Context switching, bridge, keyboard, navigation |
| iOS | Worker macOS + driver simulator/device yang tersedia | Build compatibility, signing/provisioning, logs, recording |
| Canvas/game/custom renderer | Explicit test hooks + visual/manual cases | Target identity dan deterministic expected state |
| Hardware-centric | Physical device + accessory adapter | Pairing, permissions, real sensor/device state |

Driver package/version dipin untuk reproducibility. Nama CLI/flag diverifikasi pada implementasi, bukan di-hardcode berdasarkan asumsi lintas versi.

## 5. Device preflight dan lifecycle runner

### 5.1 Preflight yang benar-benar dieksekusi

- ADB/device worker online, authorized, target unik.
- OS/build/device identity sesuai profile; IP saja tidak menjadi identitas permanen.
- Package terpasang dan binary/version sesuai run.
- Screenshot probe, hierarchy probe, tap/read-only probe pada fixture launcher bila dibutuhkan.
- Recorder start/stop probe menghasilkan file yang dapat dibaca.
- Storage, battery/thermal, screen lock, emulator readiness.
- Permission state, network/interface, locale/font/display scale, orientation.
- Backend/dependency yang diperlukan scenario responsif.
- Clock skew device/worker/server terukur.
- Device tersedia secara eksklusif bagi run.

Tool binary ada tidak sama dengan tool siap menjalankan scenario. Request timeout tidak langsung menyimpulkan server mati; health probe mencatat endpoint, elapsed, response, retry limit, dan dependency.

### 5.2 State machine run

Queued → Preflight → Acquired → Fixture ready → Executing → Finalizing evidence → Cleanup → Released → Completed.

Interrupt/cancel/disconnect dari setiap tahap masuk finalization yang menyimpan hasil parsial. Guard memastikan cleanup dan release tetap dicoba. Jika device hilang, recovery ledger disimpan untuk saat reconnect.

### 5.3 Mengelola shared physical device

Snapshot setting awal. Perubahan permission/font/rotation/network/package harus scoped ke test plan. Restore setting saat selesai. Clear data/reinstall hanya memakai kebijakan explicit pada test build/account fixture.

Jangan uninstall otomatis ketika signing mismatch. Tandai conflict dan jalankan reinstall hanya bila project/device profile memang mengizinkannya. Personal device tidak diperlakukan seperti disposable emulator.

## 6. Inventory layar, kontrol, dan state

### 6.1 Discovery

- Navigation declarations/source route, component semantics, manifest/deep links.
- Runtime hierarchy dan screenshot setiap distinct screen.
- Login per role dan environment fixture.
- Expand overflow menus, drawers, sheets, dialogs, nested tabs.
- Scroll untuk menemukan lazy lists dan bagian tersembunyi.
- System surfaces: permission dialog, picker, notification, share sheet.
- Manual label untuk custom-rendered UI.
- Feature flags dan license/account entitlements.

### 6.2 Model screen

screenId + role + appState + windowProfile + meaningful business state. Child sheet/dialog menjadi sub-screen. System UI menyimpan system package owner agar tidak tercampur dengan aplikasi.

Fingerprint tidak bergantung pada jam/counter/item IDs acak. Inventory menampilkan discovered controls, unresolved labels, dan screen frontier yang belum dieksplorasi.

### 6.3 Model control

Simpan semantic ID/resource ID, label, role/class, enabled/clickable/selected, bounds dalam px dan dp/pt bila tersedia, parent screen, supported gestures, expected effect, risk, screenshot crop, dan locator alternatives.

Selector order ditentukan kualitas/keunikan:
1. Stable test ID/resource ID/accessibility identifier.
2. Accessible role/name yang unik.
3. Text exact + parent scope.
4. Relative geometry/coordinate untuk build/profile tertentu.
5. Visual/manual selection untuk control tanpa semantics.

Coordinate dicatat sebagai fallback; test tidak dapat dianggap portable lintas tablet/orientation tanpa resolve ulang. Ambiguous targets harus gagal atau direview, bukan tap item pertama secara acak.

## 7. Katalog aksi lintas mobile

| Control/interaction | Variasi test | Expected |
|---|---|---|
| Button/icon | tap, disabled, loading, rapid repeat | Outcome benar dan tidak duplicate |
| Bottom/top tabs | switch, repeated tap, badge, overflow, keyboard | Selected panel dan state terjaga |
| Drawer/menu | open/close/item/back | Destination/focus benar |
| Sheet/dialog | drag/cancel/confirm/back/outside | Data/unsaved behavior sesuai contract |
| Input | IME next/done, clear, paste, autofill, secure field | Value/validation/payload benar |
| Picker | date/time/file/photo/camera/select | Cancel dan selection konsisten |
| Lists | lazy load, pull refresh, filter, end-of-list | Tidak duplicate/missing/stale |
| Swipe/long press | reveal action, dismiss, context menu | Gesture tidak memicu action lain |
| Drag/reorder | valid/invalid target, cancel | Urutan tersimpan |
| Media | play/pause/seek, background, route change | State dan playback output sesuai |
| Map | pan/zoom/select/location permission | Coordinates/selected entity sesuai |
| Back navigation | system back, gesture back, app back | Stack/back destination benar |
| Deep link | cold/warm/authenticated/expired | Destination dan access guard benar |

Tidak mengasumsikan semua aplikasi memiliki lima tab atau satu halaman login.

## 8. Authentication dan access control

- Password, PIN, SSO, magic link, OTP, biometric sesuai kapabilitas proyek.
- Permission sistem ditolak tidak boleh membuat session bisnis ambigu.
- Invalid/expired OTP, resend cooldown, locked account, device change.
- Biometric unavailable/not enrolled/cancel/fallback.
- Session expiry saat offline dan sesudah reconnect.
- Logout, relaunch, OS back tidak membuka data protected.
- Refresh token race saat beberapa request berjalan.
- Tenant switching membersihkan data cache/display yang tidak boleh terbawa.
- Deep link dan push ke entity unauthorized ditolak oleh UI dan server.
- Token/cache clearing diuji melalui approved observation method.

Testing biometrics/sensor pada emulator adalah SIMULATED evidence; acceptance physical behavior memakai device nyata bila requirement tersebut wajib.

## 9. Deep CRUD mobile: kontrak dan observer

Resource contract sama kuatnya dengan website:
- required/nullable/unique/derived/server-managed fields;
- relation dan ownership;
- create/read/update/delete/restore/bulk;
- lifecycle/business invariants;
- persistence store: server/local/offline queue;
- version/conflict/idempotency rules;
- retry dan eventual consistency deadline;
- file/cache/search/event effects;
- fixture setup/cleanup ledger.

Observability levels:
1. UI readback setelah reload/relaunch.
2. UI + independent API read.
3. UI + API + DB/event observer.
4. Local storage observer/test hook pada debug/test build.
5. Manual assisted bila storage internals tidak dapat diakses.

Production sandbox tidak diasumsikan bisa dibaca via ADB. Assertion yang memerlukan local DB tanpa akses tetap BLOCKED walau layar tampak benar.

## 10. Deep CRUD mobile: skenario per operation

### 10.1 Create

- Minimum/all fields, invalid/null/empty/whitespace, boundary panjang/nilai.
- Input phone/decimal/currency/date dengan keyboard dan locale berbeda.
- Parent inactive/deleted/foreign tenant.
- Double tap, timeout after server commit, network handoff saat submit.
- Attachment upload berhasil tetapi record gagal, dan sebaliknya.
- Background saat submit; foreground dan independent read menentukan hasil.
- Force process death setelah local queue commit sebelum ack server.
- Server defaults dan generated IDs diterapkan ke local state.
- Reload/relaunch/fresh device session membuktikan persistence sesuai contract.

### 10.2 Read/search

- Cache kosong, warm cache, stale cache, offline data.
- Pull-to-refresh ketika pagination berjalan.
- Scroll ke item jauh, virtualized lists, item height berubah.
- Filter/sort/search setelah tab switch dan rotation.
- Sync menambah/menghapus item saat list terbuka.
- Missing/deleted/unauthorized detail.
- Long press contextual action hanya pada entity yang dipilih.
- Count/list/detail/cache konsisten.

### 10.3 Update

- Partial update dan field untouched tidak hilang.
- Null vs empty, false/zero vs omitted.
- Edit nested children/attachment/order.
- Autosave saat keyboard ditutup atau app background.
- Save invalid tidak mengubah server/local committed state.
- Two actors/two devices mengedit version sama.
- Conflict merge, server-wins/client-wins/manual resolution sesuai contract.
- Undo/cancel/back navigation mengembalikan state yang dijanjikan.
- Stale record dihapus server sebelum save.
- Setelah app kill/relaunch, saved dan unsaved state sesuai requirement.

### 10.4 Delete/restore

- Cancel vs confirm, swipe delete/undo.
- Delete item saat offline: tombstone/queue sesuai contract.
- Delete parent in-use: cascade/restrict dan child queue behavior.
- Simultaneous edit/delete di dua actor.
- Local cached detail tidak memunculkan deleted record setelah sync.
- Restore conflict dengan unique field yang sudah dipakai.
- Bulk selection melintasi halaman dengan permission mixed.
- Attachment/cache cleanup sesuai data lifecycle policy.

### 10.5 Transaction/domain state

- Wizard multi-step interrupted; resume/cancel.
- Cart/order/reservation/approval bukan sekadar create row.
- Payment/in-app purchase sandbox: success/fail/cancel/pending/restore bila ada.
- No network after commit: status reconciles, pengguna tidak perlu membayar ulang.
- Queue/event ordering dan exactly-once business effect diuji melalui invariant, bukan klaim transport.
- Multi-screen totals/status sesuai server authoritative state.

## 11. Offline sync dan concurrency mendalam

Pack offline wajib bila aplikasi mendukung:

| ID | Trigger | Bukti hasil |
|---|---|---|
| SYNC-01 | Create offline → reconnect | Satu local item berubah ke server ID; tidak duplicate |
| SYNC-02 | Update sama berulang offline | Queue/coalescing dan final value sesuai contract |
| SYNC-03 | Delete offline → remote update | Conflict/tombstone resolution jelas |
| SYNC-04 | Parent-child create offline | Dependency order dan foreign key benar |
| SYNC-05 | Server commit, ack hilang | Retry/reconciliation tidak menggandakan |
| SYNC-06 | Logout sebelum sync | Data tenant lama tidak dikirim dengan session baru |
| SYNC-07 | App kill/reboot saat queue | Durable queue pulih atau loss dilaporkan sesuai contract |
| SYNC-08 | Storage full | Feedback, no corrupt record, retry setelah space tersedia |
| SYNC-09 | Clock skew | Conflict tidak hanya bergantung jam client tanpa aturan |
| SYNC-10 | Two-device race | Expected version/conflict terbukti dengan shared barrier |
| SYNC-11 | Rate limit/batch partial | Progress per item, bounded backoff, tidak retry selamanya |
| SYNC-12 | Reconnect flapping | UI status akurat dan no duplicate listener/request |

Data before/after mencakup local temp ID, server ID, revision, queue item state, retry count, tenant owner, side effects. Capture menggunakan test hooks yang tersedia; missing observer dicatat.

## 12. Lifecycle dan OS interruptions

- Cold start/warm start setelah splash.
- Foreground → background → foreground pada form, upload, audio, map, transaction.
- OS process death berbeda dari force-stop; keduanya punya case terpisah.
- Screen lock/unlock, notification shade, permission settings return.
- Rotation/window resize ketika keyboard, dialog, file picker, dan request berjalan.
- Incoming call/audio focus change dengan fixture/test device.
- Memory pressure/low storage/battery saver/thermal bila worker mendukung.
- OS reboot dan persisted work sesuai requirement.
- Install fresh, upgrade dari supported previous version, local schema migration.
- Downgrade hanya bila produk mendukung; signing incompatible ditangani sebagai preflight conflict.
- Background work restart dan completion notification.

No-crash perlu logs/crash diagnostics serta app-state observation. UI foreground saja tidak membuktikan background service berjalan.

## 13. Hardware dan platform modules

| Module | Scenario wajib bila applicable | Fixture/dependency |
|---|---|---|
| Camera/photo | allow/deny/cancel/capture/rotate/invalid file | Test media, device camera |
| Location | deny/approximate/precise/stale/no-fix/background | Simulated coordinates + real device lane |
| Notification | denied/foreground/background/cold tap/deep link | Test push service dan test recipients |
| Audio/video | output, mic permission, interruption, route, latency | Audio probe/second endpoint |
| BLE/NFC | scan/pair/deny/disconnect/reconnect/unavailable | Dedicated peripherals atau simulator |
| QR/barcode | valid/invalid/low-light/cancel/multi-scan | Test codes dan camera fixture |
| Biometric | success/fail/cancel/lockout/fallback | Supported worker/device |
| Share/files | canceled share, MIME, receiving target | Test files dan approved target app |
| Wearable/printer | connect/send/error/retry/duplicate action | Hardware-specific connector |

Hardware module tanpa dependency tidak dihapus dari scope; BLOCKED dan daftar alat yang diperlukan tampil pada report.

## 14. Visual: warna, typography, layout

### 14.1 Sumber expected

- Design tokens/theme/native styles/source bila tersedia.
- Approved reference screenshots per platform/profile.
- Component spec untuk bounds, padding, icon, text.
- Consistency heuristic jika tidak ada source.
- Manual review untuk brand/estetika/custom rendering.

Native UI hierarchy sering tidak memuat font/color/shadow. Pixel sampling/OCR menghasilkan estimasi; report mencatat method dan confidence. Tidak boleh mengarang exact token dari screenshot.

### 14.2 Color checks

Normal, pressed, focused, selected, disabled, loading, error, success, dark theme:
- foreground/background/icon/border state benar;
- contrast sesuai acceptance target;
- label/shape membantu membedakan state selain warna;
- system bars/insets dan dialog native harmonis;
- gradient/photo background diuji per region.

Report: expected swatch/token, actual sampled/computed value, ratio/delta, region bounds, source method, baseline/actual/diff.

### 14.3 Typography/layout

- Font fallback/missing glyph, text scale, line wrapping.
- Native text accessibility scaling dan RTL.
- Padding/gap/alignment consistent across cards/forms.
- Touch target dan hit-test bounds; Android 48dp/iOS 44pt dapat dijadikan target desain proyek, bukan ukuran pixel screenshot universal.
- Insets/notch/cutout/edge-to-edge/navigation bar.
- Keyboard occlusion dan scroll-to-focused-field.
- Modals/sheets bottom CTA tetap reachable.
- Long content/dense lists/big amounts/translated strings.
- Nested scrolling, horizontal list, badge overlay yang memang disengaja.
- Touch position diperiksa terhadap rendered/hit bounds.

## 15. Responsive/adaptive: phone, tablet, foldable

### 15.1 Profile dimensions

Simpan:
- physical device model, OS version, display px, density;
- available app window dp/pt dan insets;
- portrait/landscape, fullscreen/split screen/floating;
- font/display scale, locale, RTL, theme;
- navigation mode dan input mode (touch/keyboard/stylus bila applicable).

Jangan menyamakan 1080px device dengan 1080 CSS px browser.

### 15.2 Matrix awal usulan

| Profile | Purpose |
|---|---|
| Compact phone | Form/CTA pada window sempit |
| Standard phone | Main functional suite |
| Large phone | Long text/list/map layout |
| Tablet portrait | Grid/list-detail/navigation rail menurut desain |
| Tablet landscape | Expanded layout, dialog width, master-detail |
| Foldable closed/open | Resize continuity, hinge/cutout bila tersedia |
| Split-screen | Window width berkurang tanpa ganti device |
| Large font | 1.3/1.5 dan setting besar yang didukung |
| RTL/long locale | Text direction dan expansion |
| External keyboard | Focus traversal dan shortcuts jika supported |
| Oldest supported OS | Backward behavior dan permission |
| Newest supported OS | OS interaction regression |

Ukuran konkret diisi berdasarkan supported devices proyek. Simulasi ukuran pada phone tidak menjadi bukti tablet/foldable fisik. Emulator profile dan physical lane diberi label berbeda.

### 15.3 Assertions untuk tablet/adaptive

- Bottom tabs/navigation rail/drawer beradaptasi menurut design contract.
- Selected screen tetap sama setelah resize/rotation.
- Master-detail tetap mengacu item yang benar ketika pane muncul/hilang.
- Dialog tidak melebar penuh tanpa aturan atau menyempit hingga CTA terpotong.
- Form/table/grid memakai available width dan tetap dapat discroll.
- Focus/keyboard/error message tidak hilang saat pane berpindah.
- Unsaved input, media progress, list position sesuai retention requirement.
- Hinge/insets tidak menutup actions.
- Empty/loading/error/offline/dense states diuji pada expanded layout juga.

Tablet pass membutuhkan screenshot dan functional evidence pada profile tablet, bukan hanya screenshot telepon yang diperbesar.

## 16. Accessibility dan language

- Accessible labels/hints, state selected/checked/disabled.
- Reading order dan grouping tidak menggabungkan seluruh layar menjadi satu node.
- Dynamic result/error announcement dan focus setelah navigation/dialog.
- TalkBack/VoiceOver task execution dengan transcript/manual notes.
- Text scaling, high contrast settings yang didukung, reduced motion.
- Password masking dan input purpose.
- RTL, decimal keyboard, calendar/timezone, plural, truncation.
- Gesture-only actions punya alternatif bila diwajibkan kontrak accessibility.
- Screen reader automatic text extraction tidak disamakan dengan uji pembacaan nyata.

## 17. API/network observability pada mobile

Android/iOS driver tidak otomatis memiliki Playwright network trace. Pilih:
1. Instrumented test build/network interceptor.
2. Test backend request logs dengan correlation IDs.
3. Approved test proxy pada build yang mendukung.
4. Direct API probes sebagai test terpisah.
5. UI-only observation bila lainnya tidak tersedia.

TLS pinning dan encrypted traffic dapat membatasi proxy; tidak mematikan protection production untuk membuat test pass. Untuk mutation, direct API success setelah UI click hanya kuat bila entity/correlation sesuai. Time proximity saja tidak cukup.

Log collector membatasi package/process/time range; device logs lain tidak ikut menjadi report proyek.

## 18. Screenshot mobile

Capture policy:
- start/end screen dan key state setiap scenario;
- before/after untuk mutation, overlay, keyboard, responsive transition;
- failure + last known good state;
- hierarchy snapshot per step yang dipakai untuk assertion;
- actual/baseline/diff/crop untuk visual check.

Capture menyimpan display/window bounds, density, orientation, status/navigation bar masks, screenId, stepId, package, build, timestamp. Secure/DRM screens yang kosong memiliki evidenceStatus missing/partial beserta alasan; tidak dianggap screenshot sukses hanya karena file PNG ada.

Long screen menggunakan viewport captures dengan urutan scroll. Stitched preview diberi label composite dan bukan evidence single instant.

## 19. Video mobile

### 19.1 Per-flow recording

Mode full-documentation merekam setiap scenario UI, termasuk negative/recovery. Recorder dipilih melalui device capability. Android ADB menyediakan screen recording dengan keterbatasan platform/tool yang harus diperiksa saat runtime. [Android ADB](https://developer.android.com/tools/adb).

Proses:
1. Probe supported resolution/duration/codec.
2. Start recorder dan tunggu acknowledgement.
3. Rekam steps dengan monotonic timestamps.
4. Segment saat duration limit/rotation/recorder restart.
5. Stop terkontrol, tunggu finalisasi, pull file ke run folder.
6. Decode/metadata check, duration/coverage validation.
7. Simpan timeline dan gap.
8. Hapus device temp milik run setelah local file terverifikasi.
9. Buat preview/export aspect-preserving.

Record video gagal tidak membatalkan fact bahwa assertion UI pass, tetapi evidence incomplete mencegah full gate PASS.

### 19.2 Video timeline JSON

~~~json
{
  "schemaVersion": "qc-video/next",
  "example": true,
  "attemptId": "attempt-1",
  "segments": [
    {
      "id": "seg-1",
      "path": "videos/segment-001.mp4",
      "fromMs": 0,
      "toMs": 20000,
      "orientation": "portrait",
      "captureWidthPx": 1080,
      "captureHeightPx": 2400,
      "hasAudio": false
    }
  ],
  "steps": [
    {"stepId": "submit", "fromMs": 4000, "toMs": 6000, "segmentId": "seg-1"},
    {"stepId": "readback", "fromMs": 10000, "toMs": 14000, "segmentId": "seg-1"}
  ],
  "gaps": []
}
~~~

Jangan mengklaim audio/call lulus dari hasAudio=false. Audio flow memerlukan second endpoint/test signal/recorded audio metrics atau human evidence sesuai contract.

## 20. JSON dan report mobile

Menggunakan qc-report/3.0-draft pada kontrak bersama, dengan context tambahan:
- os, osVersion, model, device alias, real/emulator;
- driver/tool versions, build hash/version/signing metadata;
- displayPx/windowDpOrPt/density/insets/fontScale/orientation;
- permissions before/after, lifecycle state;
- network state dan observer method;
- backend/dependency mode;
- fixture ownership/local/server IDs.

Report tabs:
1. Overview dan coverage.
2. Screens/controls.
3. Deep CRUD/offline sync.
4. Color/typography/layout.
5. Device/tablet/responsive matrix.
6. Permissions/lifecycle/hardware.
7. API/data/performance.
8. Screenshot gallery/video timeline.
9. Findings/retest.
10. Cleanup/limitations.

Video membuka timestamp step yang dipilih. Screenshot annotated memperlihatkan clipping/hit target/overlap. Grid comparison menampilkan phone/tablet/landscape/font-large dengan metadata, bukan gambar tanpa konteks.

## 21. Performance/stability mobile

- Cold/warm launch, time-to-interactive, time-to-data.
- Tap-to-feedback dan save/readback time.
- Scroll jank/frame timing bila profiler tersedia.
- Memory growth, background jobs, socket/listener accumulation.
- Battery/thermal/network usage pada scenario berulang dengan durasi terukur.
- Crash/ANR/system termination.
- Upload/reconnect/large list behavior pada device class lemah.
- Disk full dan cache growth.

Performance recording lane terpisah karena screen recording/profiling memengaruhi hasil. Report menyimpan sample count, duration, environment, instrumentation overhead, baseline dan threshold proyek.

## 22. Fixture dan cleanup mobile

Ledger mencakup server IDs, local queue/entity IDs bila observable, test files di device, app settings yang diubah, notification subscriptions, cloud test objects, dan temporary recording files.

- Setup unique run fixtures.
- Avoid account reuse antar parallel scenarios yang saling mengubah state.
- Record every created ID immediately.
- Cleanup reverse relation dependency.
- Verify backend/local state dan restore device setting.
- Device disconnected: cleanup pending, recovery job keyed ke identity.
- TTL janitor hanya owner objects expired, tidak menghapus data pengguna.
- Gate incomplete/failure sesuai kondisi cleanup dan ledger; tidak menyatakan 0 row tanpa readback.

## 23. Roadmap implementasi mobile

| Fase | Deliverable | Acceptance |
|---|---|---|
| M0 Generic contracts | Project/device/resource/design definitions | Tidak ada package/IP/tab hardcoded |
| M1 Driver/preflight | Capability report dan device leases | Missing tools/device dan signing conflict akurat |
| M2 Step execution | Real step outcomes, waits, semantics, cancellation | Wrong/missing target gagal, skipped bukan pass |
| M3 Evidence | PNG/XML/log/video recorder/timeline | Artifact run lain tidak tertangkap; partial video dilaporkan |
| M4 Inventory | Authenticated screen/control discovery | Nested tabs/dialogs/scroll/role terpetakan |
| M5 Deep CRUD | UI/API/local data observers + lifecycle | Stale update/duplicate/offline corruption tertangkap |
| M6 Adaptive design | Tablet/landscape/font/keyboard/insets | Regression visual/state ditemukan |
| M7 Modules | Permission/media/maps/push/hardware | Real vs simulated vs blocked jelas |
| M8 Reporting | Mobile matrix, visual metrics, JSON/PDF/HTML | Semua finding bisa dibuka screenshot/video-nya |
| M9 Cross-platform | iOS worker/hybrid/custom hooks | Capability claims dibuktikan per platform |
| M10 Conformance | Native + Flutter/RN + hybrid + offline targets | Project baru lewat konfigurasi/module |

Prioritas M0–M3 sebelum memperluas exploration karena report harus dapat dipercaya. M5 dan M6 dibangun berdasarkan contract yang sama; M9 tidak dianggap selesai hanya karena Android lulus.

## 24. Definition of Done mobile

- Inventory semua screen/control/state wajib direkonsiliasi dengan requirement.
- Aksi dan expected outcome tiap control terbukti sesuai profile.
- CRUD meliputi server/local persistence, relation, conflict, rollback, duplicate, offline recovery jika berlaku.
- Permission/lifecycle/device/hardware scenario wajib tercakup.
- Phone/tablet/orientation/font/keyboard matrix punya evidence nyata.
- Design metrics punya source/method/confidence yang jelas.
- Screenshot/video/JSON lengkap, valid, portable, dan step-correlated.
- Tidak ada step fiktif PASS dari exit code keseluruhan.
- Disconnect/cancel menjaga hasil parsial dan cleanup ledger.
- Conformance pada beberapa aplikasi berbeda membuktikan generalisasi.
- Platform/hardware yang belum tersedia tetap muncul sebagai coverage gap; full acceptance menunggu requirement wajib terbukti.

