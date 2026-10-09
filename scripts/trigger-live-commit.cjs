const http = require('http');

const payload = JSON.stringify({
  repository: {
    name: 'zannora',
    full_name: 'fauzanyudistira07/zannora',
    clone_url: 'https://github.com/fauzanyudistira07/zannora.git'
  },
  ref: 'refs/heads/master',
  head_commit: {
    id: '044cc45a71c868c6e1d387208591b508346b3ed2',
    message: 'fix(airports): standardize IATA code to uppercase on store and update',
    author: {
      name: 'fauzanyudistira07',
      email: 'fauzanyudistira07@gmail.com'
    },
    added: [],
    modified: ['app/Http/Controllers/Web/Admin/AdminAirportController.php'],
    removed: []
  }
});

console.log('[Trigger] Mengirim push event asli commit #044cc45 ke webhook QC Maestro...');

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
  res.on('end', () => {
    console.log('HTTP STATUS:', res.statusCode);
    console.log('RESPONSE:', data);
    try {
      const resJson = JSON.parse(data);
      if (resJson.roomId) {
        console.log('\n>>> Dedicated Room ID:', resJson.roomId);
        console.log('>>> Room Name:', resJson.roomName);
        console.log('>>> Impact Summary:', resJson.impact?.summary);
      }
    } catch (e) {}
  });
});

req.on('error', err => console.error('[Trigger Error]:', err.message));
req.write(payload);
req.end();
