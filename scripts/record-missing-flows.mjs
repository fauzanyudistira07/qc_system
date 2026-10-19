import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const device = '192.168.10.37:5555';
const outDir = '/tmp/alhikmah_recordings';
fs.mkdirSync(outDir, { recursive: true });

function sh(cmd) {
  console.log(`[EXEC] ${cmd}`);
  return execSync(`adb -s ${device} ${cmd}`, { encoding: 'utf8', stdio: 'pipe' });
}

function screencap(destFile) {
  const fullPath = path.join(outDir, destFile);
  execSync(`adb -s ${device} exec-out screencap -p > "${fullPath}"`);
  console.log(`  ✓ Saved screenshot: ${destFile} (${fs.statSync(fullPath).size} bytes)`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function recordSession(filename, actionFn) {
  const remotePath = `/sdcard/${filename}`;
  console.log(`\n▶ Starting screenrecord -> ${remotePath}`);
  
  // Start screenrecord process
  const child = spawn('adb', ['-s', device, 'shell', `screenrecord --time-limit 30 ${remotePath}`]);
  await sleep(1000); // let recording start

  try {
    await actionFn();
  } catch (err) {
    console.error('Error during action:', err);
  }

  await sleep(1000);
  // Kill screenrecord cleanly with SIGINT so file finalizes
  try {
    sh(`shell "pkill -2 screenrecord || killall -2 screenrecord"`);
  } catch (e) {
    // ignore
  }
  await sleep(1500);

  const localFile = path.join(outDir, filename);
  sh(`pull ${remotePath} "${localFile}"`);
  sh(`shell rm -f ${remotePath}`);
  console.log(`  ✓ Pulled video: ${filename} (${fs.statSync(localFile).size} bytes)`);
}

async function main() {
  console.log('=== RECORDING AL-HIKMAH LIVE FLOWS ON DEVICE ===');

  // --- FLOW 10: Drawer & Profil ---
  await recordSession('video-10-drawer-profil.mp4', async () => {
    // Pastikan masuk sebagai siswa
    sh('shell "pm clear --user 0 com.alhikmah.digital && monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1"');
    await sleep(2500);
    sh('shell "input tap 540 2108"'); // allow notif
    await sleep(800);
    sh('shell "input tap 271 959"'); // Siswa
    await sleep(400);
    sh('shell "input tap 540 1937"'); // Masuk
    await sleep(1800);

    screencap('step-10-01-dashboard.png');

    // Buka drawer
    sh('shell "input tap 126 220"');
    await sleep(1000);
    screencap('step-10-02-drawer-menu.png');
    screencap('detail-beranda-profil-siswa.png');

    // Buka profil siswa
    sh('shell "input tap 418 561"');
    await sleep(1200);
    screencap('step-10-03-profil-siswa.png');

    // Kembali ke drawer / home
    sh('shell "input keyevent 4"');
    await sleep(800);
  });

  // --- FLOW 11: Quick Actions: Kalender Kegiatan & Detail Berita ---
  await recordSession('video-11-kalender-kegiatan.mp4', async () => {
    sh('shell "input tap 540 1000"'); // pastikan di beranda
    await sleep(500);
    screencap('step-11-01-beranda-actions.png');

    // Buka Kalender Kegiatan (Blue Card)
    sh('shell "input tap 270 2080"');
    await sleep(1200);
    screencap('step-11-02-kalender-kegiatan.png');
    screencap('kalender-kegiatan-screen.png');

    // Back ke Beranda
    sh('shell "input keyevent 4"');
    await sleep(800);

    // Scroll ke Berita Sekolah
    sh('shell "input swipe 540 1800 540 600 300"');
    await sleep(1000);
    screencap('step-11-03-berita-sekolah.png');
    screencap('detail-beranda-artikel-berita.png');
  });

  // --- FLOW 12: Pusat Notifikasi & Broadcast ---
  await recordSession('video-12-pusat-notifikasi.mp4', async () => {
    // Scroll back up to top
    sh('shell "input swipe 540 600 540 1800 300"');
    await sleep(800);
    screencap('step-12-01-beranda-top.png');

    // Tap Bell Icon
    sh('shell "input tap 953 220"');
    await sleep(1200);
    screencap('step-12-02-notifikasi-list.png');
    screencap('detail-beranda-pusat-notifikasi.png');

    // Tap tab Pengumuman
    sh('shell "input tap 716 142"');
    await sleep(800);
    screencap('step-12-03-notifikasi-pengumuman.png');

    sh('shell "input keyevent 4"');
    await sleep(600);
  });

  // --- FLOW 13: Switch Role Dewan Guru ---
  await recordSession('video-13-role-guru.mp4', async () => {
    sh('shell "pm clear --user 0 com.alhikmah.digital && monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1"');
    await sleep(2500);
    sh('shell "input tap 540 2108"');
    await sleep(800);

    screencap('step-13-01-login-screen.png');

    // Tap Dewan Guru
    sh('shell "input tap 618 959"');
    await sleep(600);
    screencap('step-13-02-role-guru-selected.png');

    // Tap Masuk
    sh('shell "input tap 540 1937"');
    await sleep(2000);
    screencap('step-13-03-guru-dashboard.png');
    screencap('detail-role-guru-dashboard.png');
    screencap('role-guru-dashboard.png');

    // Tap Tab Absensi Guru
    sh('shell "input tap 400 2280"');
    await sleep(1000);
    screencap('step-13-04-guru-absensi.png');
    screencap('detail-role-guru-presensi.png');
  });

  // --- FLOW 14: Switch Role Manager Sarpras ---
  await recordSession('video-14-role-manager.mp4', async () => {
    sh('shell "pm clear --user 0 com.alhikmah.digital && monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1"');
    await sleep(2500);
    sh('shell "input tap 540 2108"');
    await sleep(800);

    screencap('step-14-01-login-screen.png');

    // Tap Manager Sarpras
    sh('shell "input tap 296 1081"');
    await sleep(600);
    screencap('step-14-02-role-manager-selected.png');

    // Tap Masuk
    sh('shell "input tap 540 1937"');
    await sleep(2000);
    screencap('step-14-03-manager-dashboard.png');
    screencap('detail-role-manager-dashboard.png');
    screencap('role-manager-dashboard.png');

    // Scroll Antrean Keluhan
    sh('shell "input swipe 540 1800 540 1000 300"');
    await sleep(1000);
    screencap('step-14-04-manager-tiket.png');
    screencap('detail-role-manager-tiket-sarpras.png');
  });

  // --- FLOW 15: Switch Role Staff Teknisi ---
  await recordSession('video-15-role-teknisi.mp4', async () => {
    sh('shell "pm clear --user 0 com.alhikmah.digital && monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1"');
    await sleep(2500);
    sh('shell "input tap 540 2108"');
    await sleep(800);

    screencap('step-15-01-login-screen.png');

    // Tap Staff Teknisi
    sh('shell "input tap 673 1081"');
    await sleep(600);
    screencap('step-15-02-role-teknisi-selected.png');

    // Tap Masuk
    sh('shell "input tap 540 1937"');
    await sleep(2000);
    screencap('step-15-03-teknisi-dashboard.png');
    screencap('detail-role-teknisi-dashboard.png');
    screencap('role-teknisi-dashboard.png');

    // Tap Kirim Laporan Selesai & Foto (green button)
    sh('shell "input tap 540 1700"');
    await sleep(1200);
    screencap('step-15-04-teknisi-form-laporan.png');
    screencap('detail-role-teknisi-form-laporan-selesai.png');
  });

  console.log('\n🎉 ALL 6 FLOWS SUCCESSFULLY RECORDED AND CAPTURED!');
}

main().catch(console.error);
