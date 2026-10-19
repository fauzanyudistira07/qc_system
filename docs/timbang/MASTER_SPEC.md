# TIMBANG / QC MAESTRO — MASTER SYSTEM SPECIFICATION

> **Document Type:** Grounded Implementation Specification & Source of Truth  
> **Target Audience:** Software Architects, QA Engineers, Product Designers, AI Refinement Agents (e.g., Figma Make)  
> **Extraction Date:** 2026-10-19  
> **Audit Status:** VERIFIED against local working tree (branch `main`, commit HEAD)  
> **Security Clearance:** Sanitized — No secrets, credentials, or sensitive customer data included.

---

## 1. PRODUCT & TECHNICAL OVERVIEW

### 1.1 Product Mission
**Timbang** (internal codebase moniker: `qc-maestro` / `qc_system`) is an automated Software Quality Assurance (QA) and Software Quality Control (QC) orchestration platform. It operates locally or on private server infrastructure to discover, model, plan, execute, audit, and document web and mobile applications under test without mutating production assets.

### 1.2 Core Capabilities
1. **Tri-Mode Target Intake & Discovery:**
   - **Existing Target:** Connects directly via HTTP/HTTPS URL (`apps/web/src/wizard.tsx:37-41`, `apps/api/src/server.ts:1479-1484`).
   - **Local Working Folder:** Mounts/copies a local project path into a sandboxed execution runtime (`apps/api/src/project-runner.ts:31-50`, `apps/api/src/discovery/discovery-service.ts:1509-1511`).
   - **Git / GitHub Repository:** Clones repository branch/commit into temporary container sandbox workspace (`apps/api/src/project-runner.ts:52-85`, `apps/api/src/server.ts:1493-1496`).
2. **Polyglot Runtime Auto-Detection:** Automatically detects ecosystems (Laravel/PHP 8.0-8.3, Node.js 18-22, Python/Django, Go) and provisions container runtimes (`apps/api/src/runtimes/detector.ts:66-130`).
3. **Multi-Platform Test Execution:**
   - **Web (Playwright):** Browser automation in Chromium, Firefox, WebKit with video recording, traces, and full-page screenshots (`apps/api/src/playwright-adapter.ts:1-120`).
   - **Mobile Android (Maestro + ADB):** Native and hybrid Android UI execution, APK inspection (`aapt`), headless emulator management, and live screen streaming (`apps/api/src/android/index.ts:1-120`, `apps/api/src/maestro-adapter.ts:1-48`).
4. **Autonomous Domain Modeling & Business Flow Map:**
   - Static AST / Regex Source Scanner (`apps/api/src/discovery/source-scanner.ts`).
   - Safe GET UI Crawler (`apps/api/src/discovery/ui-crawler.ts`).
   - 27-point Capability Catalog (`apps/api/src/discovery/capability-model.ts:90-120`).
   - CRUD & Role Planners (`apps/api/src/discovery/crud-planner.ts`, `apps/api/src/discovery/role-planner.ts`).
   - Feature Contract & Scenario Matrix (`apps/api/src/discovery/feature-contract.ts`).
   - Human Review Gate (`apps/api/src/discovery/business-flow.ts:80-101`, `apps/web/src/business-flow-visualizer.tsx`).
5. **Quality Audit & Verification Engine:**
   - Heuristic accessibility audit (WCAG contrast, ARIA landmarks, focus indicators).
   - Responsive layout & typography audit (text truncation, clipping, line-height, dense data overflow).
   - Pixel-by-pixel visual regression against baseline snapshots.
   - Form boundary, password autocomplete, safe GET contract, and network failure recovery tests (`docs/QUALITY_AUDIT_RULES.md:5-15`).
6. **AI Orchestration & Intelligence:**
   - Google Gemini REST API v1beta integration for prompt-based scenario synthesis and root-cause failure diagnosis (`apps/api/src/gemini-service.ts:32-150`).
7. **Evidence & Cloud Archival:**
   - HTTP 206 Partial Content video streaming (`apps/api/src/server.ts:1850-1912`).
   - Nextcloud WebDAV multi-file upload and zip archival (`apps/api/src/nextcloud-service.ts:48-120`).

---

## 2. TECHNOLOGY STACK & APPLICATION ENTRY POINTS

| Component | Technology | Version | Location | Primary Entry Point |
|---|---|---|---|---|
| **Root Workspace** | npm / pnpm workspaces | — | `/` | `package.json:5-8` |
| **API Server** | Fastify, TypeScript, Node.js | Fastify 5.2.1, TS 5.7.3, tsx 4.19.2 | `apps/api` | `apps/api/src/server.ts:1-97` |
| **Web Frontend** | React, Vite, Tailwind CSS | React 19.0.0, Vite 6.0.5, Tailwind 4.3.3 | `apps/web` | `apps/web/src/main.tsx:1-20`, `index.html` |
| **Flow Schema** | Zod, YAML parser | Zod 3.24.2, YAML 2.7.0 | `packages/flow-schema` | `packages/flow-schema/src/index.ts:1-25` |
| **Test Engine (Web)** | Playwright | 1.49.1 | `apps/api` | `apps/api/src/playwright-adapter.ts:1-15` |
| **Test Engine (Mobile)** | Maestro CLI & Android ADB | External CLI / ADB | `apps/api/src/android` | `apps/api/src/android/index.ts:1-20` |
| **Mock Target App** | Express / Node.js | — | `apps/demo-app` | `apps/demo-app/server.js:1-20` |
| **Mock Fixture App** | Express / Node.js | — | `apps/unique-demo` | `apps/unique-demo/server.js:1-20` |
| **Infrastructure** | Docker Compose, PostgreSQL, Redis, MinIO | PG 16, Redis 7 | `/` | `docker-compose.yml:1-86` |

---

## 3. ARCHITECTURE & COMPONENT TOPOLOGY

```
                    ┌────────────────────────────────────────┐
                    │               CLIENT WEB               │
                    │         React 19 + Vite 6 + Tailwind 4 │
                    │          (Port 4180 / Dev 5173)        │
                    └───────────────────┬────────────────────┘
                                        │ HTTP / SSE / REST
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FASTIFY API SERVER (:4100)                            │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Auth Guard Hook: Token Verification (QC_ADMIN_ENABLED) (auth.ts)            │ │
│ └──────────────────────────────────────┬──────────────────────────────────────┘ │
│                                        │                                        │
│     ┌──────────────────────────────────┼──────────────────────────────────┐     │
│     ▼                                  ▼                                  ▼     │
│ ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐  │
│ │   DiscoveryService   │   │   PlaywrightEngine   │   │    Android/Maestro   │  │
│ │ - SourceScanner      │   │ - WebFlow Execution  │   │ - ADB Device Bridge  │  │
│ │ - UICrawler          │   │ - Live Preview       │   │ - Headless Emulator  │  │
│ │ - CapabilityModel    │   │ - Video Policy ffmpeg│   │ - aapt APK Inspector │  │
│ │ - BusinessFlowMapper │   │ - Quality Audit      │   │ - Maestro Compiler   │  │
│ └──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘  │
│            │                          │                          │              │
│            ▼                          ▼                          ▼              │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │                         PERSISTENCE & ARTIFACT BUS                          │ │
│ │ - Local JSON DB: .qc-artifacts/discovery-jobs.json, qc-state.json           │ │
│ │ - Media Storage: .qc-artifacts/jobs/<id>/{screenshots,videos,reports}       │ │
│ │ - Postgres / Redis / MinIO: Infrastructure adapters (001_multi_user.sql)    │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬───────────────────────────────┬─────────────────────┘
                            │                               │
                            ▼                               ▼
              ┌───────────────────────────┐   ┌───────────────────────────┐
              │     Google Gemini API     │   │     Nextcloud WebDAV      │
              │  REST v1beta (gemini.ts)  │   │  Media Storage Service    │
              └───────────────────────────┘   └───────────────────────────┘
```

---

## 4. MODULE INVENTORY

### 4.1 Module: Core API & Server Dispatcher
- **Primary Source:** `apps/api/src/server.ts`
- **Purpose:** Entry point for HTTP routing, request parsing, authentication enforcement, artifact streaming, and process orchestration.
- **Key State Mechanisms:** In-memory `runs` Map, in-memory `events` Map for Server-Sent Events (SSE), atomic file snapshotting to `.qc-artifacts/qc-state.json` via temporary write and rename (`apps/api/src/server.ts:844-851`).
- **Security Control:** Global `onRequest` hook enforcing Bearer token verification if `QC_ADMIN_ENABLED !== 'false'` (`apps/api/src/server.ts:115-157`).
- **Dependencies:** `@qc/flow-schema`, `playwright`, `fastify`, `dotenv`, `yaml`, `zod`.

### 4.2 Module: Discovery Engine & Autonomous Modeling
- **Primary Source:** `apps/api/src/discovery/discovery-service.ts`
- **Sub-components:**
  - `source-scanner.ts`: Heuristic multi-language parser extracting routes and interactive DOM markers (`pages`, `routes`, `api`).
  - `ui-crawler.ts`: Playwright headless browser crawler visiting discovered public and authenticated pages, avoiding destructive routes (`delete`, `destroy`, `logout`).
  - `capability-model.ts`: Detection of 27 functional patterns from static and dynamic observations.
  - `crud-planner.ts`: Construction of CRUD resource plans (List, Detail, Create, Update, Delete Guard).
  - `role-planner.ts`: Construction of Role-Action expectation matrices.
  - `feature-contract.ts`: 6-scenario feature contracts (happy, negative, boundary, permission, recovery, integrity).
  - `business-flow.ts`: End-to-end user journeys requiring human approval before test execution.
  - `impact-analyzer.ts`: Commit-level file diff analysis mapping changed controllers/models/views to impacted routes and flows.
- **Persistence:** `.qc-artifacts/discovery-jobs.json` and `.qc-artifacts/jobs/<jobId>/`.

### 4.3 Module: Flow Schema & Canonical Compiler
- **Primary Source:** `packages/flow-schema/src/index.ts`
- **Purpose:** Defines the platform-agnostic QC Flow specification.
- **Supported Platforms:** `web`, `android`.
- **Supported Actions:** `open`, `launchApp`, `click`, `input`, `clear`, `back`, `scroll`, `waitFor`, `assertVisible`, `assertNotVisible`, `assertText`, `assertUrl`, `screenshot`, `reload` (`packages/flow-schema/src/index.ts:5-9`).
- **Locator Strategies:** `text`, `id`, `testId`, `css`, `role`, `label`, `placeholder`, `accessibilityId` (`packages/flow-schema/src/index.ts:11-22`).
- **Compilers:**
  - `playwright-generator.ts`: Compiles normalized flow into executable TypeScript Playwright test script (`.spec.ts`).
  - `maestro-adapter.ts`: Compiles normalized flow into Maestro YAML test suite.

### 4.4 Module: Web Test Adapter & Media Normalization
- **Primary Source:** `apps/api/src/playwright-adapter.ts`
- **Purpose:** Headless browser runner for web flows with live preview snapshots and video encoding.
- **Video Policy:** Handled via `apps/api/src/video-policy.ts`. Raw Playwright webm files are normalized via ffmpeg (25 FPS, standard profile) to prevent browser HTML5 media decode failures.
- **Live Preview:** Base64 JPEG capture at 70% quality with disabled animations for zero-latency dashboard streaming (`apps/api/src/playwright-adapter.ts:76-91`).

### 4.5 Module: Android Test Adapter & Device Management
- **Primary Source:** `apps/api/src/android/index.ts`, `adb.ts`, `emulator-runner.ts`
- **Purpose:** Interfaces with local ADB and Maestro CLI.
- **Features:** AVD discovery, headless emulator booting (`emulator -no-window -no-audio`), APK badging parsing via `aapt dump badging`, APK installation with `--user 0 -r -g` and `INSTALL_FAILED_UPDATE_INCOMPATIBLE` auto-recovery, and live device screen capture via ADB framebuffer screencap.

### 4.6 Module: Web Application Dashboard (SPA)
- **Primary Source:** `apps/web/src/main.tsx`, `wizard.tsx`, `ui.tsx`, `api.ts`, `types.ts`
- **Views (13 distinct views):**
  1. `overview`: Execution milestone topology, status cards, and live health metrics.
  2. `new`: Multi-step intake wizard (Target & Backend, Akun & Data Uji, Review & Jalankan).
  3. `projects`: Project directory and switcher.
  4. `discovery`: Live terminal logs and automated scanning progress.
  5. `map`: Visual interactive application map and discovered routes.
  6. `flows`: Business flow review, scenario management, YAML flow editor, Playwright/Maestro compilation preview.
  7. `runs`: Execution history, step-by-step progress, duration breakdown, and status codes.
  8. `findings`: Defect registry categorized into 6 domains (critical, functional, content, visual, contrast, accessibility).
  9. `reports`: Printable/exportable HTML and PDF audit report with error categorization.
  10. `evidence`: Media center featuring video streaming with HTTP 206 range requests, screenshot galleries, and Nextcloud backup.
  11. `settings`: Hardware capability telemetry (Docker daemon, Playwright Chromium, Maestro CLI, ADB devices).
  12. `live`: Real-time browser and mobile emulator viewport streaming.
  13. `login`: Admin authentication gate (`apps/web/src/login.tsx`).

---

## 5. MAIN USER JOURNEYS & END-TO-END TRACES

### Journey 1: Project Onboarding & Discovery Intake
```
[User on Wizard Step 0] 
  │ Selects Platform (Web / Android) & Input Mode (Existing Target / Local Folder / GitHub)
  ▼
[Input URL / Repo / Local Path] 
  │ Hits "Periksa Koneksi"
  ▼
[POST /api/v1/system/probe-target] 
  │ API performs network fetch with 3500ms timeout
  ▼
[Wizard Step 1: Accounts & Data]
  │ Adds Test Credentials & Database Seed / Migration Upload
  ▼
[Wizard Step 2: Review & Submit]
  │ Clicks "Mulai QC Run"
  ▼
[POST /api/v1/discovery/jobs]
  │ Validates payload, initializes Job directory in .qc-artifacts/jobs/<id>
  │ Dispatches async discovery pipeline (Source Scan -> UI Crawl -> Capability Model)
  ▼
[UI automatically navigates to 'discovery' View]
  │ Subscribes to terminal logs & phase updates
```

### Journey 2: Business Flow Review & Execution Gate
```
[Discovery reaches WAITING_REVIEW phase]
  │ Capability Model and Feature Contracts generate candidate Business Flows
  ▼
[User navigates to 'flows' View]
  │ Views generated flows, actors, preconditions, and steps
  ▼
[User approves flows via UI]
  │ Calls PUT /api/v1/discovery/jobs/:id/business-flows/:flowId or /approve
  ▼
[POST /api/v1/discovery/jobs/:id/run]
  │ Unblocks test runner; compiles flows to Playwright / Maestro
  ▼
[Execution Pipeline Starts]
  │ Launches Browser / Emulator
  │ Emits SSE events & captures live preview frames
  │ Records full-flow video & per-step screenshots
  ▼
[Execution completes]
  │ Assembles HTML/JSON/PDF report
  │ Computes metrics, pass rates, and defect findings
```

---

## 6. INVARIANTS & CHANGE BOUNDARIES SUMMARY

The application behavior is strictly guarded by the following boundary classes:
- **PROTECTED (Invariable):**
  - Canonical Flow YAML schema (`@qc/flow-schema`).
  - Auth token lifecycle and cryptographic HMAC signature validation (`apps/api/src/auth.ts:43-60`).
  - Read-only audit policy: no destructive HTTP methods against targets unless explicitly configured in sandboxed fixture mode (`docs/QUALITY_AUDIT_RULES.md:3`).
  - Artifact path containment: strict directory traversal guards preventing access outside `.qc-artifacts/` (`apps/api/src/server.ts:1915-1921`, `1965-1975`).
  - Secret sanitization: automatic masking of passwords, keys, and tokens in logs and reports (`apps/api/src/server.ts:821-828`).
- **CONDITIONALLY MODIFIABLE (UX Refinement Zone):**
  - Layout arrangement, grid alignment, typography styles, color themes (Light/Dark/Brutalist/Linear), responsive breakpoints.
  - Component visual presentation (cards, badges, modals, drawers, tabs) as long as input properties, state bindings, and event handlers remain identical.
- **RESTRICTED (Requires Approval & Schema Migration):**
  - Fastify endpoint routes, HTTP method verbs, and JSON payload contracts.
  - Discovery job state machine transitions (`QUEUED` -> `RUNNING` -> `WAITING_REVIEW` -> `COMPLETED` / `FAILED`).
  - Quality Audit evaluation algorithms and defect classification schemas.

---

## 7. DOCUMENTATION SUITE DIRECTORY

The detailed specifications extracted from the active codebase are organized as follows:
- **[MASTER_SPEC.md](file:///home/fauzan/projek/qc_maestro/docs/timbang/MASTER_SPEC.md):** Complete architectural and operational master specification.
- **[ROUTE_AND_SCREEN_MAP.md](file:///home/fauzan/projek/qc_maestro/docs/timbang/ROUTE_AND_SCREEN_MAP.md):** Exhaustive map of web UI views, routing guards, parameters, states, and dependencies.
- **[BUSINESS_LOGIC.md](file:///home/fauzan/projek/qc_maestro/docs/timbang/BUSINESS_LOGIC.md):** Domain logic, state transitions, validation rules, discovery algorithms, and flow compilation rules.
- **[API_AND_DATA_CONTRACTS.md](file:///home/fauzan/projek/qc_maestro/docs/timbang/API_AND_DATA_CONTRACTS.md):** Verified Fastify API endpoints, request/response JSON schemas, database models, and external services.
- **[UX_CHANGE_BOUNDARIES.md](file:///home/fauzan/projek/qc_maestro/docs/timbang/UX_CHANGE_BOUNDARIES.md):** Invariants register (INV-001 to INV-015) and UX change contract for design tools (Figma Make).
- **[EVIDENCE_AND_GAPS.md](file:///home/fauzan/projek/qc_maestro/docs/timbang/EVIDENCE_AND_GAPS.md):** Audit trail, confidence ratings, verified symbols, implementation contradictions, and limitations.
- **[REGRESSION_CHECKLIST.md](file:///home/fauzan/projek/qc_maestro/docs/timbang/REGRESSION_CHECKLIST.md):** Step-by-step verification protocol to validate behavioral preservation after UI refinement.
