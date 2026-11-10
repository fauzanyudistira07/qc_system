import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Job, QualityEvidence, Artifact } from './types';
import { Icon, Empty, Notice } from './ui';
import {
  request,
  download,
  artifactUrl,
  getNextcloudConfig,
  checkNextcloudFolder,
  uploadToNextcloud,
  downloadMediaZip,
  type NextcloudFolderCheck,
  type NextcloudUploadResponse
} from './api';

export interface MediaItem {
  id: string;
  type: 'video' | 'photo';
  title: string;
  url: string;
  flowName: string;
  groupTitle?: string;
  route?: string;
  role?: string;
  size?: number;
  updatedAt?: string;
  isLongScreenshot?: boolean;
  dimensions?: string;
  chapters?: Array<{ startSec: number; page: string; feature?: string }>;
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes < 1024) return bytes ? `${bytes} B` : '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeMMSS(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

interface LiveViewportProps {
  job?: Job | null;
  evidence?: QualityEvidence | null;
  hideHeader?: boolean;
}

function readableFlowName(flowId?: string, knownFlows?: Array<{ id: string; name: string }>): { name: string } {
  if (!flowId) return { name: 'Skenario Flow' };
  if (knownFlows?.length) {
    const directMatch = knownFlows.find(f => f.id === flowId || f.name.toLowerCase().includes(flowId.toLowerCase()));
    if (directMatch) return { name: directMatch.name };
  }
  const clean = flowId
    .replace(/^(android|web|app)-/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { name: clean };
}

function humanizeMediaTitle(raw: string, isVid: boolean, flowId?: string, knownFlows?: Array<{ id: string; name: string }>): string {
  if (raw.startsWith('Rekaman:') || raw.startsWith('[')) return raw;
  if (flowId && isVid) {
    const f = readableFlowName(flowId, knownFlows);
    return `Rekaman: ${f.name}`;
  }

  let name = (raw.split('/').pop() || raw).replace(/\\/g, '/').split('/').pop() || raw;
  name = name.replace(/\.(png|jpg|jpeg|webm|mp4)$/i, '');

  // Phase 1 role video naming: <role>__full_journey
  const roleVidMatch = name.match(/^([a-z0-9_-]+)__full[-_]?journey$/i);
  if (isVid && roleVidMatch) {
    return `Rekaman Full Flow: Role ${roleVidMatch[1]}`;
  }

  // Phase 1 long screenshot naming: <role>__<slug>__full
  const longSsMatch = name.match(/^([a-z0-9_-]+)__(.+)__full$/i);
  if (!isVid && longSsMatch) {
    const slugTitle = longSsMatch[2].replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `[${longSsMatch[1]}] Long SS: ${slugTitle}`;
  }

  if (isVid) {
    if (name.includes('rekaman flow') || name === 'flow-recording') {
      return 'Rekaman Video QC';
    }
    const cleanVidName = name
      .replace(/^video-\d+-/i, '')
      .replace(/^flow_\d+_/i, '')
      .replace(/^flow-/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `Rekaman: ${cleanVidName}`;
  }

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
  const cleanTitle = humanizeMediaTitle(item.rawName, item.isVid, item.flowId, item.knownFlows);
  const baseName = (item.rawName.split('/').pop() || item.rawName).replace(/\.(png|jpg|jpeg|webm|mp4)$/i, '');

  const longSsMatch = baseName.match(/^([a-z0-9_-]+)__(.+)__full$/i);
  if (!item.isVid && longSsMatch) {
    return { flowName: `Batch 1 · Role: ${longSsMatch[1]}`, cleanTitle };
  }

  const roleVidMatch = baseName.match(/^([a-z0-9_-]+)__full[-_]?journey$/i);
  if (item.isVid && roleVidMatch) {
    return { flowName: `Batch 2 · Video Role: ${roleVidMatch[1]}`, cleanTitle };
  }

  if (item.label) {
    let clean = item.label.replace(/^Rekaman:\s*/i, '').trim();
    if (clean.includes(' · ')) {
      clean = clean.split(' · ')[0].trim();
    }
    if (/^\d+\.\s+/.test(clean) || /^Tahap\s*\d+/i.test(clean) || /^Batch\s*\d+/i.test(clean)) {
      return { flowName: clean, cleanTitle };
    }
    if (clean.length > 3 && !clean.includes('.png') && !clean.includes('.webm') && !clean.includes('.mp4')) {
      return { flowName: clean, cleanTitle };
    }
  }

  if (item.flowId && item.knownFlows?.length) {
    const match = item.knownFlows.find(f => f.id === item.flowId || f.name.toLowerCase().includes(item.flowId!.toLowerCase()));
    if (match) {
      return { flowName: match.name, cleanTitle };
    }
  }

  if (item.groupTitle && !item.groupTitle.includes('Flow Executions') && !item.groupTitle.includes('UI Quality Audit')) {
    return { flowName: item.groupTitle, cleanTitle };
  }

  if (item.flowId) {
    return { flowName: readableFlowName(item.flowId).name, cleanTitle };
  }

  return { flowName: 'Discovery & Inventori Halaman', cleanTitle };
}

export function LiveViewport({ job, evidence, hideHeader }: LiveViewportProps) {
  const [filterType, setFilterType] = useState<'all' | 'video' | 'photo'>('all');
  const [selectedFlowFilter, setSelectedFlowFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [fetchedEvidence, setFetchedEvidence] = useState<QualityEvidence | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipError, setZipError] = useState('');
  const [nextcloudBaseFolder, setNextcloudBaseFolder] = useState('QC-Maestro/Media');
  const stageRef = useRef<HTMLDivElement>(null);
  const stageVideoRef = useRef<HTMLVideoElement>(null);

  interface NcModalState {
    isOpen: boolean;
    step: 'checking' | 'confirm' | 'uploading' | 'completed' | 'error';
    items: MediaItem[];
    folderMode: 'same' | 'new';
    customFolderName: string;
    checkResult: NextcloudFolderCheck | null;
    uploadProgress: { current: number; total: number; currentFileName: string };
    uploadResult: NextcloudUploadResponse | null;
    errorMessage: string | null;
  }

  const [ncModal, setNcModal] = useState<NcModalState>({
    isOpen: false,
    step: 'checking',
    items: [],
    folderMode: 'new',
    customFolderName: '',
    checkResult: null,
    uploadProgress: { current: 0, total: 0, currentFileName: '' },
    uploadResult: null,
    errorMessage: null
  });

  const projectName = useMemo(() => {
    const raw = (
      job?.config?.name ||
      job?.name ||
      evidence?.project ||
      'Project QC'
    );
    return raw
      .replace(/\s*\([^)]*(?:suite|test|run|retest|e2e|assisted)[^)]*\)/gi, '')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .trim();
  }, [job?.config?.name, job?.name, evidence?.project]);

  const handleDownloadItem = async (item: MediaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isVideo = item.type === 'video';
    const ext = isVideo ? (item.url.endsWith('.mp4') ? 'mp4' : 'webm') : 'png';
    const cleanTitle = (item.title || 'media')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const filename = `${cleanTitle}.${ext}`;

    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      download(blob, filename, blob.type);
    } catch {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const openNextcloudModal = async (itemsToUpload: MediaItem[]) => {
    if (!itemsToUpload.length) return;
    setNcModal({
      isOpen: true,
      step: 'checking',
      items: itemsToUpload,
      folderMode: 'new',
      customFolderName: '',
      checkResult: null,
      uploadProgress: { current: 0, total: itemsToUpload.length, currentFileName: '' },
      uploadResult: null,
      errorMessage: null
    });

    let activeBaseFolder = nextcloudBaseFolder;
    try {
      const ncCfg = await getNextcloudConfig();
      if (ncCfg?.baseFolder) {
        activeBaseFolder = ncCfg.baseFolder;
        setNextcloudBaseFolder(ncCfg.baseFolder);
      }
    } catch {}

    try {
      const check = await checkNextcloudFolder(projectName);
      setNcModal(prev => ({
        ...prev,
        step: 'confirm',
        checkResult: check,
        folderMode: check.exists ? 'same' : 'new',
        customFolderName: check.suggestedNewFolder
      }));
    } catch {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      const fallbackSuggested = `${projectName} (${dateStr} ${timeStr})`;
      setNcModal(prev => ({
        ...prev,
        step: 'confirm',
        checkResult: {
          exists: false,
          projectName,
          targetFolder: projectName,
          fullPath: `${activeBaseFolder}/${projectName}`,
          suggestedNewFolder: fallbackSuggested,
          webUrl: ''
        },
        folderMode: 'new',
        customFolderName: fallbackSuggested
      }));
    }
  };

  const closeNextcloudModal = () => {
    if (ncModal.step === 'uploading') return;
    setNcModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleStartUpload = async () => {
    if (!ncModal.items.length) return;
    const finalFolder = ncModal.folderMode === 'new'
      ? (ncModal.customFolderName.trim() || ncModal.checkResult?.suggestedNewFolder || projectName)
      : (ncModal.checkResult?.targetFolder || projectName);

    const total = ncModal.items.length;
    setNcModal(prev => ({
      ...prev,
      step: 'uploading',
      uploadProgress: { current: 0, total, currentFileName: 'Menyiapkan berkas pengunggahan...' }
    }));

    try {
      let uploadedCount = 0;
      let failedCount = 0;
      const allFiles: any[] = [];
      let fullPath = '';
      let webUrl = '';

      for (let i = 0; i < total; i++) {
        const item = ncModal.items[i];
        const fileName = `${(item.title || 'media').replace(/[\\/:*?"<>|]+/g, '_').trim()}.${item.type === 'video' ? 'mp4' : 'png'}`;

        setNcModal(prev => ({
          ...prev,
          uploadProgress: {
            current: i + 1,
            total,
            currentFileName: `${item.title || fileName} (${i + 1}/${total})`
          }
        }));

        const itemVp = (() => {
          const t = `${item.title || ''} ${item.url || ''}`.toLowerCase();
          if (t.includes('mobile') || t.includes('_mobile')) return 'mobile';
          if (t.includes('tablet') || t.includes('_tablet')) return 'tablet';
          return 'desktop';
        })();

        const uploadItem = {
          url: item.url,
          featureName: item.flowName || 'General',
          type: item.type,
          title: item.title,
          fileName,
          viewport: itemVp
        };

        const res = await uploadToNextcloud({
          folderName: finalFolder,
          items: [uploadItem],
          jobId: job?.id
        });

        uploadedCount += res.uploadedCount || 0;
        failedCount += res.failedCount || 0;
        if (res.files) allFiles.push(...res.files);
        if (res.fullPath) fullPath = res.fullPath;
        if (res.webUrl) webUrl = res.webUrl;
      }

      setNcModal(prev => ({
        ...prev,
        step: 'completed',
        uploadResult: {
          success: uploadedCount > 0,
          projectName,
          folderName: finalFolder,
          targetFolder: finalFolder,
          fullPath,
          webUrl,
          uploadedCount,
          failedCount,
          files: allFiles
        } as any
      }));
    } catch (err) {
      setNcModal(prev => ({
        ...prev,
        step: 'error',
        errorMessage: err instanceof Error ? err.message : String(err)
      }));
    }
  };

  // Auto-fetch quality-evidence if job is provided
  useEffect(() => {
    let cancelled = false;
    const fetchJobEvidence = async () => {
      if (!job?.id) return;
      try {
        const ev = await request<QualityEvidence>(`/api/v1/discovery/jobs/${job.id}/quality-evidence`);
        if (!cancelled && ev) setFetchedEvidence(ev);
      } catch {
        try {
          const evAlt = await request<QualityEvidence>(`/api/v1/discovery/jobs/${job.id}/evidence`);
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
    const seenBaseFiles = new Set<string>();
    const seenTitles = new Set<string>();

    const pushItem = (item: MediaItem) => {
      if (!item.url || seenUrls.has(item.url)) return;
      if (item.type === 'video' && item.size && item.size < 8192) return;

      const baseFile = item.url.split('?')[0].split('#')[0].split('/').pop()?.toLowerCase();
      if (baseFile && seenBaseFiles.has(baseFile)) return;
      if (baseFile) seenBaseFiles.add(baseFile);

      // Deduplicate identical checkpoint titles within the same flow & media type
      if (item.title) {
        const titleKey = `${item.flowName || ''}:::${item.type}:::${item.title.toLowerCase().trim()}`;
        if (seenTitles.has(titleKey)) return;
        seenTitles.add(titleKey);
      }

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

    // 0A. Phase-1 First-Class Batch 1 Long Screenshots (1 tall full-page image per accessible page per role)
    if (job?.longScreenshots?.length) {
      for (const s of job.longScreenshots) {
        if (s.status !== 'CAPTURED') continue;
        const resolvedUrl = artifactUrl(job.id, s.url || s.path);
        if (!resolvedUrl) continue;
        pushItem({
          id: resolvedUrl,
          type: 'photo',
          title: `[${s.role}] ${s.pageTitle || s.pagePath}`,
          url: resolvedUrl,
          route: s.pagePath,
          role: s.role,
          flowName: `Batch 1 · Role: ${s.role}`,
          groupTitle: `Batch 1 · Long Screenshots (${s.role})`,
          isLongScreenshot: true,
          dimensions: `${s.width}×${s.height}px (${s.segmentCount} segmen)`
        });
      }
    }

    // 0B. Phase-1 First-Class Batch 2 Role Videos (1 continuous journey video per role with interactive chapters)
    if (job?.roleVideos?.length) {
      for (const v of job.roleVideos) {
        if (v.status !== 'RECORDED') continue;
        const resolvedUrl = artifactUrl(job.id, v.url || v.path);
        if (!resolvedUrl) continue;
        pushItem({
          id: resolvedUrl,
          type: 'video',
          title: `Rekaman Full Flow · Role: ${v.role} (${v.durationSec}s)`,
          url: resolvedUrl,
          role: v.role,
          size: v.sizeBytes,
          chapters: v.chapters,
          flowName: `Batch 2 · Video Role: ${v.role}`,
          groupTitle: `Batch 2 · Video Role (${v.role})`
        });
      }
    }

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
          const pageFlow = page.role
            ? `Discovery · Role: ${page.role}`
            : 'Discovery & Inventori Halaman';

          pushItem({
            id: resolved,
            type: 'photo',
            title: page.title || page.path || 'Screenshot Halaman',
            url: resolved,
            route: page.path,
            role: page.role,
            flowName: pageFlow,
            groupTitle: pageFlow
          });
        }
      });
    }

    const getFlowOrder = (flowName?: string, title?: string) => {
      const target = `${flowName || ''} ${title || ''}`;
      const m = target.match(/^(\d+)\./) || 
                target.match(/Rekaman:\s*(\d+)\./i) || 
                target.match(/\bTahap\s*(\d+)/i) || 
                target.match(/\bFlow\s*(\d+)/i) ||
                target.match(/ai-flow-(\d+)/i) ||
                target.match(/flow_?(\d+)/i) ||
                target.match(/video-?(\d+)/i) ||
                target.match(/step-?(\d+)/i);
      if (m) return parseInt(m[1], 10);
      if (target.includes('Autonomous')) return 50;
      if (target.includes('Discovery')) return 100;
      return 999;
    };

    // 4. Sort: Flow number 1..15 first, then within each flow Video first, then photos by natural title
    return items.sort((a, b) => {
      const orderA = getFlowOrder(a.flowName, a.title);
      const orderB = getFlowOrder(b.flowName, b.title);
      if (orderA !== orderB) return orderA - orderB;
      if (a.type !== b.type) return a.type === 'video' ? -1 : 1;
      return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [evidence, fetchedEvidence, job]);

  // Available flows for filtering
  const availableFlows = useMemo(() => {
    const map = new Map<string, { name: string; count: number; order: number }>();

    for (const item of allMediaItems) {
      const flow = item.flowName || 'Discovery & Inventori Halaman';

      if (!map.has(flow)) {
        let order = 999;
        const numMatch = flow.match(/^(\d+)\./) || 
                         flow.match(/Rekaman:\s*(\d+)\./i) || 
                         flow.match(/\bTahap\s*(\d+)/i) || 
                         flow.match(/\bFlow\s*(\d+)/i) ||
                         flow.match(/ai-flow-(\d+)/i);
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

    return Array.from(map.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
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

  const handleDownloadAllZip = async () => {
    if (allMediaItems.length === 0 || isZipping) return;
    setZipError('');
    setIsZipping(true);
    try {
      const items = allMediaItems.map(item => {
        const t = `${item.title || ''} ${item.url || ''}`.toLowerCase();
        let vp = 'desktop';
        if (t.includes('mobile') || t.includes('_mobile')) vp = 'mobile';
        else if (t.includes('tablet') || t.includes('_tablet')) vp = 'tablet';
        return {
          url: item.url,
          featureName: item.flowName || 'General',
          type: item.type,
          title: item.title,
          fileName: `${(item.title || 'media').replace(/[\\/:*?"<>|]+/g, '_').trim()}.${item.type === 'video' ? (item.url.endsWith('.webm') ? 'webm' : 'mp4') : 'png'}`,
          viewport: vp
        };
      });
      await downloadMediaZip({
        projectName,
        items,
        jobId: job?.id
      });
    } catch (err) {
      setZipError(`Gagal mengunduh ZIP: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsZipping(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (ncModal.isOpen) {
        if (e.key === 'Escape' && ncModal.step !== 'uploading') {
          closeNextcloudModal();
        }
        return;
      }
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

        <div className="qc-media-sync-actions">
          <button
            type="button"
            className="tool-btn"
            onClick={handleDownloadAllZip}
            disabled={allMediaItems.length === 0 || isZipping}
            title="Unduh seluruh foto dan video dalam satu file ZIP terkompresi"
            style={{ gap: 6, padding: '7px 12px' }}
          >
            {isZipping ? (
              <>
                <div style={{
                  width: 13,
                  height: 13,
                  border: '2px solid rgba(43, 133, 228, 0.2)',
                  borderTopColor: 'var(--cyan)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block'
                }} />
                <span>Mengompres ZIP...</span>
              </>
            ) : (
              <>
                <Icon name="download" size={14} />
                <span>Unduh Semua (.zip)</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="tool-btn primary"
            onClick={() => openNextcloudModal(allMediaItems)}
            disabled={allMediaItems.length === 0}
            title="Sinkronisasi seluruh hasil screenshot dan video ke Nextcloud"
            style={{ gap: 6, padding: '7px 14px' }}
          >
            <Icon name="cloud" size={14} />
            <span>Export ke Nextcloud ({allMediaItems.length})</span>
          </button>
        </div>
      </div>

      {zipError && (
        <Notice error>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>{zipError}</span>
            <button type="button" className="quiet" onClick={() => setZipError('')} style={{ fontSize: 11 }}>Tutup</button>
          </div>
        </Notice>
      )}

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
                {activeItem?.route && (
                  <span className="tag" style={{ color: 'var(--cyan)' }} data-tooltip={activeItem.route} title={activeItem.route}>
                    {activeItem.route}
                  </span>
                )}
              </div>

              {activeItem && (
                <div className="qc-stage-header-actions">
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={(e) => handleDownloadItem(activeItem, e)}
                    title={`Unduh ${activeItem.type === 'video' ? 'rekaman video' : 'screenshot foto'} ini`}
                    style={{ gap: 6 }}
                  >
                    <Icon name="download" size={13} />
                    <span>Download {activeItem.type === 'video' ? 'Video' : 'Foto'}</span>
                  </button>
                  <button
                    type="button"
                    className="tool-btn primary"
                    onClick={() => openNextcloudModal([activeItem])}
                    title="Unggah media ini langsung ke folder Nextcloud"
                    style={{ gap: 6 }}
                  >
                    <Icon name="cloud" size={13} />
                    <span>Upload Nextcloud</span>
                  </button>
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

            <div className={`qc-stage-screen ${activeItem?.isLongScreenshot && !isZoomed ? 'is-long-scroll' : ''}`}>
              {activeItem ? (
                <>
                  {activeItem.type === 'video' ? (
                    <video
                      ref={stageVideoRef}
                      key={activeItem.url}
                      src={activeItem.url}
                      controls
                      autoPlay
                      playsInline
                      preload="metadata"
                      className="qc-stage-media"
                    />
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

            {activeItem?.type === 'video' && activeItem.chapters && activeItem.chapters.length > 0 && (
              <div className="qc-video-chapters-bar">
                <span className="chapters-kicker">Chapter Timeline:</span>
                {activeItem.chapters.map((ch, cIdx) => (
                  <button
                    key={`${ch.startSec}-${cIdx}`}
                    type="button"
                    className="qc-chapter-chip"
                    onClick={() => {
                      const video = stageVideoRef.current;
                      if (video) {
                        video.currentTime = ch.startSec;
                        void video.play().catch(() => {});
                      }
                    }}
                    title={`Lompat ke ${formatTimeMMSS(ch.startSec)}`}
                  >
                    <span className="chapter-time">{formatTimeMMSS(ch.startSec)}</span>
                    <span>{ch.page}{ch.feature ? ` · ${ch.feature}` : ''}</span>
                  </button>
                ))}
              </div>
            )}

            {activeItem && (
              <div className="qc-stage-footer">
                <div>
                  <span>Flow: </span>
                  <strong style={{ color: 'var(--text-main)' }}>{activeItem.flowName}</strong>
                  {activeItem.dimensions ? <span> · {activeItem.dimensions}</span> : null}
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
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }} data-tooltip={item.route} title={item.route}>{item.route}</span>
                                  </>
                                ) : item.size ? (
                                  <>
                                    <span style={{ color: 'var(--text-dim)' }}>·</span>
                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(item.size)}</span>
                                  </>
                                ) : null}
                              </small>
                            </div>
                            <span
                              role="button"
                              tabIndex={0}
                              className="qc-playlist-quick-dl"
                              onClick={(e) => handleDownloadItem(item, e)}
                              title={`Unduh ${item.type === 'video' ? 'video' : 'foto'} ini`}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleDownloadItem(item); }}
                            >
                              <Icon name="download" size={12} />
                            </span>
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

      {/* NEXTCLOUD SYNC MODAL */}
      {ncModal.isOpen && (
        <div className="qc-nc-modal-backdrop" onClick={closeNextcloudModal}>
          <div className="qc-nc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qc-nc-modal-header">
              <h3>
                <span style={{ color: 'var(--cyan)', display: 'inline-flex' }}><Icon name="cloud" size={18} /></span>
                <span>Unggah ke Nextcloud</span>
              </h3>
              <button
                type="button"
                className="tool-btn"
                onClick={closeNextcloudModal}
                disabled={ncModal.step === 'uploading'}
                style={{ padding: '4px 8px' }}
                title="Tutup (Esc)"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="qc-nc-modal-body">
              {/* Step 1: Checking */}
              {ncModal.step === 'checking' && (
                <div style={{ textAlign: 'center', padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    border: '3px solid rgba(43, 133, 228, 0.2)',
                    borderTopColor: 'var(--cyan)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <strong>Memeriksa direktori di Nextcloud...</strong>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    Menghubungi WebDAV Nextcloud di <code>{nextcloudBaseFolder}/{projectName}</code>
                  </span>
                </div>
              )}

              {/* Step 2: Confirm & Collision Choice */}
              {ncModal.step === 'confirm' && (
                <>
                  {ncModal.checkResult?.exists ? (
                    <div className="qc-nc-banner warning">
                      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><Icon name="warning" size={18} /></span>
                      <div>
                        <strong>Folder Proyek Sudah Ditemukan di Nextcloud</strong>
                        <p style={{ margin: '4px 0 0 0' }}>
                          Folder <code>{ncModal.checkResult.targetFolder}</code> sudah ada di <code>{nextcloudBaseFolder}</code> karena pengujian pernah diminta sebelumnya.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="qc-nc-banner info">
                      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><Icon name="check" size={18} /></span>
                      <div>
                        <strong>Siap Membuat Folder Baru di Nextcloud</strong>
                        <p style={{ margin: '4px 0 0 0' }}>
                          Folder <code>{ncModal.checkResult?.targetFolder || projectName}</code> akan otomatis dibuat di <code>{nextcloudBaseFolder}</code>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* If folder already exists: ask user whether to merge or create new */}
                  {ncModal.checkResult?.exists && (
                    <div className="qc-nc-options-group">
                      <label className={`qc-nc-option-card ${ncModal.folderMode === 'same' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="folderMode"
                          checked={ncModal.folderMode === 'same'}
                          onChange={() => setNcModal(prev => ({ ...prev, folderMode: 'same' }))}
                        />
                        <div className="qc-nc-option-content">
                          <strong>Letakkan di Folder yang Sama</strong>
                          <p>
                            Simpan ke dalam folder yang sudah ada: <code>{ncModal.checkResult?.targetFolder}</code>.
                            Subfolder fitur foto &amp; video akan digabungkan atau diperbarui secara otomatis.
                          </p>
                          {ncModal.checkResult?.existingFolders && ncModal.checkResult.existingFolders.length > 1 && (
                            <div style={{ marginTop: 6 }}>
                              <select
                                value={ncModal.checkResult.targetFolder}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNcModal(prev => ({
                                    ...prev,
                                    checkResult: prev.checkResult ? { ...prev.checkResult, targetFolder: val } : null
                                  }));
                                }}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  marginTop: 4,
                                  padding: '5px 8px',
                                  fontSize: 12,
                                  borderRadius: 6,
                                  background: 'var(--bg-panel-sub)',
                                  color: 'var(--text-main)',
                                  border: '1px solid var(--border)'
                                }}
                              >
                                {ncModal.checkResult.existingFolders.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </label>

                      <label className={`qc-nc-option-card ${ncModal.folderMode === 'new' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="folderMode"
                          checked={ncModal.folderMode === 'new'}
                          onChange={() => setNcModal(prev => ({ ...prev, folderMode: 'new' }))}
                        />
                        <div className="qc-nc-option-content">
                          <strong>Buat Folder Baru di Nextcloud</strong>
                          <p>
                            Pisahkan hasil pengujian ini ke folder terpisah agar riwayat tidak tertumpuk dengan batch sebelumnya.
                          </p>
                          {ncModal.folderMode === 'new' && (
                            <div style={{ marginTop: 8 }}>
                              <input
                                type="text"
                                className="finding-search-input"
                                value={ncModal.customFolderName}
                                onChange={(e) => setNcModal(prev => ({ ...prev, customFolderName: e.target.value }))}
                                placeholder="Nama folder baru..."
                                style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                              />
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Summary Pills */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                      Ringkasan Media Yang Akan Diunggah
                    </span>
                    <div className="qc-nc-stats-pills" style={{ marginTop: 8 }}>
                      <span className="qc-nc-pill">
                        📸 {ncModal.items.filter(i => i.type === 'photo').length} Foto
                      </span>
                      <span className="qc-nc-pill">
                        🎥 {ncModal.items.filter(i => i.type === 'video').length} Video
                      </span>
                      <span className="qc-nc-pill">
                        🗂️ {new Set(ncModal.items.map(i => i.flowName || 'General')).size} Subfolder Fitur
                      </span>
                      <span className="qc-nc-pill">
                        Total: {ncModal.items.length} Berkas
                      </span>
                    </div>
                  </div>

                  {/* Tree Structure Preview */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                      Struktur Hierarki Folder Nextcloud
                    </span>
                    <div className="qc-nc-tree" style={{ marginTop: 8 }}>
                      {`📁 ${nextcloudBaseFolder} > ${ncModal.folderMode === 'new' ? (ncModal.customFolderName || ncModal.checkResult?.suggestedNewFolder || projectName) : (ncModal.checkResult?.targetFolder || projectName)}/
${Array.from(new Set(ncModal.items.map(i => i.flowName || 'General'))).slice(0, 4).map((f, idx, arr) => {
  const isLast = idx === arr.length - 1 && arr.length <= 4;
  const branch = isLast ? '└──' : '├──';
  const subBranch = isLast ? '    ' : '│   ';
  return `  ${branch} 📁 ${f}/
  ${subBranch}├── 📁 foto/
  ${subBranch}└── 📁 video/`;
}).join('\n')}${new Set(ncModal.items.map(i => i.flowName || 'General')).size > 4 ? '\n  └── ... dan subfolder fitur lainnya' : ''}`}
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Uploading */}
              {ncModal.step === 'uploading' && (
                <div style={{ padding: '20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="led-dot running" style={{ width: 8, height: 8 }} />
                      <strong style={{ fontSize: 13.5, color: 'var(--text-main)' }}>
                        Mengunggah Media ke Nextcloud...
                      </strong>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--cyan)', fontVariantNumeric: 'tabular-nums' }}>
                      {ncModal.uploadProgress.current} / {ncModal.uploadProgress.total} file ({Math.round((ncModal.uploadProgress.current / Math.max(1, ncModal.uploadProgress.total)) * 100)}%)
                    </span>
                  </div>

                  <div className="qc-nc-progress-wrap" style={{ height: 8, background: 'var(--bg-panel-sub)', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      className="qc-nc-progress-bar"
                      style={{
                        height: '100%',
                        background: 'var(--cyan)',
                        borderRadius: 999,
                        width: `${ncModal.uploadProgress.total > 0 ? Math.min(100, Math.max(5, (ncModal.uploadProgress.current / ncModal.uploadProgress.total) * 100)) : 10}%`,
                        transition: 'width 220ms cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    />
                  </div>

                  <div style={{ padding: '10px 14px', background: 'var(--bg-panel-sub)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Berkas Sedang Ditransfer:
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontWeight: 650, wordBreak: 'break-all' }}>
                      {ncModal.uploadProgress.currentFileName}
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-dim)', fontSize: 11.5, margin: 0 }}>
                    Mohon tunggu sejenak, berkas dikirim bertahap via WebDAV langsung ke Nextcloud agar tidak membebani koneksi server.
                  </p>
                </div>
              )}

              {/* Step 4: Completed */}
              {ncModal.step === 'completed' && ncModal.uploadResult && (
                <div className="qc-nc-success-box">
                  <div className="qc-nc-success-icon">
                    <Icon name="check" size={24} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 15, color: '#15803d' }}>
                      Berhasil Mengunggah {ncModal.uploadResult.uploadedCount} Media ke Nextcloud!
                    </strong>
                    <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Folder: <code>{ncModal.uploadResult.fullPath}</code>
                    </p>
                    {ncModal.uploadResult.failedCount > 0 && (
                      <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>
                        {ncModal.uploadResult.failedCount} berkas gagal diunggah.
                      </p>
                    )}
                  </div>

                  <a
                    href={ncModal.uploadResult.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="qc-nc-btn-open"
                  >
                    <span>Buka Folder di Nextcloud</span>
                    <Icon name="arrow" size={13} />
                  </a>
                </div>
              )}

              {/* Step 5: Error */}
              {ncModal.step === 'error' && (
                <div style={{ padding: '20px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: 'var(--red)', display: 'inline-flex' }}><Icon name="warning" size={32} /></span>
                  <strong style={{ color: 'var(--red)' }}>Gagal Mengunggah ke Nextcloud</strong>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 440 }}>
                    {ncModal.errorMessage || 'Terjadi kesalahan saat berkomunikasi dengan server Nextcloud.'}
                  </p>
                </div>
              )}
            </div>

            <div className="qc-nc-modal-footer">
              {ncModal.step === 'confirm' && (
                <>
                  <button type="button" className="tool-btn" onClick={closeNextcloudModal}>
                    Batal
                  </button>
                  <button
                    type="button"
                    className="tool-btn primary"
                    onClick={handleStartUpload}
                    style={{ gap: 6, padding: '7px 16px' }}
                  >
                    <Icon name="cloud" size={14} />
                    <span>Mulai Unggah ke Nextcloud ({ncModal.items.length})</span>
                  </button>
                </>
              )}
              {ncModal.step === 'completed' && (
                <button type="button" className="tool-btn primary" onClick={closeNextcloudModal}>
                  Selesai
                </button>
              )}
              {ncModal.step === 'error' && (
                <>
                  <button type="button" className="tool-btn" onClick={closeNextcloudModal}>
                    Tutup
                  </button>
                  <button type="button" className="tool-btn primary" onClick={() => openNextcloudModal(ncModal.items)}>
                    Coba Lagi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
