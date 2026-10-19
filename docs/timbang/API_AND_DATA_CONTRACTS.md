# TIMBANG — API & DATA CONTRACTS SPECIFICATION

> **Specification Standard:** Implementation-Grounded API, Schema, & Persistence Specification  
> **Source Files Verified:**  
> - `apps/api/src/server.ts` (2,092 lines)  
> - `apps/api/src/auth.ts` (75 lines)  
> - `apps/api/src/discovery/types.ts` (134 lines)  
> - `apps/api/src/gemini-service.ts` (326 lines)  
> - `apps/api/src/nextcloud-service.ts` (437 lines)  
> - `packages/flow-schema/src/index.ts` (166 lines)  
> - `infrastructure/postgres/001_multi_user_report_store.sql` (99 lines)

---

## 1. AUTHENTICATION & SECURITY HEADERS

### 1.1 Authentication Enforcement Hook
- **Implementation:** Fastify `onRequest` hook (`apps/api/src/server.ts:115-157`).
- **Condition:** Active whenever `isAuthEnabled()` is true (`QC_ADMIN_ENABLED !== 'false'`).
- **Whitelisted Public Routes (No token required):**
  - `/health`
  - `/` (Web SPA index)
  - `/assets/*` (Web SPA static assets)
  - `/api/v1/auth/login`
  - `/api/v1/auth/config`
  - `/api/v1/system/probe-target`
  - `/api/v1/webhooks/*` (e.g., GitHub commit webhook)
  - `/api/v1/nextcloud/*`
  - `/api/v1/media/download-zip`
  - Any URL containing `/artifacts/` or ending with `/report` (supports query parameter `?token=...`).
- **Protected Routes:** All other `/api/*` endpoints strictly require an Authorization header or token query:
  - Header: `Authorization: Bearer <HMAC-SHA256 Token>`
  - Query parameter fallback: `?token=<HMAC-SHA256 Token>`
- **Error Response on Missing / Expired Token:**
  ```json
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json; charset=utf-8

  {
    "error": "Unauthorized: Sesi admin tidak valid atau telah berakhir. Silakan login kembali.",
    "code": "AUTH_REQUIRED"
  }
  ```

### 1.2 Cryptographic Token Specification (`apps/api/src/auth.ts:35-74`)
- **Format:** Two-part dot-separated string `<base64url(payload)>.<base64url(hmacSignature)>`.
- **Payload Schema:**
  ```typescript
  {
    email: string;
    name: string;
    role: 'admin';
    exp: number; // Unix timestamp in seconds (default: +48 hours)
  }
  ```
- **Signing Algorithm:** `HMAC-SHA256` using `QC_ADMIN_SECRET`. Verification utilizes `crypto.timingSafeEqual` to prevent side-channel timing attacks (`apps/api/src/auth.ts:59`).

---

## 2. EXHAUSTIVE REST API ENDPOINT CATALOG

### 2.1 System & Diagnostic Endpoints

#### `GET /health`
- **Auth:** Public
- **Response:** `200 OK`
  ```json
  {
    "status": "ok",
    "service": "qc-api",
    "timestamp": "2026-10-19T01:30:00.000Z",
    "timezone": "Asia/Jakarta (WIB)",
    "timeWIB": "Senin, 19 Oktober 2026 08.30.00 WIB"
  }
  ```

#### `GET /api/v1/system/status`
- **Auth:** Protected
- **Query Params:** `force?: string` (forces fresh ADB/Maestro check)
- **Response:** `200 OK`
  ```json
  {
    "serverTime": "Senin, 19 Oktober 2026 08.30.00 WIB (WIB)",
    "timezone": "Asia/Jakarta (WIB / UTC+7)",
    "timestamp": "2026-10-19T01:30:00.000Z",
    "docker": { "available": true, "message": "Docker daemon aktif dan siap." },
    "playwright": { "available": true, "message": "Playwright headless chromium runtime siap." },
    "maestro": { "available": true, "message": "Maestro CLI terdeteksi." },
    "adb": { "available": true, "message": "ADB siap.", "devices": ["emulator-5554"] }
  }
  ```

#### `POST /api/v1/system/probe-target`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "url": "http://localhost:5174",
    "timeoutMs": 3500
  }
  ```
- **Validation:** Enforces HTTP/HTTPS protocol, strips embedded credentials. Timeout clamped between 1,000ms and 10,000ms (`apps/api/src/server.ts:1257`).
- **Response:** `200 OK`
  ```json
  {
    "reachable": true,
    "url": "http://localhost:5174/",
    "statusCode": 200,
    "statusText": "OK",
    "responseTimeMs": 142,
    "message": "Target aktif & merespons (HTTP 200 dalam 142ms)"
  }
  ```

---

### 2.2 Authentication & Profile Endpoints

#### `GET /api/v1/auth/config`
- **Auth:** Public
- **Response:** `200 OK` `{ "enabled": true }`

#### `POST /api/v1/auth/login`
- **Auth:** Public
- **Request Body:** `{ "email": "admin@qcmaestro.com", "password": "password" }`
- **Response:** `200 OK` `{ "success": true, "token": "...", "user": { "email": "...", "name": "...", "role": "admin" } }` or `401 Unauthorized`.

#### `GET /api/v1/auth/me`
- **Auth:** Protected
- **Response:** `200 OK` `{ "success": true, "user": { "email": "...", "name": "...", "role": "admin" } }`

---

### 2.3 Discovery Jobs Endpoints

#### `GET /api/v1/discovery/jobs`
- **Auth:** Protected
- **Response:** `200 OK` Array of `DiscoveryJob` objects, sorted newest first (`createdAt DESC`).

#### `POST /api/v1/discovery/jobs`
- **Auth:** Protected
- **Request Body (`DiscoveryConfig`):**
  ```typescript
  {
    name: string;                         // Required
    sourceType?: 'existing-target' | 'local-folder' | 'github';
    localPath?: string;                   // Required if sourceType === 'local-folder'
    repositoryUrl?: string;               // Required if sourceType === 'github'
    ref?: string;                         // Default 'main'
    baseUrl: string;                      // Required
    backendUrl?: string;
    runMode: 'managed-local' | 'existing-target' | 'demo';
    stack: 'auto' | 'custom' | 'laravel';
    services: ManagedService[];
    database: {
      engine: 'none' | 'mysql' | 'postgres' | 'sqlite';
      source: 'empty' | 'sql' | 'migrate' | 'seed';
      sqlUploadId?: string;
    };
    accounts: Array<{ name?: string; email: string; password: string; role?: string }>;
    rules: {
      maxPages: number;
      maxDepth: number;
      includePaths: string[];
      excludePaths: string[];
      loginPath?: string;
      emailSelector?: string;
      passwordSelector?: string;
      submitSelector?: string;
      successUrl?: string;
    };
    platform: 'web' | 'android';
    appId?: string;
    deviceId?: string;
    executeFlows: boolean;
    businessFlowReview?: { mode: 'required' | 'auto' };
    qualityAudit?: QualityAuditConfig;
  }
  ```
- **Response:** `201 Created` returns initialized `DiscoveryJob`.

#### `GET /api/v1/discovery/jobs/:id`
- **Auth:** Protected
- **Response:** `200 OK` `DiscoveryJob` or `404 Not Found`.

#### `PUT /api/v1/discovery/jobs/:id`
- **Auth:** Protected
- **Request Body:** `DiscoveryConfig & { restart?: boolean }`
- **Response:** `200 OK` updated `DiscoveryJob`.

#### `POST /api/v1/discovery/jobs/:id/restart`
- **Auth:** Protected
- **Response:** `200 OK` re-initialized `DiscoveryJob`.

#### `POST /api/v1/discovery/jobs/:id/cancel`
- **Auth:** Protected
- **Response:** `200 OK` `{ "status": "CANCELLED" }`.

#### `DELETE /api/v1/discovery/jobs/:id`
- **Auth:** Protected
- **Response:** `200 OK` `{ "success": true }`.

#### `POST /api/v1/discovery/jobs/:id/business-flows/approve`
- **Auth:** Protected
- **Request Body:** `{ "flowIds"?: string[] }` (omitting flowIds approves all flows)
- **Response:** `200 OK` `DiscoveryJob` with approved flows and unblocked execution gate.

#### `PUT /api/v1/discovery/jobs/:id/business-flows/:flowId`
- **Auth:** Protected
- **Request Body:** `Partial<BusinessFlow>`
- **Response:** `200 OK` `DiscoveryJob`.

#### `POST /api/v1/discovery/jobs/:id/run`
- **Auth:** Protected
- **Request Body:** `{ "flowIds"?: string[], "password"?: string }`
- **Response:** `200 OK` `DiscoveryJob` with runner triggered.

#### `GET /api/v1/discovery/jobs/:id/inventory`
- **Auth:** Protected
- **Response:** `200 OK` `Inventory` JSON structure.

#### `GET /api/v1/discovery/jobs/:id/report`
- **Auth:** Public / Token query param
- **Query Params:**
  - `format`: `'html'` (default), `'json'`, or `'pdf'`.
  - `attempt`: `'latest'` (default), `'all'`, or attempt ID.
  - `status`: `'all'`, `'PASSED'`, `'FAILED'`.
  - `download`: `'true'` sets `Content-Disposition: attachment`.
- **Response:**
  - If `html`: `Content-Type: text/html; charset=utf-8`.
  - If `json`: `Content-Type: application/json; charset=utf-8`.
  - If `pdf`: `Content-Type: application/pdf`.

#### `GET /api/v1/discovery/jobs/:id/artifacts/*`
- **Auth:** Public / Token query param
- **Features:** Supports HTTP 206 Partial Content range requests (`Accept-Ranges: bytes`) for smooth HTML5 video scrubbing and seek (`apps/api/src/server.ts:1850-1922`).
- **Security Guard:** Path normalization disallows directory traversal outside `.qc-artifacts/jobs/<id>` (`apps/api/src/server.ts:1918-1920`).

---

### 2.4 AI Scenario Generation & Diagnosis Endpoints

#### `GET /api/v1/generation/status`
- **Auth:** Protected
- **Response:** `200 OK`
  ```json
  {
    "enabled": true,
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "keyMasked": "AIza...9xQ2",
    "status": "configured"
  }
  ```

#### `POST /api/v1/generation/jobs`
- **Auth:** Protected
- **Request Body:**
  ```json
  {
    "prompt": "Uji proses checkout tiket pesawat dari memilih kursi hingga pembayaran",
    "platform": "web",
    "baseUrl": "http://localhost:5174"
  }
  ```
- **Response:** `200 OK` `{ "id": "...", "status": "COMPLETED", "provider": "gemini", "flow": { ... } }`

#### `POST /api/v1/ai/diagnose`
- **Auth:** Protected
- **Request Body:**
  ```json
  {
    "flowName": "Booking Flow",
    "stepName": "step-004",
    "error": "Locator timeout: element button:has-text('Bayar') not visible within 30000ms",
    "logs": ["..."],
    "pageUrl": "http://localhost:5174/checkout"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "rootCause": "Tombol bayar dinonaktifkan karena checkbox persetujuan syarat & ketentuan belum dicentang.",
    "recommendation": "Tambahkan langkah interaksi centang pada checkbox syarat & ketentuan sebelum menekan tombol bayar.",
    "severity": "high",
    "actionableSteps": [
      "Periksa apakah selector checkbox #terms-agreement visible",
      "Tambahkan step click pada #terms-agreement sebelum click tombol bayar"
    ]
  }
  ```

---

### 2.5 Cloud Storage & Nextcloud Integration Endpoints

#### `GET /api/v1/nextcloud/config`
- **Auth:** Protected
- **Response:** `200 OK` `{ "configured": true, "url": "https://158.140.181.43:8443", "username": "fauzan_cmms", "baseFolder": "CMM Service/Timbang Image and Video" }`

#### `POST /api/v1/nextcloud/upload-media`
- **Auth:** Protected
- **Request Body:**
  ```json
  {
    "folderName": "QC Zannora Web E2E",
    "jobId": "fd7d9a1e-8711-4709-a0b0-3e0b45adb56d",
    "items": [
      {
        "url": "/api/v1/discovery/jobs/fd7d9a1e.../artifacts/screenshots/dashboard.png",
        "featureName": "Dashboard",
        "type": "photo",
        "fileName": "dashboard.png"
      }
    ]
  }
  ```
- **Response:** `200 OK` `UploadBatchResult` detailing uploaded file count, remote WebDAV paths, and Nextcloud web URL (`apps/api/src/nextcloud-service.ts:31-46`).

#### `POST /api/v1/media/download-zip`
- **Auth:** Public / Token query param
- **Request Body:** `{ "projectName": "...", "items": [...], "jobId": "..." }`
- **Response:** `200 OK` streaming binary `application/zip` archive containing grouped media evidence.

---

### 2.6 GitHub Webhook Integration Endpoint

#### `POST /api/v1/webhooks/github`
- **Auth:** Public
- **Headers:** `X-GitHub-Event: push` or `ping`
- **Purpose:** Automatically triggers commit-level impact analysis and spawns an incremental test room for affected modules (`apps/api/src/server.ts:1718-1773`).
- **Response:** `201 Created`
  ```json
  {
    "status": "accepted",
    "roomId": "room-commit-a8f3b92",
    "roomName": "Push Commit [a8f3b92] · Developer",
    "impact": {
      "impactedModules": ["AIRLINE", "ROUTING"],
      "impactedRoutes": ["/admin/airlines", "/admin/flights"],
      "totalFlowsTested": 3,
      "passed": 3,
      "failed": 0
    },
    "message": "Dedicated Room dibuat & pengujian terarah dimulai."
  }
  ```

---

## 3. DATA PERSISTENCE SCHEMAS

### 3.1 Local JSON Store (`.qc-artifacts/`)
1. `.qc-artifacts/discovery-jobs.json`: Primary active document array holding all `DiscoveryJob` objects. Serialized with indentation 2.
2. `.qc-artifacts/qc-state.json`: Debounced state backup for legacy `Run` objects with passwords and secrets scrubbed via `scrubPersistedText` (`apps/api/src/server.ts:830-851`).
3. `.qc-artifacts/jobs/<jobId>/`: Directory containing:
   - `application-inventory.json`: Discovered routes, pages, elements, capabilities.
   - `application-report.html`: Standalone self-contained HTML report.
   - `application-report.pdf`: Compiled PDF compliance report.
   - `full-flow.webm`: Re-encoded session video.
   - `screenshots/`: PNG step evidence captures.
   - `run-<index>/`: Per-scenario Playwright trace and artifacts.

### 3.2 PostgreSQL Multi-User Schema (`infrastructure/postgres/001_multi_user_report_store.sql`)

| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
|---|---|---|---|---|
| `qc_users` | `id` (uuid) | — | `email` (UNIQUE), `password_hash`, `role` | User and administrator credentials |
| `qc_projects` | `id` (uuid) | `owner_id -> qc_users.id` | `name`, `source_type`, `repository_url`, `source_path` | Project repository configurations |
| `qc_runs` | `id` (uuid) | `project_id -> qc_projects.id`, `owner_id -> qc_users.id` | `status`, `phase`, `config` (jsonb) | Test orchestration execution runs |
| `qc_business_flow_reviews` | `id` (uuid) | `run_id -> qc_runs.id`, `edited_by`, `approved_by` | `flow_id`, `version`, `definition` (jsonb), `status` | Human review gate audit trail |
| `qc_reports` | `id` (uuid) | `run_id -> qc_runs.id` | `kind` ('json', 'html', 'pdf', 'quality'), `payload`, `storage_key` | Persistent audit reports |
| `qc_evidence_assets` | `id` (uuid) | `run_id -> qc_runs.id` | `kind`, `storage_key`, `size_bytes`, `expires_at` | Media asset inventory and retention |
| `qc_artifact_policies` | `id` (boolean) | `updated_by -> qc_users.id` | `clone_days` (7), `artifact_days` (30), `max_active_projects` (2) | Central retention constraints |
| `qc_audit_events` | `id` (uuid) | `actor_id`, `project_id`, `run_id` | `action`, `metadata` (jsonb), `created_at` | Immutable compliance event audit log |
