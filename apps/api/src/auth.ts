import crypto from 'node:crypto';

export type AdminUser = {
  email: string;
  name: string;
  role: 'admin';
};

const secret = process.env.QC_ADMIN_SECRET || 'qc_maestro_admin_staging_key_2026';
const adminEmail = (process.env.QC_ADMIN_EMAIL || 'admin@qcmaestro.com').toLowerCase().trim();
const adminPassword = process.env.QC_ADMIN_PASSWORD || 'admin12345';
const authEnabled = process.env.QC_ADMIN_ENABLED !== 'false';

export function isAuthEnabled(): boolean {
  return authEnabled;
}

export function getAdminConfig() {
  return {
    enabled: authEnabled,
    defaultEmail: adminEmail
  };
}

export function verifyAdminCredentials(email: string, password: string): AdminUser | null {
  if (email.toLowerCase().trim() === adminEmail && password === adminPassword) {
    return {
      email: adminEmail,
      name: 'QC Master Admin',
      role: 'admin'
    };
  }
  return null;
}

export function createToken(user: AdminUser, expiresInHours = 48): string {
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken(token: string | undefined): AdminUser | null {
  if (!authEnabled) {
    return { email: adminEmail, name: 'QC Master Admin', role: 'admin' };
  }
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (signature.length !== expectedSignature.length) return null;
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      email: payload.email,
      name: payload.name,
      role: payload.role
    };
  } catch {
    return null;
  }
}
