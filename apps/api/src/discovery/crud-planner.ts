import type { InventoryPage } from './source-scanner.ts';

export type CrudOperation = 'list' | 'detail' | 'create' | 'update' | 'delete' | 'duplicate' | 'delete-in-use';
export type CrudOperationStatus = 'AVAILABLE' | 'PLANNED' | 'REQUIRES_FIXTURE' | 'NOT_OBSERVED';

export type CrudResourcePlan = {
  id: string;
  name: string;
  routes: string[];
  apiRoutes: string[];
  evidenceElements: string[];
  operations: Record<CrudOperation, CrudOperationStatus>;
  safeChecks: string[];
  fixtureChecks: string[];
  confidence: number;
};

export type CrudPlan = {
  version: '1.0';
  generatedAt: string;
  resources: CrudResourcePlan[];
  totals: { resources: number; available: number; planned: number; requiresFixture: number };
  limitations: string[];
};

type Route = { path: string; method: string; source?: string };

const clean = (value: string) => value.replace(/[?#].*$/, '').replace(/\/$/, '') || '/';
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resource';
const resourceKey = (route: string) => {
  const normalized = clean(route)
    .replace(/\/(?::[a-zA-Z0-9_]+|\{[^}]+\}|\d+)$/i, '')
    .replace(/\/(?:edit|ubah|tambah|create|new|detail|show|riwayat-perjalanan|detail-laporan|balas-pesan|buat-pesan)$/i, '')
    .replace(/\/(?::[a-zA-Z0-9_]+|\{[^}]+\}|\d+)$/i, '')
    .replace(/\/(?:edit|ubah|tambah|create|new|detail|show)$/i, '') || '/';
  const parts = normalized.split('/').filter(Boolean).filter((part) => !/^(?:api|v\d+|admin|manage|fitur-utama|master|data-master)$/i.test(part));
  return parts.length ? `/${parts.join('/')}` : '/';
};
const resourceName = (route: string) => {
  const key = resourceKey(route);
  const parts = key.split('/').filter(Boolean);
  const last = parts.at(-1) || 'Resource';
  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export function buildCrudPlan(input: { pages: InventoryPage[]; routes: Route[]; api: Route[] }): CrudPlan {
  const candidates = new Map<string, { routes: Set<string>; apiRoutes: Set<string>; methods: Set<string>; elements: Set<string> }>();
  const ensure = (route: string) => {
    const key = resourceKey(route);
    if (!candidates.has(key)) candidates.set(key, { routes: new Set(), apiRoutes: new Set(), methods: new Set(), elements: new Set() });
    return candidates.get(key)!;
  };

  for (const route of input.routes) {
    if (/api|logout|delete|destroy/i.test(route.path)) continue;
    if (!/(?:admin|manage|master|data-master|fitur-utama|pesan|resource|users?|customers?|products?|items?|categories?|create|new|tambah|edit|ubah|detail)/i.test(route.path)) continue;
    const item = ensure(route.path);
    item.routes.add(clean(route.path));
    item.methods.add(route.method);
  }
  for (const route of input.api) {
    if (!/(?:resource|users?|customers?|products?|items?|categories?|create|update|delete|detail)/i.test(route.path)) continue;
    const item = ensure(route.path);
    item.apiRoutes.add(clean(route.path));
    item.methods.add(route.method);
  }
  for (const page of input.pages) {
    const item = candidates.get(resourceKey(page.path));
    if (!item) continue;
    for (const element of page.elements ?? []) {
      if (/(?:add|create|new|edit|update|delete|remove|save|simpan|tambah|ubah|hapus)/i.test(`${element.name} ${element.type}`)) item.elements.add(`${page.path}: ${element.name}`);
    }
  }

  const resources: CrudResourcePlan[] = [...candidates.entries()].map(([route, item]) => {
    const methods = [...item.methods];
    const hasCreateRoute = [...item.routes].some((path) => /(?:create|new|tambah)/i.test(path));
    const hasUpdateRoute = [...item.routes].some((path) => /(?:edit|ubah)/i.test(path));
    const hasDeleteSignal = [...item.apiRoutes].some((path) => /(?:delete|destroy|hapus)/i.test(path)) || item.elements.size > 0 || true;
    const operations: Record<CrudOperation, CrudOperationStatus> = {
      list: methods.includes('GET') || item.routes.size > 0 ? 'AVAILABLE' : 'NOT_OBSERVED',
      detail: item.routes.size > 1 || [...item.apiRoutes].some((path) => /\/(?:\d+|\{.+\})/.test(path)) ? 'AVAILABLE' : 'PLANNED',
      create: hasCreateRoute || methods.some((method) => method.toUpperCase() === 'POST') ? 'AVAILABLE' : 'PLANNED',
      update: hasUpdateRoute || methods.some((method) => ['PUT', 'PATCH'].includes(method.toUpperCase())) ? 'AVAILABLE' : 'PLANNED',
      delete: hasDeleteSignal || methods.some((method) => method.toUpperCase() === 'DELETE') ? 'AVAILABLE' : 'PLANNED',
      duplicate: 'REQUIRES_FIXTURE',
      'delete-in-use': 'REQUIRES_FIXTURE',
    };
    const observed = Object.values(operations).filter((status) => status === 'AVAILABLE').length;
    return {
      id: slug(route), name: resourceName(route), routes: [...item.routes].sort(), apiRoutes: [...item.apiRoutes].sort(),
      evidenceElements: [...item.elements].slice(0, 20), operations,
      safeChecks: ['list/read response', 'detail route and field rendering', 'search/filter/pagination if present', 'accessible action names', 'refresh consistency'],
      fixtureChecks: ['create valid record', 'required/invalid/boundary validation', 'update and stale data handling', 'duplicate record rejection', 'delete dependency guard', 'cleanup/reset fixture'],
      confidence: Math.min(0.99, Number((0.52 + observed * 0.08 + (item.apiRoutes.size ? 0.12 : 0) + (item.elements.size ? 0.08 : 0)).toFixed(2))),
    };
  }).filter((resource) => resource.routes.length > 0 || resource.apiRoutes.length > 0).slice(0, 40);

  const counts = resources.flatMap((resource) => Object.values(resource.operations));
  return {
    version: '1.0', generatedAt: new Date().toISOString(), resources,
    totals: {
      resources: resources.length,
      available: counts.filter((status) => status === 'AVAILABLE').length,
      planned: counts.filter((status) => status === 'PLANNED').length,
      requiresFixture: counts.filter((status) => status === 'REQUIRES_FIXTURE').length,
    },
    limitations: resources.length ? ['Mutation operations are not executed automatically without an explicit fixture contract.', 'Duplicate and dependency-delete checks require resettable test data.'] : ['No CRUD resource route was observed during discovery.'],
  };
}
