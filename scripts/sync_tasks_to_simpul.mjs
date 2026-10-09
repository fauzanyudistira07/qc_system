/**
 * Sync QC Maestro Oct 1 - Oct 7, 2026 tasks into Simpul (https://simpul.solu.co.id/)
 * Project: Lainnya (LCMMS)
 * Module: QC System
 * Cycle: QC System - Automation Engine
 * Assignee: Fauzan Yudistira
 */

const SIMPUL_URL = 'https://simpul.solu.co.id';
const CREDENTIALS = {
  email: 'fauzan@solu.co.id',
  password: '12345'
};

const TARGET_CONFIG = {
  projectId: 'cmu5cq1270007s90i8pinwlau', // Lainnya (LCMMS)
  moduleId: 'cmugn2zih003tql0i8fn9zake',  // QC System
  cycleId: 'cmuh11zas00hzql0inp6il04d',   // QC System - Automation Engine
  assigneeId: 'cmu5bcshz0004p08pf8k2kpsr',// Fauzan Yudistira
  assigneeName: 'Fauzan Yudistira',
  priority: 'MEDIUM',
  status: 'DONE'
};

export const TASKS_OCTOBER = [
  // Kamis, 1 Oktober 2026 (Phase 11)
  {
    phase: 'P11-01',
    title: 'P11-01 — Full CRUD Test Suite & 3-Choice Auto-Seeder',
    description: 'Mengintegrasikan 3 metode inisialisasi basis data: Auto-seed Laravel, unggah berkas SQL dump, dan koneksi ke Live DB existing untuk pengujian CRUD lengkap.',
    dueDate: '2026-10-01T17:00:00.000Z',
    dateLabel: 'Kamis, 1 Oktober 2026'
  },
  {
    phase: 'P11-02',
    title: 'P11-02 — Continuous 720p 30 FPS Lossless Video Recording',
    description: 'Implementasi perekaman video Playwright terpadu resolusi 720p pada 30 FPS untuk merekam seluruh sesi pengujian aplikasi web secara lossless.',
    dueDate: '2026-10-01T17:00:00.000Z',
    dateLabel: 'Kamis, 1 Oktober 2026'
  },
  {
    phase: 'P11-03',
    title: 'P11-03 — Staging Admin Authentication Gate & HMAC Session Token',
    description: 'Menambahkan gerbang login admin staging dengan otentikasi token session HMAC berbasis backend Fastify dan pembersihan field awal demi keamanan kredensial.',
    dueDate: '2026-10-01T17:00:00.000Z',
    dateLabel: 'Kamis, 1 Oktober 2026'
  },
  {
    phase: 'P11-04',
    title: 'P11-04 — Pemulihan Arsitektur Flagging Mobile Support (Android)',
    description: 'Mengamankan dan memulihkan feature flag ENABLE_MOBILE_SUPPORT untuk kontrol fitur target mobile Android pada monorepo QC Maestro.',
    dueDate: '2026-10-01T17:00:00.000Z',
    dateLabel: 'Kamis, 1 Oktober 2026'
  },

  // Jumat, 2 Oktober 2026 (Phase 12)
  {
    phase: 'P12-01',
    title: 'P12-01 — Android Emulator Subsystem Bridge (ADB & Runner)',
    description: 'Merancang dan mengimplementasikan modul jembatan emulator Android: adb.ts, emulator-runner.ts, dan sistem deteksi perangkat mobile otomatis.',
    dueDate: '2026-10-02T17:00:00.000Z',
    dateLabel: 'Jumat, 2 Oktober 2026'
  },
  {
    phase: 'P12-02',
    title: 'P12-02 — Mobile QC Run Wizard Form (APK Upload & ADB Verify)',
    description: 'Menyediakan form input pengujian aplikasi Android di Wizard: upload file APK, deteksi otomatis packageId dan version, serta verifikasi koneksi ADB.',
    dueDate: '2026-10-02T17:00:00.000Z',
    dateLabel: 'Jumat, 2 Oktober 2026'
  },
  {
    phase: 'P12-03',
    title: 'P12-03 — Maestro YAML Runner Engine & Mobile Pipeline',
    description: 'Menyiapkan engine eksekutor sintaks Maestro YAML untuk pengetesan alur aplikasi mobile native Android dan milestone pipeline execution.',
    dueDate: '2026-10-02T17:00:00.000Z',
    dateLabel: 'Jumat, 2 Oktober 2026'
  },

  // Sabtu, 3 Oktober 2026 (Phase 13)
  {
    phase: 'P13-01',
    title: 'P13-01 — Headless Live Viewport & Remote Stream Control Center',
    description: 'Membangun komponen Live Viewport streaming visual interaktif untuk memantau aksi browser Playwright secara realtime selama audit berlangsung.',
    dueDate: '2026-10-03T17:00:00.000Z',
    dateLabel: 'Sabtu, 3 Oktober 2026'
  },
  {
    phase: 'P13-02',
    title: 'P13-02 — Multi-Project Context Isolation & Active Run Switcher',
    description: 'Mengisolasi penyimpanan artefak, log, dan riwayat attempt antar target audit (Zannora, Cakrawala, Taskia, Jamaahku) dengan dropdown context switcher.',
    dueDate: '2026-10-03T17:00:00.000Z',
    dateLabel: 'Sabtu, 3 Oktober 2026'
  },

  // Minggu, 4 Oktober 2026 (Phase 14)
  {
    phase: 'P14-01',
    title: 'P14-01 — Visual Evidence Gallery & Multi-Media Trace Center',
    description: 'Menyediakan galeri bukti uji komprehensif: screenshot thumbnail, video playback, Playwright trace viewer zip, dan bundle manifest terstruktur.',
    dueDate: '2026-10-04T17:00:00.000Z',
    dateLabel: 'Minggu, 4 Oktober 2026'
  },
  {
    phase: 'P14-02',
    title: 'P14-02 — Automated Defect Triage & Instant Retest Workflow',
    description: 'Implementasi manajemen siklus defect triage (Open -> In Progress -> Ready for Retest -> Passed) dengan komparasi bukti sebelum dan sesudah verifikasi.',
    dueDate: '2026-10-04T17:00:00.000Z',
    dateLabel: 'Minggu, 4 Oktober 2026'
  },

  // Senin, 5 Oktober 2026 (Phase 15)
  {
    phase: 'P15-01',
    title: 'P15-01 — Deep Crawler & Autonomous Route Inventory Discovery',
    description: 'Mengembangkan crawler otonom untuk memindai seluruh rute, link tersembunyi, form action, dan elemen interaktif web aplikasi tanpa batasan.',
    dueDate: '2026-10-05T17:00:00.000Z',
    dateLabel: 'Senin, 5 Oktober 2026'
  },
  {
    phase: 'P15-02',
    title: 'P15-02 — Dynamic Business Flow Synthesis & Functional State Generator',
    description: 'Sintesis otomatis peta alur bisnis aplikasi (BusinessFlowMap) yang mengelompokkan alur fungsional berdasarkan kategori dan aktor.',
    dueDate: '2026-10-05T17:00:00.000Z',
    dateLabel: 'Senin, 5 Oktober 2026'
  },

  // Selasa, 6 Oktober 2026 (Phase 16)
  {
    phase: 'P16-01',
    title: 'P16-01 — Real-Time Interactive Discovery Terminal & ANSI Visualizer',
    description: 'Terminal telemetri langsung discovery dengan parser kode warna ANSI, filter log bertag (SYSTEM, RUNNER, BROWSER, DATABASE), dan auto-scroll.',
    dueDate: '2026-10-06T17:00:00.000Z',
    dateLabel: 'Selasa, 6 Oktober 2026'
  },
  {
    phase: 'P16-02',
    title: 'P16-02 — Granular Network & Database Activity Monitoring Telemetry',
    description: 'Pencatatan telemetri request/response HTTP, status code API, dan query mutasi database yang terjadi selama penelusuran alur pengujian.',
    dueDate: '2026-10-06T17:00:00.000Z',
    dateLabel: 'Selasa, 6 Oktober 2026'
  },

  // Rabu, 7 Oktober 2026 (Phase 17)
  {
    phase: 'P17-01',
    title: 'P17-01 — Streamline Wizard Form (Prioritas DB & Form Akun Kedua)',
    description: 'Menata ulang Langkah 1 Wizard QC Maestro: penempatan metode inisialisasi basis data di paling atas (Seksi 1) dan form kredensial akun di seksi kedua.',
    dueDate: '2026-10-07T17:00:00.000Z',
    dateLabel: 'Rabu, 7 Oktober 2026'
  },
  {
    phase: 'P17-02',
    title: 'P17-02 — Eliminasi Clutter Form & Enforce 100% Deep Testing Matrix',
    description: 'Membersihkan seluruh saklar/pill clutter form dan mengaktifkan 100% kapabilitas pengujian mendalam (3 browser, 3 viewport, max depth 8, unconstrained routes) di balik layar.',
    dueDate: '2026-10-07T17:00:00.000Z',
    dateLabel: 'Rabu, 7 Oktober 2026'
  },
  {
    phase: 'P17-03',
    title: 'P17-03 — Mandatory Business Flow Review Gate & Auto-Switch Terminal',
    description: 'Jeda review wajib (WAITING_REVIEW) setelah sintesis alur bisnis sebelum eksekusi terminal berjalan. Otomatis redirect ke Flow visualizer dan kembali ke live terminal setelah acc.',
    dueDate: '2026-10-07T17:00:00.000Z',
    dateLabel: 'Rabu, 7 Oktober 2026'
  },
  {
    phase: 'P17-04',
    title: 'P17-04 — Modernisasi Papan Review Linear-Style Wizard Langkah 2',
    description: 'Mendesain ulang papan review konfirmasi akhir Linear-style yang merangkum seluruh form: Target Frontend/API probe, Database method, Akun audit, dan matrix kapabilitas 100%.',
    dueDate: '2026-10-07T17:00:00.000Z',
    dateLabel: 'Rabu, 7 Oktober 2026'
  },
  {
    phase: 'P17-05',
    title: 'P17-05 — Sistem Pelaporan Mutu & Atribusi Error (User App vs QC Engine)',
    description: 'Perhitungan persentase skor kelulusan dinamis dan pemisahan tegas sumber defek antara bug kode aplikasi user vs runner engine QC Maestro pada kartu KPI dan laporan.',
    dueDate: '2026-10-07T17:00:00.000Z',
    dateLabel: 'Rabu, 7 Oktober 2026'
  },
  {
    phase: 'P17-06',
    title: 'P17-06 — Integrasi Defect Ledger & Verifikasi Monorepo QC Maestro',
    description: 'Menambahkan tabel Defect Ledger lengkap dengan jejak diagnosis teknis, failure thumbnail zoom, dan advice perbaikan pada dashboard dan ekspor PDF/HTML, serta verifikasi build monorepo.',
    dueDate: '2026-10-07T17:00:00.000Z',
    dateLabel: 'Rabu, 7 Oktober 2026'
  }
];

export async function loginSimpul() {
  const res = await fetch(`${SIMPUL_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS)
  });
  if (!res.ok) {
    throw new Error(`Login failed with status ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  const sessionCookie = setCookie ? setCookie.split(';')[0] : '';
  const data = await res.json();
  return {
    userId: data.user.id,
    userName: data.user.name,
    cookie: sessionCookie
  };
}

export async function syncTasksToSimpul(dryRun = true) {
  console.log(`[SIMPUL SYNC] Starting sync (dryRun: ${dryRun})...`);
  const session = await loginSimpul();
  console.log(`[SIMPUL SYNC] Logged in as: ${session.userName} (${session.userId})`);

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': session.cookie,
    'Authorization': `Bearer ${session.userId}`
  };

  // 1. Get current work items in LCMMS to avoid duplicate insertions
  const checkRes = await fetch(`${SIMPUL_URL}/api/work-items?projectId=${TARGET_CONFIG.projectId}`, { headers });
  const checkData = await checkRes.json();
  const existingItems = checkData.items || [];
  console.log(`[SIMPUL SYNC] Current total items in project: ${existingItems.length}`);

  const results = [];
  for (const task of TASKS_OCTOBER) {
    const isAlreadyPresent = existingItems.some(item => 
      item.title.trim().startsWith(task.phase) || 
      item.title.trim().toLowerCase().includes(task.title.toLowerCase())
    );

    if (isAlreadyPresent) {
      console.log(`[SIMPUL SYNC] Task already exists, skipping: ${task.title}`);
      results.push({ task: task.phase, status: 'EXISTS' });
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would create: [${task.phase}] ${task.title} (due: ${task.dueDate})`);
      results.push({ task: task.phase, status: 'WOULD_CREATE' });
    } else {
      console.log(`[CREATING] [${task.phase}] ${task.title}...`);
      const createRes = await fetch(`${SIMPUL_URL}/api/work-items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: TARGET_CONFIG.projectId,
          moduleId: TARGET_CONFIG.moduleId,
          cycleId: TARGET_CONFIG.cycleId,
          assigneeId: TARGET_CONFIG.assigneeId,
          assigneeName: TARGET_CONFIG.assigneeName,
          title: task.title,
          description: task.description,
          status: TARGET_CONFIG.status,
          priority: TARGET_CONFIG.priority,
          dueDate: task.dueDate
        })
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error(`[ERROR] Failed to create ${task.phase}:`, errText);
        results.push({ task: task.phase, status: 'ERROR', error: errText });
      } else {
        const created = await createRes.json();
        console.log(`[CREATED] ${task.phase} -> LCMMS-${created.item?.number || '?'}`);
        results.push({ task: task.phase, status: 'CREATED', number: created.item?.number });
      }
    }
  }

  return results;
}

if (process.argv[1] && process.argv[1].endsWith('sync_tasks_to_simpul.mjs')) {
  const isCommit = process.argv.includes('--commit');
  syncTasksToSimpul(!isCommit)
    .then(r => console.log('[SIMPUL SYNC] Done:', r.length, 'tasks evaluated.'))
    .catch(console.error);
}
