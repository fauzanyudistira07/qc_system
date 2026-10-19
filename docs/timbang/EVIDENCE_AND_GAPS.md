# TIMBANG — EVIDENCE INDEX, GAPS, & AUDIT LIMITATIONS

> **Specification Standard:** Empirical Evidence Index, Audit Verification Matrix, Contradictions, and Boundary Gaps  
> **Extraction Standard:** Strictly grounded in current workspace implementation. Claims are categorized using five confidence levels: `VERIFIED`, `PARTIALLY VERIFIED`, `INFERRED`, `UNKNOWN`, and `CONFLICTING`.

---

## 1. SUBSYSTEM AUDIT & COVERAGE MATRIX

| Subsystem | Inspected Files | Evidence Citation | Confidence | Remaining Gaps & Limitations |
|---|---|---|---|---|
| **Core API Server** | `apps/api/src/server.ts` | Lines 1–2092 | **VERIFIED** | Fastify routes, auth hooks, and artifact streaming directly verified in source code. |
| **Authentication & Gate** | `apps/api/src/auth.ts` | Lines 1–75 | **VERIFIED** | HMAC-SHA256 token generation and timing-safe verification verified in source. |
| **Flow Schema & Zod** | `packages/flow-schema/src/index.ts` | Lines 1–166 | **VERIFIED** | Canonical platform rules, actions, locators, and normalization verified in source. |
| **Playwright Web Adapter** | `apps/api/src/playwright-adapter.ts` | Lines 1–524 | **VERIFIED** | Headless browser execution, live preview base64 capture, and step execution verified. |
| **Maestro Android Adapter** | `apps/api/src/maestro-adapter.ts`, `apps/api/src/android/index.ts` | `maestro-adapter.ts:1-50`, `android/index.ts:1-200` | **VERIFIED** | YAML compiler, ADB device query, and APK inspection via `aapt` verified in code. Physical device / emulator requires host hardware. |
| **Discovery Source Scanner** | `apps/api/src/discovery/source-scanner.ts` | Lines 1–362 | **VERIFIED** | AST/regex multi-framework route scanner (Laravel, Node, Flutter/Dart) verified. |
| **Discovery UI Crawler** | `apps/api/src/discovery/ui-crawler.ts` | Lines 1–490 | **VERIFIED** | Safe GET traversal, non-destructive regex guards, and selector confidence verified. |
| **Capability Engine** | `apps/api/src/discovery/capability-model.ts` | Lines 1–246 | **VERIFIED** | 27-capability catalog, confidence weighting, and scenario synthesis verified. |
| **Business Flow Engine** | `apps/api/src/discovery/business-flow.ts` | Lines 1–223 | **VERIFIED** | Flow mapping, approval state machine, and human review gate verified. |
| **AI Integration (Gemini)** | `apps/api/src/gemini-service.ts` | Lines 1–326 | **VERIFIED** | REST v1beta prompt-to-flow synthesis and failure diagnosis verified in source. |
| **Media Archival (Nextcloud)** | `apps/api/src/nextcloud-service.ts` | Lines 1–437 | **VERIFIED** | WebDAV MKCOL, PUT, batch upload, and zip archive creation verified in source. |
| **Web UI Dashboard (SPA)** | `apps/web/src/main.tsx`, `wizard.tsx`, `login.tsx`, `ui.tsx` | All component files | **VERIFIED** | 13 view navigation, wizard forms, telemetry displays, and styles verified. |
| **Data Retention Policy** | `apps/api/src/runtime-policy.ts` | Lines 1–59 | **VERIFIED** | 7-day clone and 30-day artifact retention and 6-hour scheduler verified in code. |
| **PostgreSQL Data Store** | `infrastructure/postgres/001_multi_user_report_store.sql` | Lines 1–99 | **PARTIALLY VERIFIED** | Migration DDL is verified in file, but active single-instance runtime primarily uses `.qc-artifacts/discovery-jobs.json`. |
| **Solu AI / Nina Worker** | `apps/api/src/server.ts:1090-1130` | Lines 1090–1130 | **PARTIALLY VERIFIED** | Code contains optional legacy fallback branch; default provider is active Google Gemini. |
| **Production Multi-Tenant Host**| Production cloud / Kubernetes | — | **UNKNOWN** | Workspace contains local Docker Compose and development configs; production cloud infrastructure is external to repository. |

---

## 2. CONTRADICTIONS & DIVERGENCES BETWEEN DOCUMENTATION & CODE

### 2.1 Product Moniker (`Timbang` vs `QC Maestro`)
- **Documentation / Context:** The product specification brief refers to the system as **Timbang**.
- **Implementation Reality:** In the codebase, packages are named `@qc/api`, `@qc/web`, `@qc/flow-schema`, and the UI displays `QC Maestro` as its structural title (`apps/web/src/main.tsx:121, 220`).
- **Harmonization Proof:** `apps/api/src/nextcloud-service.ts:53` references `CMM Service/Timbang Image and Video`.
- **Runtime Determinant:** `QC Maestro` is the internal framework and engine name; `Timbang` is the product identity. Both refer to the identical code and behavior.

### 2.2 AI Provider (`Solu AI / Nina` vs `Google Gemini`)
- **Documentation in README:** `README.md:13` states: *"Nina generation worker belum aktif. API tetap dapat dijalankan tanpa GitHub key dan Solu AI key."*
- **Implementation Reality:** `apps/api/src/gemini-service.ts` and `apps/api/src/server.ts:1079-1155` have integrated Google Gemini REST API v1beta as the primary, active AI engine (`gemini-1.5-flash`). Solu AI is kept only as an optional secondary legacy fallback when `SOLU_AI_ENABLED === 'true'`.
- **Runtime Determinant:** Gemini API determines runtime AI generation and diagnosis whenever `GEMINI_API_KEY` is present.

### 2.3 Storage Implementation (Postgres/Redis vs Local JSON Files)
- **Documentation in README:** `README.md:11-13` notes infrastructure services (PostgreSQL, Redis, MinIO) and states *"Project dan ringkasan run disimpan lokal di .qc-artifacts/qc-state.json"*.
- **Implementation Reality:** Single-instance local runtime persists jobs to `.qc-artifacts/discovery-jobs.json` and legacy runs to `.qc-artifacts/qc-state.json`. PostgreSQL migration exists in `infrastructure/postgres/001_multi_user_report_store.sql` for containerized multi-user deployment, but active API code runs without requiring an active PostgreSQL connection.
- **Runtime Determinant:** Local file storage (`.qc-artifacts/`) determines active development and single-instance behavior.

---

## 3. INACCESSIBLE SUBSYSTEMS & AUDIT LIMITATIONS

1. **Hardware Android Devices & USB Peripherals:**
   - The ADB adapter (`apps/api/src/android/adb.ts`) executes shell commands (`adb devices`, `adb screencap`, `adb install`). When running on a remote headless CI or environment without an attached emulator or Android device, ADB queries return an empty device list `[]`.
2. **Containerized Polyglot Runtimes (Docker Daemon):**
   - Managed local project execution (`apps/api/src/project-runner.ts`) requires a running Docker daemon on the host. In environments where Docker is not installed or the socket is not mounted, the system detects `docker.available = false` and skips container provisioning.
3. **External Nextcloud Server:**
   - WebDAV uploads target `https://158.140.181.43:8443` (`apps/api/src/nextcloud-service.ts:50`). Reachability depends on network connectivity to the private IP and server availability.

---

## 4. SECURITY & DATA INTEGRITY AUDIT

- **Secrets Audit:** Verified that no production database credentials, private API keys, or JWT tokens are committed in documentation files.
- **Redaction Verification:** Code inspection confirms that `scrubPersistedText` (`apps/api/src/server.ts:821-828`) and `scrubText` (`apps/api/src/discovery/ui-crawler.ts:123-126`) intercept and redact sensitive fields prior to disk writes.
- **Path Traversal Audit:** Verified that `path.resolve` and `path.relative` guards (`apps/api/src/server.ts:1918-1920, 1973-1974`) effectively reject path traversal attempts escaping the `.qc-artifacts/` hierarchy.

---

## 5. OBSERVED TEST EXECUTION RESULTS VS RECOMMENDED TESTS

### 5.1 Actually Executed Tests & Observed Outcomes
1. **`npm run check` (`tsc --noEmit -p apps/api/tsconfig.json && tsc --noEmit -p apps/web/tsconfig.json`):**
   - **Status:** **FAILED (Exit code 2)**
   - **Observed Result:**
     `apps/api/src/discovery/discovery-service.ts:3:22 - error TS2724: '"node:*"' has no exported member named 'readFileSync'. Did you mean 'readFile'?`
   - **Diagnosis:** `apps/api/src/ambient.d.ts:3-34` declares ambient exports for `node:*`, but omits `readFileSync` while declaring `readFile`, `statSync`, `existsSync`.
   - **Action Taken:** In accordance with non-negotiable Rule 6 ("Do not modify application code, tests..."), the error was not modified or patched; recorded as an existing known issue.
2. **`npm run validate:example` (`tsx packages/flow-schema/src/cli.ts docs/examples/login.yaml`):**
   - **Status:** **PASSED (Exit code 0)**
   - **Observed Result:** Validated canonical flow YAML schema with Zod, normalized step IDs, and assigned default timeout (10,000ms).
3. **`npm run build` (`vite build --workspace @qc/web`):**
   - **Status:** **PASSED (Exit code 0)**
   - **Observed Result:** Successfully compiled React 19 + Tailwind CSS 4 frontend bundle into `apps/web/dist` in 5.01s.

### 5.2 Recommended Future Regression Tests
- Add CI unit tests verifying `apps/api/src/ambient.d.ts` node module coverage.
- End-to-end integration test for HTTP 206 video range seeking across Chrome and Safari.
- Playwright headless test validating the review gate unblocking flow.

