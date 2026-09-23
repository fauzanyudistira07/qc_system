import http from 'node:http';

const html = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo App</title><style>body{font-family:system-ui;max-width:420px;margin:80px auto;padding:20px}label{display:grid;gap:6px;margin:14px 0}input{padding:10px;border:1px solid #ccd2df;border-radius:6px}button{padding:10px 14px;background:#5c52e8;color:white;border:0;border-radius:6px;cursor:pointer}.error{color:#b42318;margin:12px 0}.card{padding:24px;border:1px solid #e1e5ed;border-radius:10px}</style></head><body>${body}</body></html>`;

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/' && request.method === 'GET') {
    response.writeHead(302, { location: '/login' });
    response.end();
    return;
  }
  if (url.pathname === '/login' && request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html('<div class="card"><h1>Login</h1><form method="post" action="/login"><label>Email<input data-testid="email" name="email" type="email"></label><label>Password<input data-testid="password" name="password" type="password"></label><button data-testid="login-button" type="submit">Login</button></form></div>'));
    return;
  }
  if (url.pathname === '/login' && request.method === 'POST') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const form = new URLSearchParams(body);
      if (form.get('email') === 'admin@example.com' && form.get('password') === 'admin123') { response.writeHead(302, { location: '/dashboard' }); response.end(); }
      else { response.writeHead(401, { 'content-type': 'text/html; charset=utf-8' }); response.end(html('<div class="card"><h1>Login</h1><p class="error">Invalid credentials</p><a href="/login">Try again</a></div>')); }
    });
    return;
  }
  if (url.pathname === '/dashboard') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(html('<div class="card"><h1>Dashboard</h1><p>Welcome, admin.</p><a data-testid="logout-button" href="/login">Logout</a></div>')); return; }
  response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Not found');
});

server.listen(4173, '0.0.0.0', () => console.log('Demo app running at http://localhost:4173/login'));
