import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Job, Page, Flow, Result, Step, SystemStatus, View, ZannoraEvidence, EvidenceAsset } from './types';
import { Icon, Badge, Panel, Metric, Progress, Notice, Empty } from './ui';
import { Wizard } from './wizard';
import { LiveViewport } from './live-viewport';
import { request, send, jobPath, artifactUrl, downloadReport, date, duration, errorText } from './api';

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('qc_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qc_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const [currentView, setCurrentView] = useState<View>('overview');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // App Map state
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [mapFilter, setMapFilter] = useState<'all' | 'public' | 'authenticated' | 'error'>('all');
  const [mapViewMode, setMapViewMode] = useState<'table' | 'cards'>('table');
  const [fullScreenshot, setFullScreenshot] = useState<string | null>(null);

  // Flow Review state
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [flowEditorSource, setFlowEditorSource] = useState<string>('');
  const [compiledPreview, setCompiledPreview] = useState<{ title: string; content: string } | null>(null);

  // Terminal state
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState<string>('');

  // Edit job state
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Report view filters
  const [reportAttempt, setReportAttempt] = useState<string>('latest');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'PASSED' | 'FAILED'>('all');

  // Curated Zannora evidence state
  const [zannoraEvidence, setZannoraEvidence] = useState<ZannoraEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceGroupFilter, setEvidenceGroupFilter] = useState('all');

  // Live WIB Clock
  const formatCurrentWIB = () => new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date()) + ' WIB';

  const [wibClock, setWibClock] = useState<string>(formatCurrentWIB);

  useEffect(() => {
    const timer = setInterval(() => {
      setWibClock(formatCurrentWIB());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load jobs list
  const refreshJobs = useCallback(async () => {
    try {
      const data = await request<Job[]>('/api/v1/discovery/jobs');
      setJobs(data);
      if (data.length > 0 && !activeJobId) {
        setActiveJobId(data[0].id);
      }
    } catch {
      // API may be booting
    }
  }, [activeJobId]);

  // Load system status
  const refreshSystem = useCallback(async () => {
    try {
      const status = await request<SystemStatus>('/api/v1/system/status');
      setSystem(status);
      setApiConnected(true);
    } catch {
      setApiConnected(false);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    void refreshSystem();
    void refreshJobs();
    const interval = setInterval(() => {
      void refreshSystem();
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshSystem, refreshJobs]);

  const refreshZannoraEvidence = useCallback(async () => {
    setEvidenceLoading(true);
    try {
      const evidence = await request<ZannoraEvidence>('/api/v1/zannora-evidence');
      setZannoraEvidence(evidence);
      setEvidenceError('');
    } catch (error) {
      setEvidenceError(errorText(error));
    } finally {
      setEvidenceLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshZannoraEvidence();
  }, [refreshZannoraEvidence]);

  // Poll active job details
  useEffect(() => {
    if (!activeJobId) {
      setActiveJob(null);
      return;
    }

    let timer: number | undefined;
    let cancelled = false;

    const pollJob = async () => {
      try {
        const job = await request<Job>(jobPath(activeJobId));
        if (cancelled) return;
        setActiveJob(job);
        if (job.status === 'RUNNING' || job.status === 'QUEUED') {
          timer = window.setTimeout(() => void pollJob(), 1200);
        } else {
          void refreshJobs();
        }
      } catch {
        if (!cancelled) {
          timer = window.setTimeout(() => void pollJob(), 3000);
        }
      }
    };

    void pollJob();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeJobId, refreshJobs]);

  // Sync selected flow editor content
  useEffect(() => {
    if (activeJob && activeJob.flows && activeJob.flows.length > 0) {
      const current = activeJob.flows.find(f => f.id === selectedFlowId) || activeJob.flows[0];
      if (current) {
        setSelectedFlowId(current.id);
        setFlowEditorSource(current.source);
      }
    } else {
      setSelectedFlowId(null);
      setFlowEditorSource('');
    }
  }, [activeJob, selectedFlowId]);

  // Sync selected page for map
  useEffect(() => {
    if (activeJob?.inventory?.pages && activeJob.inventory.pages.length > 0) {
      if (!selectedPageId || !activeJob.inventory.pages.some(p => p.id === selectedPageId)) {
        setSelectedPageId(activeJob.inventory.pages[0].id);
      }
    } else {
      setSelectedPageId(null);
    }
  }, [activeJob, selectedPageId]);

  // Stats calculation
  const stats = useMemo(() => {
    const pagesCount = activeJob?.inventory?.pages.length ?? 0;
    const elementsCount = activeJob?.inventory?.pages.reduce((acc, p) => acc + (p.elements?.length || 0), 0) ?? 0;
    const flowsCount = activeJob?.flows?.length ?? 0;
    const results = activeJob?.results ?? [];
    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const failedCount = results.filter(r => r.status === 'FAILED' || r.status === 'INFRA_ERROR').length;
    return { pagesCount, elementsCount, flowsCount, passedCount, failedCount, totalRuns: results.length };
  }, [activeJob]);

  // Actions
  const handleSaveFlow = async () => {
    if (!activeJobId || !selectedFlowId) return;
    setLoading(true);
    setActionError('');
    try {
      await send(`/api/v1/discovery/jobs/${activeJobId}/flows/${selectedFlowId}`, { source: flowEditorSource }, 'PUT');
      setActionSuccess('Perubahan Flow berhasil disimpan!');
      setTimeout(() => setActionSuccess(''), 3000);
      const updated = await request<Job>(jobPath(activeJobId));
      setActiveJob(updated);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRunFlows = async (flowIds?: string[]) => {
    if (!activeJobId) return;
    setLoading(true);
    setActionError('');
    try {
      const updated = await send<Job>(`/api/v1/discovery/jobs/${activeJobId}/run`, { flowIds }, 'POST');
      setActiveJob(updated);
      setCurrentView('runs');
      setActionSuccess('Eksekusi flow berhasil diselesaikan!');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCompilePlaywright = async () => {
    if (!flowEditorSource) return;
    setLoading(true);
    try {
      const res = await send<{ content: string; filename: string }>('/api/v1/flows/compile/playwright', { source: flowEditorSource });
      setCompiledPreview({ title: `Playwright Code (${res.filename})`, content: res.content });
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCompileMaestro = async () => {
    if (!flowEditorSource) return;
    setLoading(true);
    try {
      const res = await send<{ yaml: string; filename: string }>('/api/v1/flows/compile/maestro', { source: flowEditorSource });
      setCompiledPreview({ title: `Maestro Native YAML (${res.filename})`, content: res.yaml });
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJobId) return;
    try {
      await send(`/api/v1/discovery/jobs/${activeJobId}/cancel`, {}, 'POST');
      const updated = await request<Job>(jobPath(activeJobId));
      setActiveJob(updated);
      setActionSuccess('Job berhasil dibatalkan.');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(errorText(err));
    }
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setCurrentView('new');
  };

  const handleRestartJob = async (jobId: string) => {
    setLoading(true);
    setActionError('');
    try {
      const updated = await send<Job>(`/api/v1/discovery/jobs/${jobId}/restart`, {}, 'POST');
      setActiveJobId(updated.id);
      setActiveJob(updated);
      setCurrentView('discovery');
      setActionSuccess('Discovery job berhasil dijalankan ulang!');
      setTimeout(() => setActionSuccess(''), 3000);
      void refreshJobs();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm('Hapus job ini? Data akan hilang permanen.')) return;
    try {
      await send(`/api/v1/discovery/jobs/${jobId}`, {}, 'DELETE');
      if (activeJobId === jobId) {
        setActiveJobId(null);
        setActiveJob(null);
      }
      void refreshJobs();
      setActionSuccess('Job berhasil dihapus.');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(errorText(err));
    }
  };


  // Filtered pages for Map
  const filteredPages = useMemo(() => {
    if (!activeJob?.inventory?.pages) return [];
    return activeJob.inventory.pages.filter(p => {
      const matchSearch = !mapSearch || p.path.toLowerCase().includes(mapSearch.toLowerCase()) || p.title.toLowerCase().includes(mapSearch.toLowerCase());
      if (!matchSearch) return false;
      if (mapFilter === 'public') return !p.authentication || /public/i.test(p.authentication);
      if (mapFilter === 'authenticated') return p.authentication && !/public/i.test(p.authentication);
      if (mapFilter === 'error') return (p.status && p.status >= 400) || p.state === 'error';
      return true;
    });
  }, [activeJob, mapSearch, mapFilter]);

  const selectedPage = useMemo(() => {
    return activeJob?.inventory?.pages.find(p => p.id === selectedPageId);
  }, [activeJob, selectedPageId]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (!activeJob?.logs) return [];
    return activeJob.logs.filter(l => {
      const matchCat = logFilter === 'all' || l.category.toLowerCase() === logFilter.toLowerCase();
      const matchSearch = !logSearch || l.message.toLowerCase().includes(logSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeJob, logFilter, logSearch]);

  // Terminal auto-scroll to bottom (log terbaru)
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    } else if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (currentView === 'discovery') {
      const timer = setTimeout(() => {
        scrollToBottom(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentView, filteredLogs, scrollToBottom]);

  const formatLogTime = (timeStr?: string) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + ' WIB';
      }
    } catch { /* fallback */ }
    return timeStr.split('T')[1]?.slice(0, 8) || timeStr;
  };

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Icon name="shield" size={22} />
          </div>
          <div className="brand-title">
            <span className="brand-name">QC MAESTRO</span>
            <span className="brand-badge">AUTONOMOUS QA</span>
          </div>
        </div>

        <button
          className="new-job-btn"
          onClick={() => { setCurrentView('new'); }}
        >
          <Icon name="plus" size={16} />
          New Discovery Run
        </button>

        <div className="nav-menu">
          <div className="nav-section-title">CORE WORKSPACE</div>
          <button
            className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
            onClick={() => setCurrentView('overview')}
          >
            <div className="nav-item-left">
              <Icon name="overview" size={18} />
              <span>Overview</span>
            </div>
          </button>

          <button
            className={`nav-item ${currentView === 'projects' ? 'active' : ''}`}
            onClick={() => setCurrentView('projects')}
          >
            <div className="nav-item-left">
              <Icon name="projects" size={18} />
              <span>Projects</span>
            </div>
            <span className="nav-badge">{jobs.length}</span>
          </button>

          <button
            className={`nav-item ${currentView === 'discovery' ? 'active' : ''}`}
            onClick={() => setCurrentView('discovery')}
          >
            <div className="nav-item-left">
              <Icon name="discovery" size={18} />
              <span>Discovery Progress</span>
            </div>
            {activeJob && (activeJob.status === 'RUNNING' || activeJob.status === 'QUEUED') && (
              <span className="status-dot active" />
            )}
          </button>

          <div className="nav-section-title" style={{ marginTop: 12 }}>ANALYSIS &amp; TEST</div>
          <button
            className={`nav-item ${currentView === 'map' ? 'active' : ''}`}
            onClick={() => setCurrentView('map')}
          >
            <div className="nav-item-left">
              <Icon name="map" size={18} />
              <span>App Map</span>
            </div>
            <span className="nav-badge">{activeJob?.inventory?.pages.length ?? 0}</span>
          </button>

          <button
            className={`nav-item ${currentView === 'flows' ? 'active' : ''}`}
            onClick={() => setCurrentView('flows')}
          >
            <div className="nav-item-left">
              <Icon name="flows" size={18} />
              <span>Test Flows</span>
            </div>
            <span className="nav-badge">{activeJob?.flows?.length ?? 0}</span>
          </button>

          <button
            className={`nav-item ${currentView === 'runs' ? 'active' : ''}`}
            onClick={() => setCurrentView('runs')}
          >
            <div className="nav-item-left">
              <Icon name="runs" size={18} />
              <span>Test Runs</span>
            </div>
            <span className="nav-badge">{activeJob?.results?.length ?? 0}</span>
          </button>

          <button
            className={`nav-item ${currentView === 'live' ? 'active' : ''}`}
            onClick={() => setCurrentView('live')}
          >
            <div className="nav-item-left">
              <Icon name="discovery" size={18} />
              <span>Live Viewport</span>
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(53, 208, 186, 0.15)',
              color: 'var(--cyan)',
              border: '1px solid rgba(53, 208, 186, 0.3)'
            }}>LIVE</span>
          </button>

          <button
            className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => setCurrentView('reports')}
          >
            <div className="nav-item-left">
              <Icon name="reports" size={18} />
              <span>Executive Report</span>
            </div>
          </button>

          <button
            className={`nav-item ${currentView === 'evidence' ? 'active' : ''}`}
            onClick={() => { setCurrentView('evidence'); void refreshZannoraEvidence(); }}
          >
            <div className="nav-item-left">
              <Icon name="reports" size={18} />
              <span>Zannora Evidence</span>
            </div>
            <span className="nav-badge">{zannoraEvidence?.totals.assets ?? 0}</span>
          </button>

          <div className="nav-section-title" style={{ marginTop: 12 }}>SYSTEM</div>
          <button
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <div className="nav-item-left">
              <Icon name="settings" size={18} />
              <span>Settings &amp; Engines</span>
            </div>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="engine-health-card">
            <div className="engine-health-header">
              <span>Engine Status</span>
              <span style={{ color: 'var(--cyan)' }}>LIVE</span>
            </div>
            <div className="engine-row">
              <span><span className={`status-dot ${system?.playwright.available ? 'active' : 'danger'}`} /> Playwright</span>
              <small style={{ color: system?.playwright.available ? 'var(--green)' : 'var(--red)' }}>
                {system?.playwright.available ? 'Ready' : 'Offline'}
              </small>
            </div>
            <div className="engine-row">
              <span><span className={`status-dot ${system?.docker.available ? 'active' : 'warning'}`} /> Docker Engine</span>
              <small style={{ color: system?.docker.available ? 'var(--green)' : 'var(--yellow)' }}>
                {system?.docker.available ? 'Ready' : 'Off'}
              </small>
            </div>
            <div className="engine-row">
              <span><span className={`status-dot ${system?.maestro.available ? 'active' : 'warning'}`} /> Maestro Mobile</span>
              <small style={{ color: system?.maestro.available ? 'var(--green)' : 'var(--text-dim)' }}>
                {system?.maestro.available ? 'Ready' : 'Not installed'}
              </small>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="project-select-pill">
              <span className="project-monogram" style={{ width: 26, height: 26, fontSize: 11, borderRadius: 6 }}>
                {activeJob?.name?.slice(0, 2).toUpperCase() || 'QC'}
              </span>
              <select
                value={activeJobId ?? ''}
                onChange={(e) => setActiveJobId(e.target.value)}
                style={{ background: 'transparent', border: 'none', fontWeight: 600, color: '#FFFFFF', outline: 'none', cursor: 'pointer' }}
              >
                {jobs.map(j => (
                  <option key={j.id} value={j.id} style={{ background: '#0F172A', color: '#FFF' }}>
                    {j.name} ({j.config?.runMode})
                  </option>
                ))}
              </select>
            </div>

            {activeJob && (
              <>
                <Badge value={activeJob.config?.platform ?? 'web'} />
                <Badge value={activeJob.status} />
              </>
            )}
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <div className="live-beacon" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="status-dot active" />
              <span>Engine 4100</span>
              <span style={{ opacity: 0.35 }}>•</span>
              <span style={{ fontWeight: 600, color: 'var(--cyan)' }}>🕒 {wibClock}</span>
            </div>

            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #35D0BA 0%, #8B7CFF 100%)',
              color: '#070B14', fontWeight: 800, display: 'grid', placeItems: 'center', fontSize: 12
            }}>
              QA
            </div>
          </div>
        </header>

        {/* WORKSPACE VIEWS */}
        <main className="workspace-view">
          {actionError && <Notice error>{actionError}</Notice>}
          {actionSuccess && <Notice>{actionSuccess}</Notice>}

          {/* VIEW: OVERVIEW */}
          {currentView === 'overview' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>QA Control Center</h1>
                  <p>Orkestrator pengujian otonom: pemetaan repository, penyiapan basis data, dan verifikasi alur deterministik.</p>
                </div>
                <div className="header-actions">
                  <button className="quiet" onClick={() => setCurrentView('discovery')}>
                    <Icon name="terminal" size={16} /> Live Logs
                  </button>
                  <button className="primary" onClick={() => handleRunFlows()} disabled={loading || !activeJob?.flows?.length}>
                    <Icon name="runs" size={16} /> Run Regression Test
                  </button>
                </div>
              </div>

              <div className="metric-grid">
                <Metric
                  tone="cyan"
                  label="Halaman Diamati"
                  value={stats.pagesCount}
                  note={`${activeJob?.inventory?.routes?.length ?? 0} route statis`}
                  icon="map"
                  onClick={() => setCurrentView('map')}
                />
                <Metric
                  tone="violet"
                  label="Elemen Interaktif"
                  value={stats.elementsCount}
                  note="Form, Button, Input, Link"
                  icon="discovery"
                  onClick={() => setCurrentView('map')}
                />
                <Metric
                  tone="yellow"
                  label="Skenario Canonical"
                  value={stats.flowsCount}
                  note="Playwright & Maestro ready"
                  icon="flows"
                  onClick={() => setCurrentView('flows')}
                />
                <Metric
                  tone="green"
                  label="Tingkat Kelulusan"
                  value={stats.totalRuns ? `${Math.round((stats.passedCount / stats.totalRuns) * 100)}%` : '—'}
                  note={`${stats.passedCount} passed / ${stats.failedCount} failed`}
                  icon="runs"
                  onClick={() => setCurrentView('runs')}
                />
              </div>

              {activeJob && (
                <Panel
                  title={`Project Aktif: ${activeJob.name}`}
                  description={`Mode: ${activeJob.config?.runMode} · Target: ${activeJob.config?.baseUrl} · Dibuat ${date(activeJob.createdAt)}`}
                  actions={
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="quiet" onClick={() => setCurrentView('map')}>
                        Buka App Map
                      </button>
                      <button className="quiet" onClick={() => setCurrentView('reports')}>
                        Laporan Kualitas
                      </button>
                    </div>
                  }
                >
                  <div style={{ margin: '14px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                      <strong>Phase: {activeJob.phase.replace(/_/g, ' ')}</strong>
                      <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{activeJob.progress}%</span>
                    </div>
                    <Progress value={activeJob.progress} label="Discovery Progress" />
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
                    {activeJob.message || 'Engine siap menjalankan penjelajahan dan eksekusi uji.'}
                  </p>
                </Panel>
              )}

              <Panel title="Daftar Target &amp; Discovery Runs">
                {jobs.length === 0 ? (
                  <Empty title="Belum Ada Target Pengujian" action={<button className="primary" onClick={() => setCurrentView('new')}>Mulai Discovery Pertama</button>}>
                    Hubungkan repository GitHub atau jalankan aplikasi demo lokal.
                  </Empty>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Project Name</th>
                          <th>Platform</th>
                          <th>Run Mode</th>
                          <th>Status</th>
                          <th>Pages</th>
                          <th>Flows</th>
                          <th>Created At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map(j => (
                          <tr key={j.id}>
                            <td><strong>{j.name}</strong></td>
                            <td><Badge value={j.config?.platform ?? 'web'} /></td>
                            <td><code style={{ color: 'var(--cyan)' }}>{j.config?.runMode}</code></td>
                            <td><Badge value={j.status} /></td>
                            <td>{j.inventory?.pages?.length ?? 0}</td>
                            <td>{j.flows?.length ?? 0}</td>
                            <td style={{ color: 'var(--text-dim)' }}>{date(j.createdAt)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className="quiet"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => { setActiveJobId(j.id); setCurrentView('map'); }}
                                >
                                  Map
                                </button>
                                <button
                                  className="quiet"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => { setActiveJobId(j.id); setCurrentView('flows'); }}
                                >
                                  Flows
                                </button>
                                <button
                                  className="quiet"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => handleRestartJob(j.id)}
                                  title="Jalankan Ulang"
                                >
                                  <Icon name="refresh" size={14} />
                                </button>
                                <button
                                  className="quiet"
                                  style={{ padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => handleEditJob(j)}
                                  title="Edit Suite"
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                                <button
                                  className="quiet"
                                  style={{ padding: '4px 10px', fontSize: 12, color: 'var(--red)' }}
                                  onClick={() => handleDeleteJob(j.id)}
                                  title="Hapus"
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          )}

          {/* VIEW: NEW DISCOVERY WIZARD */}
          {currentView === 'new' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>{editingJob ? `Edit Suite: ${editingJob.name}` : 'Start New Discovery & Test Engine'}</h1>
                  <p>{editingJob ? 'Perbarui konfigurasi discovery suite dan jalankan ulang pengujian.' : 'Konfigurasikan target repository, lingkungan database isolated, aturan crawling, dan akun uji.'}</p>
                </div>
              </div>
              <Wizard
                system={system}
                initialJob={editingJob}
                onCancelEdit={editingJob ? () => { setEditingJob(null); setCurrentView('projects'); } : undefined}
                onCreated={(newJob) => {
                  setEditingJob(null);
                  setActiveJobId(newJob.id);
                  setCurrentView('discovery');
                  void refreshJobs();
                }}
              />
            </div>
          )}


          {/* VIEW: PROJECTS */}
          {currentView === 'projects' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>Projects &amp; Target Environments</h1>
                  <p>Seluruh riwayat discovery target yang tercatat pada workspace.</p>
                </div>
                <button className="primary" onClick={() => setCurrentView('new')}>
                  <Icon name="plus" size={16} /> New Discovery Project
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
                {jobs.map(j => (
                  <div key={j.id} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: 17 }}>{j.name}</h3>
                        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>
                          {j.config?.runMode === 'demo' ? 'Local Demo Application' : j.config?.repositoryUrl || j.config?.baseUrl}
                        </p>
                      </div>
                      <Badge value={j.status} />
                    </div>

                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span><strong>{j.inventory?.pages?.length ?? 0}</strong> Halaman</span>
                      <span><strong>{j.flows?.length ?? 0}</strong> Skenario</span>
                      <span><strong>{j.results?.length ?? 0}</strong> Hasil Test</span>
                    </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                      <button className="primary" style={{ flex: 1 }} onClick={() => { setActiveJobId(j.id); setCurrentView('map'); }}>
                        Application Map
                      </button>
                      <button className="quiet" onClick={() => { setActiveJobId(j.id); setCurrentView('flows'); }}>
                        Flows
                      </button>
                      <button className="quiet" onClick={() => handleRestartJob(j.id)} title="Jalankan Ulang Discovery">
                        <Icon name="refresh" size={15} />
                      </button>
                      <button className="quiet" onClick={() => handleEditJob(j)} title="Edit Suite">
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        className="quiet"
                        style={{ color: 'var(--red)' }}
                        onClick={() => handleDeleteJob(j.id)}
                        title="Hapus Job"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: DISCOVERY PROGRESS */}
          {currentView === 'discovery' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>Discovery Pipeline &amp; Live Terminal</h1>
                  <p>Pelacakan real-time eksekusi static analysis, database container, dan dynamic Playwright crawler.</p>
                </div>
                <div className="header-actions">
                  <button className="quiet" style={{ color: 'var(--cyan)', borderColor: 'rgba(53, 208, 186, 0.4)' }} onClick={() => setCurrentView('live')}>
                    <Icon name="discovery" size={16} /> Live Viewport
                  </button>
                  {activeJob?.status === 'RUNNING' && (
                    <button className="quiet" style={{ color: 'var(--red)', borderColor: 'rgba(255, 107, 122, 0.4)' }} onClick={handleCancelJob}>
                      Batalkan Discovery
                    </button>
                  )}
                  {activeJob?.status === 'COMPLETED' && (
                    <button className="primary" onClick={() => setCurrentView('map')}>
                      Buka Application Map <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              </div>

              {!activeJob ? (
                <Empty title="Tidak Ada Job Terpilih">Pilih project atau buat discovery baru.</Empty>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
                  {/* Left: Timeline Stepper */}
                  <Panel title="Discovery Stages">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      {/* Detect platform from active job */}
                      {(() => {
                        const isMobile = activeJob.config?.platform === 'android';
                        const isExisting = activeJob.config?.runMode === 'existing-target';
                        const hasDb = activeJob.config?.database?.engine !== 'none';

                        const mobileStages = [
                          { title: '1. Project & Source Init', desc: `${activeJob.config?.repositoryUrl?.startsWith('http') ? 'Git clone' : 'Baca direktori lokal'} — deteksi framework mobile` },
                          { title: '2. Static Code Analysis', desc: 'Scan file .dart / .kt / .java — temukan semua Screen, Widget, Route' },
                          { title: '3. Pemetaan Layar & Navigasi', desc: `Deteksi ${activeJob.inventory?.pages?.length ?? '?'} layar, form input, tombol interaktif` },
                          { title: '4. Skenario Maestro YAML', desc: 'Generate flow Maestro: launch, login, navigasi, dan smoke check' },
                          { title: '5. Eksekusi Test & Laporan', desc: activeJob.config?.executeFlows ? 'Jalankan Maestro flow di perangkat ADB terhubung' : 'Flow siap untuk review & eksekusi manual' },
                        ];

                        const webStages = [
                          { title: '1. Runtime & Project Init', desc: isExisting ? `Target: ${activeJob.config?.baseUrl}` : `Git workspace & service preparation (${activeJob.config?.stack ?? 'auto'})` },
                          { title: '2. Database Bootstrap', desc: hasDb ? `Container ${activeJob.config?.database?.engine} — isolasi data test` : 'Tidak ada database — dilewati' },
                          { title: '3. Static Source Code Scan', desc: 'Scan controllers, route, form, komponen (PHP/JS/Vue/React)' },
                          { title: '4. Dynamic Playwright Crawl', desc: `Observasi DOM, login auth, selector — max ${activeJob.config?.rules?.maxPages ?? '?'} halaman` },
                          { title: '5. Flow Synthesis & Laporan', desc: activeJob.config?.executeFlows ? 'Generate + run Playwright spec.ts, buat laporan QA' : 'Generate flow skenario — siap untuk review queue' },
                        ];

                        const stages = isMobile ? mobileStages : webStages;
                        const platformBadge = isMobile
                          ? { label: '📱 ANDROID / FLUTTER', color: 'rgba(139, 124, 255, 0.2)', border: 'rgba(139, 124, 255, 0.5)', text: 'var(--violet)' }
                          : { label: '🌐 WEB APPLICATION', color: 'rgba(53, 208, 186, 0.15)', border: 'rgba(53, 208, 186, 0.4)', text: 'var(--cyan)' };

                        return (
                          <>
                            {/* Platform badge */}
                            <div style={{
                              background: platformBadge.color,
                              border: `1px solid ${platformBadge.border}`,
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              color: platformBadge.text,
                              textAlign: 'center',
                              marginBottom: 4
                            }}>
                              {platformBadge.label}
                            </div>

                            {stages.map((stepItem, idx) => {
                              const isDone = activeJob.status === 'COMPLETED' || activeJob.progress > (idx + 1) * 20;
                              const isCurrent = activeJob.status === 'RUNNING' && activeJob.progress >= idx * 20 && activeJob.progress <= (idx + 1) * 20;
                              return (
                                <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                  <div style={{
                                    width: 26, height: 26, borderRadius: '50%',
                                    background: isDone ? 'var(--green)' : isCurrent ? 'var(--cyan)' : 'var(--bg-panel-sub)',
                                    color: isDone || isCurrent ? '#070B14' : 'var(--text-dim)',
                                    display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0
                                  }}>
                                    {isDone ? '✓' : idx + 1}
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: 13, color: isDone ? 'var(--green)' : isCurrent ? '#FFFFFF' : 'var(--text-dim)' }}>
                                      {stepItem.title}
                                    </strong>
                                    <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{stepItem.desc}</p>
                                    {isCurrent && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: 'var(--cyan)', fontSize: 11 }}>
                                        <span className="terminal-spinner" style={{ width: 10, height: 10 }} />
                                        <span>Sedang proses...</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </Panel>

                  {/* Right: High-tech Terminal */}
                  <div className="terminal">
                    <div className="terminal-bar">
                      <div className="terminal-dots">
                        <span className="terminal-dot red" />
                        <span className="terminal-dot yellow" />
                        <span className="terminal-dot green" />
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {['all', 'system', 'database', 'browser', 'runner'].map(cat => (
                          <button
                            key={cat}
                            className={`quiet ${logFilter === cat ? 'primary' : ''}`}
                            style={{ padding: '3px 9px', fontSize: 11, textTransform: 'capitalize' }}
                            onClick={() => setLogFilter(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <input
                        placeholder="Filter log output..."
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        style={{
                          background: '#050811', border: '1px solid var(--border)', borderRadius: 6,
                          padding: '3px 8px', fontSize: 11, color: '#FFF', width: 140
                        }}
                      />

                      <button
                        className="quiet"
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          color: 'var(--cyan)',
                          border: '1px solid rgba(53, 208, 186, 0.35)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        onClick={() => scrollToBottom(true)}
                        title="Scroll ke paling bawah (log terbaru)"
                      >
                        ↓ Paling Bawah
                      </button>
                    </div>

                    <div className="terminal-body" ref={terminalBodyRef}>
                      {filteredLogs.length === 0 ? (
                        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>
                          Menunggu output stream dari engine...
                        </div>
                      ) : (
                        <>
                          {filteredLogs.map((log, i) => (
                            <div key={i} className="log-row">
                              <span className="log-time">{formatLogTime(log.time)}</span>
                              <span className={`log-cat ${log.category}`}>{log.category}</span>
                              <span className="log-text">{log.message}</span>
                            </div>
                          ))}
                          {activeJob.status === 'RUNNING' && (
                            <div className="log-row running-indicator">
                              <span className="terminal-spinner" />
                              <span style={{ color: 'var(--cyan)', fontWeight: 600, fontSize: 11 }}>Sedang proses:</span>
                              <span style={{ color: '#E2E8F0', fontSize: 12 }}>
                                {(() => {
                                  const isMobile = activeJob.config?.platform === 'android';
                                  switch (activeJob.phase) {
                                    case 'INITIALIZING': return 'Menginisialisasi pipeline discovery & environment...';
                                    case 'STARTING_DEMO_APP': return 'Menyiapkan & menyalakan server aplikasi demo...';
                                    case 'PREPARING_RUNTIME': return 'Menyiapkan workspace runtime aplikasi...';
                                    case 'PREPARING_DATABASE': return 'Menyiapkan database isolated container...';
                                    case 'SCANNING_SOURCE': return isMobile 
                                      ? 'Scan berkas sumber Flutter/Dart (Screen, Route, Widget)...' 
                                      : 'Scan berkas web (.tsx / .vue / .php)...';
                                    case 'PREPARING_MOBILE': return 'Menyiapkan target mobile ADB & verifikasi backend...';
                                    case 'CRAWLING_UI': return 'Dynamic crawler Playwright menelusuri interaksi & form...';
                                    case 'BUILDING_INVENTORY': return 'Menyusun inventory layar & routes...';
                                    case 'GENERATING_FLOWS': return isMobile 
                                      ? 'Menghasilkan flow Maestro YAML untuk pengujian otomatis...' 
                                      : 'Menghasilkan spec Playwright skenario otomatis...';
                                    case 'EXECUTING_TESTS': return isMobile 
                                      ? 'Menjalankan skenario test di perangkat Android...' 
                                      : 'Menjalankan automated test di browser...';
                                    default: return 'Memproses langkah pengujian...';
                                  }
                                })()}
                              </span>
                            </div>
                          )}
                          <div ref={terminalBottomRef} style={{ height: 1 }} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: APPLICATION MAP */}
          {currentView === 'map' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>Application Map &amp; Inventory</h1>
                  <p>Halaman, route, tombol, input, dan form yang terpetakan secara deterministik oleh Playwright crawler.</p>
                </div>
                <div className="header-actions">
                  <div style={{ display: 'flex', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
                    <button
                      className={mapViewMode === 'table' ? 'primary' : 'quiet'}
                      style={{ padding: '6px 12px', fontSize: 12, border: 'none' }}
                      onClick={() => setMapViewMode('table')}
                    >
                      Table
                    </button>
                    <button
                      className={mapViewMode === 'cards' ? 'primary' : 'quiet'}
                      style={{ padding: '6px 12px', fontSize: 12, border: 'none' }}
                      onClick={() => setMapViewMode('cards')}
                    >
                      Grid
                    </button>
                  </div>

                  <input
                    placeholder="Search route or title..."
                    value={mapSearch}
                    onChange={(e) => setMapSearch(e.target.value)}
                    style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: '#FFF', width: 220 }}
                  />
                  <select
                    value={mapFilter}
                    onChange={(e) => setMapFilter(e.target.value as any)}
                    style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: '#FFF' }}
                  >
                    <option value="all">Semua Kategori</option>
                    <option value="public">Publik</option>
                    <option value="authenticated">Autentikasi</option>
                    <option value="error">Error / Blocked</option>
                  </select>
                </div>
              </div>

              {!activeJob?.inventory ? (
                <Empty title="Belum Ada Inventaris">
                  Jalankan discovery terlebih dahulu untuk memetakan halaman dan elemen aplikasi.
                </Empty>
              ) : (
                <div className="split-view">
                  {/* Left: Pages List */}
                  <div className="list-pane">
                    {mapViewMode === 'table' ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Halaman</th>
                              <th>Route</th>
                              <th>HTTP</th>
                              <th>Elemen</th>
                              <th>Akses</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPages.map(page => (
                              <tr
                                key={page.id}
                                onClick={() => setSelectedPageId(page.id)}
                                style={{
                                  cursor: 'pointer',
                                  background: selectedPageId === page.id ? 'rgba(53, 208, 186, 0.1)' : undefined
                                }}
                              >
                                <td><strong>{page.title || 'Untitled'}</strong></td>
                                <td><code style={{ color: 'var(--cyan)' }}>{page.path}</code></td>
                                <td><Badge value={page.status ? String(page.status) : '—'} /></td>
                                <td>{page.elements?.length || 0} elemen</td>
                                <td><Badge value={page.authentication || 'public'} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, padding: 16 }}>
                        {filteredPages.map(page => (
                          <div
                            key={page.id}
                            onClick={() => setSelectedPageId(page.id)}
                            style={{
                              background: selectedPageId === page.id ? 'rgba(53, 208, 186, 0.12)' : 'var(--bg-panel-sub)',
                              border: `1px solid ${selectedPageId === page.id ? 'var(--cyan)' : 'var(--border)'}`,
                              borderRadius: 10, padding: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8
                            }}
                          >
                            <strong>{page.title}</strong>
                            <code style={{ color: 'var(--cyan)', fontSize: 11 }}>{page.path}</code>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <Badge value={page.state} />
                              <small style={{ color: 'var(--text-dim)' }}>{page.elements?.length || 0} el</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Page Detail Drawer */}
                  <div className="detail-pane">
                    {selectedPage ? (
                      <>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: 18 }}>{selectedPage.title}</h3>
                            <Badge value={selectedPage.state} />
                          </div>
                          <code style={{ color: 'var(--cyan)', fontSize: 13, marginTop: 4, display: 'block' }}>
                            {selectedPage.url || selectedPage.path}
                          </code>
                        </div>

                        {selectedPage.screenshot && (
                          <div
                            className="screenshot-container"
                            style={{ cursor: 'zoom-in' }}
                            onClick={() => setFullScreenshot(artifactUrl(activeJob.id, selectedPage.screenshot!) ?? null)}
                          >
                            <img
                              src={artifactUrl(activeJob.id, selectedPage.screenshot)}
                              alt={`Screenshot ${selectedPage.title}`}
                            />
                          </div>
                        )}

                        <div>
                          <h4 style={{ fontSize: 14, marginBottom: 12 }}>
                            Elemen Interaktif ({selectedPage.elements?.length || 0})
                          </h4>
                          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            <table>
                              <thead>
                                <tr>
                                  <th>Elemen</th>
                                  <th>Tipe</th>
                                  <th>Selector</th>
                                  <th>Keyakinan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPage.elements?.map((el, idx) => (
                                  <tr key={idx}>
                                    <td><strong>{el.name}</strong></td>
                                    <td><span style={{ color: 'var(--text-dim)' }}>{el.type}</span></td>
                                    <td><code style={{ fontSize: 11, color: 'var(--violet)' }}>{el.selector || el.testId || 'Perlu verifikasi'}</code></td>
                                    <td>{el.confidence ? `${Math.round(el.confidence * 100)}%` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    ) : (
                      <Empty title="Pilih Halaman">
                        Klik salah satu baris pada tabel untuk melihat screenshot halaman dan elemen interaktifnya.
                      </Empty>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: TEST FLOWS */}
          {currentView === 'flows' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>Canonical QC Flows &amp; Step Editor</h1>
                  <p>Tinjau, sesuaikan skenario uji, atau kompilasi ke Playwright (.spec.ts) dan Maestro (.yaml).</p>
                </div>
                <div className="header-actions">
                  <button className="quiet" onClick={handleCompilePlaywright} disabled={loading || !flowEditorSource}>
                    Compile Playwright
                  </button>
                  <button className="quiet" onClick={handleCompileMaestro} disabled={loading || !flowEditorSource}>
                    Compile Maestro
                  </button>
                  <button className="primary" onClick={() => handleRunFlows(selectedFlowId ? [selectedFlowId] : undefined)} disabled={loading}>
                    <Icon name="runs" size={16} /> Run Flow
                  </button>
                </div>
              </div>

              {!activeJob?.flows || activeJob.flows.length === 0 ? (
                <Empty title="Belum Ada Flow Skenario">
                  Jalankan discovery untuk menghasilkan flow atau buat skenario manual.
                </Empty>
              ) : (
                <div className="split-view">
                  {/* Left: Flow list */}
                  <div className="list-pane">
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                      Skenario Tergenerate ({activeJob.flows.length})
                    </div>
                    <div>
                      {activeJob.flows.map(f => (
                        <div
                          key={f.id}
                          onClick={() => {
                            setSelectedFlowId(f.id);
                            setFlowEditorSource(f.source);
                          }}
                          style={{
                            padding: '16px 18px',
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            background: selectedFlowId === f.id ? 'rgba(53, 208, 186, 0.08)' : undefined
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <strong>{f.name}</strong>
                            <Badge value={f.status} />
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                            <span>Platform: {f.platform}</span>
                            {f.reason && <span style={{ color: 'var(--yellow)' }}>• {f.reason}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Flow YAML Editor */}
                  <div className="detail-pane">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3>Canonical Flow Definition</h3>
                        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>
                          Format canonical YAML deterministik untuk kompilasi multi-target.
                        </p>
                      </div>
                      <button className="primary" onClick={handleSaveFlow} disabled={loading}>
                        Simpan Perubahan
                      </button>
                    </div>

                    <textarea
                      className="code-editor"
                      value={flowEditorSource}
                      onChange={(e) => setFlowEditorSource(e.target.value)}
                    />

                    {compiledPreview && (
                      <Panel title={compiledPreview.title}>
                        <pre style={{ background: '#050811', padding: 14, borderRadius: 8, overflowX: 'auto', fontSize: 12, color: '#CBD5E1' }}>
                          {compiledPreview.content}
                        </pre>
                      </Panel>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: TEST RUNS */}
          {currentView === 'runs' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>Test Execution Results</h1>
                  <p>Riwayat eksekusi Playwright dan Maestro beserta durasi per step, trace, dan screenshot failure.</p>
                </div>
                <button className="primary" onClick={() => handleRunFlows()} disabled={loading}>
                  <Icon name="runs" size={16} /> Run All Tests
                </button>
              </div>

              {!activeJob?.results || activeJob.results.length === 0 ? (
                <Empty title="Belum Ada Hasil Uji">
                  Jalankan salah satu skenario flow untuk melihat hasil eksekusi nyata.
                </Empty>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {activeJob.results.map((res, i) => (
                    <Panel
                      key={i}
                      title={`Flow: ${res.flowId}`}
                      description={`Status: ${res.status} · Finished at: ${date(res.finishedAt)}`}
                      actions={<Badge value={res.status} />}
                    >
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Action</th>
                              <th>Status</th>
                              <th>Duration</th>
                              <th>Detail / Error Diagnostic</th>
                            </tr>
                          </thead>
                          <tbody>
                            {res.steps?.map((st: Step, sIdx: number) => (
                              <tr key={sIdx}>
                                <td><code>{st.action}</code></td>
                                <td><Badge value={st.status} /></td>
                                <td>{st.durationMs ? `${st.durationMs} ms` : '—'}</td>
                                <td style={{ color: st.errorMessage ? 'var(--red)' : 'var(--text-muted)' }}>
                                  {st.errorMessage || 'Lulus tanpa error'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: REPORTS */}
          {currentView === 'reports' && (
            <div>
              <div className="view-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h1 style={{ margin: 0 }}>Executive QA &amp; Quality Audit Report</h1>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'rgba(53, 208, 186, 0.15)',
                      color: 'var(--cyan)',
                      border: '1px solid rgba(53, 208, 186, 0.3)'
                    }}>
                      {activeJob?.config?.platform?.toUpperCase() || 'TARGET'}
                    </span>
                  </div>
                  <p>Laporan audit mutu menyeluruh: pemindaian struktur file, verifikasi halaman, pencatatan bug/crash, dan evaluasi kesiapan produksi.</p>
                </div>
                <div className="header-actions">
                  <button className="tool-btn primary" onClick={() => activeJobId && downloadReport(activeJobId, 'pdf', reportAttempt, reportStatusFilter)} title="Unduh Dokumen Laporan Mutu PDF">
                    <Icon name="download" size={15} /> Unduh PDF Report
                  </button>
                  <button className="tool-btn" onClick={() => activeJobId && window.open(`/api/v1/discovery/jobs/${activeJobId}/report?format=pdf&attempt=${reportAttempt}&status=${reportStatusFilter}`, '_blank')} title="Buka & Cetak Dokumen PDF di Tab Baru">
                    <Icon name="reports" size={15} /> Buka PDF
                  </button>
                  <button className="tool-btn" onClick={() => activeJobId && downloadReport(activeJobId, 'json', reportAttempt, reportStatusFilter)} title="Unduh data audit JSON">
                    <Icon name="download" size={15} /> Download JSON
                  </button>
                </div>
              </div>

              {!activeJob ? (
                <div className="inline-empty">Pilih proyek pada menu dropdown di atas untuk melihat laporan kualitas lengkap.</div>
              ) : (() => {
                const allRawResults = activeJob.results || [];
                // Group into attempts chronologically
                const sorted = [...allRawResults].sort((a, b) => {
                  const tA = new Date(a.finishedAt || 0).getTime();
                  const tB = new Date(b.finishedAt || 0).getTime();
                  return tA - tB;
                });
                const rawBatches: any[][] = [];
                let currBatch: any[] = [];
                const seenFlows = new Set<string>();
                let lastTime = 0;
                for (const item of sorted) {
                  const itemTime = new Date(item.finishedAt || 0).getTime();
                  const gap = lastTime > 0 ? itemTime - lastTime : 0;
                  if (currBatch.length > 0 && (seenFlows.has(item.flowId) || gap > 150000)) {
                    rawBatches.push(currBatch);
                    currBatch = [];
                    seenFlows.clear();
                  }
                  currBatch.push(item);
                  if (item.flowId) seenFlows.add(item.flowId);
                  lastTime = itemTime;
                }
                if (currBatch.length > 0) rawBatches.push(currBatch);

                const attemptsList = rawBatches.map((b, i) => {
                  const num = i + 1;
                  const isLatest = num === rawBatches.length;
                  const passed = b.filter(r => r.status === 'PASSED').length;
                  const rate = b.length > 0 ? Math.round((passed / b.length) * 100) : 0;
                  return {
                    id: `attempt-${num}`,
                    num,
                    name: `Percobaan #${num}${isLatest ? ' (Terbaru)' : ''}`,
                    isLatest,
                    passed,
                    total: b.length,
                    rate,
                    results: b
                  };
                }).reverse();

                let activeAttempt = attemptsList.find(a => (reportAttempt === 'latest' && a.isLatest) || a.id === reportAttempt);
                if (!activeAttempt) {
                  activeAttempt = attemptsList[0];
                }
                const resultsForAttempt = reportAttempt === 'all'
                  ? allRawResults
                  : (activeAttempt ? activeAttempt.results : allRawResults);

                const results = reportStatusFilter === 'all'
                  ? resultsForAttempt
                  : resultsForAttempt.filter(r => r.status === reportStatusFilter);

                const passedRuns = resultsForAttempt.filter((r: any) => r.status === 'PASSED').length;
                const failedRuns = resultsForAttempt.filter((r: any) => r.status !== 'PASSED').length;
                const totalRuns = resultsForAttempt.length;
                const healthScore = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;
                const filesScanned = activeJob.inventory?.filesScanned || 0;
                const pages = activeJob.inventory?.pages || [];
                const allFailedSteps = results.flatMap((r: any) =>
                  (r.steps || []).filter((s: any) => s.status === 'FAILED').map((s: any) => ({
                    flowId: r.flowId,
                    runId: r.runId,
                    step: s,
                    artifacts: r.artifacts
                  }))
                );

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* ATTEMPTS & STATUS FILTER TOOLBAR */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      background: 'var(--panel-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '16px 20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                          <span>🔄</span>
                          <span>SESI PERCOBAAN (ATTEMPT):</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {attemptsList.map(att => {
                            const isSelected = (reportAttempt === 'latest' && att.isLatest) || reportAttempt === att.id;
                            return (
                              <button
                                key={att.id}
                                className={`tool-btn ${isSelected ? (att.rate === 100 ? 'primary' : 'active') : ''}`}
                                style={{
                                  borderRadius: 999,
                                  fontSize: 12,
                                  padding: '5px 14px',
                                  borderColor: isSelected ? (att.rate === 100 ? 'var(--green)' : 'var(--red)') : undefined
                                }}
                                onClick={() => setReportAttempt(att.id)}
                              >
                                {att.rate === 100 ? '✅' : '⚠️'} {att.name} ({att.rate}% Lulus)
                              </button>
                            );
                          })}
                          <button
                            className={`tool-btn ${reportAttempt === 'all' ? 'active' : ''}`}
                            style={{ borderRadius: 999, fontSize: 12, padding: '5px 14px' }}
                            onClick={() => setReportAttempt('all')}
                          >
                            📚 Semua Percobaan ({attemptsList.length} Sesi)
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                          <span>🔍</span>
                          <span>FILTER STATUS:</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button
                            className={`tool-btn ${reportStatusFilter === 'all' ? 'active' : ''}`}
                            style={{ borderRadius: 999, fontSize: 12, padding: '4px 12px' }}
                            onClick={() => setReportStatusFilter('all')}
                          >
                            Semua Skenario ({resultsForAttempt.length})
                          </button>
                          <button
                            className={`tool-btn ${reportStatusFilter === 'PASSED' ? 'primary' : ''}`}
                            style={{ borderRadius: 999, fontSize: 12, padding: '4px 12px', borderColor: reportStatusFilter === 'PASSED' ? 'var(--green)' : undefined }}
                            onClick={() => setReportStatusFilter('PASSED')}
                          >
                            ✅ Hanya Berhasil ({passedRuns})
                          </button>
                          <button
                            className={`tool-btn ${reportStatusFilter === 'FAILED' ? 'active' : ''}`}
                            style={{ borderRadius: 999, fontSize: 12, padding: '4px 12px', borderColor: reportStatusFilter === 'FAILED' ? 'var(--red)' : undefined }}
                            onClick={() => setReportStatusFilter('FAILED')}
                          >
                            ❌ Hanya Gagal ({failedRuns})
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* EXECUTIVE SUMMARY BANNER */}
                    <Panel title="Executive Summary">
                      <p style={{ color: 'var(--text-main)', fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                        Audit deterministik terhadap aplikasi <strong>{activeJob.name}</strong> berhasil memindai struktur proyek dan memetakan{' '}
                        <strong>{pages.length || 1} halaman/layar utama</strong> dengan <strong>{stats.elementsCount} elemen interaktif</strong>.
                        Terdapat <strong>{stats.flowsCount} skenario pengujian</strong> yang terdaftar.
                        Pada <strong>{activeAttempt?.name || 'Sesi Terpilih'}</strong>, eksekusi pengujian deterministik menghasilkan QA Health Score{' '}
                        <strong style={{ color: healthScore >= 80 ? 'var(--green)' : 'var(--red)' }}>{healthScore}%</strong>{' '}
                        ({passedRuns} lolos clear, {failedRuns} perlu tindak lanjut).
                      </p>
                    </Panel>

                    {/* KPI CARDS */}
                    <div className="metric-grid" style={{ marginBottom: 0 }}>
                      <div className="metric">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>QA Health Score</span>
                          <span style={{ fontSize: 18 }}>🛡️</span>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: healthScore >= 80 ? 'var(--green)' : 'var(--red)' }}>
                          {healthScore}%
                        </div>
                        <small style={{ color: 'var(--text-dim)' }}>
                          {healthScore === 100 ? 'Semua pengujian lolos sempurna' : `${failedRuns} skenario terindikasi kendala`}
                        </small>
                      </div>

                      <div className="metric">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>File Terpindai</span>
                          <span style={{ fontSize: 18 }}>📁</span>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF' }}>
                          {filesScanned}
                        </div>
                        <small style={{ color: 'var(--text-dim)' }}>Struktur kode &amp; modul dipindai</small>
                      </div>

                      <div className="metric">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Layar / Halaman</span>
                          <span style={{ fontSize: 18 }}>📱</span>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--cyan)' }}>
                          {pages.length || 1}
                        </div>
                        <small style={{ color: 'var(--text-dim)' }}>Halaman / route terpetakan</small>
                      </div>

                      <div className="metric">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status Defect &amp; Bug</span>
                          <span style={{ fontSize: 18 }}>🐞</span>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: allFailedSteps.length === 0 ? 'var(--green)' : '#FF5A79' }}>
                          {allFailedSteps.length === 0 ? '0 Bug' : `${allFailedSteps.length} Terdeteksi`}
                        </div>
                        <small style={{ color: allFailedSteps.length === 0 ? 'var(--green)' : '#FF5A79' }}>
                          {allFailedSteps.length === 0 ? 'Status Clear (Bebas Crash)' : 'Perlu investigasi perbaikan'}
                        </small>
                      </div>
                    </div>

                    {/* STATUS MATRIX: PAGES & SCENARIOS */}
                    <Panel title="Audit Matrix: Verifikasi Halaman & Skenario (Clear vs Bugs)">
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Skenario / Halaman</th>
                              <th>Target Platform</th>
                              <th>Hasil Pengujian</th>
                              <th>Langkah / Aksi</th>
                              <th>Tangkapan Layar (Bukti)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.map((res, i) => {
                              const flowObj = activeJob.flows?.find(f => f.id === res.flowId);
                              const screenshotArtifact = (res.artifacts || []).find((a: any) =>
                                typeof a === 'string' ? a.endsWith('.png') : (a?.type === 'screenshot' || a?.path?.endsWith('.png') || a?.url)
                              );
                              const ssUrl = screenshotArtifact
                                ? (typeof screenshotArtifact === 'string'
                                    ? `/api/v1/discovery/jobs/${activeJob.id}/artifacts/${res.runId}/${screenshotArtifact.split(/[\\/]/).pop()}`
                                    : (screenshotArtifact.url || `/api/v1/discovery/jobs/${activeJob.id}/artifacts/${res.runId}/${screenshotArtifact.name || 'screenshot.png'}`))
                                : null;

                              return (
                                <tr key={i}>
                                  <td>
                                    <strong>{flowObj?.name || res.flowId}</strong>
                                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                                      Run ID: <code>{res.runId}</code>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ textTransform: 'uppercase', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}>
                                      {activeJob.config?.platform || 'TARGET'}
                                    </span>
                                  </td>
                                  <td>
                                    {res.status === 'PASSED' ? (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        color: 'var(--green)',
                                        background: 'rgba(39, 201, 63, 0.12)',
                                        border: '1px solid rgba(39, 201, 63, 0.3)',
                                        borderRadius: 4,
                                        padding: '4px 10px',
                                        fontSize: 12,
                                        fontWeight: 700
                                      }}>
                                        ✓ CLEAR (PASSED)
                                      </span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        color: '#FF5A79',
                                        background: 'rgba(255, 90, 121, 0.12)',
                                        border: '1px solid rgba(255, 90, 121, 0.3)',
                                        borderRadius: 4,
                                        padding: '4px 10px',
                                        fontSize: 12,
                                        fontWeight: 700
                                      }}>
                                        ✕ BUG / DEFECT
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {(res.steps || []).map((s: any, sIdx: number) => (
                                        <span
                                          key={sIdx}
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 6px',
                                            borderRadius: 3,
                                            background: s.status === 'PASSED' ? 'rgba(39, 201, 63, 0.15)' : 'rgba(255, 90, 121, 0.2)',
                                            color: s.status === 'PASSED' ? 'var(--green)' : '#FF5A79',
                                            border: `1px solid ${s.status === 'PASSED' ? 'rgba(39, 201, 63, 0.3)' : 'rgba(255, 90, 121, 0.4)'}`
                                          }}
                                          title={s.errorMessage || `${s.action} - ${s.status}`}
                                        >
                                          {s.action}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td>
                                    {ssUrl ? (
                                      <button
                                        type="button"
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          padding: 0,
                                          cursor: 'pointer'
                                        }}
                                        onClick={() => setFullScreenshot(ssUrl)}
                                        title="Klik untuk memperbesar bukti tangkapan layar"
                                      >
                                        <img
                                          src={ssUrl}
                                          alt="Bukti Pengujian"
                                          style={{
                                            width: 44,
                                            height: 44,
                                            objectFit: 'cover',
                                            borderRadius: 6,
                                            border: '1px solid var(--border)'
                                          }}
                                        />
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Panel>

                    {/* BUG & DEFECT DETAIL LEDGER */}
                    <Panel title={`Catatan Bug & Error Log (${allFailedSteps.length})`}>
                      {allFailedSteps.length === 0 ? (
                        <div style={{
                          padding: 24,
                          background: 'rgba(39, 201, 63, 0.06)',
                          border: '1px solid rgba(39, 201, 63, 0.2)',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          color: 'var(--green)'
                        }}>
                          <span style={{ fontSize: 28 }}>🛡️</span>
                          <div>
                            <strong style={{ display: 'block', fontSize: 14, color: '#FFFFFF' }}>
                              Tidak Ada Bug Kritis Ditemukan
                            </strong>
                            <small style={{ color: 'var(--text-muted)' }}>
                              Semua skenario pengujian terakhir berhasil diselesaikan tanpa crash atau assertion failure.
                            </small>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {allFailedSteps.map((b, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: '#0d131f',
                                border: '1px solid rgba(255, 90, 121, 0.3)',
                                borderRadius: 8,
                                padding: 16
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <strong style={{ color: '#FF5A79', fontSize: 13 }}>
                                  Defect #{idx + 1}: Flow "{b.flowId}" (Step: {b.step.action})
                                </strong>
                                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Run: {b.runId}</span>
                              </div>
                              <pre style={{
                                background: '#060913',
                                padding: 12,
                                borderRadius: 6,
                                color: '#FFA5B5',
                                fontSize: 11.5,
                                overflowX: 'auto',
                                margin: 0
                              }}>
                                {b.step.errorMessage || 'Unknown execution failure'}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </Panel>

                    {/* APPLICATION MAP & ROUTE INVENTORY */}
                    <Panel title="Application Map &amp; Screen Inventory">
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Page / Screen Title</th>
                              <th>Route / Package</th>
                              <th>Status Code</th>
                              <th>Elemen Terpetakan</th>
                              <th>Akses Autentikasi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pages.map((p, idx) => (
                              <tr key={idx}>
                                <td><strong>{p.title}</strong></td>
                                <td><code style={{ color: 'var(--cyan)' }}>{p.path}</code></td>
                                <td>{p.status || '—'}</td>
                                <td>{p.elements?.length || 0} elemen</td>
                                <td><Badge value={p.authentication || 'public'} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  </div>
                );
              })()}
            </div>
          )}

          {/* VIEW: ZANNORA EVIDENCE */}
          {currentView === 'evidence' && (
            <div className="zannora-evidence-view">
              <div className="view-header">
                <div>
                  <div className="evidence-title-row">
                    <h1 style={{ margin: 0 }}>Zannora Evidence Center</h1>
                    <span className="evidence-project-chip">LIVE ARTIFACT INDEX</span>
                  </div>
                  <p>Semua report, screenshot, dan video QC terbaru dikelompokkan berdasarkan bagian yang diuji.</p>
                </div>
                <div className="header-actions">
                  <button className="tool-btn" onClick={() => void refreshZannoraEvidence()} disabled={evidenceLoading}>
                    <Icon name="refresh" size={15} /> {evidenceLoading ? 'Memuat...' : 'Refresh Evidence'}
                  </button>
                </div>
              </div>

              {evidenceError && <Notice error>{evidenceError}</Notice>}
              {evidenceLoading && !zannoraEvidence && <div className="inline-empty">Membaca seluruh evidence Zannora dari folder QC...</div>}
              {!evidenceLoading && !zannoraEvidence && !evidenceError && <div className="inline-empty">Evidence Zannora belum tersedia.</div>}

              {zannoraEvidence && (
                <>
                  <div className="evidence-summary-grid">
                    <div className="evidence-summary-card"><span>Bagian diuji</span><strong>{zannoraEvidence.totals.groups}</strong><small>{zannoraEvidence.totals.passed} lulus · {zannoraEvidence.totals.failed} perlu perhatian</small></div>
                    <div className="evidence-summary-card"><span>Report JSON</span><strong>{zannoraEvidence.totals.reports}</strong><small>Report per kategori tersedia</small></div>
                    <div className="evidence-summary-card"><span>Screenshot</span><strong>{zannoraEvidence.totals.screenshots}</strong><small>Bukti visual yang bisa diperbesar</small></div>
                    <div className="evidence-summary-card"><span>Video</span><strong>{zannoraEvidence.totals.videos}</strong><small>Video flow dengan kontrol playback</small></div>
                  </div>

                  <div className="evidence-filter-bar">
                    <span>LIHAT BAGIAN:</span>
                    <button className={`tool-btn ${evidenceGroupFilter === 'all' ? 'active' : ''}`} onClick={() => setEvidenceGroupFilter('all')}>Semua ({zannoraEvidence.groups.length})</button>
                    {[...new Set(zannoraEvidence.groups.map((group) => group.category))].map((category) => (
                      <button key={category} className={`tool-btn ${evidenceGroupFilter === category ? 'active' : ''}`} onClick={() => setEvidenceGroupFilter(category)}>{category}</button>
                    ))}
                  </div>

                  <div className="evidence-groups">
                    {zannoraEvidence.groups.filter((group) => evidenceGroupFilter === 'all' || group.category === evidenceGroupFilter).map((group) => (
                      <Panel key={group.id} className="evidence-group-panel">
                        <div className="evidence-group-heading">
                          <div>
                            <div className="evidence-group-kicker">{group.category}</div>
                            <h2>{group.title}</h2>
                            <p>{group.summary}</p>
                          </div>
                          <Badge value={group.status} />
                        </div>
                        <div className="evidence-folder-row">
                          <span><Icon name="database" size={14} /> Folder evidence</span>
                          <code>{group.folder}</code>
                          {group.report && <a href={group.report.url} target="_blank" rel="noreferrer">Buka report JSON ↗</a>}
                        </div>

                        {group.videos.length > 0 && (
                          <div className="evidence-section">
                            <div className="evidence-section-title"><span>VIDEO FLOW</span><small>{group.videos.length} file</small></div>
                            <div className="evidence-video-grid">
                              {group.videos.map((asset: EvidenceAsset) => (
                                <div className="evidence-video-card" key={asset.relativePath}>
                                  <video controls preload="metadata" src={asset.url} />
                                  <div className="evidence-asset-footer"><div><strong>{asset.label}</strong><small>{asset.relativePath}</small></div><a href={asset.url} download>Download</a></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {group.screenshots.length > 0 && (
                          <details className="evidence-section evidence-screenshot-details">
                            <summary><span>SCREENSHOT CHECKPOINT</span><small>{group.screenshots.length} file · klik untuk buka semua</small></summary>
                            <div className="evidence-screenshot-grid">
                              {group.screenshots.map((asset: EvidenceAsset) => (
                                <button className="evidence-screenshot-card" key={asset.relativePath} onClick={() => setFullScreenshot(asset.url)} title="Klik untuk memperbesar screenshot">
                                  <img src={asset.url} alt={asset.label} loading="lazy" />
                                  <span>{asset.name}</span>
                                </button>
                              ))}
                            </div>
                          </details>
                        )}

                        <div className="evidence-asset-count"><span>{group.assets.length} total artifact terindeks</span><span>Updated {date(group.report?.updatedAt || group.assets[0]?.updatedAt)}</span></div>
                      </Panel>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {currentView === 'settings' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>System Capabilities &amp; Engine Status</h1>
                  <p>Pemeriksaan kesiapan runtime Docker, Playwright engine, Maestro CLI, dan ADB devices.</p>
                </div>
                <button className="primary" onClick={refreshSystem}>
                  <Icon name="refresh" size={16} /> Re-probe Engines
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <Panel title="Playwright Browser Engine">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong>Headless Chromium Runtime</strong>
                    <Badge value={system?.playwright.available ? 'ready' : 'unavailable'} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{system?.playwright.message || 'Mengecek Playwright...'}</p>
                </Panel>

                <Panel title="Docker Daemon">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong>Isolated Containers &amp; Databases</strong>
                    <Badge value={system?.docker.available ? 'ready' : 'unavailable'} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{system?.docker.message || 'Mengecek Docker...'}</p>
                  <small style={{ color: 'var(--text-dim)', marginTop: 10, display: 'block' }}>
                    Docker digunakan untuk provisioning isolated MySQL/PostgreSQL/SQLite pada mode managed-local.
                  </small>
                </Panel>

                <Panel title="Maestro CLI">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong>Mobile UI Automation</strong>
                    <Badge value={system?.maestro.available ? 'ready' : 'unavailable'} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{system?.maestro.message || 'Mengecek Maestro CLI...'}</p>
                </Panel>

                <Panel title="Android Debug Bridge (ADB)">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong>Connected Devices</strong>
                    <Badge value={system?.adb.available ? 'ready' : 'unavailable'} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{system?.adb.message || 'Mengecek ADB...'}</p>
                  {system?.adb.devices && system.adb.devices.length > 0 && (
                    <ul style={{ marginTop: 12, paddingLeft: 18, color: 'var(--cyan)' }}>
                      {system.adb.devices.map(d => <li key={d}><code>{d}</code></li>)}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          )}

          {/* VIEW: LIVE VIEWPORT */}
          {currentView === 'live' && (
            <LiveViewport job={activeJob} />
          )}
        </main>
      </div>

      {/* MODAL FULLSCREEN SCREENSHOT */}
      {fullScreenshot && (
        <div
          onClick={() => setFullScreenshot(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 32, cursor: 'zoom-out'
          }}
        >
          <img
            src={fullScreenshot}
            alt="Fullscreen Screenshot"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)' }}
          />
        </div>
      )}
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
