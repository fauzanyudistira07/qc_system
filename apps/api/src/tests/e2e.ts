const baseUrl = (process.env.QC_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/$/, '');

async function getJson(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${path} returned invalid JSON`);
  }
}

async function main() {
  const config = await getJson('/api/v1/config') as { features?: Record<string, unknown>; version?: string };
  const projects = await getJson('/api/v1/projects');
  const jobs = await getJson('/api/v1/discovery/jobs');

  if (!config.version) throw new Error('API config does not expose a version');
  if (!Array.isArray(projects)) throw new Error('Projects endpoint did not return an array');
  if (!Array.isArray(jobs)) throw new Error('Discovery jobs endpoint did not return an array');

  console.log(JSON.stringify({
    status: 'PASSED',
    baseUrl,
    apiVersion: config.version,
    projectCount: projects.length,
    discoveryJobCount: jobs.length,
    discoveryEndpoints: ['/api/v1/config', '/api/v1/projects', '/api/v1/discovery/jobs'],
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAILED', baseUrl, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
