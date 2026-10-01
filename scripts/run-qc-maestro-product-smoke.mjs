const baseUrl = process.env.QC_UNIQUE_BASE_URL || 'http://127.0.0.1:4180';
const checks = [];
function check(name, passed, detail) { checks.push({ name, passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'}\t${name}\t${detail}`); }
async function request(path, options = {}, jar = {}) {
  const headers = new Headers(options.headers || {});
  if (jar.cookie) headers.set('cookie', jar.cookie);
  const response = await fetch(baseUrl + path, { redirect: 'manual', ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) jar.cookie = setCookie.split(';')[0];
  return response;
}
async function login(email, password) {
  const jar = {};
  const response = await request('/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) }, jar);
  check(`login ${email}`, response.status === 302 && response.headers.get('location') === '/workspace', `HTTP ${response.status}`);
  return jar;
}
const home = await request('/');
check('QC Maestro landing', home.status === 200 && (await home.text()).includes('QC Maestro'), `HTTP ${home.status}`);
const badLogin = await request('/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'unknown@qcmaestro.local', password: 'bad' }) });
check('invalid login rejected', badLogin.status === 302 && badLogin.headers.get('location')?.includes('error=1'), `HTTP ${badLogin.status}`);
const qa = await login('qa@qcmaestro.local', 'qa12345');
const admin = await login('admin@qcmaestro.local', 'admin12345');
const developer = await login('dev@qcmaestro.local', 'dev12345');
const dashboard = await request('/workspace', {}, qa);
check('QC dashboard', dashboard.status === 200 && (await dashboard.text()).includes('QC dashboard'), `HTTP ${dashboard.status}`);
const projectList = await request('/projects?q=northstar', {}, qa);
check('project search', projectList.status === 200 && (await projectList.text()).includes('Northstar Shop'), `HTTP ${projectList.status}`);

const created = await request('/discovery', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ title: 'Smoke Checkout QC', sourceType: 'existing-target', source: 'local ports', frontend: '5173', backend: '8000', scope: 'Checkout, auth, report' }) }, qa);
const runId = created.headers.get('location')?.match(/\/runs\/([^?]+)/)?.[1];
check('submit QC discovery form', created.status === 302 && Boolean(runId), `HTTP ${created.status} run=${runId || '-'}`);
const flowPage = await request(`/flows/${runId}`, {}, qa);
check('business flow review page', flowPage.status === 200 && (await flowPage.text()).includes('Review sebelum eksekusi'), `HTTP ${flowPage.status}`);
const editFlow = await request(`/flows/${runId}/business-flow-review`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ title: 'Business flow review · edited', summary: 'Updated by the submitting QA user.', action_0: 'Review checkout journey', route_0: '/checkout', expected_0: 'Order confirmation and inventory state are consistent', action_1: 'Review approval', route_1: '/flows', expected_1: 'Only submitting user may approve' }) }, qa);
check('edit business flow', editFlow.status === 302, `HTTP ${editFlow.status}`);
const adminApproval = await request(`/runs/${runId}/approve`, { method: 'POST' }, admin);
check('admin cannot approve user submission', adminApproval.status === 403, `HTTP ${adminApproval.status}`);
const developerApproval = await request(`/runs/${runId}/approve`, { method: 'POST' }, developer);
check('developer cannot approve another submission', developerApproval.status === 403, `HTTP ${developerApproval.status}`);
const qaApproval = await request(`/runs/${runId}/approve`, { method: 'POST' }, qa);
check('submitter approves flow', qaApproval.status === 302, `HTTP ${qaApproval.status}`);
const approvedRun = await (await request(`/api/runs/${runId}`, {}, qa)).json();
check('approval starts execution', approvedRun.status === 'RUNNING' && approvedRun.businessFlows.every((flow) => flow.status === 'APPROVED'), `status=${approvedRun.status}`);

const projectResult = await request('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Fixture Cleanup Project', sourceType: 'existing-target', frontend: 'http://127.0.0.1:5500' }) }, qa);
const project = await projectResult.json();
check('create QC project', projectResult.status === 201 && project.sourceType === 'existing-target', `HTTP ${projectResult.status}`);
const updatedProject = await request(`/api/projects/${project.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backend: 'http://127.0.0.1:8500' }) }, qa);
check('update QC project config', updatedProject.status === 200 && (await updatedProject.json()).backend === 'http://127.0.0.1:8500', `HTTP ${updatedProject.status}`);
const deletedProject = await request(`/api/projects/${project.id}`, { method: 'DELETE' }, qa);
check('delete unused QC project', deletedProject.status === 204, `HTTP ${deletedProject.status}`);

const upload = await request('/api/upload', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-file-name': 'qc-evidence.txt' }, body: 'QC Maestro evidence fixture' }, qa);
check('upload evidence fixture', upload.status === 201 && (await upload.json()).name === 'qc-evidence.txt', `HTTP ${upload.status}`);
const report = await request(`/downloads/qc-maestro-report.txt?run=${runId}`, {}, admin);
check('admin can download QC report', report.status === 200 && (await report.text()).includes('QC MAESTRO WEB QUALITY REPORT'), `HTTP ${report.status}`);
const firstRetry = await request('/api/sync?unstable=1', {}, qa);
const secondRetry = await request('/api/sync?unstable=1', {}, qa);
check('target retry recovery', firstRetry.status === 503 && secondRetry.status === 200, `first=${firstRetry.status} second=${secondRetry.status}`);

const passed = checks.filter((item) => item.passed).length;
console.log(JSON.stringify({ baseUrl, total: checks.length, passed, failed: checks.length - passed, checks }, null, 2));
if (passed !== checks.length) process.exitCode = 1;
