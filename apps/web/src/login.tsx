import React, { useState } from 'react';
import { Icon } from './ui';
import { setAuthSession } from './api';

export function AdminLoginView({ onLoginSuccess }: { onLoginSuccess: (token: string, user: { email: string; name: string; role: string }) => void }) {
  const [email, setEmail] = useState('admin@qcmaestro.com');
  const [password, setPassword] = useState('admin12345');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Autentikasi gagal. Periksa kredensial Anda.');
      }

      setAuthSession(data.token, data.user);
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err?.message || 'Gagal menghubungi server autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #111827 0%, #030712 100%)',
      padding: 24,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f8fafc'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 16,
        padding: '36px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1)',
        position: 'relative'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#38bdf8',
            marginBottom: 16,
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)'
          }}>
            <Icon name="shield" size={28} />
          </div>

          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 6px 0',
            background: 'linear-gradient(to right, #f8fafc, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            QC Maestro Control Center
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Portal Khusus Administrator &amp; Tim QA Staging
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            fontSize: '0.72rem',
            color: '#38bdf8',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
            Staging Access Restricted
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            marginBottom: 20,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <Icon name="warning" size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Email Administrator
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@qcmaestro.com"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                Kata Sandi
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showPassword ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '12px 18px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              transition: 'transform 0.1s, opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {loading ? (
              <>
                <Icon name="refresh" size={16} />
                <span>Memverifikasi Akses...</span>
              </>
            ) : (
              <>
                <Icon name="shield" size={16} />
                <span>Masuk ke Control Center</span>
              </>
            )}
          </button>
        </form>

        {/* Staging Helper Info Card */}
        <div style={{
          marginTop: 24,
          padding: '12px 14px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: 8,
          border: '1px dashed rgba(148, 163, 184, 0.2)',
          fontSize: '0.78rem',
          color: '#94a3b8'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>💡 Kredensial Default Staging:</span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@qcmaestro.com');
                setPassword('admin12345');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                padding: 0
              }}
            >
              Autofill
            </button>
          </div>
          <div>Email: <code style={{ color: '#38bdf8' }}>admin@qcmaestro.com</code></div>
          <div>Password: <code style={{ color: '#38bdf8' }}>admin12345</code></div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
            *Dapat diubah melalui file <code>.env</code> variabel <code>QC_ADMIN_EMAIL</code> dan <code>QC_ADMIN_PASSWORD</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
