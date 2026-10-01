import type { DiscoveryConfig, Inventory } from './types.ts';
import type { FeatureContract, FeatureScenario } from './feature-contract.ts';

export type BusinessFlowStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'BLOCKED';
export type BusinessFlowStep = {
  order: number;
  action: string;
  route?: string;
  expected: string;
  evidence?: string[];
};
export type BusinessFlow = {
  id: string;
  title: string;
  summary: string;
  category: string;
  actors: string[];
  trigger: string;
  preconditions: string[];
  steps: BusinessFlowStep[];
  expectedOutcome: string[];
  negativeScenarios: string[];
  recoveryScenarios: string[];
  evidence: { capabilities: string[]; routes: string[]; apiRoutes: string[]; elements: string[] };
  confidence: number;
  critical: boolean;
  status: BusinessFlowStatus;
  source: 'observed' | 'inferred';
  limitations: string[];
  approvedAt?: string;
};

export type BusinessFlowMap = {
  version: '1.0';
  generatedAt: string;
  status: 'AWAITING_REVIEW' | 'APPROVED' | 'PARTIAL' | 'BLOCKED';
  productProfile: { domainHints: string[]; capabilities: string[]; actors: string[] };
  summary: { total: number; approved: number; needsReview: number; blocked: number; critical: number };
  flows: BusinessFlow[];
  limitations: string[];
};

function unique(values: string[], limit = 12) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'flow';
}

function scenarioLabels(scenarios: FeatureScenario[], kind: FeatureScenario['kind']) {
  return scenarios.filter((scenario) => scenario.kind === kind).map((scenario) => `${scenario.label}: ${scenario.checks.join('; ')}`);
}

function routeSteps(contract: FeatureContract, loginRoute?: string): BusinessFlowStep[] {
  const routes = unique(contract.routes.concat(contract.apiRoutes.map((route) => `API ${route}`)), 5);
  const steps: BusinessFlowStep[] = [];
  let order = 1;
  if (contract.actors.some((actor) => /authenticated|admin|staff|manager|customer|user/i.test(actor))) {
    steps.push({ order: order++, action: 'Masuk menggunakan akun dengan role yang sesuai', route: loginRoute, expected: 'Sesi aktif dan user berada di area yang diizinkan', evidence: contract.evidence.elements.slice(0, 3) });
  }
  if (routes.length === 0) {
    steps.push({ order: order++, action: `Jalankan aksi utama pada fitur ${contract.label}`, expected: 'Aksi dan feedback utama terlihat pada UI atau response API' });
  } else {
    routes.forEach((route) => {
      const isApi = route.startsWith('API ');
      steps.push({
        order: order++,
        action: isApi ? `Verifikasi kontrak ${route}` : `Buka ${route} dan gunakan fitur ${contract.label}`,
        route: isApi ? route.slice(4) : route,
        expected: isApi ? 'Status, payload, dan error contract sesuai hasil aksi' : 'Halaman termuat, kontrol utama usable, dan state fitur terlihat',
        evidence: isApi ? contract.evidence.apiRoutes.slice(0, 3) : contract.evidence.elements.slice(0, 3),
      });
    });
  }
  steps.push({ order: order++, action: 'Validasi hasil akhir dan konsistensi state', expected: unique(contract.expectedUi.concat(contract.expectedData).concat(contract.expectedApi), 5).join('; ') || 'Hasil akhir sesuai kebutuhan fitur' });
  return steps;
}

function flowFromContract(contract: FeatureContract, loginRoute?: string): BusinessFlow {
  const critical = ['authentication', 'authorization', 'crud', 'checkout', 'payment', 'reservation', 'scheduling', 'approval-workflow'].includes(contract.capabilityId);
  const needsReview = contract.status !== 'READY_FOR_REVIEW' || contract.confidence < 0.8 || contract.routes.length === 0;
  return {
    id: `business-${slug(contract.id)}`,
    title: contract.label,
    summary: `Alur kandidat untuk ${contract.label}, disusun dari route, endpoint, elemen, dan rekomendasi pemeriksaan yang terdeteksi.`,
    category: contract.category,
    actors: unique(contract.actors, 8),
    trigger: `User membuka atau memulai ${contract.label}`,
    preconditions: contract.preconditions,
    steps: routeSteps(contract, loginRoute),
    expectedOutcome: unique(contract.expectedUi.concat(contract.expectedApi).concat(contract.expectedData), 8),
    negativeScenarios: scenarioLabels(contract.scenarios, 'negative').concat(scenarioLabels(contract.scenarios, 'boundary')).slice(0, 6),
    recoveryScenarios: scenarioLabels(contract.scenarios, 'recovery').concat(scenarioLabels(contract.scenarios, 'integrity')).slice(0, 6),
    evidence: { capabilities: [contract.capabilityId], routes: contract.evidence.routes, apiRoutes: contract.evidence.apiRoutes, elements: contract.evidence.elements },
    confidence: contract.confidence,
    critical,
    status: needsReview ? 'NEEDS_REVIEW' : 'DRAFT',
    source: 'inferred',
    limitations: contract.limitations.concat(['Urutan bisnis dan expected result final tetap perlu dikonfirmasi owner/tester.']),
  };
}

function roleFlows(inventory: Inventory): BusinessFlow[] {
  const plan = inventory.roleActionPlan;
  if (!plan || plan.roles.length === 0) return [];
  return plan.roles.slice(0, 8).map((role) => {
    const rows = plan.rows.filter((row) => row.role === role).slice(0, 5);
    const routes = unique(rows.map((row) => row.page));
    const actions = unique(rows.flatMap((row) => row.actions), 8);
    return {
      id: `business-role-${slug(role)}`,
      title: `Role access · ${role}`,
      summary: `Alur akses ${role} berdasarkan halaman dan action matrix yang ditemukan dari aplikasi.`,
      category: 'access',
      actors: [role],
      trigger: `User masuk sebagai ${role}`,
      preconditions: ['akun role tersedia', 'target dapat diakses'],
      steps: routes.map((route, index) => ({ order: index + 1, action: `Buka ${route} sebagai ${role}`, route, expected: 'Route dan action yang diizinkan terlihat; action terlarang tidak dapat dijalankan', evidence: actions.slice(0, 3) })),
      expectedOutcome: ['visibility dan action sesuai role', 'direct URL/API yang tidak diizinkan ditolak', 'tidak ada data role lain yang bocor'],
      negativeScenarios: ['Akses langsung ke halaman/action yang bukan hak role', 'Mencoba mengirim aksi terlarang melalui API'],
      recoveryScenarios: ['Session expired diarahkan ke login tanpa kehilangan konteks secara tidak aman'],
      evidence: { capabilities: ['authorization'], routes, apiRoutes: [], elements: actions },
      confidence: rows.some((row) => row.expectation === 'REQUIRES_RUNTIME') ? 0.62 : 0.82,
      critical: true,
      status: 'NEEDS_REVIEW' as const,
      source: 'inferred' as const,
      limitations: ['Authorization server-side perlu diverifikasi dengan akun tiap role saat runtime.'],
    } satisfies BusinessFlow;
  });
}

function resourceFlows(inventory: Inventory): BusinessFlow[] {
  return (inventory.crudPlan?.resources ?? []).slice(0, 24).map((resource) => {
    const route = resource.routes.find((candidate) => !/\/create$|\/new$|\/edit$|\/\d+$/i.test(candidate)) ?? resource.routes[0];
    const operations = Object.entries(resource.operations).filter(([, status]) => status !== 'NOT_OBSERVED').map(([operation]) => operation);
    const steps: BusinessFlowStep[] = [];
    let order = 1;
    steps.push({ order: order++, action: `Buka daftar ${resource.name}`, route, expected: 'Daftar data, loading, empty, dan error state terlihat', evidence: resource.evidenceElements.slice(0, 4) });
    for (const operation of operations.slice(0, 5)) {
      steps.push({ order: order++, action: `Verifikasi operasi ${operation} pada ${resource.name}`, route, expected: operation === 'delete' || operation === 'delete-in-use' ? 'Penghapusan mengikuti dependency guard dan tidak merusak data terkait' : 'Validasi, feedback, dan perubahan state sesuai operasi' });
    }
    return {
      id: `business-resource-${slug(resource.id)}`,
      title: `Resource lifecycle · ${resource.name}`,
      summary: `Alur lifecycle resource ${resource.name} dari list/read sampai operasi yang terlihat pada inventory.`,
      category: 'data',
      actors: ['authenticated user', 'admin/operator'],
      trigger: `User membuka modul ${resource.name}`,
      preconditions: ['akun dengan akses modul tersedia', 'fixture dapat di-reset bila ada operasi mutation'],
      steps,
      expectedOutcome: ['UI, API, dan data state konsisten', 'validasi mencegah data invalid', 'delete in-use aman'],
      negativeScenarios: resource.fixtureChecks.slice(0, 6),
      recoveryScenarios: ['Refresh setelah save/delete tidak menggandakan atau menghilangkan record', 'Server error mengembalikan form/list ke state yang aman'],
      evidence: { capabilities: ['crud'], routes: resource.routes, apiRoutes: resource.apiRoutes, elements: resource.evidenceElements },
      confidence: resource.confidence,
      critical: true,
      status: resource.confidence >= 0.8 ? 'DRAFT' as const : 'NEEDS_REVIEW' as const,
      source: 'inferred' as const,
      limitations: ['Mutation harus memakai fixture/reset contract dari target agar aman dieksekusi.'],
    } satisfies BusinessFlow;
  });
}

export function buildBusinessFlowMap(inventory: Inventory, config: DiscoveryConfig): BusinessFlowMap {
  const contracts = inventory.featureContractPlan?.contracts ?? [];
  const loginRoute = config.rules.loginPath;
  let flows = contracts.map((contract) => flowFromContract(contract, loginRoute));
  flows = flows.concat(roleFlows(inventory), resourceFlows(inventory));
  if (flows.length === 0) {
    const routes = unique(inventory.pages.map((page) => page.path).concat(inventory.routes.filter((route) => route.method === 'GET').map((route) => route.path)), 12);
    flows.push({
      id: 'business-observed-navigation',
      title: 'Observed application navigation',
      summary: 'Alur fallback dari halaman dan route yang berhasil dipetakan.',
      category: 'foundation',
      actors: ['anonymous user'],
      trigger: 'User membuka aplikasi',
      preconditions: ['target dapat diakses'],
      steps: routes.map((route, index) => ({ order: index + 1, action: `Buka ${route}`, route, expected: 'Halaman termuat tanpa error fatal' })),
      expectedOutcome: ['route utama dapat dibuka', 'navigasi tidak menghasilkan dead-end'],
      negativeScenarios: ['Route tidak ditemukan atau gagal dimuat'],
      recoveryScenarios: ['Refresh dan kembali ke halaman sebelumnya tetap aman'],
      evidence: { capabilities: ['public-navigation'], routes, apiRoutes: [], elements: [] },
      confidence: 0.55,
      critical: false,
      status: 'NEEDS_REVIEW',
      source: 'observed',
      limitations: ['Tidak ditemukan capability contract yang cukup untuk menyimpulkan alur bisnis yang lebih spesifik.'],
    });
  }
  const deduped = flows.filter((flow, index, all) => all.findIndex((candidate) => candidate.id === flow.id) === index);
  const approved = deduped.filter((flow) => flow.status === 'APPROVED').length;
  const needsReview = deduped.filter((flow) => flow.status === 'NEEDS_REVIEW' || flow.status === 'DRAFT').length;
  const blocked = deduped.filter((flow) => flow.status === 'BLOCKED').length;
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    status: blocked === deduped.length ? 'BLOCKED' : approved === deduped.length ? 'APPROVED' : approved > 0 ? 'PARTIAL' : 'AWAITING_REVIEW',
    productProfile: {
      domainHints: inventory.capabilities?.domainHints ?? [],
      capabilities: unique((inventory.capabilities?.capabilities ?? []).filter((capability) => capability.status === 'detected').map((capability) => capability.label), 20),
      actors: unique(deduped.flatMap((flow) => flow.actors), 20),
    },
    summary: { total: deduped.length, approved, needsReview, blocked, critical: deduped.filter((flow) => flow.critical).length },
    flows: deduped,
    limitations: [
      'Peta ini adalah kandidat yang disusun dari evidence repo dan runtime discovery; bukan klaim business requirement final.',
      'Urutan lintas fitur, aturan approval, SLA, dan hasil bisnis harus dikonfirmasi oleh owner/tester.',
      ...(inventory.capabilities?.domainHints?.length ? [] : ['Domain produk belum dapat dikenali dengan confidence tinggi.']),
    ],
  };
}

export function refreshBusinessFlowSummary(map: BusinessFlowMap): BusinessFlowMap {
  const approved = map.flows.filter((flow) => flow.status === 'APPROVED').length;
  const needsReview = map.flows.filter((flow) => flow.status === 'NEEDS_REVIEW' || flow.status === 'DRAFT').length;
  const blocked = map.flows.filter((flow) => flow.status === 'BLOCKED').length;
  map.summary = { total: map.flows.length, approved, needsReview, blocked, critical: map.flows.filter((flow) => flow.critical).length };
  map.status = blocked === map.flows.length ? 'BLOCKED' : approved === map.flows.length ? 'APPROVED' : approved > 0 ? 'PARTIAL' : 'AWAITING_REVIEW';
  return map;
}
