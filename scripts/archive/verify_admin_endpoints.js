const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- Testing Admin Login & Pages ---');
  // 1. Login Admin
  const adminLogin = await request({
    hostname: '127.0.0.1',
    port: 4180,
    path: '/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, 'email=admin@qcmaestro.local&password=admin12345');

  const cookie = (adminLogin.headers['set-cookie'] || [])[0]?.split(';')[0];
  console.log('Admin login status:', adminLogin.status, 'Cookie:', cookie);

  const adminRoutes = ['/admin', '/admin/projects', '/admin/flows', '/admin/runs', '/admin/reports', '/monitor'];
  for (const route of adminRoutes) {
    const res = await request({
      hostname: '127.0.0.1',
      port: 4180,
      path: route,
      method: 'GET',
      headers: { 'Cookie': cookie }
    });
    const hasDashboard = res.body.includes('QC Maestro');
    console.log(`GET ${route} -> status ${res.status}, length ${res.body.length}, ok: ${hasDashboard}`);
  }

  console.log('\n--- Testing User Login & Pages ---');
  const userLogin = await request({
    hostname: '127.0.0.1',
    port: 4180,
    path: '/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, 'email=user@qcmaestro.local&password=user12345');

  const userCookie = (userLogin.headers['set-cookie'] || [])[0]?.split(';')[0];
  console.log('User login status:', userLogin.status, 'Cookie:', userCookie);

  const userRoutes = ['/projects', '/new', '/monitor', '/reports'];
  for (const route of userRoutes) {
    const res = await request({
      hostname: '127.0.0.1',
      port: 4180,
      path: route,
      method: 'GET',
      headers: { 'Cookie': userCookie }
    });
    const hasUserRole = !res.body.includes('KONTROL ADMINISTRATOR');
    console.log(`GET ${route} -> status ${res.status}, isUserCleanNav: ${hasUserRole}`);
  }
}

run().catch(console.error);
