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
    FONNTE_TARGET: '08882017549,120363411589846495@g.us',
    PORT: '4180',
    QC_ADMIN_EMAIL: 'admin@qcmaestro.com',
    QC_ADMIN_PASSWORD: 'admin12345'
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
async function sendWhatsAppNotification(token, target, publicUrl, localIp, adminEmail = 'admin@qcmaestro.com', adminPassword = 'admin12345') {
  if (!token || !target) {
    console.log('[TunnelNotifier] Token atau target Fonnte belum dikonfigurasi di .env');
    return;
  }

  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const message = `🚀 *[QC MAESTRO — SERVER READY]*
-----------------------------------------
Laptop Server aktif dan siap diakses bersama!

🌐 *Link Akses Dashboard:*
${publicUrl}

🏠 *Akses Lokal (1 Wi-Fi):*
http://${localIp}:4180

🔑 *Akun Login Dashboard:*
Email: ${adminEmail}
Password: ${adminPassword}
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

// Helper: Tunggu koneksi internet aktif (misal saat boot WiFi belum konek)
async function waitForInternet() {
  console.log('[TunnelNotifier] Memeriksa koneksi internet...');
  while (true) {
    try {
      const res = await fetch('https://1.1.1.1', { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status) {
        console.log('[TunnelNotifier] Koneksi internet AKTIF.');
        return;
      }
    } catch (_) {
      console.log('[TunnelNotifier] Menunggu koneksi internet aktif (WiFi menyambung)... coba lagi dalam 3 detik.');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// Helper: Tunggu Web Server siap listening di port target
async function waitForPort(port) {
  console.log(`[TunnelNotifier] Memeriksa kesiapan Web Server di port ${port}...`);
  const startTime = Date.now();
  while (Date.now() - startTime < 180000) { // maksimal 3 menit
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(2000) });
      if (res.status >= 200 && res.status < 500) {
        console.log(`[TunnelNotifier] Web Server di port ${port} SIAP dan merespons.`);
        return true;
      }
    } catch (_) {
      // server belum listening
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[TunnelNotifier] Web Server port ${port} belum merespons, tetap melanjutkan tunnel...`);
  return false;
}

// 4. Main Process dengan Auto-Restart Loop
async function runTunnelSession(cloudflaredExe, env, localIp) {
  return new Promise((resolve) => {
    console.log(`[TunnelNotifier] Membuka Cloudflare Tunnel ke http://127.0.0.1:${env.PORT}...`);
    
    const tunnelProc = spawn(cloudflaredExe, [
      'tunnel',
      '--protocol', 'http2',
      '--url', `http://127.0.0.1:${env.PORT}`
    ]);

    let currentTunnelUrl = null;

    const handleOutput = (data) => {
      const text = data.toString();
      process.stdout.write(text);

      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && match[0]) {
        const publicUrl = match[0];
        if (publicUrl !== currentTunnelUrl) {
          currentTunnelUrl = publicUrl;
          console.log('\n======================================================');
          console.log(`[TunnelNotifier] URL TUNNEL AKTIF: ${publicUrl}`);
          console.log('======================================================\n');

          fs.writeFileSync(path.join(rootDir, 'active-tunnel-url.txt'), publicUrl, 'utf8');
          sendWhatsAppNotification(env.FONNTE_TOKEN, env.FONNTE_TARGET, publicUrl, localIp, env.QC_ADMIN_EMAIL, env.QC_ADMIN_PASSWORD);
        }
      }
    };

    tunnelProc.stdout.on('data', handleOutput);
    tunnelProc.stderr.on('data', handleOutput);

    tunnelProc.on('close', (code) => {
      console.log(`[TunnelNotifier] Cloudflared terhenti (exit code: ${code}). Mengulang dalam 5 detik...`);
      resolve(code);
    });

    tunnelProc.on('error', (err) => {
      console.error('[TunnelNotifier] Error proses cloudflared:', err.message);
      resolve(1);
    });
  });
}

async function main() {
  const env = loadEnv();
  const toolsDir = path.join(rootDir, 'tools');
  const cloudflaredExe = path.join(toolsDir, 'cloudflared.exe');

  // 1. Tunggu internet
  await waitForInternet();

  // 2. Pastikan file executable cloudflared ada
  const ready = await ensureCloudflared(cloudflaredExe, toolsDir);
  if (!ready) {
    console.error(`[TunnelNotifier] Gagal menyiapkan cloudflared.exe`);
    process.exit(1);
  }

  // 3. Tunggu web server listening di port 4180
  await waitForPort(env.PORT);

  // 4. Loop abadi (jika mati atau koneksi putus, otomatis hidup lagi!)
  while (true) {
    const localIp = getLocalIp();
    console.log(`[TunnelNotifier] IP LAN Terdeteksi: http://${localIp}:${env.PORT}`);
    await runTunnelSession(cloudflaredExe, env, localIp);
    await new Promise(r => setTimeout(r, 5000));
  }
}

main().catch(console.error);
