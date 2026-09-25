import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Job, Page, Flow, Result, Step, SystemStatus, View, ZannoraEvidence, EvidenceAsset, EvidenceGroup, EvidenceFinding, CapabilityProfile, RunHistoryEntry, FindingWorkflowStatus, FeatureContractPlan } from './types';
import { Icon, Badge, Panel, Metric, Progress, Notice, Empty } from './ui';
import { Wizard } from './wizard';
import { LiveViewport } from './live-viewport';
import { request, send, jobPath, artifactUrl, downloadReport, date, duration, errorText } from './api';

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
        {profile.capabilities.map((capability) => (
          <details key={capability.id} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-panel-sub)' }}>
            <summary style={{ cursor: 'pointer', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: capability.status === 'detected' ? 'var(--green)' : 'var(--yellow)' }}>●</span>
              <strong style={{ flex: 1 }}>{capability.label}</strong>
              <small style={{ color: 'var(--text-dim)' }}>{Math.round(capability.confidence * 100)}%</small>
            </summary>
            <div style={{ padding: '0 12px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
              <div>{capability.rationale}</div>
              <div style={{ marginTop: 6 }}>Routes: {capability.evidence.routes.length} · API: {capability.evidence.apiRoutes.length} · Checks: {capability.recommendedChecks.length}</div>
              {capability.evidence.routes.length > 0 && <code style={{ display: 'block', marginTop: 6, color: 'var(--cyan)', whiteSpace: 'normal' }}>{capability.evidence.routes.slice(0, 5).join(' · ')}</code>}
            </div>
          </details>
        ))}
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
          <div className="milestone-kicker">LIVE MILESTONE FLOW / {nodes.length} CHECKPOINTS</div>
          <h2>Website Milestone Flow</h2>
          <p>Alur QC dari input website sampai final report. Klik milestone untuk melihat substep, cabang, dan outputnya.</p>
        </div>
        <div className={`milestone-live-badge ${isLive ? 'is-live' : 'is-snapshot'}`}><span className="milestone-live-dot" /><div><strong>{isLive ? 'LIVE MILESTONE FLOW' : 'EVIDENCE SNAPSHOT'}</strong><small>{sourceLabel}</small></div></div>
      </div>

      <div className="milestone-flow-canvas">
        <div className="milestone-grid" />
        <div className="milestone-watermark">WEBSITE PROJECT MILESTONE FLOW</div>
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
      {group.screenshots.length > 0 && <div className="evidence-inline-section"><div className="evidence-section-title"><span>SCREENSHOT YANG PERLU DICEK</span><small>{group.screenshots.length} checkpoint</small></div><div className="evidence-screenshot-grid">{group.screenshots.map((asset) => <button className={`evidence-screenshot-card ${focus.asset?.relativePath === asset.relativePath ? 'selected' : ''}`} key={asset.relativePath} onClick={() => { onOpenAsset(asset); }} title="Buka screenshot checkpoint"><img src={asset.url} alt={asset.label} loading="lazy" /><span>{asset.name}</span></button>)}</div></div>}
    </section>
  );
}

function findingScreenshot(evidence: ZannoraEvidence | null, finding: EvidenceFinding) {
  const group = evidence?.groups.find((item) => item.id === finding.groupId);
  if (!group) return undefined;
  if (finding.screenshot) return group.screenshots.find((asset) => asset.relativePath === finding.screenshot);
  return group.screenshots.find((asset) => finding.route && asset.label.includes(finding.route));
}

function findingDescription(finding: EvidenceFinding) {
  const route = finding.route || 'halaman yang diuji';
  switch (finding.area) {
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
        {screenshot ? <a className="finding-evidence-image" href={screenshot.url} target="_blank" rel="noreferrer"><img src={screenshot.url} alt={`Screenshot bukti ${finding.name || 'finding'}`} /><span>Buka screenshot penuh ↗</span></a> : <div className="finding-evidence-no-image">Screenshot untuk checkpoint ini belum tersedia.</div>}
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
    <div className="table-wrap"><table><thead><tr><th>Run</th><th>Status</th><th>Progress</th><th>Quality</th><th>Updated</th></tr></thead><tbody>{history.map((entry) => {
      const quality = entry.quality;
      return <tr key={entry.runLabel}><td><strong>{entry.runLabel}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{entry.project}</small></td><td><Badge value={quality?.status || entry.status} /></td><td>{entry.progress ?? 0}%</td><td>{quality ? `${quality.passed ?? 0}/${quality.total ?? 0} passed · ${quality.failed ?? 0} failed · ${quality.notApplicable ?? 0} N/A` : 'Quality report belum ada'}</td><td>{date(entry.updatedAt || entry.createdAt)}</td></tr>;
    })}</tbody></table></div>
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
      <div className="view-header"><div><h1>Project Summary · Zannora</h1><p>Snapshot real dari evidence QC terakhir. Semua angka di bawah berasal dari report yang tersimpan.</p></div><div className="header-actions"><button className="quiet" onClick={() => onNavigate('process')}><Icon name="map" size={15} /> Milestone Flow</button><button className="primary" onClick={() => onNavigate('evidence')}><Icon name="reports" size={15} /> Evidence Center</button></div></div>
      <div className="metric-grid">
        <Metric tone="cyan" label="Route Terpetakan" value={routes.length} note="route pada quality scope" icon="map" onClick={() => onNavigate('map')} />
        <Metric tone="violet" label="Test Design Suites" value={designGroups.length} note={designGroups.reduce((n, group) => n + evidenceMetric(group).total, 0) + ' assertion'} icon="flows" onClick={() => onNavigate('flows')} />
        <Metric tone="yellow" label="Execution Checks" value={executionMetric.total} note={executionMetric.passed + ' passed · ' + (executionMetric.total - executionMetric.passed) + ' failed'} icon="runs" onClick={() => onNavigate('runs')} />
        <Metric tone="green" label="Pass Rate" value={passRate + '%'} note={findings + ' open finding'} icon="warning" onClick={() => onNavigate('findings')} />
      </div>
      <Panel title="Zannora Evidence Snapshot" description={'Generated ' + date(evidence.generatedAt) + ' · ' + evidence.totals.assets + ' artifact terindeks'}>
        <div className="table-wrap"><table><thead><tr><th>Suite</th><th>Status</th><th>Coverage</th><th>Evidence</th><th>Action</th></tr></thead><tbody>{evidence.groups.map((group) => { const metric = evidenceMetric(group); return <tr key={group.id}><td><strong>{group.title}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{group.category}</small></td><td><Badge value={group.status} /></td><td>{metric.passed}/{metric.total}</td><td>{group.screenshots.length} screenshot · {group.videos.length} video</td><td><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Inspect <Icon name="arrow" size={12} /></button></td></tr>; })}</tbody></table></div>
      </Panel>
    </div>
  );
}

function ZannoraDiscovery({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const routes = zannoraRoutes(evidence);
  return <div><div className="view-header"><div><h1>Discovery &amp; Inventory · Zannora</h1><p>Inventory diambil dari scope quality/responsive dan suite yang benar-benar dijalankan.</p></div><span className="evidence-project-chip">LIVE EVIDENCE SNAPSHOT</span></div><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, .75fr)', gap: 18 }}><Panel title={'Evidence pipeline (' + evidence.groups.length + ' suites)'}><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{evidence.groups.map((group) => { const metric = evidenceMetric(group); return <button key={group.id} className="milestone-related-evidence-card" onClick={() => onOpenEvidence(group.id)}><span><strong>{group.title}</strong><small>{metric.passed}/{metric.total} checks · {group.assets.length} asset · {date(group.report?.updatedAt)}</small></span><Badge value={group.status} /><Icon name="arrow" size={13} /></button>; })}</div></Panel><Panel title={'Route scope (' + routes.length + ')'}><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{routes.length ? routes.map((route) => <code key={route} style={{ color: 'var(--cyan)', padding: '8px 10px', background: 'var(--bg-panel)', borderRadius: 6 }}>{route}</code>) : <Empty title="Route scope belum tersedia">Report suite belum membawa daftar route.</Empty>}</div></Panel></div></div>;
}

function ZannoraAppMap({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const routes = zannoraRoutes(evidence);
  const quality = evidence.groups.find((group) => group.id === 'quality');
  return <div><div className="view-header"><div><h1>App Map · Zannora</h1><p>Route inventory real dari report quality, dengan browser, viewport, dan status evidence.</p></div><button className="primary" onClick={() => onOpenEvidence('quality')}><Icon name="reports" size={15} /> Inspect quality evidence</button></div><div className="split-view"><div className="list-pane"><div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Routes ({routes.length})</div>{routes.map((route) => <div key={route} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}><strong>{route}</strong><small style={{ display: 'block', marginTop: 5, color: 'var(--text-dim)' }}>covered by quality audit · desktop / tablet / mobile</small></div>)}</div><div className="detail-pane"><Panel title="Inventory source" description={quality?.summary}><div className="evidence-inline-meta"><Badge value={quality?.status ?? 'UNKNOWN'} /><span>{quality?.metadata?.browsers?.join(' · ') || 'browser scope unavailable'}</span><span>{quality?.metadata?.viewports?.join(' · ') || 'viewport scope unavailable'}</span></div><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>App Map ini memakai daftar route yang tersimpan di report; bukan data demo atau hasil hitungan statis.</p></Panel><Panel title="Quality coverage"><div className="table-wrap"><table><thead><tr><th>Area</th><th>Checks</th><th>Status</th></tr></thead><tbody>{evidence.groups.filter((group) => group.category === 'UI Quality').map((group) => { const metric = evidenceMetric(group); return <tr key={group.id}><td>{group.title}</td><td>{metric.passed}/{metric.total}</td><td><Badge value={group.status} /></td></tr>; })}</tbody></table></div></Panel></div></div></div>;
}

function ZannoraTestDesign({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const groups = evidence.groups.filter((group) => ['API & CRUD', 'Web Flow'].includes(group.category));
  return <div><div className="view-header"><div><h1>Test Design · Zannora</h1><p>Suite nyata yang menjadi dasar test design: API, CRUD, role access, navigation, dan full flow.</p></div><button className="quiet" onClick={() => onOpenEvidence('api-e2e')}><Icon name="reports" size={15} /> Open source evidence</button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>{groups.map((group) => { const metric = evidenceMetric(group); return <Panel key={group.id} title={group.title} description={group.summary} actions={<Badge value={group.status} />}><div className="evidence-inline-meta"><strong>{metric.passed}/{metric.total}</strong><span>{group.category}</span></div><div className="evidence-asset-count"><span>{group.assets.length} artifact</span><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Detail &amp; evidence <Icon name="arrow" size={12} /></button></div></Panel>; })}</div></div>;
}

function CrudCoveragePanel({ plan }: { plan?: import('./types').CrudPlan }) {
  if (!plan) return <Panel title="CRUD coverage"><Empty title="CRUD matrix belum tersedia">Jalankan discovery ulang untuk menyusun resource dan operasi CRUD dari inventory.</Empty></Panel>;
  const labels: Record<string, string> = { list: 'List', detail: 'Detail', create: 'Create', update: 'Update', delete: 'Delete', duplicate: 'Duplicate', 'delete-in-use': 'Delete in-use' };
  const tone = (status: string) => status === 'AVAILABLE' ? 'var(--green)' : status === 'REQUIRES_FIXTURE' ? 'var(--yellow)' : status === 'PLANNED' ? 'var(--cyan)' : 'var(--text-dim)';
  return <Panel title={`CRUD coverage · ${plan.totals.resources} resource`} description="Read-only checks dapat dijalankan otomatis; operasi mutasi menunggu fixture yang dapat di-reset.">
    <div className="evidence-inline-meta" style={{ marginBottom: 12 }}><strong>{plan.totals.available}</strong><span>observed</span><strong>{plan.totals.planned}</strong><span>planned</span><strong>{plan.totals.requiresFixture}</strong><span>fixture required</span></div>
    <div className="table-wrap"><table><thead><tr><th>Resource</th>{Object.values(labels).map((label) => <th key={label}>{label}</th>)}<th>Confidence</th></tr></thead><tbody>{plan.resources.map((resource) => <tr key={resource.id}><td><strong>{resource.name}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{resource.routes.slice(0, 2).join(' · ')}</small></td>{Object.keys(labels).map((operation) => <td key={operation}><span style={{ color: tone(resource.operations[operation as keyof typeof resource.operations]), fontSize: 10, fontWeight: 800 }}>{resource.operations[operation as keyof typeof resource.operations].replace('_', ' ')}</span></td>)}<td>{Math.round(resource.confidence * 100)}%</td></tr>)}</tbody></table></div>
    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 12 }}>{plan.limitations.join(' ')}</p>
  </Panel>;
}

function RoleActionPanel({ plan }: { plan?: import('./types').RoleActionPlan }) {
  if (!plan) return <Panel title="Role & action matrix"><Empty title="Role matrix belum tersedia">Discovery belum menghasilkan kombinasi role, halaman, dan action.</Empty></Panel>;
  const tone = (status: string) => status === 'EXPECTED' ? 'var(--green)' : status === 'CANDIDATE' ? 'var(--yellow)' : 'var(--cyan)';
  return <Panel title={`Role & action matrix · ${plan.roles.join(', ')}`} description="Static evidence menjadi baseline; direct URL, API permission, dan cross-role leakage wajib diverifikasi saat runtime.">
    <div className="evidence-inline-meta" style={{ marginBottom: 12 }}><strong>{plan.totals.expected}</strong><span>expected</span><strong>{plan.totals.candidate}</strong><span>candidate</span><strong>{plan.totals.runtime}</strong><span>runtime required</span></div>
    <div className="table-wrap"><table><thead><tr><th>Role</th><th>Page</th><th>Auth</th><th>Actions</th><th>Coverage</th></tr></thead><tbody>{plan.rows.slice(0, 80).map((row, index) => <tr key={`${row.role}-${row.page}-${index}`}><td><strong>{row.role}</strong></td><td><code>{row.page}</code></td><td>{row.authentication}</td><td style={{ maxWidth: 300, whiteSpace: 'normal' }}>{row.actions.join(' · ')}</td><td><span style={{ color: tone(row.expectation), fontSize: 10, fontWeight: 800 }}>{row.expectation.replace('_', ' ')}</span></td></tr>)}</tbody></table></div>
    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 12 }}>{plan.limitations.join(' ')}</p>
  </Panel>;
}

function FeatureContractPanel({ plan }: { plan?: FeatureContractPlan }) {
  if (!plan) return <Panel title="Feature test contract"><Empty title="Feature contract belum tersedia">Jalankan discovery ulang untuk memetakan expected UI, API, data, dan skenario per fitur.</Empty></Panel>;
  const scenarioKinds = ['happy', 'negative', 'boundary', 'permission', 'recovery', 'integrity'] as const;
  const tone = (status: string) => status === 'READY_FOR_REVIEW' ? 'var(--green)' : status === 'CANDIDATE' ? 'var(--yellow)' : 'var(--cyan)';
  return <Panel title={`Feature test contract · ${plan.total} fitur`} description="Contract ini memisahkan fitur yang terdeteksi dari fitur yang benar-benar memiliki expected result dan skenario review." actions={<Badge value={`${plan.readyForReview} ready · ${plan.requiresReview} review`} />}>
    <div className="evidence-inline-meta" style={{ marginBottom: 12 }}><strong>{plan.scenarioTotals.happy}</strong><span>happy</span><strong>{plan.scenarioTotals.negative}</strong><span>negative</span><strong>{plan.scenarioTotals.boundary}</strong><span>boundary</span><strong>{plan.scenarioTotals.integrity}</strong><span>integrity</span></div>
    <div className="table-wrap"><table><thead><tr><th>Feature</th><th>Status</th><th>Actors</th><th>Evidence</th><th>Scenarios</th></tr></thead><tbody>{plan.contracts.map((contract) => <tr key={contract.id}><td><strong>{contract.label}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{contract.category} · {Math.round(contract.confidence * 100)}%</small></td><td><span style={{ color: tone(contract.status), fontSize: 10, fontWeight: 800 }}>{contract.status.replace(/_/g, ' ')}</span></td><td>{contract.actors.slice(0, 3).join(' · ')}</td><td>{contract.routes.length} route · {contract.apiRoutes.length} API</td><td>{scenarioKinds.map((kind) => <span key={kind} className="tag" style={{ marginRight: 4 }}>{kind}: {contract.scenarios.filter((scenario) => scenario.kind === kind).length}</span>)}</td></tr>)}</tbody></table></div>
    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 12 }}>{plan.limitations.join(' ')}</p>
  </Panel>;
}

function ZannoraRuns({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  return <div><div className="view-header"><div><h1>Execution Runs · Zannora</h1><p>Ringkasan eksekusi yang dirakit dari report JSON terbaru tiap suite.</p></div><span className="evidence-project-chip">{evidence.totals.passed}/{evidence.totals.groups} SUITES PASSED</span></div><Panel title="Real execution ledger"><div className="table-wrap"><table><thead><tr><th>Run</th><th>Passed / Total</th><th>Failed</th><th>Artifacts</th><th>Report</th></tr></thead><tbody>{evidence.groups.map((group) => { const metric = evidenceMetric(group); return <tr key={group.id}><td><strong>{group.title}</strong><small style={{ display: 'block', color: 'var(--text-dim)' }}>{group.id}</small></td><td>{metric.passed}/{metric.total}</td><td>{metric.failed}</td><td>{group.assets.length}</td><td><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Inspect <Icon name="arrow" size={12} /></button></td></tr>; })}</tbody></table></div></Panel></div>;
}

function ZannoraReport({ evidence, onOpenEvidence }: { evidence: ZannoraEvidence; onOpenEvidence: (id: string) => void }) {
  const total = evidence.groups.reduce((acc, group) => { const metric = evidenceMetric(group); return { passed: acc.passed + metric.passed, total: acc.total + metric.total }; }, { passed: 0, total: 0 });
  return <div><div className="view-header"><div><h1>Final Report · Zannora</h1><p>Executive summary live dari seluruh report dan evidence yang tersedia.</p></div><button className="primary" onClick={() => onOpenEvidence('quality')}><Icon name="reports" size={15} /> Open quality report</button></div><div className="metric-grid"><Metric tone="green" label="Suite Clear" value={evidence.totals.passed + '/' + evidence.totals.groups} note="evidence groups" icon="check" /><Metric tone="cyan" label="Checks Passed" value={total.passed + '/' + total.total} note="across all reports" icon="runs" /><Metric tone="violet" label="Screenshots" value={evidence.totals.screenshots} note="checkpoint evidence" icon="reports" /><Metric tone="yellow" label="Videos" value={evidence.totals.videos} note="flow recording" icon="discovery" /></div><Panel title="Report index"><div className="table-wrap"><table><thead><tr><th>Category</th><th>Summary</th><th>Folder</th><th>Open</th></tr></thead><tbody>{evidence.groups.map((group) => <tr key={group.id}><td><Badge value={group.category} /></td><td>{group.summary}</td><td><code>{group.folder}</code></td><td><button className="quiet" onClick={() => onOpenEvidence(group.id)}>Evidence <Icon name="arrow" size={12} /></button></td></tr>)}</tbody></table></div></Panel></div>;
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
  const [targetEvidence, setTargetEvidence] = useState<ZannoraEvidence | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceGroupFilter, setEvidenceGroupFilter] = useState('all');
  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus>(null);
  const [flowSource, setFlowSource] = useState<'zannora' | 'job'>('job');
  const [findingStatuses, setFindingStatuses] = useState<Record<string, FindingWorkflowStatus>>({});

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

  const refreshTargetEvidence = useCallback(async (jobId: string | null = activeJobId) => {
    if (!jobId) {
      setTargetEvidence(null);
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
    void refreshZannoraEvidence();
  }, [refreshZannoraEvidence]);

  useEffect(() => {
    if (flowSource !== 'job') return;
    void refreshTargetEvidence(activeJobId);
    void refreshRunHistory(activeJobId);
  }, [activeJobId, flowSource, refreshRunHistory, refreshTargetEvidence]);

  // Keep the selected evidence source live. Zannora is the default source, so its report-backed nav data refreshes too.
  useEffect(() => {
    if (flowSource === 'zannora') {
      const timer = window.setInterval(() => void refreshZannoraEvidence(), 5000);
      return () => clearInterval(timer);
    }
    if (!activeJobId || !activeJob || (activeJob.status !== 'RUNNING' && activeJob.status !== 'QUEUED' && currentView !== 'findings')) return;
    const timer = window.setInterval(() => { void refreshTargetEvidence(activeJobId); void refreshRunHistory(activeJobId); }, 5000);
    return () => clearInterval(timer);
  }, [activeJob, activeJobId, currentView, flowSource, refreshRunHistory, refreshTargetEvidence, refreshZannoraEvidence]);

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
    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const failedCount = results.filter(r => r.status === 'FAILED' || r.status === 'INFRA_ERROR').length;
    return { pagesCount, elementsCount, flowsCount, passedCount, failedCount, totalRuns: results.length };
  }, [activeJob]);

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
    const active = flowJob?.status === 'RUNNING' || flowJob?.status === 'QUEUED';
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
    const designStatus: MilestoneStatus = phaseMatches(/FLOW|DESIGN|SYNTHESIS/) ? 'RUNNING' : failedJob && !designReady ? 'ATTENTION' : designReady ? 'CLEAR' : 'READY';
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
  const centralProcessStatus: MilestoneStatus = flowJob?.status === 'RUNNING' || flowJob?.status === 'QUEUED' ? 'RUNNING' : processNodes.some((node) => node.status === 'BLOCKED') ? 'BLOCKED' : processNodes.some((node) => node.status === 'ATTENTION' || node.status === 'RETEST') ? 'ATTENTION' : processProgress === 100 ? 'CLEAR' : 'READY';
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
          New QC Run
        </button>

        <div className="nav-menu">
          <div className="nav-context-card">
            <span className="nav-context-label">CURRENT PROJECT</span>
            <strong>{flowSource === 'zannora' ? 'Zannora Evidence' : activeJob?.name || 'No active project'}</strong>
            <small>{activeJob ? `${activeJob.status} · ${activeJob.workspace?.runLabel || 'latest run'}` : 'Input website untuk memulai QC'}</small>
          </div>

          <div className="nav-section-title">WORKSPACE</div>
          <button className={`nav-item ${currentView === 'process' ? 'active' : ''}`} onClick={() => setCurrentView('process')}>
            <div className="nav-item-left"><Icon name="map" size={18} /><span>Milestone Flow</span></div><span className="nav-badge">{processProgress}%</span>
          </button>
          <button className={`nav-item ${currentView === 'overview' ? 'active' : ''}`} onClick={() => setCurrentView('overview')}>
            <div className="nav-item-left"><Icon name="overview" size={18} /><span>Project Summary</span></div>
          </button>
          <button className={`nav-item ${currentView === 'projects' ? 'active' : ''}`} onClick={() => setCurrentView('projects')}>
            <div className="nav-item-left"><Icon name="projects" size={18} /><span>Project Library</span></div><span className="nav-badge">{jobs.length}</span>
          </button>

          <div className="nav-section-title" style={{ marginTop: 12 }}>ANALYSIS</div>
          <button className={`nav-item ${currentView === 'discovery' ? 'active' : ''}`} onClick={() => setCurrentView('discovery')}>
            <div className="nav-item-left"><Icon name="discovery" size={18} /><span>Discovery &amp; Inventory</span></div>{(activeJob?.status === 'RUNNING' || (flowSource === 'zannora' && evidenceLoading)) && <span className="status-dot active" />}
          </button>
          <button className={`nav-item ${currentView === 'map' ? 'active' : ''}`} onClick={() => setCurrentView('map')}>
            <div className="nav-item-left"><Icon name="map" size={18} /><span>App Map</span></div><span className="nav-badge">{flowSource === 'zannora' ? zannoraRouteCount : activeJob?.inventory?.pages.length ?? 0}</span>
          </button>
          <button className={`nav-item ${currentView === 'flows' ? 'active' : ''}`} onClick={() => setCurrentView('flows')}>
            <div className="nav-item-left"><Icon name="flows" size={18} /><span>Test Design</span></div><span className="nav-badge">{flowSource === 'zannora' ? zannoraDesignGroups.length : activeJob?.flows?.length ?? 0}</span>
          </button>

          <div className="nav-section-title" style={{ marginTop: 12 }}>EXECUTION</div>
          <button className={`nav-item ${currentView === 'runs' ? 'active' : ''}`} onClick={() => setCurrentView('runs')}>
            <div className="nav-item-left"><Icon name="runs" size={18} /><span>Execution Runs</span></div><span className="nav-badge">{flowSource === 'zannora' ? zannoraExecutionTotal : activeJob?.results?.length ?? 0}</span>
          </button>
          <button className={`nav-item ${currentView === 'live' ? 'active' : ''}`} onClick={() => setCurrentView('live')}>
            <div className="nav-item-left"><Icon name="discovery" size={18} /><span>Live Viewport</span></div><span className="nav-live-badge">LIVE</span>
          </button>

          <div className="nav-section-title" style={{ marginTop: 12 }}>QUALITY &amp; OUTPUT</div>
          <button className={`nav-item ${currentView === 'findings' ? 'active' : ''}`} onClick={() => setCurrentView('findings')}>
            <div className="nav-item-left"><Icon name="warning" size={18} /><span>Findings &amp; Retest</span></div><span className="nav-badge nav-badge-warning">{activeOpenFindings.length}</span>
          </button>
          <button className={`nav-item ${currentView === 'evidence' ? 'active' : ''}`} onClick={() => { setCurrentView('evidence'); if (flowSource === 'zannora') void refreshZannoraEvidence(); else void refreshTargetEvidence(activeJobId); }}>
            <div className="nav-item-left"><Icon name="reports" size={18} /><span>Evidence Center</span></div><span className="nav-badge">{activeEvidence?.totals.assets ?? 0}</span>
          </button>
          <button className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => setCurrentView('reports')}>
            <div className="nav-item-left"><Icon name="reports" size={18} /><span>Final Report</span></div><span className="nav-badge">{activeEvidence?.totals.failed ?? 0}</span>
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
                {flowSource === 'zannora' ? 'ZA' : activeJob?.name?.slice(0, 2).toUpperCase() || 'QC'}
              </span>
              <select
                value={flowSource === 'zannora' ? 'zannora-evidence' : activeJobId ?? ''}
                onChange={(e) => {
                  if (e.target.value === 'zannora-evidence') setFlowSource('zannora');
                  else { setFlowSource('job'); setActiveJobId(e.target.value); }
                  setSelectedMilestone(null);
                }}
                style={{ background: 'transparent', border: 'none', fontWeight: 600, color: '#FFFFFF', outline: 'none', cursor: 'pointer' }}
              >
                <option value="zannora-evidence" style={{ background: '#0F172A', color: '#FFF' }}>Zannora · latest evidence</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id} style={{ background: '#0F172A', color: '#FFF' }}>
                    {j.name} ({j.config?.runMode})
                  </option>
                ))}
              </select>
            </div>

            {flowSource === 'zannora' ? <Badge value="EVIDENCE ARCHIVE" /> : activeJob && <><Badge value={activeJob.config?.platform ?? 'web'} /><Badge value={activeJob.status} /></>}
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
            flowSource === 'zannora' && zannoraEvidence ? <ZannoraOverview evidence={zannoraEvidence} onNavigate={setCurrentView} onOpenEvidence={openEvidenceGroup} /> : (
            <div>
              <div className="view-header">
                <div>
                  <h1>Project Summary</h1>
                  <p>Ringkasan project dan run aktif. Buka Milestone Flow untuk melihat alur QC lengkap dari input website sampai final report.</p>
                </div>
                <div className="header-actions">
                  <button className="quiet" onClick={() => setCurrentView('process')}>
                    <Icon name="map" size={16} /> Open Milestone Flow
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
            )
          )}

          {/* VIEW: QC PROCESS MAP */}
          {currentView === 'process' && (
            <div>
              <div className="view-header">
                <div>
                  <h1>Milestone Flow</h1>
                  <p>Alur project QC aktif. Milestone yang belum dikerjakan dibuat redup, milestone aktif dianimasikan, dan setiap card membuka output lengkapnya.</p>
                </div>
                <div className="header-actions">
                  <button className="primary" onClick={() => setCurrentView('evidence')}><Icon name="reports" size={15} /> Evidence Center</button>
                </div>
              </div>
              <MilestoneFlow nodes={processNodes} progress={processProgress} centralStatus={centralProcessStatus} sourceLabel={flowSourceLabel} isLive={Boolean(flowJob && (flowJob.status === 'RUNNING' || flowJob.status === 'QUEUED'))} selectedNodeId={selectedMilestone?.id || null} onSelect={setSelectedMilestone} onNavigate={setCurrentView} />
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
              <div className="view-header">
                <div>
                  <h1>{editingJob ? `Edit QC Run: ${editingJob.name}` : 'Start New QC Run'}</h1>
                  <p>{editingJob ? 'Perbarui konfigurasi project dan jalankan ulang milestone dari awal.' : 'Input website, repository, environment, akun, lalu QC Maestro akan membuat project/run folder dan menjalankan milestone secara berurutan.'}</p>
                </div>
              </div>
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
                    <>
                      {activeJob.config?.platform === 'web' && <button className="quiet" style={{ color: 'var(--violet)', borderColor: 'rgba(139, 124, 255, 0.45)' }} onClick={() => void handleRunQualityAudit()} disabled={loading}>
                        <Icon name="discovery" size={16} /> Jalankan Quality Audit
                      </button>}
                      <button className="primary" onClick={() => setCurrentView('map')}>
                        Buka Application Map <Icon name="arrow" size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {flowSource === 'zannora' && zannoraEvidence ? (
                <ZannoraDiscovery evidence={zannoraEvidence} onOpenEvidence={openEvidenceGroup} />
              ) : !activeJob ? (
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
                          ...(activeJob.config?.qualityAudit?.enabled !== false ? [{ title: '6. Quality Audit & Evidence', desc: `${activeJob.config?.qualityAudit?.browsers?.join(', ') || 'browser default'} · ${activeJob.config?.qualityAudit?.viewports?.join(', ') || 'viewport default'} · screenshot & report` }] : []),
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
                              const stepSize = 100 / stages.length;
                              const isDone = activeJob.status === 'COMPLETED' || activeJob.progress > (idx + 1) * stepSize;
                              const isCurrent = activeJob.status === 'RUNNING' && activeJob.progress >= idx * stepSize && activeJob.progress <= (idx + 1) * stepSize;
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
                        {['all', 'system', 'runtime', 'database', 'discovery', 'browser', 'flow-builder', 'runner', 'quality'].map(cat => (
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
                                    case 'QUALITY_AUDIT': return 'Menjalankan Quality Audit: browser, viewport, rule UI, screenshot, dan report...';
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
              {flowSource === 'job' && activeJob && <div style={{ display: 'grid', gap: 18, marginTop: 18 }}><FeatureContractPanel plan={activeJob.inventory?.featureContractPlan} /><CrudCoveragePanel plan={activeJob.inventory?.crudPlan} /><RoleActionPanel plan={activeJob.inventory?.roleActionPlan} /></div>}
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
              ) : !activeJob?.results || activeJob.results.length === 0 ? (
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

          {/* VIEW: FINDINGS & RETEST */}
          {currentView === 'findings' && (
            <div>
              <div className="view-header">
                <div><h1>Findings &amp; Retest</h1><p>Semua temuan dari milestone audit dikumpulkan di sini dan dapat dilacak sampai retest.</p></div>
                <div className="header-actions"><button className="quiet" onClick={() => setCurrentView('process')}><Icon name="map" size={15} /> Back to Milestone Flow</button><button className="primary" onClick={() => setEvidenceFocus({ groupId: activeEvidence?.groups.find((group) => group.id === 'target-quality' || group.id === 'quality' || group.id === 'responsive')?.id || 'quality' })}><Icon name="reports" size={15} /> Inspect Evidence Inline</button></div>
              </div>
              {(() => {
                const responsive = activeEvidence?.groups.find((group) => group.id === 'target-quality' || group.id === 'responsive');
                const quality = activeEvidence?.groups.find((group) => group.id === 'quality');
                const findings = activeOpenFindings.length;
                return (
                  <>
                    <EvidenceInspector focus={evidenceFocus} evidence={activeEvidence} onClose={() => setEvidenceFocus(null)} onOpenAsset={(asset) => setFullScreenshot(asset.url)} />
                    <div className="finding-summary-grid">
                      <Panel title="Open Findings"><strong className="finding-number attention">{findings}</strong><small>responsive/layout findings</small></Panel>
                      <Panel title="Retest Queue"><strong className="finding-number">{findings > 0 ? findings : 0}</strong><small>menunggu perbaikan UI</small></Panel>
                      <Panel title="Current Branch"><strong className="finding-branch">{findings > 0 ? 'responsive-findings' : 'none'}</strong><small>branch milestone aktif</small></Panel>
                    </div>
                    <Panel title="Retest Workflow" description="Perbaiki temuan, jalankan retest, lalu milestone kembali menjadi clear.">
                      <div className="finding-flow"><span className="finding-step active"><b>01</b>Open</span><i>→</i><span className="finding-step"><b>02</b>In Progress</span><i>→</i><span className="finding-step"><b>03</b>Ready for Retest</span><i>→</i><span className="finding-step"><b>04</b>Passed</span></div>
                    </Panel>
                    {findings > 0 ? <Panel title="Live Findings" description={responsive?.summary || 'Finding diambil langsung dari check report yang berstatus failed.'}>
                      <div className="finding-list">{activeOpenFindings.map((item, index) => {
                        const key = `${item.groupId || 'finding'}-${item.route || ''}-${item.name || ''}-${index}`;
                        const expanded = expandedFindingKey === key;
                        return <div className={`finding-item ${expanded ? 'expanded' : ''}`} key={key}>
                          <button type="button" className="finding-row finding-row-toggle" aria-expanded={expanded} onClick={() => setExpandedFindingKey(expanded ? null : key)}>
                            <span className="finding-severity">{(item.area || 'OPEN').replace(/-/g, ' ').toUpperCase()}</span>
                            <span className="finding-row-copy"><strong>{item.name || 'Quality check failed'}</strong><small>{[item.route, item.viewport, item.browser].filter(Boolean).join(' · ') || 'Lokasi tidak tersedia'}</small></span>
                            <span className="finding-row-status">{item.workflowStatus.replace('_', ' ')}</span>
                            <span className="finding-expand-label">{expanded ? 'Tutup' : 'Lihat bukti'} <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={13} /></span>
                          </button>
                          {flowSource === 'job' && <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 10px' }}><select aria-label={`Status finding ${item.name || key}`} value={item.workflowStatus} disabled={loading} onChange={(event) => void updateFindingStatus(item, event.target.value as FindingWorkflowStatus)}><option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option><option value="READY_FOR_RETEST">Ready for Retest</option><option value="PASSED">Passed</option></select></div>}
                          {expanded && <FindingEvidenceDropdown finding={item} evidence={activeEvidence} />}
                        </div>;
                      })}</div>
                    </Panel> : <Empty title="Tidak ada finding terbuka">Semua hasil audit visual sudah clear atau belum ada audit yang dijalankan.</Empty>}
                  </>
                );
              })()}
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

              {flowSource === 'job' && <RunHistoryPanel history={runHistory} />}
              {flowSource === 'job' && activeJob && <div style={{ display: 'grid', gap: 18, marginBottom: 18 }}><FeatureContractPanel plan={activeJob.inventory?.featureContractPlan} /><CrudCoveragePanel plan={activeJob.inventory?.crudPlan} /></div>}

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
                    <h1 style={{ margin: 0 }}>{flowSource === 'zannora' ? 'Zannora Evidence Center' : `${activeJob?.name || 'Target'} Evidence Center`}</h1>
                    <span className="evidence-project-chip">LIVE ARTIFACT INDEX</span>
                  </div>
                  <p>Semua report, screenshot, dan video QC terbaru dikelompokkan berdasarkan bagian yang diuji.</p>
                </div>
                <div className="header-actions">
                  <button className="tool-btn" onClick={() => flowSource === 'zannora' ? void refreshZannoraEvidence() : void refreshTargetEvidence(activeJobId)} disabled={evidenceLoading}>
                    <Icon name="refresh" size={15} /> {evidenceLoading ? 'Memuat...' : 'Refresh Evidence'}
                  </button>
                </div>
              </div>

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
                    {activeEvidence.groups.filter((group) => evidenceGroupFilter === 'all' || group.category === evidenceGroupFilter).map((group) => (
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
                          {group.report && <a href={group.report.url} target="_blank" rel="noreferrer">Buka report JSON ↗</a>}
                        </div>

                        {group.videos.length > 0 && (
                          <div className="evidence-section">
                            <div className="evidence-section-title"><span>VIDEO FLOW</span><small>{group.videos.length} file</small></div>
                            <div className="evidence-video-grid">
                              {group.videos.map((asset: EvidenceAsset) => (
                                <div className="evidence-video-card" key={asset.relativePath}>
                                  <video controls preload="metadata" src={asset.url} onClick={() => setEvidenceFocus({ groupId: group.id, asset })} />
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
                                  <button className={`evidence-screenshot-card ${evidenceFocus?.asset?.relativePath === asset.relativePath ? 'selected' : ''}`} key={asset.relativePath} onClick={() => { setEvidenceFocus({ groupId: group.id, asset }); setFullScreenshot(asset.url); }} title="Klik untuk melihat screenshot dan konteks temuan">
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
            <LiveViewport job={flowSource === 'job' ? activeJob : null} evidence={flowSource === 'zannora' ? zannoraEvidence : null} />
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
