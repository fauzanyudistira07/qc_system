const fs = require('fs');

async function main() {
  const activeMeta = JSON.parse(fs.readFileSync('E:/projek/qc_maestro/.active-qc-job.json', 'utf8'));
  const jobId = activeMeta.jobId;

  const loginRes = await fetch('http://127.0.0.1:4100/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@qcmaestro.com', password: 'admin12345' })
  });
  const { token } = await loginRes.json();

  const pollRes = await fetch(`http://127.0.0.1:4100/api/v1/discovery/jobs/${jobId}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const job = await pollRes.json();

  console.log(`\n========================================`);
  console.log(`Job Name : ${job.name}`);
  console.log(`Job ID   : ${job.id}`);
  console.log(`Status   : ${job.status}`);
  console.log(`Phase    : ${job.phase}`);
  console.log(`Progress : ${job.progress}%`);
  console.log(`Flows    : ${job.flows?.length || 0} flows`);
  if (job.flows?.length) {
    job.flows.forEach((f, i) => {
      console.log(`  [${i + 1}] ${f.name} -> ${f.status}`);
    });
  }
  console.log(`Results  : ${job.results?.length || 0} completed runs`);
  console.log(`Latest Logs:`);
  if (job.logs) {
    job.logs.slice(-6).forEach(l => {
      console.log(`  [${l.category}] ${l.message}`);
    });
  }
  console.log(`========================================\n`);
}

main().catch(err => {
  console.error('Check error:', err.message);
});
