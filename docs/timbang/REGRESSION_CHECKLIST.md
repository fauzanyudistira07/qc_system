# TIMBANG — BEHAVIOR PRESERVATION & REGRESSION CHECKLIST

> **Purpose:** Step-by-step verification protocol to be executed before and after any UX/UI refinement (e.g., Figma Make implementations, frontend restyling, component refactoring) to guarantee zero regression of underlying system functionality.

---

## 1. PRE-CHANGE VERIFICATION (BASELINE CHECK)

Before introducing any UI or layout changes, execute and record results for these baseline checks:

### 1.1 TypeScript Type Checking
- [ ] Run root type check:
  ```bash
  npm run check
  ```
- **Observed Baseline Expectation:** Both `apps/api` and `apps/web` compile with zero TypeScript diagnostic errors.

### 1.2 Web Application Production Build
- [ ] Run web build:
  ```bash
  npm run build
  ```
- **Observed Baseline Expectation:** Vite generates bundled assets into `apps/web/dist` (`index.html`, `assets/*.js`, `assets/*.css`) without bundling errors.

### 1.3 Flow Schema Validation Smoke
- [ ] Run flow schema CLI validator on example flow:
  ```bash
  npm run validate:example
  ```
- **Observed Baseline Expectation:** CLI prints validation output confirming valid normalized flow structure (`valid: true`).

---

## 2. POST-CHANGE BEHAVIORAL EQUIVALENCE CHECKLIST

Execute this protocol after UI refinements to ensure all behavioral invariants remain intact.

---

### Phase A: Authentication & Session Gate (INV-001)
- [ ] **A.1 Unauthenticated Redirection:**
  - Clear `localStorage` keys (`qc_admin_token`, `qc_admin_user`).
  - Open `http://localhost:5173/`.
  - **Pass Criteria:** `AdminLoginView` is rendered; dashboard views (`overview`, `map`, `flows`, etc.) are hidden.
- [ ] **A.2 Valid Login:**
  - Submit configured admin credentials.
  - **Pass Criteria:** `POST /api/v1/auth/login` returns HTTP 200 with JWT/HMAC token; dashboard navigates to `'overview'`.
- [ ] **A.3 Session Hydration:**
  - Refresh the browser (`F5`).
  - **Pass Criteria:** Session remains authenticated without re-prompting login.

---

### Phase B: Routing & Navigation State (INV-012)
- [ ] **B.1 Tab Navigation:**
  - Click through all primary sidebar navigation items:
    1. Project Summary (`overview`)
    2. Live Terminal (`discovery`)
    3. App Map (`map`)
    4. Skenario Test (`flows`)
    5. Execution Runs (`runs`)
    6. Media (`evidence`)
    7. Final Report (`reports`)
    8. New QC Run (`new`)
  - **Pass Criteria:** Each button highlights as `.active`; corresponding view renders without console errors.
- [ ] **B.2 URL Path & Refresh Preservation:**
  - Navigate to `/map` and refresh the browser.
  - **Pass Criteria:** Application re-hydrates into App Map view (`currentView === 'map'`).
- [ ] **B.3 Legacy Route Guard:**
  - Navigate to `/process`.
  - **Pass Criteria:** Automatically redirects to `/overview`.

---

### Phase C: Target Intake & Probe (INV-009)
- [ ] **C.1 Reachability Probe:**
  - In Wizard Step 0, input `http://localhost:4173` (or demo app) and click "Periksa Koneksi".
  - **Pass Criteria:** Spinner displays during probe; returns green badge showing HTTP status and latency in ms (`apps/api/src/server.ts:1270-1277`).
- [ ] **C.2 Tri-Mode Toggle:**
  - Switch between `Existing target`, `Folder kerja lokal`, and `GitHub`.
  - **Pass Criteria:** Input fields dynamically change; local path vs repository inputs update `config.sourceType`.

---

### Phase D: Business Flow Review Gate (INV-005)
- [ ] **D.1 Review Gate Halt:**
  - Run discovery with `businessFlowReview.mode = 'required'`.
  - **Pass Criteria:** Runner enters `WAITING_REVIEW`; execution of test flows does not start automatically.
- [ ] **D.2 Approval Action:**
  - Navigate to `flows` view and click "Setujui Semua Flow".
  - **Pass Criteria:** `POST /api/v1/discovery/jobs/:id/business-flows/approve` succeeds; runner unblocks and transitions to `EXECUTING_TESTS`.

---

### Phase E: Media Evidence & Video Streaming (INV-008)
- [ ] **E.1 Video Playback:**
  - Navigate to `evidence` view.
  - Select a test run recording in the Stage Viewer.
  - **Pass Criteria:** HTML5 video plays smoothly; seeking forward/backward triggers HTTP 206 Partial Content range requests without freezing.
- [ ] **E.2 Media Downloads:**
  - Click "Download ZIP".
  - **Pass Criteria:** Browser downloads `.zip` archive containing grouped screenshots and videos.

---

### Phase F: Defect Status Management (INV-010)
- [ ] **F.1 Status Workflow Patch:**
  - Navigate to `findings` view.
  - Change a finding status from `OPEN` to `IN_PROGRESS` or `READY_FOR_RETEST`.
  - **Pass Criteria:** `PATCH /api/v1/discovery/jobs/:id/findings/status` returns HTTP 200; status badge updates immediately.

---

### Phase G: CI Regression Gate Verification (INV-015)
- [ ] **G.1 Gate Script Execution:**
  - Run the regression gate script against the latest quality report:
    ```bash
    npm run qc:gate
    ```
  - **Pass Criteria:** Script prints summary and exits with code 0 if findings are within budget, or code 1 if budget is exceeded (`scripts/qc-regression-gate.cjs:56-61`).

---

## 3. SUMMARY SIGN-OFF TEMPLATE

```
===================================================================
QC MAESTRO / TIMBANG — UX REFINEMENT REGRESSION SIGN-OFF
===================================================================
Refinement Scope: _________________________________________________
Engineer / Agent: _________________________________________________
Date / Time WIB:  _________________________________________________

[ ] 1. Typecheck & Build Passed (npm run check && npm run build)
[ ] 2. Authentication & Guard Intact (INV-001)
[ ] 3. Navigation & Local Storage Keys Preserved (INV-012)
[ ] 4. Target Intake & Probe Verified (INV-009)
[ ] 5. Business Flow Gate Unbroken (INV-005)
[ ] 6. Video Streaming Range Requests Verified (INV-008)
[ ] 7. Secret Redaction Intact (INV-002)
[ ] 8. CI Regression Gate Evaluated (INV-015)

Status: [ ] APPROVED FOR SHIPMENT   [ ] BLOCKED (Fix Regressions)
===================================================================
```
