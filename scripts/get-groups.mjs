import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

let token = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*FONNTE_TOKEN\s*=\s*(.*?)\s*$/);
    if (match) token = match[1].trim();
  }
}

if (!token) {
  console.error('[Error] FONNTE_TOKEN tidak ditemukan di .env');
  process.exit(1);
}

console.log('[Fonnte] Mengambil daftar grup WhatsApp yang terhubung...');

try {
  const res = await fetch('https://api.fonnte.com/get-whatsapp-group', {
    method: 'POST',
    headers: {
      'Authorization': token
    }
  });

  const data = await res.json();
  console.log('\n======================================================');
  console.log(' HASIL PENCARIAN GRUP WHATSAPP DARI AKUN ANDA:');
  console.log('======================================================');
  
  if (data.status && Array.isArray(data.data)) {
    if (data.data.length === 0) {
      console.log('Tidak ada grup ditemukan. Pastikan nomor bot sudah masuk ke grup WA.');
    } else {
      data.data.forEach((grp, idx) => {
        console.log(`${idx + 1}. Nama Grup : "${grp.name}"`);
        console.log(`   Group ID  : ${grp.id}`);
        console.log('------------------------------------------------------');
      });
    }
  } else {
    console.log('Response dari Fonnte:', JSON.stringify(data, null, 2));
  }
} catch (err) {
  console.error('[Error] Gagal konek ke Fonnte:', err.message);
}
