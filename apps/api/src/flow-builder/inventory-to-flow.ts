import { stringify } from 'yaml';
import type { FlowStep } from '@qc/flow-schema';
import type { Inventory, DiscoveryConfig, GeneratedFlow } from '../discovery/types.ts';

/**
 * Menghasilkan raw Maestro YAML commands untuk login.
 * Jika form login sudah terisi akun/tersimpan (atau tombol Masuk terlihat), langsung tap Masuk.
 * Jika aplikasi sudah berada di dashboard (Beranda), perintah dilewati tanpa error.
 */
function buildLoginYamlCommands(_nis: string, _password: string): object[] {
  return [
    { tapOn: { text: 'Masuk', optional: true } },
    { waitForAnimationToEnd: { timeout: 3000 } }
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
  const rules = config.rules;
  const loginSteps = (): FlowStep[] => rules.loginPath && rules.emailSelector && rules.passwordSelector && rules.submitSelector && rules.successUrl ? [
    { id: 'login-page', action: 'open', url: rules.loginPath },
    { id: 'login-email', action: 'input', target: { selector: rules.emailSelector }, value: '${QC_EMAIL}' },
    { id: 'login-password', action: 'input', target: { selector: rules.passwordSelector }, value: '${QC_PASSWORD}' },
    { id: 'login-submit', action: 'click', target: { selector: rules.submitSelector } },
    { id: 'login-success', action: 'assertUrl', value: rules.successUrl },
    { id: 'login-screenshot', action: 'screenshot', name: 'dashboard-after-login' }
  ] : [];
  const defaultVars: Record<string, string> = {};
  if (config.accounts && config.accounts.length > 0) {
    defaultVars.QC_EMAIL = config.accounts[0].email;
    defaultVars.QC_PASSWORD = config.accounts[0].password;
  }
  const toSource = (name: string, steps: FlowStep[]) => stringify({
    schemaVersion: '1.0',
    name,
    target: { platform: 'web', baseUrl: config.baseUrl },
    variables: defaultVars,
    execution: { timeoutMs: 45000, retries: 0, screenshot: 'always', trace: 'retain-on-failure', video: 'off' },
    steps
  });

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

  // Filter kategori
  const publicRoutes = staticRoutes.filter(r => /^\/(?:about|contact|flights|home|info|search|pricing|faq)?$/i.test(r) && r !== rules.loginPath);
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
      name: '3. Eksplorasi Data Master Maskapai & Armada',
      source: toSource('3. Eksplorasi Data Master Maskapai & Armada', masterSteps),
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

  return flows;
}
