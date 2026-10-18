import React, { useState, useEffect } from 'react';
import { Icon } from './ui';
import { getGenerationStatus, testGeminiConnection, generateFlowWithAi, type GenerationStatus } from './api';

interface GeminiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFlow: (yaml: string, name?: string) => void;
  defaultPlatform?: 'web' | 'android';
  defaultTarget?: string;
}

export function GeminiModal({
  isOpen,
  onClose,
  onApplyFlow,
  defaultPlatform = 'web',
  defaultTarget = ''
}: GeminiModalProps) {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);

  const [platform, setPlatform] = useState<'web' | 'android'>(defaultPlatform);
  const [target, setTarget] = useState(defaultTarget);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedFlow, setGeneratedFlow] = useState<{
    name: string;
    platform: 'web' | 'android';
    yaml: string;
    explanation: string;
    valid: boolean;
    validationErrors?: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void fetchStatus();
      setPlatform(defaultPlatform);
      if (defaultTarget) setTarget(defaultTarget);
      setGeneratedFlow(null);
      setError(null);
      setTestResult(null);
    }
  }, [isOpen, defaultPlatform, defaultTarget]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchStatus = async () => {
    try {
      const res = await getGenerationStatus();
      setStatus(res);
    } catch {
      setStatus(null);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal menghubungi Gemini API',
        latencyMs: 0
      });
    } finally {
      setTesting(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Harap masukkan deskripsi skenario pengujian yang ingin dibuat.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await generateFlowWithAi({
        prompt: prompt.trim(),
        platform,
        baseUrl: platform === 'web' ? (target || undefined) : undefined,
        appId: platform === 'android' ? (target || undefined) : undefined
      });
      if (res.flow) {
        setGeneratedFlow(res.flow);
      } else {
        throw new Error('Respons model tidak menyertakan data flow.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menghasilkan flow dengan Gemini AI');
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (generatedFlow) {
      onApplyFlow(generatedFlow.yaml, generatedFlow.name);
      onClose();
    }
  };

  const handleCopy = () => {
    if (generatedFlow?.yaml) {
      navigator.clipboard.writeText(generatedFlow.yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const quickPrompts = [
    {
      title: 'Form Login & Validasi',
      prompt: 'Uji form login dengan akun admin. Verifikasi validasi ketika password kosong, lalu isi kredensial valid dan pastikan berhasil masuk ke dashboard.'
    },
    {
      title: 'Validasi Input Kosong',
      prompt: 'Buka halaman form, biarkan semua input kosong lalu klik tombol Simpan. Verifikasi bahwa pesan peringatan validasi muncul di setiap field wajib.'
    },
    {
      title: 'Pencarian & Filter Data',
      prompt: 'Ketik kata kunci pada kolom search, tekan enter, lalu verifikasi hasil tabel hanya menampilkan baris yang sesuai kata kunci.'
    },
    {
      title: 'Logout & Session Clear',
      prompt: 'Buka menu profil akun, klik tombol Logout atau Keluar, lalu verifikasi bahwa pengguna dialihkan kembali ke halaman login dan sesi terhapus.'
    }
  ];

  if (!isOpen) return null;

  const isConfigured = status?.status === 'configured' && status?.provider === 'gemini';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 10, 20, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          background: 'var(--bg-panel, #0F1626)',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
          borderRadius: 14,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gemini-modal-title"
      >
        {/* HEADER */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-canvas, #0A0E17)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #38BDF8 0%, #35D0BA 100%)',
                color: '#061626',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <Icon name="sparkles" size={18} />
            </div>
            <div>
              <h2
                id="gemini-modal-title"
                style={{
                  fontSize: 15,
                  fontWeight: 650,
                  margin: 0,
                  color: 'var(--text-primary, #F8FAFC)',
                  letterSpacing: '-0.02em'
                }}
              >
                Google Gemini AI Scenario Generator
              </h2>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim, #94A3B8)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Synthesize Playwright &amp; Maestro Flows from Natural Language
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="quiet"
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim, #94A3B8)',
              cursor: 'pointer'
            }}
            title="Tutup (Esc)"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* STATUS BAR */}
        <div
          style={{
            padding: '10px 20px',
            background: isConfigured ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.1)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isConfigured ? '#22C55E' : '#F59E0B',
                boxShadow: isConfigured ? '0 0 8px #22C55E' : '0 0 6px #F59E0B'
              }}
            />
            <span style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 550 }}>
              {isConfigured
                ? `Gemini API Aktif (${status?.model || 'gemini-1.5-flash'})`
                : 'GEMINI_API_KEY belum dikonfigurasi di file .env'}
            </span>
            {status?.keyMasked && (
              <code
                style={{
                  fontSize: 10.5,
                  padding: '2px 6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 4,
                  color: '#94A3B8'
                }}
              >
                {status.keyMasked}
              </code>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {testResult && (
              <span
                style={{
                  fontSize: 11,
                  color: testResult.success ? '#22C55E' : '#EF4444',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {testResult.success ? `â ${testResult.message} (${testResult.latencyMs}ms)` : `â ${testResult.message}`}
              </span>
            )}
            {isConfigured && (
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-default, rgba(255,255,255,0.15))',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary, #F8FAFC)',
                  cursor: 'pointer'
                }}
              >
                {testing ? 'Ping...' : 'Tes Koneksi'}
              </button>
            )}
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isConfigured && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 12,
                color: '#FDE68A',
                lineHeight: 1.5
              }}
            >
              <strong>Petunjuk Konfigurasi:</strong>
              <div style={{ marginTop: 4 }}>
                1. Dapatkan Gemini API Key gratis di{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38BDF8', textDecoration: 'underline' }}
                >
                  Google AI Studio
                </a>
                .<br />
                2. Buka berkas <code>.env</code> di root proyek QC Maestro.<br />
                3. Masukkan <code>GEMINI_API_KEY=AIzaSy...</code> pada baris yang telah disiapkan.<br />
                4. Restart server atau jalankan ulang, lalu klik tombol <em>Tes Koneksi</em> di atas.
              </div>
            </div>
          )}

          {/* PARAMETERS ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-dim, #94A3B8)',
                  marginBottom: 6
                }}
              >
                Platform Target
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setPlatform('web')}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: platform === 'web' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                    background: platform === 'web' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: platform === 'web' ? '#38BDF8' : '#94A3B8',
                    cursor: 'pointer'
                  }}
                >
                  Web
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform('android')}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: platform === 'android' ? '1px solid #35D0BA' : '1px solid rgba(255,255,255,0.1)',
                    background: platform === 'android' ? 'rgba(53, 208, 186, 0.15)' : 'transparent',
                    color: platform === 'android' ? '#35D0BA' : '#94A3B8',
                    cursor: 'pointer'
                  }}
                >
                  Android
                </button>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-dim, #94A3B8)',
                  marginBottom: 6
                }}
              >
                {platform === 'web' ? 'Target Base URL' : 'Target App ID (Package Name)'}
              </label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={platform === 'web' ? 'http://localhost:3000' : 'com.company.app'}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-default, rgba(255,255,255,0.15))',
                  background: 'var(--bg-canvas, #0A0E17)',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: 12.5,
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* PROMPT TEXTAREA */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-dim, #94A3B8)',
                marginBottom: 6
              }}
            >
              Deskripsi Skenario Pengujian (Natural Language)
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tuliskan skenario dalam bahasa Indonesia atau Inggris... (misal: Uji alur pemesanan tiket dari pemilihan jadwal, pengisian identitas penumpang, hingga verifikasi halaman pembayaran)"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-default, rgba(255,255,255,0.15))',
                background: 'var(--bg-canvas, #0A0E17)',
                color: 'var(--text-primary, #F8FAFC)',
                fontSize: 12.5,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />

            {/* QUICK PRESET CHIPS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim, #94A3B8)', alignSelf: 'center' }}>Preset cepat:</span>
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(p.prompt)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-secondary, #CBD5E1)',
                    cursor: 'pointer'
                  }}
                  title={p.prompt}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5',
                fontSize: 12
              }}
            >
              {error}
            </div>
          )}

          {/* GENERATED FLOW PREVIEW */}
          {generatedFlow && (
            <div
              style={{
                background: 'var(--bg-canvas, #0A0E17)',
                border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 13, color: '#F8FAFC' }}>{generatedFlow.name}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: generatedFlow.valid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: generatedFlow.valid ? '#22C55E' : '#F59E0B'
                    }}
                  >
                    {generatedFlow.valid ? 'Schema Valid' : 'Format Perlu Penyesuaian'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: copied ? '#22C55E' : '#94A3B8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Icon name="copy" size={12} />
                  <span>{copied ? 'Tersalin!' : 'Salin YAML'}</span>
                </button>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: 6,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 11.5,
                  color: '#E2E8F0',
                  maxHeight: 200,
                  overflowY: 'auto',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {generatedFlow.yaml}
              </pre>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-canvas, #0A0E17)'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="quiet"
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border-default, rgba(255,255,255,0.15))',
              background: 'transparent',
              color: 'var(--text-dim, #94A3B8)',
              fontSize: 12.5,
              cursor: 'pointer'
            }}
          >
            Tutup
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            {generatedFlow && (
              <button
                type="button"
                onClick={handleApply}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: '1px solid #10B981',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Icon name="check" size={14} />
                <span>Terapkan ke Editor Skenario</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: generating || !prompt.trim() ? 'rgba(56, 189, 248, 0.3)' : 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
                color: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 650,
                cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: generating ? 'none' : '0 2px 10px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Icon name="sparkles" size={14} />
              <span>{generating ? 'Memproses dengan Gemini...' : 'Generate Skenario AI'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
