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

    // Keyword pencarian berbasis path
    if (lower.includes('flight')) { keywordSet.add('flight'); keywordSet.add('flights'); impactedModulesSet.add('Penerbangan'); }
    if (lower.includes('airport')) { keywordSet.add('airport'); keywordSet.add('airports'); impactedModulesSet.add('Bandara'); }
    if (lower.includes('airplane')) { keywordSet.add('airplane'); keywordSet.add('airplanes'); impactedModulesSet.add('Pesawat'); }
    if (lower.includes('airline')) { keywordSet.add('airline'); keywordSet.add('airlines'); impactedModulesSet.add('Maskapai'); }
    if (lower.includes('seat')) { keywordSet.add('seat'); keywordSet.add('seats'); impactedModulesSet.add('Kursi'); }
    if (lower.includes('booking')) { keywordSet.add('booking'); keywordSet.add('bookings'); impactedModulesSet.add('Pemesanan'); }
    if (lower.includes('payment')) { keywordSet.add('payment'); keywordSet.add('payments'); impactedModulesSet.add('Pembayaran'); }
    if (lower.includes('ticket')) { keywordSet.add('ticket'); keywordSet.add('tickets'); impactedModulesSet.add('Tiket'); }
    if (lower.includes('user')) { keywordSet.add('user'); keywordSet.add('users'); impactedModulesSet.add('Pengguna'); }
    if (lower.includes('contact')) { keywordSet.add('contact'); keywordSet.add('contact-message'); impactedModulesSet.add('Kontak & Pesan'); }
    if (lower.includes('report')) { keywordSet.add('report'); keywordSet.add('reports'); impactedModulesSet.add('Laporan'); }
    if (lower.includes('passenger')) { keywordSet.add('passenger'); keywordSet.add('passengers'); impactedModulesSet.add('Penumpang'); }
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
