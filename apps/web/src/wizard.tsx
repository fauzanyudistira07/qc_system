import React, { useState, useRef, useEffect } from 'react';
import { errorText, send } from './api';
import { Config, initialConfig, Job, SystemStatus, ENABLE_MOBILE_SUPPORT, ServiceTargetConfig } from './types';
import { Badge, Field, Icon, Notice, Panel } from './ui';

const steps = ['Target & Backend', 'Akun & Data Uji', 'Review & Jalankan'];
const lines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

export function Wizard({
  onCreated,
  system,
  initialJob,
  onCancelEdit,
}: {
  onCreated: (job: Job) => void;
  system: SystemStatus | null;
  initialJob?: Job | null;
  onCancelEdit?: () => void;
}) {
  const [config, setConfig] = useState<Config>(() => {
    if (initialJob?.config) {
      const cfg = initialJob.config;
      return {
        ...initialConfig(),
        ...cfg,
        name: initialJob.name || cfg.name || '',
        sourceType: cfg.sourceType ?? (cfg.runMode === 'managed-local' ? (cfg.backendMode === 'local' ? 'local-folder' : 'github') : 'existing-target'),
        platform: ENABLE_MOBILE_SUPPORT ? (cfg.platform ?? 'web') : 'web',
        baseUrl: cfg.baseUrl ?? '',
        backendUrl: cfg.backendUrl || (cfg.platform === 'android' ? cfg.baseUrl : '') || '',
        appId: cfg.appId || '',
        apkUploadId: cfg.apkUploadId || '',
        apkFilename: cfg.apkFilename || '',
        deviceId: cfg.deviceId || system?.adb?.devices?.[0] || 'emulator-5554',
        useServerEmulator: cfg.useServerEmulator !== false,
        frontendTarget: cfg.frontendTarget || {
          mode: (cfg.sourceType === 'github' || cfg.runMode === 'managed-local') ? 'server' : (cfg.baseUrl?.includes('localhost') || cfg.baseUrl?.includes('127.0.0.1') || cfg.baseUrl?.includes('192.168.')) ? 'local' : 'internet',
          url: cfg.baseUrl || 'http://localhost:5173',
          repositoryUrl: cfg.repositoryUrl || '',
          branch: cfg.ref || 'main',
        },
        backendTarget: cfg.backendTarget || {
          mode: cfg.backendMode === 'repo' ? 'server' : (cfg.backendUrl?.includes('localhost') || cfg.backendUrl?.includes('127.0.0.1') || cfg.backendUrl?.includes('10.0.2.2') || cfg.backendUrl?.includes('192.168.')) ? 'local' : 'internet',
          url: cfg.backendUrl || (cfg.platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000'),
          repositoryUrl: cfg.backendMode === 'repo' ? (cfg.repositoryUrl || '') : '',
          branch: cfg.ref || 'main',
        },
        runMode: cfg.runMode || 'existing-target',
        accounts: (cfg.accounts && cfg.accounts.length > 0) ? cfg.accounts : initialConfig().accounts,
        database: cfg.database || initialConfig().database,
        rules: cfg.rules || initialConfig().rules,
        businessFlowReview: { ...initialConfig().businessFlowReview, ...(cfg.businessFlowReview || {}) },
        qualityAudit: { ...initialConfig().qualityAudit, ...(cfg.qualityAudit || {}) },
      };
    }
    return {
      ...initialConfig(),
      deviceId: system?.adb?.devices?.[0] || 'emulator-5554',
    };
  });
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');
  const [filenames, setFilenames] = useState({ sql: '', env: '' });
  const [paths, setPaths] = useState(() => ({
    include: (initialJob?.config?.rules?.includePaths ?? []).join('\n'),
    exclude: (initialJob?.config?.rules?.excludePaths ?? ['/logout', '/delete']).join('\n'),
  }));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showQualityExpert, setShowQualityExpert] = useState(false);
  const [showManualAccounts, setShowManualAccounts] = useState(false);

  // Connectivity Probe States (Realtime Reachability Check)
  const [probingFe, setProbingFe] = useState(false);
  const [feProbeResult, setFeProbeResult] = useState<{ reachable: boolean; message: string; responseTimeMs?: number } | null>(null);
  const [probingBe, setProbingBe] = useState(false);
  const [beProbeResult, setBeProbeResult] = useState<{ reachable: boolean; message: string; responseTimeMs?: number } | null>(null);

  // Dropzone & file input refs
  const [dragOverApk, setDragOverApk] = useState(false);
  const [dragOverSql, setDragOverSql] = useState(false);
  const [dragOverEnv, setDragOverEnv] = useState(false);
  const apkInputRef = useRef<HTMLInputElement | null>(null);
  const sqlInputRef = useRef<HTMLInputElement | null>(null);
  const envInputRef = useRef<HTMLInputElement | null>(null);

  // APK info & install status
  const [apkInfo, setApkInfo] = useState<{ id: string; filename: string; size: number; packageId?: string; appName?: string; versionName?: string } | null>(() => {
    if (initialJob?.config?.apkFilename || initialJob?.config?.apkUploadId) {
      return {
        id: initialJob.config.apkUploadId || '',
        filename: initialJob.config.apkFilename || 'application.apk',
        size: 0,
        packageId: initialJob.config.appId,
      };
    }
    return null;
  });
  const [installingApk, setInstallingApk] = useState(false);
  const [installStatus, setInstallStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (initialJob?.config) {
      const cfg = initialJob.config;
      setConfig({
        ...initialConfig(),
        ...cfg,
        name: initialJob.name || cfg.name || '',
        sourceType: cfg.sourceType ?? (cfg.runMode === 'managed-local' ? (cfg.backendMode === 'local' ? 'local-folder' : 'github') : 'existing-target'),
        platform: ENABLE_MOBILE_SUPPORT ? (cfg.platform ?? 'web') : 'web',
        baseUrl: cfg.baseUrl ?? '',
        backendUrl: cfg.backendUrl || (cfg.platform === 'android' ? cfg.baseUrl : '') || '',
        appId: cfg.appId || '',
        apkUploadId: cfg.apkUploadId || '',
        apkFilename: cfg.apkFilename || '',
        deviceId: cfg.deviceId || system?.adb?.devices?.[0] || 'emulator-5554',
        useServerEmulator: cfg.useServerEmulator !== false,
        frontendTarget: cfg.frontendTarget || {
          mode: (cfg.sourceType === 'github' || cfg.runMode === 'managed-local') ? 'server' : (cfg.baseUrl?.includes('localhost') || cfg.baseUrl?.includes('127.0.0.1') || cfg.baseUrl?.includes('192.168.')) ? 'local' : 'internet',
          url: cfg.baseUrl || 'http://localhost:5173',
          repositoryUrl: cfg.repositoryUrl || '',
          branch: cfg.ref || 'main',
        },
        backendTarget: cfg.backendTarget || {
          mode: cfg.backendMode === 'repo' ? 'server' : (cfg.backendUrl?.includes('localhost') || cfg.backendUrl?.includes('127.0.0.1') || cfg.backendUrl?.includes('10.0.2.2') || cfg.backendUrl?.includes('192.168.')) ? 'local' : 'internet',
          url: cfg.backendUrl || (cfg.platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000'),
          repositoryUrl: cfg.backendMode === 'repo' ? (cfg.repositoryUrl || '') : '',
          branch: cfg.ref || 'main',
        },
        runMode: cfg.runMode || 'existing-target',
        accounts: (cfg.accounts && cfg.accounts.length > 0) ? cfg.accounts : initialConfig().accounts,
        database: cfg.database || initialConfig().database,
        rules: cfg.rules || initialConfig().rules,
        businessFlowReview: { ...initialConfig().businessFlowReview, ...(cfg.businessFlowReview || {}) },
        qualityAudit: { ...initialConfig().qualityAudit, ...(cfg.qualityAudit || {}) },
      });
      setPaths({
        include: (cfg.rules?.includePaths ?? []).join('\n'),
        exclude: (cfg.rules?.excludePaths ?? ['/logout', '/delete']).join('\n'),
      });
      if (cfg.apkFilename || cfg.apkUploadId) {
        setApkInfo({
          id: cfg.apkUploadId || '',
          filename: cfg.apkFilename || 'application.apk',
          size: 0,
          packageId: cfg.appId,
        });
      }
    }
  }, [initialJob, system]);

  const patch = (value: Partial<Config>) => setConfig(c => ({ ...c, ...value }));
  const db = (value: Partial<Config['database']>) => setConfig(c => ({ ...c, database: { ...c.database, ...value } }));
  const rule = (value: Partial<Config['rules']>) => setConfig(c => ({ ...c, rules: { ...c.rules, ...value } }));
  const quality = (value: Partial<Config['qualityAudit']>) => setConfig(c => ({ ...c, qualityAudit: { ...initialConfig().qualityAudit, ...c.qualityAudit, ...value } }));
  const updateService = (index: number, value: Partial<Config['services'][number]>) => setConfig(c => ({ ...c, services: c.services.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) }));

  const updateFrontendTarget = (patchVal: Partial<ServiceTargetConfig>) => {
    setConfig(c => {
      const prev = c.frontendTarget || {
        mode: 'local',
        url: c.baseUrl || 'http://localhost:5173',
        repositoryUrl: c.repositoryUrl || '',
        branch: c.ref || 'main'
      };
      const next = { ...prev, ...patchVal };
      if (patchVal.mode === 'server' && prev.mode !== 'server') {
        try {
          const currentPort = Number(new URL(next.url).port);
          if (currentPort && (currentPort < 5000 || currentPort > 6000)) {
            next.url = next.url.replace(`:${currentPort}`, ':5000');
          }
        } catch {
          if (!next.url) next.url = 'http://localhost:5000';
        }
      } else if (patchVal.mode === 'local' && prev.mode === 'server') {
        try {
          const currentPort = Number(new URL(next.url).port);
          if (currentPort === 5000) {
            next.url = next.url.replace(':5000', ':5173');
          }
        } catch {
          if (!next.url) next.url = 'http://localhost:5173';
        }
      }

      const syncBackend = c.backendTarget?.sameRepoAsFrontend;
      const nextBackend = syncBackend ? {
        ...(c.backendTarget || {
          mode: next.mode,
          url: c.backendUrl || (c.platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000'),
          repositoryUrl: next.repositoryUrl,
          branch: next.branch
        }),
        repositoryUrl: next.repositoryUrl,
        branch: next.branch,
        mode: next.mode,
      } : c.backendTarget;

      return {
        ...c,
        frontendTarget: next,
        baseUrl: next.url,
        repositoryUrl: next.repositoryUrl || c.repositoryUrl,
        ref: next.branch || c.ref,
        ...(syncBackend ? { backendTarget: nextBackend } : {}),
      };
    });
    setFeProbeResult(null);
  };

  const updateBackendTarget = (patchVal: Partial<ServiceTargetConfig>) => {
    setConfig(c => {
      const prev = c.backendTarget || {
        mode: 'local',
        url: c.backendUrl || (c.platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000'),
        repositoryUrl: '',
        branch: 'main'
      };
      const next = { ...prev, ...patchVal };
      if (patchVal.mode === 'server' && prev.mode !== 'server') {
        try {
          const currentPort = Number(new URL(next.url).port);
          if (currentPort && (currentPort < 5000 || currentPort > 6000)) {
            next.url = next.url.replace(`:${currentPort}`, ':5000');
          }
        } catch {
          if (!next.url) next.url = 'http://127.0.0.1:5000';
        }
      } else if (patchVal.mode === 'local' && prev.mode === 'server') {
        try {
          const currentPort = Number(new URL(next.url).port);
          if (currentPort === 5000) {
            next.url = next.url.replace(':5000', ':8000');
          }
        } catch {
          if (!next.url) next.url = 'http://127.0.0.1:8000';
        }
      }
      if (next.sameRepoAsFrontend) {
        next.repositoryUrl = c.frontendTarget?.repositoryUrl || c.repositoryUrl || '';
        next.branch = c.frontendTarget?.branch || c.ref || 'main';
        next.mode = c.frontendTarget?.mode || next.mode;
      }
      return {
        ...c,
        backendTarget: next,
        backendUrl: next.url,
        ...(c.platform === 'android' ? { baseUrl: next.url } : {}),
      };
    });
    setBeProbeResult(null);
  };

  async function probeTarget(kind: 'fe' | 'be') {
    const target = kind === 'fe' ? config.frontendTarget : config.backendTarget;
    const url = target?.url?.trim();
    if (!url) {
      const res = { reachable: false, message: 'Masukkan URL dan port terlebih dahulu.' };
      if (kind === 'fe') setFeProbeResult(res);
      else setBeProbeResult(res);
      return;
    }
    if (kind === 'fe') { setProbingFe(true); setFeProbeResult(null); }
    else { setProbingBe(true); setBeProbeResult(null); }
    try {
      const res = await send<{ reachable: boolean; message: string; responseTimeMs?: number }>('/api/v1/system/probe-target', { url, timeoutMs: 3500 });
      if (kind === 'fe') setFeProbeResult(res);
      else setBeProbeResult(res);
    } catch (e) {
      const res = { reachable: false, message: errorText(e) };
      if (kind === 'fe') setFeProbeResult(res);
      else setBeProbeResult(res);
    } finally {
      if (kind === 'fe') setProbingFe(false);
      else setProbingBe(false);
    }
  }

  function validate(index: number): string {
    if (index === 0) {
      if (!config.name.trim()) return 'Beri nama project / pengujian terlebih dahulu.';
      if (config.platform === 'web') {
        const fe = config.frontendTarget;
        if (!fe?.url?.trim()) return 'Masukkan URL Website target beserta port-nya (misal: http://localhost:5173).';
        if (fe.mode === 'server') {
          try {
            const p = Number(new URL(fe.url).port);
            if (p && (p < 5000 || p > 6000)) {
              return `Pada mode server runner, port frontend harus berada dalam rentang 5000 - 6000 (port saat ini: ${p}). Ubah port ke 5000 - 6000 (contoh: 5000 atau 5173).`;
            }
          } catch {}
        }
        if (!fe?.repositoryUrl?.trim()) return 'Masukkan link repository GitHub frontend untuk validasi kode sumber.';
        if (!fe?.branch?.trim()) return 'Tentukan branch GitHub frontend yang digunakan (misal: main).';
      }
      if (config.platform === 'android' && !config.appId?.trim() && !config.apkUploadId) {
        return 'Unggah file .APK atau masukkan Android Application ID.';
      }
      const be = config.backendTarget;
      if (be) {
        if (!be.url?.trim()) return 'Masukkan URL endpoint Backend API beserta port-nya (misal: http://127.0.0.1:8000).';
        if (be.mode === 'server') {
          try {
            const p = Number(new URL(be.url).port);
            if (p && (p < 5000 || p > 6000)) {
              return `Pada mode server runner, port backend harus berada dalam rentang 5000 - 6000 (port saat ini: ${p}). Ubah port ke 5000 - 6000 (contoh: 5000 atau 5001).`;
            }
          } catch {}
        }
        const beRepo = be.sameRepoAsFrontend ? (config.frontendTarget?.repositoryUrl || be.repositoryUrl) : be.repositoryUrl;
        const beBranch = be.sameRepoAsFrontend ? (config.frontendTarget?.branch || be.branch) : be.branch;
        if (!beRepo?.trim()) return 'Masukkan link repository GitHub backend untuk validasi kode sumber.';
        if (!beBranch?.trim()) return 'Tentukan branch GitHub backend yang digunakan (misal: main).';
      }
    }
    if (index === 1) {
      if (config.database.source === 'seed' || config.database.source === 'migrate') {
        const hasPw = config.accounts?.[0]?.password?.trim();
        if (!hasPw) return 'Masukkan kata sandi default seeder (misal: password atau admin123).';
      } else {
        if (!config.accounts.length) return 'Tambahkan minimal satu akun pengujian.';
        if (config.accounts.some(a => !a.email.trim() || !a.password.trim())) {
          return 'Setiap akun pengujian wajib memiliki email dan kata sandi.';
        }
      }
      if (config.database.engine !== 'none' && config.database.source === 'sql' && !config.database.sqlUploadId) {
        return 'Pilih file .SQL dump atau ubah pilihan ke "Database Backend Aktif".';
      }
      if (config.database.engine !== 'none' && config.database.source === 'migrate' && !config.database.migrationCommand?.trim()) {
        return 'Isi migration command atau pilih sumber database lain.';
      }
      if (config.database.engine !== 'none' && config.database.source === 'seed' && !config.database.seedCommand?.trim() && !seedResult?.success) {
        return 'Isi seed command atau klik 1-Click Auto-Seed.';
      }
      if (config.platform === 'web' && config.qualityAudit?.enabled !== false) {
        if (!config.qualityAudit?.browsers?.length) return 'Pilih minimal satu browser untuk Quality Audit.';
        if (!config.qualityAudit?.viewports?.length) return 'Pilih minimal satu viewport untuk Quality Audit.';
      }
    }
    return '';
  }

  function scrollToWizardTop() {
    try {
      const mainEl = document.querySelector('.main-content');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const workspaceEl = document.querySelector('.workspace-view');
      if (workspaceEl) {
        workspaceEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  }

  function go(next: number) {
    if (transitioning) return;

    if (next > step) {
      for (let i = 0; i <= step; i++) {
        const issue = validate(i);
        if (issue) {
          setStep(i);
          setError(issue);
          scrollToWizardTop();
          return;
        }
      }

      // Mulai loading transition untuk cegah double-click lompat ke step 3
      setTransitioning(true);
      setError('');
      scrollToWizardTop();

      setTimeout(() => {
        setStep(next);
        scrollToWizardTop();
        setTimeout(() => {
          setTransitioning(false);
          scrollToWizardTop();
        }, 120);
      }, 350);
    } else {
      setError('');
      setStep(next);
      scrollToWizardTop();
    }
  }

  async function upload(file: File | undefined, kind: 'sql' | 'env') {
    if (!file) return;
    setError('');
    if (kind === 'sql' && !file.name.toLowerCase().endsWith('.sql')) { setError('Pilih file SQL berekstensi .sql.'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('Ukuran file maksimum 50 MB.'); return; }
    setUploading(kind);
    try {
      const content = await file.text();
      const result = await send<{ id: string; filename: string; size: number }>('/api/v1/uploads', { filename: file.name, kind, content });
      if (kind === 'sql') {
        db({
          sqlUploadId: result.id,
          source: 'sql',
          engine: config.database.engine === 'none' ? 'mysql' : config.database.engine
        });
      } else {
        patch({ envUploadId: result.id });
      }
      setFilenames(f => ({ ...f, [kind]: result.filename }));
    } catch (e) { setError(errorText(e)); } finally { setUploading(''); }
  }

  async function uploadApk(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.apk')) {
      setError('Pilih file APK berekstensi .apk.');
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      setError('Ukuran file APK maksimum 250 MB.');
      return;
    }
    setUploading('apk');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch(`/api/v1/uploads/apk?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: arrayBuffer,
      });
      if (!res.ok) {
        let errMsg = `Gagal mengunggah file APK (${res.status})`;
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      const data = await res.json() as { id: string; filename: string; size: number; packageId?: string; appName?: string; versionName?: string };
      setApkInfo(data);
      patch({
        platform: 'android',
        apkUploadId: data.id,
        apkFilename: data.filename,
        apkPackageId: data.packageId,
        appId: data.packageId || config.appId || '',
        name: config.name || data.appName || data.filename.replace(/\.apk$/i, ''),
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading('');
    }
  }

  async function installApk() {
    if (!config.apkUploadId) return;
    setInstallingApk(true);
    setInstallStatus(null);
    try {
      const res = await send<{ success: boolean; output: string; device: string }>('/api/v1/android/install-apk', {
        uploadId: config.apkUploadId,
        deviceId: config.deviceId || undefined,
      });
      if (res.success) {
        setInstallStatus({ success: true, message: `Berhasil diinstall ke target: ${res.device}!` });
      } else {
        setInstallStatus({ success: false, message: res.output || 'Gagal menginstall APK ke device.' });
      }
    } catch (e) {
      setInstallStatus({ success: false, message: errorText(e) });
    } finally {
      setInstallingApk(false);
    }
  }

  async function submit() {
    for (let i = 0; i < 2; i++) {
      const issue = validate(i);
      if (issue) {
        setStep(i);
        setError(issue);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const fe = config.frontendTarget || {
        mode: 'local',
        url: config.baseUrl || 'http://localhost:5173',
        repositoryUrl: config.repositoryUrl || '',
        branch: config.ref || 'main',
      };
      const be = config.backendTarget || {
        mode: 'local',
        url: config.backendUrl || (config.platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000'),
        repositoryUrl: '',
        branch: 'main',
      };

      const finalBaseUrl = (config.platform === 'android'
        ? (be.url || config.backendUrl || config.baseUrl || 'http://10.0.2.2:8000')
        : (fe.url || config.baseUrl || 'http://localhost:5173')).trim();
      const finalBackendUrl = (be.url || config.backendUrl || (config.platform === 'android' ? finalBaseUrl : 'http://127.0.0.1:8000')).trim();
      const finalRepoUrl = (fe.repositoryUrl || be.repositoryUrl || config.repositoryUrl || '').trim();
      const finalRef = (fe.branch || be.branch || config.ref || 'main').trim();

      const isServerRun = fe.mode === 'server' || be.mode === 'server';
      const finalRunMode = isServerRun ? 'managed-local' : (config.runMode || 'existing-target');
      const finalSourceType = isServerRun ? 'github' : 'existing-target';
      const finalDeviceId = config.platform === 'android' ? (system?.adb?.devices?.[0] || 'emulator-5554') : undefined;

      const payload: Config = {
        ...config,
        name: config.name.trim(),
        baseUrl: finalBaseUrl,
        backendUrl: finalBackendUrl,
        repositoryUrl: finalRepoUrl,
        ref: finalRef,
        runMode: finalRunMode,
        sourceType: finalSourceType,
        deviceId: finalDeviceId,
        useServerEmulator: true,
        frontendTarget: fe,
        backendTarget: be,
        executeFlows: true,
        businessFlowReview: { mode: 'required' },
        rules: {
          ...config.rules,
          maxPages: 150,
          maxDepth: 8,
          includePaths: lines(paths.include),
          excludePaths: lines(paths.exclude),
        },
        qualityAudit: {
          ...config.qualityAudit,
          enabled: true,
          browsers: ['chromium', 'firefox', 'webkit'],
          viewports: ['desktop', 'tablet', 'mobile'],
          maxRoutes: 0,
          routeOffset: 0,
          navigationTimeoutMs: 60000,
          accessibility: true,
          denseData: { enabled: true, syntheticRows: 100, longTextLength: 240 },
          stateTesting: { enabled: true, hover: true, focus: true, disabled: true, loading: true, empty: true, error: true },
          negativeTesting: {
            enabled: true,
            emptyFormValidation: true,
            duplicateSubmissionGuard: true,
            networkFailureHandling: true,
            transactionalScenarios: true,
            mutationFixturePath: '',
            runMutations: false,
          },
        },
      };

      if (initialJob?.id) {
        // EDIT MODE: update existing job and restart discovery
        const updated = await send<Job>(`/api/v1/discovery/jobs/${initialJob.id}`, { ...payload, restart: true }, 'PUT');
        onCreated(updated);
      } else {
        // CREATE MODE
        const created = await send<Job>('/api/v1/discovery/jobs', payload);
        onCreated(created);
        setConfig(initialConfig());
        setStep(0);
        setFilenames({ sql: '', env: '' });
        setPaths({ include: '', exclude: '/logout\n/delete' });
        setApkInfo(null);
        setInstallStatus(null);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wizard">
      {/* 3-STEP PROGRESS HEADER */}
      <ol className="wizard-steps" aria-label="Tahap konfigurasi pengujian">
        {steps.map((name, i) => (
          <li key={name} className={step === i ? 'current' : step > i ? 'done' : ''}>
            <button
              onClick={() => go(i)}
              disabled={busy || !!uploading || transitioning || i > step + 1}
              aria-current={step === i ? 'step' : undefined}
            >
              <span>{step > i ? <Icon name="check" size={14} /> : `0${i + 1}`}</span>
              {name}
            </button>
          </li>
        ))}
      </ol>

      <div className="wizard-layout">
        <Panel className="wizard-main">
          <div className="wizard-intro">
            <span className="eyebrow">LANGKAH 0{step + 1} / 03</span>
            <h2>
              {[
                'Target Aplikasi & Backend Service',
                'Akun Login & Data Pengujian',
                'Tinjau & Mulai Pengujian'
              ][step]}
            </h2>
            <p>
              {[
                ENABLE_MOBILE_SUPPORT
                  ? 'Tentukan aplikasi yang ingin diuji (Flutter Mobile APK atau Website) serta endpoint API backend-nya.'
                  : 'Tentukan aplikasi web yang ingin diuji serta konfigurasi backend dan database-nya.',
                'Atur akun pengujian dan opsi database terhubung untuk eksekusi alur tes otomatis.',
                'Periksa ringkasan konfigurasi sebelum autonomous engine mulai menjalankan pengujian.'
              ][step]}
            </p>
          </div>

          {error && <Notice error>{error}</Notice>}

          <fieldset disabled={busy || !!uploading} className="wizard-fields">
            {/* ================= STEP 0: TARGET & BACKEND ================= */}
            {step === 0 && (
              <>
                {/* 1. PROJECT IDENTITY */}
                <div className="wizard-section-card form-section-card">
                  <div className="section-card-header">
                    <div className="section-header-left">
                      <div className="section-header-icon form-icon-glow">
                        <Icon name="projects" size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ margin: 0 }}>Nama Project &amp; Skenario Pengujian</h3>
                          <span className="section-type-badge form-badge">IDENTITAS RUN</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                          Beri nama pengenal unik untuk membedakan hasil audit, artefak log, dan recording run pengujian ini.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Field label="Nama Project / Pengujian" hint="Beri nama pengenal untuk run pengujian ini.">
                    <input
                      value={config.name}
                      onChange={e => patch({ name: e.target.value })}
                      placeholder={ENABLE_MOBILE_SUPPORT ? "Contoh: Tasdig Flutter Mobile QC atau Portal Sarpras Web" : "Contoh: Jamaahku Travel Agent atau Portal Sarpras Web"}
                      maxLength={120}
                      autoFocus
                    />
                  </Field>
                </div>

                {/* 2. PLATFORM TARGET SELECTOR */}
                {ENABLE_MOBILE_SUPPORT && (
                  <div className="wizard-section-card config-section-card">
                    <div className="section-card-header">
                      <div className="section-header-left">
                        <div className="section-header-icon config-icon-glow">
                          <Icon name="devices" size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ margin: 0 }}>Platform Target Pengujian</h3>
                            <span className="section-type-badge select-badge">ARSITEKTUR</span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                            Pilih runtime target: aplikasi mobile native Android via Maestro Engine atau website responsif via Playwright.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="platform-choice-grid">
                      <button
                        type="button"
                        className={`choice-card ${config.platform === 'android' ? 'selected' : ''}`}
                        onClick={() => patch({
                          platform: 'android',
                          baseUrl: config.backendUrl || 'http://10.0.2.2:8000',
                        })}
                      >
                        <div className="choice-card-icon">
                          <Icon name="android" size={26} />
                        </div>
                        <div className="choice-card-content">
                          <strong>Mobile App (Flutter / Android APK)</strong>
                          <p>Pengujian aplikasi mobile native pada Emulator atau Device fisik menggunakan Maestro Engine.</p>
                        </div>
                        {config.platform === 'android' && <span className="choice-check"><Icon name="check" size={14} /></span>}
                      </button>

                      <button
                        type="button"
                        className={`choice-card ${config.platform === 'web' ? 'selected' : ''}`}
                        onClick={() => patch({
                          platform: 'web',
                          baseUrl: config.baseUrl || 'http://localhost:3000',
                        })}
                      >
                        <div className="choice-card-icon">
                          <Icon name="globe" size={26} />
                        </div>
                        <div className="choice-card-content">
                          <strong>Web Application / Portal</strong>
                          <p>Pengujian website responsif pada browser Chromium headless/headful menggunakan Playwright.</p>
                        </div>
                        {config.platform === 'web' && <span className="choice-check"><Icon name="check" size={14} /></span>}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. TARGET SECTION: ANDROID APK */}
                {config.platform === 'android' && ENABLE_MOBILE_SUPPORT && (
                  <div className="wizard-section-card target-card-section">
                    <div className="section-card-header">
                      <div className="section-header-left">
                        <div className="section-header-icon config-icon-glow">
                          <Icon name="android" size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ margin: 0 }}>Target Binary Aplikasi (.APK)</h3>
                            <span className="section-type-badge select-badge">MAESTRO RUNNER</span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                            Upload file build APK (misal dari project Flutter) untuk pengujian Maestro Engine.
                          </p>
                        </div>
                      </div>
                      <Badge value={apkInfo ? 'APK Ready' : 'Siapkan APK'} />
                    </div>

                    {!apkInfo ? (
                      <div
                        className={`apk-upload-dropzone ${dragOverApk ? 'drag-over' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOverApk(true); }}
                        onDragLeave={() => setDragOverApk(false)}
                        onDrop={e => {
                          e.preventDefault();
                          setDragOverApk(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) void uploadApk(file);
                        }}
                        onClick={() => apkInputRef.current?.click()}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="apk-upload-icon">
                          <Icon name="android" size={32} />
                        </div>
                        <div className="apk-upload-text">
                          <strong>Tarik & Geser File .APK ke Sini, atau Klik untuk Memilih</strong>
                          <p>Mendukung APK debug/release dari Flutter. Package ID & nama aplikasi akan terdeteksi otomatis.</p>
                        </div>
                        <input
                          ref={apkInputRef}
                          type="file"
                          accept=".apk"
                          disabled={!!uploading}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) void uploadApk(file);
                          }}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          className="apk-upload-btn"
                          disabled={!!uploading}
                          onClick={e => {
                            e.stopPropagation();
                            apkInputRef.current?.click();
                          }}
                        >
                          <Icon name="plus" size={15} />
                          {uploading === 'apk' ? 'Mengunggah APK…' : 'Pilih File .APK'}
                        </button>
                      </div>
                    ) : (
                      <div className="apk-card">
                        <div className="apk-card-header">
                          <div className="apk-card-title">
                            <span className="apk-icon-badge">
                              <Icon name="android" size={24} />
                            </span>
                            <div>
                              <strong>{apkInfo.appName || apkInfo.filename}</strong>
                              <div className="apk-meta-row">
                                <span className="apk-package-badge mono">{apkInfo.packageId || 'Package ID terdeteksi'}</span>
                                {apkInfo.versionName && <span className="apk-ver-badge">v{apkInfo.versionName}</span>}
                                <span className="muted">{(apkInfo.size / (1024 * 1024)).toFixed(1)} MB</span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="quiet danger-text"
                            onClick={() => {
                              setApkInfo(null);
                              setInstallStatus(null);
                              patch({ apkUploadId: undefined, apkFilename: undefined, apkPackageId: undefined });
                            }}
                          >
                            Ganti APK
                          </button>
                        </div>

                        <div className="apk-install-panel">
                          <div className="apk-install-meta">
                            <Icon name="device" size={16} />
                            <span>
                              {system?.adb?.devices && system.adb.devices.length > 0
                                ? `${system.adb.devices.length} Device/Emulator online terdeteksi`
                                : 'ADB siap menghubungkan ke device / emulator'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="install-btn"
                            disabled={installingApk}
                            onClick={() => void installApk()}
                          >
                            {installingApk ? 'Menginstall via ADB…' : 'Install ke Emulator / Device'}
                          </button>
                        </div>

                        {installStatus && (
                          <div className={`install-banner ${installStatus.success ? 'success' : 'error'}`}>
                            <Icon name={installStatus.success ? 'check' : 'warning'} size={16} />
                            <span>{installStatus.message}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="form-grid" style={{ marginTop: 14 }}>
                      <Field label="Application ID / Package Name" hint="Otomatis terisi dari file APK atau masukkan ID aplikasi Flutter Anda.">
                        <input
                          value={config.appId || ''}
                          placeholder="com.example.tasdig"
                          onChange={e => patch({ appId: e.target.value })}
                        />
                      </Field>
                    </div>

                    {/* SERVER EMULATOR ZERO-CONFIG BANNER */}
                    <div className="server-emulator-box">
                      <div className="server-emulator-box-left">
                        <div className="server-emulator-glow-dot">
                          <Icon name="android" size={20} />
                          <span className="live-pulse-dot" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong>Server Android Emulator (Otomatis Terhubung)</strong>
                            <span className="section-type-badge select-badge">DEFAULT SERVER AVD</span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                            Pengujian otomatis berjalan di emulator server terpasang: <code className="mono">{system?.adb?.devices?.[0] || 'emulator-5554'}</code>. Tidak memerlukan konfigurasi manual perangkat.
                          </p>
                        </div>
                      </div>
                      <div className="server-emulator-tag">
                        <span className="status-dot active" />
                        <span>Ready on Server</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= TARGET SECTION: WEB APP (TRI-MODE RUNTIME) ================= */}
                {config.platform === 'web' && (
                  <div className="wizard-section-card target-card-section">
                    <div className="section-card-header">
                      <div className="section-header-left">
                        <div className="section-header-icon config-icon-glow">
                          <Icon name="globe" size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ margin: 0 }}>Target Frontend Website</h3>
                            <span className="section-type-badge form-badge">TRI-MODE RUNTIME</span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                            Tentukan lingkungan eksekusi frontend, isi URL beserta port, serta tautan repository GitHub &amp; branch untuk validasi dan auto-deploy.
                          </p>
                        </div>
                      </div>
                      <Badge value={(config.frontendTarget?.mode || 'local') === 'local' ? 'Jaringan Lokal' : (config.frontendTarget?.mode || 'local') === 'internet' ? 'Akses Internet' : 'Jalankan di Server'} />
                    </div>

                    {/* TRI-MODE SELECTOR FOR FRONTEND */}
                    <div className="tri-mode-grid">
                      <button
                        type="button"
                        className={`tri-mode-card ${(config.frontendTarget?.mode || 'local') === 'local' ? 'selected' : ''}`}
                        onClick={() => updateFrontendTarget({ mode: 'local' })}
                      >
                        <div className="tri-mode-card-header">
                          <div className="tri-mode-icon-circle">
                            <Icon name="terminal" size={16} />
                          </div>
                          <div className="tri-mode-header-right">
                            <span className="tri-mode-badge">LOKAL</span>
                            {(config.frontendTarget?.mode || 'local') === 'local' && (
                              <span className="tri-mode-check"><Icon name="check" size={11} /></span>
                            )}
                          </div>
                        </div>
                        <strong>Jaringan Lokal</strong>
                        <p>Frontend berjalan di localhost / LAN komputer Anda. Server QC cek ketersediaan URL &amp; port.</p>
                      </button>

                      <button
                        type="button"
                        className={`tri-mode-card ${(config.frontendTarget?.mode || 'local') === 'internet' ? 'selected' : ''}`}
                        onClick={() => updateFrontendTarget({ mode: 'internet' })}
                      >
                        <div className="tri-mode-card-header">
                          <div className="tri-mode-icon-circle">
                            <Icon name="globe" size={16} />
                          </div>
                          <div className="tri-mode-header-right">
                            <span className="tri-mode-badge">INTERNET</span>
                            {(config.frontendTarget?.mode || 'local') === 'internet' && (
                              <span className="tri-mode-check"><Icon name="check" size={11} /></span>
                            )}
                          </div>
                        </div>
                        <strong>Akses Internet</strong>
                        <p>Frontend aktif di domain publik / cloud staging. Server QC mengakses langsung via internet.</p>
                      </button>

                      <button
                        type="button"
                        className={`tri-mode-card ${(config.frontendTarget?.mode || 'local') === 'server' ? 'selected' : ''}`}
                        onClick={() => updateFrontendTarget({ mode: 'server' })}
                      >
                        <div className="tri-mode-card-header">
                          <div className="tri-mode-icon-circle">
                            <Icon name="git" size={16} />
                          </div>
                          <div className="tri-mode-header-right">
                            <span className="tri-mode-badge">SERVER RUNNER</span>
                            {(config.frontendTarget?.mode || 'local') === 'server' && (
                              <span className="tri-mode-check"><Icon name="check" size={11} /></span>
                            )}
                          </div>
                        </div>
                        <strong>Jalankan di Server</strong>
                        <p>Server QC otomatis clone repository dari GitHub dan jalankan frontend di port server terisolasi.</p>
                      </button>
                    </div>

                    {/* INPUT: URL WEBSITE & PORT WITH PROBE TEST */}
                    <div className="target-input-block" style={{ marginTop: 16 }}>
                      <div className="field-with-probe">
                        <Field
                          label="URL Website &amp; Port Target"
                          hint={
                            (config.frontendTarget?.mode || 'local') === 'local'
                              ? 'Contoh: http://localhost:5173 atau http://192.168.1.50:3000. Server akan mengecek apakah website sedang berjalan di sana.'
                              : (config.frontendTarget?.mode || 'local') === 'internet'
                              ? 'Contoh: https://staging.app.example.com atau http://103.20.10.5:8080. Akses publik via internet.'
                              : 'Alokasi port server: rentang 5000 - 6000 (contoh: http://localhost:5000). Server membuka port ini pada sandbox runner.'
                          }
                          wide
                        >
                          <div className="url-probe-input-group">
                            <input
                              type="url"
                              value={config.frontendTarget?.url ?? config.baseUrl ?? ''}
                              onChange={e => updateFrontendTarget({ url: e.target.value })}
                              placeholder={
                                (config.frontendTarget?.mode || 'local') === 'local'
                                  ? 'http://localhost:5173'
                                  : (config.frontendTarget?.mode || 'local') === 'internet'
                                  ? 'https://staging.app.example.com'
                                  : 'http://localhost:5000'
                              }
                            />
                            <button
                              type="button"
                              className="probe-action-btn"
                              disabled={probingFe || !config.frontendTarget?.url?.trim()}
                              onClick={() => probeTarget('fe')}
                              title="Periksa apakah website/port dapat diakses oleh server QC Maestro"
                            >
                              {probingFe ? (
                                <>
                                  <Icon name="refresh" size={14} />
                                  <span>Memeriksa…</span>
                                </>
                              ) : (
                                <>
                                  <Icon name="search" size={14} />
                                  <span>Tes Konektivitas</span>
                                </>
                              )}
                            </button>
                          </div>
                        </Field>
                      </div>

                      {/* PROBE FEEDBACK BANNER */}
                      {feProbeResult && (
                        <div className={`probe-status-banner ${feProbeResult.reachable ? 'success' : 'warning'}`}>
                          <Icon name={feProbeResult.reachable ? 'check' : 'warning'} size={15} />
                          <div className="probe-status-text">
                            <strong>{feProbeResult.reachable ? 'Konektivitas Berhasil' : 'Target Belum Merespons'}</strong>
                            <span>{feProbeResult.message}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* INPUT: GITHUB REPOSITORY & BRANCH */}
                    <div className="form-grid" style={{ marginTop: 14 }}>
                      <Field
                        label="Link Repository GitHub Frontend"
                        hint={
                          (config.frontendTarget?.mode || 'local') === 'server'
                            ? 'Repository yang akan di-clone dan dijalankan otomatis oleh server pada port yang disediakan.'
                            : 'Validasi folder repositori di GitHub untuk verifikasi integritas kode sumber.'
                        }
                      >
                        <input
                          type="url"
                          value={config.frontendTarget?.repositoryUrl ?? config.repositoryUrl ?? ''}
                          onChange={e => updateFrontendTarget({ repositoryUrl: e.target.value })}
                          placeholder="https://github.com/organization/frontend-app"
                        />
                      </Field>
                      <Field
                        label="Branch GitHub Frontend"
                        hint="Branch yang aktif / akan di-checkout saat validasi atau clone."
                      >
                        <input
                          value={config.frontendTarget?.branch ?? config.ref ?? 'main'}
                          onChange={e => updateFrontendTarget({ branch: e.target.value })}
                          placeholder="main"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {/* ================= BACKEND & API SERVICE CONFIGURATION (TRI-MODE API) ================= */}
                <div className="wizard-section-card backend-service-section">
                  <div className="section-card-header">
                    <div className="section-header-left">
                      <div className="section-header-icon form-icon-glow">
                        <Icon name="database" size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ margin: 0 }}>Koneksi Backend &amp; API Target</h3>
                          <span className="section-type-badge select-badge">TRI-MODE API</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                          Pilih lokasi runtime backend API target pengujian, tentukan URL endpoint API beserta port, serta tautan repository GitHub &amp; branch.
                        </p>
                      </div>
                    </div>
                    <Badge value={(config.backendTarget?.mode || 'local') === 'local' ? 'Jaringan Lokal' : (config.backendTarget?.mode || 'local') === 'internet' ? 'Akses Internet' : 'Jalankan di Server'} />
                  </div>

                  {/* TRI-MODE SELECTOR FOR BACKEND */}
                  <div className="tri-mode-grid">
                    <button
                      type="button"
                      className={`tri-mode-card ${(config.backendTarget?.mode || 'local') === 'local' ? 'selected' : ''}`}
                      onClick={() => updateBackendTarget({ mode: 'local' })}
                    >
                      <div className="tri-mode-card-header">
                        <div className="tri-mode-icon-circle">
                          <Icon name="terminal" size={16} />
                        </div>
                        <div className="tri-mode-header-right">
                          <span className="tri-mode-badge">LOKAL</span>
                          {(config.backendTarget?.mode || 'local') === 'local' && (
                            <span className="tri-mode-check"><Icon name="check" size={11} /></span>
                          )}
                        </div>
                      </div>
                      <strong>Jaringan Lokal</strong>
                      <p>Backend API aktif di komputer/LAN lokal (misal: Laravel 127.0.0.1:8000 atau Android bridge 10.0.2.2:8000).</p>
                    </button>

                    <button
                      type="button"
                      className={`tri-mode-card ${(config.backendTarget?.mode || 'local') === 'internet' ? 'selected' : ''}`}
                      onClick={() => updateBackendTarget({ mode: 'internet' })}
                    >
                      <div className="tri-mode-card-header">
                        <div className="tri-mode-icon-circle">
                          <Icon name="globe" size={16} />
                        </div>
                        <div className="tri-mode-header-right">
                          <span className="tri-mode-badge">INTERNET</span>
                          {(config.backendTarget?.mode || 'local') === 'internet' && (
                            <span className="tri-mode-check"><Icon name="check" size={11} /></span>
                          )}
                        </div>
                      </div>
                      <strong>Akses Internet</strong>
                      <p>Backend API aktif di cloud staging atau domain publik (misal: https://api.staging.perusahaan.com).</p>
                    </button>

                    <button
                      type="button"
                      className={`tri-mode-card ${(config.backendTarget?.mode || 'local') === 'server' ? 'selected' : ''}`}
                      onClick={() => updateBackendTarget({ mode: 'server' })}
                    >
                      <div className="tri-mode-card-header">
                        <div className="tri-mode-icon-circle">
                          <Icon name="git" size={16} />
                        </div>
                        <div className="tri-mode-header-right">
                          <span className="tri-mode-badge">SERVER RUNNER</span>
                          {(config.backendTarget?.mode || 'local') === 'server' && (
                            <span className="tri-mode-check"><Icon name="check" size={11} /></span>
                          )}
                        </div>
                      </div>
                      <strong>Jalankan di Server</strong>
                      <p>Server QC otomatis clone repository backend dari GitHub dan jalankan di port backend server.</p>
                    </button>
                  </div>

                  {/* SAME REPO AS FRONTEND SHORTCUT (MONOREPO / FULLSTACK) */}
                  {config.platform === 'web' && (
                    <div className="same-repo-toggle-card" style={{
                      marginTop: 14,
                      padding: '12px 16px',
                      background: config.backendTarget?.sameRepoAsFrontend ? 'rgba(53, 208, 186, 0.08)' : 'var(--bg-panel)',
                      border: `1px solid ${config.backendTarget?.sameRepoAsFrontend ? 'rgba(53, 208, 186, 0.35)' : 'var(--border-default)'}`,
                      borderRadius: 8,
                      transition: 'all 0.15s ease'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(config.backendTarget?.sameRepoAsFrontend)}
                          onChange={e => {
                            const checked = e.target.checked;
                            updateBackendTarget({
                              sameRepoAsFrontend: checked,
                              ...(checked ? {
                                repositoryUrl: config.frontendTarget?.repositoryUrl || config.repositoryUrl || '',
                                branch: config.frontendTarget?.branch || config.ref || 'main',
                                mode: config.frontendTarget?.mode || 'server',
                              } : {}),
                            });
                          }}
                          style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer', accentColor: '#35D0BA' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                              Backend berada di folder / repositori yang sama (Fullstack / Monorepo)
                            </strong>
                            {config.backendTarget?.sameRepoAsFrontend && (
                              <Badge value="Tersinkronisasi" />
                            )}
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Aktifkan untuk proyek Next.js, Nuxt, Laravel, atau monorepo di mana endpoint API dan website frontend berada di repositori yang sama. Link repositori &amp; branch akan otomatis tersinkronisasi.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* BACKEND CONFIGURATION GRID (2 PER LINE) */}
                  <div className="form-grid" style={{ marginTop: 16 }}>
                    {/* ROW 1 - COL 1: URL & PORT WITH PROBE */}
                    <Field
                      label="URL Endpoint Backend API &amp; Port"
                      hint={
                        config.platform === 'android'
                          ? 'Tip Android: Gunakan http://10.0.2.2:8000 untuk bridge lokal.'
                          : (config.backendTarget?.mode || 'local') === 'local'
                          ? 'Contoh: http://127.0.0.1:8000. Pengecekan service lokal.'
                          : (config.backendTarget?.mode || 'local') === 'internet'
                          ? 'Contoh: https://api.staging.example.com. Akses internet.'
                          : 'Port backend server: rentang 5000 - 6000 (contoh: http://127.0.0.1:5000).'
                      }
                    >
                      <div className="url-probe-input-group">
                        <input
                          type="url"
                          value={config.backendTarget?.url ?? config.backendUrl ?? ''}
                          onChange={e => updateBackendTarget({ url: e.target.value })}
                          placeholder={
                            config.platform === 'android'
                              ? 'http://10.0.2.2:8000'
                              : (config.backendTarget?.mode || 'local') === 'local'
                              ? 'http://127.0.0.1:8000'
                              : (config.backendTarget?.mode || 'local') === 'internet'
                              ? 'https://api.dev.example.com'
                              : 'http://127.0.0.1:5000'
                          }
                        />
                        <button
                          type="button"
                          className="probe-action-btn"
                          disabled={probingBe || !config.backendTarget?.url?.trim()}
                          onClick={() => probeTarget('be')}
                          title="Periksa apakah endpoint backend API dapat diakses oleh server QC Maestro"
                        >
                          {probingBe ? (
                            <>
                              <Icon name="refresh" size={13} />
                              <span>Memeriksa…</span>
                            </>
                          ) : (
                            <>
                              <Icon name="database" size={13} />
                              <span>Tes API</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* PROBE FEEDBACK BANNER */}
                      {beProbeResult && (
                        <div className={`probe-status-banner ${beProbeResult.reachable ? 'success' : 'warning'}`}>
                          <Icon name={beProbeResult.reachable ? 'check' : 'warning'} size={14} />
                          <div className="probe-status-text">
                            <strong>{beProbeResult.reachable ? 'API Backend Responsif' : 'API Belum Merespons'}</strong>
                            <span>{beProbeResult.message}</span>
                          </div>
                        </div>
                      )}
                    </Field>

                    {/* ROW 1 - COL 2: RUNTIME STACK SELECTOR */}
                    <Field
                      label="Runtime Stack Backend"
                      hint="Deteksi otomatis framework stack atau tentukan runtime manual."
                    >
                      <select value={config.stack} onChange={e => patch({ stack: e.target.value as Config['stack'] })}>
                        <option value="auto">Auto Detect</option>
                        <option value="laravel">Laravel / PHP</option>
                        <option value="custom">Custom Runtime / Node.js / Python</option>
                      </select>
                    </Field>

                    {/* ROW 2 - COL 1: GITHUB REPO */}
                    <Field
                      label="Link Repository GitHub Backend"
                      hint={
                        config.backendTarget?.sameRepoAsFrontend
                          ? 'Tersinkronisasi otomatis dengan repository frontend.'
                          : (config.backendTarget?.mode || 'local') === 'server'
                          ? 'Repository yang akan di-clone & dijalankan server.'
                          : 'Validasi folder repositori backend di GitHub.'
                      }
                    >
                      <input
                        type="url"
                        value={
                          config.backendTarget?.sameRepoAsFrontend
                            ? (config.frontendTarget?.repositoryUrl || config.repositoryUrl || '')
                            : (config.backendTarget?.repositoryUrl ?? '')
                        }
                        onChange={e => updateBackendTarget({ repositoryUrl: e.target.value })}
                        disabled={Boolean(config.backendTarget?.sameRepoAsFrontend)}
                        placeholder="https://github.com/organization/backend-api"
                      />
                    </Field>

                    {/* ROW 2 - COL 2: GITHUB BRANCH */}
                    <Field
                      label="Branch GitHub Backend"
                      hint={
                        config.backendTarget?.sameRepoAsFrontend
                          ? 'Tersinkronisasi otomatis dengan branch frontend.'
                          : 'Branch backend yang digunakan untuk validasi atau clone.'
                      }
                    >
                      <input
                        value={
                          config.backendTarget?.sameRepoAsFrontend
                            ? (config.frontendTarget?.branch || config.ref || 'main')
                            : (config.backendTarget?.branch ?? 'main')
                        }
                        onChange={e => updateBackendTarget({ branch: e.target.value })}
                        disabled={Boolean(config.backendTarget?.sameRepoAsFrontend)}
                        placeholder="main"
                      />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {/* ================= STEP 1: TEST DATA & ACCOUNTS ================= */}
            {step === 1 && (
              <>
                {/* 1. DATABASE & DATA INITIALIZATION (PINDAH PALING ATAS) */}
                <div className="wizard-section-card config-section-card">
                  <div className="section-card-header">
                    <div className="section-header-left">
                      <div className="section-header-icon config-icon-glow">
                        <Icon name="database" size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ margin: 0 }}>Metode Inisialisasi Database &amp; Data Awal</h3>
                          <span className="section-type-badge select-badge">⚙️ SUMBER DATA</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                          Pilih metode penyediaan database sebelum pengujian dimulai: Auto-Seed dari source code, Import file SQL Dump, atau Database Backend yang sedang aktif.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: 14 }}>
                    <Field label="Database Engine" hint="Engine database yang digunakan runner atau container.">
                      <select
                        value={config.database.engine}
                        onChange={e => db({ engine: e.target.value as Config['database']['engine'] })}
                      >
                        <option value="none">Database Host / Aktif (Tanpa Container Khusus)</option>
                        <option value="mysql">MySQL / MariaDB</option>
                        <option value="postgres">PostgreSQL</option>
                        <option value="sqlite">SQLite</option>
                      </select>
                    </Field>
                  </div>

                  <label className="field-label" style={{ marginBottom: 8, display: 'block', fontWeight: 600 }}>
                    Pilih Metode Pengisian Database:
                  </label>

                  <div className="db-choice-grid">
                    {/* OPSI 1: AUTO-SEED / FRAMEWORK SEEDER */}
                    <button
                      type="button"
                      className={`choice-card ${config.database.source === 'seed' || config.database.source === 'migrate' ? 'selected' : ''}`}
                      onClick={() => db({
                        engine: config.database.engine === 'none' ? 'mysql' : config.database.engine,
                        source: 'seed',
                        seedCommand: config.database.seedCommand || 'npm run seed:jamaahku'
                      })}
                    >
                      <div className="choice-card-icon">
                        <Icon name="zap" size={24} />
                      </div>
                      <div className="choice-card-content">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <strong>1. Auto-Seed Dataset / Seeder</strong>
                          <span className="tri-mode-badge" style={{ color: '#15803D' }}>PLAIN PW</span>
                        </div>
                        <p>Memindai seeder backend (misal DatabaseSeeder). Akun &amp; kata sandi otomatis terdeteksi dari source code.</p>
                      </div>
                      {(config.database.source === 'seed' || config.database.source === 'migrate') && <span className="choice-check"><Icon name="check" size={14} /></span>}
                    </button>

                    {/* OPSI 2: IMPORT SQL DUMP */}
                    <button
                      type="button"
                      className={`choice-card ${config.database.source === 'sql' ? 'selected' : ''}`}
                      onClick={() => db({
                        engine: config.database.engine === 'none' ? 'mysql' : config.database.engine,
                        source: 'sql'
                      })}
                    >
                      <div className="choice-card-icon">
                        <Icon name="download" size={24} />
                      </div>
                      <div className="choice-card-content">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <strong>2. Upload File SQL Dump (.sql)</strong>
                          <span className="tri-mode-badge" style={{ color: '#B45309' }}>HASH DB</span>
                        </div>
                        <p>Unggah file dump .sql kustom untuk inisialisasi schema baru. Kata sandi di database tersimpan dalam bentuk hash.</p>
                      </div>
                      {config.database.source === 'sql' && <span className="choice-check"><Icon name="check" size={14} /></span>}
                    </button>

                    {/* OPSI 3: DATABASE BACKEND AKTIF */}
                    <button
                      type="button"
                      className={`choice-card ${config.database.source === 'empty' ? 'selected' : ''}`}
                      onClick={() => db({ engine: 'none', source: 'empty', sqlUploadId: undefined })}
                    >
                      <div className="choice-card-icon">
                        <Icon name="database" size={24} />
                      </div>
                      <div className="choice-card-content">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <strong>3. Database Backend Aktif</strong>
                          <span className="tri-mode-badge" style={{ color: '#B45309' }}>HASH DB</span>
                        </div>
                        <p>Langsung gunakan database yang aktif di backend (port 3306/5432). Kata sandi tersimpan dalam bentuk hash.</p>
                      </div>
                      {config.database.source === 'empty' && <span className="choice-check"><Icon name="check" size={14} /></span>}
                    </button>
                  </div>

                  {/* DETAIL TAMPILAN OPSI 1: AUTO-SEED PRESET & FRAMEWORK COMMAND */}
                  {(config.database.source === 'seed' || config.database.source === 'migrate') && (
                    <div style={{
                      marginTop: 14,
                      padding: '14px 18px',
                      background: 'rgba(56, 189, 248, 0.08)',
                      borderRadius: 10,
                      border: '1px solid rgba(56, 189, 248, 0.25)'
                    }}>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon name="zap" size={16} /> Auto-Seed Dataset Relasional Lengkap
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                            Injeksi otomatis data relasional lengkap (tabel master &amp; transaksi) atau jalankan seeder framework backend.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="primary"
                          disabled={seeding}
                          onClick={async () => {
                            setSeeding(true);
                            setSeedResult(null);
                            try {
                              const res = await fetch('/api/v1/fixtures/seed/jamaahku', { method: 'POST' });
                              const data = await res.json();
                              if (data.success) {
                                setSeedResult({
                                  success: true,
                                  message: `Database berhasil di-seed! Tabel data siap untuk pengujian end-to-end full CRUD.`
                                });
                              } else {
                                setSeedResult({ success: false, message: data.error || 'Gagal seeding database.' });
                              }
                            } catch (err: any) {
                              setSeedResult({ success: false, message: err?.message || 'Gagal menghubungi server QC.' });
                            } finally {
                              setSeeding(false);
                            }
                          }}
                          style={{ whiteSpace: 'nowrap', padding: '8px 18px', fontSize: '0.84rem', fontWeight: 600 }}
                        >
                          {seeding ? '⚡ Menyemai Database...' : '⚡ Jalankan Auto-Seed Sekarang'}
                        </button>
                      </div>
                      {seedResult && (
                        <div style={{
                          marginTop: 10,
                          fontSize: '0.82rem',
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: seedResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: seedResult.success ? '#4ade80' : '#f87171',
                          border: `1px solid ${seedResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {seedResult.success ? '✓ ' : '✗ '}{seedResult.message}
                        </div>
                      )}

                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <Field label="Custom Seeder Command (Opsional untuk Proyek / Framework Lain)" hint="Contoh: php artisan db:seed --force, npx prisma db seed, atau python manage.py loaddata">
                          <input
                            value={config.database.seedCommand || ''}
                            placeholder="php artisan db:seed --force atau npm run seed"
                            onChange={e => db({ seedCommand: e.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* DETAIL TAMPILAN OPSI 2: IMPORT SQL DUMP */}
                  {config.database.source === 'sql' && (
                    <div style={{ marginTop: 16 }}>
                      {!config.database.sqlUploadId ? (
                        <div
                          className={`file-dropzone ${dragOverSql ? 'drag-over' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDragOverSql(true); }}
                          onDragLeave={() => setDragOverSql(false)}
                          onDrop={e => {
                            e.preventDefault();
                            setDragOverSql(false);
                            const f = e.dataTransfer.files?.[0];
                            if (f) void upload(f, 'sql');
                          }}
                          onClick={() => sqlInputRef.current?.click()}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="file-dropzone-icon">
                            <Icon name="database" size={28} />
                          </div>
                          <div className="file-dropzone-text">
                            <strong>Upload File SQL Dump (.sql)</strong>
                            <p>Tarik & geser file .sql ke sini, atau klik untuk memilih file dari komputer (maks. 50 MB).</p>
                          </div>
                          <input
                            ref={sqlInputRef}
                            type="file"
                            accept=".sql"
                            disabled={!!uploading}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) void upload(f, 'sql');
                            }}
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            className="primary"
                            disabled={!!uploading}
                            onClick={e => {
                              e.stopPropagation();
                              sqlInputRef.current?.click();
                            }}
                          >
                            <Icon name="plus" size={14} />
                            {uploading === 'sql' ? 'Mengunggah SQL…' : 'Pilih File .SQL'}
                          </button>
                        </div>
                      ) : (
                        <div className="upload-ready">
                          <Icon name="check" />
                          <div>
                            <strong>{filenames.sql || 'File SQL dump terlampir'}</strong>
                            <small>Siap diinisialisasi ke database runner saat pengujian dimulai.</small>
                          </div>
                          <button
                            type="button"
                            className="quiet danger-text"
                            onClick={() => {
                              db({ sqlUploadId: undefined, source: 'empty', engine: 'none' });
                              setFilenames(f => ({ ...f, sql: '' }));
                            }}
                          >
                            Lepaskan
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DETAIL TAMPILAN OPSI 3: DATABASE BACKEND AKTIF */}
                  {config.database.source === 'empty' && (
                    <div style={{
                      marginTop: 14,
                      padding: '12px 16px',
                      background: 'var(--bg-panel-sub)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <div style={{ color: 'var(--success)' }}><Icon name="check" size={20} /></div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 2 }}>Mode Database Backend Aktif Terpilih</strong>
                        QC Maestro langsung menggunakan database yang saat ini aktif terhubung ke backend server (misal MySQL di port 3306). Cocok jika data di database sudah ada atau dikelola manual.
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. KREDENSIAL AKUN & KATA SANDI PENGUJIAN (FORM KEDUA) */}
                <div className="wizard-section-card form-section-card">
                  <div className="section-card-header">
                    <div className="section-header-left">
                      <div className="section-header-icon form-icon-glow">
                        <Icon name="shield" size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ margin: 0 }}>Kredensial Akun &amp; Kata Sandi Pengujian</h3>
                          <span className="section-type-badge form-badge">
                            {config.database.source === 'seed' || config.database.source === 'migrate'
                              ? '⚡ SEEDER KREDENSIAL'
                              : '🔑 FORM LOGIN WAJIB (HASH DB)'}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {config.database.source === 'seed' || config.database.source === 'migrate'
                            ? 'Akun pengujian akan dipindai dari file seeder backend. Anda cukup mengisi kata sandi default seeder (biasanya seragam).'
                            : 'Karena data di database tersimpan dalam bentuk hash (bcrypt), masukkan akun pengujian dengan kata sandi asli (plain text) agar robot tester dapat login.'}
                        </p>
                      </div>
                    </div>
                    {config.database.source !== 'seed' && config.database.source !== 'migrate' && (
                      <button
                        type="button"
                        className="quiet"
                        onClick={() => patch({
                          accounts: [...config.accounts, { name: '', email: '', password: '', role: 'user' }]
                        })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 14px' }}
                      >
                        <Icon name="plus" size={14} /> Tambah Akun
                      </button>
                    )}
                  </div>

                  {/* KONDISI 1: JIKA SUMBER DATA SEEDER */}
                  {(config.database.source === 'seed' || config.database.source === 'migrate') ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="probe-status-banner success" style={{ marginBottom: 14 }}>
                        <Icon name="check" size={15} />
                        <div className="probe-status-text">
                          <strong>Mode Seeder: Kredensial Dapat Dideteksi Otomatis dari Source Code</strong>
                          <span>File seeder backend akan di-scan untuk mendeteksi user &amp; role. Masukkan kata sandi default seeder di bawah ini:</span>
                        </div>
                      </div>

                      <div className="form-grid">
                        <Field
                          label="Kata Sandi Default Seeder (Password)"
                          hint="Kata sandi seragam yang digunakan di DatabaseSeeder / UserSeeder (misal: password atau admin123)."
                        >
                          <input
                            type="password"
                            value={config.accounts[0]?.password ?? 'password'}
                            onChange={e => {
                              const val = e.target.value;
                              patch({
                                accounts: config.accounts.length
                                  ? config.accounts.map((a, idx) => idx === 0 ? { ...a, password: val } : { ...a, password: val })
                                  : [{ name: 'QA Tester', email: 'tester.qc@example.com', password: val, role: 'user' }]
                              });
                            }}
                            placeholder="password"
                            autoComplete="new-password"
                          />
                        </Field>

                        <Field
                          label="Email Akun Pengujian Utama (Opsional)"
                          hint="Email akun utama; kosongkan untuk menggunakan default seeder (misal: tester.qc@example.com)."
                        >
                          <input
                            type="email"
                            value={config.accounts[0]?.email ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              patch({
                                accounts: config.accounts.length
                                  ? config.accounts.map((a, idx) => idx === 0 ? { ...a, email: val } : a)
                                  : [{ name: 'QA Tester', email: val, password: 'password', role: 'user' }]
                              });
                            }}
                            placeholder="tester.qc@example.com atau admin@example.com"
                          />
                        </Field>
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          Perlu menguji akun dengan hak akses khusus (Admin vs Tester vs Guest)?
                        </span>
                        <button
                          type="button"
                          className="quiet"
                          onClick={() => setShowManualAccounts(!showManualAccounts)}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          {showManualAccounts ? 'Sembunyikan Pengaturan Multi-Akun' : 'Atur Multi-Akun Tambahan (RBAC)'}
                        </button>
                      </div>

                      {showManualAccounts && (
                        <div className="accounts-list" style={{ marginTop: 14 }}>
                          {config.accounts.map((acc, i) => (
                            <div className="account-row-clean" key={i}>
                              <div className="account-row-meta">
                                <span className="account-seq-label">Akun #{i + 1} ({acc.role === 'admin' ? 'Administrator' : acc.role === 'tester' ? 'QA Tester' : 'User Standar'})</span>
                                {config.accounts.length > 1 && (
                                  <button
                                    type="button"
                                    className="quiet danger-text"
                                    onClick={() => patch({ accounts: config.accounts.filter((_, idx) => idx !== i) })}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px' }}
                                  >
                                    <Icon name="close" size={13} /> Hapus
                                  </button>
                                )}
                              </div>
                              <div className="account-fields-grid">
                                <Field label="Email / Username Login" hint="Kredensial identitas akun.">
                                  <input
                                    type="email"
                                    value={acc.email}
                                    onChange={e => patch({
                                      accounts: config.accounts.map((a, idx) => idx === i ? { ...a, email: e.target.value } : a)
                                    })}
                                    placeholder="tester.qc@example.com"
                                  />
                                </Field>
                                <Field label="Kata Sandi (Password)" hint="Kata sandi akun.">
                                  <input
                                    type="password"
                                    value={acc.password}
                                    onChange={e => patch({
                                      accounts: config.accounts.map((a, idx) => idx === i ? { ...a, password: e.target.value } : a)
                                    })}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                  />
                                </Field>
                                <Field label="Peran / Role Otoritas" hint="Tingkat hak akses akun.">
                                  <select
                                    value={acc.role}
                                    onChange={e => patch({
                                      accounts: config.accounts.map((a, idx) => idx === i ? { ...a, role: e.target.value } : a)
                                    })}
                                  >
                                    <option value="user">User / Standard</option>
                                    <option value="admin">Administrator</option>
                                    <option value="tester">QA Tester</option>
                                    <option value="guest">Guest</option>
                                  </select>
                                </Field>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="quiet"
                            onClick={() => patch({
                              accounts: [...config.accounts, { name: '', email: '', password: config.accounts[0]?.password || 'password', role: 'admin' }]
                            })}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 12px', marginTop: 10, fontSize: 12 }}
                          >
                            <Icon name="plus" size={13} /> Tambah Akun Lain
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* KONDISI 2: JIKA SUMBER DATA SQL DUMP ATAU DB AKTIF (HASH DB) */
                    <div style={{ marginTop: 12 }}>
                      <div className="probe-status-banner warning" style={{ marginBottom: 14 }}>
                        <Icon name="warning" size={15} />
                        <div className="probe-status-text">
                          <strong>Password di Database Berbentuk Hash (Bcrypt / Argon2)</strong>
                          <span>Robot tester membutuhkan kata sandi asli (plain text) untuk login ke layar aplikasi. Masukkan kredensial akun pengujian di bawah ini:</span>
                        </div>
                      </div>

                      <div className="accounts-list">
                        {config.accounts.map((acc, i) => (
                          <div className="account-row-clean" key={i}>
                            {config.accounts.length > 1 && (
                              <div className="account-row-meta">
                                <span className="account-seq-label">Akun #{i + 1} ({acc.role === 'admin' ? 'Administrator' : acc.role === 'tester' ? 'QA Tester' : 'User Standar'})</span>
                                <button
                                  type="button"
                                  className="quiet danger-text"
                                  onClick={() => patch({ accounts: config.accounts.filter((_, idx) => idx !== i) })}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px' }}
                                >
                                  <Icon name="close" size={13} /> Hapus Akun
                                </button>
                              </div>
                            )}
                            <div className="account-fields-grid">
                              <Field label="Email / Username Login" hint="Kredensial identitas akun pengujian.">
                                <input
                                  type="email"
                                  value={acc.email}
                                  onChange={e => patch({
                                    accounts: config.accounts.map((a, idx) => idx === i ? { ...a, email: e.target.value } : a)
                                  })}
                                  placeholder="tester.qc@example.com"
                                />
                              </Field>
                              <Field label="Kata Sandi (Password)" hint="Kata sandi asli untuk submit login.">
                                <input
                                  type="password"
                                  value={acc.password}
                                  onChange={e => patch({
                                    accounts: config.accounts.map((a, idx) => idx === i ? { ...a, password: e.target.value } : a)
                                  })}
                                  placeholder="••••••••"
                                  autoComplete="new-password"
                                />
                              </Field>
                              <Field label="Peran / Role Otoritas" hint="Tingkat hak akses akun pada sistem.">
                                <select
                                  value={acc.role}
                                  onChange={e => patch({
                                    accounts: config.accounts.map((a, idx) => idx === i ? { ...a, role: e.target.value } : a)
                                  })}
                                >
                                  <option value="user">User / Standard</option>
                                  <option value="admin">Administrator</option>
                                  <option value="tester">QA Tester</option>
                                  <option value="guest">Guest</option>
                                </select>
                              </Field>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}


            {/* ================= STEP 2: REVIEW & LAUNCH (MODERN MATRIX) ================= */}
            {step === 2 && (
              <div className="review-step-container">
                {/* MODERN LINEAR HEADER BANNER */}
                <div className="review-hero-panel">
                  <div className="review-hero-left">
                    <div className="review-hero-icon-box">
                      <Icon name={config.platform === 'android' ? 'android' : 'shield'} size={26} />
                    </div>
                    <div>
                      <div className="review-hero-title-row">
                        <h2 className="review-hero-title">{config.name || 'QC Test Target'}</h2>
                        <span className="review-hero-pill-badge">
                          <span className="status-led-dot green" />
                          SIAP DIJALANKAN
                        </span>
                      </div>
                      <p className="review-hero-subtitle">
                        {config.platform === 'android'
                          ? `Android Maestro Engine · Package: ${config.appId || config.apkPackageId || 'APK Mobile Target'}`
                          : `Web Playwright Suite · ${config.frontendTarget?.url || config.baseUrl}`}
                      </p>
                    </div>
                  </div>
                  <div className="review-hero-right">
                    <div className="review-meta-chip">
                      <span className="review-meta-chip-label">PLATFORM</span>
                      <strong className="review-meta-chip-val">{config.platform === 'android' ? 'Android' : 'Web App'}</strong>
                    </div>
                    <div className="review-meta-chip">
                      <span className="review-meta-chip-label">ALUR REVIEW</span>
                      <strong className="review-meta-chip-val" style={{ color: '#f59e0b' }}>⏸️ Wajib Review</strong>
                    </div>
                  </div>
                </div>

                {/* COMPREHENSIVE CONFIGURATION MATRIX (2-COLUMN GRID) */}
                <div className="review-cards-matrix">
                  {/* CARD 1: FRONTEND / TARGET ENVIRONMENT */}
                  <div className="review-matrix-card">
                    <div className="review-card-header">
                      <div className="review-card-icon-wrap">
                        <Icon name={config.platform === 'android' ? 'android' : 'globe'} size={16} />
                      </div>
                      <div>
                        <strong>Target Frontend &amp; Lingkungan</strong>
                        <span className="review-card-category">
                          {(config.frontendTarget?.mode || 'local') === 'local' ? 'Jaringan Lokal' : (config.frontendTarget?.mode || 'local') === 'internet' ? 'Akses Internet' : 'Jalankan di Server'}
                        </span>
                      </div>
                    </div>
                    <div className="review-card-body">
                      <div className="review-kv-row">
                        <span className="review-k">Endpoint URL &amp; Port</span>
                        <span className="review-v mono" style={{ fontWeight: 600 }}>
                          {config.platform === 'android'
                            ? (config.apkFilename ? `APK: ${config.apkFilename}` : (config.appId || 'Target App'))
                            : (config.frontendTarget?.url || config.baseUrl)}
                        </span>
                      </div>
                      <div className="review-kv-row">
                        <span className="review-k">Status Konektivitas</span>
                        <span className="review-v">
                          {feProbeResult ? (
                            <span className={`status-pill-badge ${feProbeResult.reachable ? 'passed' : 'warning'}`}>
                              <span className={`status-led-dot ${feProbeResult.reachable ? 'green' : 'amber'}`} />
                              {feProbeResult.reachable ? `Terhubung (~${feProbeResult.responseTimeMs ?? 15}ms)` : 'Belum Merespons'}
                            </span>
                          ) : (
                            <span className="status-pill-badge ready">
                              <span className="status-led-dot green" /> Terkonfigurasi
                            </span>
                          )}
                        </span>
                      </div>
                      {Boolean(config.frontendTarget?.repositoryUrl || config.repositoryUrl) && (
                        <div className="review-kv-row">
                          <span className="review-k">Repositori Git</span>
                          <span className="review-v mono" style={{ fontSize: 11 }}>
                            {config.frontendTarget?.repositoryUrl || config.repositoryUrl} ({config.frontendTarget?.branch || config.ref || 'main'})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 2: BACKEND & API SERVICE */}
                  <div className="review-matrix-card">
                    <div className="review-card-header">
                      <div className="review-card-icon-wrap">
                        <Icon name="database" size={16} />
                      </div>
                      <div>
                        <strong>Backend &amp; Layanan API Target</strong>
                        <span className="review-card-category">
                          {(config.backendTarget?.mode || 'local') === 'local' ? 'Jaringan Lokal' : (config.backendTarget?.mode || 'local') === 'internet' ? 'Akses Internet' : 'Jalankan di Server'}
                        </span>
                      </div>
                    </div>
                    <div className="review-card-body">
                      <div className="review-kv-row">
                        <span className="review-k">Endpoint API &amp; Port</span>
                        <span className="review-v mono" style={{ fontWeight: 600 }}>
                          {config.backendTarget?.url || config.backendUrl || (config.platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000')}
                        </span>
                      </div>
                      <div className="review-kv-row">
                        <span className="review-k">Status API Target</span>
                        <span className="review-v">
                          {beProbeResult ? (
                            <span className={`status-pill-badge ${beProbeResult.reachable ? 'passed' : 'warning'}`}>
                              <span className={`status-led-dot ${beProbeResult.reachable ? 'green' : 'amber'}`} />
                              {beProbeResult.reachable ? `Responsif (~${beProbeResult.responseTimeMs ?? 20}ms)` : 'Belum Merespons'}
                            </span>
                          ) : (
                            <span className="status-pill-badge ready">
                              <span className="status-led-dot green" /> Terkonfigurasi
                            </span>
                          )}
                        </span>
                      </div>
                      {Boolean(config.backendTarget?.repositoryUrl) && (
                        <div className="review-kv-row">
                          <span className="review-k">Repositori Backend</span>
                          <span className="review-v mono" style={{ fontSize: 11 }}>
                            {config.backendTarget.repositoryUrl} ({config.backendTarget.branch || 'main'})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 3: DATABASE & INITIAL DATA */}
                  <div className="review-matrix-card">
                    <div className="review-card-header">
                      <div className="review-card-icon-wrap">
                        <Icon name="zap" size={16} />
                      </div>
                      <div>
                        <strong>Inisialisasi Database &amp; Data</strong>
                        <span className="review-card-category">
                          Engine: {config.database.engine === 'none' ? 'Host / Aktif' : config.database.engine.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="review-card-body">
                      <div className="review-kv-row">
                        <span className="review-k">Metode Penyediaan Data</span>
                        <span className="review-v" style={{ fontWeight: 600 }}>
                          {config.database.source === 'sql'
                            ? 'Upload File SQL Dump'
                            : (config.database.source === 'seed' || config.database.source === 'migrate')
                            ? 'Auto-Seed Dataset Relasional'
                            : 'Database Backend Aktif (Host)'}
                        </span>
                      </div>
                      <div className="review-kv-row">
                        <span className="review-k">Keterangan Sumber</span>
                        <span className="review-v mono" style={{ fontSize: 11 }}>
                          {config.database.source === 'sql'
                            ? (filenames.sql ? `File: ${filenames.sql}` : (config.database.sqlUploadId ? 'File .sql terlampir' : 'File SQL dump kustom'))
                            : (config.database.source === 'seed' || config.database.source === 'migrate')
                            ? (config.database.seedCommand || 'npm run seed:jamaahku (Auto-Scan Seeder)')
                            : 'Menggunakan data live database backend'}
                        </span>
                      </div>
                      {seedResult?.success && (
                        <div className="review-kv-row">
                          <span className="review-k">Status Seeding</span>
                          <span className="review-v" style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>✓ Database Telah Terisi</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 4: AKUN LOGIN & KREDENSIAL */}
                  <div className="review-matrix-card">
                    <div className="review-card-header">
                      <div className="review-card-icon-wrap">
                        <Icon name="shield" size={16} />
                      </div>
                      <div>
                        <strong>Kredensial Akun &amp; Hak Akses</strong>
                        <span className="review-card-category">
                          {(config.database.source === 'seed' || config.database.source === 'migrate') ? 'Auto-Detect Source' : 'Manual Hash DB'}
                        </span>
                      </div>
                    </div>
                    <div className="review-card-body">
                      {(config.database.source === 'seed' || config.database.source === 'migrate') ? (
                        <>
                          <div className="review-kv-row">
                            <span className="review-k">Kata Sandi Default</span>
                            <span className="review-v mono" style={{ fontWeight: 600 }}>
                              {config.accounts[0]?.password || 'password'}
                            </span>
                          </div>
                          <div className="review-kv-row">
                            <span className="review-k">Deteksi Akun</span>
                            <span className="review-v">Otomatis dipindai dari file seeder backend</span>
                          </div>
                          {Boolean(config.accounts[0]?.email) && (
                            <div className="review-kv-row">
                              <span className="review-k">Email Utama</span>
                              <span className="review-v mono" style={{ fontSize: 11 }}>{config.accounts[0].email}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="review-kv-row">
                            <span className="review-k">Total Akun Terdaftar</span>
                            <span className="review-v" style={{ fontWeight: 600 }}>{config.accounts.length} Akun</span>
                          </div>
                          <div className="review-accounts-chip-list">
                            {config.accounts.map((acc, i) => (
                              <div key={i} className="review-account-chip">
                                <span className="review-acc-role">{acc.role || 'user'}</span>
                                <span className="review-acc-email mono">{acc.email || 'tester'}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 5: FULL DEEP QA & TEST ENGINE MATRIX (SEMUA AKTIF) */}
                <div className="review-deep-qa-box">
                  <div className="review-deep-qa-header">
                    <div className="review-deep-qa-icon">
                      <Icon name="runs" size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 15 }}>Kapabilitas Deep QA &amp; Matriks Multi-Device (Aktif Penuh)</strong>
                        <span className="review-active-pill">100% COVERAGE AKTIF</span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        Seluruh parameter pengujian mendalam, semua ukuran layar, dan seluruh mesin browser dieksekusi menyeluruh tanpa pembatasan rute.
                      </p>
                    </div>
                  </div>

                  <div className="review-deep-qa-grid">
                    <div className="review-qa-badge-col">
                      <span className="review-qa-label">📱 PERANGKAT LAYAR (3/3 AKTIF)</span>
                      <div className="review-pill-row">
                        <span className="review-spec-pill active">✓ 🖥️ Desktop (1440px)</span>
                        <span className="review-spec-pill active">✓ 📱 Tablet (768px)</span>
                        <span className="review-spec-pill active">✓ 📲 Mobile (375px)</span>
                      </div>
                    </div>

                    <div className="review-qa-badge-col">
                      <span className="review-qa-label">🌐 MESIN BROWSER (3/3 AKTIF)</span>
                      <div className="review-pill-row">
                        <span className="review-spec-pill active">✓ Chromium (Chrome/Edge)</span>
                        <span className="review-spec-pill active">✓ Firefox</span>
                        <span className="review-spec-pill active">✓ WebKit (Safari)</span>
                      </div>
                    </div>
                  </div>

                  <div className="review-deep-qa-features">
                    <div className="review-feature-item">
                      <span className="feature-check-icon">✓</span>
                      <div>
                        <strong>Autonomous Negative Testing</strong>
                        <small>Validasi form kosong, double-click protection, handling network failure &amp; error boundary.</small>
                      </div>
                    </div>
                    <div className="review-feature-item">
                      <span className="feature-check-icon">✓</span>
                      <div>
                        <strong>Boundary Form Data Exploration</strong>
                        <small>Input batas ekstrem: 240+ karakter, text-overflow check, simbol sanitasi &amp; regex.</small>
                      </div>
                    </div>
                    <div className="review-feature-item">
                      <span className="feature-check-icon">✓</span>
                      <div>
                        <strong>Dynamic State &amp; UI Accessibility</strong>
                        <small>Hover/focus efek, tombol disabled, modal transition, loading skeleton, &amp; WCAG compliance.</small>
                      </div>
                    </div>
                    <div className="review-feature-item">
                      <span className="feature-check-icon">✓</span>
                      <div>
                        <strong>Multi-Role RBAC Privilege Isolation</strong>
                        <small>Verifikasi isolasi rute &amp; tombol aksi sensitif antara User/Siswa vs Admin.</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 6: EXECUTION FLOW & MANDATORY REVIEW GATE */}
                <div className="review-gate-banner">
                  <div className="gate-banner-icon">
                    <Icon name="clock" size={24} />
                  </div>
                  <div className="gate-banner-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ fontSize: 14.5 }}>Tahapan Eksekusi: Jeda Review Alur Wajib (Approval Gate)</strong>
                      <span className="badge" style={{ background: 'rgba(255, 179, 0, 0.2)', color: '#ffb300', fontWeight: 700 }}>
                        ⏸️ WAITING_REVIEW
                      </span>
                    </div>
                    <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Saat tombol <strong>Mulai Pengujian Otomatis</strong> ditekan, engine terlebih dahulu memindai kode dan merangkai peta alur bisnis lengkap pada halaman <strong>Flow</strong>. Eksekusi pengujian di terminal hanya akan dimulai setelah Anda memeriksa dan menyetujui (Acc) alur tersebut.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          {/* WIZARD FOOTER NAVIGATION */}
          <div className="wizard-footer">
            {step === 0 && onCancelEdit ? (
              <button
                type="button"
                className="quiet"
                disabled={busy}
                onClick={onCancelEdit}
                style={{ color: 'var(--text-dim)' }}
              >
                ✕ Batal Edit
              </button>
            ) : (
              <button
                type="button"
                disabled={step === 0 || busy || !!uploading}
                onClick={() => go(step - 1)}
              >
                Kembali
              </button>
            )}
            <span>Langkah {step + 1} dari 3</span>
            {step < 2 ? (
              <button
                type="button"
                className="primary"
                disabled={busy || !!uploading || transitioning}
                onClick={() => go(step + 1)}
                style={{ minWidth: 165, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {transitioning ? (
                  <>
                    <span className="spinner-mini" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memuat Form…</span>
                  </>
                ) : (
                  <>
                    Lanjutkan <Icon name="arrow" size={16} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={busy || !!uploading}
                onClick={() => void submit()}
                style={{ padding: '12px 28px', fontSize: 14 }}
              >
                {busy
                  ? (initialJob?.id ? 'Menyimpan & Restart…' : 'Memulai Engine…')
                  : (initialJob?.id ? <><Icon name="refresh" size={16}/> Simpan & Jalankan Ulang</> : <><Icon name="runs" size={18}/> Mulai Pengujian Otomatis</>)
                }
              </button>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
