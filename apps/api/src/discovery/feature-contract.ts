import type { DetectedCapability, CapabilityId } from './capability-model.ts';
import type { CrudPlan } from './crud-planner.ts';
import type { RoleActionPlan } from './role-planner.ts';
import type { InventoryPage } from './source-scanner.ts';

export type FeatureScenarioKind = 'happy' | 'negative' | 'boundary' | 'permission' | 'recovery' | 'integrity';
export type FeatureContractStatus = 'READY_FOR_REVIEW' | 'REQUIRES_REVIEW' | 'CANDIDATE';
export type FeatureScenario = {
  id: string;
  kind: FeatureScenarioKind;
  label: string;
  checks: string[];
  execution: 'safe-probe' | 'requires-fixture' | 'requires-runtime';
  status: 'PLANNED' | 'READY' | 'BLOCKED';
};
export type FeatureContract = {
  id: string;
  capabilityId: CapabilityId;
  label: string;
  category: string;
  status: FeatureContractStatus;
  confidence: number;
  actors: string[];
  routes: string[];
  apiRoutes: string[];
  preconditions: string[];
  inputData: string[];
  expectedUi: string[];
  expectedApi: string[];
  expectedData: string[];
  scenarios: FeatureScenario[];
  evidence: { routes: string[]; apiRoutes: string[]; elements: string[] };
  limitations: string[];
};
export type FeatureContractPlan = {
  version: '1.0';
  generatedAt: string;
  total: number;
  readyForReview: number;
  requiresReview: number;
  candidate: number;
  scenarioTotals: Record<FeatureScenarioKind, number>;
  contracts: FeatureContract[];
  limitations: string[];
};

const DEFAULT_PRECONDITIONS = ['target dapat diakses', 'fixture atau akun uji tersedia bila diperlukan'];

const scenarioTemplates: Record<FeatureScenarioKind, { label: string; execution: FeatureScenario['execution']; checks: string[] }> = {
  happy: { label: 'Happy path', execution: 'requires-runtime', checks: ['fitur dapat dibuka', 'aksi utama selesai tanpa error', 'UI menampilkan hasil sukses', 'route/state akhir sesuai'] },
  negative: { label: 'Negative path', execution: 'safe-probe', checks: ['input/aksi invalid ditolak', 'pesan error terlihat dan relevan', 'tidak ada perubahan data tidak valid'] },
  boundary: { label: 'Boundary path', execution: 'safe-probe', checks: ['nilai minimum/maksimum diuji', 'long text/empty result tetap usable', 'hasil boundary konsisten di UI dan API'] },
  permission: { label: 'Permission path', execution: 'requires-runtime', checks: ['role yang sesuai dapat menjalankan aksi', 'role yang tidak sesuai ditolak', 'tidak ada data/action leakage'] },
  recovery: { label: 'Recovery path', execution: 'safe-probe', checks: ['refresh/back/retry tetap aman', 'network/server failure memiliki feedback', 'user dapat melanjutkan atau membatalkan dengan aman'] },
  integrity: { label: 'Data integrity path', execution: 'requires-fixture', checks: ['UI/API/data state konsisten', 'duplicate/race tidak menggandakan data', 'cleanup atau rollback terverifikasi'] },
};

function unique(values: string[], limit = 12) { return [...new Set(values.filter(Boolean))].slice(0, limit); }
function capabilityElements(capability: DetectedCapability) { return capability.evidence.elements; }

function scenario(capability: DetectedCapability, kind: FeatureScenarioKind, index: number, requiresFixture = false): FeatureScenario {
  const template = scenarioTemplates[kind];
  return {
    id: `${capability.id}-${kind}-${index + 1}`,
    kind,
    label: `${capability.label}: ${template.label}`,
    checks: [...template.checks, ...capability.recommendedChecks.slice(0, 3)],
    execution: requiresFixture ? 'requires-fixture' : template.execution,
    status: kind === 'happy' && capability.evidence.routes.length > 0 ? 'READY' : kind === 'permission' ? 'BLOCKED' : 'PLANNED',
  };
}

export function buildFeatureContractPlan(input: {
  capabilities: DetectedCapability[];
  pages: InventoryPage[];
  crudPlan?: CrudPlan;
  roleActionPlan?: RoleActionPlan;
}): FeatureContractPlan {
  const contracts = input.capabilities.map((capability) => {
    const fixtureRequired = capability.id === 'crud' || capability.id === 'payment' || capability.id === 'reservation' || capability.id === 'scheduling';
    const scenarios = (['happy', 'negative', 'boundary', 'permission', 'recovery', 'integrity'] as FeatureScenarioKind[]).map((kind, index) => scenario(capability, kind, index, fixtureRequired && (kind === 'happy' || kind === 'integrity')));
    const actors = unique((input.roleActionPlan?.roles || []).concat(capability.id === 'authorization' ? ['admin', 'staff', 'customer'] : ['authenticated user', 'anonymous user']));
    const matchedPages = input.pages.filter((page) => capability.evidence.routes.includes(page.path));
    const status: FeatureContractStatus = capability.status === 'candidate' ? 'CANDIDATE' : capability.evidence.routes.length || capability.evidence.apiRoutes.length ? 'READY_FOR_REVIEW' : 'REQUIRES_REVIEW';
    return {
      id: `feature-${capability.id}`,
      capabilityId: capability.id,
      label: capability.label,
      category: capability.category,
      status,
      confidence: capability.confidence,
      actors,
      routes: capability.evidence.routes,
      apiRoutes: capability.evidence.apiRoutes,
      preconditions: [...DEFAULT_PRECONDITIONS, ...(capability.id === 'authentication' ? ['credential uji valid dan invalid tersedia'] : []), ...(fixtureRequired ? ['fixture domain dapat di-reset'] : [])],
      inputData: unique(capabilityElements(capability).concat(capability.recommendedChecks.map((check) => `data untuk ${check}`))),
      expectedUi: unique(['feedback loading/success/error', ...capability.recommendedChecks.map((check) => `UI: ${check}`)]),
      expectedApi: unique(['HTTP status sesuai hasil aksi', ...capability.evidence.apiRoutes.map((route) => `response contract ${route}`)]),
      expectedData: unique(['data tidak berubah pada failure', capability.id === 'crud' ? 'record baru/berubah/terhapus sesuai aksi' : '', capability.id === 'payment' ? 'amount dan status transaksi konsisten' : '', capability.id === 'reservation' ? 'capacity/availability konsisten' : '']),
      scenarios,
      evidence: { routes: capability.evidence.routes, apiRoutes: capability.evidence.apiRoutes, elements: capabilityElements(capability) },
      limitations: [
        ...(capability.status === 'candidate' ? ['capability masih candidate; perlu konfirmasi tester'] : []),
        ...(matchedPages.length === 0 && capability.evidence.apiRoutes.length > 0 ? ['API evidence ada tetapi halaman UI belum terpetakan'] : []),
        ...(capability.id === 'authorization' ? ['server-side authorization baru dapat dibuktikan saat runtime dengan akun tiap role'] : []),
      ],
    } satisfies FeatureContract;
  });
  const scenarioTotals = (['happy', 'negative', 'boundary', 'permission', 'recovery', 'integrity'] as FeatureScenarioKind[]).reduce((totals, kind) => {
    totals[kind] = contracts.reduce((count, contract) => count + contract.scenarios.filter((item) => item.kind === kind).length, 0);
    return totals;
  }, {} as Record<FeatureScenarioKind, number>);
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    total: contracts.length,
    readyForReview: contracts.filter((contract) => contract.status === 'READY_FOR_REVIEW').length,
    requiresReview: contracts.filter((contract) => contract.status === 'REQUIRES_REVIEW').length,
    candidate: contracts.filter((contract) => contract.status === 'CANDIDATE').length,
    scenarioTotals,
    contracts,
    limitations: [
      'Contract dibuat dari evidence discovery dan tetap memerlukan review tester untuk expected business result.',
      ...(input.crudPlan?.limitations || []),
      ...(input.roleActionPlan?.limitations || []),
    ],
  };
}
