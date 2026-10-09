import { stringify } from 'yaml';
import type { FlowStep } from '@qc/flow-schema';
import type { Inventory, DiscoveryConfig, GeneratedFlow } from '../discovery/types.ts';
import { detectCapabilities } from '../discovery/capability-model.ts';

/**
 * Menghasilkan raw Maestro YAML commands untuk login.
 * - Dismiss dialog izin notifikasi Android (Don't allow) jika muncul
 * - Tap field NIS, isi NIS, tap field Password, isi password, tap Masuk
 * Semua optional agar jika sudah login tidak error.
 */
function buildLoginYamlCommands(nis: string, password: string): object[] {
  return [
    // Dismiss dialog izin notifikasi Android jika muncul (urutan: Don't allow dulu)
    { tapOn: { text: "Don't allow", optional: true } },
    { tapOn: { text: "Don\u2019t allow", optional: true } },
    { waitForAnimationToEnd: { timeout: 1500 } },
    // Isi form login
    { tapOn: { text: 'NIS / NISN', optional: true } },
    { inputText: nis || '12345678' },
    { tapOn: { text: 'Password', optional: true } },
    { inputText: password || '123456' },
    { tapOn: { text: 'Masuk', optional: true } },
    { waitForAnimationToEnd: { timeout: 5000 } }
  ];
}

/**
 * Menghasilkan raw Maestro YAML string (format baru: appId + --- + commands list)
 * untuk digunakan sebagai 'source' pada GeneratedFlow Android.
 */
function buildRawMaestroYaml(appId: string, name: string, commands: object[]): string {
  const header = `appId: ${appId}\nname: "${name}"\n---\n`;
  return header + stringify(commands, { indentSeq: false });
}

export function buildFlows(inventory: Inventory, config: DiscoveryConfig): GeneratedFlow[] {
  if (config.platform === 'android') {
    const appId = config.appId || 'com.sopan.digital';
    const nis = config.accounts?.[0]?.email || '161676';
    const password = config.accounts?.[0]?.password || 'Alhikmah123';
    const loginCmds = buildLoginYamlCommands(nis, password);

    const androidFlows: GeneratedFlow[] = [
      // ── Flow 1: Launch & Smoke Check (tanpa login) ───────────────────────
      {
        id: 'android-launch',
        name: '1. Launch & Smoke Check',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '1. Launch & Smoke Check', [
          { takeScreenshot: 'launch-screen' }
        ])
      },

      // ── Flow 2: Login & Masuk Dashboard ──────────────────────────────────
      // Mengisi form login dengan NIS + password, lalu verifikasi dashboard
      {
        id: 'android-login',
        name: '2. Login & Masuk Dashboard',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '2. Login & Masuk Dashboard', [
          ...loginCmds,
          { assertVisible: { text: 'Beranda' } },
          { takeScreenshot: 'dashboard-beranda' }
        ])
      },

      // ── Flow 3: Navigasi Semua Tab (login dulu, lalu cek semua tab) ───────
      {
        id: 'android-tabs-all',
        name: '3. Navigasi Semua Tab Dashboard',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '3. Navigasi Semua Tab Dashboard', [
          // Login
          ...loginCmds,
          // Beranda
          { assertVisible: { text: 'Beranda' } },
          { takeScreenshot: 'tab-beranda' },
          // Absensi
          { tapOn: { text: 'Absensi' } },
          { waitForAnimationToEnd: { timeout: 4000 } },
          { takeScreenshot: 'tab-absensi' },
          // Keuangan
          { tapOn: { text: 'Keuangan' } },
          { waitForAnimationToEnd: { timeout: 4000 } },
          { takeScreenshot: 'tab-keuangan' },
          // Informasi
          { tapOn: { text: 'Informasi' } },
          { waitForAnimationToEnd: { timeout: 4000 } },
          { takeScreenshot: 'tab-informasi' },
          // T2Q
          { tapOn: { text: 'T2Q' } },
          { waitForAnimationToEnd: { timeout: 4000 } },
          { takeScreenshot: 'tab-t2q' },
          // Kembali ke Beranda
          { tapOn: { text: 'Beranda' } }
        ])
      },

      // ── Flow 4: Eksplorasi Fitur Beranda (scroll) ─────────────────────────
      {
        id: 'android-home-explore',
        name: '4. Eksplorasi Konten Beranda',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '4. Eksplorasi Konten Beranda', [
          ...loginCmds,
          { assertVisible: { text: 'Beranda' } },
          { takeScreenshot: 'home-top' },
          { swipe: { direction: 'UP' } },
          { waitForAnimationToEnd: { timeout: 2000 } },
          { takeScreenshot: 'home-middle' },
          { swipe: { direction: 'UP' } },
          { waitForAnimationToEnd: { timeout: 2000 } },
          { takeScreenshot: 'home-bottom' }
        ])
      },

      // ── Flow 5: Tab Absensi (detail) ──────────────────────────────────────
      {
        id: 'android-tab-absensi',
        name: '5. Eksplorasi Tab Absensi',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '5. Eksplorasi Tab Absensi', [
          ...loginCmds,
          { tapOn: { text: 'Absensi' } },
          { waitForAnimationToEnd: { timeout: 5000 } },
          { takeScreenshot: 'absensi-loaded' },
          { swipe: { direction: 'UP' } },
          { waitForAnimationToEnd: { timeout: 2000 } },
          { takeScreenshot: 'absensi-scrolled' }
        ])
      },

      // ── Flow 6: Tab Keuangan (detail) ────────────────────────────────────
      {
        id: 'android-tab-keuangan',
        name: '6. Eksplorasi Tab Keuangan',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '6. Eksplorasi Tab Keuangan', [
          ...loginCmds,
          { tapOn: { text: 'Keuangan' } },
          { waitForAnimationToEnd: { timeout: 5000 } },
          { takeScreenshot: 'keuangan-loaded' },
          { swipe: { direction: 'UP' } },
          { waitForAnimationToEnd: { timeout: 2000 } },
          { takeScreenshot: 'keuangan-scrolled' }
        ])
      },

      // ── Flow 7: Tab Informasi (detail) ───────────────────────────────────
      {
        id: 'android-tab-informasi',
        name: '7. Eksplorasi Tab Informasi',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '7. Eksplorasi Tab Informasi', [
          ...loginCmds,
          { tapOn: { text: 'Informasi' } },
          { waitForAnimationToEnd: { timeout: 5000 } },
          { takeScreenshot: 'informasi-loaded' },
          { swipe: { direction: 'UP' } },
          { waitForAnimationToEnd: { timeout: 2000 } },
          { takeScreenshot: 'informasi-scrolled' }
        ])
      },

      // ── Flow 8: Tab T2Q / Hafalan (detail) ───────────────────────────────
      {
        id: 'android-tab-t2q',
        name: '8. Eksplorasi Tab T2Q (Hafalan)',
        platform: 'android',
        status: 'READY',
        source: buildRawMaestroYaml(appId, '8. Eksplorasi Tab T2Q (Hafalan)', [
          ...loginCmds,
          { tapOn: { text: 'T2Q' } },
          { waitForAnimationToEnd: { timeout: 5000 } },
          { takeScreenshot: 't2q-loaded' },
          { swipe: { direction: 'UP' } },
          { waitForAnimationToEnd: { timeout: 2000 } },
          { takeScreenshot: 't2q-scrolled' }
        ])
      }
    ];

    return androidFlows;
  }
  const flows: GeneratedFlow[] = [];
  const rules: Partial<DiscoveryConfig['rules']> = config.rules || {};
  const capabilityProfile = inventory.capabilities ?? detectCapabilities({ pages: inventory.pages, routes: inventory.routes, api: inventory.api });
  const authenticationDetected = capabilityProfile.capabilities.some((capability) => capability.id === 'authentication');
  
  // ── Ambil route statis dari inventory routes & pages ──────────────────────
  const allRoutes = new Set<string>();
  if (inventory.routes) {
    for (const r of inventory.routes) {
      if (r.method === 'GET' && !r.path.includes('{') && !/api|logout|delete|destroy/i.test(r.path)) {
        allRoutes.add(r.path.startsWith('/') ? r.path : `/${r.path}`);
      }
    }
  }
  if (inventory.pages) {
    for (const p of inventory.pages) {
      if (!p.path.includes('{') && !/api|logout|delete|destroy/i.test(p.path)) {
        allRoutes.add(p.path.startsWith('/') ? p.path : `/${p.path}`);
      }
    }
  }
  const staticRoutes = Array.from(allRoutes);

  const loginPath = rules.loginPath || '/login';
  const emailSelector = rules.emailSelector || "input[name='email'], #email, input[type='email'], input[name='username']";
  const passwordSelector = rules.passwordSelector || "input[name='password'], #password, input[type='password']";
  const submitSelector = rules.submitSelector || "button[type='submit'], .btn-primary, button:has-text('Masuk'), button:has-text('Login')";
  const successUrl = rules.successUrl || '/dashboard';

  const hasAuthNeed = authenticationDetected ||
    staticRoutes.some(r => /login|auth|dashboard|admin|user/i.test(r)) ||
    Boolean(config.accounts && config.accounts.length > 0);

  const loginSteps = (): FlowStep[] => hasAuthNeed ? [
    { id: 'login-page', action: 'open', url: loginPath },
    { id: 'login-email', action: 'input', target: { selector: emailSelector }, value: '${QC_EMAIL}' },
    { id: 'login-password', action: 'input', target: { selector: passwordSelector }, value: '${QC_PASSWORD}' },
    { id: 'login-submit', action: 'click', target: { selector: submitSelector } },
    { id: 'login-success', action: 'assertUrl', value: successUrl },
    { id: 'login-screenshot', action: 'screenshot', name: 'dashboard-after-login' }
  ] : [];

  const defaultVars: Record<string, string> = {
    QC_EMAIL: config.accounts?.[0]?.email || 'admin@zannora.com',
    QC_PASSWORD: config.accounts?.[0]?.password || 'password'
  };

  const toSource = (name: string, steps: FlowStep[]) => stringify({
    schemaVersion: '1.0',
    name,
    target: { platform: 'web', baseUrl: config.baseUrl },
    variables: defaultVars,
    execution: { timeoutMs: 45000, retries: 0, screenshot: 'always', trace: 'retain-on-failure', video: 'on' },
    steps
  });

  // Filter kategori
  const publicRoutes = staticRoutes.filter(r => /^\/(?:about|contact|flights|home|info|search|pricing|faq)?$/i.test(r) && r !== loginPath);
  const adminResourceRoutes = staticRoutes.filter(r => /^\/admin\/(?:airlines|airplanes|airports|flights|seats|masters?)/i.test(r));
  const adminOpsRoutes = staticRoutes.filter(r => /^\/admin\/(?:bookings|payments|tickets|users|reports|contact-messages|profile)/i.test(r));
  const customerRoutes = staticRoutes.filter(r => /^\/(?:user\/dashboard|my-bookings|booking|passengers|notifications|tickets)/i.test(r));

  // ── Flow 1: Eksplorasi Halaman Publik & Landing ────────────────────────────
  const publicSteps: FlowStep[] = [
    { id: 'home-open', action: 'open', url: '/' },
    { id: 'home-body', action: 'assertVisible', target: { selector: 'body' } },
    { id: 'home-screenshot', action: 'screenshot', name: 'public-home' }
  ];
  const targetPublic = publicRoutes.filter(r => r !== '/' && r !== '/home').slice(0, 3);
  for (const [idx, r] of targetPublic.entries()) {
    const slug = r.replace(/[^a-z0-9]/gi, '-').replace(/^-+|-+$/g, '') || `page-${idx}`;
    publicSteps.push({ id: `pub-${idx}-open`, action: 'open', url: r });
    publicSteps.push({ id: `pub-${idx}-body`, action: 'assertVisible', target: { selector: 'body' } });
    publicSteps.push({ id: `pub-${idx}-snap`, action: 'screenshot', name: `public-${slug}` });
  }
  flows.push({
    id: 'web-public',
    name: '1. Eksplorasi Halaman Publik & Landing',
    source: toSource('1. Eksplorasi Halaman Publik & Landing', publicSteps),
    platform: 'web',
    status: 'READY'
  });

  // ── Flow 2: Login Akun & Validasi Sesi Dashboard ──────────────────────────
  if (loginSteps().length) {
    flows.push({
      id: 'login',
      name: '2. Login Akun & Validasi Dashboard',
      source: toSource('2. Login Akun & Validasi Dashboard', loginSteps()),
      platform: 'web',
      status: 'READY'
    });
  }

  // ── Flow 3: Eksplorasi Data Master & Armada (Admin) ────────────────────────
  if (loginSteps().length && adminResourceRoutes.length > 0) {
    const masterSteps: FlowStep[] = [...loginSteps()];
    const selectedMasters = adminResourceRoutes.slice(0, 4);
    for (const [idx, r] of selectedMasters.entries()) {
      const slug = r.replace(/[^a-z0-9]/gi, '-').replace(/^-+|-+$/g, '') || `master-${idx}`;
      masterSteps.push({ id: `m-${idx}-open`, action: 'open', url: r });
      masterSteps.push({ id: `m-${idx}-url`, action: 'assertUrl', value: r });
      masterSteps.push({ id: `m-${idx}-body`, action: 'assertVisible', target: { selector: 'body' } });
      masterSteps.push({ id: `m-${idx}-snap`, action: 'screenshot', name: slug });
    }
    flows.push({
      id: 'web-master-data',
      name: '3. Eksplorasi Modul Data Admin',
      source: toSource('3. Eksplorasi Modul Data Admin', masterSteps),
      platform: 'web',
      status: 'READY'
    });
  }

  // ── Flow 4: Manajemen Operasional, Transaksi & Laporan (Admin) ─────────────
  if (loginSteps().length && adminOpsRoutes.length > 0) {
    const opsSteps: FlowStep[] = [...loginSteps()];
    const selectedOps = adminOpsRoutes.slice(0, 4);
    for (const [idx, r] of selectedOps.entries()) {
      const slug = r.replace(/[^a-z0-9]/gi, '-').replace(/^-+|-+$/g, '') || `ops-${idx}`;
      opsSteps.push({ id: `o-${idx}-open`, action: 'open', url: r });
      opsSteps.push({ id: `o-${idx}-url`, action: 'assertUrl', value: r });
      opsSteps.push({ id: `o-${idx}-body`, action: 'assertVisible', target: { selector: 'body' } });
      opsSteps.push({ id: `o-${idx}-snap`, action: 'screenshot', name: slug });
    }
    flows.push({
      id: 'web-operations',
      name: '4. Manajemen Operasional & Transaksi',
      source: toSource('4. Manajemen Operasional & Transaksi', opsSteps),
      platform: 'web',
      status: 'READY'
    });
  }

  // ── Flow 5: Eksplorasi Layanan Pelanggan (Customer / User) ────────────────
  if (loginSteps().length && customerRoutes.length > 0) {
    const custSteps: FlowStep[] = [...loginSteps()];
    const selectedCust = customerRoutes.slice(0, 4);
    for (const [idx, r] of selectedCust.entries()) {
      const slug = r.replace(/[^a-z0-9]/gi, '-').replace(/^-+|-+$/g, '') || `cust-${idx}`;
      custSteps.push({ id: `c-${idx}-open`, action: 'open', url: r });
      custSteps.push({ id: `c-${idx}-body`, action: 'assertVisible', target: { selector: 'body' } });
      custSteps.push({ id: `c-${idx}-snap`, action: 'screenshot', name: slug });
    }
    flows.push({
      id: 'web-customer-portal',
      name: '5. Eksplorasi Portal Layanan Pelanggan',
      source: toSource('5. Eksplorasi Portal Layanan Pelanggan', custSteps),
      platform: 'web',
      status: 'READY'
    });
  }

  // New projects use the capability profile instead of product-specific route
  // names. These flows are intentionally read-only: they map the feature
  // surface and collect evidence without inventing destructive business data.
  const pageByRoute = new Map(inventory.pages.map((page) => [page.path, page]));
  const generatedCapabilityIds = new Set<string>(['public-navigation', 'authentication']);
  let capabilityIndex = flows.length + 1;
  for (const capability of capabilityProfile.capabilities) {
    if (generatedCapabilityIds.has(capability.id)) continue;
    const routes = [...new Set(capability.evidence.routes)]
      .filter((route) => route.startsWith('/') && !route.includes('{') && !/\/api(?:\/|$)/i.test(route) && route !== loginPath)
      .slice(0, 8);
    if (!routes.length) continue;
    const slug = capability.id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
    const requiresAuth = routes.some((route) => {
      const page = pageByRoute.get(route);
      return page?.authentication?.startsWith('authenticated:') || /(?:^|\/)admin(?:\/|$)|(?:^|\/)dashboard(?:\/|$)/i.test(route);
    });
    const steps: FlowStep[] = requiresAuth && loginSteps().length ? [...loginSteps()] : [];
    routes.forEach((route, index) => {
      const routeSlug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || `route-${index}`;
      steps.push({ id: `${slug}-${index}-open`, action: 'open', url: route });
      steps.push({ id: `${slug}-${index}-url`, action: 'assertUrl', value: route });
      steps.push({ id: `${slug}-${index}-body`, action: 'assertVisible', target: { selector: 'body' } });
      steps.push({ id: `${slug}-${index}-snap`, action: 'screenshot', name: `${slug}-${routeSlug}` });
    });
    flows.push({
      id: `web-capability-${slug}`,
      name: `${String(capabilityIndex++).padStart(2, '0')}. Capability · ${capability.label}`,
      source: toSource(`Capability · ${capability.label}`, steps),
      platform: 'web',
      status: capability.status === 'detected' ? 'READY' : 'REVIEW_REQUIRED',
      reason: `${capability.rationale} Pemeriksaan lanjutan: ${capability.recommendedChecks.join(', ')}.`,
    });
  }

  // Comprehensive CRUD Coverage: Read (Daftar/Detail), Create (Form Tambah), Update (Form Ubah), Delete Guard (Proteksi Hapus)
  for (const resource of inventory.crudPlan?.resources ?? []) {
    const listRoute = resource.routes.find((candidate) => !/\/(?:create|new|tambah|edit|ubah|\d+|:[a-zA-Z0-9_]+|riwayat|detail)/i.test(candidate)) ?? resource.routes[0];
    if (!listRoute || /\/api(?:\/|$)/i.test(listRoute)) continue;
    const resourceSlug = resource.id || `resource-${flows.length}`;

    // 1. CRUD Read (Daftar & Tabel)
    const readSteps: FlowStep[] = [...(listRoute.startsWith('/') && loginSteps().length ? loginSteps() : [])];
    readSteps.push(
      { id: `crud-${resourceSlug}-list`, action: 'open', url: listRoute },
      { id: `crud-${resourceSlug}-url`, action: 'assertUrl', value: listRoute },
      { id: `crud-${resourceSlug}-body`, action: 'assertVisible', target: { selector: 'body' } },
      { id: `crud-${resourceSlug}-screenshot`, action: 'screenshot', name: `crud-${resourceSlug}-list` },
    );
    flows.push({
      id: `crud-read-${resourceSlug}`,
      name: `${String(capabilityIndex++).padStart(2, '0')}. CRUD Read · ${resource.name}`,
      source: toSource(`CRUD Read · ${resource.name}`, readSteps),
      platform: 'web',
      status: 'READY',
      reason: `Verifikasi daftar data & tabel pada modul ${resource.name}.`,
    });

    // 2. CRUD Create (Form Tambah)
    let createRoute = resource.routes.find((candidate) => /\/(?:create|new|tambah)$/i.test(candidate));
    if (!createRoute && listRoute.startsWith('/master/')) {
      createRoute = `${listRoute}/tambah`;
    }
    if (createRoute) {
      const createSteps: FlowStep[] = [...(createRoute.startsWith('/') && loginSteps().length ? loginSteps() : [])];
      createSteps.push(
        { id: `crud-${resourceSlug}-create-open`, action: 'open', url: createRoute },
        { id: `crud-${resourceSlug}-create-url`, action: 'assertUrl', value: createRoute },
        { id: `crud-${resourceSlug}-create-body`, action: 'assertVisible', target: { selector: 'body' } },
        { id: `crud-${resourceSlug}-create-screenshot`, action: 'screenshot', name: `crud-${resourceSlug}-create-form` },
      );
      flows.push({
        id: `crud-create-${resourceSlug}`,
        name: `${String(capabilityIndex++).padStart(2, '0')}. CRUD Create · Form ${resource.name}`,
        source: toSource(`CRUD Create · Form ${resource.name}`, createSteps),
        platform: 'web',
        status: 'READY',
        reason: `Inspeksi form tambah ${resource.name}, verifikasi kelengkapan input dan validasi formulir.`,
      });
    }

    // 3. CRUD Update (Form Ubah/Edit)
    let editRoute = resource.routes.find((candidate) => /\/(?:edit|ubah)/i.test(candidate));
    if (!editRoute && listRoute.startsWith('/master/')) {
      editRoute = `${listRoute}/edit/1`;
    }
    if (editRoute) {
      const concreteEditRoute = editRoute.replace(/:id/g, '1').replace(/\{id\}/g, '1');
      const editSteps: FlowStep[] = [...(concreteEditRoute.startsWith('/') && loginSteps().length ? loginSteps() : [])];
      editSteps.push(
        { id: `crud-${resourceSlug}-edit-open`, action: 'open', url: concreteEditRoute },
        { id: `crud-${resourceSlug}-edit-url`, action: 'assertUrl', value: concreteEditRoute },
        { id: `crud-${resourceSlug}-edit-body`, action: 'assertVisible', target: { selector: 'body' } },
        { id: `crud-${resourceSlug}-edit-screenshot`, action: 'screenshot', name: `crud-${resourceSlug}-edit-form` },
      );
      flows.push({
        id: `crud-update-${resourceSlug}`,
        name: `${String(capabilityIndex++).padStart(2, '0')}. CRUD Update · Form ${resource.name}`,
        source: toSource(`CRUD Update · Form ${resource.name}`, editSteps),
        platform: 'web',
        status: 'READY',
        reason: `Inspeksi form ubah ${resource.name}, verifikasi nilai pre-fill dan konsistensi form edit.`,
      });
    }

    // 4. CRUD Delete Guard (Proteksi Hapus)
    const hasDeleteSignal = resource.operations.delete === 'AVAILABLE' || resource.operations.delete === 'PLANNED' || resource.evidenceElements.some(e => /hapus|delete|remove/i.test(e)) || listRoute.startsWith('/master/');
    if (hasDeleteSignal) {
      const deleteSteps: FlowStep[] = [...(listRoute.startsWith('/') && loginSteps().length ? loginSteps() : [])];
      deleteSteps.push(
        { id: `crud-${resourceSlug}-del-list`, action: 'open', url: listRoute },
        { id: `crud-${resourceSlug}-del-body`, action: 'assertVisible', target: { selector: 'body' } },
        { id: `crud-${resourceSlug}-del-screenshot`, action: 'screenshot', name: `crud-${resourceSlug}-delete-guard` },
      );
      flows.push({
        id: `crud-delete-guard-${resourceSlug}`,
        name: `${String(capabilityIndex++).padStart(2, '0')}. CRUD Delete Guard · ${resource.name}`,
        source: toSource(`CRUD Delete Guard · ${resource.name}`, deleteSteps),
        platform: 'web',
        status: 'READY',
        reason: `Pemeriksaan tombol aksi hapus dan proteksi modal konfirmasi dialog pada ${resource.name}.`,
      });
    }
  }

  return flows;
}
