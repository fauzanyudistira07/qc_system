import type { InventoryPage } from './source-scanner.ts';

/**
 * Domain-neutral capability knowledge used by discovery and flow synthesis.
 *
 * This is deliberately a catalogue of observable application behaviour, not a
 * list of product names. A travel app, ERP, marketplace, school portal, or
 * internal dashboard can therefore share the same discovery vocabulary.
 */
export type CapabilityCategory = 'foundation' | 'access' | 'interaction' | 'data' | 'transaction' | 'workflow' | 'content' | 'integration';
export type CapabilityId =
  | 'public-navigation'
  | 'authentication'
  | 'authorization'
  | 'forms'
  | 'search-filter'
  | 'pagination'
  | 'modal-drawer'
  | 'multi-step-form'
  | 'crud'
  | 'tables-data'
  | 'file-upload'
  | 'file-download'
  | 'catalog'
  | 'cart'
  | 'checkout'
  | 'payment'
  | 'reservation'
  | 'scheduling'
  | 'approval-workflow'
  | 'notifications'
  | 'messaging'
  | 'tickets-support'
  | 'dashboard-reporting'
  | 'content-cms'
  | 'media'
  | 'api'
  | 'realtime'
  | 'localization';

export type CapabilityEvidence = {
  routes: string[];
  apiRoutes: string[];
  elements: string[];
  methods: string[];
};

export type DetectedCapability = {
  id: CapabilityId;
  category: CapabilityCategory;
  label: string;
  confidence: number;
  status: 'detected' | 'candidate';
  rationale: string;
  evidence: CapabilityEvidence;
  recommendedChecks: string[];
};

export type CapabilityProfile = {
  version: '1.0';
  detectedAt: string;
  domainHints: string[];
  totalCatalogCapabilities: number;
  detectedCount: number;
  capabilities: DetectedCapability[];
};

type CapabilityRule = {
  id: CapabilityId;
  category: CapabilityCategory;
  label: string;
  route: RegExp;
  element: RegExp;
  api: RegExp;
  method?: RegExp;
  checks: string[];
};

const routeWords = /(?:^|[\/_-])(?:account|admin|app|dashboard|home|landing|main|portal|profile|settings|workspace)(?:$|[\/_-])/i;

/** Observable feature catalogue. Keep additions here instead of hard-coding a domain in the flow builder. */
export const CAPABILITY_CATALOG: readonly CapabilityRule[] = [
  { id: 'public-navigation', category: 'foundation', label: 'Public navigation & landing', route: /^(?:\/|\/home|\/about|\/contact|\/info|\/faq|\/pricing|\/search)/i, element: /^(?:link|nav|a)$/i, api: /$a/, checks: ['public route loads', 'navigation links stay same-origin', 'landing page has usable content'] },
  { id: 'authentication', category: 'access', label: 'Authentication & session', route: /(?:login|signin|sign-in|register|signup|sign-up|forgot|reset-password|logout|auth|dashboard|profile)/i, element: /(?:password|email|username|login|sign in|sign-in|masuk|daftar|register|logout|keluar)/i, api: /(?:login|signin|register|logout|token|session|auth)/i, checks: ['login success and failure', 'session boundary', 'logout/session cleanup', 'credential redaction'] },
  { id: 'authorization', category: 'access', label: 'Roles & permissions', route: /(?:admin|staff|manager|moderator|operator|backoffice|role|permission|settings)/i, element: /(?:role|permission|admin|manager|staff|approve|reject|authorize)/i, api: /(?:permission|role|policy|authorize|acl|rbac)/i, checks: ['role matrix', 'hidden/disabled actions', 'direct URL access control', 'unauthorized response'] },
  { id: 'forms', category: 'interaction', label: 'Forms & validation', route: /(?:create|new|edit|form|register|profile|settings|contact|checkout|booking|passenger|address)/i, element: /(?:input|textarea|select|form|email|password|name|phone|address|submit|simpan|save|kirim)/i, api: /(?:validate|form|submit)/i, checks: ['required and invalid input', 'field labels and errors', 'valid submission', 'loading/disabled state'] },
  { id: 'search-filter', category: 'interaction', label: 'Search, filter & sort', route: /(?:search|find|filter|sort|query|browse|catalog|list)/i, element: /(?:search|cari|filter|sort|urut|keyword|query)/i, api: /(?:search|filter|sort|query)/i, checks: ['matching result', 'empty result', 'clear/reset filter', 'large result set'] },
  { id: 'pagination', category: 'interaction', label: 'Pagination & infinite data', route: /(?:page|pagination|offset|infinite|load-more)/i, element: /(?:next|previous|prev|load more|more|halaman|page|pagination)/i, api: /(?:page|pagination|offset|limit|cursor)/i, checks: ['first/last page', 'next/previous state', 'empty page', 'large dataset'] },
  { id: 'modal-drawer', category: 'interaction', label: 'Modal, drawer & overlay', route: /(?:modal|dialog|drawer|detail|preview)/i, element: /(?:modal|dialog|drawer|close|tutup|detail|preview)/i, api: /$a/, checks: ['open/close with keyboard', 'focus containment', 'backdrop behaviour', 'content does not overflow'] },
  { id: 'multi-step-form', category: 'interaction', label: 'Multi-step form / wizard', route: /(?:step|wizard|onboarding|setup|checkout|booking)/i, element: /(?:step|next|back|continue|lanjut|kembali|wizard|progress)/i, api: /(?:step|wizard|onboarding)/i, checks: ['step validation', 'back/forward state', 'refresh recovery', 'final submit'] },
  { id: 'crud', category: 'data', label: 'CRUD & resource management', route: /(?:admin|manage|master|resource|users?|customers?|products?|items?|categories?|edit|create|new|delete|detail)/i, element: /(?:add|create|new|edit|update|delete|remove|save|simpan|tambah|ubah|hapus)/i, api: /(?:create|update|delete|resource|users?|products?|items?)/i, method: /POST|PUT|PATCH|DELETE/i, checks: ['list/read', 'create with validation', 'edit/update', 'safe delete and dependency guard'] },
  { id: 'tables-data', category: 'data', label: 'Tables, lists & dense data', route: /(?:list|table|report|admin|manage|history|records?|transactions?)/i, element: /(?:table|row|column|list|record|total|status|date|amount)/i, api: /(?:list|records?|transactions?|report)/i, checks: ['column alignment', 'dense data responsive layout', 'empty/loading/error state', 'sort/filter consistency'] },
  { id: 'file-upload', category: 'data', label: 'File upload & import', route: /(?:upload|import|attachment|document|file|avatar|photo|image)/i, element: /(?:upload|choose file|browse|attach|import|file|foto|gambar|dokumen)/i, api: /(?:upload|import|attachment|multipart|file)/i, checks: ['valid file', 'invalid type/size', 'progress/cancel', 'server error recovery'] },
  { id: 'file-download', category: 'data', label: 'File download & export', route: /(?:download|export|csv|excel|pdf|print|invoice|ticket)/i, element: /(?:download|export|csv|excel|pdf|print|cetak|unduh)/i, api: /(?:download|export|csv|excel|pdf|invoice)/i, checks: ['download response', 'filename/type', 'empty export', 'permission protection'] },
  { id: 'catalog', category: 'transaction', label: 'Catalog / product discovery', route: /(?:catalog|product|produk|item|service|layanan|menu|flight|penerbangan|hotel|room|course|kelas)/i, element: /(?:product|produk|item|service|layanan|price|harga|catalog|menu|flight|penerbangan)/i, api: /(?:products?|catalog|items?|services?|flights?|courses?)/i, checks: ['list/detail consistency', 'availability/price display', 'search/filter', 'empty state'] },
  { id: 'cart', category: 'transaction', label: 'Cart / basket / selection', route: /(?:cart|basket|bag|wishlist|compare|selection|seat|pilihan)/i, element: /(?:cart|basket|bag|wishlist|add to cart|keranjang|wishlist|seat|kursi|select|pilih)/i, api: /(?:cart|basket|wishlist|selection|seat)/i, checks: ['add/remove item', 'quantity/selection update', 'empty cart', 'persistence between pages'] },
  { id: 'checkout', category: 'transaction', label: 'Checkout / order placement', route: /(?:checkout|order|orders?|purchase|buy|booking|reservation|confirm)/i, element: /(?:checkout|order|purchase|buy|book|booking|confirm|pesan|beli|bayar)/i, api: /(?:checkout|orders?|purchase|booking|reservation)/i, checks: ['review before submit', 'required data', 'double-submit protection', 'success/failure state'] },
  { id: 'payment', category: 'transaction', label: 'Payment & billing', route: /(?:payment|pay|billing|invoice|refund|transaction|tagihan|pembayaran)/i, element: /(?:payment|pay|billing|invoice|refund|cash|transfer|kartu|pembayaran)/i, api: /(?:payment|pay|billing|invoice|refund|transaction)/i, checks: ['success', 'failure/declined', 'expired/pending', 'refund/cancellation', 'idempotency'] },
  { id: 'reservation', category: 'transaction', label: 'Reservation / booking', route: /(?:booking|reservation|reserve|appointment|pesanan|pemesanan|ticket|tiket)/i, element: /(?:booking|reservation|reserve|appointment|date|tanggal|passenger|guest|penumpang|tiket)/i, api: /(?:booking|reservation|appointment|ticket)/i, checks: ['availability', 'hold/expiry', 'guest/customer data', 'cancel and restore capacity'] },
  { id: 'scheduling', category: 'transaction', label: 'Calendar & scheduling', route: /(?:calendar|schedule|agenda|appointment|availability|jadwal|tanggal)/i, element: /(?:calendar|schedule|date|time|slot|agenda|jadwal|tanggal|waktu)/i, api: /(?:calendar|schedule|appointment|availability|slot)/i, checks: ['date/time selection', 'timezone boundary', 'conflict prevention', 'empty availability'] },
  { id: 'approval-workflow', category: 'workflow', label: 'Approval & state workflow', route: /(?:approval|approve|reject|pending|review|moderation|status|workflow|persetujuan)/i, element: /(?:approve|reject|review|pending|accept|decline|set status|persetujuan|tolak|setujui)/i, api: /(?:approval|approve|reject|workflow|moderation|status)/i, checks: ['valid state transition', 'role restriction', 'double action protection', 'audit trail'] },
  { id: 'notifications', category: 'workflow', label: 'Notifications & alerts', route: /(?:notification|alert|inbox|announcement|notifikasi|pengumuman)/i, element: /(?:notification|alert|bell|inbox|notifikasi|pengumuman)/i, api: /(?:notification|alert|inbox|webhook)/i, checks: ['read/unread state', 'empty state', 'deep link', 'permission/privacy'] },
  { id: 'messaging', category: 'workflow', label: 'Messaging / chat / comments', route: /(?:chat|message|conversation|comment|discussion|pesan|komentar)/i, element: /(?:chat|message|send|comment|reply|pesan|kirim|balas)/i, api: /(?:chat|message|conversation|comment)/i, checks: ['send/validation', 'empty/loading state', 'long content', 'authorization'] },
  { id: 'tickets-support', category: 'workflow', label: 'Ticketing & support', route: /(?:support|ticket|issue|help|complaint|bantuan|keluhan)/i, element: /(?:support|ticket|issue|help|complaint|bantuan|keluhan)/i, api: /(?:support|ticket|issue|complaint)/i, checks: ['create ticket', 'status progression', 'attachment', 'role visibility'] },
  { id: 'dashboard-reporting', category: 'content', label: 'Dashboard, analytics & reporting', route: /(?:dashboard|report|analytics|statistic|metric|laporan|statistik)/i, element: /(?:dashboard|chart|graph|report|total|revenue|metric|laporan|grafik)/i, api: /(?:dashboard|report|analytics|statistic|metric)/i, checks: ['data accuracy', 'empty/loading/error state', 'dense widgets', 'date/filter range'] },
  { id: 'content-cms', category: 'content', label: 'Content / CMS / publishing', route: /(?:blog|article|post|page|content|cms|publish|news|berita|artikel)/i, element: /(?:article|post|content|publish|draft|editor|blog|artikel|berita)/i, api: /(?:articles?|posts?|content|cms|publish)/i, checks: ['draft/publish lifecycle', 'rich content layout', 'slug/SEO fields', 'permission'] },
  { id: 'media', category: 'content', label: 'Media, image & video', route: /(?:media|image|photo|video|gallery|avatar|gambar|foto|video)/i, element: /(?:image|photo|video|gallery|avatar|thumbnail|gambar|foto)/i, api: /(?:media|image|photo|video|gallery)/i, checks: ['load/error placeholder', 'aspect ratio', 'large asset performance', 'keyboard/accessibility'] },
  { id: 'api', category: 'integration', label: 'HTTP API / backend contract', route: /(?:api|graphql|webhook)/i, element: /$a/, api: /./i, checks: ['status code', 'auth boundary', 'schema/required fields', 'pagination/error contract'] },
  { id: 'realtime', category: 'integration', label: 'Realtime / polling / websocket', route: /(?:live|realtime|stream|socket|websocket|activity)/i, element: /(?:live|realtime|refresh|sync|online|offline)/i, api: /(?:websocket|socket|sse|stream|poll|realtime)/i, checks: ['connect/reconnect', 'stale state', 'offline recovery', 'duplicate event handling'] },
  { id: 'localization', category: 'integration', label: 'Localization & timezone', route: /(?:locale|language|i18n|translation|timezone|bahasa|lokasi)/i, element: /(?:language|locale|timezone|currency|bahasa|mata uang)/i, api: /(?:locale|language|translation|timezone|currency)/i, checks: ['language switch', 'long text layout', 'date/currency format', 'timezone boundary'] },
];

const domainRules: Array<{ label: string; pattern: RegExp }> = [
  { label: 'travel-booking', pattern: /(?:flight|airline|airport|penerbangan|pesawat|hotel|room|booking|reservation|ticket|tiket)/i },
  { label: 'commerce', pattern: /(?:product|produk|catalog|cart|checkout|order|shop|store|harga|keranjang)/i },
  { label: 'saas-admin', pattern: /(?:workspace|tenant|organization|admin|dashboard|settings|role|permission)/i },
  { label: 'education', pattern: /(?:course|class|student|teacher|lesson|quiz|school|sekolah|kelas|siswa|guru)/i },
  { label: 'healthcare', pattern: /(?:patient|doctor|clinic|hospital|medical|pasien|dokter|klinik|rumah sakit)/i },
  { label: 'finance', pattern: /(?:bank|wallet|ledger|invoice|billing|payment|finance|keuangan|tagihan)/i },
  { label: 'content-community', pattern: /(?:blog|article|post|comment|forum|community|blog|artikel|komentar)/i },
  { label: 'logistics-operations', pattern: /(?:warehouse|inventory|shipment|delivery|fleet|warehouse|gudang|pengiriman|logistik)/i },
];

function unique(values: string[], limit = 12) { return [...new Set(values.filter(Boolean))].slice(0, limit); }
function searchablePages(pages: InventoryPage[]) {
  return pages.map((page) => ({
    route: page.path,
    text: [page.path, page.title, page.authentication, ...(page.elements || []).map((element) => `${element.type} ${element.name} ${element.tag || ''}`)].join(' '),
    elements: (page.elements || []).map((element) => element.name).filter(Boolean),
  }));
}

export function detectCapabilities(input: { pages: InventoryPage[]; routes: Array<{ path: string; method: string; source?: string }>; api: Array<{ path: string; method: string; source?: string }> }): CapabilityProfile {
  const pages = searchablePages(input.pages);
  const routeItems = input.routes.map((route) => ({ path: route.path, method: route.method, text: `${route.path} ${route.source || ''}` }));
  const apiItems = input.api.map((route) => ({ path: route.path, method: route.method, text: `${route.path} ${route.source || ''}` }));
  const allText = [...pages.map((page) => page.text), ...routeItems.map((route) => route.text), ...apiItems.map((route) => route.text)].join(' ');
  const capabilities: DetectedCapability[] = [];

  for (const rule of CAPABILITY_CATALOG) {
    const matchedPages = pages.filter((page) => rule.route.test(page.text) || page.elements.some((element) => rule.element.test(element)));
    const matchedRoutes = routeItems.filter((route) => rule.route.test(route.text));
    const matchedApi = apiItems.filter((route) => rule.api.test(route.text));
    const matchedMethods = routeItems.filter((route) => rule.method?.test(route.method)).map((route) => route.method);
    const elementEvidence = matchedPages.flatMap((page) => page.elements.filter((element) => rule.element.test(element)).map((element) => `${page.route}: ${element}`));
    const signalCount = Number(matchedPages.length > 0) + Number(matchedRoutes.length > 0) + Number(matchedApi.length > 0) + Number(matchedMethods.length > 0);
    if (!signalCount) continue;
    const confidence = Math.min(0.99, 0.48 + (signalCount * 0.13) + (matchedPages.length > 2 ? 0.1 : 0));
    capabilities.push({
      id: rule.id,
      category: rule.category,
      label: rule.label,
      confidence: Number(confidence.toFixed(2)),
      status: confidence >= 0.7 ? 'detected' : 'candidate',
      rationale: `${matchedPages.length} page signal, ${matchedRoutes.length} route signal, ${matchedApi.length} API signal${matchedMethods.length ? `, method ${unique(matchedMethods).join('/')}` : ''}.`,
      evidence: {
        routes: unique([...matchedPages.map((page) => page.route), ...matchedRoutes.map((route) => route.path)]),
        apiRoutes: unique(matchedApi.map((route) => route.path)),
        elements: unique(elementEvidence),
        methods: unique(matchedMethods),
      },
      recommendedChecks: rule.checks,
    });
  }

  if (pages.length > 0 && !capabilities.some((capability) => capability.id === 'public-navigation')) {
    capabilities.unshift({
      id: 'public-navigation', category: 'foundation', label: 'Public navigation & landing', confidence: 0.55, status: 'candidate',
      rationale: 'Halaman terdeteksi, tetapi sinyal navigasi publik belum cukup kuat.',
      evidence: { routes: unique(pages.map((page) => page.route)), apiRoutes: [], elements: [], methods: [] },
      recommendedChecks: ['public route loads', 'navigation links stay same-origin', 'landing page has usable content'],
    });
  }
  if (apiItems.length > 0 && !capabilities.some((capability) => capability.id === 'api')) {
    capabilities.push({
      id: 'api', category: 'integration', label: 'HTTP API / backend contract', confidence: 0.55, status: 'candidate',
      rationale: `${apiItems.length} endpoint API ditemukan dari source/inventory.`,
      evidence: { routes: [], apiRoutes: unique(apiItems.map((route) => route.path)), elements: [], methods: unique(apiItems.map((route) => route.method)) },
      recommendedChecks: ['status code', 'auth boundary', 'schema/required fields', 'pagination/error contract'],
    });
  }

  const domainHints = domainRules.filter((rule) => rule.pattern.test(allText)).map((rule) => rule.label);
  return {
    version: '1.0',
    detectedAt: new Date().toISOString(),
    domainHints: domainHints.length ? domainHints : ['general-web'],
    totalCatalogCapabilities: CAPABILITY_CATALOG.length,
    detectedCount: capabilities.length,
    capabilities: capabilities.sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label)),
  };
}

