import type { GeneratedFlow, Inventory } from './types.ts';

export type ImpactAnalysisResult = {
  impactedKeywords: string[];
  impactedRoutes: string[];
  impactedModules: string[];
  selectedFlows: GeneratedFlow[];
  summary: string;
};

/**
 * Menganalisis daftar file yang diubah dari commit GitHub
 * dan memetakannya ke flow pengujian Playwright/Maestro yang relevan.
 */
export function analyzeCommitImpact(
  filesChanged: string[],
  availableFlows: GeneratedFlow[],
  inventory?: Inventory
): ImpactAnalysisResult {
  if (!filesChanged || filesChanged.length === 0) {
    return {
      impactedKeywords: [],
      impactedRoutes: [],
      impactedModules: [],
      selectedFlows: [],
      summary: 'Tidak ada file yang terdeteksi dalam commit ini.',
    };
  }

  // 1. Ekstrak entitas kata kunci dari file-file yang diubah
  const keywordSet = new Set<string>();
  const impactedModulesSet = new Set<string>();
  let hasGlobalChange = false;

  for (const file of filesChanged) {
    const lower = file.toLowerCase();

    // Deteksi file non-fungsional (dokumentasi, config git, dll)
    if (lower.endsWith('.md') || lower.includes('.gitignore') || lower.includes('license')) {
      continue;
    }

    // Deteksi perubahan global / middleware inti
    if (
      lower.includes('routes/web.php') ||
      lower.includes('routes/api.php') ||
      lower.includes('rolemiddleware') ||
      lower.includes('authenticat') ||
      lower.includes('app/providers')
    ) {
      hasGlobalChange = true;
      impactedModulesSet.add('Routing & Core Middleware');
    }

    // Ekstrak nama modul dari controller, model, migration, atau view
    const patterns = [
      /controller[\\/]+(?:admin|web)?[\\/]*([a-z0-9_-]+)/i,
      /controllers?[\\/]+([a-z0-9_-]+)controller/i,
      /models?[\\/]+([a-z0-9_-]+)\.php/i,
      /views?[\\/]+(?:admin|user)?[\\/]*([a-z0-9_-]+)/i,
      /migrations?[\\/]+.*(?:create|update|add)_([a-z0-9_-]+)_table/i,
      /([a-z0-9_-]+)\.(?:vue|jsx|tsx|blade\.php)/i,
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match && match[1]) {
        const rawEntity = match[1].replace(/admin|web|controller/gi, '').trim();
        if (rawEntity.length >= 3) {
          keywordSet.add(rawEntity);
          impactedModulesSet.add(rawEntity.toUpperCase());
        }
      }
    }

    // Ekstrak kata kunci secara dinamis dari segmen path file tanpa kamus domain statis
    const pathSegments = lower
      .replace(/\\/g, '/')
      .split('/')
      .flatMap((seg) => seg.replace(/\.[a-z0-9]+$/i, '').split(/[-_.]+/));
    const stopWords = new Set([
      'src', 'app', 'apps', 'api', 'web', 'mobile', 'lib', 'pages', 'routes', 'route',
      'controllers', 'controller', 'models', 'model', 'views', 'view', 'services', 'service',
      'components', 'component', 'utils', 'helpers', 'index', 'main', 'test', 'tests', 'spec',
      'ts', 'tsx', 'js', 'jsx', 'php', 'dart', 'kt', 'java', 'json', 'css', 'scss'
    ]);
    for (const seg of pathSegments) {
      if (seg.length >= 3 && !stopWords.has(seg)) {
        keywordSet.add(seg);
        if (!seg.endsWith('s')) keywordSet.add(`${seg}s`);
        else if (seg.length > 4) keywordSet.add(seg.slice(0, -1));
      }
    }
  }

  const impactedKeywords = Array.from(keywordSet);
  const impactedModules = Array.from(impactedModulesSet);

  // 2. Cari rute-rute aplikasi yang beririsan
  const impactedRoutes: string[] = [];
  if (inventory?.routes) {
    for (const route of inventory.routes) {
      const rLower = route.path.toLowerCase();
      if (impactedKeywords.some((kw) => rLower.includes(kw))) {
        impactedRoutes.push(route.path);
      }
    }
  }

  // 3. Filter flow yang relevan dari availableFlows
  const selectedFlows: GeneratedFlow[] = [];
  const selectedIds = new Set<string>();

  // Helper untuk menambahkan flow
  const addFlow = (flow: GeneratedFlow) => {
    if (!selectedIds.has(flow.id)) {
      selectedIds.add(flow.id);
      selectedFlows.push(flow);
    }
  };

  // Flow login selalu disertakan sebagai gerbang sesi autentikasi awal jika ada protected area
  const loginFlow = availableFlows.find((f) => f.id === 'login' || f.id.includes('login'));

  for (const flow of availableFlows) {
    const fLower = (flow.id + ' ' + flow.name + ' ' + (flow.source || '')).toLowerCase();

    // Cocokkan dengan kata kunci terdampak atau rute terdampak
    const isImpacted =
      impactedKeywords.some((kw) => fLower.includes(kw)) ||
      impactedRoutes.some((route) => fLower.includes(route.toLowerCase()));

    if (isImpacted) {
      addFlow(flow);
    }
  }

  // Jika perubahan global (misal middleware/routes), tambahkan smoke tests modul utama
  if (hasGlobalChange && selectedFlows.length === 0) {
    const publicFlow = availableFlows.find((f) => f.id === 'web-public');
    const masterFlow = availableFlows.find((f) => f.id === 'web-master-data');
    const opsFlow = availableFlows.find((f) => f.id === 'web-operations');
    if (publicFlow) addFlow(publicFlow);
    if (masterFlow) addFlow(masterFlow);
    if (opsFlow) addFlow(opsFlow);
  }

  // Pastikan login flow berada di paling depan jika ada flow protected yang terpilih
  if (loginFlow && selectedFlows.length > 0 && !selectedIds.has(loginFlow.id)) {
    const needsAuth = selectedFlows.some((f) => !f.id.includes('public'));
    if (needsAuth) {
      selectedFlows.unshift(loginFlow);
      selectedIds.add(loginFlow.id);
    }
  }

  // 4. Susun ringkasan
  let summary = '';
  if (selectedFlows.length === 0) {
    summary = `Commit mengubah ${filesChanged.length} file tanpa dampak langsung pada alur bisnis utama.`;
  } else {
    summary = `Commit berdampak pada modul [${impactedModules.join(', ') || 'Fitur Terkait'}]. Menguji ${selectedFlows.length} skenario spesifik.`;
  }

  return {
    impactedKeywords,
    impactedRoutes: Array.from(new Set(impactedRoutes)).slice(0, 10),
    impactedModules,
    selectedFlows,
    summary,
  };
}
