import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Job, ZannoraEvidence, Artifact } from './types';
import { Icon, Empty } from './ui';
import {
  request,
  download,
  artifactUrl,
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

function readableFlowName(flowId?: string, knownFlows?: Array<{ id: string; name: string }>): { name: string } {
  if (!flowId) return { name: 'Skenario Flow' };
  if (knownFlows?.length) {
    const directMatch = knownFlows.find(f => f.id === flowId || f.name.toLowerCase().includes(flowId.toLowerCase()));
    if (directMatch) return { name: directMatch.name };
  }
  if (flowId.includes('launch') || flowId.includes('smoke') || flowId.includes('01')) {
    return { name: '1. Clean Install & Launch' };
  }
  if (flowId.includes('login') || flowId.includes('auth') || flowId.includes('02')) {
    return { name: '2. Login Siswa (SISWA001) & Masuk Dashboard' };
  }
  if (flowId.includes('tabs-all') || flowId.includes('semua-tab') || flowId.includes('03')) {
    return { name: '3. Navigasi Semua Tab Dashboard Utama' };
  }
  if (flowId.includes('home-explore') || flowId.includes('beranda') || flowId.includes('04')) {
    return { name: '4. Eksplorasi Widget Beranda & Telemetri Siswa' };
  }
  if (flowId.includes('crud-amal') || flowId.includes('amal') || flowId.includes('05')) {
    return { name: '5. CRUD Mutasi Ibadah Amal Siswa Harian' };
  }
  if (flowId.includes('crud-izin') || flowId.includes('absensi') || flowId.includes('06')) {
    return { name: '6. CRUD Pengajuan Izin & Riwayat Absensi' };
  }
  if (flowId.includes('keuangan') || flowId.includes('invoice') || flowId.includes('07')) {
    return { name: '7. Eksplorasi Tagihan Keuangan & Rincian Pembayaran' };
  }
  if (flowId.includes('informasi') || flowId.includes('disiplin') || flowId.includes('08')) {
    return { name: '8. Tab Informasi Sekolah, Kedisiplinan & Pengumuman' };
  }
  if (flowId.includes('t2q') || flowId.includes('tahfidz') || flowId.includes('09')) {
    return { name: '9. Eksplorasi Tab T2Q (Tahfidz, Tahsin, Tilawah)' };
  }
  if (flowId.includes('drawer') || flowId.includes('profil') || flowId.includes('10')) {
    return { name: '10. Navigasi Menu Samping (Drawer): Profil & Ekskul' };
  }
  if (flowId.includes('kalender') || flowId.includes('berita') || flowId.includes('11')) {
    return { name: '11. Quick Actions: Kalender Kegiatan & Detail Berita' };
  }
  if (flowId.includes('notifikasi') || flowId.includes('broadcast') || flowId.includes('12')) {
    return { name: '12. Pusat Notifikasi & Broadcast Pesan Sekolah' };
  }
  if (flowId.includes('role-guru') || flowId.includes('13')) {
    return { name: '13. Switch Role & Akses Dashboard Dewan Guru' };
  }
  if (flowId.includes('role-manager') || flowId.includes('14')) {
    return { name: '14. Switch Role & Akses Dashboard Manager Sarpras' };
  }
  if (flowId.includes('role-teknisi') || flowId.includes('15')) {
    return { name: '15. Switch Role & Akses Dashboard Staff Teknisi' };
  }
  const clean = flowId
    .replace(/^(android|web|app)-/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { name: clean };
}

function humanizeMediaTitle(raw: string, isVid: boolean, flowId?: string, knownFlows?: Array<{ id: string; name: string }>): string {
  if (raw.startsWith('Rekaman:')) return raw;
  if (flowId && isVid) {
    const f = readableFlowName(flowId, knownFlows);
    return `Rekaman: ${f.name}`;
  }

  let name = (raw.split('/').pop() || raw).replace(/\\/g, '/').split('/').pop() || raw;
  name = name.replace(/\.(png|jpg|jpeg|webm|mp4)$/i, '');

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

  // Friendly name replacements
  if (name.includes('01_01_install') || name.includes('permission') || name.includes('install-launch')) return 'Izin Sistem & Instalasi APK Berhasil';
  if (name.includes('00_splash_screen') || name.includes('splash')) return 'Splash Screen Logo Al-Hikmah Digital';
  if (name.includes('launch-screen') || name.includes('01_login_screen') || name.includes('login_ready')) return 'Layar Login & Pemilihan Role Demo';
  if (name.includes('step-02-02-input-nis') || name.includes('role_siswa')) return 'Otentikasi Akun Siswa (SISWA001)';
  if (name.includes('dashboard-beranda') || name.includes('02_dashboard')) return 'Dashboard Beranda Siswa (Ahmad Farhan)';
  if (name.includes('dashboard-restored')) return 'Beranda Setelah Navigasi Tab';
  if (name.includes('tab-beranda') || name.includes('live_tab_beranda')) return 'Navigasi Tab: Beranda';
  if (name.includes('tab-absensi') || name.includes('live_tab_absensi')) return 'Navigasi Tab: Absensi Siswa';
  if (name.includes('tab-keuangan') || name.includes('live_tab_keuangan')) return 'Navigasi Tab: Rincian Keuangan';
  if (name.includes('tab-informasi') || name.includes('live_tab_informasi')) return 'Navigasi Tab: Informasi & Kedisiplinan';
  if (name.includes('tab-t2q') || name.includes('live_tab_t2q')) return 'Navigasi Tab: Hafalan & Tilawah T2Q';
  if (name.includes('home-top') || name.includes('step-12-01-beranda-top')) return 'Beranda: Header & Status Presensi Siswa';
  if (name.includes('home-middle') || name.includes('step-11-01-beranda-actions')) return 'Beranda: Widget Presensi & Aksi Cepat';
  if (name.includes('home-bottom')) return 'Beranda: Agenda & Mutasi Amal';
  if (name.includes('home-restored-top')) return 'Beranda: Kembali ke Posisi Atas';
  if (name.includes('amal-form-opened')) return 'Formulir Mutasi Amal Siswa Terbuka';
  if (name.includes('amal-form-filled')) return 'Pengisian Checklist Mutasi Amal (Selesai)';
  if (name.includes('amal-completed-return')) return 'Beranda Siswa Setelah Simpan Amal';
  if (name.includes('absensi-loaded') || name.includes('live_absensi_form')) return 'Absensi: Rekap Presensi & Formulir Izin';
  if (name.includes('izin-form-opened')) return 'Formulir Pengajuan Izin Siswa Terbuka';
  if (name.includes('izin-form-filled')) return 'Formulir Pengajuan Izin Diisi Lengkap';
  if (name.includes('absensi-riwayat-pengajuan')) return 'Tab Absensi: Riwayat Pengajuan Izin';
  if (name.includes('absensi-riwayat-kehadiran')) return 'Tab Absensi: Riwayat Presensi Siswa';
  if (name.includes('keuangan-loaded') || name.includes('live_keuangan_detail')) return 'Keuangan: Rincian Tagihan SPP Siswa';
  if (name.includes('keuangan-tagihan-unpaid')) return 'Keuangan: Rincian Tagihan Belum Dibayar';
  if (name.includes('keuangan-struk-pembayaran')) return 'Keuangan: Struk Bukti Pembayaran';
  if (name.includes('keuangan-restored')) return 'Keuangan: Kembali ke Tampilan Normal';
  if (name.includes('informasi-kedisiplinan')) return 'Informasi: Rekap Catatan Kedisiplinan';
  if (name.includes('informasi-berita-sekolah') || name.includes('step-11-03-berita-sekolah') || name.includes('detail-beranda-artikel-berita')) return 'Informasi: Pengumuman & Berita Sekolah';
  if (name.includes('informasi-berita-scrolled')) return 'Informasi: Feed Berita Lengkap';
  if (name.includes('t2q-loaded')) return 'T2Q: Riwayat Hafalan Tahfidz';
  if (name.includes('t2q-tahsin') || name.includes('live_t2q_tahsin')) return 'T2Q: Rekap Pembelajaran Tahsin';
  if (name.includes('t2q-tilawah') || name.includes('live_t2q_tilawah')) return 'T2Q: Catatan & Setoran Tilawah';
  if (name.includes('t2q-scrolled')) return 'T2Q: Riwayat Hafalan Lengkap';
  if (name.includes('step-10-01-dashboard')) return 'Dashboard Beranda Sebelum Buka Menu';
  if (name.includes('step-10-02-drawer-menu') || name.includes('drawer-menu-opened')) return 'Menu Samping (Drawer): Profil, Ekskul & Versi';
  if (name.includes('step-10-03-profil-siswa') || name.includes('profil-siswa-screen') || name.includes('detail-beranda-profil-siswa')) return 'Profil Siswa & Akun (Ahmad Farhan)';
  if (name.includes('ekskul-screen')) return 'Daftar Kegiatan Ekstrakurikuler';
  if (name.includes('step-11-02-kalender-kegiatan') || name.includes('kalender-kegiatan-screen')) return 'Kalender Akademik & Agenda Kegiatan';
  if (name.includes('berita-detail-screen')) return 'Detail Berita & Pengumuman Sekolah';
  if (name.includes('step-12-02-notifikasi-list') || name.includes('notifikasi-screen') || name.includes('detail-beranda-pusat-notifikasi')) return 'Pusat Notifikasi: PTS, SPP & Setoran';
  if (name.includes('step-12-03-notifikasi-pengumuman')) return 'Detail Broadcast Pesan & Pengumuman';
  if (name.includes('step-13-01-login-screen') || name.includes('step-14-01-login-screen') || name.includes('step-15-01-login-screen')) return 'Layar Login: Pemilihan Peran Demo';
  if (name.includes('step-13-02-role-guru-selected')) return 'Pilih Peran: Dewan Guru (GURU001)';
  if (name.includes('step-13-03-guru-dashboard') || name.includes('role-guru-dashboard') || name.includes('detail-role-guru-dashboard')) return 'Dashboard Dewan Guru (Ustadzah Khadijah, S.Pd)';
  if (name.includes('step-13-04-guru-absensi') || name.includes('detail-role-guru-presensi')) return 'Presensi Dewan Guru & Pelaporan Sarpras';
  if (name.includes('step-14-02-role-manager-selected')) return 'Pilih Peran: Manager Sarpras (MGR001)';
  if (name.includes('step-14-03-manager-dashboard') || name.includes('role-manager-dashboard') || name.includes('detail-role-manager-dashboard')) return 'Dashboard Manager Sarpras (Ir. H. Syarifuddin, M.T.)';
  if (name.includes('step-14-04-manager-tiket') || name.includes('detail-role-manager-tiket-sarpras')) return 'Monitoring Antrean Keluhan & Tiket Sarpras';
  if (name.includes('step-15-02-role-teknisi-selected')) return 'Pilih Peran: Staff Teknisi (STF001)';
  if (name.includes('step-15-03-teknisi-dashboard') || name.includes('role-teknisi-dashboard') || name.includes('detail-role-teknisi-dashboard')) return 'Dashboard Staff Teknisi (Ahmad Rian - STF001)';
  if (name.includes('step-15-04-teknisi-form-laporan') || name.includes('detail-role-teknisi-form-laporan-selesai')) return 'Laporan Selesai & Kirim Bukti Foto Sarpras';
  if (name.includes('step-13-scroll')) return 'Dashboard Beranda: Aksi Cepat & Agenda';
  if (name.includes('step-16-scroll')) return 'Detail Berita: Hari Santri Nasional';

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
  const cleanTitle = humanizeMediaTitle(item.rawName, item.isVid, item.flowId, item.knownFlows);

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
  const [isZipping, setIsZipping] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

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
    return (
      job?.config?.name ||
      job?.name ||
      evidence?.project ||
      'Project QC'
    ).replace(/[\\/:*?"<>|]+/g, ' ').trim();
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
          fullPath: `CMM Service/Timbang Image and Video/${projectName}`,
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

        const uploadItem = {
          url: item.url,
          featureName: item.flowName || 'General',
          type: item.type,
          title: item.title,
          fileName
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
      if (item.type === 'video' && item.size && item.size < 8192) return;
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

  const handleDownloadAllZip = async () => {
    if (allMediaItems.length === 0 || isZipping) return;
    setIsZipping(true);
    try {
      const items = allMediaItems.map(item => ({
        url: item.url,
        featureName: item.flowName || 'General',
        type: item.type,
        title: item.title,
        fileName: `${(item.title || 'media').replace(/[\\/:*?"<>|]+/g, '_').trim()}.${item.type === 'video' ? 'mp4' : 'png'}`
      }));
      await downloadMediaZip({
        projectName,
        items,
        jobId: job?.id
      });
    } catch (err) {
      console.error('Gagal mengunduh ZIP:', err);
      alert(`Gagal mengunduh ZIP: ${err instanceof Error ? err.message : String(err)}`);
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
            title="Sinkronisasi seluruh hasil screenshot dan video ke Nextcloud SOLU"
            style={{ gap: 6, padding: '7px 14px' }}
          >
            <Icon name="cloud" size={14} />
            <span>Export ke Nextcloud ({allMediaItems.length})</span>
          </button>
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

            <div className="qc-stage-screen">
              {activeItem ? (
                <>
                  {activeItem.type === 'video' ? (
                    <video
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
                <span>Unggah ke Nextcloud SOLU</span>
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
                    Menghubungi WebDAV Nextcloud di <code>CMM Service/Timbang Image and Video/{projectName}</code>
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
                          Folder <code>{ncModal.checkResult.targetFolder}</code> sudah ada di <code>CMM Service/Timbang Image and Video</code> karena pengujian pernah diminta sebelumnya.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="qc-nc-banner info">
                      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><Icon name="check" size={18} /></span>
                      <div>
                        <strong>Siap Membuat Folder Baru di Nextcloud</strong>
                        <p style={{ margin: '4px 0 0 0' }}>
                          Folder <code>{ncModal.checkResult?.targetFolder || projectName}</code> akan otomatis dibuat di <code>CMM Service/Timbang Image and Video</code>.
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
                      {`📁 All files > CMM Service > Timbang Image and Video > ${ncModal.folderMode === 'new' ? (ncModal.customFolderName || ncModal.checkResult?.suggestedNewFolder || projectName) : (ncModal.checkResult?.targetFolder || projectName)}/
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
                      <strong style={{ fontSize: 13.5, color: 'var(--text-main, #14181D)' }}>
                        Mengunggah Media ke Nextcloud...
                      </strong>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>
                      {ncModal.uploadProgress.current} / {ncModal.uploadProgress.total} file ({Math.round((ncModal.uploadProgress.current / Math.max(1, ncModal.uploadProgress.total)) * 100)}%)
                    </span>
                  </div>

                  <div className="qc-nc-progress-wrap" style={{ height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      className="qc-nc-progress-bar"
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                        borderRadius: 999,
                        width: `${ncModal.uploadProgress.total > 0 ? Math.min(100, Math.max(5, (ncModal.uploadProgress.current / ncModal.uploadProgress.total) * 100)) : 10}%`,
                        transition: 'width 220ms cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    />
                  </div>

                  <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Berkas Sedang Ditransfer:
                    </span>
                    <span style={{ fontSize: 12, color: '#0F172A', fontFamily: 'var(--font-mono)', fontWeight: 650, wordBreak: 'break-all' }}>
                      {ncModal.uploadProgress.currentFileName}
                    </span>
                  </div>

                  <p style={{ color: '#64748B', fontSize: 11.5, margin: 0 }}>
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
