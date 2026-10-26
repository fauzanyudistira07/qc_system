import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const device = '192.168.10.37:5555';
const root = process.cwd();
const targetJobId = 'fd7d9a1e-8711-4709-a0b0-3e0b45adb56d';
const runLabel = 'al-hikmah-digital-ai-suite-2026-10-19T0122Z';

const jobDir = path.join(root, '.qc-artifacts', 'jobs', targetJobId);
const jobScreenshots = path.join(jobDir, 'screenshots');
const jobVideos = path.join(jobDir, 'videos');

const projectRunDir = path.join(root, '.qc-artifacts', 'projects', 'al-hikmah-digital', 'runs', runLabel);
const runEvidenceScreenshots = path.join(projectRunDir, 'evidence', 'screenshots');
const runEvidenceVideos = path.join(projectRunDir, 'evidence', 'videos');

fs.mkdirSync(jobScreenshots, { recursive: true });
fs.mkdirSync(jobVideos, { recursive: true });
fs.mkdirSync(runEvidenceScreenshots, { recursive: true });
fs.mkdirSync(runEvidenceVideos, { recursive: true });

function sh(cmd) {
  try {
    return execSync(`adb -s ${device} ${cmd}`, { encoding: 'utf8', timeout: 35000 });
  } catch (err) {
    console.error(`Command failed: adb -s ${device} ${cmd}`, err.message);
    return '';
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getUiDump() {
  sh('shell uiautomator dump /sdcard/dump.xml');
  return sh('shell cat /sdcard/dump.xml');
}

async function waitForUi(keyword, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const xml = getUiDump();
    if (xml.includes(keyword)) {
      return xml;
    }
    await sleep(600);
  }
  console.warn(`  ⚠️ Timeout waiting for UI keyword: "${keyword}"`);
  return null;
}

function screencap(filename) {
  const remotePath = `/sdcard/qc_${filename}`;
  sh(`shell screencap -p ${remotePath}`);
  
  const localJobPath = path.join(jobScreenshots, filename);
  const localRunPath = path.join(runEvidenceScreenshots, filename);
  
  try {
    execSync(`adb -s ${device} pull ${remotePath} "${localJobPath}"`, { timeout: 15000 });
    fs.copyFileSync(localJobPath, localRunPath);
    sh(`shell rm -f ${remotePath}`);
    console.log(`  📸 Screencap: ${filename} (${fs.statSync(localJobPath).size} bytes)`);
  } catch (e) {
    console.error(`  ❌ Failed to pull ${filename}:`, e.message);
  }
}

async function recordSession(filename, timeLimitSec, actionsFn) {
  console.log(`\n▶ Starting video recording: ${filename} (limit ${timeLimitSec}s)`);
  const remotePath = `/sdcard/rec_${filename}`;
  sh(`shell rm -f ${remotePath}`);

  const recProcess = spawn('adb', ['-s', device, 'shell', `screenrecord --time-limit ${timeLimitSec} ${remotePath}`], {
    stdio: 'ignore'
  });

  await sleep(1500);

  try {
    await actionsFn();
  } catch (err) {
    console.error(`Error during action for ${filename}:`, err);
  }

  await sleep(1500);
  try {
    sh('shell "pkill -2 screenrecord || killall -2 screenrecord || true"');
  } catch {}
  recProcess.kill();
  await sleep(2500);

  const localJobPath = path.join(jobVideos, filename);
  const localRunPath = path.join(runEvidenceVideos, filename);
  
  try {
    execSync(`adb -s ${device} pull ${remotePath} "${localJobPath}"`, { timeout: 35000 });
    fs.copyFileSync(localJobPath, localRunPath);
    sh(`shell rm -f ${remotePath}`);
    console.log(`  🎬 Video saved: ${filename} (${fs.statSync(localJobPath).size} bytes)`);
  } catch (e) {
    console.error(`  ❌ Failed to pull ${filename}:`, e.message);
  }
}

async function ensureAtLoginScreen() {
  const xml = getUiDump();
  if (xml.includes('PILIH ROLE DEMO')) {
    console.log('  ✅ Already at Login screen!');
    return;
  }
  // Try tapping back or drawer logout
  sh('shell input keyevent 4');
  await sleep(1000);
  const xml2 = getUiDump();
  if (xml2.includes('PILIH ROLE DEMO')) return;

  // Open drawer and tap logout
  sh('shell input tap 88 203');
  await sleep(1000);
  sh('shell input tap 159 2309');
  await sleep(1500);
  const xml3 = await waitForUi('PILIH ROLE DEMO', 8000);
  if (!xml3) {
    console.warn('  ⚠️ Could not return to login screen gracefully, restarting activity...');
    sh('shell am force-stop com.alhikmah.digital');
    await sleep(500);
    sh('shell monkey -p com.alhikmah.digital -c android.intent.category.LAUNCHER 1');
    await waitForUi('PILIH ROLE DEMO', 15000);
  }
}

async function main() {
  console.log('===============================================================');
  console.log('🚀 RECORDING FLOW 14 (MANAGER SARPRAS) & FLOW 15 (STAFF TEKNISI)');
  console.log('   Target: com.alhikmah.digital on 192.168.10.37:5555');
  console.log('===============================================================');

  // -------------------------------------------------------------
  // FLOW 14: Manager Sarpras (Tombol ACC & Recheck & Detail)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 14: Manager Sarpras (Tombol ACC & Recheck) ---');
  await ensureAtLoginScreen();

  await recordSession('video-14-role-manager.mp4', 55, async () => {
    screencap('step-14-01-login-screen.png');
    await sleep(800);

    // 1. Tap Manager Sarpras (296, 1294)
    console.log('  1. Selecting Manager Sarpras role...');
    sh('shell input tap 296 1294');
    await sleep(600);
    screencap('step-14-02-role-manager-selected.png');
    await sleep(600);

    // 2. Tap Masuk (540, 2150)
    console.log('  2. Tapping Masuk button...');
    sh('shell input tap 540 2150');
    await waitForUi('Syarifuddin', 12000);
    screencap('step-14-03-manager-dashboard.png');
    await sleep(1500);

    // 3. Category tab (759, 1478)
    console.log('  3. Switching to Kategori breakdown tab...');
    sh('shell input tap 759 1478');
    await sleep(1200);
    screencap('step-14-04-manager-filter-kategori.png');
    await sleep(1000);

    // 4. Ringkasan tab (321, 1478)
    console.log('  4. Returning to Ringkasan tab...');
    sh('shell input tap 321 1478');
    await sleep(1000);

    // 5. Scroll down to Antrean Keluhan
    console.log('  5. Scrolling to Antrean Keluhan...');
    sh('shell input swipe 540 1800 540 800 400');
    await sleep(1200);
    screencap('step-14-05-manager-antrean.png');
    await sleep(1000);

    // 6. Scroll down slightly to display the Plambing/Sanitasi card with Recheck & ACC
    console.log('  6. Positioning Recheck & ACC approval card...');
    sh('shell input swipe 540 1600 540 900 400');
    await sleep(1200);
    screencap('step-14-07-manager-approval-card.png');
    await sleep(1200);

    // 7. Open Detail Tiket (547, 1814)
    console.log('  7. Opening Detail Tiket sheet with Before/After photos...');
    sh('shell input tap 547 1814');
    await waitForUi('Before (kerusakan)', 8000);
    screencap('step-14-06-manager-detail-tiket.png');
    await sleep(2000);

    // 8. Close Detail Tiket via Scrim (540, 200)
    console.log('  8. Closing Detail Tiket sheet...');
    sh('shell input tap 540 200');
    await sleep(1200);

    // 9. Scroll back up to top
    console.log('  9. Scrolling back to top...');
    sh('shell input swipe 540 600 540 2000 350');
    await sleep(600);
    sh('shell input swipe 540 600 540 2000 350');
    await sleep(1000);

    // 10. Open drawer and logout
    console.log('  10. Opening drawer and logging out...');
    sh('shell input tap 88 203');
    await sleep(1000);
    sh('shell input tap 159 2309');
    await waitForUi('PILIH ROLE DEMO', 8000);
    await sleep(1000);
    console.log('  ✅ Flow 14 Manager Sarpras recording completed!');
  });

  // -------------------------------------------------------------
  // FLOW 15: Staff Teknisi (Detail WO & Form Laporan Selesai)
  // -------------------------------------------------------------
  console.log('\n--- FLOW 15: Staff Teknisi (Detail WO & Laporan Selesai) ---');
  await ensureAtLoginScreen();

  await recordSession('video-15-role-teknisi.mp4', 55, async () => {
    screencap('step-15-01-login-screen.png');
    await sleep(800);

    // 1. Tap Staff Teknisi (673, 1294)
    console.log('  1. Selecting Staff Teknisi role...');
    sh('shell input tap 673 1294');
    await sleep(600);
    screencap('step-15-02-role-teknisi-selected.png');
    await sleep(600);

    // 2. Tap Masuk (540, 2150)
    console.log('  2. Tapping Masuk button...');
    sh('shell input tap 540 2150');
    await waitForUi('Ahmad Rian', 12000);
    screencap('step-15-03-teknisi-dashboard.png');
    await sleep(1500);

    // 3. Detail Tiket work order (547, 2116)
    console.log('  3. Opening Work Order Detail (Before & After photos)...');
    sh('shell input tap 547 2116');
    await waitForUi('Before (kerusakan)', 8000);
    screencap('step-15-04-teknisi-detail-tiket.png');
    await sleep(2000);

    // 4. Close sheet via Scrim (540, 200)
    console.log('  4. Closing Work Order Detail sheet...');
    sh('shell input tap 540 200');
    await sleep(1200);

    // 5. Tap "Kirim Laporan Selesai & Foto" (547, 1968)
    console.log('  5. Opening Kirim Laporan Selesai & Foto modal...');
    sh('shell input tap 547 1968');
    await waitForUi('Foto Bukti Hasil Perbaikan', 8000);
    screencap('step-15-05-teknisi-laporan-selesai.png');
    screencap('step-15-04-teknisi-form-laporan.png');
    await sleep(2000);

    // 6. Dismiss via Batal (289, 2282)
    console.log('  6. Dismissing form via Batal...');
    sh('shell input tap 289 2282');
    await waitForUi('Ahmad Rian', 6000);
    screencap('step-15-06-teknisi-dashboard-selesai.png');
    await sleep(1200);

    // 7. Open drawer and logout
    console.log('  7. Opening drawer and logging out...');
    sh('shell input tap 88 203');
    await sleep(1000);
    sh('shell input tap 159 2309');
    await waitForUi('PILIH ROLE DEMO', 8000);
    await sleep(1000);
    console.log('  ✅ Flow 15 Staff Teknisi recording completed!');
  });

  console.log('\n🎉 FLOWS 14 & 15 RECORDING COMPLETED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
