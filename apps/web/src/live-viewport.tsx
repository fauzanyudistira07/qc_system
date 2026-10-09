import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Job, ZannoraEvidence, Artifact } from './types';
import { Icon, Empty } from './ui';
import { request, download, artifactUrl } from './api';

export interface MediaItem {
  id: string;
  type: 'video' | 'photo';
  title: string;
  url: string;
  flowName: string;
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
  hideHeader?: boolean;
}

function readableFlowName(flowId?: string): { name: string } {
  if (!flowId) return { name: 'Skenario Flow' };
  if (flowId.includes('launch') || flowId.includes('smoke')) {
    return { name: '1. Launch & Smoke Check' };
  }
  if (flowId.includes('login') || flowId.includes('auth')) {
    return { name: '2. Login & Masuk Dashboard' };
  }
  if (flowId.includes('tabs-all') || flowId.includes('semua-tab')) {
    return { name: '3. Navigasi Semua Tab Dashboard' };
  }
  if (flowId.includes('home-explore') || flowId.includes('beranda')) {
    return { name: '4. Eksplorasi Konten Beranda' };
  }
  if (flowId.includes('tab-absensi') || flowId.includes('absensi')) {
    return { name: '5. Eksplorasi Tab Absensi' };
  }
  if (flowId.includes('tab-keuangan') || flowId.includes('keuangan')) {
    return { name: '6. Eksplorasi Tab Keuangan' };
  }
  if (flowId.includes('tab-informasi') || flowId.includes('informasi')) {
    return { name: '7. Eksplorasi Tab Informasi' };
  }
  if (flowId.includes('tab-t2q') || flowId.includes('t2q')) {
    return { name: '8. Eksplorasi Tab T2Q (Hafalan)' };
  }
  if (flowId.includes('mutabaah')) {
    return { name: '9. Eksplorasi Mutaba\'ah Ibadah' };
  }
  const clean = flowId
    .replace(/^(android|web|app)-/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { name: clean };
}

function humanizeMediaTitle(raw: string, isVid: boolean, flowId?: string): string {
  if (raw.startsWith('Rekaman:')) return raw;
  if (flowId && isVid) {
    const f = readableFlowName(flowId);
    return `Rekaman: ${f.name}`;
  }

  let name = (raw.split('/').pop() || raw).replace(/\\/g, '/').split('/').pop() || raw;
  name = name.replace(/\.(png|jpg|jpeg|webm|mp4)$/i, '');

  if (isVid) {
    if (name.includes('rekaman flow') || name === 'flow-recording') {
      return 'Rekaman Video QC';
    }
    return `Rekaman: ${name}`;
  }

  // Friendly name replacements
  if (name.includes('dashboard-beranda')) return 'Dashboard Beranda Siswa';
  if (name.includes('tab-beranda')) return 'Navigasi Tab: Beranda';
  if (name.includes('tab-absensi')) return 'Navigasi Tab: Absensi';
  if (name.includes('tab-keuangan')) return 'Navigasi Tab: Keuangan';
  if (name.includes('tab-informasi')) return 'Navigasi Tab: Informasi';
  if (name.includes('tab-t2q')) return 'Navigasi Tab: T2Q';
  if (name.includes('home-bottom')) return 'Beranda: Agenda & Kegiatan';
  if (name.includes('home-middle')) return 'Beranda: Widget Poin Siswa';
  if (name.includes('home-top')) return 'Beranda: Header Profil Siswa';
  if (name.includes('launch-screen') || name.includes('splash')) return 'Layar Splash & Pembuka';
  if (name.includes('absensi-loaded')) return 'Absensi: Riwayat Kehadiran';
  if (name.includes('absensi-scrolled')) return 'Absensi: Daftar Lengkap';
  if (name.includes('keuangan-loaded')) return 'Keuangan: Tagihan SPP Bulanan';
  if (name.includes('keuangan-scrolled')) return 'Keuangan: Rincian Invoice';
  if (name.includes('informasi-loaded')) return 'Informasi: Pengumuman & Berita';
  if (name.includes('informasi-scrolled')) return 'Informasi: Feed Berita Sekolah';
  if (name.includes('t2q-loaded')) return 'T2Q: Riwayat Hafalan & Setoran';
  if (name.includes('t2q-scrolled')) return 'T2Q: Riwayat Surat Lengkap';

  // Step formatting: step-04-tap-NIS---NISN -> Langkah 04: Tekan NIS / NISN
  const stepMatch = name.match(/^step-(\d+)-(tap|input|scroll|assert)-(.*)$/i);
  if (stepMatch) {
    const num = stepMatch[1];
    const action = stepMatch[2].toLowerCase();
    const target = stepMatch[3].replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    const actionWord = action === 'tap' ? 'Tekan' : action === 'input' ? 'Isi' : action === 'scroll' ? 'Gulir' : 'Cek';
    return `Langkah ${num}: ${actionWord} ${target}`;
  }

  const simpleStep = name.match(/^step-(\d+)-(.*)$/i);
  if (simpleStep) {
    const num = simpleStep[1];
    const rest = simpleStep[2].replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return `Langkah ${num}: ${rest}`;
  }

  // Detect hex hashes e.g. "510917a4-17c093686c41d556" or "510917a417c093686c41d556"
  const strippedHex = name.replace(/[-_\s]/g, '');
  if (/^[0-9a-fA-F]{10,}$/.test(strippedHex)) {
    const shortRef = strippedHex.slice(0, 8);
    return `Tangkapan Layar (#${shortRef})`;
  }

  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractFlowFromItem(item: {
  rawName: string;
  label?: string;
  flowId?: string;
  groupTitle?: string;
  isVid: boolean;
  knownFlows?: Array<{ id: string; name: string }>;
}): { flowName: string; cleanTitle: string } {
  const cleanTitle = humanizeMediaTitle(item.rawName, item.isVid, item.flowId);

  // 1. If label contains explicit flow name
  if (item.label) {
    let clean = item.label.replace(/^Rekaman:\s*/i, '').trim();
    if (clean.includes(' · ')) {
      clean = clean.split(' · ')[0].trim();
    }
    // Match numbered flow e.g. "1. Launch & Smoke Check"
    if (/^\d+\.\s+/.test(clean)) {
      return { flowName: clean, cleanTitle };
    }
    if (/^Tahap\s*\d+/i.test(clean)) {
      return { flowName: clean, cleanTitle };
    }
    if (clean.length > 3 && !clean.includes('.png') && !clean.includes('.webm') && !clean.includes('.mp4')) {
      return { flowName: clean, cleanTitle };
    }
  }

  // 2. Direct match with known flows from job
  if (item.flowId && item.knownFlows?.length) {
    const match = item.knownFlows.find(f => f.id === item.flowId || f.name.toLowerCase().includes(item.flowId!.toLowerCase()));
    if (match) {
      return { flowName: match.name, cleanTitle };
    }
  }

  // 3. Match from groupTitle if it represents a specific flow run
  if (item.groupTitle) {
    const gt = item.groupTitle;
    if (gt.includes('Tahap 1') || gt.includes('Negative Edge Cases') || gt.includes('Form Validations')) {
      return { flowName: 'Tahap 1 · Form Validations & Negative Cases', cleanTitle };
    }
    if (gt.includes('Tahap 2') || gt.includes('CRUD Verification') || gt.includes('Full CRUD')) {
      return { flowName: 'Tahap 2 · Full CRUD Verification', cleanTitle };
    }
    if (gt.includes('Tahap 3') || gt.includes('Search') || gt.includes('Download Excel')) {
      return { flowName: 'Tahap 3 · Search, Filter & Download Excel', cleanTitle };
    }
    if (gt.includes('Autonomous E2E')) {
      return { flowName: 'Autonomous E2E Engine', cleanTitle };
    }
  }

  // 4. File name prefix patterns
  if (item.rawName) {
    if (item.rawName.startsWith('01_auth')) {
      return { flowName: 'Flow 1 · Autentikasi & Login', cleanTitle };
    }
    if (item.rawName.startsWith('02_negative') || item.rawName.includes('negative')) {
      return { flowName: 'Flow 2 · Validasi Form & Negative Cases', cleanTitle };
    }
    if (item.rawName.startsWith('03_crud_create') || item.rawName.includes('crud_create')) {
      return { flowName: 'Flow 3 · CRUD Create Resource', cleanTitle };
    }
    if (item.rawName.startsWith('04_crud_read') || item.rawName.includes('crud_read')) {
      return { flowName: 'Flow 4 · CRUD Read & Table Verification', cleanTitle };
    }
  }

  // 5. Fallback from flowId mapping
  if (item.flowId) {
    const parsed = readableFlowName(item.flowId);
    return { flowName: parsed.name, cleanTitle };
  }

  // 6. Descriptive group title
  if (item.groupTitle && !item.groupTitle.includes('Flow Executions & Feature Captures') && !item.groupTitle.includes('UI Quality Audit')) {
    return { flowName: item.groupTitle, cleanTitle };
  }

  return { flowName: 'Discovery & Inventori Halaman', cleanTitle };
}

export function LiveViewport({ job, evidence, hideHeader }: LiveViewportProps) {
  const [filterType, setFilterType] = useState<'all' | 'video' | 'photo'>('all');
  const [selectedFlowFilter, setSelectedFlowFilter] = useState<string>('all');
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

    // Map run directories to flowIds
    const runToFlow = new Map<string, string>();
    if (job?.results) {
      for (const res of job.results) {
        if (!res.flowId) continue;
        for (const art of res.artifacts || []) {
          const raw = typeof art === 'string' ? art : (art as Artifact).path || (art as Artifact).url;
          if (raw) {
            const m = raw.match(/run-[a-z0-9-]+/i);
            if (m) runToFlow.set(m[0], res.flowId);
          }
        }
      }
    }

    const effectiveEvidence = evidence || fetchedEvidence;

    // 1. From Job Results Artifacts (Most accurate & flow-mapped)
    if (job?.results) {
      for (const res of job.results) {
        for (const art of res.artifacts || []) {
          const raw = typeof art === 'string' ? art : (art as Artifact).path || (art as Artifact).url;
          if (!raw) continue;
          const clean = raw.replace(/\\/g, '/');
          const isVid = clean.endsWith('.webm') || clean.endsWith('.mp4');
          const isImg = clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg');
          if (!isVid && !isImg) continue;

          const fileName = clean.split('/').pop() || (isVid ? 'video.mp4' : 'screenshot.png');
          const resolvedUrl = artifactUrl(job.id, raw);
          if (!resolvedUrl) continue;

          const meta = extractFlowFromItem({
            rawName: fileName,
            flowId: res.flowId,
            isVid,
            knownFlows: job.flows
          });

          pushItem({
            id: resolvedUrl,
            type: isVid ? 'video' : 'photo',
            title: meta.cleanTitle,
            url: resolvedUrl,
            flowName: meta.flowName,
            groupTitle: meta.flowName
          });
        }
      }
    }

    // 2. From Evidence Groups
    if (effectiveEvidence?.groups) {
      for (const group of effectiveEvidence.groups) {
        // Videos
        for (const v of group.videos || []) {
          const m = (v.url || '').match(/run-[a-z0-9-]+/i);
          const flowId = m ? runToFlow.get(m[0]) : undefined;
          const meta = extractFlowFromItem({
            rawName: v.name || 'video.mp4',
            label: v.label,
            flowId,
            groupTitle: group.title,
            isVid: true,
            knownFlows: job?.flows
          });

          pushItem({
            id: v.url || v.name,
            type: 'video',
            title: meta.cleanTitle,
            url: v.url,
            size: v.size,
            updatedAt: v.updatedAt,
            flowName: meta.flowName,
            groupTitle: meta.flowName
          });
        }
        // Screenshots
        for (const s of group.screenshots || []) {
          const m = (s.url || '').match(/run-[a-z0-9-]+/i);
          const flowId = m ? runToFlow.get(m[0]) : undefined;
          const meta = extractFlowFromItem({
            rawName: s.name || 'screenshot.png',
            label: s.label,
            flowId,
            groupTitle: group.title,
            isVid: false,
            knownFlows: job?.flows
          });

          pushItem({
            id: s.url || s.name,
            type: 'photo',
            title: meta.cleanTitle,
            url: s.url,
            size: s.size,
            updatedAt: s.updatedAt,
            flowName: meta.flowName,
            groupTitle: meta.flowName
          });
        }
      }
    }

    // 3. From Job Inventory Pages (Discovered Pages)
    if (job?.inventory?.pages) {
      const validPages = job.inventory.pages.filter(p => p.screenshot);
      validPages.forEach((page) => {
        const resolved = artifactUrl(job.id, page.screenshot!);
        if (resolved) {
          pushItem({
            id: resolved,
            type: 'photo',
            title: page.title || page.path || 'Screenshot Halaman',
            url: resolved,
            route: page.path,
            flowName: 'Discovery & Inventori Halaman',
            groupTitle: 'Discovery & Inventori Halaman'
          });
        }
      });
    }

    // 4. Sort: Videos first, then photos, then by title
    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'video' ? -1 : 1;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [evidence, fetchedEvidence, job]);

  // Available flows for filtering
  const availableFlows = useMemo(() => {
    const map = new Map<string, { name: string; count: number; order: number }>();

    for (const item of allMediaItems) {
      const flow = item.flowName || 'Discovery & Inventori Halaman';

      if (!map.has(flow)) {
        let order = 999;
        const numMatch = flow.match(/^(\d+)\./) || flow.match(/Tahap\s*(\d+)/i) || flow.match(/Flow\s*(\d+)/i);
        if (numMatch) {
          order = parseInt(numMatch[1], 10);
        } else if (flow.includes('Autonomous')) {
          order = 50;
        } else if (flow.includes('Discovery')) {
          order = 100;
        }

        map.set(flow, {
          name: flow,
          count: 0,
          order
        });
      }
      map.get(flow)!.count += 1;
    }

    return Array.from(map.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [allMediaItems]);

  // Counts
  const videoCount = useMemo(() => allMediaItems.filter(m => m.type === 'video').length, [allMediaItems]);
  const photoCount = useMemo(() => allMediaItems.filter(m => m.type === 'photo').length, [allMediaItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allMediaItems.filter(item => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (selectedFlowFilter !== 'all' && item.flowName !== selectedFlowFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchRoute = (item.route || '').toLowerCase().includes(q);
        const matchFlow = (item.flowName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchRoute && !matchFlow) return false;
      }
      return true;
    });
  }, [allMediaItems, filterType, selectedFlowFilter, searchQuery]);

  // Active selected item
  const activeItem = useMemo(() => {
    if (!filteredItems.length) return null;
    if (selectedId) {
      const match = filteredItems.find(i => i.id === selectedId);
      if (match) return match;
    }
    return filteredItems[0];
  }, [filteredItems, selectedId]);

  // Batch 15 images to eliminate lag on Media page
  const ITEMS_PER_PAGE = 15;
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setPage(1);
  }, [filterType, selectedFlowFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length);
  const pageItems = useMemo(() => filteredItems.slice(startIndex, endIndex), [filteredItems, startIndex, endIndex]);

  // Auto-sync page if user navigates with next/prev arrow beyond current page
  useEffect(() => {
    if (!selectedId) return;
    const idx = filteredItems.findIndex(i => i.id === selectedId);
    if (idx !== -1) {
      const targetPage = Math.floor(idx / ITEMS_PER_PAGE) + 1;
      if (targetPage !== page) {
        setPage(targetPage);
      }
    }
  }, [selectedId, filteredItems, page]);

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

  // Group items by flow for the playlist (order of first appearance for current 15 items)
  const grouped = useMemo(() => {
    const map = new Map<string, { flowName: string; items: MediaItem[] }>();
    for (const item of pageItems) {
      const key = item.flowName || 'Discovery & Inventori Halaman';
      if (!map.has(key)) {
        map.set(key, { flowName: key, items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.entries());
  }, [pageItems]);

  const typeLabel = (t?: 'video' | 'photo') => (t === 'video' ? 'Video' : 'Foto');

  return (
    <div className="qc-media-viewport">
      {!hideHeader && (
        <div className="view-header" style={{ marginBottom: 0 }}>
          <div>
            <h1>Media</h1>
            <p>Penampil rekaman video dan arsip screenshot hasil pengujian, lengkap dengan navigasi antar bukti.</p>
          </div>
        </div>
      )}

      <div className="qc-media-stats">
        <div className="qc-media-stat">
          <span className="qc-media-stat-icon video"><Icon name="runs" size={16} /></span>
          <div><strong>{videoCount}</strong><small>Rekaman Video</small></div>
        </div>
        <div className="qc-media-stat">
          <span className="qc-media-stat-icon photo"><Icon name="reports" size={16} /></span>
          <div><strong>{photoCount}</strong><small>Screenshot</small></div>
        </div>
        <div className="qc-media-stat">
          <span className="qc-media-stat-icon group"><Icon name="flows" size={16} /></span>
          <div><strong>{availableFlows.length}</strong><small>Flow Pengujian</small></div>
        </div>
        <div className="qc-media-stat">
          <span className="qc-media-stat-icon total"><Icon name="overview" size={16} /></span>
          <div><strong>{allMediaItems.length}</strong><small>Total Media</small></div>
        </div>
      </div>

      {allMediaItems.length === 0 ? (
        <Empty title="Belum Ada Rekaman Video &amp; Foto">
          Jalankan pengujian atau quality audit pada proyek target. Semua rekaman sesi (.webm) dan screenshot akan langsung ditampilkan di layar ini.
        </Empty>
      ) : (
        <div className="qc-media-layout">
          {/* LEFT: STAGE */}
          <div className="qc-stage-container" ref={stageRef}>
            <div className="qc-stage-header">
              <div className="qc-stage-header-title">
                <span className={`qc-type-pill ${activeItem?.type || 'photo'}`}>
                  {typeLabel(activeItem?.type)}
                </span>
                {activeItem?.flowName && (
                  <span className="tag" style={{
                    background: 'var(--cyan-surface)',
                    color: 'var(--cyan)',
                    border: '1px solid rgba(53, 208, 186, 0.35)',
                    fontWeight: 700,
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: 4
                  }}>
                    {activeItem.flowName}
                  </span>
                )}
                <strong title={activeItem?.title}>{activeItem?.title || 'Pilih Media'}</strong>
                {activeItem?.route && <span className="tag" style={{ color: 'var(--cyan)' }}>{activeItem.route}</span>}
              </div>

              {activeItem && (
                <div className="qc-stage-header-actions">
                  {activeItem.type === 'photo' && (
                    <button type="button" className="tool-btn" onClick={() => setIsZoomed(!isZoomed)} title={isZoomed ? 'Sesuaikan ke Layar' : 'Lihat Ukuran Asli 100%'}>
                      {isZoomed ? 'Fit Screen' : 'Zoom 100%'}
                    </button>
                  )}
                  <button type="button" className="tool-btn" onClick={() => window.open(activeItem.url, '_blank')} title="Buka di Tab Baru">
                    <Icon name="reports" size={13} /> Tab Baru
                  </button>
                  <button type="button" className="tool-btn" onClick={handleToggleFullscreen} title="Layar Penuh">
                    <Icon name="overview" size={13} /> Fullscreen
                  </button>
                </div>
              )}
            </div>

            <div className="qc-stage-screen">
              {activeItem ? (
                <>
                  {activeItem.type === 'video' ? (
                    <video key={activeItem.url} src={activeItem.url} controls autoPlay className="qc-stage-media" />
                  ) : (
                    <img key={activeItem.url} src={activeItem.url} alt={activeItem.title} className={`qc-stage-media ${isZoomed ? 'zoom' : ''}`} />
                  )}

                  <button type="button" className="qc-stage-nav-btn prev" onClick={handlePrev} disabled={!hasPrev} aria-label="Media Sebelumnya (Arrow Left)" title="Media Sebelumnya (Arrow Left)">
                    <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><Icon name="arrow" size={20} /></span>
                  </button>
                  <button type="button" className="qc-stage-nav-btn next" onClick={handleNext} disabled={!hasNext} aria-label="Media Berikutnya (Arrow Right)" title="Media Berikutnya (Arrow Right)">
                    <Icon name="arrow" size={20} />
                  </button>
                </>
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Tidak ada media yang cocok dengan filter pencarian.</div>
              )}
            </div>

            {activeItem && (
              <div className="qc-stage-footer">
                <div>
                  <span>Flow: </span>
                  <strong style={{ color: 'var(--text-main)' }}>{activeItem.flowName}</strong>
                  {activeItem.size ? <span> · {formatBytes(activeItem.size)}</span> : null}
                </div>
                <div className="qc-stage-progress">
                  <span>{currentIndex + 1} / {filteredItems.length}</span>
                  <i style={{ width: `${((currentIndex + 1) / Math.max(1, filteredItems.length)) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: PLAYLIST */}
          <aside className="qc-playlist">
            <div className="qc-playlist-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <strong>Daftar Bukti</strong>
                <span className="linear-count-badge">
                  {filteredItems.length.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Compact Segmented Type Filter */}
              <div className="qc-type-segmented">
                <button
                  type="button"
                  className={`qc-seg-btn ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                  title={`Semua (${allMediaItems.length})`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  className={`qc-seg-btn ${filterType === 'photo' ? 'active' : ''}`}
                  onClick={() => setFilterType('photo')}
                  title={`Foto (${photoCount})`}
                >
                  Foto{photoCount > 0 ? ` (${photoCount})` : ''}
                </button>
                {videoCount > 0 && (
                  <button
                    type="button"
                    className={`qc-seg-btn ${filterType === 'video' ? 'active' : ''}`}
                    onClick={() => setFilterType('video')}
                    title={`Video (${videoCount})`}
                  >
                    Video ({videoCount})
                  </button>
                )}
              </div>
            </div>

            <div className="qc-playlist-tools">
              {/* Row 1: Search Input */}
              <div style={{ position: 'relative', width: '100%' }}>
                <span style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                  pointerEvents: 'none',
                  display: 'inline-flex'
                }}>
                  <Icon name="search" size={13} />
                </span>
                <input
                  type="text"
                  className="finding-search-input"
                  placeholder="Cari checkpoint, route, nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    paddingLeft: 30,
                    paddingRight: searchQuery ? 28 : 10,
                    height: 32,
                    fontSize: '11.5px',
                    borderRadius: 6
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 2,
                      fontSize: 12
                    }}
                    title="Hapus pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Row 2: Flow Filter Dropdown */}
              {availableFlows.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    className="qc-group-dropdown"
                    value={selectedFlowFilter}
                    onChange={(e) => { setSelectedFlowFilter(e.target.value); setSelectedId(null); }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'var(--bg-panel-sub)',
                      color: selectedFlowFilter !== 'all' ? 'var(--cyan)' : 'var(--text-main)',
                      border: selectedFlowFilter !== 'all' ? '1px solid var(--cyan)' : '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '5px 8px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">Semua Flow Pengujian ({allMediaItems.length} media)</option>
                    {availableFlows.map((fl) => (
                      <option key={fl.name} value={fl.name}>
                        {fl.name} ({fl.count})
                      </option>
                    ))}
                  </select>
                  {selectedFlowFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => { setSelectedFlowFilter('all'); setSelectedId(null); }}
                      className="tool-btn"
                      style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)' }}
                      title="Reset filter flow"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              {/* Row 3: Slim Linear Pager Strip */}
              <div className="qc-playlist-pager-strip">
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button
                    type="button"
                    className="qc-pager-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    title="15 Media Sebelumnya"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="qc-pager-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    title="15 Media Berikutnya"
                  >
                    ›
                  </button>
                </div>

                <div className="qc-pager-info">
                  <strong style={{ color: 'var(--cyan)', fontVariantNumeric: 'tabular-nums' }}>
                    {filteredItems.length > 0 ? `${startIndex + 1}–${endIndex}` : '0'}
                  </strong>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}> dari </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {filteredItems.length.toLocaleString('id-ID')}
                  </span>
                  <span className="qc-pager-page-pill">
                    Hal {safePage}/{totalPages}
                  </span>
                </div>

                <button
                  type="button"
                  className="qc-pager-refresh"
                  onClick={() => setRefreshKey(k => k + 1)}
                  title="Muat ulang daftar media"
                >
                  <Icon name="refresh" size={11} />
                </button>
              </div>
            </div>

            <div className="qc-playlist-body">
              {grouped.length === 0 ? (
                <div className="qc-playlist-empty">Tidak ada media yang cocok dengan filter.</div>
              ) : (
                <>
                  {grouped.map(([groupName, groupData]) => (
                    <div key={groupName} className="qc-playlist-group">
                      <div className="qc-playlist-group-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                          <span style={{ color: 'var(--cyan)', display: 'inline-flex', flexShrink: 0 }}><Icon name="flows" size={12} /></span>
                          <span style={{ fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</span>
                        </div>
                        <em>{groupData.items.length} media</em>
                      </div>
                      {groupData.items.map((item) => {
                        const isActive = activeItem?.id === item.id;
                        const isHex = /^[0-9a-fA-F]{6,}[\s-_]+[0-9a-fA-F]{6,}/i.test(item.title) ||
                                      /^[0-9a-fA-F]{10,}$/i.test(item.title.replace(/[\s-_]/g, ''));
                        const displayTitle = isHex
                          ? (item.route ? `Layar: ${item.route}` : `Tangkapan Layar (#${item.title.replace(/[\s-_]/g, '').slice(0, 8)})`)
                          : item.title;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`qc-playlist-item ${isActive ? 'active' : ''}`}
                            onClick={() => { setSelectedId(item.id); setIsZoomed(false); }}
                            title={displayTitle}
                          >
                            <div className="qc-playlist-thumb">
                              {item.type === 'photo' ? (
                                <img
                                  src={`${item.url}${refreshKey ? `?_r=${refreshKey}` : ''}`}
                                  alt={displayTitle}
                                  loading="lazy"
                                />
                              ) : (
                                <span className="qc-thumb-play-icon"><Icon name="runs" size={14} /></span>
                              )}
                            </div>
                            <div className="qc-playlist-meta">
                              <strong>{displayTitle}</strong>
                              <small>
                                <span className={`qc-type-pill sm ${item.type}`}>{typeLabel(item.type)}</span>
                                <span style={{ color: 'var(--text-dim)' }}>·</span>
                                <span className="qc-item-flow" title={item.flowName}>{item.flowName}</span>
                                {item.route ? (
                                  <>
                                    <span style={{ color: 'var(--text-dim)' }}>·</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{item.route}</span>
                                  </>
                                ) : item.size ? (
                                  <>
                                    <span style={{ color: 'var(--text-dim)' }}>·</span>
                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(item.size)}</span>
                                  </>
                                ) : null}
                              </small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Bottom Next 15 jumper button */}
                  {safePage < totalPages && (
                    <div style={{ padding: '6px 4px 10px 4px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '11px',
                          background: 'rgba(56, 189, 248, 0.06)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          color: 'var(--cyan)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <span>Halaman Berikutnya ({safePage + 1}/{totalPages})</span>
                        <Icon name="arrow" size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
