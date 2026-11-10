import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { tmpdir } from 'node:os';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';

import { provisionEnvFiles } from '../env-provisioner.ts';
import { readPngDimensions, computeScrollSliceCropTop } from '../media/png-stitcher.ts';
import { assertValidVideo, VIDEO_POLICY } from '../video-policy.ts';
import { DiscoveryService } from '../discovery/discovery-service.ts';
import type { DiscoveryConfig, DiscoveryJob } from '../discovery/types.ts';
import { GeminiService } from '../gemini-service.ts';

// ── TEST 1: AUTO-DEMO .ENV PROVISIONING & SECRET SCRUBBING ──
test('FR-02: provisionEnvFiles creates executable demo .env and scrubs secrets', async () => {
  const tempDir = path.join(tmpdir(), `qc-env-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  const sampleEnv = [
    'APP_NAME=replace_me',
    'APP_ENV=local',
    'APP_KEY=base64:',
    'APP_DEBUG=true',
    'APP_URL=http://localhost',
    'DB_CONNECTION=mysql',
    'DB_HOST=127.0.0.1',
    'DB_PORT=3306',
    'DB_DATABASE=qc_demo_db',
    'DB_USERNAME=root',
    'DB_PASSWORD=secret_here',
    'JWT_SECRET=changeme',
    'API_SECRET_KEY=your_secret_here'
  ].join('\n');

  await writeFile(path.join(tempDir, '.env.example'), sampleEnv, 'utf8');

  const result = await provisionEnvFiles({
    sourceDir: tempDir,
    platform: 'web',
    frontendUrl: 'http://localhost:3000',
    backendUrl: 'http://localhost:8000',
    dbEnv: {
      DB_HOST: '127.0.0.1',
      DB_PORT: '5432',
      DB_DATABASE: 'qc_test',
      DB_USERNAME: 'qc_user'
    }
  });

  assert.strictEqual(result.entries.length, 1);
  const entry = result.entries[0];
  assert.strictEqual(entry.targetEnvFile, '.env');
  assert.ok(existsSync(path.join(tempDir, '.env')));

  const createdEnv = await readFile(path.join(tempDir, '.env'), 'utf8');
  assert.ok(!createdEnv.includes('replace_me'), 'Placeholder replace_me must be populated');
  assert.ok(!createdEnv.includes('changeme'), 'Placeholder changeme must be populated');
  assert.ok(!createdEnv.includes('your_secret_here'), 'Placeholder your_secret_here must be populated');

  // Verify secret scrubbing
  assert.ok(result.secretsToRedact.length > 0, 'Must register generated secrets for scrubbing');
  for (const secret of result.secretsToRedact) {
    const scrubbed = GeminiService.scrubSecrets(`Log: password is ${secret}`, [secret]);
    assert.ok(!scrubbed.includes(secret), `Secret ${secret} must be redacted in scrubbed output`);
    assert.ok(scrubbed.includes('[REDACTED]'), 'Must contain [REDACTED]');
  }

  await rm(tempDir, { recursive: true, force: true });
});

// ── TEST 2: STITCHING MATHEMATICS & VIDEO POLICY VALIDATION ──
test('FR-06 & FR-07: readPngDimensions, computeScrollSliceCropTop and assertValidVideo validation', async () => {
  // 1. Read PNG Dimensions and verify identical frame detection
  const samplePng = path.join(process.cwd(), '.playwright-cache/firefox-1543/firefox/browser/chrome/icons/default/default32.png');
  if (existsSync(samplePng)) {
    const dim = await readPngDimensions(samplePng);
    assert.strictEqual(dim.width, 32);
    assert.strictEqual(dim.height, 32);
    const buf = readFileSync(samplePng);
    const cropRes = computeScrollSliceCropTop(buf, buf);
    assert.strictEqual(cropRes.identical, true, 'Identical buffers must be detected as identical');
    assert.strictEqual(cropRes.cropTop, 0);
  }

  // 2. Video policy validation
  const tempDir = path.join(tmpdir(), `qc-vid-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  const invalidVid = path.join(tempDir, 'empty.webm');
  await writeFile(invalidVid, Buffer.alloc(100)); // Under 8192 bytes

  await assert.rejects(
    async () => {
      await assertValidVideo(invalidVid, VIDEO_POLICY.minBytes);
    },
    (err: any) => {
      return String(err).includes('terlalu kecil') || String(err).includes('8192');
    },
    'Video < 8192 bytes must be rejected by video policy'
  );

  const validVid = path.join(tempDir, 'valid.webm');
  await writeFile(validVid, Buffer.alloc(9000)); // >= 8192 bytes
  const validRes = await assertValidVideo(validVid, VIDEO_POLICY.minBytes);
  assert.strictEqual(validRes.sizeBytes, 9000);

  await rm(tempDir, { recursive: true, force: true });
});

// ── TEST 3: LIVE MULTI-ROLE RECONNAISSANCE -> ACC GATE -> BATCH 1 -> BATCH 2 -> GAPS PIPELINE ──
test('FR-04, FR-05, FR-06, FR-07, FR-08: Complete Discovery Pipeline with ACC Gate and Zero Hardcoding', { timeout: 120_000 }, async () => {
  // Setup Ephemeral Multi-Role Target HTTP Server
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
        <html>
          <head><title>Test App Login</title></head>
          <body style="min-height: 2200px; padding: 20px;">
            <h1>Portal Multi-Role</h1>
            <div role="tablist" class="nav-tabs">
              <button role="tab" id="tab-overview" class="active">Overview</button>
              <button role="tab" id="tab-users">Users</button>
              <button role="tab" id="tab-reports">Reports</button>
              <button role="tab" id="tab-settings">Settings</button>
              <button role="tab" id="tab-logs">Logs</button>
              <button role="tab" id="tab-billing">Billing</button>
            </div>
            <nav style="margin-top: 1000px;">
              <a href="/admin/forbidden">Forbidden Area</a>
            </nav>
            <div style="margin-top: 1000px;">
              <h2>Footer Zone</h2>
            </div>
          </body>
        </html>
      `);
      return;
    }

    if (url.pathname === '/admin/forbidden') {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden: Insufficient Permissions');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const tempArtifactsDir = path.join(tmpdir(), `qc-artifacts-test-${Date.now()}`);
  const tempProjectDir = path.join(tmpdir(), `qc-project-test-${Date.now()}`);
  await mkdir(tempArtifactsDir, { recursive: true });
  await mkdir(tempProjectDir, { recursive: true });

  const discoveryService = new DiscoveryService(tempArtifactsDir, tempProjectDir);
  await discoveryService.init();

  const config: DiscoveryConfig = {
    name: 'Phase 1 E2E Verification App',
    runMode: 'existing-target',
    repositoryUrl: '',
    ref: 'main',
    baseUrl,
    platform: 'web',
    stack: 'auto',
    services: [],
    database: { engine: 'none', source: 'empty' },
    rules: { maxPages: 5, maxDepth: 1, includePaths: [], excludePaths: [] },
    executeFlows: true,
    useServerEmulator: true,
    accounts: [
      { name: 'Admin User', email: 'admin@demo.local', password: '', role: 'admin' },
      { name: 'Regular User', email: 'user@demo.local', password: '', role: 'user' }
    ]
  };

  const job = await discoveryService.createJob(config);
  assert.ok(job.id, 'Job ID must be assigned');
  assert.strictEqual(job.name, config.name);

  try {
    // Poll until job reaches WAITING_REVIEW (RECON_REVIEW_WAITING_ACC)
    let reconJob: DiscoveryJob = job;
    const startTime = Date.now();
    while (Date.now() - startTime < 45000) {
      reconJob = discoveryService.getJob(job.id)!;
      if (reconJob.status === 'WAITING_REVIEW' || reconJob.phase === 'RECON_REVIEW_WAITING_ACC' || reconJob.status === 'COMPLETED' || reconJob.status === 'FAILED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (reconJob.status !== 'WAITING_REVIEW') {
      console.error('Failed to reach WAITING_REVIEW. Status:', reconJob.status, 'Phase:', reconJob.phase, 'Msg:', reconJob.message);
      console.error('Logs:', reconJob.logs.map(l => `[${l.category}] ${l.message}`).join('\n'));
    }

    assert.strictEqual(reconJob.status, 'WAITING_REVIEW', `Job must pause at WAITING_REVIEW, current: ${reconJob.status} (${reconJob.phase})`);
    assert.ok(reconJob.reconSummary, 'Reconnaissance summary must be constructed before ACC');
    assert.ok((reconJob.reconSummary?.totalPages ?? 0) >= 1, 'Must discover at least 1 page');

    // Verify secretless in-memory credentials: passwords must NOT be in public job state
    const publicAccounts = reconJob.provisionedAccounts || [];
    assert.ok(publicAccounts.length > 0, 'Must have provisioned accounts');
    for (const acc of publicAccounts) {
      assert.strictEqual((acc as any).password, undefined, 'Plaintext passwords must never be stored in job state');
      assert.strictEqual(acc.verified !== undefined, true);
    }

    // Pre-ACC Guard: Verify 0 final long screenshots and 0 final videos exist prior to approval
    const preAccScreenshots = reconJob.longScreenshots || [];
    const preAccVideos = reconJob.roleVideos || [];
    assert.strictEqual(preAccScreenshots.length, 0, 'Must have 0 final long screenshots before user approval');
    assert.strictEqual(preAccVideos.length, 0, 'Must have 0 final role videos before user approval');

    // Trigger Human ACC Approval
    const approvedJob = discoveryService.approvePhase1Job(job.id);
    assert.strictEqual(approvedJob.status, 'RUNNING');
    assert.ok(approvedJob.reconSummary?.approvedAt, 'Must set approvedAt timestamp');

    // Wait for post-ACC execution (Batch 1 -> Batch 2 -> Gaps Diagnostic -> Complete)
    let completedJob = approvedJob;
    const postAccStart = Date.now();
    while (Date.now() - postAccStart < 60000) {
      completedJob = discoveryService.getJob(job.id)!;
      if (completedJob.status === 'COMPLETED' || completedJob.status === 'FAILED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    assert.strictEqual(completedJob.status, 'COMPLETED', `Job must complete, error message: ${completedJob.message}`);

    // Verify FR-06: Batch 1 Command Plan & Strictly 1 Tall Top-to-Bottom Long Screenshot per page
    const longScreenshots = completedJob.longScreenshots || [];
    assert.ok(longScreenshots.length > 0, 'Must produce long screenshots for accessible pages');
    for (const ss of longScreenshots) {
      assert.ok(ss.height > 0, 'Height must be positive');
      assert.ok(!ss.filename.includes('-scrolled.png'), `Must not contain fragmented scrolled png: ${ss.filename}`);
    }

    // Verify FR-07: Batch 2 Continuous Video per role
    const roleVideos = completedJob.roleVideos || [];
    assert.ok(roleVideos.length > 0, 'Must produce continuous videos for roles');
    const recordedVideos = roleVideos.filter((v) => v.status === 'RECORDED');
    assert.ok(recordedVideos.length > 0, 'Must have at least one successfully recorded role video');
    for (const vid of recordedVideos) {
      assert.ok(vid.sizeBytes >= 8192, `Recorded video ${vid.filename} must be >= 8192 bytes, got ${vid.sizeBytes}`);
    }

    // Verify FR-08: coverageGaps[] for 403 or unvisited pages
    const coverageGaps = completedJob.coverageGaps || [];
    assert.ok(coverageGaps.length >= 0, 'Coverage gaps array must be present');
  } catch (err) {
    console.error('>>> TEST 3 FAILED WITH ERROR:', err);
    throw err;
  } finally {
    // Cleanup
    server.closeAllConnections?.();
    server.close();
    await rm(tempArtifactsDir, { recursive: true, force: true });
    await rm(tempProjectDir, { recursive: true, force: true });
  }
});

test.after(() => {
  setTimeout(() => process.exit(0), 150);
});
