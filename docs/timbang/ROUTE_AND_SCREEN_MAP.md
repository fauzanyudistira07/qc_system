# TIMBANG — ROUTE, SCREEN, & COMPONENT MAP

> **Specification Standard:** Comprehensive Implementation-Grounded UI Route & Component Map  
> **Source Files Verified:**  
> - `apps/web/src/main.tsx` (5,151 lines)  
> - `apps/web/src/wizard.tsx` (2,210 lines)  
> - `apps/web/src/types.ts` (207 lines)  
> - `apps/web/src/api.ts` (317 lines)  
> - `apps/web/src/login.tsx` (160 lines)  
> - `apps/web/src/live-viewport.tsx` (215 lines)  
> - `apps/web/src/business-flow-visualizer.tsx` (290 lines)  
> - `apps/web/src/project-switcher.tsx` (185 lines)  
> - `apps/web/src/gemini-modal.tsx` (220 lines)  
> - `apps/web/src/ui.tsx` (46 lines)

---

## 1. ROUTING & VIEW ARCHITECTURE

### 1.1 Navigation Model
The Timbang client application is an authenticated Single-Page Application (SPA) driven by an internal view state mechanism synchronized with the browser location and `localStorage`.

- **State Hook:** `currentView: View` (`apps/web/src/main.tsx:705-733`).
- **Persistence:** Synchronized with `localStorage.getItem('qc_maestro_current_view')`.
- **Supported View Tokens (`export type View`):**
  `'overview' | 'process' | 'projects' | 'discovery' | 'map' | 'flows' | 'runs' | 'findings' | 'reports' | 'evidence' | 'settings' | 'new' | 'live'` (`apps/web/src/types.ts:150`).
- **URL Path Mapping:**
  ```typescript
  const routeViews: Record<string, View> = {
    '/': 'overview',
    '/overview': 'overview',
    '/process': 'overview',      // Legacy redirect: mapped directly to 'overview'
    '/projects': 'overview',
    '/discovery': 'discovery',
    '/discovery/new': 'new',
    '/map': 'map',
    '/flows': 'flows',
    '/runs': 'runs',
    '/findings': 'findings',
    '/reports': 'reports',
    '/evidence': 'evidence',
    '/settings': 'settings',
    '/live': 'live'
  };
  ```
- **Fallback / Guard:** Any legacy `'process'` state is redirected to `'overview'` (`apps/web/src/main.tsx:724-728`). Unknown routes fallback to `'overview'`.

### 1.2 Global Authentication Guard
- **Component:** `AdminLoginView` (`apps/web/src/login.tsx:1-160`).
- **Trigger:** Rendered conditionally at root when `authToken === null` and the backend reports `enabled: true` via `/api/v1/auth/config` (`apps/web/src/main.tsx:1420-1425`).
- **Events:** Listens to global `window.addEventListener('qc:unauthorized', ...)` dispatched by `apps/web/src/api.ts:37` upon receiving HTTP 401.

---

## 2. EXHAUSTIVE VIEW REGISTRY

---

### View 1: `AdminLoginView` (Authentication Screen)
- **File:** `apps/web/src/login.tsx`
- **Parent / Route:** Root overlay when unauthenticated (`apps/web/src/main.tsx:1420`).
- **Purpose:** Restricts access to QC Maestro dashboard on staging/production installations.
- **Displayed Data:** Application branding, email input, password input, error alert banner.
- **Inputs & State:**
  - `email` (string, default: `admin@qcmaestro.com` from placeholder).
  - `password` (string).
  - `error` (string, error message display).
  - `loading` (boolean, submit button spinner state).
- **Actions & Handlers:**
  - `handleSubmit(e)`: Calls `POST /api/v1/auth/login` via `apps/web/src/api.ts:send`.
  - On Success: Stores token and user profile via `setAuthSession(token, user)` (`apps/web/src/api.ts:16-19`) in `localStorage` under `qc_admin_token` and `qc_admin_user`. Invokes `onLoginSuccess(token, user)`.
- **States:**
  - Loading: Submit button disabled with spinner.
  - Error: Renders `<div className="login-error-banner">` displaying API error string.

---

### View 2: `overview` (Project Summary & Topology)
- **File:** `apps/web/src/main.tsx` (Lines 1636–2340)
- **Purpose:** Central operational dashboard displaying pipeline topology, execution milestones, active target health, and summary metrics.
- **Displayed Data:**
  - Active Job header: Project name, status badge (`QUEUED`, `RUNNING`, `WAITING_REVIEW`, `COMPLETED`, `FAILED`), phase text, created/finished timestamp (formatted in WIB via `formatWIB`).
  - Milestone Topology Graph: 6 phases rendered via SVG connectors (`apps/web/src/main.tsx:176-243`):
    1. Discovery & Source Scan
    2. Model & Contracts
    3. Business Flow Review
    4. Test Execution
    5. Quality & Visual Audit
    6. Report & Evidence
  - Connected Target Status: Base URL, Backend URL, reachability status, probe latency in milliseconds.
  - Metrics Grid: Total Flow Scenarios, Total Test Steps, Pass Rate %, Defect Findings count.
- **Child Components:**
  - `MilestoneFlow` (`apps/web/src/main.tsx:176-243`): Interactive canvas with SVG curves connecting 6 checkpoint cards.
  - `MilestoneDetails` (`apps/web/src/main.tsx:245-261`): Modal/Drawer showing checkpoint outputs, related screenshots, and run context.
  - `CapabilityProfilePanel` (`apps/web/src/main.tsx:50-82`): Displays detected capabilities out of the 27 catalog items.
- **Actions & Handlers:**
  - "Mulai QC Baru": Switches view to `'new'`.
  - "Edit Konfigurasi": Populates `editingJob` and switches view to `'new'`.
  - "Jalankan Audit": Calls `POST /api/v1/discovery/jobs/:id/quality-audit`.
  - "Jalankan Autonomous E2E": Calls `POST /api/v1/discovery/jobs/:id/e2e-run`.
  - "Restart Job": Calls `POST /api/v1/discovery/jobs/:id/restart`.
  - "Batalkan Job": Calls `POST /api/v1/discovery/jobs/:id/cancel`.
- **States:**
  - Empty: When no jobs exist, prompts to run Wizard.
  - Loading: Skeleton / progress bar during initial load.
  - Live Pulsing: Green pulsating LED indicator when job is actively running.

---

### View 3: `new` (New QC Run Intake Wizard)
- **File:** `apps/web/src/wizard.tsx` (Lines 1–2210)
- **Purpose:** Guided 3-step configuration intake for web and mobile testing targets.
- **Layout & Stepper:**
  - Step 0: "Target & Backend" (`apps/web/src/wizard.tsx:633-1311`)
  - Step 1: "Akun & Data Uji" (`apps/web/src/wizard.tsx:1312-1831`)
  - Step 2: "Review & Jalankan" (`apps/web/src/wizard.tsx:1832-2150`)

#### Step 0: Target & Backend Details
- **Controls & Form Elements:**
  - Platform Radio Selector: `web` vs `android` (`ENABLE_MOBILE_SUPPORT = true`).
  - Target Mode Picker:
    - `existing-target`: Target URL input with "Periksa Koneksi" probe button (`apps/web/src/wizard.tsx:750-800`).
    - `local-folder`: Host filesystem path input (`localPath`).
    - `github`: Repository URL (`repositoryUrl`) and branch/ref (`ref`).
  - Backend Service Target: Configurable as `local` (loopback), `internet` (remote URL), or `server` (container sandbox).
  - Android-specific Controls (when platform === `'android'`):
    - Drag-and-drop APK dropzone (`apps/web/src/wizard.tsx:890-950`).
    - Local APK path input (`apps/web/src/wizard.tsx:960-990`).
    - ADB Device selector dropdown (`system.adb.devices`).
    - "Pasang ke Device" button: Triggers `POST /api/v1/android/install-apk`.

#### Step 1: Akun & Data Uji Details
- **Controls & Form Elements:**
  - Test Accounts Dynamic Table: Rows for Name, Email / NIS, Password, Role.
  - Database Engine & Source Selector: `none`, `sqlite`, `mysql`, `postgres`; sources: `empty`, `sql`, `migrate`, `seed`.
  - Database Upload Dropzone: Drag-and-drop for `.sql` fixture files (`POST /api/v1/uploads`).
  - Auto-Seed Button: "Seed Database Jamaahku Otomatis" (`POST /api/v1/fixtures/seed/jamaahku`).
  - Advanced Crawl Rules (Accordion):
    - `maxPages` (number, default: 100).
    - `maxDepth` (number, default: 8).
    - `includePaths` (textarea, newline-separated).
    - `excludePaths` (textarea, newline-separated, default: `/logout\n/delete`).
    - `loginPath` (text, default: `/login`).
    - `emailSelector`, `passwordSelector`, `submitSelector`, `successUrl`.

#### Step 2: Review & Jalankan Details
- **Controls & Form Elements:**
  - Quality Audit Checkboxes:
    - Browsers: Chromium, Firefox, WebKit (`qualityAudit.browsers`).
    - Viewports: Desktop (1280x800), Tablet (768x1024), Mobile (375x667).
    - Visual Regression: `off`, `capture`, `required`.
    - Dense Data stress testing: Synthetic rows (100), long text length (240).
    - Accessibility / WCAG heuristics toggle.
    - Negative test scenario safe probes toggle.
  - Business Flow Review Mode: `required` (human must approve before execution) vs `auto` (unattended CI).
  - Submission Button: "Mulai QC Run" (`POST /api/v1/discovery/jobs` or `PUT /api/v1/discovery/jobs/:id`).

---

### View 4: `discovery` (Live Terminal & Scanner Logs)
- **File:** `apps/web/src/main.tsx` (Lines 2419–2858)
- **Purpose:** Terminal emulation console showing real-time logs emitted during static scanning, UI crawling, and service provisioning.
- **Displayed Data:**
  - Terminal log feed: timestamp, category tag (`SYSTEM`, `crawler`, `source-scanner`, `flow-builder`, `audit`), and formatted log message.
  - Phase progression bar and current status.
- **Controls & Filters:**
  - Log Category Filter: `all` or specific category.
  - Text Search Filter (`logSearch`).
  - "Clear Filter" and "Auto-scroll" toggles.
  - Emergency Job Controls: "Batalkan" (`POST .../cancel`), "Restart" (`POST .../restart`).

---

### View 5: `map` (Discovered App Map)
- **File:** `apps/web/src/main.tsx` (Lines 2859–3038)
- **Purpose:** Structural inventory of discovered application screens, routes, and interactive controls.
- **Displayed Data:**
  - Routes List: Path, title, HTTP status, discovery state (`observed`, `candidate`, `blocked`, `error`), authentication requirement.
  - Page Detail Panel (upon selection):
    - Screenshot thumbnail (clickable to modal lightbox).
    - Extracted Elements: tag, type (`button`, `input`, `link`), selector, testId, confidence score.
    - Associated API endpoints detected on page.
- **Controls:**
  - View Switcher: Table view vs Grid cards.
  - Search Input: Filters routes by keyword.
  - Filter Tabs: `all`, `public`, `authenticated`, `error`.

---

### View 6: `flows` (Skenario Test & Flow Review)
- **File:** `apps/web/src/main.tsx` (Lines 3039–3607)
- **Purpose:** Business Flow review and YAML test script management.
- **Displayed Data:**
  - Business Flow Map Approval Banner: Displays count of flows requiring review.
  - Business Flow Cards: Title, category, actors, trigger, preconditions, steps table, expected outcome, negative paths.
  - Generated Flow YAML Editor: Monospace syntax view of canonical QC Flow YAML.
  - Compilation Previews: Side-by-side preview of compiled Playwright (`.spec.ts`) or Maestro YAML.
- **Actions & Handlers:**
  - "Setujui Semua Flow": Calls `POST /api/v1/discovery/jobs/:id/business-flows/approve`.
  - "Setujui Flow Ini": Calls approval for single flow item.
  - "Buka Gemini AI Assistant": Opens `GeminiModal` for AI scenario authoring.
  - "Simpan Perubahan Flow": Calls `PUT /api/v1/discovery/jobs/:id/flows/:flowId`.
  - "Jalankan Semua Flow": Calls `POST /api/v1/discovery/jobs/:id/run`.

---

### View 7: `runs` (Execution Runs & Step History)
- **File:** `apps/web/src/main.tsx` (Lines 3608–3670)
- **Purpose:** Telemetry table detailing test execution attempts, per-step outcomes, and timing.
- **Displayed Data:**
  - Run Status Badge (`QUEUED`, `RUNNING`, `PASSED`, `FAILED`, `INFRA_ERROR`).
  - Steps Table: Step index, action verb (`open`, `click`, `input`, `assertVisible`, etc.), status, duration in ms (`tabular-nums`), error message.
  - Error Origin Badge: Distinguishes `user_target_application` (bug in target) from `qc_maestro_engine` (infrastructure/timeout error).

---

### View 8: `findings` (Defect & Quality Audit Register)
- **File:** `apps/web/src/main.tsx` (Lines 3671–4041)
- **Purpose:** Centralized defect tracking categorized by engineering area.
- **Category Taxonomy (`FINDING_CATEGORY_CONFIG`):**
  1. `critical`: Authentication, runtime console errors, network failures, HTTP 5xx, security headers.
  2. `functional`: Form recovery, double-submit guard, dense data overflow.
  3. `content`: Truncated text, clipping, overlapping components, line-height issues.
  4. `visual`: Pixel regression differences against baseline PNG.
  5. `contrast`: WCAG AA color contrast ratio failures.
  6. `accessibility`: Missing ARIA labels, duplicate IDs, focus traps.
- **Actions:**
  - Finding Workflow Status Selector: Updates finding status (`OPEN` -> `IN_PROGRESS` -> `READY_FOR_RETEST` -> `PASSED`) via `PATCH /api/v1/discovery/jobs/:id/findings/status`.
  - "Lihat Screenshot": Opens checkpoint evidence image.

---

### View 9: `reports` (Final Audit Report)
- **File:** `apps/web/src/main.tsx` (Lines 4042–4920)
- **Purpose:** Executive and compliance audit reporting.
- **Sub-Tabs:**
  - `summary`: High-level metrics, pass rate score percent, error origin breakdown.
  - `gallery`: Visual collage of all step screenshots and visual diffs.
  - `document`: Embedded full-width rendered HTML report.
  - `videos`: Media player listing full flow session recordings.
- **Export Actions:**
  - "Unduh HTML": Triggers `downloadReport(jobId, 'html')`.
  - "Unduh PDF": Triggers `downloadReport(jobId, 'pdf')`.
  - "Unduh JSON": Triggers `downloadReport(jobId, 'json')`.

---

### View 10: `evidence` (Media & Recording Center)
- **File:** `apps/web/src/main.tsx` (Lines 4921–5059), `apps/web/src/polish.css:22-100`
- **Purpose:** Media inspection with HTML5 video streaming and cloud backup.
- **Layout:**
  - Left: Stage Viewer with HTML5 video player supporting HTTP 206 partial content range requests.
  - Right: Playlist of screenshots and video clips grouped by scenario.
- **Cloud & Archive Actions:**
  - "Upload ke Nextcloud": Calls `POST /api/v1/nextcloud/upload-media` to push evidence to WebDAV folder.
  - "Download ZIP": Calls `POST /api/v1/media/download-zip` to download all media assets in a single archive.

---

### View 11: `settings` (Hardware & Daemon Telemetry)
- **File:** `apps/web/src/main.tsx` (Lines 5060–5120)
- **Purpose:** Diagnostic health dashboard of underlying system prerequisites.
- **Displayed Telemetry:**
  - Docker Daemon: Status, availability, message (`apps/api/src/server.ts:1210-1218`).
  - Playwright: Headless Chromium engine readiness.
  - Maestro CLI: Availability of CLI executable.
  - Android ADB: Daemon status and list of attached device serial numbers / emulators.
  - Server Time: Current time in Asia/Jakarta (WIB) with full timestamp.

---

### View 12: `live` (Live Viewport Stream)
- **File:** `apps/web/src/live-viewport.tsx` (Lines 1–215), `apps/web/src/main.tsx:5121-5145`
- **Purpose:** Real-time visual monitoring of active test executions.
- **Stream Sources:**
  - Web: Polling `/api/v1/runs/:id/preview` returning base64 JPEG screenshots captured during active Playwright sessions.
  - Android: Polling `/api/v1/android/screen` returning live framebuffer PNG screencaps from connected device/emulator.

---

### View 13: `projects` (Project Switcher)
- **File:** `apps/web/src/project-switcher.tsx` (Lines 1–185)
- **Purpose:** Multi-tenant project switcher dropdown and catalog drawer.
- **Displayed Data:** List of active jobs, project slug, commit hash/branch, run label, created timestamp.
- **Actions:** Selecting an item updates `activeJobId` in `localStorage` and hydrates active job cache.

---

## 3. UI COMPONENT PROP & EVENT CONTRACTS

| Component | File Path | Props / Inputs | Output Events / Callbacks | Core State Dependencies |
|---|---|---|---|---|
| `Wizard` | `apps/web/src/wizard.tsx` | `system`, `initialJob`, `onCancelEdit` | `onCreated(job: Job)` | `config: Config`, `step: number`, `feProbeResult`, `beProbeResult`, `apkInfo` |
| `LiveViewport` | `apps/web/src/live-viewport.tsx` | `job: Job`, `onClose` | `onClose()` | Polling interval (1,500ms), image buffer state |
| `BusinessFlowVisualizer` | `apps/web/src/business-flow-visualizer.tsx` | `businessFlowMap: BusinessFlowMap`, `jobId: string` | `onApprove(flowIds)`, `onUpdate(flowId, patch)` | Flow selection, step expansion |
| `GeminiModal` | `apps/web/src/gemini-modal.tsx` | `isOpen`, `onClose`, `activeJob` | `onFlowGenerated(flow)` | `prompt`, `platform`, `generating`, `diagnosing` |
| `ProjectSwitcher` | `apps/web/src/project-switcher.tsx` | `jobs: Job[]`, `activeJobId`, `onSelect` | `onSelect(jobId)` | Search query, dropdown open/closed |
| `MilestoneFlow` | `apps/web/src/main.tsx:176` | `nodes`, `progress`, `centralStatus`, `isLive` | `onSelect(node)`, `onNavigate(view)` | Selected milestone ID |
| `MilestoneDetails` | `apps/web/src/main.tsx:245` | `node`, `activeJob`, `evidence` | `onClose()`, `onNavigate()`, `onOpenEvidenceGroup()` | Drawer open/closed |
| `EvidenceInspector` | `apps/web/src/main.tsx:304` | `focus`, `evidence` | `onClose()`, `onOpenAsset(asset)` | Focused asset and group ID |
