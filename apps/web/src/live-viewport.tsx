import React, { useState, useEffect } from 'react';
import { Job, Step, Artifact, ZannoraEvidence } from './types';
import { Icon } from './ui';
import { request } from './api';

type FullFlowVideo = {
  available: boolean;
  name?: string;
  size?: number;
  updatedAt?: string;
  url?: string;
};

function formatBytes(bytes?: number) {
  if (!bytes || bytes < 1024) return `${bytes ?? 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface StepAction {
  index: number;
  type: 'navigate' | 'type' | 'click' | 'assert' | 'launch';
  selector: string;
  description: string;
  url?: string;
  value?: string;
  cursorPos?: { x: number; y: number }; // percentage 0-100
}

const WEB_STEPS: StepAction[] = [
  {
    index: 1,
    type: 'navigate',
    selector: 'window.location',
    description: 'Mengunjungi halaman login aplikasi web',
    url: 'https://app.zannora.com/auth/login',
    cursorPos: { x: 50, y: 30 }
  },
  {
    index: 2,
    type: 'type',
    selector: 'input#email',
    description: 'Memasukkan email: tester.qc@zannora.com',
    url: 'https://app.zannora.com/auth/login',
    value: 'tester.qc@zannora.com',
    cursorPos: { x: 42, y: 44 }
  },
  {
    index: 3,
    type: 'type',
    selector: 'input#password',
    description: 'Memasukkan password autentikasi aman',
    url: 'https://app.zannora.com/auth/login',
    value: '••••••••••••',
    cursorPos: { x: 42, y: 56 }
  },
  {
    index: 4,
    type: 'click',
    selector: 'button.btn-primary[type="submit"]',
    description: 'Mengklik tombol "Masuk ke Sistem"',
    url: 'https://app.zannora.com/auth/login',
    cursorPos: { x: 50, y: 68 }
  },
  {
    index: 5,
    type: 'assert',
    selector: '.dashboard-metrics-grid',
    description: 'Verifikasi pengalihan sukses ke /dashboard',
    url: 'https://app.zannora.com/dashboard',
    cursorPos: { x: 65, y: 35 }
  },
  {
    index: 6,
    type: 'click',
    selector: 'nav a[href="/reports/sales"]',
    description: 'Menavigasi ke modul laporan penjualan',
    url: 'https://app.zannora.com/reports/sales',
    cursorPos: { x: 18, y: 48 }
  }
];

const MOBILE_STEPS: StepAction[] = [
  {
    index: 1,
    type: 'launch',
    selector: 'com.tasdig.app.MainActivity',
    description: 'Memulai Activity Android aplikasi TasDig Mobile',
    url: 'activity://MainActivity',
    cursorPos: { x: 50, y: 50 }
  },
  {
    index: 2,
    type: 'click',
    selector: 'Widget("Izinkan Notifikasi & Lokasi")',
    description: 'Menyetujui dialog permission sistem Android',
    url: 'dialog://PermissionDialog',
    cursorPos: { x: 50, y: 62 }
  },
  {
    index: 3,
    type: 'type',
    selector: 'TextField("Email / NISN Siswa")',
    description: 'Menginput kredensial akun: 1024883921',
    url: 'screen://LoginScreen',
    value: '1024883921',
    cursorPos: { x: 50, y: 45 }
  },
  {
    index: 4,
    type: 'click',
    selector: 'ElevatedButton("Masuk")',
    description: 'Mengetuk tombol "Masuk" dengan animasi ripple',
    url: 'screen://LoginScreen',
    cursorPos: { x: 50, y: 58 }
  },
  {
    index: 5,
    type: 'assert',
    selector: 'BottomNavigationBar[item="Presensi"]',
    description: 'Verifikasi Shell Navigasi Home & Presensi aktif',
    url: 'screen://MainShell',
    cursorPos: { x: 50, y: 92 }
  },
  {
    index: 6,
    type: 'click',
    selector: 'QuickActionTile("Ajukan Izin Sakit")',
    description: 'Mengetuk menu "Ajukan Izin" untuk input form',
    url: 'screen://MainShell',
    cursorPos: { x: 75, y: 38 }
  }
];

function getLatestScreenshot(job?: Job | null): { url: string; name: string } | null {
  if (!job || !job.results || job.results.length === 0) return null;
  for (let i = job.results.length - 1; i >= 0; i--) {
    const res = job.results[i];
    if (res.artifacts) {
      for (const a of res.artifacts) {
        if (typeof a === 'string') {
          if (a.endsWith('.png')) {
            const filename = a.split(/[\\/]/).pop() || 'screenshot.png';
            return { url: `/api/v1/discovery/jobs/${job.id}/artifacts/${res.runId}/${filename}`, name: filename };
          }
        } else if (a && typeof a === 'object') {
          const art = a as Artifact;
          if (art.type === 'screenshot' || (art.path && art.path.endsWith('.png')) || art.url) {
            if (art.url) return { url: art.url, name: art.name || 'screenshot.png' };
            const filename = art.name || (art.path ? art.path.split(/[\\/]/).pop() : 'screenshot.png') || 'screenshot.png';
            return { url: `/api/v1/discovery/jobs/${job.id}/artifacts/${res.runId}/${filename}`, name: filename };
          }
        }
      }
    }
  }
  return null;
}

export function LiveViewport({ job, evidence }: { job?: Job | null; evidence?: ZannoraEvidence | null }) {
  const isProjectSelected = Boolean(job || evidence);
  const evidenceScreenshot = evidence?.groups.find((group) => group.id === 'full-flow')?.screenshots[0] || evidence?.groups.find((group) => group.screenshots.length > 0)?.screenshots[0];
  const projectPlatform = job?.config?.platform === 'android' ? 'android' : 'web';

  const [platform, setPlatform] = useState<'web' | 'android'>(
    isProjectSelected ? projectPlatform : 'web'
  );

  // Sync platform when active job changes
  useEffect(() => {
    if (job && job.config?.platform) {
      setPlatform(job.config.platform === 'android' ? 'android' : 'web');
    }
  }, [job]);

  // Real Android Device Live Screen State
  const [screenUrl, setScreenUrl] = useState<string>(`/api/v1/android/screen?t=${Date.now()}`);
  const [deviceRatio, setDeviceRatio] = useState<string>('1080 / 2436');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [liveScreenError, setLiveScreenError] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const isCapturingRef = React.useRef(false);

  // Preload next frame to eliminate flickering
  const fetchNextScreen = React.useCallback(() => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    setIsCapturing(true);

    const nextUrl = `/api/v1/android/screen?t=${Date.now()}`;
    const preloader = new Image();

    preloader.onload = () => {
      // Frame has downloaded into memory; swap without any blank gap/flicker
      setScreenUrl(nextUrl);
      setLiveScreenError(false);
      isCapturingRef.current = false;
      setIsCapturing(false);

      if (preloader.naturalWidth && preloader.naturalHeight) {
        setDeviceRatio(`${preloader.naturalWidth} / ${preloader.naturalHeight}`);
      }
    };

    preloader.onerror = () => {
      isCapturingRef.current = false;
      setIsCapturing(false);
      // Only set error if no screen has loaded yet
      setLiveScreenError(prev => (!screenUrl ? true : prev));
    };

    preloader.src = nextUrl;
  }, [screenUrl]);

  // Initial load
  useEffect(() => {
    if (isProjectSelected && platform === 'android') {
      fetchNextScreen();
    }
  }, [isProjectSelected, platform, fetchNextScreen]);

  // Periodic Auto-refresh without flicker (every 2.5s)
  useEffect(() => {
    if (!isProjectSelected || platform !== 'android' || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchNextScreen();
    }, 2500);
    return () => clearInterval(interval);
  }, [isProjectSelected, platform, autoRefresh, fetchNextScreen]);

  // Latest artifact screenshot from test runs (if available)
  const latestArtifact = getLatestScreenshot(job) || (evidenceScreenshot ? { url: evidenceScreenshot.url, name: evidenceScreenshot.name } : null);
  const latestResult = job?.results && job.results.length > 0 ? job.results[job.results.length - 1] : undefined;
  const [fullFlowVideo, setFullFlowVideo] = useState<FullFlowVideo | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadFullFlowVideo = async () => {
      try {
        const result = await request<FullFlowVideo>('/api/v1/test-runs/full-flow');
        if (mounted) setFullFlowVideo(result.available ? result : null);
      } catch {
        if (mounted) setFullFlowVideo(null);
      }
    };
    void loadFullFlowVideo();
    const interval = window.setInterval(() => void loadFullFlowVideo(), 10000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // Dummy Simulation State (only used when !isProjectSelected)
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [speed] = useState<number>(2500);

  const steps = platform === 'web' ? WEB_STEPS : MOBILE_STEPS;
  const currentStep = steps[stepIndex % steps.length];

  // Auto step timer (only active if !isProjectSelected)
  useEffect(() => {
    if (isProjectSelected || !isPlaying) return;
    const timer = setInterval(() => {
      setStepIndex(prev => (prev + 1) % steps.length);
    }, speed);
    return () => clearInterval(timer);
  }, [isProjectSelected, isPlaying, speed, steps.length]);

  // Trigger ripple animation for dummy simulation
  useEffect(() => {
    if (isProjectSelected) return;
    if (currentStep.type === 'click' || currentStep.type === 'type') {
      const pos = currentStep.cursorPos || { x: 50, y: 50 };
      setClickRipple({ x: pos.x, y: pos.y, active: true });
      const t = setTimeout(() => {
        setClickRipple(prev => ({ ...prev, active: false }));
      }, 700);
      return () => clearTimeout(t);
    }
  }, [isProjectSelected, currentStep]);

  const handlePlatformChange = (p: 'web' | 'android') => {
    setPlatform(p);
    setStepIndex(0);
    setClickRipple({ x: 0, y: 0, active: false });
  };

  return (
    <div className="live-viewport-container">
      {/* Control Bar */}
      <div className="live-viewport-toolbar">
        {isProjectSelected ? (
          /* Active Project Mode: Lock to the project's actual platform */
          <div className="viewport-platform-switcher">
            <span className="active-project-tag">
              <Icon name={platform === 'android' ? 'android' : 'globe'} size={15} />
              <span>{job?.name} ({platform === 'android' ? 'Mobile App' : 'Website'})</span>
            </span>
          </div>
        ) : (
          /* Demo Mode: Allow switching platforms with dummy simulation */
          <div className="viewport-platform-switcher">
            <button
              type="button"
              className={`platform-btn ${platform === 'web' ? 'active' : ''}`}
              onClick={() => handlePlatformChange('web')}
            >
              <Icon name="globe" size={16} />
              <span>Website (Playwright)</span>
            </button>
            <button
              type="button"
              className={`platform-btn ${platform === 'android' ? 'active' : ''}`}
              onClick={() => handlePlatformChange('android')}
            >
              <Icon name="android" size={16} />
              <span>Mobile App (Maestro)</span>
            </button>
          </div>
        )}

        <div className="viewport-live-indicator">
          <span className="live-pulse" />
          <span className="live-label">
            {isProjectSelected
              ? (platform === 'android' ? (liveScreenError ? 'LAYAR HP STANDBY' : 'LIVE DEVICE CONNECTED') : 'WEB TARGET ACTIVE')
              : (isPlaying ? 'ENGINE EXECUTING (DEMO)' : 'SIMULATION PAUSED')}
          </span>
          <span className="live-target-badge">
            {isProjectSelected
              ? (platform === 'android' ? (job?.config?.deviceId || 'Android Device') : (job?.config?.baseUrl || 'Headless Chromium'))
              : (platform === 'web' ? 'Headless Chromium' : 'Android AVD 5554')}
          </span>
        </div>

        {isProjectSelected ? (
          <div className="viewport-actions">
            {platform === 'android' && (
              <>
                <button
                  type="button"
                  className={`tool-btn ${autoRefresh ? 'active' : ''}`}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  title={autoRefresh ? 'Matikan Auto-Refresh' : 'Aktifkan Auto-Refresh (2.5s)'}
                >
                  <Icon name={autoRefresh ? 'runs' : 'close'} size={15} />
                  <span>{autoRefresh ? 'Live Auto-Refresh (ON)' : 'Live Auto-Refresh (OFF)'}</span>
                </button>
                <button
                  type="button"
                  className={`tool-btn ${isCapturing ? 'loading' : ''}`}
                  onClick={() => {
                    setLiveScreenError(false);
                    fetchNextScreen();
                  }}
                  title="Ambil Tangkapan Layar HP Sekarang"
                  disabled={isCapturing}
                >
                  <Icon name="refresh" size={15} />
                  <span>{isCapturing ? 'Mengambil Layar…' : 'Refresh Layar HP'}</span>
                </button>
              </>
            )}
            {platform === 'web' && (
              <button
                type="button"
                className="tool-btn"
                onClick={() => setScreenUrl(`/api/v1/android/screen?t=${Date.now()}`)}
                title="Muat Ulang Tampilan Web"
              >
                <Icon name="refresh" size={15} />
                <span>Refresh View</span>
              </button>
            )}
          </div>
        ) : (
          <div className="viewport-actions">
            <button
              type="button"
              className="tool-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Jeda Simulasi' : 'Jalankan Simulasi'}
            >
              <Icon name={isPlaying ? 'close' : 'runs'} size={15} />
              <span>{isPlaying ? 'Jeda' : 'Jalankan'}</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setStepIndex(prev => (prev + 1) % steps.length)}
              title="Langkah Berikutnya"
            >
              <Icon name="arrow" size={15} />
              <span>Next Step</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setStepIndex(0)}
              title="Reset ke Langkah Awal"
            >
              <Icon name="refresh" size={15} />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Viewport Screen */}
      <div className="live-viewport-stage">
        {platform === 'web' ? (
          /* ==================================================== */
          /* WEB BROWSER VIEWPORT FRAME                           */
          /* ==================================================== */
          <div className="browser-mockup-frame">
            {/* Browser Window Header */}
            <div className="browser-mockup-header">
              <div className="browser-window-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="browser-tabs-row">
                <div className="browser-tab active">
                  <span className="tab-icon">🌐</span>
                  <span className="tab-title">
                    {isProjectSelected ? (job?.name || evidence?.project || 'Web Target') : (stepIndex >= 4 ? 'Dashboard Utama - Zannora ERP' : 'Autentikasi Pengguna - Portal QC')}
                  </span>
                </div>
              </div>
              <div className="browser-address-bar">
                <span className="ssl-lock">🔒</span>
                <span className="url-scheme">https://</span>
                <span className="url-body">
                  {isProjectSelected
                    ? (job?.config?.baseUrl?.replace(/^https?:\/\//, '') || 'localhost')
                    : (currentStep.url?.replace('https://', '') || 'app.zannora.com/auth/login')}
                </span>
                <span className="reload-icon" onClick={() => fetchNextScreen()}>⟳</span>
              </div>
            </div>

            {/* Browser Render Canvas */}
            <div className="browser-content-canvas">
              {isProjectSelected ? (
                /* REAL WEB VIEW (NO DUMMY ANIMATION) */
                fullFlowVideo?.available && fullFlowVideo.url ? (
                  <div className="live-screen-wrapper full-flow-video-wrapper">
                    <span className="live-screen-badge artifact">
                      <span>▶ Full E2E Flow</span>
                    </span>
                    <video
                      key={`${fullFlowVideo.url}-${fullFlowVideo.updatedAt ?? ''}`}
                      src={fullFlowVideo.url}
                      className="real-browser-screen full-flow-video"
                      controls
                      playsInline
                      preload="metadata"
                    />
                    <div className="full-flow-video-meta">
                      <strong>Video fisik lengkap tersedia</strong>
                      <span>{formatBytes(fullFlowVideo.size)} · Putar dari awal sampai akhir</span>
                    </div>
                  </div>
                ) : latestArtifact ? (
                  <div className="live-screen-wrapper">
                    <span className="live-screen-badge artifact">
                      <span>📸 Tangkapan Layar Pengujian</span>
                    </span>
                    <img
                      src={latestArtifact.url}
                      alt="Tangkapan Layar Pengujian Web"
                      className="real-browser-screen"
                    />
                  </div>
                ) : (
                  <div className="viewport-empty-state">
                    <div className="empty-state-icon">🌐</div>
                    <h4>Belum ada tampilan</h4>
                    <p>Jalankan skenario pengujian web pada proyek ini untuk memuat tangkapan layar otomatis dari browser.</p>
                  </div>
                )
              ) : (
                /* DUMMY SIMULATION (ONLY SHOWN WHEN NO PROJECT SELECTED) */
                <>
                  <div
                    className={`virtual-cursor ${currentStep.type === 'click' ? 'clicking' : ''}`}
                    style={{
                      left: `${currentStep.cursorPos?.x ?? 50}%`,
                      top: `${currentStep.cursorPos?.y ?? 50}%`
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
                        fill="#35D0BA"
                        stroke="#070B14"
                        strokeWidth="1.7"
                      />
                    </svg>
                    {clickRipple.active && (
                      <span className="cursor-ripple" />
                    )}
                  </div>

                  {stepIndex < 4 ? (
                    <div className="mock-web-page login-mode">
                      <div className="mock-login-card">
                        <div className="mock-brand">
                          <div className="brand-logo-circle">Z</div>
                          <div>
                            <h4>Zannora Enterprise</h4>
                            <small>Autonomous QA Test Target</small>
                          </div>
                        </div>

                        <div className="mock-form">
                          <div className={`mock-input-group ${currentStep.selector.includes('email') ? 'focused-step' : ''}`}>
                            <label>Alamat Email</label>
                            <div className="mock-input">
                              <span>{stepIndex >= 1 ? 'tester.qc@zannora.com' : ''}</span>
                              {currentStep.selector.includes('email') && <span className="typing-cursor">|</span>}
                            </div>
                          </div>

                          <div className={`mock-input-group ${currentStep.selector.includes('password') ? 'focused-step' : ''}`}>
                            <label>Kata Sandi</label>
                            <div className="mock-input">
                              <span>{stepIndex >= 2 ? '••••••••••••••••' : ''}</span>
                              {currentStep.selector.includes('password') && <span className="typing-cursor">|</span>}
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`mock-submit-btn ${currentStep.selector.includes('submit') ? 'active-click' : ''}`}
                          >
                            {stepIndex >= 3 ? 'Memverifikasi Kredensial…' : 'Masuk ke Sistem'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mock-web-page dashboard-mode">
                      <header className="mock-dash-topbar">
                        <div className="mock-dash-logo">Zannora ERP</div>
                        <div className="mock-dash-user">QA Automation Bot</div>
                      </header>
                      <div className="mock-dash-body">
                        <aside className="mock-dash-sidebar">
                          <div className="mock-side-item active">Ringkasan</div>
                          <div className={`mock-side-item ${currentStep.selector.includes('sales') ? 'focused-step' : ''}`}>
                            Laporan Penjualan
                          </div>
                          <div className="mock-side-item">Data Pelanggan</div>
                          <div className="mock-side-item">Pengaturan</div>
                        </aside>
                        <main className="mock-dash-main">
                          <h3>Ringkasan Aktivitas Sistem</h3>
                          <div className="mock-metrics-row">
                            <div className="mock-metric-box">
                              <small>Total Transaksi</small>
                              <strong>Rp 428.500.000</strong>
                            </div>
                            <div className="mock-metric-box">
                              <small>Pengguna Aktif</small>
                              <strong>1.482 User</strong>
                            </div>
                            <div className="mock-metric-box highlight">
                              <small>Uptime Runner</small>
                              <strong>99.98%</strong>
                            </div>
                          </div>
                          <div className="mock-table-preview">
                            <div className="mock-table-head">Riwayat Sesi Terverifikasi</div>
                            <div className="mock-table-row">
                              <span>Session #49120</span>
                              <span className="badge-pass">Verified Playwright</span>
                            </div>
                            <div className="mock-table-row">
                              <span>Session #49121</span>
                              <span className="badge-pass">Verified Playwright</span>
                            </div>
                          </div>
                        </main>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          /* ==================================================== */
          /* MOBILE SMARTPHONE VIEWPORT FRAME                     */
          /* ==================================================== */
          isProjectSelected ? (
            /* REAL CONNECTED PHONE - ADAPTS EXACT PHYSICAL ASPECT RATIO, ZERO FLICKER */
            <div
              className="phone-mockup-frame real-device-frame"
              style={{
                aspectRatio: deviceRatio,
              }}
            >
              <div className="phone-chassis real-device-chassis">
                <div className="phone-screen-content real-device-content">
                  {!liveScreenError ? (
                    <div className="live-screen-wrapper">
                      <span className="live-screen-badge">
                        <span className="live-screen-dot" />
                        <span>LIVE HP</span>
                      </span>
                      <img
                        src={screenUrl}
                        alt="Tampilan Langsung HP"
                        className="real-device-screen"
                        onError={() => {
                          if (!screenUrl) setLiveScreenError(true);
                        }}
                      />
                    </div>
                  ) : latestArtifact ? (
                    <div className="live-screen-wrapper">
                      <span className="live-screen-badge artifact">
                        <span>📸 Tangkapan Layar Terakhir</span>
                      </span>
                      <img
                        src={latestArtifact.url}
                        alt="Tangkapan Layar Pengujian Android"
                        className="real-device-screen"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth && img.naturalHeight) {
                            setDeviceRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="viewport-empty-state">
                      <div className="empty-state-icon">📱</div>
                      <h4>Belum ada tampilan</h4>
                      <p>Perangkat HP belum terhubung via ADB atau belum ada tampilan aplikasi yang aktif.</p>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => {
                          setLiveScreenError(false);
                          fetchNextScreen();
                        }}
                      >
                        <Icon name="refresh" size={14} />
                        <span>Coba Muat Layar HP</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* DUMMY SIMULATION FRAME (ONLY SHOWN WHEN NO PROJECT IS SELECTED) */
            <div className="phone-mockup-frame demo-device-frame">
              <div className="phone-chassis">
                {/* Speaker & Punch-hole Camera */}
                <div className="phone-top-island">
                  <span className="phone-speaker" />
                  <span className="phone-camera" />
                </div>

                {/* Android Status Bar */}
                <div className="phone-status-bar">
                  <span className="status-time">
                    {new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  <div className="status-icons">
                    <span>5G</span>
                    <span>📶</span>
                    <span>🔋 95%</span>
                  </div>
                </div>

                {/* Mobile Screen Content */}
                <div className="phone-screen-content">
                  {clickRipple.active && (
                    <span
                      className="phone-tap-ripple"
                      style={{
                        left: `${currentStep.cursorPos?.x ?? 50}%`,
                        top: `${currentStep.cursorPos?.y ?? 50}%`
                      }}
                    />
                  )}

                  {stepIndex < 4 ? (
                    <div className="mobile-app-screen login-state">
                      <div className="mobile-app-header">
                        <span className="app-logo-badge">TD</span>
                        <h2>TasDig Mobile</h2>
                        <p>Sistem Presensi &amp; Administrasi Siswa</p>
                      </div>

                      {stepIndex === 1 && (
                        <div className="mobile-permission-dialog">
                          <div className="permission-card">
                            <div className="perm-icon">📍</div>
                            <h4>Izinkan Akses Lokasi &amp; Notifikasi?</h4>
                            <p>Aplikasi membutuhkan data koordinat GPS untuk verifikasi absensi presensi harian.</p>
                            <button type="button" className="perm-btn active">
                              Saat Aplikasi Digunakan
                            </button>
                            <button type="button" className="perm-btn quiet">
                              Hanya Kali Ini
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mobile-input-card">
                        <div className={`mobile-field ${currentStep.selector.includes('NISN') ? 'focused-field' : ''}`}>
                          <label>NISN / Nomor Induk Siswa</label>
                          <div className="field-box">
                            <span>{stepIndex >= 2 ? '1024883921' : ''}</span>
                            {currentStep.selector.includes('NISN') && <span className="typing-cursor">|</span>}
                          </div>
                        </div>

                        <div className="mobile-field">
                          <label>PIN Keamanan</label>
                          <div className="field-box">
                            <span>{stepIndex >= 3 ? '••••••' : ''}</span>
                            {currentStep.selector.includes('PIN') && <span className="typing-cursor">|</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`mobile-login-btn ${currentStep.selector.includes('Masuk') ? 'active-tap' : ''}`}
                        >
                          {stepIndex >= 3 ? 'Memproses Masuk…' : 'Masuk ke Akun'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mobile-app-screen shell-state">
                      <div className="mobile-top-bar">
                        <div className="user-greet">
                          <small>Selamat Datang,</small>
                          <strong>Ahmad Fauzan</strong>
                        </div>
                        <span className="notif-bell">🔔</span>
                      </div>

                      <div className="mobile-feed">
                        <div className="attendance-card-quick">
                          <div className="card-badge">Presensi Hari Ini</div>
                          <div className="time-display">06:48 WIB</div>
                          <p>Status: Masuk Tepat Waktu (Gerbang Barat)</p>
                        </div>

                        <div className="quick-actions-title">Aksi Cepat Siswa</div>
                        <div className="quick-actions-grid">
                          <div className={`action-tile ${currentStep.selector.includes('Izin') ? 'focused-field' : ''}`}>
                            <span className="tile-icon">📝</span>
                            <small>Izin Sakit</small>
                          </div>
                          <div className="action-tile">
                            <span className="tile-icon">💳</span>
                            <small>SPP Online</small>
                          </div>
                          <div className="action-tile">
                            <span className="tile-icon">📖</span>
                            <small>Jadwal Ujian</small>
                          </div>
                        </div>
                      </div>

                      <div className="mobile-bottom-nav">
                        <div className="nav-tab active">
                          <span>🏠</span>
                          <small>Beranda</small>
                        </div>
                        <div className={`nav-tab ${currentStep.selector.includes('Presensi') ? 'focused-field' : ''}`}>
                          <span>📍</span>
                          <small>Presensi</small>
                        </div>
                        <div className="nav-tab">
                          <span>📅</span>
                          <small>Jadwal</small>
                        </div>
                        <div className="nav-tab">
                          <span>👤</span>
                          <small>Profil</small>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Android Bottom Navigation Gesture Bar */}
              <div className="phone-bottom-gesture">
                <span className="gesture-bar" />
              </div>
            </div>
          )
        )}
      </div>

      {/* Active Action Ticker Banner */}
      <div className="live-action-ticker">
        {isProjectSelected ? (
          /* Real Project Status Ticker */
          <>
            <div className="ticker-step-pill">
              <span className="step-num">{latestResult ? (latestResult.status === 'PASSED' ? 'PASSED' : 'FAILED') : 'READY'}</span>
              <span className="step-total">{latestResult ? `${latestResult.steps?.length ?? 0} STEPS` : '0 RUNS'}</span>
            </div>

            <div className="ticker-action-badge">
              <span className={`action-tag action-${latestResult ? (latestResult.status === 'PASSED' ? 'assert' : 'click') : 'navigate'}`}>
                {platform === 'android' ? 'MAESTRO NATIVE' : 'PLAYWRIGHT WEB'}
              </span>
            </div>

            <div className="ticker-details">
              <strong className="ticker-desc">
                {latestResult 
                  ? `Pengujian Terakhir: Flow "${latestResult.flowId}" selesai dengan status ${latestResult.status}`
                    : `Proyek aktif: ${job?.name || evidence?.project || 'Zannora'}. Evidence siap diputar dan diperiksa.`}
              </strong>
              <div className="ticker-target mono">
                <span className="target-label">Target:</span>
                <code>{platform === 'android' ? (job?.config?.appId || job?.config?.apkPackageId || 'Android App') : (job?.config?.baseUrl || 'Web Application')}</code>
              </div>
            </div>

            <div className="ticker-telemetry">
              <div className="telemetry-item">
                <small>Platform</small>
                <span style={{ color: 'var(--cyan)' }}>{platform.toUpperCase()}</span>
              </div>
              <div className="telemetry-item">
                <small>Hasil Akhir</small>
                <span style={{ color: latestResult?.status === 'PASSED' ? 'var(--green)' : 'var(--text-dim)' }}>
                  {latestResult?.status || 'Belum diuji'}
                </span>
              </div>
              <div className="telemetry-item">
                <small>Tangkapan Layar</small>
                <span>{latestArtifact ? 'Tersedia' : (!liveScreenError && platform === 'android' ? 'Live Stream' : 'Kosong')}</span>
              </div>
            </div>
          </>
        ) : (
          /* Dummy Action Ticker Banner (only when no project is selected) */
          <>
            <div className="ticker-step-pill">
              <span className="step-num">STEP 0{currentStep.index}</span>
              <span className="step-total">/ 0{steps.length}</span>
            </div>

            <div className="ticker-action-badge">
              <span className={`action-tag action-${currentStep.type}`}>
                {currentStep.type.toUpperCase()}
              </span>
            </div>

            <div className="ticker-details">
              <strong className="ticker-desc">{currentStep.description}</strong>
              <div className="ticker-target mono">
                <span className="target-label">Target Selector:</span>
                <code>{currentStep.selector}</code>
              </div>
            </div>

            <div className="ticker-telemetry">
              <div className="telemetry-item">
                <small>Latency</small>
                <span>128 ms</span>
              </div>
              <div className="telemetry-item">
                <small>Engine Exit</small>
                <span style={{ color: 'var(--green)' }}>0 (OK)</span>
              </div>
              <div className="telemetry-item">
                <small>Render Buffer</small>
                <span>60 FPS</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Step Timeline Pills */}
      <div className="live-steps-timeline">
        {isProjectSelected ? (
          /* Real Steps Timeline from latest test run */
          latestResult?.steps && latestResult.steps.length > 0 ? (
            latestResult.steps.map((s: Step, i: number) => (
              <div
                key={s.id || i}
                className={`timeline-step-chip ${s.status === 'PASSED' ? 'done' : 'current'}`}
                style={{ cursor: 'default' }}
              >
                <span className="chip-num">{s.status === 'PASSED' ? '✓' : `0${i + 1}`}</span>
                <span className="chip-title">{s.action?.toUpperCase() || `STEP ${i + 1}`}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-dim)' }}>
              Belum ada langkah pengujian yang dieksekusi untuk proyek ini.
            </div>
          )
        ) : (
          /* Dummy Step Timeline (only when no project is selected) */
          steps.map((s, i) => (
            <button
              type="button"
              key={s.index}
              className={`timeline-step-chip ${stepIndex === i ? 'current' : stepIndex > i ? 'done' : ''}`}
              onClick={() => {
                setStepIndex(i);
                setIsPlaying(false);
              }}
            >
              <span className="chip-num">{stepIndex > i ? '✓' : `0${s.index}`}</span>
              <span className="chip-title">{s.type.toUpperCase()}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
