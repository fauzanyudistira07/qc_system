import React, { useState, useMemo } from 'react';
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

export function ProjectSwitcher({
  jobs,
  activeJobId,
  activeJob,
  flowSource: _flowSource,
  onSelectJob,
  onSelectZannora: _onSelectZannora,
  onNewJob,
}: ProjectSwitcherProps) {
  // Apakah daftar projek di sidebar sedang terbuka
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);

  // Group unique projects with their sorted runs
  const projectList = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const j of jobs) {
      const parentJob = j.parentJobId ? jobs.find(p => p.id === j.parentJobId) : null;
      const groupName = (j.kind === 'incremental-room' && parentJob) ? parentJob.name : j.name;
      const list = map.get(groupName) ?? [];
      list.push(j);
      map.set(groupName, list);
    }
    return Array.from(map.entries()).map(([name, runs]) => {
      const sorted = [...runs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const latest = sorted[0];
      return {
        name,
        latestJob: latest,
        platform: latest?.config?.platform || 'web',
        status: latest?.status || 'READY',
        runs: sorted,
      };
    });
  }, [jobs]);

  // Project mana yang sedang di-expand sub-judul percobaannya
  // Default null agar saat pertama dibuka muncul semua judul projek dulu
  const [expandedProjectName, setExpandedProjectName] = useState<string | null>(null);

  const activeName = activeJob?.name || projectList[0]?.name || 'Pilih Projek';
  const activePlatform = activeJob?.config?.platform || projectList[0]?.platform || 'web';

  // Helper run progress summary
  const getRunSummary = (job: Job) => {
    const statusUpper = (job.status || '').toUpperCase();
    const isFailed = statusUpper === 'FAILED' || statusUpper === 'ERROR';
    const isPassed = statusUpper === 'PASSED' || statusUpper === 'COMPLETED';
    const isInterrupted = statusUpper === 'INTERRUPTED' || statusUpper === 'STOPPED';

    let detail = '';
    if (job.results && job.results.length > 0) {
      const passed = job.results.filter(
        (r) =>
          (r.status || '').toUpperCase() === 'PASSED' ||
          (r.status || '').toUpperCase() === 'COMPLETED'
      ).length;
      const failed = job.results.length - passed;
      if (failed > 0) {
        detail = `${passed} berhasil · ${failed} gagal`;
      } else {
        detail = `${passed}/${job.results.length} flow`;
      }
    } else if (job.qualityAudit?.total) {
      const p = job.qualityAudit.passed ?? 0;
      const f = job.qualityAudit.failed ?? 0;
      detail = f > 0 ? `${p} lulus · ${f} gagal` : `${p}/${job.qualityAudit.total} audit`;
    } else if (job.inventory?.pages?.length) {
      detail = `${job.inventory.pages.length} halaman`;
    }

    const dateStr = job.createdAt
      ? new Date(job.createdAt).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return { isPassed, isFailed, isInterrupted, detail, dateStr };
  };

  return (
    <div className="sidebar-accordion-project">
      {/* 1. Trigger Utama di Sidebar: Klik memunculkan semua judul projek */}
      <button
        type="button"
        className={`sidebar-project-trigger-card ${isProjectsOpen ? 'open' : ''}`}
        onClick={() => {
          setIsProjectsOpen(!isProjectsOpen);
        }}
        title="Klik untuk melihat daftar projek & riwayat percobaan"
      >
        <div className="trigger-card-left">
          <div className={`trigger-platform-icon platform-${activePlatform}`}>
            {activePlatform === 'android' ? (
              <Icon name="android" size={13} />
            ) : (
              <Icon name="globe" size={13} />
            )}
          </div>
          <div className="trigger-text-group">
            <span className="trigger-eyebrow">CURRENT PROJECT</span>
            <strong className="trigger-project-title" title={activeName}>
              {activeName}
            </strong>
          </div>
        </div>
        <div className="trigger-card-chevron">
          <Icon name={isProjectsOpen ? 'chevron-up' : 'chevron-down'} size={13} />
        </div>
      </button>

      {/* 2. Daftar Semua Judul Projek (Muncul ketika trigger di-klik) */}
      {isProjectsOpen && (
        <div className="sidebar-projects-dropdown-list">
          {projectList.map((project) => {
            const isProjectExpanded = expandedProjectName === project.name;
            const isProjectActive = project.name === activeJob?.name;

            return (
              <div key={project.name} className="sidebar-project-tree-node">
                {/* Header Judul Projek: Klik untuk memunculkan sub judul per percobaan */}
                <div
                  className={`sidebar-project-item-header ${isProjectActive ? 'active-project' : ''}`}
                  onClick={() => {
                    // Ketika projek dipilih/diklik, baru muncul sub judul per percobaan
                    setExpandedProjectName(isProjectExpanded ? null : project.name);
                  }}
                  title={`Klik untuk membuka sub riwayat pengecekan ${project.name}`}
                >
                  <div className="item-header-left">
                    <span className="chevron-toggle">
                      <Icon name={isProjectExpanded ? 'chevron-down' : 'chevron-right'} size={11} />
                    </span>
                    <span className="project-name-label">{project.name}</span>
                  </div>
                  <span className="project-count-pill">{project.runs.length} run</span>
                </div>

                {/* 3. Sub Judul Per Percobaan (Hanya muncul ketika projeknya dipilih) */}
                {isProjectExpanded && (
                  <div className="sidebar-runs-dropdown-submenu">
                    {project.runs.length === 0 ? (
                      <div className="sidebar-run-empty-note">
                        <span>Belum ada riwayat percobaan</span>
                      </div>
                    ) : (
                      project.runs.map((run, idx) => {
                        const isRunActive = run.id === activeJobId;
                        const runNum = project.runs.length - idx;
                        const summary = getRunSummary(run);
                        const isIncremental = run.kind === 'incremental-room';
                        const commitShaShort = run.commitInfo?.sha ? run.commitInfo.sha.slice(0, 7) : null;

                        return (
                          <div
                            key={run.id}
                            className={`sidebar-run-entry ${isRunActive ? 'active' : ''} ${isIncremental ? 'is-incremental-room' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectJob(run.id);
                            }}
                            title={isIncremental 
                              ? `Dedicated Update Room #${commitShaShort}: ${run.commitInfo?.message || run.name}`
                              : `Pilih Pengecekan #${runNum} (${summary.isFailed ? 'Gagal' : 'Berhasil'})`}
                          >
                            <div className="run-entry-left">
                              <span
                                className={`run-state-dot ${
                                  summary.isFailed
                                    ? 'failed'
                                    : summary.isPassed
                                    ? 'passed'
                                    : 'other'
                                }`}
                              >
                                {summary.isFailed ? '✕' : summary.isPassed ? '✓' : '●'}
                              </span>
                              <div className="run-entry-text">
                                <div className="run-entry-title-row">
                                  {isIncremental ? (
                                    <span className="run-entry-title incremental-title" title={run.commitInfo?.message || run.name}>
                                      <span className="incremental-tag">⚡ UPDATE #{commitShaShort}</span>
                                    </span>
                                  ) : (
                                    <span className="run-entry-title">Baseline #{runNum}</span>
                                  )}
                                </div>
                                <span className="run-entry-sub">
                                  {idx === 0 && <span className="run-entry-latest-tag">TERBARU</span>}
                                  {isIncremental && run.impactReport ? (
                                    <span className="impact-flows-count">{run.impactReport.totalFlowsTested} flow terdampak · </span>
                                  ) : (
                                    summary.detail ? `${summary.detail} · ` : ''
                                  )}
                                  {summary.dateStr}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`run-entry-badge ${
                                summary.isFailed
                                  ? 'badge-failed'
                                  : summary.isPassed
                                  ? 'badge-passed'
                                  : 'badge-neutral'
                              }`}
                            >
                              {isIncremental
                                ? (summary.isPassed ? 'PASSED' : summary.isFailed ? 'FAILED' : run.status)
                                : (summary.isFailed ? 'GAGAL' : summary.isPassed ? 'BERHASIL' : summary.isInterrupted ? 'TERHENTI' : run.status)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer Tambah Project Baru */}
          <div className="sidebar-projects-footer">
            <button
              type="button"
              className="sidebar-add-project-btn"
              onClick={() => {
                onNewJob();
                setIsProjectsOpen(false);
              }}
            >
              <Icon name="plus" size={12} />
              <span>Tambah Project Baru</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
