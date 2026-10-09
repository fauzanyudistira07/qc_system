import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Baca konfigurasi dari .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  const config = {
    FONNTE_TOKEN: 'eE8DG7vGPArkv1SewzJd',
    FONNTE_TARGET: '08882017549,120363411589846495@g.us',
    PORT: '4180'
  };

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key in config && val) {
          config[key] = val;
        }
      }
    }
  }
  return config;
}

// 2. Dapatkan IP LAN WiFi / Ethernet lokal
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// 3. Baca active tunnel URL jika ada
function getTunnelUrl() {
  try {
    const file = path.join(rootDir, 'active-tunnel-url.txt');
    if (fs.existsSync(file)) {
      const url = fs.readFileSync(file, 'utf8').trim();
      if (url.startsWith('http')) return url;
    }
  } catch {}
  return null;
}

// 4. Parse argumen CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    sha: '',
    msg: '',
    author: '',
    status: 'success',
    details: ''
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--sha' && args[i + 1]) {
      result.sha = args[++i];
    } else if (arg === '--msg' && args[i + 1]) {
      result.msg = args[++i];
    } else if (arg === '--author' && args[i + 1]) {
      result.author = args[++i];
    } else if (arg === '--status' && args[i + 1]) {
      result.status = args[++i];
    } else if (arg === '--details' && args[i + 1]) {
      result.details = args[++i];
    }
  }
  return result;
}

async function main() {
  const env = loadEnv();
  const token = env.FONNTE_TOKEN;
  const target = env.FONNTE_TARGET;

  if (!token || !target) {
    console.log('[NotifyDeployWA] FONNTE_TOKEN atau FONNTE_TARGET belum diset di .env');
    process.exit(0);
  }

  const { sha, msg, author, status, details } = parseArgs();
  const shortSha = sha ? sha.slice(0, 7) : 'latest';
  const localIp = getLocalIp();
  const tunnelUrl = getTunnelUrl();
  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  let message = '';

  if (status === 'success') {
    message = `🔄 *[QC MAESTRO — AUTO PULL & RESTART]*
-----------------------------------------
Laptop Server berhasil menerima update kode dari GitHub dan menyinkronkan sistem!

📦 *Detail Pembaruan:*
• *Branch:* \`main\`
• *Commit:* \`#${shortSha}\`
• *Pesan:* ${msg || 'Pembaruan otomatis dari repo'}
${author ? `• *Author:* ${author}\n` : ''}
🐳 *Status Eksekusi:*
• Git Pull: *SELESAI (100%)*
• Docker Services: *RESTARTED & READY*
• Dev Server: *HOT RELOADED*

🌐 *Akses Dashboard QC:*
• LAN Lokal: http://${localIp}:4180
${tunnelUrl ? `• Remote Tunnel: ${tunnelUrl}\n` : ''}
-----------------------------------------
⏱️ *Waktu Sinkron:* ${now} WIB
Status: ✅ *DEPLOYMENT BERHASIL*`;
  } else {
    message = `⚠️ *[QC MAESTRO — DEPLOYMENT GAGAL]*
-----------------------------------------
Terjadi kendala saat laptop server mencoba melakukan git pull atau restart docker:

📦 *Commit:* \`#${shortSha}\`
• *Pesan:* ${msg || '-'}
${details ? `• *Error Trace:* ${details}\n` : ''}
-----------------------------------------
⏱️ *Waktu:* ${now} WIB
Silakan periksa log server untuk penanganan.`;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('target', target);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: formData
    });

    const data = await res.json();
    console.log('[NotifyDeployWA] Notifikasi WA berhasil dikirim:', data?.detail || data);
  } catch (err) {
    console.error('[NotifyDeployWA] Gagal mengirim WA:', err.message);
  }
}

main().catch(console.error);
