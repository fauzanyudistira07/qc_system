import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BusinessFlowMap, BusinessFlow } from './types';
import { Icon } from './ui';

interface BusinessFlowVisualizerProps {
  map?: BusinessFlowMap;
  onApproveAll: () => void;
  onUpdateFlow: (flowId: string, patch: Record<string, unknown>) => Promise<void>;
  projectName?: string;
  baseUrl?: string;
}

export function BusinessFlowVisualizer({
  map,
  onApproveAll,
  onUpdateFlow,
  projectName = 'Target Application',
  baseUrl = 'http://localhost:5174/'
}: BusinessFlowVisualizerProps) {
  if (!map) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #DBC4AC' }}>
        <Icon name="flows" size={24} />
        <h3 style={{ margin: '12px 0 6px 0', fontSize: 16, fontWeight: 800, color: '#14181D' }}>Menunggu Sintesis Alur Bisnis</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#7B6858' }}>Server sedang melakukan scan and crawler. Alur fungsional akan segera tampil di sini.</p>
      </div>
    );
  }

  const [selectedFlowId, setSelectedFlowId] = useState<string>(() => map.flows[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'steps'>('diagram');
  const [flowOrientation, setFlowOrientation] = useState<'vertical' | 'horizontal'>('vertical');


  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    map.flows.forEach(f => { if (f.category) set.add(f.category); });
    return Array.from(set);
  }, [map.flows]);

  // Filtered flows
  const filteredFlows = useMemo(() => {
    return map.flows.filter(f => {
      const matchCat = categoryFilter === 'all' || f.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || f.title.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q) || f.steps.some(s => s.action.toLowerCase().includes(q) || (s.route && s.route.toLowerCase().includes(q)));
      return matchCat && matchSearch;
    });
  }, [map.flows, categoryFilter, searchQuery]);

  // Selected flow
  const currentFlow = useMemo(() => {
    const found = map.flows.find(f => f.id === selectedFlowId);
    return found || filteredFlows[0] || map.flows[0];
  }, [map.flows, selectedFlowId, filteredFlows]);

  const flowStats = useMemo(() => {
    const total = map.flows.length;
    const approved = map.flows.filter(f => f.status === 'APPROVED').length;
    const needsReview = map.flows.filter(f => f.status !== 'APPROVED').length;
    const critical = map.flows.filter(f => f.critical).length;
    const isAllApproved = map.status === 'APPROVED' || (total > 0 && approved === total);
    return { total, approved, needsReview, critical, isAllApproved };
  }, [map.flows, map.status]);

  const isAllApproved = flowStats.isAllApproved;

  const handleToggleApprove = async (flow: BusinessFlow) => {
    setUpdatingId(flow.id);
    const newStatus = flow.status === 'APPROVED' ? 'NEEDS_REVIEW' : 'APPROVED';
    try {
      await onUpdateFlow(flow.id, { status: newStatus });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleCritical = async (flow: BusinessFlow) => {
    setUpdatingId(flow.id);
    try {
      await onUpdateFlow(flow.id, { critical: !flow.critical });
    } finally {
      setUpdatingId(null);
    }
  };

  // Category count
  const categoryCount = categories.length;

  return (
    <div className="bf-visualizer-container">
      {/* Top Bar: Overview & Architecture Info */}
      <div className="bf-header-panel">
        <div className="bf-header-info">
          <div className="bf-header-title-row">
            <div className="bf-header-icon-wrap">
              <Icon name="flows" size={20} />
            </div>
            <div>
              <h2 className="bf-main-title">Peta Arsitektur Alur &amp; Logika Bisnis Aplikasi</h2>
              <p className="bf-main-subtitle">
                Bagan alir logika alur sistem web 1:1. Visualisasikan alur navigasi dari akses awal hingga setiap cabang fitur fungsional.
              </p>
            </div>
          </div>

          <div className="bf-metrics-chips">
            <span className="bf-chip">
              <Icon name="overview" size={13} />
              <strong>{flowStats.total}</strong> Total Alur Fitur
            </span>
            <span className="bf-chip">
              <Icon name="shield" size={13} />
              <strong>{flowStats.critical}</strong> Skenario Kritis
            </span>
            <span className="bf-chip">
              <Icon name="map" size={13} />
              <strong>{categoryCount}</strong> Domain Kategori
            </span>
            <span className={`bf-chip status-badge ${isAllApproved ? 'approved' : 'pending'}`}>
              <Icon name={isAllApproved ? 'check' : 'clock'} size={13} />
              {isAllApproved ? 'SEMUA ALUR DISETUJUI' : 'MENUNGGU VERIFIKASI'}
            </span>
          </div>
        </div>


      </div>
      {/* 3. WORKSPACE: FLOW LIST & DETAILED FLOWCHART INSPECTOR */}
      <div className="bf-workspace-grid">
          {/* Left Column: Flow List & Filters */}
          <div className="bf-flows-sidebar">
            <div className="bf-sidebar-search">
              <Icon name="search" size={14} />
              <input
                type="text"
                placeholder="Cari alur atau route..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="bf-clear-search" onClick={() => setSearchQuery('')}>
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <div className="bf-category-pills">
                <button
                  type="button"
                  className={`bf-cat-btn ${categoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('all')}
                >
                  Semua ({map.flows.length})
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`bf-cat-btn ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="bf-flows-scroll-list">
              {filteredFlows.length === 0 ? (
                <div className="bf-empty-flows">Tidak ada alur yang sesuai kata kunci.</div>
              ) : (
                filteredFlows.map((flow) => {
                  const isSelected = flow.id === currentFlow?.id;
                  const isApproved = flow.status === 'APPROVED';
                  return (
                    <button
                      key={flow.id}
                      type="button"
                      className={`bf-flow-item-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedFlowId(flow.id)}
                    >
                      <div className="bf-item-header">
                        <span className={`bf-status-indicator ${isApproved ? 'approved' : 'pending'}`}>
                          <Icon name={isApproved ? 'check' : 'clock'} size={11} />
                        </span>
                        <strong className="bf-item-title">{flow.title}</strong>
                      </div>

                      <div className="bf-item-meta">
                        <span className="bf-step-count">{flow.steps.length} Langkah</span>
                        {flow.critical && <span className="bf-critical-tag">CRITICAL</span>}
                        <span className="bf-confidence-score">{Math.round(flow.confidence * 100)}% Conf.</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Flow Inspector */}
          {currentFlow ? (
            <div className="bf-inspector-panel">
              {/* Inspector Header */}
              <div className="bf-inspector-header">
                <div className="bf-inspector-header-left">
                  <div className="bf-inspector-title-row">
                    <h3 className="bf-inspector-title">{currentFlow.title}</h3>
                    <span className={`bf-badge-status ${currentFlow.status === 'APPROVED' ? 'approved' : 'pending'}`}>
                      <Icon name={currentFlow.status === 'APPROVED' ? 'check' : 'clock'} size={13} />
                      {currentFlow.status === 'APPROVED' ? 'DISETUJUI' : 'MENUNGGU APPROVAL'}
                    </span>
                    {currentFlow.critical && <span className="bf-badge-critical">CRITICAL FLOW</span>}
                  </div>
                  <p className="bf-inspector-summary">{currentFlow.summary}</p>
                </div>

                {/* Mode toggle and approval button */}
                <div className="bf-inspector-controls">
                  <div className="bf-view-mode-toggle">
                    <button
                      type="button"
                      className={`bf-mode-btn ${viewMode === 'diagram' ? 'active' : ''}`}
                      onClick={() => setViewMode('diagram')}
                      title="Bagan alir visual interaktif"
                    >
                      Diagram Fitur
                    </button>
                    <button
                      type="button"
                      className={`bf-mode-btn ${viewMode === 'steps' ? 'active' : ''}`}
                      onClick={() => setViewMode('steps')}
                      title="Panduan narasi kronologis"
                    >
                      Urutan Langkah
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`tool-btn bf-action-approve-btn ${currentFlow.status === 'APPROVED' ? 'approved-state' : 'primary'}`}
                    disabled={updatingId === currentFlow.id}
                    onClick={() => handleToggleApprove(currentFlow)}
                    title={currentFlow.status === 'APPROVED' ? 'Buka revisi untuk alur ini' : 'Setujui alur ini'}
                  >
                    <Icon name={currentFlow.status === 'APPROVED' ? 'edit' : 'check'} size={14} />
                    <span>{currentFlow.status === 'APPROVED' ? 'Revisi' : 'Setujui Alur Ini'}</span>
                  </button>
                </div>
              </div>

              {/* SECTION: VISUAL FLOWCHART PER FITUR */}
              {viewMode === 'diagram' && (
                <div className="bf-flowchart-card">
                  <div className="bf-flowchart-header-row">
                    <div className="bf-flowchart-title-wrap">
                      <Icon name="flows" size={17} />
                      <div>
                        <h4>Diagram Alur Eksekusi Fitur</h4>
                        <span className="bf-sub-hint">Bagan alir formal dari inisiasi trigger hingga validasi akhir</span>
                      </div>
                    </div>

                    <div className="bf-flowchart-actions">
                      <div className="bf-orientation-toggle">
                        <button
                          type="button"
                          className={`bf-orient-btn ${flowOrientation === 'vertical' ? 'active' : ''}`}
                          onClick={() => setFlowOrientation('vertical')}
                          title="Tampilan Flowchart Vertikal Standar"
                        >
                          ↕ Vertikal
                        </button>
                        <button
                          type="button"
                          className={`bf-orient-btn ${flowOrientation === 'horizontal' ? 'active' : ''}`}
                          onClick={() => setFlowOrientation('horizontal')}
                          title="Tampilan Flowchart Horizontal Pipeline"
                        >
                          ↔ Horizontal
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Flowchart Symbol Legend */}
                  <div className="fc-legend-bar">
                    <span className="fc-legend-title">Panduan Simbol:</span>
                    <span className="fc-legend-item">
                      <span className="fc-sym-pill" /> Terminator (Mulai / Selesai)
                    </span>
                    <span className="fc-legend-item">
                      <span className="fc-sym-data" /> Data (Prasyarat Input)
                    </span>
                    <span className="fc-legend-item">
                      <span className="fc-sym-rect" /> Proses (Tindakan Langkah)
                    </span>
                    <span className="fc-legend-item">
                      <span className="fc-sym-diamond" /> Keputusan (Validasi Logika Sistem)
                    </span>
                    <span className="fc-legend-item">
                      <span className="fc-sym-branch">↳</span> Percabangan Gagal (Fallback)
                    </span>
                  </div>

                  {/* Canvas */}
                  {flowOrientation === 'vertical' ? (
                    <div className="fc-vertical-canvas">
                      {/* START TERMINATOR */}
                      <div className="fc-node-terminator start-node">
                        <span className="fc-terminator-tag">START / MULAI</span>
                        <strong className="fc-terminator-text">{currentFlow.trigger || 'Inisiasi Pengguna / Akses Target'}</strong>
                        {currentFlow.actors.length > 0 && (
                          <span className="fc-terminator-sub">Aktor: {currentFlow.actors.join(', ')}</span>
                        )}
                      </div>

                      <div className="fc-arrow-down-wrap">
                        <div className="fc-v-line" />
                        <div className="fc-v-arrow-head">▼</div>
                      </div>

                      {/* PRECONDITIONS DATA */}
                      {currentFlow.preconditions.length > 0 && (
                        <>
                          <div className="fc-node-data">
                            <div className="fc-node-data-content">
                              <span className="fc-data-tag">INPUT / PRASYARAT</span>
                              <span className="fc-data-text">{currentFlow.preconditions.join(' · ')}</span>
                            </div>
                          </div>
                          <div className="fc-arrow-down-wrap">
                            <div className="fc-v-line" />
                            <div className="fc-v-arrow-head">▼</div>
                          </div>
                        </>
                      )}

                      {/* PROCESS STEPS & DECISIONS */}
                      {currentFlow.steps.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className="fc-node-process">
                            <div className="fc-process-header">
                              <span className="fc-process-step-badge">PROSES {String(idx + 1).padStart(2, '0')}</span>
                              {step.route && (
                                <span className="fc-process-route">
                                  <Icon name="globe" size={11} />
                                  <code>{step.route}</code>
                                </span>
                              )}
                            </div>
                            <div className="fc-process-action">{step.action}</div>
                          </div>

                          <div className="fc-arrow-down-wrap">
                            <div className="fc-v-line" />
                            <div className="fc-v-arrow-head">▼</div>
                          </div>

                          <div className="fc-decision-row">
                            <div className="fc-decision-spacer" />
                            <div className="fc-diamond-container">
                              <div className="fc-diamond-box">
                                <div className="fc-diamond-text">
                                  <span className="fc-diamond-tag">VALIDASI SISTEM</span>
                                  <span className="fc-diamond-question">{step.expected}</span>
                                </div>
                              </div>
                            </div>

                            <div className="fc-branch-negative-col">
                              <div className="fc-branch-line-wrap">
                                <span className="fc-branch-pill-no">TIDAK / GAGAL</span>
                                <div className="fc-h-connector" />
                                <span className="fc-branch-arrow-icon">►</span>
                              </div>
                              <div className="fc-negative-card">
                                <div className="fc-neg-title">
                                  <Icon name="warning" size={11} />
                                  <span>Skenario Penanganan</span>
                                </div>
                                <p className="fc-neg-desc">
                                  {currentFlow.negativeScenarios[idx] || currentFlow.recoveryScenarios[0] || 'Tampilkan pesan kesalahan & pertahankan state formulir / kembali ke state aman'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="fc-arrow-down-wrap has-branch">
                            <span className="fc-arrow-label-yes">YA / LOLOS</span>
                            <div className="fc-v-line" />
                            <div className="fc-v-arrow-head">▼</div>
                          </div>
                        </React.Fragment>
                      ))}

                      {/* END TERMINATOR */}
                      <div className="fc-node-terminator end-node">
                        <span className="fc-terminator-tag">SELESAI / EXPECTED OUTCOME</span>
                        <strong className="fc-terminator-text">
                          {(currentFlow.expectedOutcome.length > 0 ? currentFlow.expectedOutcome : ['Sesi aktif, elemen terverifikasi, dan bebas error crash']).join(' · ')}
                        </strong>
                        <span className="fc-terminator-sub">Seluruh checkpoint terpenuhi secara deterministik</span>
                      </div>
                    </div>
                  ) : (
                    /* HORIZONTAL CANVAS */
                    <div className="fc-horizontal-canvas">
                      <div className="fc-node-terminator start-node" style={{ flexShrink: 0, minWidth: 220, maxWidth: 260 }}>
                        <span className="fc-terminator-tag">START / MULAI</span>
                        <strong className="fc-terminator-text" style={{ fontSize: 12 }}>{currentFlow.trigger || 'Inisiasi Target'}</strong>
                        {currentFlow.actors.length > 0 && (
                          <span className="fc-terminator-sub">Aktor: {currentFlow.actors[0]}</span>
                        )}
                      </div>

                      <div className="fc-h-arrow-wrap">
                        <div className="fc-h-line-main" />
                        <span className="fc-h-arrow-head">►</span>
                      </div>

                      {currentFlow.preconditions.length > 0 && (
                        <>
                          <div className="fc-node-data" style={{ flexShrink: 0, minWidth: 200, maxWidth: 240 }}>
                            <div className="fc-node-data-content">
                              <span className="fc-data-tag">INPUT / PRASYARAT</span>
                              <span className="fc-data-text" style={{ fontSize: 11 }}>{currentFlow.preconditions[0]}</span>
                            </div>
                          </div>
                          <div className="fc-h-arrow-wrap">
                            <div className="fc-h-line-main" />
                            <span className="fc-h-arrow-head">►</span>
                          </div>
                        </>
                      )}

                      {currentFlow.steps.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className="fc-node-process" style={{ flexShrink: 0, width: 250 }}>
                            <div className="fc-process-header">
                              <span className="fc-process-step-badge">PROSES {idx + 1}</span>
                              {step.route && (
                                <span className="fc-process-route">
                                  <code>{step.route}</code>
                                </span>
                              )}
                            </div>
                            <div className="fc-process-action" style={{ fontSize: 12 }}>{step.action}</div>
                            <div style={{ fontSize: 11, color: '#15803D', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Icon name="check" size={11} />
                              <span>{step.expected}</span>
                            </div>
                          </div>

                          <div className="fc-h-arrow-wrap">
                            <div className="fc-h-line-main" />
                            <span className="fc-h-arrow-head">►</span>
                          </div>
                        </React.Fragment>
                      ))}

                      <div className="fc-node-terminator end-node" style={{ flexShrink: 0, minWidth: 220, maxWidth: 260 }}>
                        <span className="fc-terminator-tag">SELESAI / OUTCOME</span>
                        <strong className="fc-terminator-text" style={{ fontSize: 12 }}>
                          {currentFlow.expectedOutcome[0] || 'Alur Tuntas & Lolos'}
                        </strong>
                        <span className="fc-terminator-sub">Hasil Terverifikasi</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: STEP-BY-STEP NARRATIVE EXPLANATION */}
              {viewMode === 'steps' && (
                <div className="bf-steps-explanation-card">
                  <div className="bf-steps-header-box">
                    <div className="bf-steps-header-box-left">
                      <div className="bf-steps-header-icon-badge">
                        <Icon name="reports" size={17} />
                      </div>
                      <div>
                        <h4 className="bf-steps-box-title">Penjelasan Urutan &amp; Detail Langkah</h4>
                        <p className="bf-steps-box-subtitle">Panduan kronologis urutan alur operasional sistem target</p>
                      </div>
                    </div>
                    <div className="bf-steps-header-box-right">
                      <span className="bf-steps-count-badge">
                        <Icon name="flows" size={12} />
                        <span>{currentFlow.steps.length} Langkah Terurut</span>
                      </span>
                    </div>
                  </div>

                  <div className="bf-steps-list-container">
                    {currentFlow.steps.map((step, idx) => (
                      <div key={idx} className="bf-step-detail-row">
                        <div className="bf-step-num-col">
                          <span className="bf-step-num-pill">{idx + 1}</span>
                        </div>
                        <div className="bf-step-detail-content">
                          <div className="bf-step-title-line">
                            <h5 className="bf-step-title">{step.action}</h5>
                            {step.route && (
                              <span className="bf-route-chip">
                                <Icon name="globe" size={12} />
                                {step.route}
                              </span>
                            )}
                          </div>
                          <p className="bf-step-desc">
                            <strong>Ekspektasi:</strong> {step.expected}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bf-card-footer-action">
                    <div className="bf-footer-meta">
                      <label className="bf-critical-checkbox-label">
                        <input
                          type="checkbox"
                          checked={currentFlow.critical}
                          onChange={() => handleToggleCritical(currentFlow)}
                        />
                        <span>Tandai sebagai Alur Kritis (Prioritas Utama Regresi)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bf-empty-inspector">
              Pilih salah satu alur di sebelah kiri untuk melihat diagram flowchart dan detail langkah.
            </div>
          )}
        </div>
      </div>
  );
}
