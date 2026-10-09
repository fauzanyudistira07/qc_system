const http = require('http');

const roomId = process.argv[2] || 'c61cb264-56d4-4be4-a253-4dd23fe7c996';

function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ email: 'admin@qcmaestro.com', password: 'admin12345' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4100,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function checkJob() {
  const token = await login();
  http.get({
    hostname: '127.0.0.1',
    port: 4100,
    path: `/api/v1/discovery/jobs/${roomId}`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const job = parsed.job || parsed;
        console.log('--- JOB STATUS ---');
        console.log('ID:', job.id);
        console.log('NAME:', job.name);
        console.log('KIND:', job.kind);
        console.log('STATUS:', job.status);
        console.log('PHASE:', job.phase);
        console.log('PROGRESS:', job.progress, '%');
        console.log('MESSAGE:', job.message);
        console.log('TOTAL FLOWS:', (job.flows || []).length);
        console.log('TOTAL RESULTS:', (job.results || []).length);
        if (job.results && job.results.length > 0) {
          console.log('\n--- FLOW RESULTS ---');
          job.results.forEach(r => {
            console.log(` - [${r.status}] ${r.flowName} (${r.durationMs}ms)`);
          });
        }
        if (job.impactReport) {
          console.log('\n--- IMPACT REPORT ---');
          console.log(JSON.stringify(job.impactReport, null, 2));
        }
      } catch (e) {
        console.error('Parse error:', e.message, data.slice(0, 200));
      }
    });
  }).on('error', err => console.error('Request error:', err.message));
}

checkJob().catch(console.error);
