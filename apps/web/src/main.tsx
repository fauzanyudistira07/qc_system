import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';
import './styles.css';
import './polish.css';
import { Job, Page, Flow, Result, Step, SystemStatus, View, ZannoraEvidence, EvidenceAsset, EvidenceGroup, EvidenceFinding, CapabilityProfile, RunHistoryEntry, FindingWorkflowStatus, FeatureContractPlan, BusinessFlowMap, ENABLE_MOBILE_SUPPORT } from './types';
import { Icon, Badge, Panel, Metric, Progress, Notice, Empty } from './ui';
import { Wizard } from './wizard';
import { LiveViewport } from './live-viewport';
import { request, send, jobPath, artifactUrl, downloadReport, date, duration, errorText, getAuthToken, getAdminUser, clearAuthSession } from './api';
import { AdminLoginView } from './login';
import { ProjectSwitcher } from './project-switcher';
import { BusinessFlowVisualizer } from './business-flow-visualizer';

type ProcessNode = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  color: 'blue' | 'cyan' | 'green' | 'yellow' | 'violet' | 'red';
  status: 'CLEAR' | 'RUNNING' | 'ATTENTION' | 'BLOCKED' | 'RETEST' | 'READY' | 'PASSED' | 'FAILED' | 'PENDING';
  count: string;
  items: string[];
  details: string[];
  evidenceIds: string[];
  target: View;
  x: number;
  y: number;
};

function Paginated<T>({ items, resetKey, children }: { items: T[]; resetKey?: string; children: (items: T[], start: number) => React.ReactNode }) {
  const pageSize = 10;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => setPage(0), [resetKey]);
  useEffect(() => setPage((current) => Math.min(current, pageCount - 1)), [pageCount]);
  const start = page * pageSize;
  return <>
    {children(items.slice(start, start + pageSize), start)}
    {pageCount > 1 && <nav className="evidence-pagination" aria-label="Navigasi halaman data">
      <button className="quiet" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Sebelumnya</button>
      <span aria-live="polite">{start + 1}â€“{Math.min(start + pageSize, items.length)} dari {items.length} · halaman {page + 1}/{pageCount}</span>
      <button className="quiet" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Berikutnya</button>
    </nav>}
  </>;
}

function CapabilityProfilePanel({ profile }: { profile?: CapabilityProfile }) {
  if (!profile) return null;
  return (
    <Panel title="Capability profile" description="Engine memilih flow berdasarkan kemampuan yang benar-benar terdeteksi; fitur yang tidak ditemukan tidak dipaksa dijalankan.">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <Badge value={`${profile.detectedCount}/${profile.totalCatalogCapabilities} detected`} />
        {profile.domainHints.map((hint) => <span key={hint} className="tag" style={{ color: 'var(--cyan)' }}>{hint}</span>)}
      </div>
      {profile.negativeScenarios && profile.negativeScenarios.length > 0 && <details className="capability-negative-plan" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--yellow)' }}>Negative scenario plan · {profile.negativeScenarios.length} skenario</summary>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {profile.negativeScenarios.map((scenario) => <div key={scenario.id} className="tag" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{scenario.label}</span><small>{scenario.execution === 'safe-probe' ? 'safe probe' : 'requires fixture'}</small></div>)}
        </div>
      </details>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
        <Paginated items={profile.capabilities}>{(capabilities) => capabilities.map((capability) => (
          <details key={capability.id} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-panel-sub)' }}>
            <summary style={{ cursor: 'pointer', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: capability.status === 'detected' ? 'var(--green)' : 'var(--yellow)' }}>● </span>
              <strong style={{ flex: 1 }}>{capability.label}</strong>
              <small style={{ color: 'var(--text-dim)' }}>{Math.round(capability.confidence * 100)}%</small>
            </summary>
            <div style={{ padding: '0 12px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
              <div>{capability.rationale}</div>
              <div style={{ marginTop: 6 }}>Routes: {capability.evidence.routes.length} · API: {capability.evidence.apiRoutes.length} · Checks: {capability.recommendedChecks.length}</div>
              {capability.evidence.routes.length > 0 && <code style={{ display: 'block', marginTop: 6, color: 'var(--cyan)', whiteSpace: 'normal' }}>{capability.evidence.routes.slice(0, 5).join(' · ')}</code>}
            </div>
          </details>
        ))}</Paginated>
      </div>
    </Panel>
  );
}

function ProcessMap({ nodes, progress, centralStatus, onNavigate }: { nodes: ProcessNode[]; progress: number; centralStatus: string; onNavigate: (view: View) => void }) {
  const statusLabel = (status: ProcessNode['status']) => status === 'PASSED' ? 'CLEAR' : status === 'FAILED' ? 'ATTENTION' : status === 'RUNNING' ? 'RUNNING' : 'READY';
  return (
    <section className="qc-map-panel" aria-label="QC Maestro technical process map">
      <div className="qc-map-header">
        <div>
          <div className="qc-map-kicker">ZANNORA QC / TECHNICAL MAP v1.0</div>
          <h2>QC Execution Topology</h2>
          <p>Jalur kerja dari target discovery sampai evidence, defect, dan retest. Klik node untuk membuka detail proses.</p>
        </div>
        <div className="qc-map-legend" aria-label="Process status legend">
          <span><i className="qc-map-dot passed" /> Clear</span>
          <span><i className="qc-map-dot running" /> Running</span>
          <span><i className="qc-map-dot failed" /> Attention</span>
          <span><i className="qc-map-dot pending" /> Ready</span>
        </div>
      </div>

      <div className="qc-map-canvas">
        <div className="qc-map-grid" />
        <div className="qc-map-corner-stat"><strong>6</strong><span>PHASES</span></div>
        <div className="qc-map-corner-note">LIVE EXECUTION GRAPH<br /><span>evidence-aware orchestration</span></div>
        <svg className="qc-map-connectors" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
          {nodes.map((node) => {
            const targetX = node.x * 10;
            const targetY = node.y * 6.5 + 24;
            const centerX = 500;
            const centerY = 345;
            const midX = (centerX + targetX) / 2;
            const midY = (centerY + targetY) / 2;
            return <path key={node.id} className={`qc-map-line ${node.color} ${node.status.toLowerCase()}`} d={`M ${centerX} ${centerY} C ${midX} ${centerY}, ${midX} ${targetY}, ${targetX} ${targetY}`} />;
          })}
        </svg>

        <div className="qc-map-center-node">
          <div className="qc-map-center-orbit" />
          <div className="qc-map-center-icon"><Icon name="shield" size={30} /></div>
          <strong>QC Maestro</strong>
          <span>Zannora E2E Control</span>
          <em className={`qc-map-center-status ${centralStatus.toLowerCase()}`}><i />{centralStatus}</em>
        </div>

        {nodes.map((node) => (
          <button
            key={node.id}
            className={`qc-map-node ${node.color} ${node.status.toLowerCase()}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onClick={() => onNavigate(node.target)}
            title={`Buka ${node.title}`}
          >
            <span className="qc-map-node-icon"><Icon name={node.icon} size={20} /></span>
            <span className="qc-map-node-copy">
              <small>{node.eyebrow}</small>
              <strong>{node.title}</strong>
              <span>{node.description}</span>
            </span>
            <span className="qc-map-node-status"><i />{statusLabel(node.status)} · {node.count}</span>
            <span className="qc-map-node-items">{node.items.map((item) => <b key={item}>{item}</b>)}</span>
          </button>
        ))}
      </div>

      <div className="qc-map-footer">
        <div><strong>Suite progress</strong><span>{progress}% mapped to evidence</span></div>
        <div className="qc-map-progress"><span style={{ width: `${progress}%` }} /></div>
        <button className="quiet" onClick={() => onNavigate('evidence')}>Open Evidence Center <Icon name="arrow" size={14} /></button>
      </div>
    </section>
  );
}

type MilestoneStatus = 'CLEAR' | 'RUNNING' | 'ATTENTION' | 'BLOCKED' | 'RETEST' | 'READY';

const milestoneStatusLabel = (status: MilestoneStatus) => ({
  CLEAR: 'CLEAR', RUNNING: 'RUNNING', ATTENTION: 'ATTENTION', BLOCKED: 'BLOCKED', RETEST: 'RETEST', READY: 'READY'
}[status]);

const milestoneStatusIcon = (status: MilestoneStatus) => status === 'CLEAR' ? 'check' : status === 'ATTENTION' || status === 'BLOCKED' ? 'warning' : status === 'RUNNING' ? 'runs' : status === 'RETEST' ? 'refresh' : 'clock';

function milestonePath(from: ProcessNode, to: ProcessNode, connectionIndex: number) {
  const x1 = from.x * 10;
  const y1 = from.y * 7.6;
  const x2 = to.x * 10;
  const y2 = to.y * 7.6;
  if (connectionIndex === 3) {
    const outerX = 950;
    return `M ${x1} ${y1} C ${outerX} ${y1}, ${outerX} ${y2}, ${x2} ${y2}`;
  }
  if (Math.abs(y1 - y2) < 20) return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
  return `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
}

function MilestoneFlow({ nodes, progress, centralStatus, sourceLabel, isLive, selectedNodeId, onSelect, onNavigate }: { nodes: ProcessNode[]; progress: number; centralStatus: MilestoneStatus; sourceLabel: string; isLive: boolean; selectedNodeId: string | null; onSelect: (node: ProcessNode) => void; onNavigate: (view: View) => void }) {
  const completion = nodes.filter((node) => node.status === 'CLEAR' || node.status === 'ATTENTION').length;
  return (
    <section className="milestone-flow" aria-label="QC Maestro milestone flow">
      <div className="milestone-flow-header">
        <div>
          <div className="milestone-kicker">{nodes.length} CHECKPOINTS · PIPELINE ORCHESTRATION</div>
          <h2>Milestone Flow</h2>
          <p>Alur QC aktif dari discovery hingga final report. Klik checkpoint untuk melihat substep, cabang verifikasi, dan output evidence.</p>
        </div>
        <div className="milestone-flow-actions">
          <div className={`milestone-live-badge ${isLive ? 'is-live' : 'is-snapshot'}`}>
            <span className="milestone-live-dot" />
            <div>
              <strong>{isLive ? 'LIVE RUN' : 'VERIFIED PIPELINE'}</strong>
              <small>{completion}/{nodes.length} Checkpoints Clear</small>
            </div>
          </div>
          <button type="button" className="primary" onClick={() => onNavigate('evidence')}>
            <Icon name="reports" size={15} /> Evidence Center
          </button>
        </div>
      </div>

      <div className="milestone-flow-canvas">
        <div className="milestone-grid" />
        <svg className="milestone-connectors" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
          {nodes.slice(1).map((node, index) => {
            const from = nodes[index];
            const path = milestonePath(from, node, index);
            const active = node.status === 'RUNNING' || (node.status === 'RETEST' && from.status === 'CLEAR');
            const completed = node.status === 'CLEAR' || node.status === 'ATTENTION' || node.status === 'RETEST';
            return (
              <g key={`${from.id}-${node.id}`}>
                <path className={`milestone-line ${completed ? 'completed' : ''} ${active ? 'active' : ''} ${node.status.toLowerCase()}`} d={path} />
                {(active || completed) && <path className={`milestone-signal ${active ? 'active' : 'completed'}`} d={path} pathLength="100" style={{ animationDelay: `${index * 0.28}s` }} />}
              </g>
            );
          })}
        </svg>

        <div className={`milestone-center ${centralStatus.toLowerCase()}`}>
          <div className="milestone-center-orbit" />
          <div className="milestone-center-icon"><Icon name="shield" size={24} /></div>
          <strong>QC MAESTRO</strong>
          <span>{centralStatus === 'RUNNING' ? 'QC process is running' : 'QC project control'}</span>
          <em><i />{milestoneStatusLabel(centralStatus)}</em>
        </div>

        {nodes.map((node) => (
          <button key={node.id} className={`milestone-card ${node.color} ${node.status.toLowerCase()} ${selectedNodeId === node.id ? 'selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => onSelect(node)} title={`Buka detail ${node.title}`} aria-pressed={selectedNodeId === node.id}>
            <span className="milestone-number">{node.eyebrow.replace('PHASE ', '').padStart(2, '0')}</span>
            <span className="milestone-card-icon"><Icon name={node.icon} size={22} /></span>
            <span className="milestone-card-copy"><small>{node.eyebrow}</small><strong>{node.title}</strong><span>{node.description}</span></span>
            <span className="milestone-card-status"><i><Icon name={milestoneStatusIcon(node.status as MilestoneStatus)} size={11} /></i>{milestoneStatusLabel(node.status as MilestoneStatus)} <b>·</b> {node.count}</span>
            <span className="milestone-card-tags">{node.items.map((item) => <b key={item}>{item}</b>)}</span>
          </button>
        ))}
      </div>

      <div className="milestone-flow-footer">
        <div><strong>Progress proyek</strong><span>{completion}/{nodes.length} milestone selesai · {progress}% mapped</span></div>
        <div className="milestone-progress-track"><span style={{ width: `${progress}%` }} /></div><strong className="milestone-progress-value">{progress}%</strong>
        <button className="quiet" onClick={() => onNavigate('reports')}>Open Progress Report <Icon name="arrow" size={14} /></button>
      </div>
    </section>
  );
}

function MilestoneDetails({ node, activeJob, evidence, onClose, onNavigate, onOpenEvidenceGroup }: { node: ProcessNode; activeJob: Job | null; evidence: ZannoraEvidence | null; onClose: () => void; onNavigate: (view: View) => void; onOpenEvidenceGroup: (groupId: string) => void }) {
  const status = (['CLEAR', 'RUNNING', 'ATTENTION', 'BLOCKED', 'RETEST', 'READY'] as MilestoneStatus[]).includes(node.status as MilestoneStatus) ? node.status as MilestoneStatus : 'READY';
  const relatedEvidence = evidence?.groups.filter((group) => node.evidenceIds.includes(group.id)) ?? [];
  const projectLabel = activeJob?.name || evidence?.project || 'Belum ada project';
  const folderLabel = activeJob?.workspace?.runPath || relatedEvidence[0]?.folder || 'Menunggu output';
  return (
    <aside className={`milestone-detail-panel ${status.toLowerCase()}`} role="dialog" aria-modal="true" aria-label={`Detail ${node.title}`}>
      <div className="milestone-detail-header"><div><span className="milestone-kicker">{node.eyebrow}</span><h3>{node.title}</h3></div><button className="icon-btn" onClick={onClose} aria-label="Tutup detail"><Icon name="close" size={17} /></button></div>
      <div className="milestone-detail-status"><span><i><Icon name={milestoneStatusIcon(status)} size={12} /></i>{milestoneStatusLabel(status)}</span><strong>{node.count}</strong></div>
      <p className="milestone-detail-description">{node.description}. Semua output milestone ini disimpan ke folder project/run aktif.</p>
      <div className="milestone-detail-section"><span className="milestone-detail-label">CHECKPOINT OUTPUT</span><ul>{node.details.map((detail) => <li key={detail}><Icon name={status === 'READY' ? 'clock' : 'check'} size={14} />{detail}</li>)}</ul></div>
      <div className="milestone-detail-section"><span className="milestone-detail-label">RELATED OUTPUT</span>{relatedEvidence.length > 0 ? <div className="milestone-related-evidence">{relatedEvidence.map((group) => <button key={group.id} className="milestone-related-evidence-card" onClick={() => onOpenEvidenceGroup(group.id)}><span><strong>{group.title}</strong><small>{group.screenshots.length} screenshot · {group.videos.length} video · {group.assets.length} asset</small></span><Badge value={group.status} /><Icon name="arrow" size={13} /></button>)}</div> : <p className="milestone-detail-empty">Output fase ini akan muncul setelah milestone dijalankan pada project/run yang dipilih.</p>}</div>
      <div className="milestone-detail-section"><span className="milestone-detail-label">RUN CONTEXT</span><div className="milestone-detail-context"><span>Project<strong>{projectLabel}</strong></span><span>Phase<strong>{activeJob?.phase?.replace(/_/g, ' ') || status}</strong></span><span>Folder<strong>{folderLabel}</strong></span></div></div>
      <div className="milestone-detail-actions"><button className="primary" onClick={() => { onClose(); onNavigate(node.target); }}>Open Detail <Icon name="arrow" size={14} /></button><button className="quiet" onClick={() => { onClose(); if (relatedEvidence[0]) onOpenEvidenceGroup(relatedEvidence[0].id); else onNavigate('evidence'); }}>Evidence</button></div>
    </aside>
  );
}

type EvidenceFocus = { groupId: string; asset?: EvidenceAsset } | null;

function ScreenshotGrid({ assets, selectedPath, onOpen, resetToken }: { assets: EvidenceAsset[]; selectedPath?: string; onOpen: (asset: EvidenceAsset) => void; resetToken?: string }) {
  const pageSize = 10;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(assets.length / pageSize));
  const pageStart = page * pageSize;
  const visibleAssets = assets.slice(pageStart, pageStart + pageSize);

  useEffect(() => setPage(0), [assets.length, resetToken]);

  return <>
    <div className="evidence-screenshot-grid">
      {visibleAssets.map((asset) => (
        <button className={`evidence-screenshot-card ${selectedPath === asset.relativePath ? 'selected' : ''}`} key={asset.relativePath} onClick={() => onOpen(asset)} title="Klik untuk melihat screenshot dan konteks temuan">
          <img src={asset.url} alt={asset.label} loading="lazy" decoding="async" fetchPriority="low" />
          <span>{asset.name}</span>
        </button>
      ))}
    </div>
    {pageCount > 1 && <nav className="evidence-pagination" aria-label="Halaman screenshot">
      <button className="quiet" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Sebelumnya</button>
      <span aria-live="polite">{pageStart + 1}â€“{Math.min(pageStart + pageSize, assets.length)} dari {assets.length} gambar · halaman {page + 1}/{pageCount}</span>
      <button className="quiet" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page + 1 >= pageCount}>Berikutnya</button>
    </nav>}
  </>;
}

function ScreenshotGallery({ assets, selectedPath, onOpen, collapsible = false, title = 'SCREENSHOT CHECKPOINT', resetToken }: { assets: EvidenceAsset[]; selectedPath?: string; onOpen: (asset: EvidenceAsset) => void; collapsible?: boolean; title?: string; resetToken?: string }) {
  const [open, setOpen] = useState(!collapsible);
  const grid = open ? <ScreenshotGrid assets={assets} selectedPath={selectedPath} onOpen={onOpen} resetToken={resetToken} /> : null;
  if (collapsible) return <details className="evidence-section evidence-screenshot-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span>{title}</span><small>{assets.length} file · buka untuk melihat gambar</small></summary>
    {grid}
  </details>;
  return <div className="evidence-inline-section">
    <div className="evidence-section-title"><span>{title}</span><small>{assets.length} checkpoint</small></div>
    {grid}
  </div>;
}

function EvidenceInspector({ focus, evidence, onClose, onOpenAsset }: { focus: EvidenceFocus; evidence: ZannoraEvidence | null; onClose: () => void; onOpenAsset: (asset: EvidenceAsset) => void }) {
  if (!focus || !evidence) return null;
  const group = evidence.groups.find((item) => item.id === focus.groupId);
  if (!group) return null;
  return (
    <section className="evidence-inline-inspector" aria-label={`Evidence detail ${group.title}`}>
      <div className="evidence-inline-header"><div><span className="evidence-group-kicker">INLINE EVIDENCE INSPECTOR</span><h2>{group.title}</h2><p>{group.summary}</p></div><button className="icon-btn" onClick={onClose} aria-label="Tutup evidence detail"><Icon name="close" size={17} /></button></div>
      <div className="evidence-inline-meta"><Badge value={group.status} /><span>{group.screenshots.length} screenshot</span><span>{group.videos.length} video</span><code>{group.folder}</code></div>
      {focus.asset && <div className="evidence-inline-focus"><div><span className="evidence-group-kicker">SELECTED CHECKPOINT</span><strong>{focus.asset.name}</strong><small>{focus.asset.relativePath}</small></div><button className="quiet" onClick={() => onOpenAsset(focus.asset!)}>Open full size <Icon name="arrow" size={13} /></button></div>}
      {group.videos.length > 0 && <div className="evidence-inline-section"><div className="evidence-section-title"><span>VIDEO TERKAIT</span><small>{group.videos.length} file</small></div><div className="evidence-video-grid">{group.videos.map((asset) => <div className="evidence-video-card" key={asset.relativePath}><video controls preload="metadata" src={asset.url} /><div className="evidence-asset-footer"><div><strong>{asset.label}</strong><small>{asset.relativePath}</small></div><a href={asset.url} download>Download</a></div></div>)}</div></div>}
      {group.screenshots.length > 0 && <ScreenshotGallery assets={group.screenshots} selectedPath={focus.asset?.relativePath} onOpen={onOpenAsset} title="SCREENSHOT YANG PERLU DICEK" resetToken={group.id} />}
    </section>
  );
}

function findingScreenshot(evidence: ZannoraEvidence | null, finding: EvidenceFinding) {
  const group = evidence?.groups.find((item) => item.id === finding.groupId);
  if (!group) return undefined;
  if (finding.screenshot) return group.screenshots.find((asset) => asset.relativePath === finding.screenshot);
  return group.screenshots.find((asset) => finding.route && asset.label.includes(finding.route));
}

export type FindingCategory = 'critical' | 'functional' | 'content' | 'visual' | 'contrast' | 'accessibility';

export const FINDING_CATEGORY_CONFIG: Record<FindingCategory, {
  label: string;
  badgeLabel: string;
  badgeClass: string;
  icon: string;
  color: string;
  description: string;
  priority: number;
}> = {
  critical: {
    label: 'Kritis & Akses',
    badgeLabel: 'KRITIS',
    badgeClass: 'critical',
    icon: 'warning',
    color: 'var(--red)',
    description: 'Autentikasi, error konsol runtime, kegagalan jaringan, dan security headers',
    priority: 1
  },
  functional: {
    label: 'Fungsional & Data',
    badgeLabel: 'FUNGSIONAL',
    badgeClass: 'functional',
    icon: 'zap',
    color: 'var(--yellow)',
    description: 'Data stress overflow, kegagalan recovery form, dan performa respon',
    priority: 2
  },
  content: {
    label: 'Konten & Layout',
    badgeLabel: 'KONTEN',
    badgeClass: 'content',
    icon: 'reports',
    color: 'var(--cyan)',
    description: 'Teks terpotong, komponen bertumpuk, atau ukuran di luar batas',
    priority: 3
  },
  visual: {
    label: 'Visual Regression',
    badgeLabel: 'VISUAL',
    badgeClass: 'visual',
    icon: 'projects',
    color: '#c084fc',
    description: 'Perbedaan render visual piksel dibanding baseline screenshot target',
    priority: 4
  },
  contrast: {
    label: 'Kontras Warna',
    badgeLabel: 'KONTRAS',
    badgeClass: 'contrast',
    icon: 'sun',
    color: '#f472b6',
    description: 'Rasio kontras teks dan kontrol tidak memenuhi standar WCAG AA',
    priority: 5
  },
  accessibility: {
    label: 'Aksesibilitas',
    badgeLabel: 'A11Y',
    badgeClass: 'accessibility',
    icon: 'shield',
    color: '#60a5fa',
    description: 'Navigasi keyboard, focus indicator, dan penamaan semantik ARIA',
    priority: 6
  }
};

function classifyFindingCategory(area: string = ''): FindingCategory {
  const a = area.toLowerCase();
  if (['authentication', 'deep-console', 'deep-network', 'http', 'deep-security-headers', 'security'].includes(a)) {
    return 'critical';
  }
  if (a.startsWith('negative-') || a.startsWith('dense-data') || a === 'deep-performance') {
    return 'functional';
  }
  if (a === 'visual-regression') {
    return 'visual';
  }
  if (a === 'contrast') {
    return 'contrast';
  }
  if (a.startsWith('accessibility')) {
    return 'accessibility';
  }
  return 'content';
}

function getFindingSeverity(area: string = ''): { level: 'CRITICAL' | 'MAJOR' | 'MODERATE' | 'MINOR'; weight: number; color: string; label: string } {
  const cat = classifyFindingCategory(area);
  switch (cat) {
    case 'critical':
      return { level: 'CRITICAL', weight: 100, color: 'var(--red)', label: 'Kritis' };
    case 'functional':
      return { level: 'MAJOR', weight: 75, color: 'var(--yellow)', label: 'Fungsional' };
    case 'content':
      return { level: 'MODERATE', weight: 50, color: 'var(--cyan)', label: 'Konten' };
    case 'visual':
      return { level: 'MINOR', weight: 30, color: '#c084fc', label: 'Visual' };
    case 'contrast':
      return { level: 'MINOR', weight: 25, color: '#f472b6', label: 'Kontras' };
    case 'accessibility':
      return { level: 'MINOR', weight: 20, color: '#60a5fa', label: 'A11y' };
    default:
      return { level: 'MODERATE', weight: 40, color: 'var(--text-dim)', label: 'Temuan' };
  }
}

function getAreaReadableName(area: string = ''): string {
  const map: Record<string, string> = {
    'authentication': 'Autentikasi & Sesi',
    'deep-console': 'Error Konsol / Runtime',
    'deep-network': 'Kegagalan Network / HTTP',
    'http': 'Respons HTTP Error',
    'deep-security-headers': 'Security Response Headers',
    'deep-performance': 'Budget Performa Lambat',
    'dense-data-stress': 'Data Stress & Overflow',
    'dense-data': 'Data Padat',
    'negative-empty-form': 'Validasi Form Kosong',
    'negative-network': 'Pemulihan Gangguan Jaringan',
    'negative-duplicate': 'Guard Dobel Submit',
    'visual-regression': 'Visual Regression',
    'contrast': 'Kontras Warna WCAG AA',
    'accessibility-keyboard': 'Navigasi Keyboard & Fokus',
    'accessibility-screen-reader': 'Struktur Screen Reader & ARIA',
    'accessibility': 'Aksesibilitas UI',
    'typography': 'Tipografi & Ukuran Teks',
    'content-quality': 'Kualitas Konten & Teks Terpotong',
    'responsive': 'Layout Responsif'
  };
  return map[area] || area.replace(/-/g, ' ').toUpperCase();
}

function findingDescription(finding: EvidenceFinding) {
  const route = finding.route || 'halaman yang diuji';
  switch (finding.area) {
    case 'authentication': return `Sesi autentikasi atau token tidak valid saat mengakses ${route}, menyebabkan redirect ke landing page atau status tidak terotorisasi (401/403).`;
    case 'deep-security-headers': return `Header keamanan (seperti CSP, X-Frame-Options, HSTS, X-Content-Type-Options) pada ${route} belum terkonfigurasi sesuai rekomendasi keamanan web.`;
    case 'deep-console': return `Ditemukan error script runtime di konsol browser pada ${route} saat proses audit berjalan.`;
    case 'deep-network': return `Permintaan jaringan (fetch/XHR/asset) pada ${route} mengalami kegagalan (network failure atau HTTP error).`;
    case 'deep-performance': return `Waktu muat (load time) atau ukuran aset pada ${route} melebihi batas budget performa yang ditentukan.`;
    case 'contrast': return `Warna teks atau komponen pada ${route} tidak memenuhi batas contrast WCAG AA. Detail di bawah menunjukkan elemen dan rasio contrast yang terdeteksi.`;
    case 'typography': return `Ukuran atau dimensi kontrol/teks pada ${route} berada di luar baseline yang ditetapkan, atau teks tidak muat di dalam elemennya.`;
    case 'responsive': return `Ada elemen pada ${route} yang lebih lebar dari viewport ${finding.viewport || 'yang diuji'}, sehingga berpotensi keluar layar atau membutuhkan scroll horizontal.`;
    case 'accessibility': return `Ada kontrol interaktif pada ${route} yang belum memiliki label atau identitas aksesibel yang dapat dibaca assistive technology.`;
    case 'accessibility-keyboard': return `Urutan keyboard atau focus indicator pada ${route} belum aman untuk pengguna keyboard. Detail menyebut kontrol yang focus-nya tidak terlihat atau struktur heading yang melompat.`;
    case 'accessibility-screen-reader': return `Struktur semantik ${route} memiliki masalah yang dapat mengganggu screen reader, seperti duplicate id, referensi ARIA putus, atau kontrol di dalam aria-hidden.`;
    case 'http': return `Route ${route} tidak memberikan respons HTTP yang valid dalam batas audit.`;
    case 'dense-data': return `Tabel pada ${route} melebihi area tampil atau tidak aman saat menampilkan data padat.`;
    case 'dense-data-stress': return `Tabel dan kontrol form pada ${route} diuji dengan data sintetis padat serta teks panjang dan ditemukan potensi overflow.`;
    case 'negative-empty-form': return `Form pada ${route} menerima input kosong/invalid tanpa validasi yang dapat diamati. Engine menjalankan probe aman tanpa mengirim data ke target.`;
    case 'negative-network': return `Saat request mutasi dipaksa gagal, ${route} belum menampilkan recovery/error state yang jelas.`;
    case 'negative-duplicate': return `Double-submit probe pada ${route} menghasilkan lebih dari satu request mutasi atau tidak menunjukkan guard idempotensi.`;
    case 'visual-regression': return `Screenshot ${route} berbeda dari baseline pixel-by-pixel atau baseline belum tersedia. Periksa evidence screenshot dan detail diff.`;
    case 'content-quality': return `Ada teks pada ${route} yang terpotong, bertumpuk, atau tidak terbaca dengan benar.`;
    default: return `Engine menandai pemeriksaan UI pada ${route} sebagai finding yang perlu ditinjau.`;
  }
}

function FindingEvidenceDropdown({ finding, evidence }: { finding: EvidenceFinding; evidence: ZannoraEvidence | null }) {
  const screenshot = findingScreenshot(evidence, finding);
  return (
    <div className="finding-evidence-dropdown">
      <div className="finding-evidence-context">
        <div><span>LOKASI ERROR</span><strong>{finding.location || [finding.route, finding.viewport, finding.browser].filter(Boolean).join(' · ') || 'Lokasi tidak tersedia'}</strong></div>
        <div><span>AREA</span><strong>{finding.area || 'UI quality'}</strong></div>
      </div>
      <div className="finding-evidence-body">
        {screenshot ? <a className="finding-evidence-image" href={screenshot.url} target="_blank" rel="noreferrer"><img src={screenshot.url} alt={`Screenshot bukti ${finding.name || 'finding'}`} /><span>Buka screenshot penuh ← —</span></a> : <div className="finding-evidence-no-image">Screenshot untuk checkpoint ini belum tersedia.</div>}
        <div className="finding-evidence-copy"><span className="evidence-group-kicker">KESIMPULAN MASALAH</span><strong className="finding-evidence-summary">{findingDescription(finding)}</strong><span className="evidence-group-kicker finding-detail-kicker">DETAIL ENGINE / ELEMEN TERDETEKSI</span><p>{finding.detail || 'Engine menandai pemeriksaan ini sebagai failed.'}</p>{screenshot && <small>{screenshot.relativePath}</small>}</div>
      </div>
    </div>
  );
}

function evidenceMetric(group?: EvidenceGroup) {
  const metadata = group?.metadata;
  if (metadata && typeof metadata.passed === 'number' && typeof metadata.total === 'number') {
    return { passed: metadata.passed, total: metadata.total, failed: metadata.failed ?? Math.max(0, metadata.total - metadata.passed - (metadata.notApplicable ?? 0)) };
  }
  const match = group?.summary.match(/(\d+)\s*\/\s*(\d+)/);
  const passed = match ? Number(match[1]) : group?.status === 'PASSED' ? 1 : 0;
  const total = match ? Number(match[2]) : group ? 1 : 0;
  return { passed, total, failed: Math.max(0, total - passed) };
}

function RunHistoryPanel({ history }: { history: RunHistoryEntry[] }) {
  if (!history.length) return null;
  return <Panel title="Run history & trend" description="Riwayat run berasal dari folder project/run. Status ini hanya membaca hasil engine; source target tidak diubah otomatis.">
    <Paginated items={history}>{(entries) => <div className="table-wrap"><table><thead><tr><th>Run</th><th>Status</th><th>Progress</th><th>Quality</th><th>Updated</th></tr></thead><tbody>{entries.map((entry) => {
      const quality = entry.quality;
      return <tr key={entry.runLabel}><td><strong>{entry.runLabel}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{entry.project}</small></td><td><Badge value={quality?.status || entry.status} /></td><td>{entry.progress ?? 0}%</td><td>{quality ? `${quality.passed ?? 0}/${quality.total ?? 0} passed · ${quality.failed ?? 0} failed · ${quality.notApplicable ?? 0} N/A` : 'Quality report belum ada'}</td><td>{date(entry.updatedAt || entry.createdAt)}</td></tr>;
    })}</tbody></table></div>}</Paginated>
  </Panel>;
}

function zannoraRoutes(evidence: ZannoraEvidence | null) {
  const routeGroups = evidence?.groups.filter((group) => group.id === 'quality' || group.id === 'responsive') ?? [];
  return [...new Set(routeGroups.flatMap((group) => group.metadata?.routes ?? []))];
}

function zannoraFindings(evidence: ZannoraEvidence | null): EvidenceFinding[] {
  const syntheticFindingSeen = new Set<string>();
  return evidence?.groups.flatMap((group) => (group.metadata?.findings ?? []).map((finding) => ({ ...finding, groupId: group.id }))).filter((finding) => {
    if (finding.passed !== false) return false;
    const isSyntheticRetest = String(finding.name || '').startsWith('Retest required:');
    if (!isSyntheticRetest) return true;
    const key = `${finding.name}|${finding.detail}`;
    if (syntheticFindingSeen.has(key)) return false;
    syntheticFindingSeen.add(key);
    return true;
  }) ?? [];
}

function findingKey(finding: EvidenceFinding, index: number) {
  return `${finding.groupId || 'finding'}|${finding.route || ''}|${finding.viewport || ''}|${finding.browser || ''}|${finding.name || ''}|${index}`;
}

function ZannoraOverview({ evidence, onNavigate, onOpenEvidence }: { evidence: ZannoraEvidence; onNavigate: (view: View) => void; onOpenEvidence: (id: string) => void }) {
  const routes = zannoraRoutes(evidence);
  const designGroups = evidence.groups.filter((group) => ['api-e2e', 'crud', 'roles'].includes(group.id));
  const executionGroups = evidence.groups.filter((group) => ['api-e2e', 'crud', 'roles', 'full-flow', 'navigation'].includes(group.id));
  const executionMetric = executionGroups.reduce((acc, group) => { const metric = evidenceMetric(group); return { passed: acc.passed + metric.passed, total: acc.total + metric.total }; }, { passed: 0, total: 0 });
  const passRate = executionMetric.total ? Math.round((executionMetric.passed / executionMetric.total) * 100) : 0;
  const findings = zannoraFindings(evidence).length;
  return (
    <div>
      <div className="view-header"><div><h1>Project Summary</h1><p>Snapshot real dari evidence QC terakhir. Semua angka di bawah berasal dari report yang tersimpan.</p></div><div className="header-actions"><button className="quiet" onClick={() => onNavigate('process')}><Icon name="map" size={15} /> Milestone Flow</button><button className="primary" onClick={() => onNavigate('evidence')}><Icon name="reports" size={15} /> Evidence Center</button></div></div>
      <div className="metric-grid">
        <Metric tone="cyan" label="Route Terpetakan" value={routes.length} note="route pada quality scope" icon="map" onClick={() => onNavigate('map')} />
        <Metric tone="violet" label="Test Design Suites" value={designGroups.length} note={designGroups.reduce((n, group) => n + evidenceMetric(group).total, 0) + ' assertion'} icon="flows" onClick={() => onNavigate('flows')} />
        <Metric tone="yellow" label="Execution Checks" value={executionMetric.total} note={executionMetric.passed + ' passed · ' + (executionMetric.total - executionMetric.passed) + ' failed'} icon="runs" onClick={() => onNavigate('runs')} />
        <Metric tone="green" label="Pass Rate" value={passRate + '%'} note={findings + ' open finding'} icon="warning" onClick={() => onNavigate('findings')} />
      </div>
      <Panel title="Evidence Snapshot" description={'Generated ' + date(evidence.generatedAt) + ' · ' + evidence.totals.assets + ' artifact terindeks'}>
        <Paginated items={evidence.groups}>{(groups) => <div className="table-wrap"><table><thead><tr><th>Suite</th><th>Status</th><th>Coverage</th><th>Evidence</th><th>Action</th></tr></thead><tbody>{groups.map((group) => { const metric = evidenceMetric(group); return <tr key={group.id}><td><strong>{group.title}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{group.category}</small></td><td><Badge value={group.status} /></td><td>{metric.passed}/{metric.total}</td><td>{group.screenshots.length} screenshot · {group.videos.length} video</td><td><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Inspect <Icon name="arrow" size={12} /></button></td></tr>; })}</tbody></table></div>}</Paginated>
      </Panel>
    </div>
  );
}

function ZannoraDiscovery({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const routes = zannoraRoutes(evidence);
  return <div><div className="view-header"><div><h1>Discovery &amp; Inventory</h1><p>Inventory diambil dari scope quality/responsive dan suite yang benar-benar dijalankan.</p></div><span className="evidence-project-chip">LIVE EVIDENCE SNAPSHOT</span></div><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, .75fr)', gap: 18 }}><Panel title={'Evidence pipeline (' + evidence.groups.length + ' suites)'}><Paginated items={evidence.groups}>{(groups) => <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{groups.map((group) => { const metric = evidenceMetric(group); return <button key={group.id} className="milestone-related-evidence-card" onClick={() => onOpenEvidence(group.id)}><span><strong>{group.title}</strong><small>{metric.passed}/{metric.total} checks · {group.assets.length} asset · {date(group.report?.updatedAt)}</small></span><Badge value={group.status} /><Icon name="arrow" size={13} /></button>; })}</div>}</Paginated></Panel><Panel title={'Route scope (' + routes.length + ')'}><Paginated items={routes}>{(visibleRoutes) => <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{visibleRoutes.length ? visibleRoutes.map((route) => <code key={route} style={{ color: 'var(--cyan)', padding: '8px 10px', background: 'var(--bg-panel)', borderRadius: 6 }}>{route}</code>) : <Empty title="Route scope belum tersedia">Report suite belum membawa daftar route.</Empty>}</div>}</Paginated></Panel></div></div>;
}

function ZannoraAppMap({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const routes = zannoraRoutes(evidence);
  const quality = evidence.groups.find((group) => group.id === 'quality');
  const qualityGroups = evidence.groups.filter((group) => group.category === 'UI Quality');
  return <div><div className="view-header"><div><h1>App Map</h1><p>Route inventory real dari report quality, dengan browser, viewport, dan status evidence.</p></div><button className="primary" onClick={() => onOpenEvidence('quality')}><Icon name="reports" size={15} /> Inspect quality evidence</button></div><div className="split-view"><div className="list-pane"><div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Routes ({routes.length})</div><Paginated items={routes}>{(visibleRoutes) => visibleRoutes.map((route) => <div key={route} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}><strong>{route}</strong><small style={{ display: 'block', marginTop: 5, color: 'var(--text-dim)' }}>covered by quality audit · desktop / tablet / mobile</small></div>)}</Paginated></div><div className="detail-pane"><Panel title="Inventory source" description={quality?.summary}><div className="evidence-inline-meta"><Badge value={quality?.status ?? 'UNKNOWN'} /><span>{quality?.metadata?.browsers?.join(' · ') || 'browser scope unavailable'}</span><span>{quality?.metadata?.viewports?.join(' · ') || 'viewport scope unavailable'}</span></div><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>App Map ini memakai daftar route yang tersimpan di report; bukan data demo atau hasil hitungan statis.</p></Panel><Panel title="Quality coverage"><Paginated items={qualityGroups}>{(groups) => <div className="table-wrap"><table><thead><tr><th>Area</th><th>Checks</th><th>Status</th></tr></thead><tbody>{groups.map((group) => { const metric = evidenceMetric(group); return <tr key={group.id}><td>{group.title}</td><td>{metric.passed}/{metric.total}</td><td><Badge value={group.status} /></td></tr>; })}</tbody></table></div>}</Paginated></Panel></div></div></div>;
}

function ZannoraTestDesign({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const groups = evidence.groups.filter((group) => ['API & CRUD', 'Web Flow'].includes(group.category));
  return <div><div className="view-header"><div><h1>Test Design</h1><p>Suite nyata yang menjadi dasar test design: API, CRUD, role access, navigation, dan full flow.</p></div><button className="quiet" onClick={() => onOpenEvidence('api-e2e')}><Icon name="reports" size={15} /> Open source evidence</button></div><Paginated items={groups}>{(visibleGroups) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>{visibleGroups.map((group) => { const metric = evidenceMetric(group); return <Panel key={group.id} title={group.title} description={group.summary} actions={<Badge value={group.status} />}><div className="evidence-inline-meta"><strong>{metric.passed}/{metric.total}</strong><span>{group.category}</span></div><div className="evidence-asset-count"><span>{group.assets.length} artifact</span><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Detail &amp; evidence <Icon name="arrow" size={12} /></button></div></Panel>; })}</div>}</Paginated></div>;
}

function CrudCoveragePanel({ plan }: { plan?: import('./types').CrudPlan }) {
  if (!plan) return <Panel title="CRUD coverage"><Empty title="CRUD matrix belum tersedia">Jalankan discovery ulang untuk menyusun resource dan operasi CRUD dari inventory.</Empty></Panel>;
  const labels: Record<string, string> = { list: 'List', detail: 'Detail', create: 'Create', update: 'Update', delete: 'Delete', duplicate: 'Duplicate', 'delete-in-use': 'Delete in-use' };
  const tone = (status: string) => status === 'AVAILABLE' ? 'var(--green)' : status === 'REQUIRES_FIXTURE' ? 'var(--yellow)' : status === 'PLANNED' ? 'var(--cyan)' : 'var(--text-dim)';
  return <Panel title={`CRUD coverage · ${plan.totals.resources} resource`} description="Read-only checks dapat dijalankan otomatis; operasi mutasi menunggu fixture yang dapat di-reset.">
    <div className="evidence-inline-meta" style={{ marginBottom: 12 }}><strong>{plan.totals.available}</strong><span>observed</span><strong>{plan.totals.planned}</strong><span>planned</span><strong>{plan.totals.requiresFixture}</strong><span>fixture required</span></div>
    <Paginated items={plan.resources}>{(resources) => <div className="table-wrap"><table><thead><tr><th>Resource</th>{Object.values(labels).map((label) => <th key={label}>{label}</th>)}<th>Confidence</th></tr></thead><tbody>{resources.map((resource) => <tr key={resource.id}><td><strong>{resource.name}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{resource.routes.slice(0, 2).join(' · ')}</small></td>{Object.keys(labels).map((operation) => <td key={operation}><span style={{ color: tone(resource.operations[operation as keyof typeof resource.operations]), fontSize: 10, fontWeight: 800 }}>{resource.operations[operation as keyof typeof resource.operations].replace('_', ' ')}</span></td>)}<td>{Math.round(resource.confidence * 100)}%</td></tr>)}</tbody></table></div>}</Paginated>
    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 12 }}>{plan.limitations.join(' ')}</p>
  </Panel>;
}

function RoleActionPanel({ plan }: { plan?: import('./types').RoleActionPlan }) {
  if (!plan) return <Panel title="Role & action matrix"><Empty title="Role matrix belum tersedia">Discovery belum menghasilkan kombinasi role, halaman, dan action.</Empty></Panel>;
  const tone = (status: string) => status === 'EXPECTED' ? 'var(--green)' : status === 'CANDIDATE' ? 'var(--yellow)' : 'var(--cyan)';
  return <Panel title={`Role & action matrix · ${plan.roles.join(', ')}`} description="Static evidence menjadi baseline; direct URL, API permission, dan cross-role leakage wajib diverifikasi saat runtime.">
    <div className="evidence-inline-meta" style={{ marginBottom: 12 }}><strong>{plan.totals.expected}</strong><span>expected</span><strong>{plan.totals.candidate}</strong><span>candidate</span><strong>{plan.totals.runtime}</strong><span>runtime required</span></div>
    <Paginated items={plan.rows}>{(rows, start) => <div className="table-wrap"><table><thead><tr><th>Role</th><th>Page</th><th>Auth</th><th>Actions</th><th>Coverage</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.role}-${row.page}-${start + index}`}><td><strong>{row.role}</strong></td><td><code>{row.page}</code></td><td>{row.authentication}</td><td style={{ maxWidth: 300, whiteSpace: 'normal' }}>{row.actions.join(' · ')}</td><td><span style={{ color: tone(row.expectation), fontSize: 10, fontWeight: 800 }}>{row.expectation.replace('_', ' ')}</span></td></tr>)}</tbody></table></div>}</Paginated>
    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 12 }}>{plan.limitations.join(' ')}</p>
  </Panel>;
}

function FeatureContractPanel({ plan }: { plan?: FeatureContractPlan }) {
  if (!plan) return <Panel title="Feature test contract"><Empty title="Feature contract belum tersedia">Jalankan discovery ulang untuk memetakan expected UI, API, data, dan skenario per fitur.</Empty></Panel>;
  const scenarioKinds = ['happy', 'negative', 'boundary', 'permission', 'recovery', 'integrity'] as const;
  const tone = (status: string) => status === 'READY_FOR_REVIEW' ? 'var(--green)' : status === 'CANDIDATE' ? 'var(--yellow)' : 'var(--cyan)';
  return <Panel title={`Feature test contract · ${plan.total} fitur`} description="Contract ini memisahkan fitur yang terdeteksi dari fitur yang benar-benar memiliki expected result dan skenario review." actions={<Badge value={`${plan.readyForReview} ready · ${plan.requiresReview} review`} />}>
    <div className="evidence-inline-meta" style={{ marginBottom: 12 }}><strong>{plan.scenarioTotals.happy}</strong><span>happy</span><strong>{plan.scenarioTotals.negative}</strong><span>negative</span><strong>{plan.scenarioTotals.boundary}</strong><span>boundary</span><strong>{plan.scenarioTotals.integrity}</strong><span>integrity</span></div>
    <Paginated items={plan.contracts}>{(contracts) => <div className="table-wrap"><table><thead><tr><th>Feature</th><th>Status</th><th>Actors</th><th>Evidence</th><th>Scenarios</th></tr></thead><tbody>{contracts.map((contract) => <tr key={contract.id}><td><strong>{contract.label}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{contract.category} · {Math.round(contract.confidence * 100)}%</small></td><td><span style={{ color: tone(contract.status), fontSize: 10, fontWeight: 800 }}>{contract.status.replace(/_/g, ' ')}</span></td><td>{contract.actors.slice(0, 3).join(' · ')}</td><td>{contract.routes.length} route · {contract.apiRoutes.length} API</td><td>{scenarioKinds.map((kind) => <span key={kind} className="tag" style={{ marginRight: 4 }}>{kind}: {contract.scenarios.filter((scenario) => scenario.kind === kind).length}</span>)}</td></tr>)}</tbody></table></div>}</Paginated>
    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 12 }}>{plan.limitations.join(' ')}</p>
  </Panel>;
}

function BusinessFlowReviewPanel({ map, onApprove }: { map?: BusinessFlowMap; onApprove: () => void }) {
  if (!map) return null;
  const waiting = map.status !== 'APPROVED';
  return (
    <Panel
      title="Business Flow Review"
      description="Peta alur produk disusun dari evidence repo dan runtime discovery. Review ini menandai bagian yang masih berupa inferensi sebelum flow dijalankan."
      actions={waiting ? <button className="primary" onClick={onApprove}><Icon name="check" size={14} /> Setujui seluruh flow</button> : <Badge value="APPROVED" />}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <Badge value={map.status} />
        <span className="tag">{map.summary.total} alur</span>
        <span className="tag">{map.summary.critical} critical</span>
        <span className="tag">{map.summary.needsReview} perlu review</span>
        {map.productProfile.domainHints.map((hint) => <span key={hint} className="tag" style={{ color: 'var(--cyan)' }}>{hint}</span>)}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {map.flows.map((flow) => (
          <details key={flow.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px', background: 'rgba(255,255,255,.015)' }}>
            <summary style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Badge value={flow.status} />
              <strong style={{ flex: 1 }}>{flow.title}</strong>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{Math.round(flow.confidence * 100)}% confidence {flow.critical ? '· critical' : ''}</span>
            </summary>
            <div style={{ display: 'grid', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>{flow.summary}</p>
              <div style={{ display: 'grid', gap: 6 }}><strong>Actors &amp; trigger</strong><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{flow.actors.join(', ')} · {flow.trigger}</span></div>
              <div style={{ display: 'grid', gap: 6 }}><strong>Urutan kandidat</strong>{flow.steps.map((step) => <div key={step.order} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}><span style={{ color: 'var(--cyan)' }}>{step.order}.</span><span>{step.action}{step.route ? ` · ${step.route}` : ''} ← ’ {step.expected}</span></div>)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div><strong>Expected outcome</strong>{flow.expectedOutcome.slice(0, 5).map((item) => <small key={item} style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>â€¢ {item}</small>)}</div>
                <div><strong>Negative / recovery</strong>{flow.negativeScenarios.slice(0, 3).concat(flow.recoveryScenarios.slice(0, 2)).map((item) => <small key={item} style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>â€¢ {item}</small>)}</div>
              </div>
              {flow.limitations.length > 0 && <small style={{ color: 'var(--yellow)' }}>Catatan: {flow.limitations.join(' · ')}</small>}
            </div>
          </details>
        ))}
      </div>
      {map.limitations.length > 0 && <p style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 0 }}>{map.limitations.join(' · ')}</p>}
    </Panel>
  );
}

function BusinessFlowEditorPanel({ map, onApprove, onUpdate }: { map?: BusinessFlowMap; onApprove: () => void; onUpdate: (flowId: string, patch: Record<string, unknown>) => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<string, BusinessFlowMap['flows'][number]>>({});
  useEffect(() => { if (map) setDrafts(Object.fromEntries(map.flows.map((flow) => [flow.id, flow]))); }, [map]);
  if (!map) return null;
  const waiting = map.status !== 'APPROVED';
  const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
  const updateDraft = (flowId: string, patch: Partial<BusinessFlowMap['flows'][number]>) => setDrafts((current) => ({ ...current, [flowId]: { ...current[flowId], ...patch } }));
  return <Panel title="Business Flow Review" description="Peta alur produk disusun dari evidence repo dan runtime discovery. Edit expected result dan langkah sebelum user menyetujui flow." actions={waiting ? <button className="primary" onClick={onApprove}><Icon name="check" size={14} /> Setujui seluruh flow</button> : <Badge value="APPROVED" />}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}><Badge value={map.status} /><span className="tag">{map.summary.total} alur</span><span className="tag">{map.summary.critical} critical</span><span className="tag">{map.summary.needsReview} perlu review</span></div>
    <Paginated items={map.flows}>{(flows) => <div style={{ display: 'grid', gap: 8 }}>{flows.map((flow) => { const draft = drafts[flow.id] ?? flow; return <details key={flow.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px' }}>
      <summary style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}><Badge value={draft.status} /><strong style={{ flex: 1 }}>{draft.title}</strong><span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{Math.round(draft.confidence * 100)}% confidence</span></summary>
      <div style={{ display: 'grid', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <label>Judul<input value={draft.title} onChange={(event) => updateDraft(flow.id, { title: event.target.value })} /></label>
        <label>Ringkasan<textarea rows={2} value={draft.summary} onChange={(event) => updateDraft(flow.id, { summary: event.target.value })} /></label>
        <label>Trigger<input value={draft.trigger} onChange={(event) => updateDraft(flow.id, { trigger: event.target.value })} /></label>
        <label>Actors <small>(satu per baris)</small><textarea rows={2} value={draft.actors.join('\n')} onChange={(event) => updateDraft(flow.id, { actors: lines(event.target.value) })} /></label>
        <label>Preconditions <small>(satu per baris)</small><textarea rows={2} value={draft.preconditions.join('\n')} onChange={(event) => updateDraft(flow.id, { preconditions: lines(event.target.value) })} /></label>
        <strong>Urutan flow — edit per langkah</strong>
        {draft.steps.map((step, index) => <div key={`${flow.id}-${index}`} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr', gap: 8, alignItems: 'start' }}><span style={{ color: 'var(--cyan)', paddingTop: 8 }}>{index + 1}.</span><div style={{ display: 'grid', gap: 6 }}><input aria-label={`Action langkah ${index + 1}`} value={step.action} placeholder="Action" onChange={(event) => updateDraft(flow.id, { steps: draft.steps.map((item, stepIndex) => stepIndex === index ? { ...item, action: event.target.value, order: stepIndex + 1 } : item) })} /><input aria-label={`Route langkah ${index + 1}`} value={step.route ?? ''} placeholder="Route / endpoint" onChange={(event) => updateDraft(flow.id, { steps: draft.steps.map((item, stepIndex) => stepIndex === index ? { ...item, route: event.target.value, order: stepIndex + 1 } : item) })} /></div><textarea aria-label={`Expected langkah ${index + 1}`} rows={2} value={step.expected} placeholder="Expected result" onChange={(event) => updateDraft(flow.id, { steps: draft.steps.map((item, stepIndex) => stepIndex === index ? { ...item, expected: event.target.value, order: stepIndex + 1 } : item) })} /></div>)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}><label><strong>Expected outcome</strong><textarea rows={4} value={draft.expectedOutcome.join('\n')} onChange={(event) => updateDraft(flow.id, { expectedOutcome: lines(event.target.value) })} /></label><label><strong>Negative scenarios</strong><textarea rows={4} value={draft.negativeScenarios.join('\n')} onChange={(event) => updateDraft(flow.id, { negativeScenarios: lines(event.target.value) })} /></label><label><strong>Recovery scenarios</strong><textarea rows={4} value={draft.recoveryScenarios.join('\n')} onChange={(event) => updateDraft(flow.id, { recoveryScenarios: lines(event.target.value) })} /></label></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={draft.critical} onChange={(event) => updateDraft(flow.id, { critical: event.target.checked })} /> Critical flow</label>
        <button className="primary" onClick={() => void onUpdate(flow.id, { title: draft.title, summary: draft.summary, trigger: draft.trigger, actors: draft.actors, preconditions: draft.preconditions, steps: draft.steps, expectedOutcome: draft.expectedOutcome, negativeScenarios: draft.negativeScenarios, recoveryScenarios: draft.recoveryScenarios, critical: draft.critical })}><Icon name="check" size={14} /> Simpan perubahan flow</button>
      </div>
    </details>; })}</div>}</Paginated>
  </Panel>;
}

function ZannoraRuns({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  return <div><div className="view-header"><div><h1>Execution Runs</h1><p>Ringkasan eksekusi yang dirakit dari report JSON terbaru tiap suite.</p></div><span className="evidence-project-chip">{evidence.totals.passed}/{evidence.totals.groups} SUITES PASSED</span></div><Panel title="Real execution ledger"><Paginated items={evidence.groups}>{(groups) => <div className="table-wrap"><table><thead><tr><th>Run</th><th>Passed / Total</th><th>Failed</th><th>Artifacts</th><th>Report</th></tr></thead><tbody>{groups.map((group) => { const metric = evidenceMetric(group); return <tr key={group.id}><td><strong>{group.title}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{group.id}</small></td><td>{metric.passed}/{metric.total}</td><td>{metric.failed}</td><td>{group.assets.length}</td><td><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Inspect <Icon name="arrow" size={12} /></button></td></tr>; })}</tbody></table></div>}</Paginated></Panel></div>;
}

function ZannoraReport({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const total = evidence.groups.reduce((acc, group) => { const metric = evidenceMetric(group); return { passed: acc.passed + metric.passed, total: acc.total + metric.total }; }, { passed: 0, total: 0 });
  return <div><div className="view-header"><div><h1>Final Report</h1><p>Executive summary live dari seluruh report dan evidence yang tersedia.</p></div><button className="primary" onClick={() => onOpenEvidence('quality')}><Icon name="reports" size={15} /> Open quality report</button></div><div className="metric-grid"><Metric tone="green" label="Suite Clear" value={evidence.totals.passed + '/' + evidence.totals.groups} note="evidence groups" icon="check" /><Metric tone="cyan" label="Checks Passed" value={total.passed + '/' + total.total} note="across all reports" icon="runs" /><Metric tone="violet" label="Screenshots" value={evidence.totals.screenshots} note="checkpoint evidence" icon="reports" /><Metric tone="yellow" label="Videos" value={evidence.totals.videos} note="flow recording" icon="discovery" /></div><Panel title="Report index"><Paginated items={evidence.groups}>{(groups) => <div className="table-wrap"><table><thead><tr><th>Category</th><th>Summary</th><th>Folder</th><th>Open</th></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td><Badge value={group.category} /></td><td>{group.summary}</td><td><code>{group.folder}</code></td><td><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Evidence <Icon name="arrow" size={12} /></button></td></tr>)}</tbody></table></div>}</Paginated></Panel></div>;
}

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('qc_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qc_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const [currentView, setCurrentView] = useState<View>(() => {
    const routeViews: Record<string, View> = {
      '/': 'overview', '/overview': 'overview', '/process': 'process', '/projects': 'projects',
      '/discovery': 'discovery', '/discovery/new': 'new', '/map': 'map', '/flows': 'flows',
      '/runs': 'runs', '/findings': 'findings', '/reports': 'reports', '/evidence': 'evidence',
      '/settings': 'settings', '/live': 'live'
    };
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path !== '/' && routeViews[path]) {
      return routeViews[path];
    }
    const saved = localStorage.getItem('qc_maestro_current_view') as View | null;
    if (saved && Object.values(routeViews).includes(saved)) {
      return saved;
    }
    return 'overview';
  });

  useEffect(() => {
    localStorage.setItem('qc_maestro_current_view', currentView);
  }, [currentView]);

  const [authToken, setAuthToken] = useState<string | null>(getAuthToken);
  const [adminUser, setAdminUser] = useState(getAdminUser);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthToken(null);
      setAdminUser(null);
    };
    window.addEventListener('qc:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('qc:unauthorized', handleUnauthorized);
  }, []);

  // Instant Cache Hydration: Data tampil instan saat refresh tanpa menunggu network round-trip
  const [jobs, setJobs] = useState<Job[]>(() => {
    try {
      const c = sessionStorage.getItem('qc_maestro_jobs_cache');
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    return localStorage.getItem('qc_maestro_active_job_id');
  });
  const [activeJob, setActiveJob] = useState<Job | null>(() => {
    try {
      const c = sessionStorage.getItem('qc_maestro_active_job_cache');
      return c ? JSON.parse(c) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (activeJobId) {
      localStorage.setItem('qc_maestro_active_job_id', activeJobId);
    }
  }, [activeJobId]);

  useEffect(() => {
    if (activeJob) {
      try {
        sessionStorage.setItem('qc_maestro_active_job_cache', JSON.stringify(activeJob));
      } catch {}
    }
  }, [activeJob]);

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

  // Business Flow approval check (Targeted exclusively on Skenario Test)
  const hasFlowsToApprove = useMemo(() => {
    if (!activeJob) return false;
    // Jika job sedang RUNNING, COMPLETED, atau dalam fase eksekusi Playwright, approval sudah selesai!
    if (activeJob.status === 'RUNNING' || activeJob.status === 'COMPLETED' || activeJob.phase === 'EXECUTING_TESTS') return false;
    if (activeJob.status === 'WAITING_REVIEW' || activeJob.phase === 'BUSINESS_FLOW_REVIEW') return true;
    if (activeJob.businessFlowMap) {
      if (activeJob.businessFlowMap.status === 'AWAITING_REVIEW' || activeJob.businessFlowMap.status === 'PARTIAL') return true;
      return activeJob.businessFlowMap.flows.some(f => f.status !== 'APPROVED');
    }
    return false;
  }, [activeJob]);

  // Edit job state
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Report view filters
  const [reportAttempt, setReportAttempt] = useState<string>('latest');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'PASSED' | 'FAILED'>('all');
  const [reportSubTab, setReportSubTab] = useState<'summary' | 'gallery' | 'document' | 'videos'>('summary');
  const [galleryFilter, setGalleryFilter] = useState<string>('all');

  // Curated Zannora evidence state
  const [zannoraEvidence, setZannoraEvidence] = useState<ZannoraEvidence | null>(null);
  const [targetEvidence, setTargetEvidence] = useState<ZannoraEvidence | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceGroupFilter, setEvidenceGroupFilter] = useState('all');
  const [evidenceSubTab, setEvidenceSubTab] = useState<'gallery' | 'audit'>('gallery');
  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus>(null);
  const [flowSource, setFlowSource] = useState<'zannora' | 'job'>('job');
  const [findingStatuses, setFindingStatuses] = useState<Record<string, FindingWorkflowStatus>>({});
  const lastAutoFlowJobIdRef = useRef<string | null>(null);

  // Failure Diagnostic Memo — Ekstrak detail kegagalan sistem secara presisi
  const failureErrorText = useMemo(() => {
    if (!activeJob) return '';
    if (activeJob.message && activeJob.message.trim()) return activeJob.message;
    const reversed = [...(activeJob.logs || [])].reverse();
    const errorLog = reversed.find(l => 
      l.category === 'SYSTEM' || 
      l.message.toLowerCase().includes('gagal') || 
      l.message.toLowerCase().includes('failed') || 
      l.message.toLowerCase().includes('error') ||
      l.message.toLowerCase().includes('exit 1')
    );
    if (errorLog) return errorLog.message;
    return 'Proses discovery terhenti karena kegagalan pada runtime environment atau service target.';
  }, [activeJob]);

  const failureRecommendation = useMemo(() => {
    const text = (failureErrorText + ' ' + (activeJob?.phase || '')).toLowerCase();
    if (text.includes('install dependency') || text.includes('npm') || text.includes('node-app') || text.includes('yarn') || text.includes('pnpm')) {
      return 'Gagal saat instalasi package dependency (npm install) di server runner. Jika aplikasi website Anda sudah berjalan di port lokal (misal http://localhost:3000), Anda dapat mengklik "Ubah Konfigurasi" dan memilih Target Frontend: "Jalankan di Server" diubah ke "Local URL (Sudah Berjalan)" sehingga QC Maestro dapat langsung melakukan crawling dan testing tanpa menginstal ulang modul.';
    }
    if (text.includes('database') || text.includes('mysql') || text.includes('postgres') || text.includes('sql') || text.includes('connection')) {
      return 'Koneksi database atau eksekusi seed SQL gagal. Periksa format skrip seed.sql atau pastikan service database (MySQL/PostgreSQL) aktif dan dapat menerima koneksi.';
    }
    if (text.includes('git') || text.includes('clone') || text.includes('repository')) {
      return 'Gagal melakukan clone repositori GitHub. Pastikan link repository valid dan Personal Access Token (GITHUB_TOKEN) di .env memiliki hak akses pembacaan repositori.';
    }
    return 'Periksa log terminal di bawah untuk rincian traceback sistem. Anda dapat mengubah konfigurasi target atau mengklik "Jalankan Ulang (Retry)".';
  }, [failureErrorText, activeJob?.phase]);

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
        // Prioritaskan project web terlebih dahulu agar mobile run tidak membingungkan
        const webJob = data.find(j => (j.config?.platform || 'web') === 'web');
        setActiveJobId(webJob ? webJob.id : data[0].id);
        setFlowSource('job');
      } else if (!data.length) {
        setFlowSource('zannora');
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

  // Initial loads (re-run once authenticated, otherwise first requests 401 and the UI stays empty)
  useEffect(() => {
    if (!authToken) return;
    void refreshSystem();
    void refreshJobs();
    const interval = setInterval(() => {
      void refreshSystem();
      void refreshJobs();
    }, 6000);
    return () => clearInterval(interval);
  }, [authToken, refreshSystem, refreshJobs]);

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

  const refreshTargetEvidence = useCallback(async (jobId: string | null = activeJobId) => {
    if (!jobId) {
      setTargetEvidence(null);
      setEvidenceError('');
      return;
    }
    setEvidenceLoading(true);
    try {
      const evidence = await request<ZannoraEvidence>(`/api/v1/discovery/jobs/${jobId}/quality-evidence`);
      setTargetEvidence(evidence);
      setEvidenceError('');
    } catch (error) {
      setTargetEvidence(null);
      setEvidenceError(errorText(error));
    } finally {
      setEvidenceLoading(false);
    }
  }, [activeJobId]);

  const refreshRunHistory = useCallback(async (jobId: string | null = activeJobId) => {
    if (!jobId) {
      setRunHistory([]);
      return;
    }
    try {
      const result = await request<{ entries?: RunHistoryEntry[] }>(`/api/v1/discovery/jobs/${jobId}/history`);
      setRunHistory(result.entries ?? []);
    } catch {
      setRunHistory([]);
    }
  }, [activeJobId]);

  useEffect(() => {
    if (!authToken) return;
    void refreshZannoraEvidence();
  }, [authToken, refreshZannoraEvidence]);

  useEffect(() => {
    if (!authToken) return;
    if (flowSource !== 'job') return;
    if (activeJobId) {
      void refreshTargetEvidence(activeJobId);
      void refreshRunHistory(activeJobId);
    }
  }, [authToken, activeJobId, flowSource, refreshRunHistory, refreshTargetEvidence]);

  // Keep the selected evidence source live. Zannora is the default source, so its report-backed nav data refreshes too.
  useEffect(() => {
    if (!authToken) return;
    if (flowSource === 'zannora') {
      const timer = window.setInterval(() => void refreshZannoraEvidence(), 5000);
      return () => clearInterval(timer);
    }
    if (!activeJobId || !activeJob || (activeJob.status !== 'RUNNING' && activeJob.status !== 'QUEUED' && currentView !== 'findings')) return;
    const timer = window.setInterval(() => { void refreshTargetEvidence(activeJobId); void refreshRunHistory(activeJobId); }, 5000);
    return () => clearInterval(timer);
  }, [authToken, activeJob, activeJobId, currentView, flowSource, refreshRunHistory, refreshTargetEvidence, refreshZannoraEvidence]);

  // Poll active job details
  useEffect(() => {
    if (!activeJobId) {
      setActiveJob(null);
      setFindingStatuses({});
      return;
    }

    let timer: number | undefined;
    let cancelled = false;

    const pollJob = async () => {
      try {
        const job = await request<Job>(jobPath(activeJobId));
        if (cancelled) return;
        setActiveJob(job);
        // Otomatis arahkan ke halaman Skenario Test saat pemetaan alur bisnis selesai dan menunggu approval user
        if (job.status === 'WAITING_REVIEW' && lastAutoFlowJobIdRef.current !== job.id) {
          lastAutoFlowJobIdRef.current = job.id;
          setFlowSource('job');
          setCurrentView('flows');
        }
        if (job.status === 'RUNNING' || job.status === 'QUEUED' || job.status === 'WAITING_REVIEW') {
          timer = window.setTimeout(() => void pollJob(), 500);
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

  useEffect(() => {
    setFindingStatuses(activeJob?.findingStatuses ?? {});
  }, [activeJob?.id, activeJob?.findingStatuses]);

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
    let passedCount = results.filter(r => r.status === 'PASSED').length;
    let failedCount = results.filter(r => r.status === 'FAILED' || r.status === 'INFRA_ERROR').length;
    let totalRuns = results.length;

    // Fallback ke runHistory jika array results internal job kosong (misal hasil Playwright E2E standalone)
    if (totalRuns === 0 && runHistory && runHistory.length > 0) {
      totalRuns = runHistory.length;
      passedCount = runHistory.filter(r => r.status === 'COMPLETED' || r.status === 'PASSED' || r.quality?.status === 'PASSED').length;
      failedCount = runHistory.filter(r => r.status === 'FAILED' || r.status === 'WARNING' || r.quality?.status === 'FAILED').length;
    }

    return { pagesCount, elementsCount, flowsCount, passedCount, failedCount, totalRuns };
  }, [activeJob, runHistory]);

  const flowJob = flowSource === 'job' ? activeJob : null;
  const flowEvidence = flowSource === 'zannora' ? zannoraEvidence : targetEvidence;
  const flowSourceLabel = flowSource === 'zannora' ? 'Zannora · latest evidence' : flowJob?.name || 'Active discovery run';
  const zannoraRouteCount = zannoraRoutes(zannoraEvidence).length;
  const zannoraOpenFindings = zannoraFindings(zannoraEvidence);
  const activeEvidence = flowSource === 'zannora' ? zannoraEvidence : targetEvidence;
  const activeOpenFindings = zannoraFindings(activeEvidence).map((finding, index) => ({ ...finding, workflowStatus: flowSource === 'job' ? (findingStatuses[findingKey(finding, index)] || 'OPEN') : 'OPEN', findingIndex: index })).filter((finding) => finding.workflowStatus !== 'PASSED');
  const zannoraDesignGroups = zannoraEvidence?.groups.filter((group) => ['api-e2e', 'crud', 'roles'].includes(group.id)) ?? [];
  const zannoraExecutionGroups = zannoraEvidence?.groups.filter((group) => ['api-e2e', 'crud', 'roles', 'full-flow', 'navigation'].includes(group.id)) ?? [];
  const zannoraExecutionTotal = zannoraExecutionGroups.reduce((total, group) => total + evidenceMetric(group).total, 0);
  const [selectedMilestone, setSelectedMilestone] = useState<ProcessNode | null>(null);
  const [expandedFindingKey, setExpandedFindingKey] = useState<string | null>(null);
  const [findingCategoryFilter, setFindingCategoryFilter] = useState<'all' | FindingCategory>('all');
  const [findingAreaFilter, setFindingAreaFilter] = useState<string>('all');
  const [findingSearchQuery, setFindingSearchQuery] = useState<string>('');
  const [findingViewMode, setFindingViewMode] = useState<'grouped' | 'list'>('grouped');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    visual: true,
    contrast: true,
    accessibility: true,
    content: false,
    functional: false,
    critical: false
  });

  useEffect(() => {
    if (!selectedMilestone) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedMilestone(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedMilestone]);

  const processNodes = useMemo<ProcessNode[]>(() => {
    const groups = new Map((flowEvidence?.groups || []).map((group) => [group.id, group]));
    const active = flowJob?.status === 'RUNNING' || flowJob?.status === 'QUEUED' || flowJob?.status === 'WAITING_REVIEW';
    const failedJob = flowJob?.status === 'FAILED' || flowJob?.results?.some((result) => result.status !== 'PASSED');
    const hasSource = Boolean(flowJob || flowEvidence);
    const groupStatus = (id: string, fallback: MilestoneStatus = 'READY'): MilestoneStatus => {
      const group = groups.get(id);
      if (group?.status === 'PASSED') return 'CLEAR';
      if (group?.status === 'FAILED' || group?.status === 'PASSED_WITH_LIMITATIONS') return 'ATTENTION';
      return fallback;
    };
    const phaseMatches = (pattern: RegExp) => active && pattern.test(flowJob?.phase || '');
    const setupStatus: MilestoneStatus = phaseMatches(/PREPAR|DATABASE|RUNTIME|BOOT|ENV|STARTING/) ? 'RUNNING' : failedJob ? 'ATTENTION' : hasSource ? 'CLEAR' : 'READY';
    const discoveryStatus: MilestoneStatus = phaseMatches(/DISCOVER|SCAN|CRAWL|INVENTORY/) ? 'RUNNING' : failedJob && !flowJob?.inventory ? 'ATTENTION' : flowJob?.inventory || flowEvidence ? 'CLEAR' : 'READY';
    const designReady = Boolean((flowJob?.flows?.length ?? 0) > 0 || (groups.get('api-e2e')?.status === 'PASSED' && groups.get('crud')?.status === 'PASSED' && groups.get('roles')?.status === 'PASSED'));
    const designStatus: MilestoneStatus = phaseMatches(/FLOW|DESIGN|SYNTHESIS|BUSINESS_FLOW_REVIEW/) ? 'RUNNING' : failedJob && !designReady ? 'ATTENTION' : designReady ? 'CLEAR' : 'READY';
    const executionGroupStatus = groupStatus('full-flow', 'READY');
    const executionStatus: MilestoneStatus = phaseMatches(/RUN|EXECUTE|PLAYWRIGHT|MAESTRO/) ? 'RUNNING' : executionGroupStatus !== 'READY' ? executionGroupStatus : (flowJob?.results?.length ? (failedJob ? 'ATTENTION' : 'CLEAR') : 'READY');
    const responsiveStatus = groupStatus('responsive', groupStatus('target-quality', 'READY'));
    const visualQualityStatus = groupStatus('quality', groupStatus('target-quality', 'READY'));
    const qualityStatus: MilestoneStatus = phaseMatches(/RESPONSIVE|LAYOUT|UI|QUALITY|ACCESSIBILITY|VISUAL/) ? 'RUNNING' : responsiveStatus === 'ATTENTION' || visualQualityStatus === 'ATTENTION' ? 'ATTENTION' : responsiveStatus === 'CLEAR' && visualQualityStatus === 'CLEAR' ? 'CLEAR' : flowEvidence ? 'READY' : 'READY';
    const hasOpenRetest = ['responsive', 'quality', 'target-quality'].some((id) => ['FAILED', 'PASSED_WITH_LIMITATIONS'].includes(groups.get(id)?.status || '')) || failedJob;
    const retestStatus: MilestoneStatus = phaseMatches(/RETEST|RETRY|EVIDENCE/) ? 'RUNNING' : hasOpenRetest ? 'RETEST' : flowEvidence && flowEvidence.totals.assets > 0 ? 'CLEAR' : flowJob?.results?.length && !failedJob ? 'CLEAR' : 'READY';
    const evidenceStatus: MilestoneStatus = flowEvidence && flowEvidence.totals.assets > 0 ? (flowEvidence.totals.failed > 0 ? 'ATTENTION' : 'CLEAR') : flowJob?.results?.length ? (failedJob ? 'ATTENTION' : 'CLEAR') : 'READY';
    const requiredEvidenceIds = flowSource === 'zannora' ? ['api-e2e', 'crud', 'roles', 'full-flow', 'navigation', 'responsive', 'quality'] : ['target-quality'];
    const allEvidenceReady = flowEvidence ? requiredEvidenceIds.every((id) => groups.get(id)?.status === 'PASSED') : flowJob?.status === 'COMPLETED';
    const finalStatus: MilestoneStatus = hasOpenRetest || evidenceStatus === 'ATTENTION' ? 'ATTENTION' : hasSource && allEvidenceReady ? 'CLEAR' : 'READY';
    const pageCount = flowJob?.inventory?.pages?.length;
    const evidenceCount = flowEvidence?.totals.assets;
    const nodes: ProcessNode[] = [
      { id: 'start-analysis', eyebrow: 'PHASE 01', title: 'Start & Analysis', description: 'Repository, scope, stack, dan target', icon: 'overview', color: 'blue', status: failedJob ? 'ATTENTION' : hasSource ? 'CLEAR' : 'READY', count: hasSource ? 'Target mapped' : 'Waiting input', items: ['Repository', 'Scope', 'Stack'], details: ['Project input tervalidasi', 'Repository / target URL tercatat', 'Scope dan platform pengujian ditetapkan'], evidenceIds: [], target: 'projects', x: 12, y: 20 },
      { id: 'setup-environment', eyebrow: 'PHASE 02', title: 'Setup Environment', description: 'ENV, database, service, dan akun uji', icon: 'settings', color: 'cyan', status: setupStatus, count: setupStatus === 'RUNNING' ? 'Preparing' : hasSource ? 'Environment ready' : 'Waiting', items: ['ENV', 'DB', 'Service'], details: ['Environment variables disiapkan', 'Database dan service health check', 'Akun testing siap digunakan'], evidenceIds: [], target: 'discovery', x: 39, y: 20 },
      { id: 'discovery-inventory', eyebrow: 'PHASE 03', title: 'Discovery & Inventory', description: 'Halaman, endpoint, elemen, dan evidence awal', icon: 'discovery', color: 'green', status: discoveryStatus, count: pageCount ? `${pageCount} pages` : flowEvidence ? `${flowEvidence.totals.groups} suites` : hasSource ? 'Asset mapped' : 'Waiting', items: ['Pages', 'Routes', 'Evidence'], details: ['Static source analysis', 'Dynamic crawl dan route inventory', 'Screenshot halaman awal'], evidenceIds: [], target: 'map', x: 66, y: 20 },
      { id: 'test-design', eyebrow: 'PHASE 04', title: 'Test Design', description: 'Skenario role, CRUD, API, UI, dan full flow', icon: 'flows', color: 'yellow', status: designStatus, count: flowEvidence ? '83 API · 3 suites' : flowJob?.flows?.length ? `${flowJob.flows.length} flows` : 'Waiting', items: ['Roles', 'CRUD', 'Flow'], details: ['Canonical scenarios dibuat', 'Access matrix setiap role', 'Flow siap dieksekusi atau review'], evidenceIds: ['api-e2e', 'crud', 'roles'], target: 'flows', x: 89, y: 20 },
      { id: 'execution', eyebrow: 'PHASE 05', title: 'Execution', description: 'API, master data, role access, dan customer journey', icon: 'runs', color: 'green', status: executionStatus, count: groups.get('full-flow')?.status === 'PASSED' ? '28 steps' : flowJob?.results?.length ? `${flowJob.results.length} runs` : 'Queued', items: ['API', 'UI', 'E2E'], details: ['API E2E seluruh endpoint', 'CRUD dan role access', 'Booking, payment ACC, ticket, e-ticket'], evidenceIds: ['api-e2e', 'full-flow', 'navigation'], target: 'runs', x: 89, y: 78 },
      { id: 'responsive-quality', eyebrow: 'PHASE 06', title: 'Responsive & UI Quality', description: 'Desktop, tablet, mobile, layout, dan usability', icon: 'discovery', color: 'violet', status: qualityStatus, count: groups.get('responsive')?.status === 'FAILED' || groups.get('quality')?.status === 'FAILED' || groups.get('target-quality')?.status === 'FAILED' ? 'Quality findings' : groups.has('quality') ? `${groups.get('quality')?.screenshots.length ?? 0} quality assets` : groups.has('responsive') ? `${groups.get('responsive')?.screenshots.length ?? 0} checks` : groups.has('target-quality') ? `${groups.get('target-quality')?.screenshots.length ?? 0} quality assets` : 'Waiting', items: ['Desktop', 'Tablet', 'Mobile'], details: ['Viewport desktop, tablet, mobile', 'Contrast, typography, pixel regression, dan dense data', 'Keyboard, ARIA, state, dan cross-browser smoke'], evidenceIds: flowSource === 'zannora' ? ['responsive', 'quality'] : ['target-quality'], target: 'findings', x: 66, y: 78 },
      { id: 'evidence-retest', eyebrow: 'PHASE 07', title: 'Evidence & Retest', description: 'Screenshot, video, report, defect, dan retest', icon: 'reports', color: 'blue', status: retestStatus, count: evidenceCount ? `${evidenceCount} files` : 'Waiting', items: ['Screenshot', 'Video', 'Retest'], details: ['Evidence dikelompokkan per milestone', 'Video full flow 30 FPS 720p', 'Defect diperbaiki dan diverifikasi ulang'], evidenceIds: flowSource === 'zannora' ? ['api-e2e', 'crud', 'roles', 'full-flow', 'navigation', 'responsive', 'quality'] : ['target-quality'], target: 'evidence', x: 38, y: 78 },
      { id: 'final-report', eyebrow: 'PHASE 08', title: 'Defect & Final Report', description: 'Triage defect, status akhir, dan kesimpulan QC', icon: 'reports', color: 'violet', status: finalStatus, count: finalStatus === 'CLEAR' ? 'Final ready' : finalStatus === 'ATTENTION' ? 'Review needed' : 'Waiting', items: ['Defect', 'Report', 'Summary'], details: ['Severity critical/high/medium/low', 'Final milestone summary', 'Laporan siap diunduh atau dibagikan'], evidenceIds: flowSource === 'zannora' ? ['api-e2e', 'crud', 'roles', 'full-flow', 'navigation', 'responsive', 'quality'] : ['target-quality'], target: 'reports', x: 12, y: 78 },
    ];
    return nodes.map((node) => {
      if (!flowEvidence) return node;
      if (flowSource === 'job' && node.id === 'test-design') return { ...node, count: `${flowJob?.flows?.length ?? 0} flows` };
      if (flowSource === 'job' && node.id === 'execution') return node;
      if (node.id === 'test-design') return { ...node, count: `${zannoraDesignGroups.reduce((total, group) => total + evidenceMetric(group).total, 0)} checks · ${zannoraDesignGroups.length} suites` };
      if (node.id === 'execution') { const fullFlow = groups.get('full-flow'); return { ...node, count: fullFlow ? `${evidenceMetric(fullFlow).passed}/${evidenceMetric(fullFlow).total} full-flow` : node.count }; }
      if (node.id === 'responsive-quality') { const quality = groups.get('quality') || groups.get('responsive') || groups.get('target-quality'); return { ...node, count: quality ? `${evidenceMetric(quality).passed}/${evidenceMetric(quality).total} checks` : node.count }; }
      return node;
    });
  }, [flowEvidence, flowJob, flowSource, zannoraDesignGroups]);

  const processProgress = useMemo(() => Math.round((processNodes.filter((node) => node.status === 'CLEAR' || node.status === 'ATTENTION').length / Math.max(1, processNodes.length)) * 100), [processNodes]);
  const centralProcessStatus: MilestoneStatus = flowJob?.status === 'RUNNING' || flowJob?.status === 'QUEUED' || flowJob?.status === 'WAITING_REVIEW' ? 'RUNNING' : processNodes.some((node) => node.status === 'BLOCKED') ? 'BLOCKED' : processNodes.some((node) => node.status === 'ATTENTION' || node.status === 'RETEST') ? 'ATTENTION' : processProgress === 100 ? 'CLEAR' : 'READY';
  const openEvidenceGroup = (groupId: string) => {
    setEvidenceGroupFilter('all');
    setEvidenceFocus({ groupId });
    setSelectedMilestone(null);
    setCurrentView('evidence');
  };

  const updateFindingStatus = async (finding: EvidenceFinding & { findingIndex?: number }, status: FindingWorkflowStatus) => {
    if (flowSource !== 'job' || !activeJobId) return;
    const key = findingKey(finding, finding.findingIndex ?? 0);
    setLoading(true);
    setActionError('');
    try {
      const updated = await send<Job>(`/api/v1/discovery/jobs/${activeJobId}/findings/status`, { findingKey: key, status }, 'PATCH');
      setActiveJob(updated);
      setFindingStatuses(updated.findingStatuses ?? {});
      setActionSuccess(`Finding dipindahkan ke ${status.replace('_', ' ')}.`);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setLoading(false);
    }
  };

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

  const handleApproveBusinessFlows = async () => {
    if (!activeJobId) return;
    setLoading(true);
    setActionError('');
    try {
      const updated = await send<Job>(`/api/v1/discovery/jobs/${activeJobId}/business-flows/approve`, {}, 'POST');
      setActiveJob(updated);
      setActionSuccess('Seluruh Business Flow disetujui! Eksekusi Playwright E2E & perekaman video dimulai...');
      setTimeout(() => setActionSuccess(''), 4000);
      if (updated.status !== 'RUNNING') {
        try {
          await send<Job>(`/api/v1/discovery/jobs/${activeJobId}/run`, {}, 'POST');
        } catch (runErr) {
          console.warn('Run flows trigger notice:', runErr);
        }
      }
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setLoading(false);
    }
  };


  const handleUpdateBusinessFlow = async (flowId: string, patch: Record<string, unknown>) => {
    if (!activeJobId) return;
    setLoading(true);
    setActionError('');
    try {
      const updated = await send<Job>(`/api/v1/discovery/jobs/${activeJobId}/business-flows/${flowId}`, patch, 'PUT');
      setActiveJob(updated);
      if (patch.status === 'APPROVED') {
        const remaining = updated.businessFlowMap?.flows.filter(f => f.status !== 'APPROVED').length ?? 0;
        if (remaining === 0) {
          setActionSuccess('Seluruh business flow telah disetujui. Melanjutkan proses eksekusi di terminal...');
          setCurrentView('discovery');
        } else {
          setActionSuccess(`Alur berhasil disetujui (${remaining} alur tersisa).`);
        }
      } else if (patch.status === 'NEEDS_REVIEW') {
        setActionSuccess('Persetujuan alur dibatalkan.');
      } else {
        setActionSuccess('Business flow diperbarui.');
      }
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRunQualityAudit = async () => {
    if (!activeJobId) return;
    const password = window.prompt('Masukkan password akun untuk Quality Audit. Password tidak disimpan ke job.');
    if (!password) return;
    setLoading(true);
    setActionError('');
    try {
      const updated = await send<Job>(`/api/v1/discovery/jobs/${activeJobId}/quality-audit`, { password }, 'POST');
      setActiveJob(updated);
      setCurrentView('discovery');
      setActionSuccess('Quality Audit dimulai. Pantau kategori QUALITY pada Runtime Log.');
      setTimeout(() => setActionSuccess(''), 4000);
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
      setFlowSource('job');
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
    if (terminalBodyRef.current) {
      if (smooth) {
        terminalBodyRef.current.scrollTo({ top: terminalBodyRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    if (currentView === 'discovery') {
      const timer = setTimeout(() => {
        scrollToBottom(false);
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [currentView, filteredLogs.length, activeJob?.progress, activeJob?.phase, scrollToBottom]);

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

  if (!authToken) {
    return <AdminLoginView onLoginSuccess={(token, user) => {
      setAuthToken(token);
      setAdminUser(user);
    }} />;
  }

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
          title="Mulai Skenario Quality Control Baru"
        >
          <Icon name="plus" size={16} />
          <span>New QC Run</span>
        </button>

        <div className="nav-menu">
          <ProjectSwitcher
            jobs={jobs}
            activeJobId={activeJobId}
            activeJob={activeJob}
            flowSource={flowSource}
            onSelectJob={(jobId) => {
              setFlowSource('job');
              setActiveJobId(jobId);
              setSelectedMilestone(null);
            }}
            onSelectZannora={() => {
              setFlowSource('zannora');
              setSelectedMilestone(null);
            }}
            onNewJob={() => {
              setCurrentView('new');
            }}
          />

          <div className="nav-section-title">MENU UTAMA</div>
          <button className={`nav-item ${currentView === 'overview' ? 'active' : ''}`} onClick={() => setCurrentView('overview')}>
            <div className="nav-item-left"><Icon name="overview" size={18} /><span>Project Summary</span></div>
          </button>
          <button className={`nav-item ${currentView === 'discovery' ? 'active' : ''}`} onClick={() => setCurrentView('discovery')}>
            <div className="nav-item-left"><Icon name="terminal" size={18} /><span>Live Terminal</span></div>
            {activeJob?.status === 'RUNNING' ? (
              <span className="nav-badge nav-badge-running" title="Terminal sedang berjalan">
                <span className="pulsing-green-dot" />
                <span>LIVE</span>
              </span>
            ) : (
              <span className="nav-badge">{activeJob?.logs?.length ?? 0}</span>
            )}
          </button>
          <button className={`nav-item ${currentView === 'map' ? 'active' : ''}`} onClick={() => setCurrentView('map')}>
            <div className="nav-item-left"><Icon name="map" size={18} /><span>App Map &amp; Halaman</span></div>
            <span className="nav-badge">{activeJob?.inventory?.pages.length ?? 0}</span>
          </button>
          <button className={`nav-item ${currentView === 'flows' ? 'active' : ''}`} onClick={() => { setCurrentView('flows'); if (activeJob) setFlowSource('job'); }}>
            <div className="nav-item-left">
              <Icon name="flows" size={18} />
              <span>Skenario Test</span>
              {hasFlowsToApprove && (
                <span className="pulsing-green-dot" title="Skenario siap diapprove" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', marginLeft: 6 }} />
              )}
            </div>
            {hasFlowsToApprove ? (
              <span className="nav-badge" style={{ background: '#10B981', color: '#042F1A', fontWeight: 800, fontSize: 10, padding: '2px 8px', borderRadius: 999 }}>
                APPROVE
              </span>
            ) : (
              <span className="nav-badge">{activeJob?.flows?.length ?? (activeJob?.businessFlowMap?.flows?.length ?? 0)}</span>
            )}
          </button>
          <button className={`nav-item ${currentView === 'runs' ? 'active' : ''}`} onClick={() => setCurrentView('runs')}>
            <div className="nav-item-left"><Icon name="runs" size={18} /><span>Execution Runs</span></div>
            <span className="nav-badge">{(activeJob?.results?.length || runHistory.length) ?? 0}</span>
          </button>
          <button className={`nav-item ${currentView === 'evidence' ? 'active' : ''}`} onClick={() => { setCurrentView('evidence'); void refreshTargetEvidence(activeJobId); }}>
            <div className="nav-item-left"><Icon name="reports" size={18} /><span>Media</span></div>
            <span className="nav-badge">{activeEvidence?.totals.assets ?? (activeJob?.results?.length ? 'Live' : 0)}</span>
          </button>
          <button className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => setCurrentView('reports')}>
            <div className="nav-item-left"><Icon name="shield" size={18} /><span>Laporan Final</span></div>
            <span className="nav-badge">{activeEvidence?.totals.passed ?? 0}</span>
          </button>
        </div>

        {/* BOTTOM LEFT: ADMIN ACCOUNT */}
        <div className="sidebar-footer" style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: 'rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
              color: '#ffffff', fontWeight: 800, display: 'grid', placeItems: 'center', fontSize: 12,
              flexShrink: 0
            }}>
              A
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {adminUser?.email || 'admin@qcmaestro.com'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Administrator</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAuthSession();
              setAuthToken(null);
              setAdminUser(null);
            }}
            className="quiet danger-text"
            style={{
              fontSize: '0.74rem',
              padding: '4px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              background: 'rgba(239, 68, 68, 0.08)',
              flexShrink: 0
            }}
            title="Keluar dari sesi Admin"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-breadcrumbs">
              <span className="crumb-root">
                <span>Workspace</span>
              </span>
              <span className="crumb-sep">/</span>
              <span className="crumb-view">
                {currentView === 'overview' ? 'Project Summary' :
                 currentView === 'discovery' ? 'Live Terminal' :
                 currentView === 'map' ? 'App Map' :
                 currentView === 'flows' ? 'Skenario Test' :
                 currentView === 'runs' ? 'Execution Runs' :
                 currentView === 'evidence' ? 'Media' :
                 currentView === 'reports' ? 'Final Report' :
                 currentView === 'new' ? 'New QC Run' : 'Workspace'}
              </span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Live Terminal & Theme toggle buttons removed as requested */}
          </div>
        </header>

        {/* WORKSPACE VIEWS */}
        <main className="workspace-view">
          {actionError && <Notice error>{actionError}</Notice>}
          {actionSuccess && <Notice>{actionSuccess}</Notice>}

          {/* VIEW: OVERVIEW (PROJECT SUMMARY) */}
          {currentView === 'overview' && (
            flowSource === 'zannora' && zannoraEvidence ? (
              <ZannoraOverview evidence={zannoraEvidence} onNavigate={setCurrentView} onOpenEvidence={openEvidenceGroup} />
            ) : (
              <div className="summary-dashboard-container">
                {/* 1. Single Hero Header: Identitas & Status Utama Target */}
                <div className="summary-hero-header">
                  <div className="hero-left">
                    <div className="hero-target-row">
                      <div className="hero-platform-badge">
                        <Icon name={activeJob?.config?.platform === 'android' ? 'android' : 'globe'} size={12} />
                        <span>{(activeJob?.config?.platform || 'web').toUpperCase()}</span>
                      </div>
                      <h1 className="hero-title">{activeJob?.name || 'Project Summary'}</h1>
                      <span className={`hero-status-pill status-${(activeJob?.status || 'ready').toLowerCase()}`}>
                        <span className="led-dot" />
                        <span>{(activeJob?.status || 'READY').replace(/_/g, ' ')}</span>
                      </span>
                    </div>
                    <div className="hero-meta-row">
                      <span className="hero-meta-item">
                        <Icon name="globe" size={13} />
                        <code>{activeJob?.config?.baseUrl || activeJob?.config?.appId || 'http://localhost:5174'}</code>
                      </span>
                      <span className="hero-meta-sep">â€¢</span>
                      <span className="hero-meta-item">
                        Mode: <strong>{activeJob?.config?.runMode || 'existing-target'}</strong>
                      </span>
                      <span className="hero-meta-sep">â€¢</span>
                      <span className="hero-meta-item">
                        Diuji: <strong>{date(activeJob?.createdAt || '')}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="hero-right">
                    <div className="hero-telemetry-stamp">
                      <div className="telemetry-stamp-label">ENVIRONMENT AUDIT</div>
                      <div className="telemetry-stamp-val">
                        <span className="led-dot" />
                        <span>TARGET VERIFIED</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Executive KPI Metrics: 4 Metrik Tunggal Berkarakter Linear */}
                <div className="summary-kpis">
                  <div className="summary-kpi-card" onClick={() => setCurrentView('map')} role="button" tabIndex={0} title="Buka App Map & Struktur Halaman">
                    <div className="kpi-top">
                      <span className="kpi-label">01 // CAKUPAN HALAMAN</span>
                      <div className="kpi-icon-wrap">
                        <Icon name="map" size={15} />
                      </div>
                    </div>
                    <span className="kpi-val tabular-nums">{stats.pagesCount}</span>
                    <div className="kpi-sub-row">
                      <span className="kpi-sub">{activeJob?.inventory?.routes?.length ?? stats.pagesCount} route terpetakan</span>
                      <span className="kpi-jump-arrow"><Icon name="arrow" size={12} /></span>
                    </div>
                  </div>

                  <div className="summary-kpi-card" onClick={() => setCurrentView('map')} role="button" tabIndex={0} title="Buka Detail Komponen Interaktif">
                    <div className="kpi-top">
                      <span className="kpi-label">02 // ELEMEN INTERAKTIF</span>
                      <div className="kpi-icon-wrap">
                        <Icon name="discovery" size={15} />
                      </div>
                    </div>
                    <span className="kpi-val tabular-nums">{stats.elementsCount}</span>
                    <div className="kpi-sub-row">
                      <span className="kpi-sub">Form, button, input &amp; navigasi</span>
                      <span className="kpi-jump-arrow"><Icon name="arrow" size={12} /></span>
                    </div>
                  </div>

                  <div className="summary-kpi-card" onClick={() => setCurrentView('flows')} role="button" tabIndex={0} title="Buka Skenario Regresi & Flow">
                    <div className="kpi-top">
                      <span className="kpi-label">03 // SKENARIO REGRESI</span>
                      <div className="kpi-icon-wrap">
                        <Icon name="flows" size={15} />
                      </div>
                    </div>
                    <span className="kpi-val tabular-nums">{stats.flowsCount}</span>
                    <div className="kpi-sub-row">
                      <span className="kpi-sub">Playwright &amp; Maestro otomatis</span>
                      <span className="kpi-jump-arrow"><Icon name="arrow" size={12} /></span>
                    </div>
                  </div>

                  <div className="summary-kpi-card" onClick={() => setCurrentView('runs')} role="button" tabIndex={0} title="Buka Histori & Status Run">
                    <div className="kpi-top">
                      <span className="kpi-label">04 // TINGKAT KELULUSAN</span>
                      <div className="kpi-icon-wrap">
                        <Icon name="runs" size={15} />
                      </div>
                    </div>
                    {(() => {
                      const ev = activeEvidence?.totals;
                      const evTotal = ev ? ev.passed + ev.failed : 0;
                      const total = stats.totalRuns || evTotal;
                      const passed = stats.totalRuns ? stats.passedCount : (ev?.passed ?? 0);
                      const failed = stats.totalRuns ? stats.failedCount : (ev?.failed ?? 0);
                      const unit = stats.totalRuns ? 'run' : 'suite';
                      return (
                        <>
                          <span className="kpi-val tabular-nums">
                            {total ? `${Math.round((passed / total) * 100)}%` : 'N/A'}
                          </span>
                          <div className="kpi-sub-row">
                            <span className="kpi-sub">{total ? `${passed} lulus · ${failed} gagal (${unit})` : 'Belum ada eksekusi atau bukti uji'}</span>
                            <span className="kpi-jump-arrow"><Icon name="arrow" size={12} /></span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* 3. Sleek Engine Telemetry Readout */}
                {activeJob && (
                  <div className="summary-engine-bar">
                    <div className="engine-log-strip">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-msg">
                        {activeJob.message || 'Engine QC Maestro siap menjalankan penjelajahan dan eksekusi uji otomatis.'}
                      </span>
                      <span className="engine-telemetry-status">
                        <span className="led-dot" />
                        <span>{activeJob.progress >= 100 ? 'System Ready' : `${activeJob.progress}% Active`}</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. Split 2-Column QA View: Direktori Seluruh Navigasi Modul & Spesifikasi Target */}
                <div className="summary-split-grid">
                  {/* Panel Kiri: Direktori Seluruh Navigasi Proyek (Menggantikan Kapabilitas Terbatas) */}
                  <div className="summary-split-panel">
                    <div className="split-panel-header">
                      <div className="split-panel-title-group">
                        <Icon name="overview" size={15} />
                        <h2 className="split-panel-title">Direktori Modul &amp; Status Navigasi</h2>
                        <span className="split-count-pill tabular-nums">6 MODUL</span>
                      </div>
                    </div>

                    <div className="nav-modules-directory">
                      {[
                        {
                          id: 'discovery',
                          num: '01',
                          icon: 'terminal',
                          title: 'Live Terminal',
                          badge: `${activeJob?.logs?.length ?? 0} LOGS`,
                          status: activeJob?.status === 'RUNNING' ? 'STREAMING' : 'READY',
                          statusTone: activeJob?.status === 'RUNNING' ? 'running' : 'ready',
                          desc: 'Stream telemetri runtime worker, event log Playwright/Maestro langsung',
                          onClick: () => setCurrentView('discovery'),
                        },
                        {
                          id: 'map',
                          num: '02',
                          icon: 'map',
                          title: 'App Map & Halaman',
                          badge: `${stats.pagesCount} HALAMAN · ${activeJob?.inventory?.routes?.length ?? stats.pagesCount} RUTE`,
                          status: stats.pagesCount > 0 ? 'MAPPED' : 'EMPTY',
                          statusTone: stats.pagesCount > 0 ? 'passed' : 'ready',
                          desc: 'Topologi struktur rute navigasi, pohon layout & inventaris elemen interaktif',
                          onClick: () => setCurrentView('map'),
                        },
                        {
                          id: 'flows',
                          num: '03',
                          icon: 'flows',
                          title: 'Skenario Test',
                          badge: `${stats.flowsCount} SKENARIO`,
                          status: stats.flowsCount > 0 ? 'COMPILED' : 'DRAFT',
                          statusTone: stats.flowsCount > 0 ? 'passed' : 'ready',
                          desc: 'Kompilasi skrip regresi otomatis E2E, alur autentikasi & validasi business journey',
                          onClick: () => setCurrentView('flows'),
                        },
                        {
                          id: 'runs',
                          num: '04',
                          icon: 'runs',
                          title: 'Execution Runs',
                          badge: stats.totalRuns > 0 ? `${stats.passedCount} PASS / ${stats.failedCount} FAIL` : '0 RUNS',
                          status: stats.totalRuns > 0 ? (stats.failedCount === 0 ? 'PASSED' : 'ATTENTION') : 'QUEUED',
                          statusTone: stats.totalRuns > 0 ? (stats.failedCount === 0 ? 'passed' : 'attention') : 'ready',
                          desc: 'Riwayat assertion eksekusi pengujian, duration benchmark & laporan kelulusan',
                          onClick: () => setCurrentView('runs'),
                        },
                        {
                          id: 'evidence',
                          num: '05',
                          icon: 'reports',
                          title: 'Media & Bukti Visual',
                          badge: `${activeEvidence?.totals.assets ?? (activeJob?.results?.length ? 'Live' : 0)} MEDIA`,
                          status: (activeEvidence?.totals.assets ?? 0) > 0 ? 'RECORDED' : 'READY',
                          statusTone: (activeEvidence?.totals.assets ?? 0) > 0 ? 'passed' : 'ready',
                          desc: 'Tangkapan layar hasil inspeksi visual, snapshot DOM & rekaman video defect',
                          onClick: () => { setCurrentView('evidence'); void refreshTargetEvidence(activeJobId); },
                        },
                        {
                          id: 'reports',
                          num: '06',
                          icon: 'shield',
                          title: 'Laporan Final',
                          badge: `${activeEvidence?.totals.passed ?? 0} AUDIT PASSED`,
                          status: (activeEvidence?.totals.passed ?? 0) > 0 ? 'CERTIFIED' : 'READY',
                          statusTone: (activeEvidence?.totals.passed ?? 0) > 0 ? 'passed' : 'ready',
                          desc: 'Dokumen sertifikasi mutu akhir, rekapitulasi temuan defect & status rilis',
                          onClick: () => setCurrentView('reports'),
                        },
                      ].map((mod) => (
                        <div
                          key={mod.id}
                          className="nav-module-row"
                          onClick={mod.onClick}
                          role="button"
                          tabIndex={0}
                          title={`Buka modul ${mod.title}`}
                        >
                          <span className="nav-module-num tabular-nums">{mod.num}</span>
                          <div className="nav-module-icon">
                            <Icon name={mod.icon} size={15} />
                          </div>
                          <div className="nav-module-body">
                            <div className="nav-module-heading">
                              <span className="nav-module-title">{mod.title}</span>
                              <span className="nav-module-badge tabular-nums">{mod.badge}</span>
                            </div>
                            <p className="nav-module-desc">{mod.desc}</p>
                          </div>
                          <div className="nav-module-action">
                            <span className={`nav-module-status status-${mod.statusTone}`}>
                              <span className="led-dot" />
                              <span>{mod.status}</span>
                            </span>
                            <span className="nav-module-arrow">
                              <Icon name="arrow" size={13} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <span className="split-panel-info-note">
                      Klik modul untuk langsung bernavigasi ke halaman detail dalam proyek ini.
                    </span>
                  </div>

                  {/* Panel Kanan: Spesifikasi & Telemetri Lingkungan Target */}
                  <div className="summary-split-panel">
                    <div className="split-panel-header">
                      <div className="split-panel-title-group">
                        <Icon name="terminal" size={15} />
                        <h2 className="split-panel-title">Spesifikasi &amp; Lingkungan Target</h2>
                        <span className="split-count-pill">SPEC TEKNIS</span>
                      </div>
                    </div>

                    <div className="summary-spec-list">
                      <div className="summary-spec-row">
                        <span className="summary-spec-key">Runner Engine</span>
                        <span className="summary-spec-val">
                          {activeJob?.config?.platform === 'android' ? 'Maestro Mobile Engine' : 'Playwright Chromium Runner'}
                        </span>
                      </div>

                      <div className="summary-spec-row">
                        <span className="summary-spec-key">Target Host / ID</span>
                        <span className="summary-spec-val">
                          <code>{activeJob?.config?.baseUrl || activeJob?.config?.appId || (activeJob?.config?.platform === 'android' ? 'com.taskia.digital' : 'http://localhost:5174')}</code>
                        </span>
                      </div>

                      <div className="summary-spec-row">
                        <span className="summary-spec-key">Arsitektur Pengujian</span>
                        <span className="summary-spec-val">
                          Autonomous E2E &amp; Regresi
                        </span>
                      </div>

                      <div className="summary-spec-row">
                        <span className="summary-spec-key">Struktur Halaman</span>
                        <span className="summary-spec-val tabular-nums">
                          {stats.pagesCount} Halaman ({activeJob?.inventory?.routes?.length ?? stats.pagesCount} rute terpetakan)
                        </span>
                      </div>

                      <div className="summary-spec-row">
                        <span className="summary-spec-key">Komponen Terpantau</span>
                        <span className="summary-spec-val tabular-nums">
                          {stats.elementsCount} Elemen (Form, Tombol, Field)
                        </span>
                      </div>

                      <div className="summary-spec-row">
                        <span className="summary-spec-key">Status Jaminan Mutu</span>
                        <span className="summary-spec-val">
                          {stats.totalRuns ? (
                            <span style={{ color: '#15803D' }}>{Math.round((stats.passedCount / stats.totalRuns) * 100)}% Lulus ({stats.passedCount}/{stats.totalRuns})</span>
                          ) : (
                            <span style={{ color: '#14181D' }}>Siap Eksekusi Regresi</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <span className="split-panel-info-note">
                      Konfigurasi target tersinkronisasi otomatis dengan worker QC Maestro.
                    </span>
                  </div>
                </div>
              </div>
            )
          )}

          {/* VIEW: QC PROCESS MAP */}
          {currentView === 'process' && (
            <div>
              <MilestoneFlow nodes={processNodes} progress={processProgress} centralStatus={centralProcessStatus} sourceLabel={flowSourceLabel} isLive={Boolean(flowJob && (flowJob.status === 'RUNNING' || flowJob.status === 'QUEUED' || flowJob.status === 'WAITING_REVIEW'))} selectedNodeId={selectedMilestone?.id || null} onSelect={setSelectedMilestone} onNavigate={setCurrentView} />
              {selectedMilestone && (
                <div className="milestone-floating-layer">
                  <button className="milestone-floating-backdrop" aria-label="Tutup detail milestone" onClick={() => setSelectedMilestone(null)} />
                  <MilestoneDetails node={selectedMilestone} activeJob={flowJob} evidence={flowEvidence} onClose={() => setSelectedMilestone(null)} onNavigate={setCurrentView} onOpenEvidenceGroup={openEvidenceGroup} />
                </div>
              )}
              <div className="milestone-status-strip">
                <div><span className="milestone-status-dot clear" /><strong>{processNodes.filter((node) => node.status === 'CLEAR').length} clear</strong><small>milestone selesai tanpa temuan</small></div>
                <div><span className="milestone-status-dot running" /><strong>{processNodes.filter((node) => node.status === 'RUNNING').length} berjalan</strong><small>{activeJob?.phase?.replace(/_/g, ' ') || 'Tidak ada run aktif'}</small></div>
                <div><span className="milestone-status-dot attention" /><strong>{processNodes.filter((node) => node.status === 'ATTENTION' || node.status === 'RETEST').length} perlu tindak lanjut</strong><small>lihat findings dan retest</small></div>
              </div>
            </div>
          )}

          {/* VIEW: NEW DISCOVERY WIZARD */}
          {currentView === 'new' && (
            <div>
              <Wizard
                system={system}
                initialJob={editingJob}
                onCancelEdit={editingJob ? () => { setEditingJob(null); setCurrentView('projects'); } : undefined}
                onCreated={(newJob) => {
                  setEditingJob(null);
                  setActiveJobId(newJob.id);
                  setCurrentView('process');
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
                <Paginated items={jobs}>{(visibleJobs) => visibleJobs.map(j => (
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
                ))}</Paginated>
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
                  {(activeJob?.status === 'RUNNING' || activeJob?.status === 'WAITING_REVIEW') && (
                    <button className="quiet" style={{ color: 'var(--red)', borderColor: 'rgba(255, 107, 122, 0.4)' }} onClick={handleCancelJob}>
                      Batalkan Discovery
                    </button>
                  )}
                </div>
              </div>

              {flowSource === 'zannora' && zannoraEvidence ? (
                <ZannoraDiscovery evidence={zannoraEvidence} onOpenEvidence={openEvidenceGroup} />
              ) : !activeJob ? (
                <Empty title="Tidak Ada Job Terpilih">Pilih project atau buat discovery baru.</Empty>
              ) : (
                <>
                  {/* TOP: Horizontal Milestone Pipeline & Failure Diagnostics */}
                  {(() => {
                    const isMobile = activeJob.config?.platform === 'android';
                    const isExisting = activeJob.config?.runMode === 'existing-target';
                    const hasDb = activeJob.config?.database?.engine !== 'none';

                    const mobileStages = [
                      { title: '1. Project & Source Init', desc: `${activeJob.config?.repositoryUrl?.startsWith('http') ? 'Git clone' : 'Direktori lokal'} — deteksi framework mobile` },
                      { title: '2. Static Code Scan', desc: 'Scan file .dart / .kt / .java — temukan Screen & Route' },
                      { title: '3. Pemetaan Layar', desc: `Deteksi ${activeJob.inventory?.pages?.length ?? '?'} layar & form input` },
                      { title: '4. Skenario Maestro YAML', desc: 'Generate flow: login, navigasi, dan smoke check' },
                      { title: '5. Eksekusi Test & Laporan', desc: activeJob.config?.executeFlows ? 'Jalankan di perangkat ADB' : 'Siap untuk review' },
                    ];

                    const webStages = [
                      { title: '1. Runtime & Project Init', desc: isExisting ? `Target: ${activeJob.config?.baseUrl}` : `Workspace preparation (${activeJob.config?.stack ?? 'auto'})` },
                      { title: '2. Database Bootstrap', desc: hasDb ? `Container ${activeJob.config?.database?.engine} — isolasi data test` : 'Tidak ada database' },
                      { title: '3. Static Source Code Scan', desc: 'Scan controllers, route, form, komponen' },
                      { title: '4. Dynamic Playwright Crawl', desc: `Observasi DOM & selector — max ${activeJob.config?.rules?.maxPages ?? '?'} halaman` },
                      { title: '5. Flow Synthesis & Laporan', desc: activeJob.config?.executeFlows ? 'Sintesis spec Playwright & skenario' : 'Sintesis alur — siap untuk review queue' },
                      ...(activeJob.config?.qualityAudit?.enabled !== false ? [{ title: '6. Quality Audit & Evidence', desc: `${activeJob.config?.qualityAudit?.browsers?.join(', ') || 'chromium'} · ${activeJob.config?.qualityAudit?.viewports?.join(', ') || 'multi-viewport'} · screenshot & report` }] : []),
                    ];

                    const stages = isMobile ? mobileStages : webStages;
                    const isJobFailed = activeJob.status === 'FAILED' || activeJob.status === 'INFRA_ERROR';
                    const isRunning = activeJob.status === 'RUNNING' || activeJob.status === 'WAITING_REVIEW';
                    const isCompleted = activeJob.status === 'COMPLETED';
                    const statusTagClass = isJobFailed ? 'failed' : isRunning ? 'running' : isCompleted ? 'completed' : 'pending';

                    // Deteksi tahap yang gagal jika isJobFailed
                    let failedStepIdx = 0;
                    if (isJobFailed) {
                      const errLow = failureErrorText.toLowerCase();
                      const phaseLow = (activeJob.phase || '').toLowerCase();
                      if (errLow.includes('quality') || phaseLow.includes('quality')) {
                        failedStepIdx = stages.length - 1;
                      } else if (errLow.includes('flow') || errLow.includes('synthes') || phaseLow.includes('flow')) {
                        failedStepIdx = 4;
                      } else if (errLow.includes('crawl') || errLow.includes('playwright') || phaseLow.includes('crawl')) {
                        failedStepIdx = 3;
                      } else if (errLow.includes('static') || errLow.includes('ast') || phaseLow.includes('static')) {
                        failedStepIdx = 2;
                      } else if (errLow.includes('database') || errLow.includes('sql') || errLow.includes('mysql') || errLow.includes('postgres') || phaseLow.includes('database')) {
                        failedStepIdx = 1;
                      } else if (errLow.includes('runtime') || errLow.includes('install') || errLow.includes('node') || errLow.includes('package') || errLow.includes('npm') || phaseLow.includes('runtime') || phaseLow.includes('preparing')) {
                        failedStepIdx = 0;
                      } else {
                        const stepSize = 100 / stages.length;
                        failedStepIdx = Math.min(stages.length - 1, Math.max(0, Math.floor((activeJob.progress || 0) / stepSize)));
                      }
                    }

                    const failedStepStageTitle = stages[failedStepIdx]?.title || 'Inisialisasi Lingkungan';

                    return (
                      <>
                        <div className="horizontal-milestone-panel">
                          <div className="horizontal-milestone-header">
                            <div className="hm-header-left">
                              <div className="hm-header-icon">
                                <Icon name="discovery" size={17} />
                              </div>
                              <div>
                                <h3 className="hm-panel-title">Discovery Pipeline Milestones</h3>
                                <span className="hm-panel-sub">Tahapan eksekusi inisialisasi lingkungan, static scan, dynamic crawl, dan sintesis alur bisnis</span>
                              </div>
                            </div>
                            <div className="hm-header-right">
                              <div className="hm-platform-pill">
                                <Icon name={isMobile ? 'android' : 'globe'} size={13} />
                                <span>{isMobile ? 'Target Android / Flutter' : 'Target Web Application'}</span>
                              </div>
                              <span className={`hm-status-tag ${statusTagClass}`}>
                                [{activeJob.status}] · {activeJob.progress}%
                              </span>
                            </div>
                          </div>

                          <div className="horizontal-pipeline-body">
                            {/* Background Track Line with Smooth Standard Flowing Beam */}
                            <div className="pipeline-track-line">
                              <div
                                className={`pipeline-progress-fill ${isJobFailed ? 'failed' : ''}`}
                                style={{
                                  width: isJobFailed
                                    ? `${Math.max(14, Math.min(100, (failedStepIdx + 1) * (100 / stages.length)))}%`
                                    : `${Math.min(100, Math.max(0, activeJob.progress))}%`
                                }}
                              />
                              {!isJobFailed && isRunning && <div className="pipeline-flow-beam" />}
                            </div>

                            {/* Evenly Spaced Step Nodes */}
                            <div className="pipeline-nodes-container">
                              {stages.map((stepItem, idx) => {
                                const stepSize = 100 / stages.length;
                                let statusClass = 'pending';
                                let isDone = false;
                                let isCurrent = false;
                                let isFailed = false;

                                if (isJobFailed) {
                                  if (idx < failedStepIdx) {
                                    statusClass = 'done';
                                    isDone = true;
                                  } else if (idx === failedStepIdx) {
                                    statusClass = 'failed';
                                    isFailed = true;
                                  } else {
                                    statusClass = 'pending';
                                  }
                                } else {
                                  isDone = activeJob.status === 'COMPLETED' || activeJob.progress > (idx + 1) * stepSize;
                                  isCurrent = (activeJob.status === 'RUNNING' || activeJob.status === 'WAITING_REVIEW') && activeJob.progress >= idx * stepSize && activeJob.progress <= (idx + 1) * stepSize;
                                  statusClass = isDone ? 'done' : isCurrent ? 'current' : 'pending';
                                }

                                return (
                                  <div key={idx} className={`pipeline-step-node ${statusClass}`}>
                                    <div className="pipeline-step-circle-wrap">
                                      <div className="pipeline-step-circle">
                                        {isFailed ? (
                                          <Icon name="close" size={16} />
                                        ) : isDone ? (
                                          <Icon name="check" size={14} />
                                        ) : (
                                          <span>{idx + 1}</span>
                                        )}
                                        {isCurrent && <span className="pipeline-circle-spinner-ring" />}
                                        {isFailed && <span className="pipeline-circle-failed-ring" />}
                                      </div>
                                    </div>
                                    <div className="pipeline-step-label-card">
                                      <h4 className="pipeline-step-title">{stepItem.title}</h4>
                                      <p className="pipeline-step-desc">{stepItem.desc}</p>
                                      {isCurrent && (
                                        <div className="pipeline-step-active-tag">
                                          <span className="terminal-spinner" style={{ width: 8, height: 8, borderWidth: 1.5 }} />
                                          <span>Sedang Memproses...</span>
                                        </div>
                                      )}
                                      {isFailed && (
                                        <div className="pipeline-step-failed-tag">
                                          <Icon name="warning" size={10} />
                                          <span>Gagal di Tahap Ini</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* DIAGNOSTIK KEGAGALAN SISTEM — JELAS, TRANSPARAN, TIDAK MENGGANTUNG */}
                        {isJobFailed && (
                          <div className="discovery-failure-diagnostic-panel">
                            <div className="dfp-header">
                              <div className="dfp-title-group">
                                <div className="dfp-badge-icon">
                                  <Icon name="warning" size={24} />
                                </div>
                                <div>
                                  <h3 className="dfp-title">
                                    <span>Eksekusi Terhenti — Gagal di {failedStepStageTitle}</span>
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#DC2626', color: '#FFFFFF', fontWeight: 850 }}>
                                      STATUS: {activeJob.status}
                                    </span>
                                  </h3>
                                  <p className="dfp-subtitle">
                                    Proses discovery otomatis tidak dapat diselesaikan karena terjadi kendala teknis pada tahapan di atas. Berikut rincian log kesalahan sistem dan rekomendasi penanganan konkret:
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Rincian Pesan Error */}
                            <div className="dfp-error-box">
                              <div className="dfp-error-box-header">
                                <span className="dfp-error-label">
                                  <Icon name="terminal" size={12} />
                                  <span>Rincian Kesalahan Runner / Traceback:</span>
                                </span>
                                <button
                                  type="button"
                                  className="dfp-copy-btn"
                                  onClick={() => {
                                    navigator.clipboard.writeText(failureErrorText);
                                    setActionSuccess('Pesan error disalin ke clipboard!');
                                    setTimeout(() => setActionSuccess(''), 2500);
                                  }}
                                  title="Salin Pesan Error"
                                >
                                  <Icon name="copy" size={12} /> Salin Error
                                </button>
                              </div>
                              <pre className="dfp-error-text">{failureErrorText}</pre>
                            </div>

                            {/* Rekomendasi Solusi */}
                            <div className="dfp-recommendation-box">
                              <div className="dfp-rec-icon">
                                <Icon name="zap" size={18} />
                              </div>
                              <div>
                                <strong style={{ fontSize: 12.5, color: '#92400E', display: 'block', marginBottom: 2 }}>
                                  Rekomendasi Langkah Penyelesaian:
                                </strong>
                                <p className="dfp-rec-text">{failureRecommendation}</p>
                              </div>
                            </div>

                            {/* Tombol Aksi Nyata */}
                            <div className="dfp-actions">
                              <button
                                type="button"
                                className="dfp-btn-retry"
                                onClick={() => handleRestartJob(activeJob.id)}
                                disabled={loading}
                              >
                                <Icon name="refresh" size={14} />
                                <span>{loading ? 'Memulai Ulang...' : 'Jalankan Ulang (Retry Discovery)'}</span>
                              </button>

                              <button
                                type="button"
                                className="dfp-btn-edit"
                                onClick={() => handleEditJob(activeJob)}
                              >
                                <Icon name="settings" size={14} />
                                <span>Ubah Konfigurasi Proyek (Buka Wizard)</span>
                              </button>

                              <button
                                type="button"
                                className="dfp-btn-scroll"
                                onClick={() => {
                                  const terminalEl = document.querySelector('.extended-width-terminal');
                                  if (terminalEl) {
                                    terminalEl.scrollIntoView({ behavior: 'smooth' });
                                  }
                                }}
                              >
                                <Icon name="terminal" size={13} />
                                <span>Lihat Seluruh Log di Terminal Bawah &darr;</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}



                      {/* BOTTOM: Modern High-tech Authentic Terminal (Extended Full Width) */}
                      <div className="terminal modern-terminal extended-width-terminal">
                        <div className="terminal-modern-bar">
                          <div className="terminal-bar-left-group">
                            <div className="terminal-dots-monochrome">
                              <span className="terminal-dot red" title="Tutup Sesi" />
                              <span className="terminal-dot yellow" title="Minimize" />
                              <span className="terminal-dot green" title="Maximize" />
                            </div>

                            <div className="terminal-session-badge">
                              <span className="term-user">maestro@engine</span>
                              <span className="term-colon">:</span>
                              <span className="term-dir">~/discovery</span>
                              <span className="term-branch">(main:live)</span>
                            </div>

                            <span className="terminal-live-indicator">
                              <span className="terminal-pulse-dot" />
                              <span>LIVE</span>
                            </span>
                          </div>

                          <div className="terminal-category-tabs">
                            {['all', 'system', 'runtime', 'database', 'discovery', 'browser', 'flow-builder', 'runner', 'quality'].map(cat => (
                              <button
                                key={cat}
                                className={`terminal-tab-btn ${logFilter === cat ? 'active' : ''}`}
                                onClick={() => setLogFilter(cat)}
                              >
                                {cat === 'all' ? '--all' : `--${cat}`}
                              </button>
                            ))}
                          </div>

                          <div className="terminal-bar-right-group">
                            <div className="terminal-search-wrap">
                              <Icon name="search" size={13} />
                              <input
                                className="terminal-search-input"
                                placeholder="/ grep log..."
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                              />
                              {logSearch && (
                                <button
                                  className="terminal-search-clear"
                                  onClick={() => setLogSearch('')}
                                  title="Hapus filter pencarian"
                                >
                                  <Icon name="close" size={11} />
                                </button>
                              )}
                            </div>

                            <button
                              className="terminal-scroll-down-btn"
                              onClick={() => scrollToBottom(true)}
                              title="Scroll ke output paling baru"
                            >
                              <Icon name="arrow" size={12} />
                              <span>Terbawah</span>
                            </button>
                          </div>
                        </div>

                        {/* Shell prompt */}
                        <div className="terminal-shell-prompt-bar">
                          <span className="term-prompt-char">$</span>
                          <span className="term-prompt-cmd">
                            qc-maestro run --target="{activeJob.config?.baseUrl || 'http://localhost:5174/'}" --mode=crawl --output=stream
                          </span>
                          <span className="term-prompt-cursor">â–‹</span>
                        </div>

                        {/* Terminal Body */}
                        <div className="terminal-body" ref={terminalBodyRef}>
                          {filteredLogs.length === 0 ? (
                            <div style={{ color: '#8E7C6C', textAlign: 'center', padding: 40, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              Menunggu output stream dari engine...
                            </div>
                          ) : (
                            <>
                              {filteredLogs.map((log, i) => (
                                <div key={i} className="log-row">
                                  <span className="log-line-num">{String(i + 1).padStart(3, '0')}</span>
                                  <span className="log-time">{formatLogTime(log.time)}</span>
                                  <span className={`log-cat ${log.category}`}>{log.category}</span>
                                  <span className="log-text">{log.message}</span>
                                </div>
                              ))}
                              {(activeJob.status === 'RUNNING' || activeJob.status === 'WAITING_REVIEW') && (
                                <div className="log-row running-indicator">
                                  <span className="terminal-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                                  <span style={{ color: '#ECD8C3', fontWeight: 650, fontSize: 11 }}>Sedang proses:</span>
                                  <span style={{ color: '#FAF6F0', fontSize: 12 }}>
                                    {(() => {
                                      const isMobile = activeJob.config?.platform === 'android';
                                      const phase = activeJob.phase || '';
                                      switch (phase) {
                                        case 'INITIALIZING': return 'Menginisialisasi pipeline discovery & environment...';
                                        case 'CLONING': return 'Mengunduh repositori sumber project...';
                                        case 'COPYING_SOURCE': return 'Menyiapkan berkas sumber dari direktori lokal...';
                                        case 'DETECTING_STACK': return 'Menganalisis stack framework & dependency...';
                                        case 'STARTING_DEMO_APP': return 'Menyiapkan & menyalakan server aplikasi demo...';
                                        case 'PREPARING_RUNTIME': return 'Menyiapkan workspace runtime & service aplikasi...';
                                        case 'STARTING_SERVICES': return 'Menyalakan dev server & service backend...';
                                        case 'HEALTH_CHECK': return 'Memeriksa kesiapan port & endpoint aplikasi...';
                                        case 'PREPARING_DATABASE': return 'Menyiapkan database isolated container...';
                                        case 'SCANNING_SOURCE': return isMobile 
                                          ? 'Scan berkas sumber Flutter/Dart (Screen, Route, Widget)...' 
                                          : 'Scan berkas web (.tsx / .vue / .php / controllers / routes)...';
                                        case 'PREPARING_MOBILE': return 'Menyiapkan target mobile ADB & verifikasi backend...';
                                        case 'CRAWLING_UI': return 'Dynamic crawler Playwright menelusuri interaksi DOM & form...';
                                        case 'BUILDING_INVENTORY': return 'Menyusun inventory layar, endpoint API & routes...';
                                        case 'SYNTHESIZING_FLOWS':
                                        case 'GENERATING_FLOWS': return isMobile 
                                          ? 'Menghasilkan flow Maestro YAML untuk pengujian otomatis...' 
                                          : 'Menghasilkan spec Playwright skenario otomatis...';
                                        case 'WAITING_REVIEW':
                                        case 'BUSINESS_FLOW_REVIEW': return 'Menunggu review alur bisnis oleh penguji...';
                                        case 'EXECUTING_TESTS': return isMobile 
                                          ? 'Menjalankan skenario test di perangkat Android...' 
                                          : 'Menjalankan automated test di browser...';
                                        case 'QUALITY_AUDIT': return 'Menjalankan Quality Audit: browser, viewport, rule UI, screenshot, dan report...';
                                        default: return activeJob.message || 'Memproses langkah pengujian...';
                                      }
                                    })()}
                                  </span>
                                </div>
                              )}
                              <div className="log-row terminal-idle-stream-row">
                                <span className="term-stream-bullet">â€º</span>
                                <span className="term-stream-text">Output terminal sinkron dengan Playwright daemon</span>
                                <span className="term-stream-cursor">_</span>
                              </div>
                              <div ref={terminalBottomRef} style={{ height: 1 }} />
                            </>
                          )}
                        </div>

                        {/* Statusline Footer */}
                        <div className="terminal-statusline-footer">
                          <div className="term-statusline-left">
                            <span className="term-status-pill">PLAYWRIGHT v1.42</span>
                            <span className="term-status-pill">UTF-8</span>
                            <span className="term-status-pill">BUFFER: {filteredLogs.length} LOGS</span>
                          </div>
                          <div className="term-statusline-right">
                            <span className={`term-status-pill ${activeJob.status === 'RUNNING' ? 'running' : 'ready'}`}>
                              ●  {activeJob.status}
                            </span>
                            <span className="term-status-pill">PING: ~12ms</span>
                          </div>
                        </div>
                      </div>
                </>
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
                    style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-main)', width: 220 }}
                  />
                  <select
                    value={mapFilter}
                    onChange={(e) => setMapFilter(e.target.value as any)}
                    style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-main)' }}
                  >
                    <option value="all">Semua Kategori</option>
                    <option value="public">Publik</option>
                    <option value="authenticated">Autentikasi</option>
                    <option value="error">Error / Blocked</option>
                  </select>
                </div>
              </div>

              {flowSource === 'zannora' && zannoraEvidence ? (
                <ZannoraAppMap evidence={zannoraEvidence} onOpenEvidence={openEvidenceGroup} />
              ) : !activeJob?.inventory ? (
                <Empty title="Belum Ada Inventaris">
                  Jalankan discovery terlebih dahulu untuk memetakan halaman dan elemen aplikasi.
                </Empty>
              ) : (
                <div>
                  <CapabilityProfilePanel profile={activeJob.inventory.capabilities} />
                  <div className="split-view">
                    {/* Left: Pages List */}
                    <div className="list-pane">
                    {mapViewMode === 'table' ? (
                      <Paginated items={filteredPages} resetKey={`${mapViewMode}-${mapSearch}-${mapFilter}`}>{(visiblePages, start) => <div className="table-wrap">
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
                            {visiblePages.map((page, index) => (
                              <tr
                                key={`${page.id}-${start + index}`}
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
                      </div>}</Paginated>
                    ) : (
                      <Paginated items={filteredPages} resetKey={`${mapViewMode}-${mapSearch}-${mapFilter}`}>{(visiblePages) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, padding: 16 }}>
                        {visiblePages.map(page => (
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
                      </div>}</Paginated>
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
                          <Paginated items={selectedPage.elements ?? []} resetKey={selectedPage.id}>{(elements) => <div style={{ maxHeight: 320, overflowY: 'auto' }}>
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
                                {elements.map((el, idx) => (
                                  <tr key={idx}>
                                    <td><strong>{el.name}</strong></td>
                                    <td><span style={{ color: 'var(--text-dim)' }}>{el.type}</span></td>
                                    <td><code style={{ fontSize: 11, color: 'var(--violet)' }}>{el.selector || el.testId || 'Perlu verifikasi'}</code></td>
                                    <td>{el.confidence ? `${Math.round(el.confidence * 100)}%` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>}</Paginated>
                        </div>
                      </>
                    ) : (
                      <Empty title="Pilih Halaman">
                        Klik salah satu baris pada tabel untuk melihat screenshot halaman dan elemen interaktifnya.
                      </Empty>
                    )}
                    </div>
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

              {/* DEDICATED APPROVAL BANNER ON SKENARIO TEST */}
              {hasFlowsToApprove && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.06))',
                  border: '1.5px solid #10B981',
                  borderRadius: 12,
                  padding: '18px 24px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 20,
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '2px solid #10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10B981',
                      flexShrink: 0
                    }}>
                      <Icon name="check" size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 800 }}>
                          Persetujuan Skenario Pengujian (Review Gate)
                        </strong>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: '#10B981',
                          color: '#042F1A'
                        }}>
                          SIAP DISETUJUI
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        Sebanyak <strong>{activeJob?.businessFlowMap?.flows?.length || activeJob?.flows?.length || 0} skenario pengujian</strong> telah siap. Tinjau alur di bawah ini dan klik tombol Approve untuk melanjutkan eksekusi Playwright End-to-End secara otomatis.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="primary"
                    style={{
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      borderColor: '#10B981',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      padding: '11px 22px',
                      fontSize: 13.5,
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      flexShrink: 0,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                      cursor: 'pointer'
                    }}
                    onClick={handleApproveBusinessFlows}
                    disabled={loading}
                  >
                    <Icon name="check" size={15} />
                    <span>{loading ? 'Menyetujui…' : 'Approve Skenario & Jalankan Test'}</span>
                  </button>
                </div>
              )}

              {/* LIVE TEST EXECUTION RUNNING BANNER */}
              {activeJob && (activeJob.status === 'RUNNING' || activeJob.phase === 'EXECUTING_TESTS') && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(16, 185, 129, 0.08))',
                  border: '1.5px solid #0284C7',
                  borderRadius: 12,
                  padding: '16px 24px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  boxShadow: '0 6px 20px rgba(2, 132, 199, 0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'rgba(2, 132, 199, 0.15)',
                      border: '2px solid #0284C7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0284C7',
                      flexShrink: 0
                    }}>
                      <span className="terminal-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 800 }}>
                          Eksekusi Playwright E2E Sedang Berjalan ({activeJob.results?.length ?? 0}/{activeJob.flows?.length ?? 0})
                        </strong>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: '#0284C7',
                          color: '#FFFFFF'
                        }}>
                          LIVE RUNNING
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {activeJob.message || 'Merekam video full flow 720p 30 FPS dan mengeksekusi skenario browser otomatis...'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => setCurrentView('discovery')}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Icon name="terminal" size={13} />
                    <span>Lihat Live Terminal &rarr;</span>
                  </button>
                </div>
              )}

              {/* ALL-IN-ONE UNIFIED PREPARATION & SYNTHESIS VIEW */}
              {flowSource === 'job' && activeJob && !activeJob.businessFlowMap && (!activeJob.flows || activeJob.flows.length === 0) && (activeJob.status === 'RUNNING' || activeJob.status === 'WAITING_REVIEW' || activeJob.status === 'QUEUED') ? (
                <div style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #DBC4AC',
                  borderRadius: 14,
                  padding: '36px 32px',
                  boxShadow: '0 8px 24px rgba(70, 50, 35, 0.07)',
                  marginBottom: 24,
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: '#FAF6F1',
                    border: '2px solid #DBC4AC',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284C7',
                    marginBottom: 16,
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.15)',
                    position: 'relative'
                  }}>
                    <Icon name="flows" size={26} />
                    <span className="pipeline-circle-spinner-ring" style={{ inset: -6 }} />
                  </div>

                  <h2 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 850, color: '#14181D' }}>
                    Sintesis Skenario Test &amp; Alur Bisnis Sedang Berlangsung
                  </h2>
                  <p style={{ margin: '0 auto 20px auto', fontSize: 13, color: '#7B6858', maxWidth: 640, lineHeight: 1.55 }}>
                    Server sedang mengekstrak rute, controller, skema database, dan interaksi form (DOM crawler). Seluruh alur bisnis, skenario pengujian canonical (E2E &amp; regresi), serta feature contract sedang disintesis dalam satu kesatuan.
                  </p>

                  {/* Live Progress Bar & Status Pill */}
                  <div style={{ maxWidth: 520, margin: '0 auto 24px auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#14181D', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="terminal-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                        <span>Fase: {activeJob.phase || activeJob.status}</span>
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0284C7' }}>
                        {activeJob.progress}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#EFE5D8', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, activeJob.progress))}%`,
                        background: 'linear-gradient(90deg, #10B981, #0284C7)',
                        borderRadius: 999,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>

                  {/* All-in-One Checklist Telemetry Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: 12,
                    maxWidth: 820,
                    margin: '0 auto 22px auto',
                    textAlign: 'left'
                  }}>
                    <div style={{
                      background: '#FAF6F1',
                      border: '1px solid #E2D3C4',
                      borderRadius: 10,
                      padding: '14px 16px',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start'
                    }}>
                      <div style={{ color: '#0284C7', marginTop: 2 }}><Icon name="map" size={18} /></div>
                      <div>
                        <strong style={{ fontSize: 13, color: '#14181D', display: 'block' }}>1. Business Flow Architecture</strong>
                        <span style={{ fontSize: 11.5, color: '#7B6858', display: 'block', marginTop: 2 }}>
                          Pohon alur navigasi &amp; diagram logika bisnis untuk approval user (ACC Flow).
                        </span>
                      </div>
                    </div>

                    <div style={{
                      background: '#FAF6F1',
                      border: '1px solid #E2D3C4',
                      borderRadius: 10,
                      padding: '14px 16px',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start'
                    }}>
                      <div style={{ color: '#10B981', marginTop: 2 }}><Icon name="terminal" size={18} /></div>
                      <div>
                        <strong style={{ fontSize: 13, color: '#14181D', display: 'block' }}>2. Canonical Test Flows</strong>
                        <span style={{ fontSize: 11.5, color: '#7B6858', display: 'block', marginTop: 2 }}>
                          Skrip deterministik Playwright (.spec.ts) dan skenario regression YAML.
                        </span>
                      </div>
                    </div>

                    <div style={{
                      background: '#FAF6F1',
                      border: '1px solid #E2D3C4',
                      borderRadius: 10,
                      padding: '14px 16px',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start'
                    }}>
                      <div style={{ color: '#8B5CF6', marginTop: 2 }}><Icon name="shield" size={18} /></div>
                      <div>
                        <strong style={{ fontSize: 13, color: '#14181D', display: 'block' }}>3. Feature Contracts &amp; Roles</strong>
                        <span style={{ fontSize: 11.5, color: '#7B6858', display: 'block', marginTop: 2 }}>
                          Matriks expected state, operasi CRUD, dan hak akses aktor sistem.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                    <button
                      type="button"
                      className="quiet"
                      style={{
                        padding: '8px 16px',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px solid #DBC4AC',
                        background: '#FAF6F1',
                        color: '#14181D',
                        borderRadius: 8
                      }}
                      onClick={() => setCurrentView('discovery')}
                    >
                      <Icon name="terminal" size={14} /> Pantau Log di Live Terminal &rarr;
                    </button>
                  </div>
                </div>
              ) : flowSource === 'job' && activeJob && (activeJob.status === 'FAILED' || activeJob.status === 'INFRA_ERROR') && (!activeJob.flows || activeJob.flows.length === 0) ? (
                <div style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #FCA5A5',
                  borderLeft: '5px solid #DC2626',
                  borderRadius: 14,
                  padding: '36px 32px',
                  boxShadow: '0 8px 24px rgba(220, 38, 38, 0.08)',
                  marginBottom: 24,
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: '#FEF2F2',
                    border: '2px solid #EF4444',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#DC2626',
                    marginBottom: 16,
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.2)',
                    position: 'relative'
                  }}>
                    <Icon name="warning" size={28} />
                    <span className="pipeline-circle-failed-ring" style={{ inset: -6 }} />
                  </div>

                  <h2 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 850, color: '#991B1B' }}>
                    Sintesis Skenario Test Terhenti — Eksekusi Discovery Mengalami Kegagalan
                  </h2>
                  <p style={{ margin: '0 auto 20px auto', fontSize: 13, color: '#7F1D1D', maxWidth: 660, lineHeight: 1.55 }}>
                    Alur bisnis otomatis dan skenario Playwright (.spec.ts) belum dapat disintesis karena proses persiapan runtime atau target mengalami kegagalan sebelum tahap observasi DOM / crawler selesai.
                  </p>

                  {/* Error Box */}
                  <div style={{
                    maxWidth: 720,
                    margin: '0 auto 18px auto',
                    background: '#140A0A',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 8,
                    padding: '14px 16px',
                    textAlign: 'left'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#F87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="terminal" size={13} /> Log Kesalahan:
                      </span>
                      <button
                        type="button"
                        className="dfp-copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(failureErrorText);
                          setActionSuccess('Pesan error disalin!');
                          setTimeout(() => setActionSuccess(''), 2500);
                        }}
                      >
                        <Icon name="copy" size={12} /> Salin Error
                      </button>
                    </div>
                    <pre style={{
                      margin: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11.5,
                      color: '#FECACA',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 120,
                      overflowY: 'auto'
                    }}>
                      {failureErrorText}
                    </pre>
                  </div>

                  {/* Solusi Box */}
                  <div style={{
                    maxWidth: 720,
                    margin: '0 auto 24px auto',
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 8,
                    padding: '12px 16px',
                    textAlign: 'left',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start'
                  }}>
                    <div style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }}>
                      <Icon name="zap" size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 12.5, color: '#92400E', display: 'block', marginBottom: 2 }}>
                        Langkah Penyelesaian / Rekomendasi:
                      </strong>
                      <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                        {failureRecommendation}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="dfp-btn-retry"
                      onClick={() => handleRestartJob(activeJob.id)}
                      disabled={loading}
                    >
                      <Icon name="refresh" size={14} />
                      <span>{loading ? 'Memulai Ulang...' : 'Jalankan Ulang (Retry Discovery)'}</span>
                    </button>

                    <button
                      type="button"
                      className="dfp-btn-edit"
                      onClick={() => handleEditJob(activeJob)}
                    >
                      <Icon name="settings" size={14} />
                      <span>Ubah Konfigurasi Proyek</span>
                    </button>

                    <button
                      type="button"
                      className="dfp-btn-scroll"
                      style={{ borderStyle: 'solid' }}
                      onClick={() => setCurrentView('discovery')}
                    >
                      <Icon name="terminal" size={13} />
                      <span>Buka Live Terminal untuk Memeriksa Traceback &rarr;</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {flowSource === 'job' && activeJob?.businessFlowMap && (
                    <div style={{ marginBottom: 24 }}>
                      <BusinessFlowVisualizer
                        map={activeJob.businessFlowMap}
                        onApproveAll={handleApproveBusinessFlows}
                        onUpdateFlow={handleUpdateBusinessFlow}
                        projectName={activeJob.name}
                        baseUrl={activeJob.config?.baseUrl}
                      />
                    </div>
                  )}

                  {flowSource === 'zannora' && zannoraEvidence ? (
                    <ZannoraTestDesign evidence={zannoraEvidence} onOpenEvidence={openEvidenceGroup} />
                  ) : !activeJob?.flows || activeJob.flows.length === 0 ? (
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
                          <Paginated items={activeJob.flows}>{(flows) => flows.map(f => (
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
                                {f.reason && <span style={{ color: 'var(--yellow)' }}>â€¢ {f.reason}</span>}
                              </div>
                            </div>
                          ))}</Paginated>
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

                  {flowSource === 'job' && activeJob && (activeJob.inventory?.featureContractPlan || activeJob.inventory?.crudPlan || activeJob.inventory?.roleActionPlan) && (
                    <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
                      {activeJob.inventory?.featureContractPlan && <FeatureContractPanel plan={activeJob.inventory.featureContractPlan} />}
                      {activeJob.inventory?.crudPlan && <CrudCoveragePanel plan={activeJob.inventory.crudPlan} />}
                      {activeJob.inventory?.roleActionPlan && <RoleActionPanel plan={activeJob.inventory.roleActionPlan} />}
                    </div>
                  )}
                </>
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

              {flowSource === 'zannora' && zannoraEvidence ? (
                <ZannoraRuns evidence={zannoraEvidence} onOpenEvidence={openEvidenceGroup} />
              ) : activeJob?.results && activeJob.results.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <Paginated items={activeJob.results}>{(resultsPage, start) => resultsPage.map((res, i) => (
                    <Panel
                      key={`${res.runId}-${start + i}`}
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
                  ))}</Paginated>
                </div>
              ) : runHistory && runHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <RunHistoryPanel history={runHistory} />
                </div>
              ) : (
                <Empty title="Belum Ada Hasil Uji">
                  Jalankan salah satu skenario flow untuk melihat hasil eksekusi nyata.
                </Empty>
              )}
            </div>
          )}

          {/* VIEW: FINDINGS & RETEST */}
          {currentView === 'findings' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>Findings &amp; Retest</h1>
                  <p>Semua temuan dari milestone audit dikelompokkan berdasarkan jenis masalah dengan prioritas kritis di paling atas.</p>
                </div>
                <div className="header-actions">
                  <button className="quiet" onClick={() => setCurrentView('process')}><Icon name="map" size={15} /> Back to Milestone Flow</button>
                  <button className="primary" onClick={() => setEvidenceFocus({ groupId: activeEvidence?.groups.find((group) => group.id === 'target-quality' || group.id === 'quality' || group.id === 'responsive')?.id || 'quality' })}><Icon name="reports" size={15} /> Inspect Evidence Inline</button>
                </div>
              </div>
              {(() => {
                const findings = activeOpenFindings.length;

                // Category counts and sub-area counts
                const categoryCounts: Record<FindingCategory, number> = {
                  critical: 0,
                  functional: 0,
                  content: 0,
                  visual: 0,
                  contrast: 0,
                  accessibility: 0
                };
                const areaCounts: Record<string, number> = {};

                for (const f of activeOpenFindings) {
                  const cat = classifyFindingCategory(f.area);
                  categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                  const a = f.area || 'unknown';
                  areaCounts[a] = (areaCounts[a] || 0) + 1;
                }

                // Sorted findings: Critical (weight 100) -> Functional (75) -> Content (50) -> Visual (30) -> Contrast (25) -> A11y (20)
                const sortedFindings = [...activeOpenFindings].sort((a, b) => {
                  const sevA = getFindingSeverity(a.area).weight;
                  const sevB = getFindingSeverity(b.area).weight;
                  if (sevA !== sevB) return sevB - sevA;
                  const areaCompare = (a.area || '').localeCompare(b.area || '');
                  if (areaCompare !== 0) return areaCompare;
                  return (a.route || '').localeCompare(b.route || '');
                });

                // Filtered by category, area, and search query
                const filteredFindings = sortedFindings.filter((item) => {
                  if (findingCategoryFilter !== 'all') {
                    if (classifyFindingCategory(item.area) !== findingCategoryFilter) return false;
                  }
                  if (findingAreaFilter !== 'all') {
                    if ((item.area || 'unknown') !== findingAreaFilter) return false;
                  }
                  if (findingSearchQuery.trim()) {
                    const q = findingSearchQuery.toLowerCase();
                    const matchRoute = (item.route || '').toLowerCase().includes(q);
                    const matchName = (item.name || '').toLowerCase().includes(q);
                    const matchLocation = (item.location || '').toLowerCase().includes(q);
                    const matchDetail = (item.detail || '').toLowerCase().includes(q);
                    if (!matchRoute && !matchName && !matchLocation && !matchDetail) return false;
                  }
                  return true;
                });

                const categoryOrder: FindingCategory[] = ['critical', 'functional', 'content', 'visual', 'contrast', 'accessibility'];

                const renderFindingRow = (item: (typeof activeOpenFindings)[0], index: number) => {
                  const key = `${item.groupId || 'finding'}-${item.route || ''}-${item.name || ''}-${index}`;
                  const expanded = expandedFindingKey === key;
                  const severity = getFindingSeverity(item.area);
                  const readableArea = getAreaReadableName(item.area);
                  const cat = classifyFindingCategory(item.area);

                  return (
                    <div className={`finding-item ${expanded ? 'expanded' : ''}`} key={key}>
                      <button
                        type="button"
                        className="finding-row finding-row-toggle"
                        aria-expanded={expanded}
                        onClick={() => setExpandedFindingKey(expanded ? null : key)}
                      >
                        <span className={`finding-severity finding-cat-tag ${cat}`} style={{ minWidth: 92, textAlign: 'center', justifyContent: 'center' }}>
                          {readableArea}
                        </span>
                        <span className="finding-row-copy">
                          <strong>{item.name || 'Quality check failed'}</strong>
                          <small>{[item.route, item.viewport, item.browser].filter(Boolean).join(' · ') || 'Lokasi tidak tersedia'}</small>
                        </span>
                        <span className="finding-row-status" style={severity.level === 'CRITICAL' ? { background: 'rgba(255, 105, 123, 0.2)', color: 'var(--red)' } : undefined}>
                          {item.workflowStatus.replace('_', ' ')}
                        </span>
                        <span className="finding-expand-label">
                          {expanded ? 'Tutup' : 'Lihat bukti'} <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={13} />
                        </span>
                      </button>
                      {flowSource === 'job' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 10px' }}>
                          <select
                            aria-label={`Status finding ${item.name || key}`}
                            value={item.workflowStatus}
                            disabled={loading}
                            onChange={(event) => void updateFindingStatus(item, event.target.value as FindingWorkflowStatus)}
                          >
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="READY_FOR_RETEST">Ready for Retest</option>
                            <option value="PASSED">Passed</option>
                          </select>
                        </div>
                      )}
                      {expanded && <FindingEvidenceDropdown finding={item} evidence={activeEvidence} />}
                    </div>
                  );
                };

                return (
                  <>
                    <EvidenceInspector focus={evidenceFocus} evidence={activeEvidence} onClose={() => setEvidenceFocus(null)} onOpenAsset={(asset) => setFullScreenshot(asset.url)} />

                    {/* TOP SUMMARY METRIC CARDS */}
                    <div className="finding-summary-grid">
                      <Panel title="Total Open Findings">
                        <strong className="finding-number attention">{findings}</strong>
                        <small>{categoryCounts.critical > 0 ? `${categoryCounts.critical} temuan berprioritas KRITIS` : 'Semua prioritas kritis aman'}</small>
                      </Panel>
                      <Panel title="Kritis &amp; Fungsional">
                        <strong className="finding-number" style={{ color: categoryCounts.critical > 0 ? 'var(--red)' : 'var(--cyan)' }}>
                          {categoryCounts.critical + categoryCounts.functional}
                        </strong>
                        <small>{categoryCounts.critical} kritis (auth/error/network) · {categoryCounts.functional} data/form</small>
                      </Panel>
                      <Panel title="Visual &amp; Aksesibilitas">
                        <strong className="finding-number" style={{ color: '#c084fc' }}>
                          {categoryCounts.visual + categoryCounts.contrast + categoryCounts.accessibility}
                        </strong>
                        <small>{categoryCounts.visual} visual · {categoryCounts.contrast} kontras · {categoryCounts.accessibility} a11y</small>
                      </Panel>
                    </div>

                    {/* CATEGORY OVERVIEW CARDS (CLICKABLE) */}
                    {findings > 0 && (
                      <div className="finding-categories-overview">
                        {categoryOrder.map((catKey) => {
                          const conf = FINDING_CATEGORY_CONFIG[catKey];
                          const count = categoryCounts[catKey];
                          if (count === 0) return null;
                          const isActive = findingCategoryFilter === catKey;

                          const subAreas = Object.keys(areaCounts).filter((a) => classifyFindingCategory(a) === catKey);

                          return (
                            <button
                              key={catKey}
                              type="button"
                              className={`finding-cat-card ${catKey} ${isActive ? 'active' : ''}`}
                              onClick={() => {
                                setFindingCategoryFilter((prev) => (prev === catKey ? 'all' : catKey));
                                setFindingAreaFilter('all');
                              }}
                            >
                              <div>
                                <div className="finding-cat-card-header">
                                  <span className={`finding-cat-tag ${catKey}`}>{conf.badgeLabel}</span>
                                  {isActive && <small style={{ color: 'var(--cyan)', fontWeight: 700, fontSize: 10 }}>●  FILTER AKTIF</small>}
                                </div>
                                <div className="finding-cat-count">{count}</div>
                                <div className="finding-cat-label">{conf.label}</div>
                                <div className="finding-cat-desc">{conf.description}</div>
                              </div>
                              <div className="finding-cat-subbreakdown">
                                {subAreas.map((sa) => (
                                  <span key={sa}>
                                    {getAreaReadableName(sa)}: {areaCounts[sa]}
                                  </span>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* WORKFLOW BAR */}
                    <Panel title="Retest Workflow" description="Perbaiki temuan dimulai dari prioritas Kritis, jalankan retest, hingga status audit menjadi Passed.">
                      <div className="finding-flow">
                        <span className="finding-step active"><b>01</b>Open</span><i>← ’</i>
                        <span className="finding-step"><b>02</b>In Progress</span><i>← ’</i>
                        <span className="finding-step"><b>03</b>Ready for Retest</span><i>← ’</i>
                        <span className="finding-step"><b>04</b>Passed</span>
                      </div>
                    </Panel>

                    {/* CONTROLS & FILTER TOOLBAR */}
                    {findings > 0 && (
                      <div className="finding-controls-bar">
                        <div className="finding-filter-pills">
                          <button
                            type="button"
                            className={`finding-pill ${findingCategoryFilter === 'all' && findingAreaFilter === 'all' ? 'active' : ''}`}
                            onClick={() => {
                              setFindingCategoryFilter('all');
                              setFindingAreaFilter('all');
                            }}
                          >
                            Semua ({findings})
                          </button>
                          {categoryOrder.map((catKey) => {
                            const conf = FINDING_CATEGORY_CONFIG[catKey];
                            const count = categoryCounts[catKey];
                            if (count === 0) return null;
                            const isActive = findingCategoryFilter === catKey;
                            return (
                              <button
                                key={catKey}
                                type="button"
                                className={`finding-pill ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                  setFindingCategoryFilter((prev) => (prev === catKey ? 'all' : catKey));
                                  setFindingAreaFilter('all');
                                }}
                              >
                                {conf.label} ({count})
                              </button>
                            );
                          })}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {/* Sub-area filter dropdown */}
                          <select
                            style={{ fontSize: 11, padding: '5px 8px', borderRadius: 4, background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                            value={findingAreaFilter}
                            onChange={(e) => setFindingAreaFilter(e.target.value)}
                            aria-label="Filter sub-kategori masalah"
                          >
                            <option value="all">Semua Sub-kategori ({findings})</option>
                            {Object.keys(areaCounts).sort((a, b) => (areaCounts[b] || 0) - (areaCounts[a] || 0)).map((area) => (
                              <option key={area} value={area}>
                                {getAreaReadableName(area)} ({areaCounts[area]})
                              </option>
                            ))}
                          </select>

                          {/* Search input */}
                          <div className="finding-search-wrap">
                            <input
                              type="text"
                              className="finding-search-input"
                              placeholder="Cari route / error..."
                              value={findingSearchQuery}
                              onChange={(e) => setFindingSearchQuery(e.target.value)}
                            />
                          </div>

                          {/* View mode toggle */}
                          <div className="finding-view-modes">
                            <button
                              type="button"
                              className={`tool-btn ${findingViewMode === 'grouped' ? 'active' : ''}`}
                              onClick={() => setFindingViewMode('grouped')}
                              title="Tampilkan per kategori masalah"
                            >
                              <Icon name="overview" size={13} /> Grup
                            </button>
                            <button
                              type="button"
                              className={`tool-btn ${findingViewMode === 'list' ? 'active' : ''}`}
                              onClick={() => setFindingViewMode('list')}
                              title="Tampilkan daftar terurut prioritas"
                            >
                              <Icon name="flows" size={13} /> Daftar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FINDINGS CONTENT */}
                    {findings === 0 ? (
                      <Empty title="Tidak ada finding terbuka">Semua hasil audit visual sudah clear atau belum ada audit yang dijalankan.</Empty>
                    ) : filteredFindings.length === 0 ? (
                      <Empty title="Tidak ada temuan yang cocok">
                        Tidak ada temuan yang sesuai dengan filter atau kata kunci &quot;{findingSearchQuery}&quot;.
                        <div style={{ marginTop: 12 }}>
                          <button
                            className="tool-btn"
                            onClick={() => {
                              setFindingCategoryFilter('all');
                              setFindingAreaFilter('all');
                              setFindingSearchQuery('');
                            }}
                          >
                            Reset Filter
                          </button>
                        </div>
                      </Empty>
                    ) : findingViewMode === 'grouped' ? (
                      /* GROUPED ACCORDION VIEW */
                      <div className="finding-grouped-container">
                        {categoryOrder.map((catKey) => {
                          const conf = FINDING_CATEGORY_CONFIG[catKey];
                          const catItems = filteredFindings.filter((f) => classifyFindingCategory(f.area) === catKey);
                          if (catItems.length === 0) return null;
                          const isCollapsed = Boolean(collapsedCategories[catKey]);

                          return (
                            <div className={`finding-group-block ${catKey}`} key={catKey}>
                              <button
                                type="button"
                                className="finding-group-header"
                                onClick={() =>
                                  setCollapsedCategories((prev) => ({
                                    ...prev,
                                    [catKey]: !prev[catKey]
                                  }))
                                }
                                aria-expanded={!isCollapsed}
                              >
                                <div className="finding-group-header-left">
                                  <span className={`finding-cat-tag ${catKey}`}>{conf.badgeLabel}</span>
                                  <div className="finding-group-title">
                                    <strong>
                                      {conf.label}
                                      {catKey === 'critical' && <span style={{ color: 'var(--red)', fontSize: 11, fontWeight: 800 }}>●  PRIORITAS TINGGI</span>}
                                    </strong>
                                    <small>{conf.description}</small>
                                  </div>
                                </div>
                                <div className="finding-group-header-right">
                                  <span className="finding-group-count-badge">{catItems.length} temuan</span>
                                  <span style={{ color: 'var(--cyan)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    {isCollapsed ? 'Buka' : 'Tutup'} <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={14} />
                                  </span>
                                </div>
                              </button>

                              {!isCollapsed && (
                                <div className="finding-group-body">
                                  <Paginated items={catItems} resetKey={`${catKey}-${findingAreaFilter}-${findingSearchQuery}`}>
                                    {(pagedItems, start) => (
                                      <div className="finding-list">
                                        {pagedItems.map((item, localIdx) => renderFindingRow(item, start + localIdx))}
                                      </div>
                                    )}
                                  </Paginated>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* SORTED FLAT LIST VIEW */
                      <Panel
                        title={`Live Findings (${filteredFindings.length})`}
                        description="Daftar diurutkan otomatis dengan prioritas Kritis (Autentikasi, Network, Script Exception) di paling atas."
                      >
                        <Paginated items={filteredFindings} resetKey={`${findingCategoryFilter}-${findingAreaFilter}-${findingSearchQuery}`}>
                          {(pagedItems, start) => (
                            <div className="finding-list">
                              {pagedItems.map((item, localIdx) => renderFindingRow(item, start + localIdx))}
                            </div>
                          )}
                        </Paginated>
                      </Panel>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* VIEW: REPORTS (EXECUTIVE QA & QUALITY AUDIT REPORT) */}
          {currentView === 'reports' && (
            <div>
              <div className="view-header" style={{ marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Laporan Final &amp; Audit Mutu</h1>
                    <span className={`linear-status-badge ${
                      activeJob?.status === 'COMPLETED' ? 'passed' :
                      (activeJob?.status === 'FAILED' || activeJob?.status === 'INFRA_ERROR') ? 'failed' :
                      activeJob?.status === 'RUNNING' ? 'info' : 'neutral'
                    }`}>
                      <span className="led-dot" />
                      {activeJob?.status || 'UNKNOWN'}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: '#FAF6F1',
                      border: '1px solid #DBC4AC',
                      color: '#7B6858'
                    }}>
                      {activeJob?.config?.platform?.toUpperCase() || 'WEB'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Ringkasan verifikasi kualitas aplikasi, status skenario pengujian, dan catatan defect berdasarkan data eksekusi nyata.
                  </p>
                </div>
                <div className="header-actions">
                  <button
                    type="button"
                    className="tool-btn primary"
                    onClick={() => activeJobId && downloadReport(activeJobId, 'pdf', reportAttempt, reportStatusFilter)}
                    title="Unduh Dokumen Laporan Mutu PDF"
                  >
                    <Icon name="download" size={14} /> Unduh PDF
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => activeJobId && window.open(`/api/v1/discovery/jobs/${activeJobId}/report?format=html&attempt=${reportAttempt}&status=${reportStatusFilter}`, '_blank')}
                    title="Buka Dokumen Laporan Lengkap Interaktif di Tab Baru"
                  >
                    <Icon name="overview" size={14} /> Buka HTML
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => activeJobId && downloadReport(activeJobId, 'json', reportAttempt, reportStatusFilter)}
                    title="Unduh data audit JSON"
                  >
                    <Icon name="download" size={14} /> JSON
                  </button>
                </div>
              </div>

              {flowSource === 'zannora' && zannoraEvidence ? (
                <ZannoraReport evidence={zannoraEvidence} onOpenEvidence={openEvidenceGroup} />
              ) : !activeJob ? (
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

                const allFailedSteps = results.flatMap((r: any) =>
                  (r.steps || []).filter((s: any) => s.status === 'FAILED').map((s: any) => {
                    const rawMsg = s.errorMessage || '';
                    const rawCode = s.errorCode || '';
                    const lowerMsg = rawMsg.toLowerCase();
                    const isEngine = s.errorOrigin === 'qc_maestro_engine' ||
                      r.status === 'INFRA_ERROR' ||
                      rawCode.toLowerCase() === 'infra_error' ||
                      lowerMsg.includes('driver error') ||
                      lowerMsg.includes('playwright internal') ||
                      lowerMsg.includes('spawn enoent') ||
                      lowerMsg.includes('socket hang up') ||
                      lowerMsg.includes('daemon crashed') ||
                      lowerMsg.includes('runner internal');
                    const errorOrigin = isEngine ? ('qc_maestro_engine' as const) : ('user_target_application' as const);
                    return {
                      flowId: r.flowId,
                      runId: r.runId,
                      step: s,
                      errorOrigin,
                      artifacts: r.artifacts
                    };
                  })
                );

                const userAppErrorsCount = allFailedSteps.filter(item => item.errorOrigin === 'user_target_application').length;
                const qcEngineErrorsCount = allFailedSteps.filter(item => item.errorOrigin === 'qc_maestro_engine').length;
                const userAppErrorsTotal = userAppErrorsCount + (activeJob.qualityAudit?.errorBreakdown?.userAppErrors || 0);
                const qcEngineErrorsTotal = qcEngineErrorsCount + (activeJob.qualityAudit?.errorBreakdown?.qcEngineErrors || 0);
                const totalDefectsCombined = userAppErrorsTotal + qcEngineErrorsTotal;

                const hasRunData = totalRuns > 0;
                const runsScore = hasRunData ? Math.round((passedRuns / totalRuns) * 100) : null;
                const qaAuditScore = activeJob.qualityAudit?.scorePercent;
                const healthScore = typeof qaAuditScore === 'number' && qaAuditScore > 0 && hasRunData
                  ? Math.round(((runsScore ?? 100) + qaAuditScore) / 2)
                  : typeof qaAuditScore === 'number'
                  ? qaAuditScore
                  : runsScore;

                const pages = activeJob.inventory?.pages || [];
                const filesScanned = activeJob.inventory?.filesScanned || 0;

                // Build complete list of screenshots across results
                const galleryItems: Array<{
                  id: string;
                  flowId: string;
                  flowName: string;
                  name: string;
                  label: string;
                  featureGroup: string;
                  url: string;
                  status: string;
                }> = [];
                const seenGallery = new Set<string>();

                // Build complete list of video recordings
                const videoItems: Array<{
                  id: string;
                  flowId: string;
                  flowName: string;
                  name: string;
                  url: string;
                  status: string;
                }> = [];
                const seenVideos = new Set<string>();

                // Search across results
                const sourceForMedia = resultsForAttempt.length > 0 ? resultsForAttempt : allRawResults;
                for (const res of sourceForMedia) {
                  const flowObj = activeJob.flows?.find(f => f.id === res.flowId);
                  for (const art of res.artifacts || []) {
                    const raw = typeof art === 'string' ? art : (art as any)?.path || (art as any)?.url;
                    if (!raw) continue;
                    const clean = String(raw).replace(/\\/g, '/');
                    const resolvedUrl = artifactUrl(activeJob.id, raw);
                    if (!resolvedUrl) continue;

                    if (clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg')) {
                      if (!seenGallery.has(resolvedUrl)) {
                        seenGallery.add(resolvedUrl);
                        const fileName = clean.split('/').pop() || 'screenshot.png';
                        const label = flowObj?.name || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                        const featureGroup = flowObj?.name?.split(' ')[0] || 'Layar Terverifikasi';

                        galleryItems.push({
                          id: resolvedUrl,
                          flowId: res.flowId,
                          flowName: flowObj?.name || res.flowId,
                          name: fileName,
                          label,
                          featureGroup,
                          url: resolvedUrl,
                          status: res.status
                        });
                      }
                    } else if (clean.endsWith('.mp4') || clean.endsWith('.webm')) {
                      if (!seenVideos.has(resolvedUrl)) {
                        seenVideos.add(resolvedUrl);
                        videoItems.push({
                          id: resolvedUrl,
                          flowId: res.flowId,
                          flowName: flowObj?.name || res.flowId,
                          name: clean.split('/').pop() || 'video.mp4',
                          url: resolvedUrl,
                          status: res.status
                        });
                      }
                    }
                  }
                }

                // Also collect videos from activeEvidence groups (e.g. curated Zannora / full-flow evidence)
                if (activeEvidence?.groups) {
                  for (const group of activeEvidence.groups) {
                    for (const v of group.videos || []) {
                      if (!seenVideos.has(v.url)) {
                        seenVideos.add(v.url);
                        videoItems.push({
                          id: v.url,
                          flowId: group.id,
                          flowName: group.title,
                          name: v.label || 'video.webm',
                          url: v.url,
                          status: group.status || 'PASSED'
                        });
                      }
                    }
                  }
                }

                // Dynamic feature groups from gallery
                const dynamicFeatureGroups = ['all', ...Array.from(new Set(galleryItems.map(item => item.featureGroup))).filter(Boolean)];

                const filteredGallery = galleryItems.filter(item => {
                  if (galleryFilter === 'all') return true;
                  return item.featureGroup === galleryFilter;
                });

                // Compute verdict
                const isCompleted = activeJob.status === 'COMPLETED';
                const isJobFailed = activeJob.status === 'FAILED' || activeJob.status === 'INFRA_ERROR';
                const isRunning = activeJob.status === 'RUNNING';
                const verdictLabel = isJobFailed
                  ? 'BLOCKED'
                  : !hasRunData
                  ? 'IN PROGRESS'
                  : runsScore != null && runsScore >= 80
                  ? 'READY FOR STAGING'
                  : runsScore != null
                  ? 'NEEDS ATTENTION'
                  : 'PENDING';
                const verdictClass = verdictLabel === 'READY FOR STAGING'
                  ? 'passed'
                  : verdictLabel === 'BLOCKED' || verdictLabel === 'NEEDS ATTENTION'
                  ? 'failed'
                  : verdictLabel === 'IN PROGRESS'
                  ? 'info'
                  : 'neutral';

                // Compute coverage numbers from Map data
                const totalElements = pages.reduce((s: number, p: any) => s + (p.elementCount || p.elements?.length || 0), 0);
                const authPagesCount = pages.filter((p: any) => p.requiresAuth || p.authRequired || p.type === 'authenticated').length;
                const publicPagesCount = pages.length - authPagesCount;

                // Timestamp helpers
                const fmtDate = (iso?: string) => iso ? new Intl.DateTimeFormat('id-ID', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                }).format(new Date(iso)) + ' WIB' : '—';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* EXECUTIVE REPORT DOCUMENT SHEET */}
                    <div className="report-document-sheet">

                      {/* ── KOP SURAT / DOCUMENT HEADER ── */}
                      <div className="report-doc-header">
                        <div className="report-doc-brand">
                          <div className="report-doc-kicker">
                            <Icon name="shield" size={12} /> QC Maestro &middot; Executive Quality Audit Report
                          </div>
                          <h1 className="report-doc-title">
                            {activeJob.name || activeJob.config?.name || 'Audit Kualitas Aplikasi'}
                          </h1>
                          <div className="report-doc-ref">
                            <span>JOB:</span>
                            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{activeJob.id}</code>
                            <span style={{ color: '#DBC4AC' }}>&middot;</span>
                            <span>{fmtDate(activeJob.createdAt)}</span>
                          </div>
                        </div>
                        <div className="report-doc-verdict-box">
                          <span className={`linear-status-badge ${verdictClass}`} style={{ fontSize: 12, padding: '6px 14px' }}>
                            <span className="led-dot" />
                            {verdictLabel}
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#FAF6F1',
                            border: '1px solid #DBC4AC',
                            color: '#7B6858'
                          }}>
                            {(activeJob.config?.platform || 'WEB').toUpperCase()}
                          </span>
                          <div className="report-doc-date">{wibClock}</div>
                        </div>
                      </div>

                      {/* ── EXECUTIVE TELEMETRY STRIP (5 KPIs) ── */}
                      <div className="fr-telemetry-strip">
                        <div className="fr-telemetry-item">
                          <div className="fr-telemetry-label">
                            <Icon name="shield" size={13} /> QA Health Score
                          </div>
                          <div className="fr-telemetry-val" style={{
                            color: healthScore == null ? '#7B6858' : healthScore >= 80 ? '#15803D' : '#DC2626'
                          }}>
                            {healthScore != null ? `${healthScore}%` : '—'}
                          </div>
                          <div className="fr-telemetry-sub">
                            {hasRunData
                              ? (healthScore! >= 80 ? 'Evaluasi Mutu Baik' : 'Terdeteksi Isu')
                              : (isJobFailed ? 'Discovery gagal' : 'Belum ada eksekusi')}
                          </div>
                        </div>

                        <div className="fr-telemetry-item">
                          <div className="fr-telemetry-label">
                            <Icon name="runs" size={13} /> Verifikasi Skenario
                          </div>
                          <div className="fr-telemetry-val">
                            {hasRunData ? `${passedRuns}/${totalRuns}` : (activeJob.flows?.length ?? 0)}
                          </div>
                          <div className="fr-telemetry-sub">
                            {hasRunData
                              ? `${Math.round((passedRuns / totalRuns) * 100)}% lolos`
                              : 'flow siap uji'}
                          </div>
                        </div>

                        <div className="fr-telemetry-item">
                          <div className="fr-telemetry-label">
                            <Icon name="warning" size={13} /> Defect Terdeteksi
                          </div>
                          <div className="fr-telemetry-val" style={{
                            color: totalDefectsCombined > 0 ? '#DC2626' : '#15803D'
                          }}>
                            {totalDefectsCombined}
                          </div>
                          <div className="fr-telemetry-sub">
                            {userAppErrorsTotal} Aplikasi &middot; {qcEngineErrorsTotal} Runner
                          </div>
                        </div>

                        <div className="fr-telemetry-item">
                          <div className="fr-telemetry-label">
                            <Icon name="globe" size={13} /> Cakupan Arsitektur
                          </div>
                          <div className="fr-telemetry-val">{pages.length}</div>
                          <div className="fr-telemetry-sub">
                            {publicPagesCount} publik &middot; {authPagesCount} auth
                          </div>
                        </div>

                        <div className="fr-telemetry-item">
                          <div className="fr-telemetry-label">
                            <Icon name="media" size={13} /> Bukti Visual
                          </div>
                          <div className="fr-telemetry-val">{galleryItems.length}</div>
                          <div className="fr-telemetry-sub">screenshot tersimpan</div>
                        </div>
                      </div>

                      {/* ── SECTION 1: PROFIL & LINGKUNGAN TARGET ── */}
                      <div className="report-section-block">
                        <h2 className="report-section-title">
                          <span className="section-num">01</span>
                          <Icon name="globe" size={15} /> Profil &amp; Lingkungan Target
                        </h2>
                        <div className="report-profile-grid">
                          <div className="report-profile-card">
                            <span className="card-label">Base URL / Target</span>
                            <span className="card-val">
                              <code>{activeJob.config?.baseUrl || '—'}</code>
                            </span>
                          </div>
                          <div className="report-profile-card">
                            <span className="card-label">Platform</span>
                            <span className="card-val">{(activeJob.config?.platform || 'Web').toUpperCase()}</span>
                          </div>
                          <div className="report-profile-card">
                            <span className="card-label">Mode Pengujian</span>
                            <span className="card-val">
                              <code>{activeJob.config?.runMode || 'STANDARD'}</code>
                            </span>
                          </div>
                          <div className="report-profile-card">
                            <span className="card-label">Database Engine</span>
                            <span className="card-val">
                              <code>{activeJob.config?.database?.engine || 'N/A'}</code>
                            </span>
                          </div>
                          <div className="report-profile-card">
                            <span className="card-label">Mulai Dijalankan</span>
                            <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {fmtDate(activeJob.createdAt)}
                            </span>
                          </div>
                          <div className="report-profile-card">
                            <span className="card-label">Selesai / Durasi</span>
                            <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {activeJob.finishedAt ? fmtDate(activeJob.finishedAt) : (isRunning ? 'Sedang berjalan...' : '—')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ── SECTION 2: CAKUPAN ARSITEKTUR ── */}
                      {pages.length > 0 && (
                        <div className="report-section-block">
                          <h2 className="report-section-title">
                            <span className="section-num">02</span>
                            <Icon name="map" size={15} /> Cakupan Arsitektur &amp; Skenario
                          </h2>
                          <div className="report-profile-grid">
                            <div className="report-profile-card">
                              <span className="card-label">Total Halaman Terpetakan</span>
                              <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 850 }}>{pages.length}</span>
                            </div>
                            <div className="report-profile-card">
                              <span className="card-label">Halaman Publik</span>
                              <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 850 }}>{publicPagesCount}</span>
                            </div>
                            <div className="report-profile-card">
                              <span className="card-label">Halaman Auth</span>
                              <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 850 }}>{authPagesCount}</span>
                            </div>
                            <div className="report-profile-card">
                              <span className="card-label">Elemen DOM Dipindai</span>
                              <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 850 }}>{totalElements > 0 ? totalElements : '—'}</span>
                            </div>
                            <div className="report-profile-card">
                              <span className="card-label">File Modul Dipindai</span>
                              <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 850 }}>{filesScanned}</span>
                            </div>
                            <div className="report-profile-card">
                              <span className="card-label">Alur Bisnis Terdaftar</span>
                              <span className="card-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 850 }}>{activeJob.flows?.length ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── SECTION 3: HASIL VERIFIKASI SKENARIO ── */}
                      <div className="report-section-block">
                        <h2 className="report-section-title">
                          <span className="section-num">03</span>
                          <Icon name="runs" size={15} /> Hasil Verifikasi Skenario
                        </h2>

                        {!hasRunData ? (
                          /* Belum ada eksekusi */
                          <div style={{
                            background: isJobFailed ? '#FEF2F2' : '#EFF6FF',
                            border: `1px solid ${isJobFailed ? '#FCA5A5' : '#BFDBFE'}`,
                            borderRadius: 8,
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 14
                          }}>
                            <Icon name={isJobFailed ? 'warning' : 'shield'} size={20} />
                            <div>
                              <strong style={{ fontSize: 13.5, fontWeight: 800, color: isJobFailed ? '#DC2626' : '#1D4ED8', display: 'block', marginBottom: 6 }}>
                                {isJobFailed
                                  ? `Discovery berhenti — Status: ${activeJob.status}`
                                  : `${activeJob.flows?.length ?? 0} Skenario Siap — Belum Dieksekusi`}
                              </strong>
                              <p style={{ margin: 0, fontSize: 12.5, color: '#7B6858', lineHeight: 1.55 }}>
                                {isJobFailed
                                  ? (failureErrorText || 'Proses gagal pada tahap inisialisasi runtime.')
                                  : `Discovery selesai: ${filesScanned} modul & ${pages.length} rute terpetakan. Jalankan skenario test untuk menghasilkan metrik kelulusan.`}
                              </p>
                              {isJobFailed && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                  <button type="button" className="tool-btn primary"
                                    onClick={() => handleRestartJob(activeJob.id)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                    <Icon name="refresh" size={13} /> Retry
                                  </button>
                                  <button type="button" className="tool-btn"
                                    onClick={() => setCurrentView('discovery')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                    <Icon name="terminal" size={13} /> Live Terminal
                                  </button>
                                </div>
                              )}
                              {!isJobFailed && (
                                <button type="button" className="tool-btn primary"
                                  onClick={() => setCurrentView('flows')}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 10 }}>
                                  <Icon name="runs" size={13} /> Buka Skenario Test &amp; Mulai Eksekusi
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Ada data eksekusi — tabel kompak */
                          <>
                            {/* Filter satu baris */}
                            {attemptsList.length > 1 && (
                              <div className="fr-filter-bar" style={{ marginBottom: 0 }}>
                                <div className="fr-filter-group">
                                  <span className="fr-filter-label"><Icon name="refresh" size={12} /> Sesi:</span>
                                  {attemptsList.map(att => {
                                    const isSelected = (reportAttempt === 'latest' && att.isLatest) || reportAttempt === att.id;
                                    return (
                                      <button key={att.id} type="button"
                                        className={`tool-btn ${isSelected ? 'primary' : ''}`}
                                        style={{ borderRadius: 999, fontSize: 11, padding: '3px 10px' }}
                                        onClick={() => setReportAttempt(att.id)}>
                                        #{att.num} ({att.rate}%)
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="fr-filter-group">
                                  <span className="fr-filter-label"><Icon name="search" size={12} /> Filter:</span>
                                  {(['all', 'PASSED', 'FAILED'] as const).map(f => (
                                    <button key={f} type="button"
                                      className={`tool-btn ${reportStatusFilter === f ? (f === 'FAILED' ? 'active' : 'primary') : ''}`}
                                      style={{ borderRadius: 999, fontSize: 11, padding: '3px 10px', borderColor: f === 'FAILED' && failedRuns > 0 ? 'var(--red)' : undefined }}
                                      onClick={() => setReportStatusFilter(f)}>
                                      {f === 'all' ? `Semua (${resultsForAttempt.length})` : f === 'PASSED' ? `Lolos (${passedRuns})` : `Gagal (${failedRuns})`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="table-wrap">
                              <table className="fr-compact-table">
                                <thead>
                                  <tr>
                                    <th>Skenario / Alur</th>
                                    <th>Status</th>
                                    <th>Steps</th>
                                    <th>Durasi</th>
                                    <th>Bukti</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {results.map((res: any, i: number) => {
                                    const flowObj = activeJob.flows?.find((f: any) => f.id === res.flowId);
                                    const passedSteps = (res.steps || []).filter((s: any) => s.status === 'PASSED').length;
                                    const totalSteps = (res.steps || []).length;
                                    const flowScreenshots = (res.artifacts || []).filter((a: any) => {
                                      const p = typeof a === 'string' ? a : a?.path || a?.url || '';
                                      return p.toLowerCase().endsWith('.png') || p.toLowerCase().endsWith('.jpg');
                                    });
                                    const durationMs = res.finishedAt && res.startedAt
                                      ? new Date(res.finishedAt).getTime() - new Date(res.startedAt).getTime()
                                      : null;
                                    const durationStr = durationMs != null
                                      ? durationMs >= 60000
                                        ? `${Math.round(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`
                                        : `${(durationMs / 1000).toFixed(1)}s`
                                      : '—';
                                    return (
                                      <tr key={i}>
                                        <td>
                                          <strong style={{ fontSize: 13, color: '#14181D', display: 'block' }}>
                                            {flowObj?.name || res.flowId}
                                          </strong>
                                          <code style={{ fontSize: 10.5, color: '#8E7C6C', fontFamily: 'var(--font-mono)' }}>{res.flowId}</code>
                                        </td>
                                        <td>
                                          <span className={`linear-status-badge ${res.status === 'PASSED' ? 'passed' : 'failed'}`}>
                                            <span className="led-dot" />
                                            {res.status === 'PASSED' ? 'PASSED' : 'FAILED'}
                                          </span>
                                        </td>
                                        <td>
                                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#7B6858', fontVariantNumeric: 'tabular-nums' }}>
                                            {passedSteps}/{totalSteps}
                                          </span>
                                        </td>
                                        <td>
                                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#7B6858' }}>
                                            {durationStr}
                                          </span>
                                        </td>
                                        <td>
                                          {flowScreenshots.length > 0 ? (
                                            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                              {flowScreenshots.slice(0, 3).map((art: any, artIdx: number) => {
                                                const raw = typeof art === 'string' ? art : (art.path || art.url);
                                                const resolved = artifactUrl(activeJob.id, raw);
                                                if (!resolved) return null;
                                                return (
                                                  <button key={artIdx} type="button"
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                                    onClick={() => setFullScreenshot(resolved)}>
                                                    <img src={resolved} alt="Bukti"
                                                      style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #DBC4AC' }} />
                                                  </button>
                                                );
                                              })}
                                              {flowScreenshots.length > 3 && (
                                                <span style={{ fontSize: 11, color: '#8E7C6C' }}>+{flowScreenshots.length - 3}</span>
                                              )}
                                            </div>
                                          ) : (
                                            <span style={{ fontSize: 12, color: '#A89B8F' }}>—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── SECTION 4: CATATAN DEFECT (hanya jika ada) ── */}
                      {allFailedSteps.length > 0 && (
                        <div className="report-section-block">
                          <h2 className="report-section-title">
                            <span className="section-num">04</span>
                            <Icon name="warning" size={15} /> Catatan Defect &amp; Error Traceback ({allFailedSteps.length})
                          </h2>
                          <Paginated items={allFailedSteps}>{(failedPage, start) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {failedPage.map((b: any, idx: number) => {
                                const isEngine = b.errorOrigin === 'qc_maestro_engine';
                                const failureScreenshot = (b.artifacts || []).find((art: any) => {
                                  const p = typeof art === 'string' ? art : art?.path || art?.url || '';
                                  return p.toLowerCase().includes('failure') || (p.toLowerCase().endsWith('.png') && p.toLowerCase().includes(`step-${(b.step.index ?? 0) + 1}`));
                                });
                                const rawPath = typeof failureScreenshot === 'string' ? failureScreenshot : (failureScreenshot as any)?.path || (failureScreenshot as any)?.url;
                                const resolvedSS = rawPath ? artifactUrl(activeJob.id, rawPath) : null;
                                return (
                                  <div key={idx} className={`defect-ledger-card ${isEngine ? 'origin-qc-engine' : 'origin-user-app'}`}>
                                    <div className="defect-header-row">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span className={`defect-origin-pill ${isEngine ? 'qc-engine' : 'user-app'}`}>
                                          ●  {isEngine ? 'RUNNER QC' : 'APLIKASI TARGET'}
                                        </span>
                                        <strong style={{ fontSize: 13, color: 'var(--text-main, #ffffff)' }}>
                                          Defect #{start + idx + 1}: &ldquo;{b.flowId}&rdquo; — {b.step.action}
                                        </strong>
                                      </div>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                                        RUN: {b.runId}
                                      </span>
                                    </div>
                                    <pre className={`defect-diagnostic-msg ${isEngine ? 'engine-code' : ''}`}>
                                      {b.step.errorMessage || 'Unknown execution failure'}
                                    </pre>
                                    {resolvedSS && (
                                      <button type="button" onClick={() => setFullScreenshot(resolvedSS)}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                        <img src={resolvedSS} alt="Failure Screenshot"
                                          style={{ width: 52, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #ef4444' }} />
                                        <span style={{ fontSize: 11, color: '#fca5a5' }}>Tangkapan layar saat error (klik perbesar)</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}</Paginated>
                        </div>
                      )}

                      {/* ── SIGN-OFF / VERDICT ── */}
                      <div className="report-signoff-box">
                        <div className="report-signoff-meta">
                          <strong>Digital Audit Signature</strong>
                          <small>
                            Dihasilkan otomatis oleh QC Maestro Engine &middot; {fmtDate(activeJob.finishedAt || activeJob.createdAt)}
                          </small>
                          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                            Job ID: {activeJob.id}
                          </small>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div className={`report-signoff-stamp ${isJobFailed ? '' : ''}`} style={
                            isJobFailed
                              ? { borderColor: '#DC2626', background: '#FEF2F2', color: '#DC2626' }
                              : !hasRunData
                              ? { borderColor: '#B45309', background: '#FFFBEB', color: '#B45309' }
                              : runsScore != null && runsScore >= 80
                              ? {}
                              : { borderColor: '#DC2626', background: '#FEF2F2', color: '#DC2626' }
                          }>
                            <Icon name={isJobFailed ? 'warning' : runsScore != null && runsScore >= 80 ? 'check' : 'warning'} size={13} />
                            {verdictLabel}
                          </div>
                          {galleryItems.length > 0 && (
                            <button type="button" className="tool-btn"
                              onClick={() => setReportSubTab('gallery')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <Icon name="media" size={13} /> {galleryItems.length} Screenshot
                            </button>
                          )}
                          {videoItems.length > 0 && (
                            <button type="button" className="tool-btn"
                              onClick={() => setReportSubTab('videos')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <Icon name="runs" size={13} /> {videoItems.length} Video
                            </button>
                          )}
                          {activeJobId && isCompleted && (
                            <button type="button" className="tool-btn"
                              onClick={() => window.open(`/api/v1/discovery/jobs/${activeJobId}/report?format=html&attempt=${reportAttempt}&status=${reportStatusFilter}`, '_blank')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <Icon name="overview" size={13} /> Dokumen HTML Lengkap
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SUBTAB GALERI SCREENSHOT (tersembunyi, dimunculkan via tombol di sign-off) */}
                    {reportSubTab === 'gallery' && galleryItems.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <strong style={{ fontSize: 14, fontWeight: 800, color: '#14181D' }}>
                            <Icon name="media" size={15} /> Galeri Screenshot Bukti ({galleryItems.length})
                          </strong>
                          <button type="button" className="tool-btn" onClick={() => setReportSubTab('summary')}
                            style={{ fontSize: 12 }}>←  Kembali ke Laporan</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                          {galleryItems.map((item, idx) => (
                            <div key={idx} style={{ background: '#FFFFFF', border: '1.5px solid #DBC4AC', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(70,50,35,0.05)' }}>
                              <div style={{ background: '#0F172A', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                                onClick={() => setFullScreenshot(item.url)}>
                                <img src={item.url} alt={item.label} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                              </div>
                              <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ minWidth: 0 }}>
                                  <strong style={{ fontSize: 12, color: '#14181D', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</strong>
                                  <small style={{ color: '#8E7C6C', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{item.name}</small>
                                </div>
                                <a href={item.url} download={item.name} className="tool-btn"
                                  style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Icon name="download" size={11} />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SUBTAB VIDEO (tersembunyi, dimunculkan via tombol di sign-off) */}
                    {reportSubTab === 'videos' && videoItems.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <strong style={{ fontSize: 14, fontWeight: 800, color: '#14181D' }}>
                            <Icon name="runs" size={15} /> Rekaman Video Eksekusi ({videoItems.length})
                          </strong>
                          <button type="button" className="tool-btn" onClick={() => setReportSubTab('summary')}
                            style={{ fontSize: 12 }}>←  Kembali ke Laporan</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                          {videoItems.map((v, vIdx) => (
                            <div key={vIdx} style={{ background: '#FFFFFF', border: '1.5px solid #DBC4AC', borderRadius: 10, overflow: 'hidden' }}>
                              <video controls playsInline preload="metadata" src={v.url} style={{ width: '100%', maxHeight: 340, display: 'block', background: '#000' }} />
                              <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ fontSize: 12, color: '#14181D', display: 'block' }}>Flow: {v.flowName}</strong>
                                  <small style={{ color: '#8E7C6C', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{v.name}</small>
                                </div>
                                <a href={v.url} download={v.name} className="tool-btn"
                                  style={{ fontSize: 11, padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Icon name="download" size={11} />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}


          {/* VIEW: MEDIA */}
          {currentView === 'evidence' && (
            <div className="zannora-evidence-view">
              <div className="view-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="evidence-title-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h1 style={{ margin: 0 }}>Media</h1>
                    <span className="evidence-project-chip">
                      {evidenceSubTab === 'gallery' ? 'MEDIA & SCREENSHOT VIEWER' : 'AUDIT ARTIFACT INDEX'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                    {evidenceSubTab === 'gallery'
                      ? 'Penampil rekaman video flow dan arsip screenshot checkpoint dengan stage interaktif, zoom, dan filter.'
                      : 'Semua report JSON, kelompok pengujian, dan folder evidence dikelompokkan berdasarkan bagian yang diuji.'}
                  </p>
                </div>
                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'inline-flex', background: 'var(--bg-panel-sub)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <button
                      className="tool-btn"
                      onClick={() => setEvidenceSubTab('gallery')}
                      style={{
                        background: evidenceSubTab === 'gallery' ? 'var(--cyan-surface)' : 'transparent',
                        color: evidenceSubTab === 'gallery' ? 'var(--cyan)' : 'var(--text-muted)',
                        borderColor: evidenceSubTab === 'gallery' ? 'var(--cyan)' : 'transparent',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 13,
                        fontWeight: evidenceSubTab === 'gallery' ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Icon name="reports" size={14} /> Galeri Screenshot &amp; Video
                    </button>
                    <button
                      className="tool-btn"
                      onClick={() => setEvidenceSubTab('audit')}
                      style={{
                        background: evidenceSubTab === 'audit' ? 'var(--cyan-surface)' : 'transparent',
                        color: evidenceSubTab === 'audit' ? 'var(--cyan)' : 'var(--text-muted)',
                        borderColor: evidenceSubTab === 'audit' ? 'var(--cyan)' : 'transparent',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 13,
                        fontWeight: evidenceSubTab === 'audit' ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Icon name="database" size={14} /> Dokumen Audit &amp; JSON
                    </button>
                  </div>
                  <button className="tool-btn" onClick={() => flowSource === 'zannora' ? void refreshZannoraEvidence() : void refreshTargetEvidence(activeJobId)} disabled={evidenceLoading}>
                    <Icon name="refresh" size={15} /> {evidenceLoading ? 'Memuat...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {evidenceSubTab === 'gallery' ? (
                <LiveViewport
                  job={flowSource === 'job' ? activeJob : null}
                  evidence={activeEvidence}
                  hideHeader
                />
              ) : (
                <>
                  {evidenceError && <Notice error>{evidenceError}</Notice>}
                  {evidenceLoading && !activeEvidence && <div className="inline-empty">Membaca seluruh evidence target dari folder QC...</div>}
                  {!evidenceLoading && !activeEvidence && !evidenceError && <div className="inline-empty">Evidence target belum tersedia.</div>}

                  {activeEvidence && (
                    <>
                      <div className="evidence-summary-grid">
                        <div className="evidence-summary-card"><span>Bagian diuji</span><strong>{activeEvidence.totals.groups}</strong><small>{activeEvidence.totals.passed} lulus · {activeEvidence.totals.failed} perlu perhatian</small></div>
                        <div className="evidence-summary-card"><span>Report JSON</span><strong>{activeEvidence.totals.reports}</strong><small>Report per kategori tersedia</small></div>
                        <div className="evidence-summary-card"><span>Screenshot</span><strong>{activeEvidence.totals.screenshots}</strong><small>Bukti visual yang bisa diperbesar</small></div>
                        <div className="evidence-summary-card"><span>Video</span><strong>{activeEvidence.totals.videos}</strong><small>Video flow dengan kontrol playback</small></div>
                      </div>

                      <div className="evidence-filter-bar">
                        <span>LIHAT BAGIAN:</span>
                        <button className={`tool-btn ${evidenceGroupFilter === 'all' ? 'active' : ''}`} onClick={() => setEvidenceGroupFilter('all')}>Semua ({activeEvidence.groups.length})</button>
                        {[...new Set(activeEvidence.groups.map((group) => group.category))].map((category) => (
                          <button key={category} className={`tool-btn ${evidenceGroupFilter === category ? 'active' : ''}`} onClick={() => setEvidenceGroupFilter(category)}>{category}</button>
                        ))}
                      </div>

                      <EvidenceInspector focus={evidenceFocus} evidence={activeEvidence} onClose={() => setEvidenceFocus(null)} onOpenAsset={(asset) => setFullScreenshot(asset.url)} />

                      <div className="evidence-groups">
                        <Paginated items={activeEvidence.groups.filter((group) => evidenceGroupFilter === 'all' || group.category === evidenceGroupFilter)} resetKey={evidenceGroupFilter}>{(visibleGroups) => visibleGroups.map((group) => (
                          <Panel key={group.id} className="evidence-group-panel">
                            <div className="evidence-group-heading">
                              <div>
                                <div className="evidence-group-kicker">{group.category}</div>
                                <h2>{group.title}</h2>
                                <p>{group.summary}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Badge value={group.status} /><button className="quiet evidence-inline-open-btn" onClick={() => setEvidenceFocus({ groupId: group.id })}>Inspect inline</button></div>
                            </div>
                            <div className="evidence-folder-row">
                              <span><Icon name="database" size={14} /> Folder evidence</span>
                              <code>{group.folder}</code>
                              {group.report && <a href={group.report.url} target="_blank" rel="noreferrer">Buka report JSON ← —</a>}
                            </div>

                            {group.videos.length > 0 && (
                              <div className="evidence-section">
                                <div className="evidence-section-title"><span>VIDEO FLOW</span><small>{group.videos.length} file</small></div>
                                <Paginated items={group.videos} resetKey={group.id}>{(videos) => <div className="evidence-video-grid">
                                  {videos.map((asset: EvidenceAsset) => (
                                    <div className="evidence-video-card" key={asset.relativePath}>
                                      <video controls preload="metadata" src={asset.url} onClick={() => setEvidenceFocus({ groupId: group.id, asset })} />
                                      <div className="evidence-asset-footer"><div><strong>{asset.label}</strong><small>{asset.relativePath}</small></div><a href={asset.url} download>Download</a></div>
                                    </div>
                                  ))}
                                </div>}</Paginated>
                              </div>
                            )}

                            {group.screenshots.length > 0 && <ScreenshotGallery assets={group.screenshots} selectedPath={evidenceFocus?.asset?.relativePath} onOpen={(asset) => { setEvidenceFocus({ groupId: group.id, asset }); setFullScreenshot(asset.url); }} collapsible resetToken={group.id} />}

                            <div className="evidence-asset-count"><span>{group.assets.length} total artifact terindeks</span><span>Updated {date(group.report?.updatedAt || group.assets[0]?.updatedAt)}</span></div>
                          </Panel>
                        ))}</Paginated>
                      </div>
                    </>
                  )}
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

                {ENABLE_MOBILE_SUPPORT && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )}

          {/* VIEW: MEDIA & REKAMAN (MEDIA GALLERY) */}
          {currentView === 'live' && (
            <LiveViewport job={flowSource === 'job' ? activeJob : null} evidence={flowSource === 'zannora' ? zannoraEvidence : targetEvidence} />
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
