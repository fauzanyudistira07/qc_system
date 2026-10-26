const jobId = process.argv[2] || '07721a96-7c89-48d8-8788-81108e136b53';
const category = process.argv[3] || 'system';
const message = process.argv.slice(4).join(' ');

if (!message) {
  process.exit(0);
}

const token = 'eyJlbWFpbCI6ImFkbWluQHFjbWFlc3Ryby5jb20iLCJuYW1lIjoiUUMgTWFzdGVyIEFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyNTUzNjc3fQ.3b2L61lYzKsq__Glvbqrwff9hOsNiAzzng30ZXCOwpM';

fetch(`http://127.0.0.1:4100/api/v1/discovery/jobs/${jobId}/logs`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ category, message })
}).catch(console.error);
