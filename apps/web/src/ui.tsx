import React from 'react';
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    projects: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>,
    discovery: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7v7M7 10.5h7"/></>,
    map: <><rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5H5v5m7-5h7v5"/></>,
    flows: <><path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/></>,
    runs: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></>,
    reports: <><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h5"/></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>, plus: <path d="M12 5v14M5 12h14"/>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
    'chevron-down': <path d="m6 9 6 6 6-6"/>, 'chevron-up': <path d="m6 15 6-6 6 6"/>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
    git: <><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m12-10v3c0 5-12 2-12 7"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    terminal: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 8 4 4-4 4m7 0h5"/></>,
    shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 11 3 3 5-6"/></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/></>,
    android: <><path d="M4 10a8 8 0 0 1 16 0"/><line x1="7" y1="5" x2="6" y2="3"/><line x1="17" y1="5" x2="18" y2="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><rect x="4" y="11" width="16" height="9" rx="2"/></>,
    device: <><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>, warning: <><path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3v1"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"/></>,
    moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.overview}</svg>;
}
export function Badge({ value }: { value?: string }) { const text = value || 'unknown'; return <span className={`badge badge-${text.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`}><span/>{text.replace(/_/g, ' ')}</span>; }
export function Empty({ icon = 'discovery', title, children, action }: { icon?: string; title: string; children: React.ReactNode; action?: React.ReactNode }) { return <div className="empty"><div className="empty-orbit"><Icon name={icon} size={28}/></div><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function Panel({ title, description, actions, children, className = '' }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; key?: any }) { return <section className={`panel ${className}`}>{(title || actions) && <div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>}{children}</section>; }
export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}><Icon name={error ? 'warning' : 'shield'} size={18}/><div>{children}</div></div>; }
export function Metric({ label, value, note, icon, tone = 'cyan', onClick }: { label: string; value: number | string; note: string; icon: string; tone?: string; onClick?: () => void }) { return <button className={`metric ${tone}`} onClick={onClick}><div className="metric-top"><span>{label}</span><Icon name={icon}/></div><strong>{value}</strong><div className="metric-note">{note}<Icon name="arrow" size={16}/></div></button>; }
export function Progress({ value, label }: { value: number; label: string }) { const safe = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)); return <div className="progress" role="progressbar" aria-label={label} aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${safe}%` }}/></div>; }
