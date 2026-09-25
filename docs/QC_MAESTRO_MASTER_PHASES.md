# QC Maestro - Master Phase Plan

Dokumen ini menjadi roadmap utama untuk membangun pengujian website yang mendekati proses QC manual manusia. Setiap phase memiliki tujuan, cakupan, output, dan exit criteria yang dapat diverifikasi.

Prinsip utama:

- Discovery hanya membuat hipotesis; hasil dianggap teruji setelah ada execution evidence.
- Setiap fitur harus memiliki happy path, negative path, boundary path, permission path, recovery path, dan data-integrity path.
- Mutation hanya boleh berjalan pada environment fixture/test yang dapat di-reset.
- Setiap finding harus memiliki route, role, browser, viewport, step, evidence, diagnosis, dan status retest.
- Target source tetap read-only; QC Maestro tidak memperbaiki aplikasi target secara otomatis.

## Phase 0 - Foundation, safety, dan runtime

Status: **DONE / HARDENING**

Cakupan:

- job lifecycle, workspace, artifact root, log, secret redaction;
- local service startup dan health check;
- konfigurasi target, akun, browser, viewport, database, dan fixture;
- isolation antara project, job, run, dan artifact;
- timeout, cancellation, retry, dan cleanup;
- mutation safety gate dan allow-list environment.

Output:

- reproducible audit run;
- sanitized log;
- artifact manifest;
- safe cleanup report.

Exit criteria:

- run yang dihentikan tidak meninggalkan process orphan;
- credential tidak muncul di log/evidence;
- mutation tidak berjalan tanpa fixture dan explicit allow flag.

## Phase 1 - Source discovery dan UI inventory

Status: **DONE / HARDENING**

Cakupan:

- route, page, API, method, form, table, link, button, modal, upload, download;
- authentication state dan candidate route;
- source evidence, selector evidence, screenshot, dan confidence;
- crawl public serta authenticated route.

Output:

- inventory halaman/API;
- route coverage;
- blocked/error route list;
- capability profile.

Exit criteria:

- setiap route memiliki status observed, candidate, blocked, atau error;
- setiap capability memiliki evidence dan confidence;
- limitation discovery dicatat di report.

## Phase 2 - Feature model dan test contract

Status: **NEXT PRIORITY**

Cakupan:

- canonical feature definition;
- precondition, actor, input, expected UI result, expected API result, expected data result;
- happy, negative, boundary, permission, recovery, refresh/back-navigation path;
- acceptance criteria per feature;
- mapping feature ke route, API, role, fixture, dan evidence.

Output:

- `feature-contract.json`;
- feature checklist di Test Design;
- coverage matrix feature versus test scenario;
- unresolved assumption list.

Exit criteria:

- tidak ada fitur terdeteksi yang hanya memiliki route tanpa expected result;
- contract dapat menghasilkan flow dan report check;
- fitur tanpa contract diberi status `REQUIRES_REVIEW`, bukan dianggap lulus.

## Phase 3 - Authentication, authorization, dan session security

Status: **PARTIAL**

Cakupan:

- login valid/invalid;
- logout, session expiry, refresh, back button;
- role matrix dan direct URL access;
- hidden versus disabled action;
- API authorization;
- privilege escalation;
- tenant/data isolation;
- unauthorized redirect dan forbidden response.

Output:

- runtime role-action results;
- authorization evidence;
- session transition report;
- access-control findings.

Exit criteria:

- setiap role diuji pada route dan action yang relevan;
- route/API yang seharusnya ditolak benar-benar ditolak;
- tidak ada cross-role atau cross-tenant data leakage.

## Phase 4 - Basic functional flow dan navigation

Status: **PARTIAL**

Cakupan:

- click, input, select, checkbox, radio, link, tab, accordion;
- redirect dan URL state;
- browser back/forward/refresh;
- form submission dan success notification;
- modal, drawer, dropdown, wizard;
- deep link dan reload pada state tertentu.

Output:

- executable functional flows;
- step-level assertion;
- screenshot/video/trace per flow;
- failed-step diagnosis.

Exit criteria:

- flow tidak hanya memeriksa element visible;
- setiap step memiliki assertion yang dapat membedakan pass dan false positive;
- failure dapat direproduksi dari flow artifact.

## Phase 5 - CRUD dan data lifecycle

Status: **IN PROGRESS**

Cakupan:

- list, detail, create, update, delete;
- duplicate record;
- delete record yang masih digunakan;
- unique constraint;
- required field dan default value;
- optimistic update dan rollback;
- refresh/list consistency;
- cleanup dan reset fixture.

Output:

- CRUD plan;
- mutation fixture contract;
- mutation runner;
- data before/after snapshot;
- cleanup verification;
- CRUD report summary.

Exit criteria:

- seluruh resource terdeteksi memiliki status operation;
- mutation scenario memakai unique fixture data;
- test gagal bila cleanup gagal;
- UI, API, dan data state saling konsisten.

## Phase 6 - Form validation dan boundary testing

Status: **PARTIAL**

Cakupan:

- empty submit;
- required field;
- format email, phone, URL, date, number;
- minimum/maximum length dan range;
- unicode, whitespace, special character;
- duplicate value;
- invalid file;
- server-side validation;
- error placement dan message clarity.

Output:

- boundary matrix;
- validation evidence;
- per-field result;
- client/server validation mismatch finding.

Exit criteria:

- field yang wajib memiliki test valid dan invalid;
- error tidak hilang setelah rerender;
- nilai invalid tidak menulis data ke target.

## Phase 7 - Search, filter, sort, pagination, dan dense data

Status: **PARTIAL**

Cakupan:

- search exact, partial, case, whitespace;
- multiple filter combination;
- clear/reset filter;
- ascending/descending sort;
- first, middle, last, dan out-of-range page;
- page size;
- load more/infinite scroll;
- empty result;
- long text dan large dataset;
- export mengikuti query aktif.

Output:

- query-state flow;
- dataset fixture;
- result consistency report;
- dense-data screenshots.

Exit criteria:

- URL/API/UI query state konsisten;
- tidak ada stale result setelah filter berubah;
- pagination tidak menggandakan atau melewatkan record.

## Phase 8 - Interactive state dan resilience

Status: **PARTIAL / NEXT**

Cakupan:

- hover, focus, active, disabled;
- loading dan skeleton;
- empty, success, warning, error;
- retry dan recovery;
- network timeout/offline;
- modal focus trap dan escape;
- tooltip/dropdown outside click;
- duplicate click dan request race;
- optimistic update failure.

Output:

- actual state execution, bukan hanya CSS heuristic;
- state screenshots;
- network interception evidence;
- recovery assertion.

Exit criteria:

- state dipicu melalui aksi atau network condition nyata;
- user selalu mendapat feedback yang dapat dipahami;
- retry tidak membuat duplicate data.

## Phase 9 - File upload, download, import, dan export

Status: **PLANNED**

Cakupan:

- valid file;
- extension/MIME mismatch;
- zero-byte dan corrupt file;
- maximum size;
- progress, cancel, retry;
- server rejection;
- download filename dan MIME;
- export empty state;
- permission protection;
- isi file dan encoding.

Output:

- file fixture catalog;
- upload/download execution evidence;
- content verification report.

Exit criteria:

- file invalid tidak tersimpan;
- file valid dapat diproses dan diverifikasi;
- download terlindungi oleh authorization.

## Phase 10 - Domain transaction dan workflow state

Status: **PLANNED**

Cakupan:

- checkout/order/booking;
- payment success, failure, timeout, expiry, refund;
- approval/rejection;
- cancellation;
- seat/capacity/inventory restore;
- notification dan deep link;
- invoice/ticket/report generation;
- webhook/callback fixture.

Output:

- domain fixture contract;
- state transition graph;
- transaction evidence;
- rollback and compensation report.

Exit criteria:

- transition ilegal ditolak;
- setiap transition memperbarui UI/API/data secara konsisten;
- failure tidak meninggalkan partial transaction.

## Phase 11 - API, network, concurrency, dan data integrity

Status: **PLANNED**

Cakupan:

- status code;
- response schema;
- request payload;
- console error;
- failed dependency;
- retry policy;
- idempotency;
- concurrent update;
- stale response;
- duplicate request;
- referential integrity;
- transaction rollback.

Output:

- sanitized request/response evidence;
- API contract result;
- concurrency report;
- integrity snapshot.

Exit criteria:

- expected error response terpetakan ke UI state;
- duplicate request tidak menggandakan data;
- concurrent update memiliki conflict/retry behavior yang jelas.

## Phase 12 - Accessibility, responsive, visual, dan device quality

Status: **PARTIAL / BANYAK SUDAH ADA**

Cakupan:

- semantic accessibility;
- keyboard traversal;
- actual screen reader NVDA/VoiceOver/TalkBack;
- contrast;
- typography dan target size;
- desktop/tablet/mobile;
- orientation dan viewport ekstrem;
- visual baseline pixel diff;
- modal, table, form, chart, dan long-content overflow.

Output:

- WCAG evidence;
- screen reader transcript;
- baseline/diff image;
- responsive matrix.

Exit criteria:

- baseline required dipakai pada regression run;
- screen reader adapter menghasilkan evidence atau limitation eksplisit;
- semua critical viewport memiliki screenshot dan result.

## Phase 13 - Evidence, findings, retest, dan triage

Status: **PARTIAL**

Cakupan:

- screenshot, video, trace, console, network, DOM snapshot;
- severity, priority, reproducibility;
- finding ownership dan note;
- Open -> In Progress -> Ready for Retest -> Passed;
- before/after evidence;
- retest hanya boleh pass jika evidence baru mendukung;
- duplicate finding dan flaky finding.

Output:

- evidence inspector;
- finding detail;
- retest comparison;
- triage summary.

Exit criteria:

- setiap finding dapat direproduksi;
- retest memiliki run ID baru;
- status Passed tidak dapat ditetapkan tanpa evidence retest.

## Phase 14 - Reporting, history, trend, dan quality gate

Status: **PARTIAL / BANYAK SUDAH ADA**

Cakupan:

- JSON, HTML, PDF;
- coverage per route, feature, role, browser, viewport;
- pass/fail/not-applicable/limitation;
- finding trend;
- new, fixed, regressed, flaky;
- quality budget;
- baseline policy;
- artifact retention dan cleanup;
- CI adapter untuk repository target.

Output:

- final report;
- trend dashboard;
- regression gate;
- retention manifest;
- CI integration guide.

Exit criteria:

- quality gate gagal ketika budget dilampaui;
- report membedakan belum diuji dengan lulus;
- artifact lama dibersihkan berdasarkan policy tanpa menghapus run aktif.

## Phase 15 - Exploratory QC manual-assisted

Status: **PLANNED**

Cakupan checklist per fitur:

- happy path;
- alternate path;
- negative path;
- boundary path;
- permission path;
- recovery path;
- refresh/back/forward;
- mobile interaction;
- data consistency;
- visual polish;
- copy dan usability;
- exploratory note dari tester.

Output:

- feature checklist UI;
- manual observation notes;
- attach evidence ke step;
- risk-based coverage score.

Exit criteria:

- tester dapat menandai pass/fail/blocked/not-applicable per check;
- manual note masuk ke report;
- fitur berisiko tinggi tidak dapat ditutup tanpa checklist lengkap.

## Urutan eksekusi yang disarankan

1. Phase 2 - Feature test contract.
2. Phase 3 - Runtime authorization.
3. Phase 5 - CRUD dan data lifecycle.
4. Phase 6 - Validation boundary matrix.
5. Phase 7 - Search/filter/pagination.
6. Phase 8 - Actual interactive state dan resilience.
7. Phase 9 - Upload/download.
8. Phase 10 - Domain transaction.
9. Phase 11 - API/concurrency/data integrity.
10. Phase 13 - Evidence dan retest penuh.
11. Phase 14 - Trend, retention, dan CI adapter.
12. Phase 15 - Exploratory checklist manual-assisted.

## Definition of Done keseluruhan

QC Maestro dianggap lengkap untuk satu project jika:

- seluruh route dan capability memiliki coverage status;
- setiap fitur memiliki test contract;
- setiap role diuji pada action yang relevan;
- CRUD dan domain mutation memakai fixture yang dapat di-reset;
- happy, negative, boundary, permission, recovery, dan integrity path sudah dijalankan atau diberi limitation;
- evidence tersedia untuk setiap failure dan retest;
- report mencantumkan coverage, finding, limitation, dan trend;
- quality gate dapat menggagalkan run yang melampaui budget;
- tidak ada status `PASSED` yang hanya berasal dari route discovery atau elemen terlihat.
