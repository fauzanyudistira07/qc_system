const http = require('http');

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
      res.on('end', () => resolve(JSON.parse(data).token));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const token = await login();
  http.get({
    hostname: '127.0.0.1',
    port: 4100,
    path: '/api/v1/discovery/jobs/56ced0cb-f236-4a3a-a89e-2a298db4e392',
    headers: { Authorization: `Bearer ${token}` }
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(data);
      const j = parsed.job || parsed;
      console.log('ID:', j.id);
      console.log('NAME:', j.name);
      console.log('REPO URL:', j.config?.repositoryUrl);
      console.log('REF:', j.config?.ref);
      console.log('LOCAL PATH:', j.config?.localPath);
      console.log('FRONTEND REPO:', j.config?.frontendTarget?.repositoryUrl);
      console.log('BACKEND REPO:', j.config?.backendTarget?.repositoryUrl);
    });
  });
}

run().catch(console.error);
