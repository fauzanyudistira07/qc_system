# TIMBANG — BUSINESS LOGIC & WORKFLOW RULES SPECIFICATION

> **Specification Standard:** Implementation-Grounded Domain Logic, Validation, State Machine, & Algorithm Specification  
> **Source Files Verified:**  
> - `apps/api/src/discovery/discovery-service.ts`  
> - `apps/api/src/discovery/business-flow.ts`  
> - `apps/api/src/discovery/capability-model.ts`  
> - `apps/api/src/discovery/crud-planner.ts`  
> - `apps/api/src/discovery/role-planner.ts`  
> - `apps/api/src/discovery/feature-contract.ts`  
> - `apps/api/src/discovery/ui-crawler.ts`  
> - `apps/api/src/discovery/source-scanner.ts`  
> - `apps/api/src/flow-builder/inventory-to-flow.ts`  
> - `packages/flow-schema/src/index.ts`  
> - `apps/api/src/runtime-policy.ts`  
> - `apps/api/src/auth.ts`

---

## 1. JOB LIFECYCLE STATE MACHINE

The Discovery Job execution is modeled as a deterministic state machine managed by `DiscoveryService` (`apps/api/src/discovery/discovery-service.ts:28-200`).

### 1.1 State Registry
| State | Definition | Transition Triggers | Exit Conditions |
|---|---|---|---|
| `QUEUED` | Job created, queued for resource availability | Created via `POST /api/v1/discovery/jobs` | Next execution tick begins |
| `RUNNING` | Active discovery, crawl, or test execution underway | System starts discovery pipeline | Completes all phases, hits error, or reaches review gate |
| `WAITING_REVIEW` | Pipeline paused waiting for human review of Business Flows | `businessFlowReview.mode === 'required'` & capability model finishes | Reviewer approves flows via `approveBusinessFlows` |
| `COMPLETED` | Pipeline finished; all flows executed; reports compiled | Report builder successfully writes artifacts | Terminal state |
| `FAILED` | Unrecoverable error encountered in target or infra | Exception during discovery, compile, or audit | Terminal state (restartable via `/restart`) |
| `CANCELLED` | Explicitly aborted by user action | User triggers `POST .../cancel` | AbortController signals teardown |
| `INTERRUPTED` | Server restarted while job was active | `restoreState()` finds `QUEUED` or `RUNNING` jobs on boot | Terminal state (marked with restart prompt) |

### 1.2 State Transition Diagram
```
              [Create Job]
                   │
                   ▼
               ┌────────┐
        ┌─────▶│ QUEUED │
        │      └────┬───┘
        │           │ (Workers start)
        │           ▼
        │      ┌─────────┐   (Review Mode = 'required')   ┌────────────────┐
        │      │ RUNNING │ ─────────────────────────────▶ │ WAITING_REVIEW │
        │      └────┬────┘                                └───────┬────────┘
        │           │                                             │ (Human Approves)
        │           ├─────────────────────────────────────────────┘
        │           │
        │           ├───[Uncaught Error]──────▶ ┌────────┐
        │           │                           │ FAILED │
        │           ├───[User Abort]──────────▶ ┌───────────┐
        │           │                           │ CANCELLED │
        │           ├───[Server Restart]──────▶ ┌─────────────┐
        │           │                           │ INTERRUPTED │
        │           ▼                           └─────────────┘
  (Restart)    ┌───────────┐
        └───── │ COMPLETED │
               └───────────┘
```

---

## 2. DISCOVERY & RECONNAISSANCE PIPELINE

Discovery executes in sequentially orchestrated phases (`apps/api/src/discovery/discovery-service.ts`):

### Phase 1: Preflight & Environment Reachability
- **Action:** Probes target base URL via HTTP HEAD/GET (`timeoutMs: 3500`).
- **Precondition:** Valid HTTP/HTTPS format without credentials in URL string (`apps/api/src/server.ts:1240-1256`).
- **Postcondition:** Target confirmed online; local sandbox directory initialized in `.qc-artifacts/jobs/<jobId>/`.

### Phase 2: Static Source Code Scan (`SourceScanner`)
- **File:** `apps/api/src/discovery/source-scanner.ts`
- **Method:** Heuristic static analysis scanning AST / regex without evaluating code.
- **Limits & Safeguards:**
  - Max files scanned: 5,000 (`source-scanner.ts:22`).
  - Max directory depth: 20 (`source-scanner.ts:22`).
  - Max file size: 512 KB; Total bytes: 32 MB (`source-scanner.ts:22`).
  - Excluded directories: `node_modules`, `vendor`, `storage`, `dist`, `build`, `artifacts`, etc. (`source-scanner.ts:23`).
  - Excluded files: `.env`, files matching `secret`, `credential`, `token`, `password`, `dump` (`source-scanner.ts:24`).
- **Supported Frameworks:** Laravel/PHP routes (`Route::get`, `prefix()->group()`), Express/Fastify/Koa routes, Vue Router, React Router / Next.js pages, Flutter/Dart widgets (`ElevatedButton`, `TextField`, `ListTile`).
- **Outputs:** Page inventory list, route list, API endpoint list.

### Phase 3: Dynamic UI Crawl (`UICrawler`)
- **File:** `apps/api/src/discovery/ui-crawler.ts`
- **Engine:** Playwright Chromium headless.
- **Safety Gate (Non-destructive Audit Rule):**
  - Regex filter prevents crawling or submitting destructive actions:
    `/(?:delete|remove|destroy|logout|signout|unsubscribe|deactivate|terminate|truncate|purge|drop|revoke|reset|checkout|purchase|pay|confirm)/i` (`ui-crawler.ts:12`).
  - Only safe `GET` routes are visited.
  - Interactive form fields are scrubbed: form inputs are marked `aria-hidden: true` and cleared before exploration to avoid accidental submissions (`ui-crawler.ts:98-100`).
- **Selector Synthesis & Confidence Scoring:**
  1. `data-testid` selector: `confidence = 0.99` (`ui-crawler.ts:68`).
  2. Element `#id` selector: `confidence = 0.95` (`ui-crawler.ts:69`).
  3. Unique ARIA role + accessible name: `confidence = 0.85` (`ui-crawler.ts:74`).
  4. Cascading CSS nth-child selector: `confidence = 0.75` (`ui-crawler.ts:82-85`).

### Phase 4: Capability & Domain Modeling
- **File:** `apps/api/src/discovery/capability-model.ts`
- **Catalogue:** 27 canonical functional capabilities (`CAPABILITY_CATALOG:90-120`):
  `public-navigation`, `authentication`, `authorization`, `forms`, `search-filter`, `pagination`, `modal-drawer`, `multi-step-form`, `crud`, `tables-data`, `file-upload`, `file-download`, `catalog`, `cart`, `checkout`, `payment`, `reservation`, `scheduling`, `approval-workflow`, `notifications`, `messaging`, `tickets-support`, `dashboard-reporting`, `content-cms`, `media`, `api`, `realtime`, `localization`.
- **Confidence Computation:** Based on matching routes, API contracts, interactive DOM elements, and HTTP method signals (`confidence` range: `0.0` to `1.0`).

### Phase 5: Business Flow & Feature Contract Mapping
- **Files:** `apps/api/src/discovery/feature-contract.ts`, `business-flow.ts`
- **Contract Scenarios:** Every detected capability synthesizes 6 distinct scenario tracks:
  1. `happy`: Primary expected operation path.
  2. `negative`: Validation rejection on invalid inputs (`safe-probe`).
  3. `boundary`: Extreme limits (min/max numbers, 240+ character long strings).
  4. `permission`: Access denial on unauthorized role sessions.
  5. `recovery`: State preservation across network glitch or page refresh.
  6. `integrity`: Data consistency verification across UI, API, and database.

---

## 3. BUSINESS FLOW HUMAN REVIEW GATE

When `config.businessFlowReview.mode === 'required'` (the default product setting):

1. **Gate Activation:**
   - As soon as Phase 4 finishes, the job enters `status: 'WAITING_REVIEW'` and `phase: 'BUSINESS_FLOW_REVIEW'`.
   - The runner registers an internal Promise resolver in `businessFlowWaiters.set(job.id, { resolve, reject })` (`apps/api/src/discovery/discovery-service.ts:36, 170-172`).
2. **Review Actions:**
   - The user inspects the candidate flows in the `flows` view.
   - The user may edit flow titles, steps, actors, or expected outcomes via `PUT /api/v1/discovery/jobs/:id/business-flows/:flowId`.
   - The user approves flows via `POST /api/v1/discovery/jobs/:id/business-flows/approve`.
3. **Gate Release:**
   - When all critical flows are marked `APPROVED`, `businessFlowWaiters.get(id).resolve()` is invoked.
   - Job updates: `config.executeFlows = true`, all flows transition to `status: 'READY'`.
   - Job resumes into `EXECUTING_TESTS`.

---

## 4. FLOW SCHEMA COMPILATION & EXECUTION RULES

### 4.1 QC Flow Schema Rules (`@qc/flow-schema`)
Defined in `packages/flow-schema/src/index.ts`:

- **Platform Invariants:**
  - If `target.platform === 'android'`, action `open` is strictly illegal; `launchApp` must be used (`packages/flow-schema/src/index.ts:102-104`).
  - If `target.platform === 'web'`, strategy `accessibilityId` is unsupported by Playwright compiler (`packages/flow-schema/src/index.ts:99-101`).
- **Action Invariants:**
  - Action `open` requires field `url` (`packages/flow-schema/src/index.ts:93-95`).
  - Actions `click`, `input`, `clear`, `assertVisible`, `assertNotVisible`, `assertText` strictly require a valid `target` (`packages/flow-schema/src/index.ts:96-98`).
- **Timeout Defaults:**
  - Step timeout default: `execution.timeoutMs` (default: 30,000ms; max: 600,000ms).
  - Step duration max: 300,000ms.

### 4.2 Web Execution Algorithm (`PlaywrightAdapter`)
- **Source:** `apps/api/src/playwright-adapter.ts:146-380`
- **Session Isolation:** Each flow run spawns an isolated browser context with dedicated cookies and local storage.
- **Credential Injection:** Variables matching `${QC_EMAIL}` and `${QC_PASSWORD}` are resolved at execution time and scrubbed from persisted logs (`playwright-adapter.ts:93-96`).
- **Video Policy & Normalization:**
  - Native video is recorded via Playwright's `recordVideo` option.
  - Raw video is piped through ffmpeg via `apps/api/src/video-policy.ts:normalizeVideo` to re-encode into standard 25 FPS WebM/MP4, stripping corrupted trailing frames and fixing duration headers.

### 4.3 Android Execution Algorithm (`MaestroAdapter`)
- **Source:** `apps/api/src/maestro-adapter.ts:22-48`, `apps/api/src/android/index.ts:600-850`
- **Compilation Mapping:**
  - `click` -> `tapOn: { text: ... }` or `tapOn: { id: ... }`.
  - `input` -> `tapOn: target` followed by `inputText: value`.
  - `clear` -> `tapOn: target` followed by `eraseText: 100`.
  - `back` -> `pressKey: 'BACK'`.
  - `scroll` -> `scroll`.
  - `assertVisible` -> `assertVisible: { text: ... }`.
  - `screenshot` -> `takeScreenshot: name`.
- **Prohibited on Android:** `open`, `assertUrl`, `reload` throw compilation errors (`apps/api/src/maestro-adapter.ts:44-46`).

---

## 5. QUALITY AUDIT & DEFECT EVALUATION RULES

### 5.1 Verification Checklist
Quality Audit runs deep heuristic checks across all discovered routes (`docs/QUALITY_AUDIT_RULES.md:5-15`):
1. **HTTP & Session Security:** Verifies safe GET response codes, protected route redirect behavior, and presence of security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`).
2. **Typography & Layout Integrity:** Scans for merged camelCase words, text truncation (`text-overflow: ellipsis` clipping content), negative letter-spacing collisions, and horizontal scrollbar overflow.
3. **Accessibility (WCAG AA):** Evaluates contrast ratios (minimum 4.5:1 for normal text), ARIA landmark completeness, unique DOM IDs, label associations, and keyboard focus outlines.
4. **Visual Regression:** Compares captured viewport screenshots against baseline PNGs stored in `.qc-artifacts/baselines/<project>/`.
   - `allowedDiffPercent`: default 0.5%.
   - `pixelThreshold`: default 0.1.
5. **Dense Data Stress:** Tests forms and tables with 100 synthetic rows and 240-character long test strings to observe layout collapse.
6. **Form Boundary & Network Recovery:** Tests empty submission validations, double-click submission prevention, and client behavior during simulated network aborts.

### 5.2 Defect Classification & Scoring
- **Total Checks ($T$):** Sum of all executed heuristic tests across selected viewports and browsers.
- **Passed Checks ($P$):** Checks meeting 100% of assertion criteria.
- **Failed Checks ($F$):** Checks with unmet criteria.
- **Not Applicable ($NA$):** Capabilities not present in the target application.
- **Overall Score:**
  $$\text{Score \%} = \text{round}\left(\frac{P}{T - NA} \times 100\right)$$
- **Error Origin Tagging:**
  - `user_target_application`: Assertion failures, target HTTP 500, unhandled target UI exceptions.
  - `qc_maestro_engine`: Playwright context crashes, browser launch timeouts, Docker network disconnects.

---

## 6. DATA RETENTION & SECURITY HYGIENE RULES

- **Retention Thresholds:** Enforced by `cleanupRetention` in `apps/api/src/runtime-policy.ts:47-58`:
  - `clones/`: Retained for 7 days (`QC_CLONE_RETENTION_DAYS`).
  - `projects/`, `jobs/`, `test-runs/`: Retained for 30 days (`QC_ARTIFACT_RETENTION_DAYS`).
  - Scheduled cleanup runs every 6 hours (`QC_RETENTION_CLEANUP_INTERVAL_HOURS`).
  - Concurrency constraint: Max 2 active projects (`QC_MAX_ACTIVE_PROJECTS=2`).
- **Secret Sanitization:**
  - Evaluated on every log message and state write (`apps/api/src/server.ts:821-828`).
  - Regex masks all values following `password`, `token`, `secret`, `api_key`, `authorization` with `[REDACTED]`.
  - Environment variables containing sensitive keywords are matched and scrubbed.
