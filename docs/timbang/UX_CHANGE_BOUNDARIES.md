# TIMBANG — UX CHANGE BOUNDARIES & INVARIANTS REGISTER

> **Purpose:** Immutable behavioral specification and contract for UX/UI designers, frontend engineers, and AI code generation tools (e.g., Figma Make, Cursor, Claude).  
> **Rule:** Aesthetic and ergonomic modifications are permitted **only** within Conditionally Modifiable boundaries. Protected and Restricted behaviors must be preserved exactly.

---

## 1. INVARIANTS REGISTER

### INV-001: Token-based Admin Authorization Gate
- **Description:** All non-public `/api/*` endpoints and dashboard views must enforce valid HMAC-SHA256 token verification when `QC_ADMIN_ENABLED !== 'false'`. An invalid or absent token must return HTTP 401 with code `AUTH_REQUIRED` and trigger client redirection to the login view.
- **Evidence:** `apps/api/src/auth.ts:14-74`, `apps/api/src/server.ts:115-157`, `apps/web/src/api.ts:34-39`, `apps/web/src/login.tsx:1-160`.
- **Dependencies:** Bearer token extraction in Fastify hook, `qc_admin_token` in browser `localStorage`, `qc:unauthorized` window event listener.
- **Confidence:** **VERIFIED**
- **Verification Method:** Request `/api/v1/projects` without Authorization header; verify HTTP 401 response and client login modal prompt.

---

### INV-002: Secret and Credential Redaction in State & Logs
- **Description:** Sensitive credentials, passwords, tokens, API keys, and authorization headers must never be written in plain text to `.qc-artifacts/qc-state.json`, terminal log feeds, report documents, or error responses. They must be masked as `[REDACTED]`.
- **Evidence:** `apps/api/src/server.ts:821-828` (`scrubPersistedText`), `apps/api/src/discovery/ui-crawler.ts:122-126` (`scrubText`).
- **Dependencies:** Regex redaction in persistence queues and crawler log dispatchers.
- **Confidence:** **VERIFIED**
- **Verification Method:** Inspect `.qc-artifacts/qc-state.json` and terminal log outputs after executing a flow with password input; verify absence of plain-text secrets.

---

### INV-003: Read-Only Audit & Non-Destructive Crawler Safety Guard
- **Description:** Dynamic discovery crawling must never trigger destructive or state-mutating actions on target applications. Links, buttons, and form actions containing keywords such as `delete`, `destroy`, `logout`, `signout`, `deactivate`, `drop`, `truncate`, `reset`, `pay`, or `checkout` must be skipped.
- **Evidence:** `apps/api/src/discovery/ui-crawler.ts:12` (`dangerous` regex), `docs/QUALITY_AUDIT_RULES.md:3`.
- **Dependencies:** Pre-click / pre-navigation route evaluation in `crawlUI`.
- **Confidence:** **VERIFIED**
- **Verification Method:** Run discovery crawl on an application with a `/logout` link and delete buttons; verify neither is invoked and the crawler stays authenticated.

---

### INV-004: Canonical QC Flow Schema Invariants
- **Description:** The QC Flow schema must remain platform-agnostic and comply with the canonical Zod schema. Specifically: `open` requires `url`; `click`, `input`, `clear`, `assertVisible`, `assertNotVisible`, `assertText` require `target`; Android targets strictly prohibit `open` (must use `launchApp`); web targets prohibit `accessibilityId`.
- **Evidence:** `packages/flow-schema/src/index.ts:91-106`.
- **Dependencies:** Flow validator, Playwright compiler, Maestro compiler.
- **Confidence:** **VERIFIED**
- **Verification Method:** Execute `packages/flow-schema/src/cli.ts` against invalid flow samples; verify Zod schema rejection.

---

### INV-005: Human Review Gate for Business Flows
- **Description:** When `config.businessFlowReview.mode === 'required'`, the discovery pipeline must enter `status: 'WAITING_REVIEW'` and halt automated test execution until a human reviewer explicitly approves the generated business flow map.
- **Evidence:** `apps/api/src/discovery/discovery-service.ts:178-200`, `apps/web/src/main.tsx:806-816`.
- **Dependencies:** `businessFlowWaiters` Promise in DiscoveryService, approval endpoints (`/business-flows/approve`).
- **Confidence:** **VERIFIED**
- **Verification Method:** Create a new job with `businessFlowReview.mode = 'required'`; verify runner halts at `WAITING_REVIEW` until `approveBusinessFlows` is called.

---

### INV-006: Artifact Path Containment & Directory Traversal Protection
- **Description:** All artifact streaming and evidence retrieval endpoints must normalize requested paths and verify that the target file resides strictly within the designated job directory or artifact root. Any path containing `..` escaping the root must return HTTP 403 Access Denied.
- **Evidence:** `apps/api/src/server.ts:1918-1920`, `apps/api/src/server.ts:1973-1974`.
- **Dependencies:** Node.js `path.resolve` and `path.relative` prefix boundary checks.
- **Confidence:** **VERIFIED**
- **Verification Method:** Send GET request to `/api/v1/discovery/jobs/:id/artifacts/../../etc/passwd`; verify HTTP 403 rejection.

---

### INV-007: Retention Policy and Project Concurrency Bounds
- **Description:** Repository clones must be retained for at most 7 days (`QC_CLONE_RETENTION_DAYS`), test artifacts for at most 30 days (`QC_ARTIFACT_RETENTION_DAYS`), and active running projects must be clamped between 1 and 2 (`QC_MAX_ACTIVE_PROJECTS=2`).
- **Evidence:** `apps/api/src/runtime-policy.ts:17-25, 47-58`, `infrastructure/postgres/001_multi_user_report_store.sql:75-77`.
- **Dependencies:** Scheduled retention timer in Fastify server (`apps/api/src/server.ts:2081-2085`).
- **Confidence:** **VERIFIED**
- **Verification Method:** Run `cleanupRetention` with artificial past timestamps; verify expired directories are removed while active ones remain.

---

### INV-008: HTTP 206 Partial Content Video Streaming Contract
- **Description:** Artifact video files (`.webm`, `.mp4`) must be served with full support for HTTP `Range` request headers, returning HTTP `206 Partial Content` with `Content-Range`, `Accept-Ranges: bytes`, and appropriate MIME types. Video files smaller than 8 KB must be suppressed to avoid HTML5 player decode failure.
- **Evidence:** `apps/api/src/server.ts:316-318`, `apps/api/src/server.ts:1873-1899`.
- **Dependencies:** Node.js `createReadStream` with `{ start, end }`.
- **Confidence:** **VERIFIED**
- **Verification Method:** Send curl request with `Range: bytes=0-1024` for `/artifacts/full-flow.webm`; verify HTTP 206 and `Content-Range` header.

---

### INV-009: Tri-Mode Target Intake & Probe Reachability Contract
- **Description:** Target intake must support three distinct source types: `existing-target`, `local-folder`, and `github`. Real-time reachability must be verified via `POST /api/v1/system/probe-target` before initializing discovery.
- **Evidence:** `apps/web/src/wizard.tsx:750-850`, `apps/api/src/server.ts:1239-1296`, `apps/api/src/discovery/discovery-service.ts:1508-1525`.
- **Dependencies:** Probe controller, local folder existence check, GitHub shallow clone handler.
- **Confidence:** **VERIFIED**
- **Verification Method:** Test Wizard Step 0 with valid and invalid URLs; verify response time measurement and error handling.

---

### INV-010: Defect Severity & Category Mapping Contract
- **Description:** All defect findings generated by the Quality Audit engine must be mapped into exactly 6 engineering categories: `critical`, `functional`, `content`, `visual`, `contrast`, and `accessibility`.
- **Evidence:** `apps/web/src/main.tsx:328-400` (`FINDING_CATEGORY_CONFIG`, `classifyFindingCategory`).
- **Dependencies:** Findings view tab filters, Quality Audit report breakdown.
- **Confidence:** **VERIFIED**
- **Verification Method:** Inspect finding list in `apps/web/src/main.tsx`; verify category classification matches `area` string.

---

### INV-011: Timezone & Timestamp Standardization (Asia/Jakarta / WIB)
- **Description:** Server process timezone must be explicitly initialized to `'Asia/Jakarta'`. All human-readable timestamps rendered in UI tables, logs, topbars, and reports must include the `WIB` designation (UTC+7).
- **Evidence:** `apps/api/src/server.ts:2`, `apps/api/src/server.ts:930-934, 1221-1229`, `apps/api/src/report/report-builder.ts:7-25`, `apps/web/src/api.ts:110-120`.
- **Dependencies:** Node.js `process.env.TZ = 'Asia/Jakarta'` and `Intl.DateTimeFormat` with `timeZone: 'Asia/Jakarta'`.
- **Confidence:** **VERIFIED**
- **Verification Method:** Inspect `/health` JSON; verify `timeWIB` matches current Western Indonesia Time.

---

### INV-012: Local Storage & Session State Key Names
- **Description:** Frontend persistence keys must not be renamed:
  - `qc_theme`: `'dark' | 'light'`.
  - `qc_maestro_current_view`: Current view token.
  - `qc_admin_token`: Admin bearer JWT/HMAC token string.
  - `qc_admin_user`: Admin user profile JSON.
  - `qc_maestro_active_job_id`: Selected active Job UUID.
- **Evidence:** `apps/web/src/main.tsx:695, 716, 756`, `apps/web/src/api.ts:4-24`.
- **Dependencies:** State initialization hooks in React components.
- **Confidence:** **VERIFIED**
- **Verification Method:** Refresh page and verify session state is hydrated from exact local storage keys.

---

### INV-013: Android & Web Platform Execution Isolation
- **Description:** Web flows must run exclusively through Playwright; Android flows must run exclusively through Maestro and ADB. Target configurations must isolate web baseUrl from Android emulator loopback alias (`http://10.0.2.2:8000`).
- **Evidence:** `apps/api/src/discovery/discovery-service.ts:1504-1506`, `apps/api/src/flow-builder/inventory-to-flow.ts:38-390`, `apps/web/src/types.ts:157, 187`.
- **Dependencies:** Platform discriminator in flow schema and discovery configuration.
- **Confidence:** **VERIFIED**
- **Verification Method:** Inspect generated flow YAML for web vs android projects; verify no cross-platform commands are emitted.

---

### INV-014: Error Origin Disambiguation (`user_target_application` vs `qc_maestro_engine`)
- **Description:** Test failure reporting must explicitly distinguish whether a failure originated in the target application under test (e.g., target 500 error, broken link, unmet assertion) or within the test orchestration infrastructure (e.g., Playwright worker timeout, Docker daemon crash, ADB disconnect).
- **Evidence:** `apps/api/src/playwright-adapter.ts:16`, `apps/api/src/discovery/types.ts:68-69`, `apps/web/src/types.ts:98, 100`, `apps/web/src/main.tsx:840-850`.
- **Dependencies:** Error origin categorization in adapter catch blocks and report builder.
- **Confidence:** **VERIFIED**
- **Verification Method:** Trigger a simulated 500 on target vs stopping Docker daemon; verify distinct error badges in `runs` and `reports`.

---

### INV-015: Visual Regression Threshold and Gate Logic
- **Description:** Visual regression checks must compare against PNG baselines in `.qc-artifacts/baselines/<project>/`. Pipeline gates (`qc:gate`) must fail if visual diff percentage exceeds `QC_ALLOWED_VISUAL_DIFF_PERCENT` (default: 0.5%) or if failed checks exceed `QC_ALLOWED_FINDINGS`.
- **Evidence:** `docs/QUALITY_AUDIT_RULES.md:16-27`, `scripts/qc-regression-gate.cjs:15-17, 43-55`.
- **Dependencies:** Pixel-by-pixel diff engine and regression gate script.
- **Confidence:** **VERIFIED**
- **Verification Method:** Execute `scripts/qc-regression-gate.cjs` with an artificially altered visual report; verify process exit code 1.

---

## 2. CHANGE BOUNDARIES CLASSIFICATION

### Class A: Protected Behavior (DO NOT MODIFY)
These systems form the invariant foundation of the platform:
1. All Fastify endpoint paths, HTTP verbs, and query parameters.
2. The `@qc/flow-schema` canonical YAML syntax, action verbs, and locator strategies.
3. Secret scrubbing and token validation algorithms (`apps/api/src/auth.ts`).
4. Read-only crawler safety regex and mutation prevention rules.
5. Directory traversal containment (`..` escape checks).
6. Local storage key names and session event contracts (`qc:unauthorized`).

### Class B: Conditionally Modifiable Implementation (UX REFINEMENT ZONE)
These elements may be redesigned, enhanced, or restructured by AI tools (including Figma Make) provided behavioral equivalence is preserved:
1. **Layout & Surface Architecture:** Converting between card grids, table views, split-pane inspectors, or drawer layouts.
2. **Typography & Styling:** Upgrading fonts (e.g., Geist, Cabinet Grotesk, JetBrains Mono), adjusting type scale, tracking, line-heights, and tabular figures.
3. **Color Themes:** Applying curated palettes (e.g., Linear Method Dark Tech or Industrial Brutalist Swiss Print) while respecting status LED colors (Green: Passed, Sky/Cyan: Running, Amber: Attention, Red: Critical).
4. **Micro-Interactions & States:** Adding tactility (hover transitions `120ms - 150ms`, active clicks `scale(0.98)`), skeleton loaders, empty states, and progress bars.
5. **Responsiveness:** Fluid breakpoints (`desktop`, `tablet`, `mobile`), collapsible sidebars, and sticky stage players.

### Class C: Restricted Changes (REQUIRES EXPLICIT APPROVAL)
Modifications that require architecture sign-off and schema migrations:
1. Adding or altering database tables, columns, or migration scripts.
2. Modifying the state machine transitions of `DiscoveryJob` or `Run`.
3. Changing default data retention periods or concurrency limits.
4. Altering external integration protocols (Gemini REST v1beta, Nextcloud WebDAV).
