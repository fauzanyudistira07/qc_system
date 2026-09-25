import React, { useState, useRef, useEffect } from 'react';
import { errorText, send } from './api';
import { Config, initialConfig, Job, SystemStatus } from './types';
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
        platform: cfg.platform ?? 'web',
        baseUrl: cfg.baseUrl ?? '',
        backendUrl: cfg.backendUrl || (cfg.platform === 'android' ? cfg.baseUrl : '') || '',
        appId: cfg.appId || '',
        apkUploadId: cfg.apkUploadId || '',
        apkFilename: cfg.apkFilename || '',
        runMode: cfg.runMode || 'existing-target',
        accounts: (cfg.accounts && cfg.accounts.length > 0) ? cfg.accounts : initialConfig().accounts,
        database: cfg.database || initialConfig().database,
        rules: cfg.rules || initialConfig().rules,
        qualityAudit: { ...initialConfig().qualityAudit, ...(cfg.qualityAudit || {}) },
      };
    }
    return initialConfig();
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

  useEffect(() => {
    if (initialJob?.config) {
      const cfg = initialJob.config;
      setConfig({
        ...initialConfig(),
        ...cfg,
        name: initialJob.name || cfg.name || '',
        platform: cfg.platform ?? 'web',
        baseUrl: cfg.baseUrl ?? '',
        backendUrl: cfg.backendUrl || (cfg.platform === 'android' ? cfg.baseUrl : '') || '',
        appId: cfg.appId || '',
        apkUploadId: cfg.apkUploadId || '',
        apkFilename: cfg.apkFilename || '',
        runMode: cfg.runMode || 'existing-target',
        accounts: (cfg.accounts && cfg.accounts.length > 0) ? cfg.accounts : initialConfig().accounts,
        database: cfg.database || initialConfig().database,
        rules: cfg.rules || initialConfig().rules,
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
  }, [initialJob]);

  const patch = (value: Partial<Config>) => setConfig(c => ({ ...c, ...value }));
  const db = (value: Partial<Config['database']>) => setConfig(c => ({ ...c, database: { ...c.database, ...value } }));
  const rule = (value: Partial<Config['rules']>) => setConfig(c => ({ ...c, rules: { ...c.rules, ...value } }));
  const quality = (value: Partial<Config['qualityAudit']>) => setConfig(c => ({ ...c, qualityAudit: { ...initialConfig().qualityAudit, ...c.qualityAudit, ...value } }));
  const updateService = (index: number, value: Partial<Config['services'][number]>) => setConfig(c => ({ ...c, services: c.services.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) }));

  function validate(index: number): string {
    if (index === 0) {
      if (!config.name.trim()) return 'Beri nama project / pengujian terlebih dahulu.';
      if (config.platform === 'web' && !config.baseUrl.trim()) return 'Masukkan URL Website yang akan diuji.';
      if (config.platform === 'android' && !config.appId?.trim() && !config.apkUploadId) {
        return 'Unggah file .APK atau masukkan Android Application ID.';
      }
    }
    if (index === 1) {
      if (!config.accounts.length) return 'Tambahkan minimal satu akun pengujian.';
      if (config.accounts.some(a => !a.email.trim() || !a.password.trim())) {
        return 'Setiap akun pengujian wajib memiliki email dan password.';
      }
      if (config.database.engine !== 'none' && config.database.source === 'sql' && !config.database.sqlUploadId) {
        return 'Pilih file .SQL dump atau ubah pilihan ke "Database Backend Aktif".';
      }
      if (config.database.engine !== 'none' && config.database.source === 'migrate' && !config.database.migrationCommand?.trim()) {
        return 'Isi migration command atau pilih sumber database lain.';
      }
      if (config.database.engine !== 'none' && config.database.source === 'seed' && !config.database.seedCommand?.trim()) {
        return 'Isi seed command atau pilih sumber database lain.';
      }
      if (config.platform === 'web' && config.qualityAudit?.enabled !== false) {
        if (!config.qualityAudit?.browsers?.length) return 'Pilih minimal satu browser untuk Quality Audit.';
        if (!config.qualityAudit?.viewports?.length) return 'Pilih minimal satu viewport untuk Quality Audit.';
      }
    }
    return '';
  }

  function go(next: number) {
    if (next > step) {
      for (let i = 0; i <= step; i++) {
        const issue = validate(i);
        if (issue) {
          setStep(i);
          setError(issue);
          return;
        }
      }
    }
    setError('');
    setStep(next);
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
      const finalBaseUrl = (config.platform === 'android' ? (config.backendUrl || config.baseUrl || 'http://10.0.2.2:8000') : config.baseUrl).trim();
      const payload: Config = {
        ...config,
        name: config.name.trim(),
        baseUrl: finalBaseUrl,
        backendUrl: config.backendUrl?.trim() || finalBaseUrl,
        repositoryUrl: config.repositoryUrl?.trim() || '',
        ref: config.ref?.trim() || 'main',
        runMode: config.runMode || 'existing-target',
        rules: {
          ...config.rules,
          includePaths: lines(paths.include),
          excludePaths: lines(paths.exclude),
        }
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
              disabled={busy || !!uploading || i > step + 1}
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
                'Tentukan aplikasi yang ingin diuji (Flutter Mobile APK atau Website) serta endpoint API backend-nya.',
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
                <Field label="Nama Project / Pengujian" hint="Beri nama pengenal untuk run pengujian ini.">
                  <input
                    value={config.name}
                    onChange={e => patch({ name: e.target.value })}
                    placeholder="Contoh: Tasdig Flutter Mobile QC atau Portal Sarpras Web"
                    maxLength={120}
                    autoFocus
                  />
                </Field>

                {/* PLATFORM SELECTOR (FLUTTER / MOBILE vs WEB) */}
                <div className="field">
                  <span>Platform Target Pengujian</span>
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

                {/* TARGET SECTION: ANDROID APK */}
                {config.platform === 'android' && (
                  <div className="target-card-section">
                    <div className="inline-heading">
                      <div>
                        <h3>Target Binary Aplikasi (.APK)</h3>
                        <p>Upload file build APK (misal dari project Flutter) untuk pengujian Maestro.</p>
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
                      <Field label="Application ID / Package Name" hint="Otomatis terisi dari APK atau masukkan manual.">
                        <input
                          value={config.appId || ''}
                          placeholder="com.example.tasdig"
                          onChange={e => patch({ appId: e.target.value })}
                        />
                      </Field>
                      <Field label="Target Device / Emulator" hint="Device aktif dari Android ADB.">
                        {system?.adb?.devices && system.adb.devices.length > 0 ? (
                          <select
                            value={config.deviceId || ''}
                            onChange={e => patch({ deviceId: e.target.value })}
                          >
                            <option value="">Default ADB Device ({system.adb.devices[0]})</option>
                            {system.adb.devices.map(d => (
                              <option key={d} value={d}>{d} (Online)</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={config.deviceId || ''}
                            placeholder="emulator-5554 atau kosongkan untuk default"
                            onChange={e => patch({ deviceId: e.target.value })}
                          />
                        )}
                      </Field>
                    </div>
                  </div>
                )}

                {/* TARGET SECTION: WEB APP */}
                {config.platform === 'web' && (
                  <div className="target-card-section">
                    <Field label="URL Website Target" hint="URL yang dapat diakses oleh browser engine saat pengujian." wide>
                      <input
                        type="url"
                        value={config.baseUrl}
                        onChange={e => patch({ baseUrl: e.target.value })}
                        placeholder="http://localhost:3000 atau https://app.dev"
                      />
                    </Field>
                  </div>
                )}

                {/* BACKEND & API SERVICE CONFIGURATION (FIRST CLASS CITIZEN) */}
                <div className="backend-service-section">
                  <div className="inline-heading">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="database" size={18} />
                        <h3>Koneksi Backend &amp; API Target</h3>
                      </div>
                      <p>Pastikan aplikasi terhubung dengan API backend yang melayani data login dan proses bisnis.</p>
                    </div>
                    <Badge value={config.backendMode === 'existing' ? 'Live Backend' : 'Repo Backend'} />
                  </div>

                  <div className="backend-mode-row">
                    <button
                      type="button"
                      className={`backend-pill ${config.backendMode !== 'repo' ? 'active' : ''}`}
                      onClick={() => patch({ backendMode: 'existing', runMode: 'existing-target' })}
                    >
                      <span className="status-dot active" />
                      <span>Backend Sedang Berjalan (Existing API)</span>
                    </button>
                    <button
                      type="button"
                      className={`backend-pill ${config.backendMode === 'repo' ? 'active' : ''}`}
                      onClick={() => patch({ backendMode: 'repo', runMode: 'managed-local' })}
                    >
                      <Icon name="git" size={14} />
                      <span>Source Code Backend (Repository)</span>
                    </button>
                  </div>

                  <div className="form-grid" style={{ marginTop: 14 }}>
                    <Field label="Runtime Stack" hint="Auto mendeteksi framework; pilih manual bila perlu.">
                      <select value={config.stack} onChange={e => patch({ stack: e.target.value as Config['stack'] })}>
                        <option value="auto">Auto Detect</option>
                        <option value="laravel">Laravel / PHP</option>
                        <option value="custom">Custom Runtime Services</option>
                      </select>
                    </Field>
                  </div>

                  <Field
                    label="URL Endpoint Backend API"
                    hint={
                      config.platform === 'android'
                        ? 'Tip Android Emulator: Gunakan http://10.0.2.2:8000 untuk mengakses backend lokal laptop Anda.'
                        : 'Informasi endpoint API pendukung. Untuk crawl UI web, engine memakai URL Website Target di atas.'
                    }
                    wide
                  >
                    <input
                      type="url"
                      value={config.backendUrl || config.baseUrl || 'http://10.0.2.2:8000'}
                      onChange={e => {
                        const val = e.target.value;
                        patch({
                          backendUrl: val,
                          ...(config.platform === 'android' ? { baseUrl: val } : {}),
                        });
                      }}
                      placeholder={config.platform === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000'}
                    />
                  </Field>

                  {/* QUICK SUGGESTION PILLS */}
                  <div className="url-suggestions">
                    <span className="muted" style={{ fontSize: 11, marginRight: 6 }}>Preset Cepat:</span>
                    <button
                      type="button"
                      className="preset-btn"
                      style={{ borderColor: 'var(--primary, #3b82f6)', fontWeight: 600, color: 'var(--primary, #3b82f6)' }}
                      onClick={() => {
                        patch({ backendUrl: 'https://alhikmah.sopan.solu.co.id:8530', baseUrl: 'https://alhikmah.sopan.solu.co.id:8530' });
                      }}
                    >
                      🚀 Staging Al-Hikmah (:8530)
                    </button>
                    {config.platform === 'android' && (
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => {
                          patch({ backendUrl: 'http://10.0.2.2:8000', baseUrl: 'http://10.0.2.2:8000' });
                        }}
                      >
                        ⚡ 10.0.2.2:8000 (Android Emulator)
                      </button>
                    )}
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={() => {
                        patch({ backendUrl: 'http://127.0.0.1:8000', baseUrl: 'http://127.0.0.1:8000' });
                      }}
                    >
                      💻 127.0.0.1:8000 (Lokal)
                    </button>
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={() => {
                        patch({ backendUrl: 'http://localhost:8000', baseUrl: 'http://localhost:8000' });
                      }}
                    >
                      🔌 localhost:8000
                    </button>
                  </div>

                  {config.backendMode === 'repo' && (
                    <div className="form-grid" style={{ marginTop: 14 }}>
                      <Field label="Repository GitHub Backend" hint="Format: https://github.com/owner/backend-repo" wide>
                        <input
                          type="url"
                          value={config.repositoryUrl}
                          onChange={e => patch({ repositoryUrl: e.target.value })}
                          placeholder="https://github.com/owner/backend-api"
                        />
                      </Field>
                      <Field label="Branch / Ref" hint="Branch untuk checkout">
                        <input
                          value={config.ref}
                          onChange={e => patch({ ref: e.target.value })}
                          placeholder="main"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ================= STEP 1: TEST DATA & ACCOUNTS ================= */}
            {step === 1 && (
              <>
                {/* TEST ACCOUNTS (SIMPLE, PRE-FILLED, FOCUSED) */}
                <div className="clean-section">
                  <div className="inline-heading">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="shield" size={18} />
                        <h3>Akun Pengujian (Testing Credentials)</h3>
                      </div>
                      <p>Kredensial login yang digunakan oleh robot penguji untuk otomatis login ke dalam aplikasi.</p>
                    </div>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => patch({
                        accounts: [...config.accounts, { name: '', email: '', password: '', role: 'user' }]
                      })}
                    >
                      <Icon name="plus" size={14} /> Tambah Akun
                    </button>
                  </div>

                  <div className="accounts-list">
                    {config.accounts.map((acc, i) => (
                      <div className="account-row-card" key={i}>
                        <div className="account-row-badge">
                          <span>{i + 1}</span>
                        </div>
                        <div className="account-fields-grid">
                          <Field label="Email / Username Login">
                            <input
                              type="email"
                              value={acc.email}
                              onChange={e => patch({
                                accounts: config.accounts.map((a, idx) => idx === i ? { ...a, email: e.target.value } : a)
                              })}
                              placeholder="tester.qc@example.com"
                            />
                          </Field>
                          <Field label="Kata Sandi (Password)">
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
                          <Field label="Peran / Role">
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
                        {config.accounts.length > 1 && (
                          <button
                            type="button"
                            className="quiet danger-text"
                            onClick={() => patch({ accounts: config.accounts.filter((_, idx) => idx !== i) })}
                            style={{ alignSelf: 'center', height: 38 }}
                          >
                            <Icon name="close" size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* DATABASE & DATA INITIALIZATION */}
                <div className="clean-section" style={{ marginTop: 24 }}>
                  <div className="inline-heading">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="database" size={18} />
                        <h3>Database &amp; Data Awal (Opsional)</h3>
                      </div>
                      <p>Pilih bagaimana data database disediakan selama sesi pengujian berlangsung.</p>
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: 14 }}>
                    <Field label="Database Engine" hint="Engine ini dipakai managed-local runner.">
                      <select
                        value={config.database.engine}
                        onChange={e => db({ engine: e.target.value as Config['database']['engine'] })}
                      >
                        <option value="none">Tidak membuat container database</option>
                        <option value="mysql">MySQL</option>
                        <option value="postgres">PostgreSQL</option>
                        <option value="sqlite">SQLite</option>
                      </select>
                    </Field>
                    <Field label="Sumber / Bootstrap Data" hint="Cara engine menyiapkan schema dan data uji.">
                      <select
                        value={config.database.source}
                        onChange={e => db({ source: e.target.value as Config['database']['source'] })}
                      >
                        <option value="empty">Database backend aktif / kosong</option>
                        <option value="sql">Import SQL dump</option>
                        <option value="migrate">Jalankan migration command</option>
                        <option value="seed">Jalankan seed command</option>
                      </select>
                    </Field>
                  </div>

                  {config.database.engine !== 'none' && config.database.source !== 'sql' && (
                    <div className="form-grid" style={{ marginBottom: 14 }}>
                      <Field label="Provision Command" hint="Opsional, dijalankan sebelum migration/seed.">
                        <input value={config.database.provisionCommand || ''} placeholder="php artisan migrate:fresh" onChange={e => db({ provisionCommand: e.target.value })} />
                      </Field>
                      <Field label="Migration Command" hint="Wajib jika sumber = migration.">
                        <input value={config.database.migrationCommand || ''} placeholder="php artisan migrate --force" onChange={e => db({ migrationCommand: e.target.value })} />
                      </Field>
                      <Field label="Seed Command" hint="Wajib jika sumber = seed.">
                        <input value={config.database.seedCommand || ''} placeholder="php artisan db:seed --force" onChange={e => db({ seedCommand: e.target.value })} />
                      </Field>
                    </div>
                  )}

                  <div className="db-choice-grid">
                    <button
                      type="button"
                      className={`choice-card ${config.database.source !== 'sql' ? 'selected' : ''}`}
                      onClick={() => db({ engine: 'none', source: 'empty', sqlUploadId: undefined })}
                    >
                      <div className="choice-card-icon">
                        <Icon name="database" size={24} />
                      </div>
                      <div className="choice-card-content">
                        <strong>Gunakan Database Backend Aktif (Tanpa Reset)</strong>
                        <p>Paling praktis: engine langsung memakai database yang saat ini terhubung ke backend server.</p>
                      </div>
                      {config.database.source !== 'sql' && <span className="choice-check"><Icon name="check" size={14} /></span>}
                    </button>

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
                        <strong>Import File SQL Dump (.sql)</strong>
                        <p>Unggah file SQL dump jika ingin menginisialisasi schema atau data master khusus.</p>
                      </div>
                      {config.database.source === 'sql' && <span className="choice-check"><Icon name="check" size={14} /></span>}
                    </button>
                  </div>

                  {/* SQL UPLOAD DROPZONE IF SELECTED */}
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
                </div>

                {/* QUALITY AUDIT SETTINGS */}
                {config.platform === 'web' && (
                  <div className="clean-section" style={{ marginTop: 24 }}>
                    <div className="inline-heading">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="discovery" size={18} />
                          <h3>Quality Audit UI &amp; Evidence</h3>
                        </div>
                        <p>Atur browser, viewport, accessibility, pixel baseline, dense-data stress, dan negative testing setelah Discovery selesai.</p>
                      </div>
                      <Badge value={config.qualityAudit?.enabled !== false ? 'Auto Run' : 'Manual'} />
                    </div>

                    <label className="toggle-row">
                      <input type="checkbox" checked={config.qualityAudit?.enabled !== false} onChange={e => quality({ enabled: e.target.checked })} />
                      <span><strong>Jalankan Quality Audit otomatis</strong><small>Memeriksa HTTP, contrast WCAG, typography, responsive overflow, accessibility, text quality, dense-data, dan screenshot evidence.</small></span>
                    </label>

                    <div className="form-grid" style={{ marginTop: 14 }}>
                      <Field label="Maksimum Route" hint="0 = semua route unik yang ditemukan; angka positif = batch terbatas.">
                        <input type="number" min={0} max={1000} value={config.qualityAudit?.maxRoutes ?? 0} onChange={e => quality({ maxRoutes: Number(e.target.value) })} />
                      </Field>
                      <Field label="Route Offset" hint="Mulai dari route ke-N untuk batch audit.">
                        <input type="number" min={0} value={config.qualityAudit?.routeOffset ?? 0} onChange={e => quality({ routeOffset: Number(e.target.value) })} />
                      </Field>
                      <Field label="Navigation Timeout (ms)" hint="10.000–180.000 ms.">
                        <input type="number" min={10000} max={180000} step={1000} value={config.qualityAudit?.navigationTimeoutMs ?? 60000} onChange={e => quality({ navigationTimeoutMs: Number(e.target.value) })} />
                      </Field>
                      <Field label="Visual Regression" hint="Required adalah standar: baseline wajib tersedia dan perubahan piksel menjadi finding. Capture hanya untuk membuat baseline terkontrol.">
                        <select value={config.qualityAudit?.visualRegression?.mode ?? 'required'} onChange={e => quality({ visualRegression: { ...config.qualityAudit?.visualRegression, mode: e.target.value as 'off' | 'capture' | 'required' } })}>
                          <option value="capture">Capture / compare</option>
                          <option value="required">Required baseline</option>
                          <option value="off">Off</option>
                        </select>
                      </Field>
                      <Field label="Allowed pixel diff (%)" hint="Batas perbedaan piksel sebelum menjadi finding.">
                        <input type="number" min={0} max={100} step={0.1} value={config.qualityAudit?.visualRegression?.allowedDiffPercent ?? 0.5} onChange={e => quality({ visualRegression: { ...config.qualityAudit?.visualRegression, allowedDiffPercent: Number(e.target.value) } })} />
                      </Field>
                    </div>

                    <div className="form-grid" style={{ marginTop: 14 }}>
                      <Field label="Mutation fixture contract" hint="Path JSON contract; wajib explicit allowMutations=true dan cleanup scenario.">
                        <input value={config.qualityAudit?.negativeTesting?.mutationFixturePath || ''} placeholder=".qc-fixtures/crud.json" onChange={e => quality({ negativeTesting: { ...config.qualityAudit?.negativeTesting, mutationFixturePath: e.target.value } })} />
                      </Field>
                      <label className={`audit-option ${config.qualityAudit?.negativeTesting?.runMutations === true ? 'selected' : ''}`} style={{ alignSelf: 'end' }}><input type="checkbox" checked={config.qualityAudit?.negativeTesting?.runMutations === true} onChange={e => quality({ negativeTesting: { ...config.qualityAudit?.negativeTesting, runMutations: e.target.checked } })} /><span>Run mutation CRUD fixture</span></label>
                    </div>

                    <div className="audit-option-group">
                      <span className="field-label">Rule tambahan</span>
                      <div className="audit-option-list">
                        <label className={`audit-option ${config.qualityAudit?.accessibility !== false ? 'selected' : ''}`}><input type="checkbox" checked={config.qualityAudit?.accessibility !== false} onChange={e => quality({ accessibility: e.target.checked })} /><span>Keyboard + screen reader tree</span></label>
                        <label className={`audit-option ${config.qualityAudit?.denseData?.enabled !== false ? 'selected' : ''}`}><input type="checkbox" checked={config.qualityAudit?.denseData?.enabled !== false} onChange={e => quality({ denseData: { ...config.qualityAudit?.denseData, enabled: e.target.checked } })} /><span>Dense table/form stress</span></label>
                        <label className={`audit-option ${config.qualityAudit?.negativeTesting?.enabled !== false ? 'selected' : ''}`}><input type="checkbox" checked={config.qualityAudit?.negativeTesting?.enabled !== false} onChange={e => quality({ negativeTesting: { ...config.qualityAudit?.negativeTesting, enabled: e.target.checked } })} /><span>Negative testing aman</span></label>
                        <label className={`audit-option ${config.qualityAudit?.stateTesting?.enabled !== false ? 'selected' : ''}`}><input type="checkbox" checked={config.qualityAudit?.stateTesting?.enabled !== false} onChange={e => quality({ stateTesting: { ...config.qualityAudit?.stateTesting, enabled: e.target.checked } })} /><span>UI states: hover/focus/error</span></label>
                        <label className={`audit-option ${config.qualityAudit?.negativeTesting?.transactionalScenarios !== false ? 'selected' : ''}`}><input type="checkbox" checked={config.qualityAudit?.negativeTesting?.transactionalScenarios !== false} onChange={e => quality({ negativeTesting: { ...config.qualityAudit?.negativeTesting, transactionalScenarios: e.target.checked } })} /><span>Transactional scenarios</span></label>
                        <label className={`audit-option ${config.qualityAudit?.screenReader?.mode === 'external' ? 'selected' : ''}`}><input type="checkbox" checked={config.qualityAudit?.screenReader?.mode === 'external'} onChange={e => quality({ screenReader: { ...config.qualityAudit?.screenReader, mode: e.target.checked ? 'external' : 'semantic' } })} /><span>External screen reader adapter</span></label>
                        <label className={`audit-option ${config.qualityAudit?.visualRegression?.updateBaseline ? 'selected' : ''}`}><input type="checkbox" checked={config.qualityAudit?.visualRegression?.updateBaseline === true} onChange={e => quality({ visualRegression: { ...config.qualityAudit?.visualRegression, updateBaseline: e.target.checked } })} /><span>Update baseline</span></label>
                      </div>
                    </div>

                    <div className="audit-option-group">
                      <span className="field-label">Browser yang dijalankan</span>
                      <div className="audit-option-list">
                        {(['chromium', 'firefox', 'webkit'] as const).map(browser => {
                          const selected = config.qualityAudit?.browsers?.includes(browser) ?? false;
                          return <label key={browser} className={`audit-option ${selected ? 'selected' : ''}`}><input type="checkbox" checked={selected} onChange={e => { const current = config.qualityAudit?.browsers ?? []; quality({ browsers: e.target.checked ? [...new Set([...current, browser])] : current.filter(item => item !== browser) }); }} /><span>{browser}</span></label>;
                        })}
                      </div>
                    </div>

                    <div className="audit-option-group">
                      <span className="field-label">Viewport yang dijalankan</span>
                      <div className="audit-option-list">
                        {(['desktop', 'tablet', 'mobile'] as const).map(viewport => {
                          const selected = config.qualityAudit?.viewports?.includes(viewport) ?? false;
                          return <label key={viewport} className={`audit-option ${selected ? 'selected' : ''}`}><input type="checkbox" checked={selected} onChange={e => { const current = config.qualityAudit?.viewports ?? []; quality({ viewports: e.target.checked ? [...new Set([...current, viewport])] : current.filter(item => item !== viewport) }); }} /><span>{viewport}</span></label>;
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* COLLAPSIBLE ADVANCED SETTINGS (FOR THOSE WHO NEED THEM, CLEAN FOR EVERYONE ELSE) */}
                <div className="advanced-accordion">
                  <button
                    type="button"
                    className="advanced-toggle-btn"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="settings" size={16} />
                      <strong>Pengaturan Lanjutan &amp; Selector (Opsional)</strong>
                    </div>
                    <span style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      ▼
                    </span>
                  </button>

                  {showAdvanced && (
                    <div className="advanced-content">
                      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                        Secara default, engine sudah memiliki deteksi otomatis cerdas untuk form login, selector button, dan batas discovery. Anda hanya perlu mengubah opsi di bawah jika aplikasi Anda menggunakan format non-standar.
                      </p>

                      {(config.backendMode === 'repo' || config.stack === 'custom' || config.services.length > 0) && (
                        <div className="runtime-services-editor">
                          <div className="inline-heading">
                            <div>
                              <h3>Runtime Services</h3>
                              <p>Definisikan service yang harus di-install, dinyalakan, dan dicek health-nya oleh managed-local runner.</p>
                            </div>
                            <button type="button" className="quiet" onClick={() => patch({ services: [...config.services, { id: `service-${Date.now()}`, name: '', kind: 'custom', workingDir: '.', installCommand: '', startCommand: '', healthCheck: config.baseUrl, port: undefined, dependsOn: [], runtimeImage: 'node:24-bookworm-slim' }] })}><Icon name="plus" size={14} /> Tambah Service</button>
                          </div>
                          {config.services.length === 0 && <p className="muted" style={{ fontSize: 12 }}>Belum ada service manual. Auto Detect tetap digunakan.</p>}
                          {config.services.map((serviceItem, index) => (
                            <div className="runtime-service-card" key={serviceItem.id || index}>
                              <div className="runtime-service-header"><strong>Service {index + 1}</strong><button type="button" className="quiet danger-text" onClick={() => patch({ services: config.services.filter((_, itemIndex) => itemIndex !== index) })}><Icon name="trash" size={14} /> Hapus</button></div>
                              <div className="form-grid">
                                <Field label="Nama Service"><input value={serviceItem.name} placeholder="web-frontend" onChange={e => updateService(index, { name: e.target.value })} /></Field>
                                <Field label="Kind"><select value={serviceItem.kind} onChange={e => updateService(index, { kind: e.target.value as Config['services'][number]['kind'] })}><option value="frontend">Frontend</option><option value="backend">Backend</option><option value="worker">Worker</option><option value="custom">Custom</option></select></Field>
                                <Field label="Runtime Image"><input value={serviceItem.runtimeImage || ''} placeholder="node:24-bookworm-slim" onChange={e => updateService(index, { runtimeImage: e.target.value })} /></Field>
                                <Field label="Working Directory"><input value={serviceItem.workingDir} placeholder="." onChange={e => updateService(index, { workingDir: e.target.value })} /></Field>
                                <Field label="Install Command"><input value={serviceItem.installCommand} placeholder="npm ci" onChange={e => updateService(index, { installCommand: e.target.value })} /></Field>
                                <Field label="Start Command"><input value={serviceItem.startCommand} placeholder="npm run dev -- --host 0.0.0.0 --port=3000" onChange={e => updateService(index, { startCommand: e.target.value })} /></Field>
                                <Field label="Health Check"><input value={serviceItem.healthCheck} placeholder="http://127.0.0.1:3000" onChange={e => updateService(index, { healthCheck: e.target.value })} /></Field>
                                <Field label="Port"><input type="number" min={1} max={65535} value={serviceItem.port || ''} placeholder="3000" onChange={e => updateService(index, { port: e.target.value ? Number(e.target.value) : undefined })} /></Field>
                                <Field label="Depends On"><input value={serviceItem.dependsOn.join(', ')} placeholder="api, database" onChange={e => updateService(index, { dependsOn: lines(e.target.value.replace(/,/g, '\n')) })} /></Field>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="form-grid">
                        <Field label="Path Halaman Login" hint="Default: /login">
                          <input
                            value={config.rules.loginPath || ''}
                            placeholder="/login"
                            onChange={e => rule({ loginPath: e.target.value })}
                          />
                        </Field>
                        <Field label="Selector Input Email" hint="CSS selector form email">
                          <input
                            value={config.rules.emailSelector || ''}
                            placeholder="input[name='email'], #email"
                            onChange={e => rule({ emailSelector: e.target.value })}
                          />
                        </Field>
                        <Field label="Selector Input Password" hint="CSS selector form password">
                          <input
                            value={config.rules.passwordSelector || ''}
                            placeholder="input[type='password'], #password"
                            onChange={e => rule({ passwordSelector: e.target.value })}
                          />
                        </Field>
                        <Field label="Selector Tombol Masuk" hint="CSS selector submit button">
                          <input
                            value={config.rules.submitSelector || ''}
                            placeholder="button[type='submit'], .btn-login"
                            onChange={e => rule({ submitSelector: e.target.value })}
                          />
                        </Field>
                        <Field label="Budget Maksimum Halaman" hint="Batas halaman yang dipetakan (1–200)">
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={config.rules.maxPages}
                            onChange={e => rule({ maxPages: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Kedalaman Navigasi (Depth)" hint="Batas tingkat klik link (0–10)">
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={config.rules.maxDepth}
                            onChange={e => rule({ maxDepth: Number(e.target.value) })}
                          />
                        </Field>
                      </div>

                      {/* ENVIRONMENT OVERRIDE */}
                      <div style={{ marginTop: 14 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                          File Environment (.env) Override (Opsional)
                        </span>
                        {!config.envUploadId ? (
                          <div
                            className={`file-dropzone ${dragOverEnv ? 'drag-over' : ''}`}
                            onDragOver={e => { e.preventDefault(); setDragOverEnv(true); }}
                            onDragLeave={() => setDragOverEnv(false)}
                            onDrop={e => {
                              e.preventDefault();
                              setDragOverEnv(false);
                              const f = e.dataTransfer.files?.[0];
                              if (f) void upload(f, 'env');
                            }}
                            onClick={() => envInputRef.current?.click()}
                            style={{ cursor: 'pointer', padding: '14px 18px' }}
                          >
                            <div className="file-dropzone-icon">
                              <Icon name="terminal" size={22} />
                            </div>
                            <div className="file-dropzone-text">
                              <strong>Upload File .env</strong>
                              <p>Opsional: file variabel environment khusus sesi pengujian.</p>
                            </div>
                            <input
                              ref={envInputRef}
                              type="file"
                              disabled={!!uploading}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void upload(f, 'env');
                              }}
                              style={{ display: 'none' }}
                            />
                            <button
                              type="button"
                              className="quiet"
                              disabled={!!uploading}
                              onClick={e => {
                                e.stopPropagation();
                                envInputRef.current?.click();
                              }}
                            >
                              Pilih .env
                            </button>
                          </div>
                        ) : (
                          <div className="upload-ready">
                            <Icon name="check" />
                            <div>
                              <strong>{filenames.env || 'File .env terunggah'}</strong>
                            </div>
                            <button
                              type="button"
                              className="quiet danger-text"
                              onClick={() => {
                                patch({ envUploadId: undefined });
                                setFilenames(f => ({ ...f, env: '' }));
                              }}
                            >
                              Lepaskan
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <label className="toggle-row" style={{ marginTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={config.executeFlows}
                    onChange={e => patch({ executeFlows: e.target.checked })}
                  />
                  <span>
                    <strong>Jalankan eksekusi test flows otomatis setelah pemetaan selesai</strong>
                    <small>Engine akan langsung memverifikasi skenario login, interaksi tombol, dan validasi form.</small>
                  </span>
                </label>
              </>
            )}

            {/* ================= STEP 2: REVIEW & LAUNCH ================= */}
            {step === 2 && (
              <>
                <div className="review-banner">
                  <Icon name="shield" size={40} />
                  <div>
                    <strong style={{ fontSize: 18 }}>{config.name || 'Untitled Project'}</strong>
                    <p style={{ marginTop: 4 }}>
                      {config.platform === 'android'
                        ? `Mobile App · Package: ${config.appId || config.apkPackageId || 'Android Target'}`
                        : `Web Application · ${config.baseUrl}`}
                    </p>
                  </div>
                  <Badge value={config.platform === 'android' ? 'Android Maestro' : 'Web Playwright'} />
                </div>

                <div className="review-summary-grid">
                  <div className="summary-item-card">
                    <div className="summary-item-header">
                      <Icon name={config.platform === 'android' ? 'android' : 'globe'} size={18} />
                      <span>Target Aplikasi</span>
                    </div>
                    <strong>{config.platform === 'android' ? 'Flutter / Android Native' : 'Web Application'}</strong>
                    <small className="mono">
                      {config.platform === 'android'
                        ? (config.apkFilename ? `APK: ${config.apkFilename}` : (config.appId || 'Pre-installed App'))
                        : config.baseUrl}
                    </small>
                  </div>

                  <div className="summary-item-card">
                    <div className="summary-item-header">
                      <Icon name="database" size={18} />
                      <span>Backend &amp; API Service</span>
                    </div>
                    <strong>{config.backendUrl || config.baseUrl || 'http://10.0.2.2:8000'}</strong>
                    <small>Mode: {config.backendMode === 'repo' ? 'Repository Bootstrap' : 'Live API Server'}</small>
                  </div>

                  <div className="summary-item-card">
                    <div className="summary-item-header">
                      <Icon name="shield" size={18} />
                      <span>Akun Login Uji</span>
                    </div>
                    <strong>{config.accounts.length} Akun Terdaftar</strong>
                    <small>{config.accounts[0]?.email || 'tester.qc@example.com'} ({config.accounts[0]?.role || 'tester'})</small>
                  </div>

                  <div className="summary-item-card">
                    <div className="summary-item-header">
                      <Icon name="database" size={18} />
                      <span>Database &amp; Data</span>
                    </div>
                    <strong>{config.database.source === 'sql' ? 'SQL Dump Import' : 'Database Backend Aktif'}</strong>
                    <small>{filenames.sql ? `File: ${filenames.sql}` : 'Menggunakan data backend langsung'}</small>
                  </div>

                  <div className="summary-item-card">
                    <div className="summary-item-header">
                      <Icon name="discovery" size={18} />
                      <span>Quality Audit UI</span>
                    </div>
                    <strong>{config.platform === 'web' && config.qualityAudit?.enabled !== false ? 'Auto Run aktif' : 'Tidak dijalankan'}</strong>
                    <small>{config.platform === 'web' ? `${config.qualityAudit?.browsers?.join(', ') || 'browser'} · ${config.qualityAudit?.viewports?.join(', ') || 'viewport'}` : 'Khusus target Web'}</small>
                  </div>
                </div>

                <Notice>
                  Semua konfigurasi telah divalidasi. Begitu tombol dimulai, autonomous engine akan memvalidasi koneksi, memindai alur interaktif aplikasi, dan menyajikan live visual inspeksi secara instan.
                </Notice>
              </>
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
                disabled={busy || !!uploading}
                onClick={() => go(step + 1)}
              >
                Lanjutkan <Icon name="arrow" size={16} />
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

        {/* SIDEBAR SUMMARY */}
        <aside className="wizard-summary">
          <Panel title="Ringkasan Suite" description="Status konfigurasi aktif">
            <div className="summary-identity">
              <span className="project-monogram">
                {config.name.trim().slice(0, 2).toUpperCase() || (config.platform === 'android' ? 'FL' : 'WB')}
              </span>
              <div>
                <strong>{config.name || 'Untitled QC Suite'}</strong>
                <small>{config.platform === 'android' ? 'Flutter / Android App' : 'Web Application'}</small>
              </div>
            </div>
            <dl className="summary-list">
              <div>
                <dt><Icon name={config.platform === 'android' ? 'android' : 'globe'} size={15} />Platform</dt>
                <dd>{config.platform === 'android' ? 'Android / Flutter' : 'Web Browser'}</dd>
              </div>
              <div>
                <dt><Icon name="database" size={15} />Backend API</dt>
                <dd className="mono" style={{ fontSize: 11 }}>
                  {(config.backendUrl || config.baseUrl || '10.0.2.2:8000').replace(/^https?:\/\//, '')}
                </dd>
              </div>
              {config.platform === 'android' && (
                <div>
                  <dt><Icon name="device" size={15} />Binary APK</dt>
                  <dd>{config.apkFilename ? 'APK Terupload' : (config.appId ? 'Package ID' : 'Belum ada')}</dd>
                </div>
              )}
              <div>
                <dt><Icon name="shield" size={15} />Akun Tester</dt>
                <dd>{config.accounts.length} Akun</dd>
              </div>
              <div>
                <dt><Icon name="discovery" size={15} />Auto-Run</dt>
                <dd>{config.executeFlows ? 'Aktif' : 'Manual Review'}</dd>
              </div>
            </dl>
          </Panel>

          <div className="engine-note">
            <span className="eyebrow">STATUS ENGINE</span>
            <div>
              <span>Playwright Web</span>
              <Badge value={system?.playwright.available ? 'ready' : 'offline'} />
            </div>
            <div>
              <span>Maestro Mobile</span>
              <Badge value={system?.maestro.available ? 'ready' : 'offline'} />
            </div>
            <div>
              <span>ADB Devices</span>
              <Badge
                value={
                  system?.adb?.available
                    ? system.adb.devices?.length
                      ? `${system.adb.devices.length} Online`
                      : 'ready'
                    : 'offline'
                }
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
