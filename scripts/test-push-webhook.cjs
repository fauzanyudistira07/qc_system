const http = require('http');

const payload = JSON.stringify({
  repository: {
    name: 'zannora-laravel',
    clone_url: 'https://github.com/fauzanyudistira07/zannora.git'
  },
  ref: 'refs/heads/main',
  head_commit: {
    id: 'f7c8b2a1987d6543210e' + Date.now().toString(16),
    message: 'fix: optimize flight seating algorithm and pricing rules',
    author: { name: 'Fauzan Yudistira', email: 'fauzan@example.com' },
    added: [],
    modified: ['app/Http/Controllers/AdminFlightController.php'],
    removed: []
  }
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 4100,
  path: '/api/v1/webhooks/github',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-GitHub-Event': 'push',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', data));
});

req.on('error', err => console.error('ERR:', err.message));
req.write(payload);
req.end();
