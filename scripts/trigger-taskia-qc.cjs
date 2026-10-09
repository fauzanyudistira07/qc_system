const fs = require('fs');

async function main() {
  console.log('1. Logging in to QC Maestro API...');
  const loginRes = await fetch('http://127.0.0.1:4100/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@qcmaestro.com', password: 'admin12345' })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  console.log('✅ Logged in successfully.');

  const payload = {
    name: 'Taskia Digital',
    sourceType: 'local-folder',
    repositoryUrl: '',
    ref: 'main',
    baseUrl: 'http://127.0.0.1:8001',
    backendUrl: 'http://127.0.0.1:8001',
    backendMode: 'local',
    runMode: 'existing-target',
    stack: 'laravel',
    services: [],
    database: { engine: 'none', source: 'empty' },
    accounts: [
      { name: 'Ahmad Siswa Test (Siswa)', email: '202601', password: '123456', role: 'user' },
      { name: 'Guru Tasdig', email: 'guru@tasdig.com', password: '123456', role: 'admin' }
    ],
    rules: {
      maxPages: 40,
      maxDepth: 4,
      includePaths: [],
      excludePaths: ['/logout', '/delete'],
      loginPath: '/login',
      emailSelector: "input[name='email'], #email, input[type='email']",
      passwordSelector: "input[type='password'], #password",
      submitSelector: "button[type='submit'], .btn-primary",
      successUrl: '/dashboard'
    },
    platform: 'android',
    deviceId: 'emulator-5554',
    executeFlows: true,
    businessFlowReview: { mode: 'auto' },
    qualityAudit: { enabled: false },
    apkUploadId: 'ee4b81c5-a822-49ad-95ed-535f7e794244',
    apkFilename: 'app-release.apk',
    apkPackageId: 'com.taskia.digital',
    appId: 'com.taskia.digital',
    localPath: 'C:\\Users\\admin\\Documents\\PKL- SOLU\\taskia_digital\\tasdig_dashboard'
  };

  console.log('2. Creating new Discovery Job for Taskia Digital...');
  const createRes = await fetch('http://127.0.0.1:4100/api/v1/discovery/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(payload)
  });

  const job = await createRes.json();
  if (createRes.status !== 201) {
    throw new Error(`Failed to create job (${createRes.status}): ` + JSON.stringify(job));
  }

  console.log(`✅ Job created successfully!`);
  console.log(`   ID: ${job.id}`);
  console.log(`   Status: ${job.status}`);
  console.log(`   Phase: ${job.phase}`);

  // Save the active job ID for reference
  fs.writeFileSync('E:/projek/qc_maestro/.active-qc-job.json', JSON.stringify({
    jobId: job.id,
    startedAt: new Date().toISOString()
  }, null, 2));

  // Poll for 6 seconds to verify execution starts
  console.log('3. Waiting for execution startup...');
  await new Promise(r => setTimeout(r, 6000));

  const pollRes = await fetch(`http://127.0.0.1:4100/api/v1/discovery/jobs/${job.id}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const current = await pollRes.json();
  console.log(`\n--- Current Job Status ---`);
  console.log(`Status   : ${current.status}`);
  console.log(`Phase    : ${current.phase}`);
  console.log(`Progress : ${current.progress}%`);
  console.log(`Logs (${current.logs?.length || 0}):`);
  if (current.logs) {
    current.logs.slice(-8).forEach(l => {
      console.log(`  [${l.category}] ${l.message}`);
    });
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
