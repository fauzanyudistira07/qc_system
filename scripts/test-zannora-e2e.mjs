import { setTimeout as sleep } from 'node:timers/promises';

const BASE_URL = 'http://127.0.0.1:4100';

async function main() {
  console.log('1. Logging in to QC Maestro Admin API...');
  const authRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@qcmaestro.com', password: 'admin12345' }),
  });
  const authData = await authRes.json();
  const token = authData.token;
  if (!token) throw new Error('Failed to get token: ' + JSON.stringify(authData));
  console.log('   Authenticated successfully.');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('\n2. Creating a clean Zannora QC Job from 0...');
  const createRes = await fetch(`${BASE_URL}/api/v1/discovery/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Zannora Clean E2E Test',
      sourceType: 'existing-target',
      runMode: 'existing-target',
      platform: 'web',
      baseUrl: 'http://127.0.0.1:8000',
      backendUrl: 'http://127.0.0.1:8000',
      accounts: [
        { name: 'Admin Zannora', email: 'admin@zannora.com', password: 'password', role: 'admin' },
      ],
      rules: {
        maxPages: 50,
        maxDepth: 5,
        includePaths: [],
        excludePaths: ['/logout', '/delete'],
        loginPath: '/login',
        emailSelector: "input[name='email']",
        passwordSelector: "input[name='password']",
        submitSelector: "button[type='submit']",
        successUrl: '/admin/dashboard',
      },
      executeFlows: true,
      businessFlowReview: { mode: 'required' },
      qualityAudit: { enabled: false },
    }),
  });

  const job = await createRes.json();
  if (!job.id) throw new Error('Failed to create job: ' + JSON.stringify(job));
  console.log(`   Job created: ID = ${job.id}`);

  console.log('\n3. Polling discovery progress until WAITING_REVIEW or COMPLETED...');
  let currentJob = job;
  const startTime = Date.now();
  let approved = false;

  while (Date.now() - startTime < 360000) {
    await sleep(2000);
    const pollRes = await fetch(`${BASE_URL}/api/v1/discovery/jobs/${job.id}`, { headers });
    currentJob = await pollRes.json();
    console.log(`   [Status: ${currentJob.status} | Phase: ${currentJob.phase} | Progress: ${currentJob.progress}%] ${currentJob.message || ''}`);

    if (currentJob.status === 'WAITING_REVIEW' && !approved) {
      console.log('\n   >>> Reached Review Gate! Auto-approving all business flows now...');
      const approveRes = await fetch(`${BASE_URL}/api/v1/discovery/jobs/${job.id}/business-flows/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const approveData = await approveRes.json();
      console.log('   >>> Approved! Response status:', approveData.status);
      approved = true;
    }

    if (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED') {
      break;
    }
  }

  console.log('\n4. Final Run Results:');
  console.log('   Status:', currentJob.status);
  console.log('   Results Count:', currentJob.results?.length ?? 0);
  const passed = (currentJob.results || []).filter(r => r.status === 'PASSED').length;
  const failed = (currentJob.results || []).filter(r => r.status !== 'PASSED').length;
  console.log(`   Passed: ${passed} | Failed: ${failed}`);

  for (const [i, res] of (currentJob.results || []).slice(0, 10).entries()) {
    console.log(`   - Flow ${i + 1} (${res.flowId}): ${res.status} (${res.steps?.length || 0} steps)`);
  }
}

main().catch(console.error);
