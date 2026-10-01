import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const sqlPath = path.resolve('fixtures/sql/jamaahku_lengkap.sql');
const mysqlBin = 'C:\\xampp\\mysql\\bin\\mysql.exe';

export async function seedJamaahkuDatabase() {
  console.log('--- AUTO-SEED DATASET LENGKAP JAMAAHKU ---');
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Berkas SQL fixture tidak ditemukan di: ${sqlPath}`);
  }

  const stat = fs.statSync(sqlPath);
  console.log(`📁 Berkas SQL: ${sqlPath} (${(stat.size / 1024).toFixed(1)} KB)`);

  const binToUse = fs.existsSync(mysqlBin) ? mysqlBin : 'mysql';
  console.log(`🔌 Menghubungkan ke MySQL (127.0.0.1:3306) via ${binToUse}...`);

  try {
    // 1. Pastikan database jamaahku ada
    execSync(`"${binToUse}" -u root -e "CREATE DATABASE IF NOT EXISTS \`jamaahku\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`, {
      stdio: 'pipe',
      shell: 'cmd.exe'
    });

    // 2. Import dump SQL lengkap
    console.log('⚡ Menginjeksi seluruh skema relasional, tabel master, transaksi, dan geolokasi...');
    execSync(`"${binToUse}" -u root jamaahku < "${sqlPath}"`, {
      stdio: 'pipe',
      shell: 'cmd.exe'
    });

    // 3. Verifikasi jumlah data pada tabel-tabel utama
    console.log('🔍 Memverifikasi integritas data yang di-seed...');
    const verifyQuery = "SELECT 'Users (Akun Admin, TL, Jamaah)', COUNT(*) FROM users UNION ALL SELECT 'Data Master Batch', COUNT(*) FROM batch UNION ALL SELECT 'Data Master Jamaah', COUNT(*) FROM jamaah UNION ALL SELECT 'Data Master Hotel', COUNT(*) FROM hotels UNION ALL SELECT 'Data Master Doa & Item', COUNT(*) FROM doa UNION ALL SELECT 'Smartwatch & Watch Jamaah', COUNT(*) FROM device_watch UNION ALL SELECT 'GPS Tracker & Log Lokasi', COUNT(*) FROM device_gps UNION ALL SELECT 'Koordinat Tracking Geofence', COUNT(*) FROM position_jamaah UNION ALL SELECT 'Artikel & Berita Portal', COUNT(*) FROM news UNION ALL SELECT 'Feedback & Ulasan', COUNT(*) FROM rating UNION ALL SELECT 'Panggilan Darurat & SOS', COUNT(*) FROM ems_master;";
    const verifyCmd = `"${binToUse}" -u root jamaahku -s -N -e "${verifyQuery}"`;

    const output = execSync(verifyCmd, { encoding: 'utf8', shell: 'cmd.exe' }).trim();
    console.log('\n📊 HASIL REKAPITULASI SEEDING DATABASE JAMAAHKU:');
    console.log('───────────────────────────────────────────────────────');
    const lines = output.split('\n');
    const summary = [];
    for (const line of lines) {
      const [table, count] = line.split('\t');
      if (table && count) {
        console.log(`  ✓ ${table.padEnd(32)}: ${count.trim()} baris`);
        summary.push({ entity: table.trim(), count: parseInt(count.trim(), 10) });
      }
    }
    console.log('───────────────────────────────────────────────────────');
    console.log('✅ DATABASE SIAP UNTUK PENGUJIAN END-TO-END & FULL CRUD!\n');

    return {
      status: 'SUCCESS',
      sqlPath,
      sizeBytes: stat.size,
      summary
    };
  } catch (error) {
    console.error('❌ Gagal melakukan seeding database:', error.message);
    throw error;
  }
}

// Jika dijalankan langsung dari terminal
if (process.argv[1] && (process.argv[1].endsWith('seed-jamaahku.mjs') || process.argv[1].endsWith('seed-jamaahku'))) {
  seedJamaahkuDatabase().catch(() => process.exit(1));
}
