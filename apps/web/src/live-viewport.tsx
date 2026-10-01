import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Job, ZannoraEvidence, Artifact } from './types';
import { Icon, Empty } from './ui';
import { request, download } from './api';

export interface MediaItem {
  id: string;
  type: 'video' | 'photo';
  title: string;
  url: string;
  groupTitle?: string;
  route?: string;
  size?: number;
  updatedAt?: string;
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes < 1024) return bytes ? `${bytes} B` : '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface LiveViewportProps {
  job?: Job | null;
  evidence?: ZannoraEvidence | null;
}

export function LiveViewport({ job, evidence }: LiveViewportProps) {
  const [filterType, setFilterType] = useState<'all' | 'video' | 'photo'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [fetchedEvidence, setFetchedEvidence] = useState<ZannoraEvidence | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Auto-fetch quality-evidence if job is provided
  useEffect(() => {
    let cancelled = false;
    const fetchJobEvidence = async () => {
      if (!job?.id) return;
      try {
        const ev = await request<ZannoraEvidence>(`/api/v1/discovery/jobs/${job.id}/quality-evidence`);
        if (!cancelled && ev) setFetchedEvidence(ev);
      } catch {
        try {
          const evAlt = await request<ZannoraEvidence>(`/api/v1/discovery/jobs/${job.id}/evidence`);
          if (!cancelled && evAlt) setFetchedEvidence(evAlt);
        } catch {
          // ignore error if evidence endpoint not yet populated
        }
      }
    };
    void fetchJobEvidence();
    return () => { cancelled = true; };
  }, [job?.id]);

  // Consolidate all media items from evidence and job results
  const allMediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = [];
    const seenUrls = new Set<string>();

    const pushItem = (item: MediaItem) => {
      if (!item.url || seenUrls.has(item.url)) return;
      seenUrls.add(item.url);
      items.push(item);
    };

    const effectiveEvidence = evidence || fetchedEvidence;

    // 1. From Evidence Groups
    if (effectiveEvidence?.groups) {
      for (const group of effectiveEvidence.groups) {
        // Videos
        for (const v of group.videos || []) {
          pushItem({
            id: v.url || v.name,
            type: 'video',
            title: v.label || v.name || 'Video Eksekusi QC',
            url: v.url,
            size: v.size,
            updatedAt: v.updatedAt,
            groupTitle: group.title
          });
        }
        // Screenshots
        for (const s of group.screenshots || []) {
          pushItem({
            id: s.url || s.name,
            type: 'photo',
            title: s.label || s.name || 'Screenshot Checkpoint',
            url: s.url,
            size: s.size,
            updatedAt: s.updatedAt,
            groupTitle: group.title
          });
        }
      }
    }

    // 2. From Job Results Artifacts
    if (job?.results) {
      for (const res of job.results) {
        for (const art of res.artifacts || []) {
          const raw = typeof art === 'string' ? art : (art as Artifact).path || (art as Artifact).url;
          if (!raw) continue;
          const clean = raw.replace(/\\/g, '/');
          const isVid = clean.endsWith('.webm') || clean.endsWith('.mp4');
          const isImg = clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg');
          if (!isVid && !isImg) continue;

          const fileName = clean.split('/').pop() || (isVid ? 'video.webm' : 'screenshot.png');
          const marker = `/jobs/${job.id}/`;
          const idx = clean.indexOf(marker);
          const rel = idx !== -1 ? clean.slice(idx + marker.length) : clean.split('/').slice(-3).join('/');
          const cleanRel = rel.replace(/^\/+/, '');
          const url = clean.startsWith('http') || clean.startsWith('/api/') ? clean : `/api/v1/discovery/jobs/${job.id}/artifacts/${cleanRel}`;

          pushItem({
            id: url,
            type: isVid ? 'video' : 'photo',
            title: res.flowId ? `${isVid ? 'Video' : 'Screenshot'} - Flow ${res.flowId}` : fileName,
            url,
            groupTitle: 'Playwright Run'
          });
        }
      }
    }

    // 3. From Job Inventory Pages
    if (job?.inventory?.pages) {
      for (const page of job.inventory.pages) {
        if (page.screenshot) {
          const clean = page.screenshot.replace(/\\/g, '/').replace(/^\/+/, '');
          const url = `/api/v1/discovery/jobs/${job.id}/artifacts/${clean}`;
          pushItem({
            id: url,
            type: 'photo',
            title: page.title || page.path || 'Screenshot Halaman',
            url,
            route: page.path,
            groupTitle: 'Page Inventory'
          });
        }
      }
    }

    // 0. Direct Full Flow Video for Job
    if (job?.id) {
      pushItem({
        id: `/api/v1/discovery/jobs/${job.id}/artifacts/full-flow.webm`,
        type: 'video',
        title: '🎬 Rekaman Sesi Penuh (Full Flow · 30 FPS 720p)',
        url: `/api/v1/discovery/jobs/${job.id}/artifacts/full-flow.webm`,
        groupTitle: 'Full Flow Session'
      });
    }

    // Sort: Full-flow video FIRST, then other videos, then photos
    return items.sort((a, b) => {
      const aIsFullFlow = a.title.includes('Full Flow') || a.id.includes('full-flow');
      const bIsFullFlow = b.title.includes('Full Flow') || b.id.includes('full-flow');
      if (aIsFullFlow !== bIsFullFlow) return aIsFullFlow ? -1 : 1;
      if (a.type !== b.type) return a.type === 'video' ? -1 : 1;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [evidence, fetchedEvidence, job]);

  // Counts
  const videoCount = useMemo(() => allMediaItems.filter(m => m.type === 'video').length, [allMediaItems]);
  const photoCount = useMemo(() => allMediaItems.filter(m => m.type === 'photo').length, [allMediaItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allMediaItems.filter(item => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchRoute = (item.route || '').toLowerCase().includes(q);
        const matchGroup = (item.groupTitle || '').toLowerCase().includes(q);
        if (!matchTitle && !matchRoute && !matchGroup) return false;
      }
      return true;
    });
  }, [allMediaItems, filterType, searchQuery]);

  // Active selected item
  const activeItem = useMemo(() => {
    if (!filteredItems.length) return null;
    if (selectedId) {
      const match = filteredItems.find(i => i.id === selectedId);
      if (match) return match;
    }
    return filteredItems[0];
  }, [filteredItems, selectedId]);

  // Navigation handlers
  const currentIndex = activeItem ? filteredItems.findIndex(i => i.id === activeItem.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < filteredItems.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      setSelectedId(filteredItems[currentIndex - 1].id);
      setIsZoomed(false);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setSelectedId(filteredItems[currentIndex + 1].id);
      setIsZoomed(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleToggleFullscreen = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current.requestFullscreen();
    }
  };

  return (
    <div className="qc-media-viewport">
      <div className="view-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Galeri Media &amp; Rekaman QC</h1>
          <p>Layar penampil rekaman video Playwright dan arsip foto tangkapan layar hasil audit mutu.</p>
        </div>
        <div className="header-actions">
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {videoCount} Video · {photoCount} Foto Screenshot
          </span>
        </div>
      </div>

      {allMediaItems.length === 0 ? (
        <Empty title="Belum Ada Rekaman Video &amp; Foto">
          Jalankan pengujian atau quality audit pada proyek target. Semua rekaman sesi browser Playwright (.webm) dan screenshot halaman akan langsung ditampilkan di layar ini.
        </Empty>
      ) : (
        <>
          {/* TOP SCREEN STAGE ("TAYAR TAMPILAN") */}
          <div className="qc-stage-container" ref={stageRef}>
            {/* STAGE HEADER */}
            <div className="qc-stage-header">
              <div className="qc-stage-header-title">
                <span className={`qc-thumb-badge ${activeItem?.type || 'photo'}`} style={{ position: 'static' }}>
                  {activeItem?.type === 'video' ? '🎬 VIDEO' : '📸 FOTO'}
                </span>
                <strong>{activeItem?.title || 'Pilih Media'}</strong>
                {activeItem?.route && (
                  <span className="tag" style={{ color: 'var(--cyan)' }}>
                    {activeItem.route}
                  </span>
                )}
              </div>

              {activeItem && (
                <div className="qc-stage-header-actions">
                  {activeItem.type === 'photo' && (
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => setIsZoomed(!isZoomed)}
                      title={isZoomed ? 'Sesuaikan ke Layar' : 'Lihat Ukuran Asli 100%'}
                    >
                      {isZoomed ? 'Fit Screen' : 'Zoom 100%'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => window.open(activeItem.url, '_blank')}
                    title="Buka di Tab Baru"
                  >
                    <Icon name="reports" size={13} /> Buka Tab Baru ↗
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={handleToggleFullscreen}
                    title="Layar Penuh"
                  >
                    <Icon name="overview" size={13} /> Fullscreen
                  </button>
                </div>
              )}
            </div>

            {/* STAGE SCREEN */}
            <div className="qc-stage-screen">
              {activeItem ? (
                <>
                  {activeItem.type === 'video' ? (
                    <video
                      key={activeItem.url}
                      src={activeItem.url}
                      controls
                      autoPlay
                      className="qc-stage-media"
                    />
                  ) : (
                    <img
                      key={activeItem.url}
                      src={activeItem.url}
                      alt={activeItem.title}
                      className={`qc-stage-media ${isZoomed ? 'zoom' : ''}`}
                    />
                  )}

                  {/* PREV / NEXT OVERLAY BUTTONS */}
                  <button
                    type="button"
                    className="qc-stage-nav-btn prev"
                    onClick={handlePrev}
                    disabled={!hasPrev}
                    aria-label="Media Sebelumnya (Arrow Left)"
                    title="Media Sebelumnya (Arrow Left)"
                  >
                    <Icon name="arrow" size={20} />
                  </button>
                  <button
                    type="button"
                    className="qc-stage-nav-btn next"
                    onClick={handleNext}
                    disabled={!hasNext}
                    aria-label="Media Berikutnya (Arrow Right)"
                    title="Media Berikutnya (Arrow Right)"
                  >
                    <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>
                      <Icon name="arrow" size={20} />
                    </span>
                  </button>
                </>
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                  Tidak ada media yang cocok dengan filter pencarian.
                </div>
              )}
            </div>

            {/* STAGE FOOTER */}
            {activeItem && (
              <div className="qc-stage-footer">
                <div>
                  <span>Bagian: </span>
                  <strong style={{ color: 'var(--text-main)' }}>{activeItem.groupTitle || 'Hasil Audit QC'}</strong>
                  {activeItem.size ? <span> · {formatBytes(activeItem.size)}</span> : null}
                </div>
                <div>
                  <span>{currentIndex + 1} dari {filteredItems.length} media</span>
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM GALLERY STRIP ("BAGIAN BAWAH LIST PILIHAN VIDEO & FOTO") */}
          <div className="qc-gallery-section">
            <div className="qc-gallery-toolbar">
              <div className="qc-gallery-filter-tabs">
                <button
                  type="button"
                  className={`finding-pill ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  Semua ({allMediaItems.length})
                </button>
                <button
                  type="button"
                  className={`finding-pill ${filterType === 'video' ? 'active' : ''}`}
                  onClick={() => setFilterType('video')}
                >
                  🎬 Video ({videoCount})
                </button>
                <button
                  type="button"
                  className={`finding-pill ${filterType === 'photo' ? 'active' : ''}`}
                  onClick={() => setFilterType('photo')}
                >
                  📸 Foto Screenshot ({photoCount})
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="text"
                  className="finding-search-input"
                  style={{ minWidth: 220 }}
                  placeholder="Cari judul, route, atau checkpoint..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                Tidak ada video atau foto yang cocok dengan kata kunci &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="qc-gallery-strip">
                {filteredItems.map((item) => {
                  const isActive = activeItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`qc-thumb-card ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setIsZoomed(false);
                      }}
                      title={item.title}
                    >
                      <div className="qc-thumb-preview">
                        {item.type === 'photo' ? (
                          <img src={item.url} alt={item.title} loading="lazy" />
                        ) : (
                          <div className="qc-thumb-play-icon">
                            <Icon name="runs" size={16} />
                          </div>
                        )}
                        <span className={`qc-thumb-badge ${item.type}`}>
                          {item.type === 'video' ? 'VIDEO' : 'FOTO'}
                        </span>
                      </div>
                      <div className="qc-thumb-info">
                        <strong>{item.title}</strong>
                        <small>{item.route || item.groupTitle || 'Bukti QC'}</small>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
