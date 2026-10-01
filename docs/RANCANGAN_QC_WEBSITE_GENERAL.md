# Rancangan QC Website General

Status: rancangan implementasi lintas proyek, 29 September 2026.

Dokumen ini berlaku untuk website publik, dashboard, SaaS, marketplace, ERP, CMS, portal, aplikasi transaksi, PWA, serta website yang memakai beberapa frontend/backend. Stack framework, nama halaman, role, dan model database berasal dari konfigurasi proyek.

Baca juga [kontrak report/evidence](KONTRAK_QC_GENERAL_REPORT_EVIDENCE.md) dan [rancangan mobile](RANCANGAN_QC_MOBILE_GENERAL.md). Ketiganya membentuk satu paket; detail pengujian website ada di dokumen ini.

## 1. Hasil yang dituju

Untuk setiap proyek, QC menghasilkan:
1. Inventory halaman, component, control, API, resource, role, state, dan business workflow.
2. Matrix requirement → scenario → browser/viewport/role → assertion → evidence.
3. Pengujian fungsi dan CRUD sampai persistence, relasi, transaksi, concurrency, dan recovery.
4. Audit warna, typography, layout, responsive, accessibility, dan visual regression.
5. Screenshot state normal/error/empty/dense, baseline/diff, video flow, JSON terstruktur.
6. Report HTML/PDF yang menampilkan temuan, scope coverage, retest, serta cleanup.

Seluruh fitur/tombol berarti semua item dalam inventory yang direkonsiliasi dengan source, spesifikasi, dan runtime, termasuk fitur role tertentu dan fitur yang tersembunyi di menu/scroll/modal. Coverage 100% harus menyebut inventory revision dan execution matrix yang dicakup.

## 2. Apa yang sudah menjadi fondasi

Pembacaan source menemukan:
- Playwright adapter untuk browser flow, screenshot, trace, video.
- Quality script untuk contrast heuristic, typography, overflow, clipping/overlap, baseline PNG, dense-data stress.
- Discovery feature/business-flow/role/CRUD plan.
- Mutation runner dengan setup scenario dan cleanup steps.
- JSON/PDF report, retention, regression gate.

Rancangan memperluas fondasi tersebut. Contract yang dihasilkan dari discovery belum membuktikan correctness bisnis. Test stress hasil clone DOM belum membuktikan kemampuan backend menangani dataset besar. Semua kemampuan perlu dibuktikan oleh scenario yang sesuai sebelum status verified diberikan.

## 3. Project intake

### 3.1 Input minimum

| Kelompok | Input |
|---|---|
| Target | URL/deployment atau folder/repository+ref |
| Build | commit/build hash, runtime config, build timestamp |
| Services | frontend/backend/DB/cache/queue/media/realtime dependencies |
| Access | anonymous + akun tiap role + tenant fixtures |
| Contract | acceptance criteria, OpenAPI/GraphQL schema bila ada, resource definitions |
| Design | design tokens, CSS/theme, approved screenshots atau referensi desain |
| Data | fixture builders, data observation connector, cleanup adapter |
| Matrix | browsers, viewport, theme, locale, input mode |
| Evidence | screenshot/video policies, storage, retention |
| Domain | module bisnis yang relevan serta expected side effects |

Semua field yang belum tersedia dicatat beserta dampak coverage. Tidak mengisi role atau API path dengan tebakan yang kemudian dianggap kontrak final.

### 3.2 Mode akses

- URL only: runtime discovery, DOM, screenshot, browser network, akun yang disediakan.
- Source + URL: tambahkan route/schema/component mapping dan unreachable feature candidates.
- Managed local: jalankan service scoped proyek dan health check dependency.
- API only: kontrak API/data dapat diuji; UI/design/video UI NOT_APPLICABLE hanya jika proyek memang tidak punya UI.
- Partial access: scenario yang memerlukan observability tambahan BLOCKED, dengan coverage gap.

### 3.3 Template konseptual

~~~yaml
configVersion: qc-project/next
projectId: example-project
platform: web
target:
  baseUrlRef: env:QC_TARGET_URL
  sourceRef: configured-repository-ref
actors:
  - id: editor
    credentialRef: secrets:editor-test
  - id: viewer
    credentialRef: secrets:viewer-test
resources: resource-contract.json
design:
  tokenSource: design-tokens.json
  baselinePolicy: required
matrix:
  browsers: [chromium, firefox, webkit]
  viewportProfiles: [compact, tablet, desktop]
suite: full-documentation
evidence:
  screenshots: key-states-and-failures
  video: each-ui-scenario
  json: complete
~~~

Ini rancangan format berikutnya. Loader saat ini belum mendukung field tersebut.

## 4. Discovery sampai inventory lengkap

### 4.1 Sumber discovery

- Source: route, nested layout, API clients, component definitions, schema/form validation, feature flags, authorization guards.
- Runtime: rendered DOM dan accessibility tree, link/menu, dialog, table actions, uploads/downloads, keyboard controls.
- Authenticated crawl: satu isolated browser context per actor/tenant.
- Specification: fitur yang diwajibkan meskipun route belum ditemukan.
- Manual annotation: canvas, iframe khusus, third-party widget, or hidden workflow.

### 4.2 Screen identity

Screen identity = route template + role + feature flags + business state + meaningful query variant.

Pagination nomor berbeda tidak selalu menjadi screen baru; tetap menjadi execution cell. Detail entity memakai route template dengan fixture ID. Modal/tab yang punya aksi berbeda memiliki sub-screen ID.

### 4.3 Control inventory

Field wajib:
- controlId, screenId, componentId;
- semantic role, accessible name, locator candidates, selector confidence;
- action types, prerequisites, supported input modes;
- visible/enabled/disabled/loading/selected/error states;
- expected route/API/data transition;
- resource/requirement IDs;
- status discovered, contracted, executed, verified;
- risk level dan evidence references.

List controls juga memeriksa instance pertama/tengah/akhir, item disabled, item di luar viewport, dan item milik tenant lain.

### 4.4 Crawl termination dan missing coverage

Crawler berhenti pada budget route/action/time yang dikonfigurasi, dengan frontier yang belum dikunjungi disimpan. Infinite pagination, kalender, timestamp URL, dan ID acak dinormalisasi.

Saturation crawling tidak boleh diklaim sebagai bukti seluruh bisnis teruji. Reconcile inventory dengan spesifikasi/source dan tampilkan unmatched requirements/routes/controls.

## 5. Engine execution

Urutan:
1. Resolve effective config, contract revision, build dan dependencies.
2. Health check HTTP + dependency yang dibutuhkan scenario.
3. Lease environment/fixture, buat actor contexts.
4. Resolve preconditions tanpa mengandalkan state scenario sebelumnya.
5. Start video/trace dan snapshot awal.
6. Execute action; tunggu kondisi nyata dengan bounded timeout.
7. Assert UI, API, data, side effect yang relevan.
8. Capture state screenshots/design metrics.
9. Finalize video/trace.
10. Cleanup serta verify ownership.
11. Validate report/evidence references dan hitung gate.

Kegagalan action menghentikan dependent steps; independent scenarios masih dapat berjalan. Retry step mutation tidak dilakukan sebelum state server diperiksa untuk menghindari duplicate.

Native browser actionability checks dipertahankan. Forced clicks hanya ada pada scenario khusus dan dicatat; overlay yang memblokir action bukan diakali agar flow terlihat pass.

## 6. Cakupan interaction dan navigation

| Jenis | Scenario yang wajib | Expected |
|---|---|---|
| Button/link | visible, disabled, loading, rapid click, Enter/Space sesuai semantics | Action benar, side effect sesuai jumlah |
| Navigation | menu, breadcrumb, deep link, refresh, back/forward | Route dan selected nav konsisten |
| Browser tab/window | new tab, popup blocked, return to origin | Destination, window ownership, session benar |
| Application tabs | click, keyboard, deep link/query, switch during loading | Panel/aria/selected state dan data benar |
| Modal/drawer | open, submit, close, cancel, outside click, Escape | Focus dan unsaved behavior sesuai kontrak |
| Dropdown/select | keyboard, long labels, no result, remote options | Value/label/payload sesuai |
| Checkbox/radio/switch | toggle, disabled, group constraints | UI dan stored boolean/enum konsisten |
| Table | sort/filter/page/select rows/actions | Dataset dan count benar |
| Tree/accordion | expand/collapse, lazy child, keyboard | Hierarchy dan focus benar |
| Drag/drop | source/target, invalid destination, cancel | Urutan/ownership tersimpan |
| File input | picker/cancel/reselect/remove/retry | File lifecycle benar |
| Rich editor | paste, formatting, autosave, undo/redo | Saved content, encoding, sanitization |
| Calendar | timezone, locale, unavailable slot, range | Valid interval dan conflict handling |
| Charts | legend/filter/tooltip/export/data absent | Angka/source consistency |
| Canvas/maps | zoom/pan/marker/selection | Test hook or visual/manual evidence sesuai |

Tidak setiap control memiliki CRUD; link navigasi diuji navigation oracle, pembayaran memakai transaction oracle, editor memakai document oracle.

## 7. Autentikasi, role, tenant, session

- Login valid/invalid, empty credential, locked/deactivated account jika didukung.
- MFA/OTP expiry/resend/reuse dan cancel dengan test identity provider.
- SSO redirect/callback/logout jika integration tersedia.
- Logout satu tab dan akses protected dari tab lain.
- Session expiry saat form belum disimpan; re-auth dan recovery.
- Refresh token single-flight ketika beberapa request gagal bersamaan.
- Anonymous/viewer/editor/admin/owner dan role domain sesuai proyek.
- Hidden control tidak cukup: direct API/deep URL tetap ditolak.
- Cross-tenant list/detail/update/delete/export/resource download.
- Ownership berubah ketika session aktif; cache tidak mempertahankan akses lama.
- Status 401/403 dan UI response dibanding kontrak, bukan hardcoded untuk semua proyek.
- Audit perubahan role, invitation expiry, revoke jika tersedia.

Evidence: role/tenant context, sanitized request, server response, UI state, data tidak berubah pada denial.

## 8. Deep CRUD: kontrak resource

Setiap resource memiliki:
- primary key, unique keys, natural keys, field schema, defaults, server-managed fields;
- required/nullable/read-only/derived fields;
- enums, decimal precision, timezone/locale rules;
- one-to-many/many-to-many relations dan ownership;
- create/read/update/delete/restore/bulk support;
- lifecycle state machine dan forbidden transitions;
- validation dan error schema;
- soft delete/cascade/restrict policy;
- transaction boundary, eventual consistency deadline;
- cache/search/index/file/event side effects;
- idempotency, version/ETag/concurrency contract;
- observers UI/API/DB/event dan cleanup procedure.

Field yang tidak tersedia dalam kontrak menjadi unresolved requirement. Tidak menebak bahwa delete harus cascade atau soft-delete.

## 9. Deep CRUD: katalog pengujian

### 9.1 Create

1. Minimum required fields → defaults server terbentuk.
2. Semua fields valid → semua nilai dipersist.
3. Missing required, null, empty string, whitespace-only → validation field spesifik.
4. Minimum-1/minimum/maximum/maximum+1 pada panjang/range.
5. Unicode, emoji, multi-line, localized digits, reserved characters sesuai domain.
6. Duplicate exact dan canonical equivalent setelah trim/case normalization.
7. Nilai read-only/server-managed yang diinjeksi → ditolak/diabaikan sesuai kontrak.
8. Parent valid/archived/deleted/foreign tenant.
9. Dua submit cepat dan request replay.
10. Timeout setelah server commit → readback sebelum retry; tidak duplicate.
11. Gagal save child/attachment → atomic rollback atau partial state yang dikontrakkan.
12. Concurrent create dengan unique key sama → jumlah record valid tepat satu.
13. Audit, event, notifications, file storage terhubung ke entity yang tepat.
14. Reload/fresh session menunjukkan record yang sama, bukan hanya optimistic UI.

### 9.2 Read

- List, detail, direct ID, foreign ID, deleted ID, missing ID.
- Sort stable: tie-breaker untuk nilai sama.
- Filter kombinasi, reset, saved filter, timezone/date boundaries.
- Search exact/partial/case/whitespace/special characters.
- Pagination awal/tengah/akhir/out-of-range, page size, load-more.
- Dataset berubah selama pagination: behavior berdasarkan cursor/offset contract.
- Virtualized rows bukan dianggap missing hanya karena belum dirender.
- Aggregates/count/export harus memakai query dan permission scope yang sama.
- Cache stale/refresh/new session, relation detail, field redaction per role.

### 9.3 Update

- Satu field dan banyak field, tidak sengaja mengubah field yang tidak disentuh.
- PATCH partial vs PUT replacement sesuai API contract.
- Null versus omitted, false versus missing, zero versus empty.
- Edit relation, reorder nested children, add/remove attachment.
- Invalid update tidak mengubah persisted state.
- Concurrent editor A/B: conflict terdeteksi atau last-write-wins sesuai requirement.
- Submit dari stale UI setelah entity dihapus/diarsip.
- Optimistic UI rollback saat response gagal.
- Autosave/debounce dan out-of-order response.
- Unsaved navigation, cancel, reload, back, route change.
- Version/audit updated dan side effects sekali saja.

### 9.4 Delete/restore

- Cancel confirmation tidak mutasi.
- Delete satu record yang benar; record pembanding tetap utuh.
- Delete parent yang masih dipakai: restrict/cascade sesuai kontrak.
- Soft-delete tidak muncul pada default list; trash/history sesuai role.
- Restore mengembalikan relation dan memeriksa unique conflict.
- Delete yang sudah terhapus bersifat idempotent atau error sesuai kontrak.
- Race update/delete: tidak menghasilkan orphan.
- Bulk delete berisi success/denied/not-found: hasil per item jelas.
- File/cache/search/event state sesuai kebijakan retention bisnis.
- Undo window diuji batas waktunya jika tersedia.

### 9.5 Bulk/import/export

- Batch kosong/satu/batas/batas+1.
- Duplicate dalam file dan terhadap existing data.
- Invalid MIME, format, encoding, missing column, formula-like content.
- Partial success vs atomic batch sesuai kontrak.
- Row-level error download memetakan baris sumber secara benar.
- Cancel/retry/resume tanpa double insert.
- Export filtered/permission-scoped, header, escaping, total, timezone, decimal.
- Async export job: queued/running/completed/failed/expired; download authorization.

## 10. Contoh test mendalam yang reusable

Resource contoh netral: record dengan unique code, parentId, amount, version.

| Langkah | Verifikasi |
|---|---|
| Buat parent dan dua tenant fixture | Ledger menyimpan IDs dan ownership |
| UI create child dengan code run unik | Submit visible dan loading |
| Capture response | Schema/ID cocok, request bukan sekadar aborted probe |
| Fresh GET detail + list | Exact fields/defaults/count delta benar |
| Reload UI | Data bertahan |
| Duplicate code di UI/API | Rejection; count tidak bertambah |
| Editor A dan B baca version sama | Before snapshots identik |
| A save; B save stale version | Konflik/merge sesuai contract, tidak diam-diam korup |
| Tenant B request detail/update | Denied dan data tetap |
| Delete parent in-use | Restrict/cascade sesuai configured invariant |
| Delete/restore child | List/detail/relations/status benar |
| Cleanup owned objects | Observers memastikan 0 object milik run tersisa |

Pack ini diparameterisasi menurut resource schema; nama path/field/role tidak tertanam di engine.

## 11. Domain workflow dan transaksi

| Domain | Pengujian lebih dari CRUD |
|---|---|
| Commerce | price recalculation, tax/discount, stock reservation, payment success/fail/timeout, refund |
| Booking | overlapping slots, last capacity, timezone rollover, cancellation restore |
| ERP/CRM | approval chain, segregation of duties, master-detail reconciliation |
| CMS | draft, preview, publish, schedule, unpublish, revision restore |
| Finance | precision/rounding, balanced entries, duplicate transaction, reversal |
| Education | enrolment constraints, grading rights, publish results, locked period |
| Collaboration | ordering, concurrent edits, unread/read, revocation |
| AI/streaming | partial tokens, cancel, retry, schema output, stable evaluation assertions |

Graph state disimpan di contract. Uji setiap edge wajib dan illegal transition. Mock payment/webhook hanya membuktikan integration terhadap mock; real sandbox memiliki matrix terpisah.

## 12. API, network, async, concurrency

- REST/GraphQL response schema, business errors, pagination metadata.
- Correlation request/response/step; GraphQL HTTP 200 dengan errors harus diperiksa.
- Timeout, offline, disconnect saat upload, 429/retry-after, dependency 5xx.
- Response lama tiba sesudah response baru: UI tidak kembali ke state stale.
- Polling/realtime SSE/WebSocket connect, disconnect, replay, duplicate event, ordering.
- Bounded eventual consistency: deadline dan final observed state dicatat.
- Concurrency memakai barrier agar request benar-benar overlap; dua klik berurutan tidak membuktikan race.
- UI load/performance audit terpisah dari server load test.
- Simulated network failure diberi dependencyMode MOCK atau injected fault.
- Service worker/cache membuat network interception berbeda: capture actual path dan cache origin.

## 13. Warna dan design system

### 13.1 Sumber desain

Prioritas:
1. Tokens/component specification yang disepakati.
2. Approved visual baseline.
3. Consistency heuristic dari komponen sejenis.
4. Manual review untuk estetika dan keputusan UX.

Tanpa token/desain, QC masih dapat mengukur contrast dan inconsistency; kesesuaian brand dicatat NEEDS_REVIEW pada design review, bukan ditebak.

### 13.2 Matrix warna

Uji foreground/background/border/icon untuk normal, hover, focus, active, selected, disabled, loading, error, success, warning; light/dark/high-contrast bila didukung.

Report berisi:
- selector/component/state;
- token expected dan actual computed RGBA;
- resolved background termasuk ancestor/alpha;
- contrast method/ratio;
- screenshot crop dan annotated bounds;
- expected source, outcome, confidence.

Gradients/images/transparency/antialiasing memerlukan sampling visual dan kadang review; computed CSS tunggal tidak selalu cukup.

### 13.3 Typography dan layout

| Area | Check |
|---|---|
| Typography | family loaded, fallback, weight, size, line-height, letter-spacing, hierarchy |
| Text | line clamp intended, wrapping, truncation, missing glyph, bidi/RTL |
| Spacing | token gap/padding/margin, vertical rhythm, section density |
| Alignment | grid edge, input/label alignment, baseline alignment |
| Geometry | width/height, min/max, radius, border, shadow |
| Layers | z-index, overlay, sticky/fixed, focus visibility |
| Media | ratio, crop, placeholder, broken image, alt/context |
| Motion | transition correctness, reduced-motion behavior, interactive during animation |

Heuristic overlap perlu mengecualikan intentional badge/overlay. Horizontal table scroller sah jika seluruh halaman tidak overflow dan controls dapat dijangkau.

## 14. Responsive, tablet, browser, zoom

### 14.1 Matrix awal yang dapat disesuaikan

Ukuran berikut dalam CSS px, merupakan usulan test profile:
- compact: 320×740, 360×800, 390×844;
- tablet portrait: 768×1024, 820×1180;
- tablet landscape: 1024×768, 1180×820;
- desktop: 1280×720, 1440×900, 1920×1080;
- ultrawide: opsional bila target layout mendukung;
- setiap breakpoint aktual B: B-1, B, B+1;
- zoom 100/200%, serta reflow check ekuivalen 400% pada viewport yang sesuai;
- DPR 1/2; touch vs mouse; keyboard-only;
- light/dark, locale panjang, RTL bila didukung.

Full visual sweep di browser utama; cross-browser matrix wajib untuk critical features dan layout rentan. Pairwise boleh mengurangi kombinasi sekunder, tetapi omitted combinations tetap dicatat.

Chromium/Firefox/WebKit testing tidak identik dengan seluruh branded browser/device fisik. Matrix real device tetap diperlukan untuk perilaku browser mobile yang menjadi requirement.

### 14.2 Responsive assertions

- Sidebar berubah menjadi drawer sesuai breakpoint; selected item dipertahankan.
- Grid column/card tidak memotong content.
- Dialog tidak melewati viewport; body dan dialog scroll tidak terkunci salah.
- Table punya responsive strategy: scroll/card/column priority sesuai desain.
- Sticky header/footer tidak menutup CTA/error/focus.
- Keyboard virtual, dropdown, date picker, upload picker tidak merusak form.
- Orientation change mempertahankan state.
- Navigation/tab labels dapat dijangkau dengan scroll atau overflow menu.
- Empty/error/loading/dense states diuji di tablet juga.
- Screenshot full-page dan viewport disimpan terpisah; full-page tidak membuktikan sticky layout.

## 15. Accessibility dan kualitas bahasa

- Accessible name, form label, error association, heading order, landmark.
- Keyboard order, focus trap, focus restore, skip link, focus tidak tertutup.
- Toggle/tab/tree semantics sesuai behavior.
- State tidak disampaikan lewat warna saja.
- Live region untuk loading/result/error bila relevan.
- Contrast teks mengikuti WCAG AA scope yang disepakati.
- Web target-size rule mengikuti WCAG 2.5.8 beserta exceptions; target UX proyek dapat lebih besar.
- Screen reader acceptance manual memiliki task, transcript/note, device/browser, dan reviewer.
- Locale, plural, format angka/mata uang/tanggal, translated error dan RTL.
- Screenshot/OCR atau automated audit tidak dianggap membuktikan seluruh accessibility.

Referensi ambang: [WCAG Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WCAG Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## 16. Performance dan stability

Performance budget didefinisikan per proyek dan class device/network:
- initial load, route transition, data-ready time;
- action-to-feedback, save/readback duration;
- layout shift, long tasks, image/font load;
- cold vs warm cache;
- CPU/memory trend setelah workflow diulang;
- realtime/socket count, duplicate event handlers;
- browser console errors, page crash, failed requests.

Simpan sample count dan distribusi, bukan hanya satu durasi. Video/trace menambah overhead; performance lane memakai konfigurasi terukur sendiri dan tetap punya evidence hasil metrics. Load testing backend membutuhkan scenario/dataset/concurrency budget tersendiri.

## 17. Screenshot, video, JSON website

Mode full-documentation:
- screenshot awal/akhir setiap screen-state penting dan failure;
- viewport + full-page untuk layout; component crop untuk design finding;
- baseline/actual/diff dengan key build-independent yang mencakup browser version family/profile/theme/locale/font config;
- video per scenario UI dari precondition selesai sampai final readback;
- trace action/DOM/network untuk debugging;
- JSON step/assertion/finding plus API/data snapshots.

Playwright video diselesaikan setelah context ditutup; collector menunggu file valid. Trace dapat memuat action snapshots dan network untuk korelasi. [Video](https://playwright.dev/docs/videos), [Trace Viewer](https://playwright.dev/docs/trace-viewer).

Dynamic regions dimask hanya jika disetujui, dengan daftar bounds/reason. Jam/seed/fixture dapat distabilkan; loading/error yang ingin diuji tidak dihilangkan sekadar untuk mendapat screenshot sama.

## 18. Report website yang diharapkan

Report category wajib:
- Function & navigation;
- Deep CRUD & transactions;
- Role/session/tenant;
- Color & typography;
- Layout & responsive;
- Accessibility;
- API/data/recovery;
- Performance;
- Evidence & cleanup.

Satu finding desain menampilkan expected token atau design reference, actual value, swatch, ratio/delta, viewport, state, screenshot before/after, dan video timestamp jika terjadi saat interaction.

Satu finding CRUD menampilkan input, record IDs tersanitasi, expected invariant, response, before/after difference, replay steps, dan cleanup result.

Report mendukung grid viewport: baris screen/state, kolom ukuran/browser. Cell hilang bertuliskan NOT_RUN/BLOCKED, bukan kotak kosong seolah sama.

## 19. Roadmap implementasi website

| Fase | Deliverable | Acceptance |
|---|---|---|
| W0 Contract | Versioned project/resource/design/report contracts | Configuration proyek A/B tanpa hardcoded domain |
| W1 Inventory | Screen/control/state inventory + unresolved frontier | Fixture target dengan menu/role/modal dapat direkonsiliasi |
| W2 Execution | Step-level assertion, async waits, cancellation | No-op button dan skipped step terdeteksi |
| W3 Deep CRUD | Ledger, resource lifecycle, independent read, concurrency | Duplicate, orphan, stale update, bad cleanup tertangkap |
| W4 Design | Token metrics, bounds, baseline diff, state matrix | Known color/layout regressions ditemukan |
| W5 Responsive | Breakpoint/tablet/zoom/browser scheduler | Profile coverage dan omission benar |
| W6 Evidence | Video, trace, screenshot, JSON ownership/timeline | Semua link/file/hash valid setelah run/retry |
| W7 Report | Category views, matrix, retest, exports | Reviewer bisa membuka bukti tiap finding |
| W8 Gate | Coverage/evidence/cleanup-aware gate | Incomplete tidak pernah menjadi full PASS |
| W9 Conformance | Beberapa target stack/domain berbeda | Port ke proyek baru lewat config/module |

Prioritas pertama W0–W3 karena status dan oracle yang benar menentukan keandalan laporan; recording dan report dapat dibangun paralel setelah kontrak disepakati.

## 20. Definition of Done website

- Semua requirement/control-state wajib di inventory memiliki scenario dan outcome.
- CRUD tidak berhenti di click/toast: persistence, relation, denial, rollback, concurrency terbukti sesuai resource.
- Semua profile wajib termasuk tablet, landscape, breakpoint, dan state error/dense memiliki evidence.
- Warna/layout diperiksa terhadap sumber expected yang jelas; heuristic dilabeli.
- Screenshot/video/JSON lengkap, usable, tersanitasi, dan terhubung ke step.
- Full gate tidak melewatkan blocked critical dependency atau missing artifact.
- Cleanup verified, retry history utuh, retest memakai build/run baru.
- Core engine tidak mengandung selector/nama/domain proyek tertentu.
- Conformance engine dan beberapa proyek berbeda memenuhi acceptance, lalu scope per proyek dinyatakan secara eksplisit.

