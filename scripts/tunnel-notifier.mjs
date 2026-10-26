import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Baca konfigurasi dari .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  const config = {
    FONNTE_TOKEN: 'eE8DG7vGPArkv1SewzJd',
    FONNTE_TARGET: '08882017549,089508717179,120363411589846495@g.us',
    PORT: '4180',
    QC_ADMIN_EMAIL: 'admin@qcmaestro.com',
    QC_ADMIN_PASSWORD: 'admin12345',
    QC_PUBLIC_DOMAIN: 'https://timbang.tiraa.my.id'
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

// 2. Kirim pesan WhatsApp via Fonnte (dengan domain tetap)
async function sendWhatsAppNotification(token, target, publicUrl, adminEmail = 'admin@qcmaestro.com', adminPassword = 'admin12345') {
  if (!token || !target) {
    console.log('[Notifier] Token atau target Fonnte belum dikonfigurasi di .env');
    return;
  }

  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const message = `🚀 *[QC MAESTRO — SERVER READY]*
-----------------------------------------
Laptop Server aktif dan siap diakses bersama!

🌐 *Link Akses Dashboard:*
${publicUrl}

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
    console.log('[Notifier] Notifikasi WA berhasil dikirim:', result?.detail || result);
  } catch (err) {
    console.error('[Notifier] Gagal mengirim pesan WA:', err.message);
  }
}

// 3. Helper: Tunggu koneksi internet aktif
async function waitForInternet() {
  console.log('[Notifier] Memeriksa koneksi internet...');
  while (true) {
    try {
      const res = await fetch('https://1.1.1.1', { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status) {
        console.log('[Notifier] Koneksi internet AKTIF.');
        return;
      }
    } catch (_) {
      console.log('[Notifier] Menunggu koneksi internet aktif... coba lagi dalam 3 detik.');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// 4. Helper: Tunggu Web Server siap listening di port target (4180)
async function waitForPort(port) {
  console.log(`[Notifier] Memeriksa kesiapan Web Server di port ${port}...`);
  const startTime = Date.now();
  while (Date.now() - startTime < 180000) { // maksimal 3 menit
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(2000) });
      if (res.status >= 200 && res.status < 500) {
        console.log(`[Notifier] Web Server di port ${port} SIAP dan merespons.`);
        return true;
      }
    } catch (_) {
      // server belum listening
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[Notifier] Web Server port ${port} belum merespons, tetap melanjutkan pengiriman link domain...`);
  return false;
}

// 5. Main Execution
async function main() {
  const env = loadEnv();
  const publicUrl = env.QC_PUBLIC_DOMAIN || 'https://timbang.tiraa.my.id';

  // 1. Tunggu internet
  await waitForInternet();

  // 2. Tunggu web server listening di port 4180
  await waitForPort(env.PORT);

  // 3. Log domain permanen dan simpan ke active-tunnel-url.txt
  console.log('\n======================================================');
  console.log(`[Notifier] DOMAIN TETAP AKTIF: ${publicUrl}`);
  console.log('======================================================\n');

  fs.writeFileSync(path.join(rootDir, 'active-tunnel-url.txt'), publicUrl, 'utf8');

  // 4. Kirim notifikasi WhatsApp via Fonnte
  await sendWhatsAppNotification(
    env.FONNTE_TOKEN,
    env.FONNTE_TARGET,
    publicUrl,
    env.QC_ADMIN_EMAIL,
    env.QC_ADMIN_PASSWORD
  );

  console.log('[Notifier] Pengiriman notifikasi WhatsApp selesai.');
}

main().catch(console.error);
