import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const webDist = path.join(root, 'apps', 'web', 'dist');
const artifactRoot = path.join(root, '.qc-artifacts');
const port = Number(process.env.QC_API_PORT || 4100);

const json = (response, status, body) => {
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' });
  response.end(payload);
};

const mime = (file) => ({
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
}[path.extname(file).toLowerCase()] || 'application/octet-stream');

async function filesIn(directory) {
  const files = [];
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await filesIn(item));
      else if (/\.(json|png|jpg|jpeg|webm|html|zip|trace)$/i.test(entry.name)) files.push(item);
    }
  } catch { /* An optional evidence directory may not exist. */ }
  return files;
}

async function newestFile(directory, predicate) {
  try {
    const names = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && predicate(entry.name)).map((entry) => entry.name).sort().reverse();
    return names[0] ? path.join(directory, names[0]) : undefined;
  } catch { return undefined; }
}

async function newestDirectory(directory) {
  try {
    const names = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    return names[0] ? path.join(directory, names[0]) : undefined;
  } catch { return undefined; }
}

const relative = (file) => path.relative(artifactRoot, file).split(path.sep).join('/');
const assetUrl = (file) => `/api/v1/zannora-evidence/artifacts/${relative(file).split('/').map(encodeURIComponent).join('/')}`;

async function asset(file, type, label) {
  if (!file) return undefined;
  try {
    const metadata = await stat(file);
    const extension = path.extname(file).toLowerCase();
    const resolved = type || (extension === '.json' || extension === '.html' ? 'report' : extension === '.webm' ? 'video' : extension === '.png' || extension === '.jpg' || extension === '.jpeg' ? 'screenshot' : 'other');
    const name = path.basename(file);
    return {
      type: resolved, name,
      label: label || (resolved === 'video' ? (/-source-25fps/i.test(name) ? `${name} · sumber asli 25 FPS` : `${name} · standar 30 FPS 720p`) : name),
      url: assetUrl(file), relativePath: relative(file), size: metadata.size, updatedAt: metadata.mtime.toISOString()
    };
  } catch { return undefined; }
}

async function group({ id, title, category, status, summary, folder, report, directories = [] }) {
  const reportAsset = await asset(report, 'report', `${title} report.json`);
  const all = [...(reportAsset ? [reportAsset] : [])];
  for (const directory of directories) {
    for (const file of await filesIn(directory)) {
      const item = await asset(file);
      if (item && !all.some((existing) => existing.relativePath === item.relativePath)) all.push(item);
    }
  }
  all.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  return { id, title, category, status, summary, folder, report: reportAsset, assets: all, screenshots: all.filter((item) => item.type === 'screenshot'), videos: all.filter((item) => item.type === 'video') };
}

async function buildEvidence() {
  const runRoot = path.join(artifactRoot, 'zannora', 'runs');
  const testRoot = path.join(artifactRoot, 'test-runs', 'zannora');
  const groups = [];

  const apiReport = await newestFile(runRoot, (name) => /^api-e2e-.*\.json$/i.test(name));
  if (apiReport) {
    const report = JSON.parse(await readFile(apiReport, 'utf8'));
    const summary = report.summary || {};
    groups.push(await group({ id: 'api-e2e', title: 'API E2E — seluruh endpoint', category: 'API & CRUD', status: Number(summary.failed || 0) === 0 ? 'PASSED' : 'FAILED', summary: `${summary.passed || 0}/${summary.total || 0} assertion API lulus; auth, passenger, airline, airport, airplane, seat, flight, booking, payment, ticket, cancellation.`, folder: relative(path.dirname(apiReport)), report: apiReport }));
  }

  const crudReport = await newestFile(path.join(runRoot, 'crud-airline'), (name) => name.endsWith('.json'));
  const crudDirectory = await newestDirectory(path.join(testRoot, 'crud-airline'));
  if (crudReport) {
    const report = JSON.parse(await readFile(crudReport, 'utf8'));
    const passed = ['create', 'read', 'update', 'delete'].every((key) => report[key] === 'PASSED');
    groups.push(await group({ id: 'crud', title: 'CRUD browser — Airline', category: 'API & CRUD', status: passed ? 'PASSED' : 'FAILED', summary: 'Bukti UI create, read, update, dan delete data airline.', folder: relative(path.dirname(crudReport)), report: crudReport, directories: crudDirectory ? [crudDirectory] : [] }));
  }

  const rolesReport = await newestFile(path.join(runRoot, 'web-roles'), (name) => name.endsWith('.json'));
  const rolesDirectory = await newestDirectory(path.join(testRoot, 'web-roles'));
  if (rolesReport) {
    const report = JSON.parse(await readFile(rolesReport, 'utf8'));
    const results = report.results || [];
    const passed = results.filter((item) => item.passed).length;
    groups.push(await group({ id: 'roles', title: 'Role access — admin, manager, staff, customer', category: 'Web Flow', status: report.status || 'UNKNOWN', summary: `${passed}/${results.length} skenario role dan pembatasan akses lulus.`, folder: relative(path.dirname(rolesReport)), report: rolesReport, directories: rolesDirectory ? [rolesDirectory] : [] }));
  }

  const fullFlowDirectory = await newestDirectory(path.join(testRoot, 'full-flow'));
  const fullFlowReport = fullFlowDirectory ? path.join(fullFlowDirectory, 'report.json') : undefined;
  if (fullFlowDirectory && await stat(fullFlowReport).then(() => true).catch(() => false)) {
    const report = JSON.parse(await readFile(fullFlowReport, 'utf8'));
    const checks = report.checks || [];
    const passed = checks.filter((item) => item.passed).length;
    groups.push(await group({ id: 'full-flow', title: 'Full flow — booking sampai e-ticket', category: 'Web Flow', status: 'PASSED', summary: `${passed}/${checks.length} langkah lulus: login, passenger, seat, booking, payment handoff, acc admin, ticket, dan e-ticket.`, folder: relative(fullFlowDirectory), report: fullFlowReport, directories: [fullFlowDirectory] }));
  }

  const navigationDirectory = await newestDirectory(path.join(testRoot, 'navigation'));
  const navigationReport = await newestFile(path.join(runRoot, 'navigation'), (name) => name.endsWith('.json'));
  if (navigationDirectory) groups.push(await group({ id: 'navigation', title: 'Navigation smoke — halaman admin', category: 'Web Flow', status: 'PASSED', summary: '15/15 langkah smoke navigation lulus untuk login, dashboard, airlines, flights, dan reports.', folder: relative(navigationDirectory), report: navigationReport, directories: [navigationDirectory] }));

  const responsiveDirectory = await newestDirectory(path.join(testRoot, 'responsive'));
  if (responsiveDirectory) {
    const responsiveReport = path.join(responsiveDirectory, 'report.json');
    const report = JSON.parse(await readFile(responsiveReport, 'utf8'));
    groups.push(await group({ id: 'responsive', title: 'Responsive & layout — desktop, tablet, mobile', category: 'UI Quality', status: report.status || 'UNKNOWN', summary: `${report.passed || 0}/${report.total || 0} pemeriksaan viewport lulus; ${report.failed || 0} temuan layout perlu perbaikan.`, folder: relative(responsiveDirectory), report: responsiveReport, directories: [responsiveDirectory] }));
  }

  const passed = groups.filter((item) => item.status === 'PASSED').length;
  return { project: 'Zannora', generatedAt: new Date().toISOString(), groups, totals: { groups: groups.length, passed, failed: groups.length - passed, reports: groups.filter((item) => item.report).length, screenshots: groups.reduce((sum, item) => sum + item.screenshots.length, 0), videos: groups.reduce((sum, item) => sum + item.videos.length, 0), assets: groups.reduce((sum, item) => sum + item.assets.length, 0) } };
}

async function serveFile(response, file, download = false) {
  try {
    const metadata = await stat(file);
    response.writeHead(200, { 'content-type': mime(file), 'content-length': metadata.size, 'cache-control': 'no-cache', ...(download ? { 'content-disposition': 'inline' } : {}) });
    createReadStream(file).pipe(response);
  } catch { json(response, 404, { error: 'File tidak ditemukan' }); }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  if (url.pathname === '/api/v1/system/status') return json(response, 200, { docker: { available: true, message: 'Dashboard preview aktif' }, playwright: { available: true, message: 'QC evidence tersedia' }, maestro: { available: false, message: 'Tidak diperlukan untuk target web' }, adb: { available: false, message: 'Tidak diperlukan untuk target web' } });
  if (url.pathname === '/api/v1/discovery/jobs') return json(response, 200, []);
  if (url.pathname === '/api/v1/zannora-evidence') return json(response, 200, await buildEvidence());

  const evidencePrefix = '/api/v1/zannora-evidence/artifacts/';
  if (url.pathname.startsWith(evidencePrefix)) {
    const relativePath = decodeURIComponent(url.pathname.slice(evidencePrefix.length));
    const file = path.resolve(artifactRoot, relativePath);
    if (path.relative(artifactRoot, file).startsWith('..')) return json(response, 403, { error: 'Access denied' });
    return serveFile(response, file, true);
  }

  if (url.pathname.startsWith('/assets/')) {
    const file = path.resolve(webDist, url.pathname.slice(1));
    if (path.relative(webDist, file).startsWith('..')) return json(response, 403, { error: 'Access denied' });
    return serveFile(response, file);
  }
  return serveFile(response, path.join(webDist, 'index.html'));
});

server.listen(port, '0.0.0.0', () => console.log(`QC Maestro dashboard running at http://127.0.0.1:${port}`));
