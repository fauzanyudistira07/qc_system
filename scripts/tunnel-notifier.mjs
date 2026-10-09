import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Baca konfigurasi dari .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  const config = {
    FONNTE_TOKEN: 'eE8DG7vGPArkv1SewzJd',
    FONNTE_TARGET: '08882017549',
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

// 3. Kirim pesan WhatsApp via Fonnte
async function sendWhatsAppNotification(token, target, publicUrl, localIp) {
  if (!token || !target) {
    console.log('[TunnelNotifier] Token atau target Fonnte belum dikonfigurasi di .env');
    return;
  }

  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const message = `🚀 *[QC MAESTRO — SERVER READY]*
-----------------------------------------
Laptop Server aktif dan siap diakses kapan saja!

🌐 *Akses Luar (Internet / HP Luar):*
${publicUrl}

🏠 *Akses Lokal (1 Wi-Fi Kantor / Rumah):*
http://${localIp}:4180

🔗 *GitHub Webhook URL:*
${publicUrl}/api/v1/webhooks/github

🔑 *Admin Credentials:*
Password: admin12345
-----------------------------------------
Status: *ONLINE*
Waktu: ${now} WIB`;

  try {
    const formData = new URLSearchParams();
    formData.append('target', target);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token
      },
      body: formData
    });

    const result = await res.json();
    console.log('[TunnelNotifier] Notifikasi WA berhasil dikirim:', result?.detail || result);
  } catch (err) {
    console.error('[TunnelNotifier] Gagal mengirim pesan WA:', err.message);
  }
}

// Helper: Download cloudflared.exe jika belum ada di laptop server
async function ensureCloudflared(cloudflaredExe, toolsDir) {
  if (fs.existsSync(cloudflaredExe)) return true;

  if (!fs.existsSync(toolsDir)) {
    fs.mkdirSync(toolsDir, { recursive: true });
  }

  console.log('[TunnelNotifier] cloudflared.exe belum ada di server. Mengunduh otomatis dari Cloudflare GitHub...');
  const downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

  try {
    const res = await fetch(downloadUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(cloudflaredExe, Buffer.from(buffer));
    console.log('[TunnelNotifier] Unduhan cloudflared.exe berhasil!');
    return true;
  } catch (err) {
    console.error('[TunnelNotifier] Gagal mengunduh cloudflared.exe otomatis:', err.message);
    return false;
  }
}

// 4. Main Process
async function main() {
  const env = loadEnv();
  const localIp = getLocalIp();
  const toolsDir = path.join(rootDir, 'tools');
  const cloudflaredExe = path.join(toolsDir, 'cloudflared.exe');

  const ready = await ensureCloudflared(cloudflaredExe, toolsDir);
  if (!ready) {
    console.error(`[TunnelNotifier] cloudflared.exe tidak siap.`);
    process.exit(1);
  }

  console.log(`[TunnelNotifier] Menjalankan Cloudflare Tunnel ke http://127.0.0.1:${env.PORT}...`);
  console.log(`[TunnelNotifier] IP LAN Terdeteksi: http://${localIp}:${env.PORT}`);

  const tunnelProc = spawn(cloudflaredExe, [
    'tunnel',
    '--protocol', 'http2',
    '--url', `http://127.0.0.1:${env.PORT}`
  ]);

  let currentTunnelUrl = null;

  const handleOutput = (data) => {
    const text = data.toString();
    process.stdout.write(text);

    // Cari pola URL *.trycloudflare.com
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && match[0]) {
      const publicUrl = match[0];
      if (publicUrl !== currentTunnelUrl) {
        currentTunnelUrl = publicUrl;
        console.log('\n======================================================');
        console.log(`[TunnelNotifier] URL TUNNEL AKTIF: ${publicUrl}`);
        console.log('======================================================\n');

        // Simpan ke file teks untuk referensi lokal
        fs.writeFileSync(path.join(rootDir, 'active-tunnel-url.txt'), publicUrl, 'utf8');

        // Kirim WhatsApp
        sendWhatsAppNotification(env.FONNTE_TOKEN, env.FONNTE_TARGET, publicUrl, localIp);
      }
    }
  };

  tunnelProc.stdout.on('data', handleOutput);
  tunnelProc.stderr.on('data', handleOutput);

  tunnelProc.on('close', (code) => {
    console.log(`[TunnelNotifier] Cloudflared process exit with code ${code}`);
  });
}

main().catch(console.error);
