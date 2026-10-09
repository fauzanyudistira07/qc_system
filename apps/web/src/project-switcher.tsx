import React, { useState, useMemo, useEffect } from 'react';
import { Job } from './types';
import { Icon } from './ui';

interface ProjectSwitcherProps {
  jobs: Job[];
  activeJobId: string | null;
  activeJob: Job | null;
  flowSource: 'job' | 'zannora';
  onSelectJob: (jobId: string) => void;
  onSelectZannora: () => void;
  onNewJob: () => void;
}

export interface RootProject {
  id: string;
  name: string;
  platform: 'web' | 'android';
  runs: Job[];
  updateRooms: Job[];
  baselineRuns: Job[];
  latestJob: Job;
  status: string;
}

/**
 * Normalisasi cerdas nama projek utama:
 * Mengelompokkan seluruh commit update dan run uji terkait ke projek induknya (misal: Zannora).
 */
export function getRootProjectName(job: Job, allJobs?: Job[]): string {
  const lowerName = (job.name || '').toLowerCase();
  const lowerUrl = (job.config?.baseUrl || '').toLowerCase();
  const lowerRepo = (job.commitInfo?.repoUrl || '').toLowerCase();

  if (
    lowerName.includes('zannora') ||
    lowerUrl.includes('zannora') ||
    lowerUrl.includes(':8000') ||
    lowerRepo.includes('zannora')
  ) {
    return 'Zannora';
  }
  if (lowerName.includes('taskia') || lowerUrl.includes('taskia')) {
    return 'Taskia Digital';
  }
  if (lowerName.includes('plane cmms') || lowerUrl.includes('plane')) {
    return 'Plane CMMS';
  }
  if (lowerName.includes('jamaahku') || lowerUrl.includes('jamaahku')) {
    return 'Jamaahku Travel Agent';
  }

  // Jika parentJob ada, telusuri parent
  if (job.parentJobId && allJobs) {
    const parent = allJobs.find((p) => p.id === job.parentJobId);
    if (parent && parent.id !== job.id) {
      return getRootProjectName(parent, allJobs);
    }
  }

  // Khusus room update tanpa prefix jelas, asosiasikan ke Zannora jika pola commit cocok
  if (job.kind === 'incremental-room' || job.name?.startsWith('[Update #')) {
    return 'Zannora';
  }

  return job.name || 'Project Tanpa Nama';
}

function formatFileDisplay(fullPath: string): string {
  if (!fullPath) return '';
  const parts = fullPath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || fullPath;
}

export function ProjectSwitcher({
  jobs,
  activeJobId,
  activeJob,
  flowSource: _flowSource,
  onSelectJob,
  onSelectZannora: _onSelectZannora,
  onNewJob,
}: ProjectSwitcherProps) {
  // Modal Card di tengah layar terbuka/tertutup
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'updates' | 'baselines'>('all');

  // Kelompokkan jobs menjadi Root Projects yang rapi
  const rootProjects = useMemo<RootProject[]>(() => {
    const map = new Map<string, Job[]>();

    for (const j of jobs) {
      const rootName = getRootProjectName(j, jobs);
      const list = map.get(rootName) ?? [];
      list.push(j);
      map.set(rootName, list);
    }

    return Array.from(map.entries()).map(([name, runs]) => {
      const sorted = [...runs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const latest = sorted[0];

      const updateRooms = sorted.filter(
        (r) => r.kind === 'incremental-room' || (r.name && r.name.startsWith('[Update #'))
      );
      const baselineRuns = sorted.filter(
        (r) => r.kind !== 'incremental-room' && !(r.name && r.name.startsWith('[Update #'))
      );

      return {
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name,
        platform: latest?.config?.platform || 'web',
        runs: sorted,
        updateRooms,
        baselineRuns,
        latestJob: latest,
        status: latest?.status || 'READY',
      };
    });
  }, [jobs]);

  // Projek aktif saat ini
  const currentRootProjectName = useMemo(() => {
    if (activeJob) return getRootProjectName(activeJob, jobs);
    return rootProjects[0]?.name || 'Zannora';
  }, [activeJob, jobs, rootProjects]);

  // Tab projek yang sedang dipilih di dalam modal
  const [selectedProjectName, setSelectedProjectName] = useState<string>(currentRootProjectName);

  // Sync tab pilihan ketika activeJob berubah atau modal baru dibuka
  useEffect(() => {
    if (isModalOpen) {
      setSelectedProjectName(currentRootProjectName);
      setSearchQuery('');
      setActiveCategoryTab('all');
    }
  }, [isModalOpen, currentRootProjectName]);

  // Keyboard shortcut listener (Escape & Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const selectedProject = useMemo(() => {
    return rootProjects.find((p) => p.name === selectedProjectName) || rootProjects[0];
  }, [rootProjects, selectedProjectName]);

  // Helper ringkasan metrik run
  const getRunSummary = (job: Job) => {
    const statusUpper = (job.status || '').toUpperCase();
    const isFailed = statusUpper === 'FAILED' || statusUpper === 'ERROR';
    const isPassed = statusUpper === 'PASSED' || statusUpper === 'COMPLETED';
    const isRunning = statusUpper === 'RUNNING';

    let detail = '';
    if (job.kind === 'incremental-room' && job.impactReport) {
      const p = job.impactReport.passed ?? 0;
      const t = job.impactReport.totalFlowsTested ?? (job.flows?.length || 0);
      detail = `${p}/${t} flow`;
    } else if (job.results && job.results.length > 0) {
      const passed = job.results.filter(
        (r) =>
          (r.status || '').toUpperCase() === 'PASSED' ||
          (r.status || '').toUpperCase() === 'COMPLETED'
      ).length;
      detail = `${passed}/${job.results.length} flow`;
    } else if (job.qualityAudit?.total) {
      const p = job.qualityAudit.passed ?? 0;
      detail = `${p}/${job.qualityAudit.total} audit`;
    } else if (job.flows?.length) {
      detail = `${job.flows.length} flow`;
    }

    const dateStr = job.createdAt
      ? new Date(job.createdAt).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return { isPassed, isFailed, isRunning, detail, dateStr };
  };

  const isCurrentActiveIncremental = activeJob?.kind === 'incremental-room';
  const activeSha = activeJob?.commitInfo?.sha?.slice(0, 7);

  // Filter items berdasarkan kategori tab dan pencarian
  const visibleRuns = useMemo(() => {
    if (!selectedProject) return [];
    let list: Job[] = [];
    if (activeCategoryTab === 'updates') {
      list = selectedProject.updateRooms;
    } else if (activeCategoryTab === 'baselines') {
      list = selectedProject.baselineRuns;
    } else {
      list = selectedProject.runs;
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.commitInfo?.message && r.commitInfo.message.toLowerCase().includes(q)) ||
        (r.commitInfo?.sha && r.commitInfo.sha.toLowerCase().includes(q)) ||
        (r.impactReport?.impactedModules &&
          r.impactReport.impactedModules.some((m) => m.toLowerCase().includes(q)))
    );
  }, [selectedProject, activeCategoryTab, searchQuery]);

  return (
    <>
      {/* ============================================================== */}
      {/* 1. SIDEBAR TRIGGER: Rapi, Bersih, Card Modern                 */}
      {/* ============================================================== */}
      <div className="sidebar-accordion-project">
        <button
          type="button"
          className="sidebar-project-trigger-card"
          onClick={() => setIsModalOpen(true)}
          title="Klik untuk memilih Project & Sub-Project (Ctrl+K)"
        >
          <div className={`trigger-platform-icon platform-${selectedProject?.platform || 'web'}`}>
            <Icon name={selectedProject?.platform === 'android' ? 'android' : 'globe'} size={14} />
          </div>

          <div className="trigger-text-column">
            <div className="trigger-top-row">
              <strong className="trigger-project-name" title={currentRootProjectName}>
                {currentRootProjectName}
              </strong>
              <div className="trigger-pill-group">
                <kbd className="trigger-kbd-pill">⌘K</kbd>
                <span className="trigger-chevron-icon">
                  <Icon name="chevron-down" size={11} />
                </span>
              </div>
            </div>

            <div className="trigger-bottom-row">
              {isCurrentActiveIncremental ? (
                <span className="trigger-room-pill" title={activeJob?.commitInfo?.message || ''}>
                  <span className="pill-bolt">⚡</span>
                  <span className="pill-code">#{activeSha}</span>
                  <span className="pill-status-dot">●</span>
                  <span className="pill-text">PASSED</span>
                </span>
              ) : (
                <span className="trigger-baseline-pill">
                  <span className="pill-icon">📋</span>
                  <span className="pill-text">Baseline Suite</span>
                </span>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 2. MODAL CARD DI TENGAH LAYAR: Master-Detail Modern & Responsive*/}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="project-picker-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="project-picker-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-picker-title"
          >
            {/* Header Modal Utama */}
            <div className="project-picker-header">
              <div className="project-picker-header-info">
                <div className="header-tag-row">
                  <span className="project-picker-kicker">PROJECT &amp; SUB-PROJECT COMMAND CENTER</span>
                  <span className="header-shortcut-tag">Tekan <kbd>Esc</kbd> untuk tutup</span>
                </div>
                <h2 id="project-picker-title" className="project-picker-heading">
                  PILIH PROJECT &amp; SUB-PROJECT RUN
                </h2>
                <p className="project-picker-desc">
                  Pilih projek utama di kolom kiri, lalu pilih dedicated update room atau baseline run yang ingin diinspeksi.
                </p>
              </div>
              <button
                type="button"
                className="project-picker-close-btn"
                onClick={() => setIsModalOpen(false)}
                title="Tutup (Esc)"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Layout Master-Detail (Split View) */}
            <div className="project-picker-split-body">
              {/* PANEL KIRI: DAFTAR PROJEK UTAMA */}
              <aside className="project-picker-sidebar">
                <div className="sidebar-section-kicker">
                  <span>PROJEK UTAMA ({rootProjects.length})</span>
                </div>

                <div className="project-nav-list">
                  {rootProjects.map((proj) => {
                    const isSelected = proj.name === selectedProjectName;
                    const isCurrentLive = proj.name === currentRootProjectName;

                    return (
                      <div
                        key={proj.name}
                        className={`project-nav-item ${isSelected ? 'selected' : ''} ${
                          isCurrentLive ? 'is-live' : ''
                        }`}
                        onClick={() => {
                          setSelectedProjectName(proj.name);
                          setActiveCategoryTab('all');
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedProjectName(proj.name);
                          }
                        }}
                      >
                        <div className={`project-nav-icon platform-${proj.platform}`}>
                          <Icon name={proj.platform === 'android' ? 'android' : 'globe'} size={14} />
                        </div>
                        <div className="project-nav-text">
                          <div className="nav-title-row">
                            <strong className="nav-project-name">{proj.name}</strong>
                            {isCurrentLive && <span className="nav-live-dot" title="Aktif di workspace">●</span>}
                          </div>
                          <span className="nav-project-sub">
                            {proj.updateRooms.length > 0
                              ? `${proj.updateRooms.length} Update · ${proj.baselineRuns.length} Base`
                              : `${proj.runs.length} Runs`}
                          </span>
                        </div>
                        <div className="project-nav-arrow">
                          <Icon name="arrow" size={11} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tombol Buat Projek Baru */}
                <div className="sidebar-new-project-wrap">
                  <button
                    type="button"
                    className="sidebar-new-project-btn"
                    onClick={() => {
                      setIsModalOpen(false);
                      onNewJob();
                    }}
                  >
                    <Icon name="plus" size={13} />
                    <span>Tambah Project Baru</span>
                  </button>
                </div>
              </aside>

              {/* PANEL KANAN: SUB-PROJEK & DAFTAR RUN DARI PROJEK TERPILIH */}
              <main className="project-picker-main-content">
                {selectedProject && (
                  <>
                    {/* Header Konten Projek Terpilih */}
                    <div className="project-detail-header-card">
                      <div className="detail-header-left">
                        <div className={`detail-platform-badge platform-${selectedProject.platform}`}>
                          <Icon name={selectedProject.platform === 'android' ? 'android' : 'globe'} size={14} />
                          <span>{selectedProject.platform.toUpperCase()}</span>
                        </div>
                        <div className="detail-title-group">
                          <div className="detail-name-row">
                            <h3>{selectedProject.name}</h3>
                            <span className="detail-status-pill">
                              <span className="status-dot">●</span>
                              <span>{selectedProject.status === 'COMPLETED' || selectedProject.status === 'PASSED' ? 'PASSED (100% HEALTH)' : selectedProject.status}</span>
                            </span>
                          </div>
                          <p className="detail-description">
                            Total {selectedProject.runs.length} run tersimpan di workspace (
                            {selectedProject.updateRooms.length} dedicated update room commit &amp;{' '}
                            {selectedProject.baselineRuns.length} full baseline suite).
                          </p>
                        </div>
                      </div>

                      {/* Search Bar Input */}
                      <div className="detail-header-search">
                        <Icon name="search" size={13} />
                        <input
                          type="text"
                          placeholder="Filter commit, modul, atau run..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            className="search-clear-btn"
                            onClick={() => setSearchQuery('')}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter Tab Kategori Run */}
                    <div className="category-filter-toolbar">
                      <div className="category-tabs-group">
                        <button
                          type="button"
                          className={`category-tab-btn ${activeCategoryTab === 'all' ? 'active' : ''}`}
                          onClick={() => setActiveCategoryTab('all')}
                        >
                          <span>Semua Run</span>
                          <span className="tab-count-badge">{selectedProject.runs.length}</span>
                        </button>
                        {selectedProject.updateRooms.length > 0 && (
                          <button
                            type="button"
                            className={`category-tab-btn ${activeCategoryTab === 'updates' ? 'active' : ''}`}
                            onClick={() => setActiveCategoryTab('updates')}
                          >
                            <span>⚡ Update Rooms</span>
                            <span className="tab-count-badge">{selectedProject.updateRooms.length}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={`category-tab-btn ${activeCategoryTab === 'baselines' ? 'active' : ''}`}
                          onClick={() => setActiveCategoryTab('baselines')}
                        >
                          <span>📋 Baseline Suites</span>
                          <span className="tab-count-badge">{selectedProject.baselineRuns.length}</span>
                        </button>
                      </div>

                      <span className="showing-results-text">
                        Menampilkan {visibleRuns.length} dari {selectedProject.runs.length} pilihan
                      </span>
                    </div>

                    {/* Grid Kartu Sub-Projek & Run */}
                    <div className="runs-cards-grid-scroll">
                      {visibleRuns.length === 0 ? (
                        <div className="runs-empty-state">
                          <Icon name="discovery" size={24} />
                          <strong>Tidak ada run yang sesuai</strong>
                          <span>Coba ubah kata kunci pencarian atau ganti filter kategori di atas.</span>
                        </div>
                      ) : (
                        <div className="runs-cards-grid">
                          {visibleRuns.map((run, idx) => {
                            const isRunActive = run.id === activeJobId;
                            const isIncremental = run.kind === 'incremental-room' || (run.name && run.name.startsWith('[Update #'));
                            const summary = getRunSummary(run);
                            const shaShort = run.commitInfo?.sha ? run.commitInfo.sha.slice(0, 7) : null;
                            const commitMsg = run.commitInfo?.message || run.name;
                            const files = run.commitInfo?.filesChanged || [];
                            const impactedMod = run.impactReport?.impactedModules?.[0] || (isIncremental ? 'Modul Terkait' : 'Full Suite');

                            return (
                              <div
                                key={run.id}
                                className={`run-card ${isIncremental ? 'is-update-room' : 'is-baseline'} ${
                                  isRunActive ? 'active-room' : ''
                                }`}
                                onClick={() => {
                                  onSelectJob(run.id);
                                  setIsModalOpen(false);
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                {/* Top Bar: Badge Jenis & Status */}
                                <div className="run-card-top-bar">
                                  <div className="run-card-type-tags">
                                    {isIncremental ? (
                                      <span className="tag-room-update">
                                        ⚡ UPDATE {shaShort ? `#${shaShort}` : ''}
                                      </span>
                                    ) : (() => {
                                      const baseIdx = selectedProject.baselineRuns.findIndex((b) => b.id === run.id);
                                      const baseNum = baseIdx !== -1 ? selectedProject.baselineRuns.length - baseIdx : idx + 1;
                                      return (
                                        <span className="tag-room-baseline">
                                          📋 BASELINE #{baseNum}
                                        </span>
                                      );
                                    })()}
                                    {isRunActive && <span className="tag-current-opened">SEDANG DIBUKA</span>}
                                  </div>

                                  <span
                                    className={`tag-status-indicator ${
                                      summary.isPassed ? 'status-passed' : summary.isFailed ? 'status-failed' : 'status-other'
                                    }`}
                                  >
                                    <span className="status-dot">●</span>
                                    <span>{summary.isPassed ? 'PASSED' : summary.isFailed ? 'FAILED' : run.status}</span>
                                  </span>
                                </div>

                                {/* Judul Run / Pesan Commit */}
                                <div className="run-card-title-wrap">
                                  <strong className="run-card-title" title={commitMsg}>
                                    {commitMsg}
                                  </strong>
                                </div>

                                {/* Metadata: Modul & File yang Diubah (Format Presisi & Rapih) */}
                                <div className="run-card-meta-box">
                                  <div className="meta-line">
                                    <span className="meta-key">Scope:</span>
                                    <span className="meta-val">{impactedMod}</span>
                                  </div>
                                  {files.length > 0 && (
                                    <div className="meta-line">
                                      <span className="meta-key">File:</span>
                                      <code className="meta-file-tag" title={files[0]}>
                                        {formatFileDisplay(files[0])}
                                      </code>
                                    </div>
                                  )}
                                </div>

                                {/* Footer: Metrik, Waktu, & Tombol Buka */}
                                <div className="run-card-bottom-bar">
                                  <div className="metric-info-group">
                                    <strong className="metric-count">{summary.detail}</strong>
                                    <span className="metric-date">· {summary.dateStr}</span>
                                  </div>
                                  <button type="button" className="run-card-open-btn">
                                    <span>Buka Room</span>
                                    <Icon name="arrow" size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </main>
            </div>

            {/* Footer Modal Bawah */}
            <div className="project-picker-bottom-footer">
              <div className="bottom-footer-tip">
                <span>💡 Tip: Gunakan <kbd>⌘K</kbd> atau <kbd>Ctrl+K</kbd> untuk membuka panel ini kapan saja tanpa berpindah halaman.</span>
              </div>
              <button
                type="button"
                className="bottom-footer-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                Tutup Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
