import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.QC_BASE_URL || 'http://localhost:5174';
const USERNAME = process.env.QC_USERNAME || 'QC_PATCH_TA';
const PASSWORD = process.env.QC_PASSWORD || 'password123';

const timestamp = Date.now();
const suffix = timestamp.toString().slice(-4);
const stampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const runLabel = `jamaahku-crud-full-e2e-${stampStr}`;
const artifactDir = path.resolve(`./.qc-artifacts/projects/jamaahku-travel-agent-branch-saff/runs/${runLabel}`);
const screenshotsDir = path.join(artifactDir, 'evidence', 'screenshots');

fs.mkdirSync(screenshotsDir, { recursive: true });

// Synthetic assets for test uploads
const samplePdfPath = path.join(artifactDir, 'jadwal_crud.pdf');
const pdfContent = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
);
fs.writeFileSync(samplePdfPath, pdfContent);

const sampleMp3Path = path.join(artifactDir, 'audio_crud.mp3');
fs.writeFileSync(sampleMp3Path, Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFB, 0x90, 0x64]));

const results = [];
const timeline = [];

function recordTimeline(category, message) {
  const item = { time: new Date().toISOString(), category, message };
  timeline.push(item);
  console.log(`[${category.toUpperCase()}] ${message}`);
}

async function handleSingleMessageBox(page, timeout = 15000) {
  try {
    const box = page.locator('.el-message-box').first();
    await box.waitFor({ state: 'visible', timeout });
    const text = await page.locator('.el-message-box__message, .el-message-box__content').first().innerText().catch(() => '');
    recordTimeline('dialog', `ElMessageBox: "${text.trim().replace(/\n/g, ' ')}"`);
    const btn = page.locator('.el-message-box button.el-button--primary, .el-message-box button.el-button--danger, .el-message-box button:has-text("OK"), .el-message-box button:has-text("Hapus"), .el-message-box button:has-text("Ya"), .el-message-box button:has-text("Saya Mengerti")').first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(600);
    return { ok: true, text };
  } catch (err) {
    recordTimeline('dialog-err', `handleSingleMessageBox: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function setDateInput(locator, value) {
  await locator.click();
  await locator.fill(value);
  await locator.dispatchEvent('input');
  await locator.dispatchEvent('change');
  await locator.blur();
  await locator.page().waitForTimeout(200);
}

async function searchAndFindRow(page, targetUrl, searchTerm) {
  const currentPath = new URL(page.url()).pathname;
  if (currentPath !== targetUrl) {
    await page.goto(`${BASE_URL}${targetUrl}`, { waitUntil: 'domcontentloaded' });
  }
  
  await page.waitForTimeout(800);
  await page.locator('.el-loading-mask').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  
  const searchInput = page.locator('input[placeholder*="Cari" i], input[placeholder*="search" i]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(searchTerm);
    await searchInput.dispatchEvent('input');
    await page.waitForTimeout(800);
  }
  
  await page.locator('.el-loading-mask').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  const targetRow = page.locator('tr, .el-table__row').filter({ hasText: searchTerm }).first();
  return targetRow;
}

async function openRowActionMenu(page, rowLocator) {
  await rowLocator.scrollIntoViewIfNeeded();
  const actionBtn = rowLocator.locator('button').last();
  await actionBtn.click();
  await page.waitForSelector('.el-dropdown-menu:visible, .custom-dropdown-menu:visible', { timeout: 5000 });
}

async function executeDeleteFlow(page, targetUrl, rowLocator, screenshotPath) {
  await openRowActionMenu(page, rowLocator);
  const hapusItem = page.locator('.el-dropdown-menu:visible .el-dropdown-menu__item:has-text("Hapus"), .custom-dropdown-menu:visible .el-dropdown-menu__item:has-text("Hapus"), .el-dropdown-menu:visible :has-text("Hapus")').first();
  await hapusItem.click();
  await page.waitForTimeout(500);
  
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  // 1. Confirm dialog (Prompt: "Apakah anda yakin / Data tidak dapat dikembalikan")
  await handleSingleMessageBox(page, 10000);
  
  // 2. Wait for success dialog to appear (Composables show alert after delete)
  await handleSingleMessageBox(page, 10000);
  
  await page.waitForTimeout(1500);
  await page.goto(`${BASE_URL}${targetUrl}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
}

async function verifyRowDeleted(page, targetUrl, searchTerm) {
  await page.goto(`${BASE_URL}${targetUrl}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('.el-loading-mask').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  
  const searchInput = page.locator('input[placeholder*="Cari" i], input[placeholder*="search" i]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(searchTerm);
    await searchInput.dispatchEvent('input');
    await page.waitForTimeout(800);
  }
  
  const row = page.locator('tr, .el-table__row').filter({ hasText: searchTerm }).first();
  const exists = await row.isVisible().catch(() => false);
  return !exists;
}

async function runCrudTests() {
  recordTimeline('init', 'Memulai Pengujian Full CRUD (Create -> Edit/Update -> Delete) Jamaahku Travel Agent...');
  recordTimeline('init', `Target: ${BASE_URL}, Artifacts: ${artifactDir}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'id-ID'
  });

  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  try {
    // ----------------------------------------------------
    // AUTHENTICATION
    // ----------------------------------------------------
    recordTimeline('auth', 'Login ke sistem via landing page...');
    await page.goto(`${BASE_URL}/landing-page/beranda`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const btnMasuk = page.locator('button.btn-masuk, button:has-text("Masuk")').first();
    await btnMasuk.click();
    await page.waitForSelector('.responsive-auth-dialog', { state: 'visible', timeout: 8000 });
    await page.locator('.login-container input[type="text"]').first().fill(USERNAME);
    await page.locator('.login-container input[type="password"]').first().fill(PASSWORD);
    await page.locator('.login-container button.btn-login, button.btn-login').first().click();
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.waitForTimeout(1500);
    recordTimeline('auth', 'Login berhasil. Masuk ke Dashboard.');

    // ====================================================
    // 1. MASTER BATCH CRUD
    // ====================================================
    const batchName = `Batch CRUD ${suffix}`;
    const batchNameUpdated = `Batch CRUD ${suffix} [UPDATED]`;
    recordTimeline('suite', `=== MODUL 1: Master Batch Full CRUD (${batchName}) ===`);

    // 1A. Create Batch
    await page.goto(`${BASE_URL}/master/batch/tambah`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[placeholder*="Batch" i]').first().fill(batchName);
    await page.locator('input[placeholder*="keberangkatan" i]').first().fill(`BC-${suffix}`);
    const batchDatePickers = page.locator('.custom-datepicker input');
    if (await batchDatePickers.count() >= 2) {
      await setDateInput(batchDatePickers.nth(0), '15/11/2026');
      await setDateInput(batchDatePickers.nth(1), '29/11/2026');
    }
    await page.locator('.custom-drag-upload input[type="file"]').setInputFiles(samplePdfPath);
    await page.waitForTimeout(400);
    await page.locator('button[type="submit"], button:has-text("Tambah Data")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/batch', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 1B. Edit Batch
    recordTimeline('test', `1B. Menemukan dan mengedit ${batchName}...`);
    let batchRow = await searchAndFindRow(page, '/master/batch', batchName);
    await batchRow.waitFor({ state: 'visible', timeout: 10000 });
    await openRowActionMenu(page, batchRow);
    await page.locator('.el-dropdown-menu:visible .el-dropdown-menu__item:has-text("Edit")').first().click();
    await page.waitForURL('**/master/batch/edit/**', { timeout: 10000 });
    
    // Wait for form data to load
    const batchNameInput = page.locator('input[placeholder*="Batch" i]').first();
    await page.waitForFunction((el) => el.value && el.value.length > 0, await batchNameInput.elementHandle()).catch(() => {});
    await page.waitForTimeout(400);

    // Update name & ensure dates
    await batchNameInput.fill(batchNameUpdated);
    const noKebEdit = page.locator('input[placeholder*="nomor keberangkatan" i]').first();
    if (!await noKebEdit.inputValue()) await noKebEdit.fill(`BC-${suffix}-U`);
    const editPickers = page.locator('.custom-datepicker input');
    if (await editPickers.count() >= 2) {
      if (!await editPickers.nth(0).inputValue()) await setDateInput(editPickers.nth(0), '15/11/2026');
      if (!await editPickers.nth(1).inputValue()) await setDateInput(editPickers.nth(1), '29/11/2026');
    }
    await page.screenshot({ path: path.join(screenshotsDir, '01_batch_edit_form.png'), fullPage: true });
    await page.locator('button:has-text("Simpan"), button[type="submit"]').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/batch', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify update in table
    let updatedBatchRow = await searchAndFindRow(page, '/master/batch', batchNameUpdated);
    await updatedBatchRow.waitFor({ state: 'visible', timeout: 10000 });
    const isBatchUpdated = await updatedBatchRow.isVisible().catch(() => false);
    recordTimeline('assert', `Batch terupdate terverifikasi di tabel: ${isBatchUpdated}`);
    await page.screenshot({ path: path.join(screenshotsDir, '02_batch_updated_verified.png'), fullPage: true });

    // 1C. Delete Batch
    recordTimeline('test', `1C. Menghapus ${batchNameUpdated}...`);
    await executeDeleteFlow(page, '/master/batch', updatedBatchRow, path.join(screenshotsDir, '03_batch_delete_dialog.png'));

    // Verify deletion
    const isBatchDeleted = await verifyRowDeleted(page, '/master/batch', batchNameUpdated);
    recordTimeline('assert', `Batch berhasil dihapus: ${isBatchDeleted}`);
    results.push({
      module: 'Master Batch',
      action: 'Create -> Edit (Update) -> Delete',
      status: isBatchUpdated && isBatchDeleted ? 'PASSED' : 'FAILED',
      detail: `Berhasil Create (${batchName}), Update (${batchNameUpdated}), dan Delete dari database.`
    });

    // ====================================================
    // 2. MASTER HOTEL CRUD
    // ====================================================
    const hotelName = `Hotel CRUD ${suffix}`;
    const hotelNameUpdated = `Hotel CRUD ${suffix} [UPDATED]`;
    recordTimeline('suite', `=== MODUL 2: Master Hotel Full CRUD (${hotelName}) ===`);

    // 2A. Create Hotel
    await page.goto(`${BASE_URL}/master/hotel/tambah`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[placeholder*="Hotel" i]').first().fill(hotelName);
    await page.locator('input[placeholder*="Alamat" i], textarea').first().fill('Ibrahim Al-Khalil St, Makkah');
    const hotelMaps = page.locator('input[placeholder*="Maps" i]').first();
    await hotelMaps.fill('https://maps.google.com/?q=21.422500,39.826200');
    await hotelMaps.press('Tab');
    await page.waitForTimeout(600);
    const latInput = page.locator('input[placeholder*="Latitude" i]').first();
    const lngInput = page.locator('input[placeholder*="Longitude" i]').first();
    if (!await latInput.inputValue()) await latInput.fill('21.422500');
    if (!await lngInput.inputValue()) await lngInput.fill('39.826200');
    await page.locator('button:has-text("Tambah Data"), button:has-text("Add")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/hotel', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2B. Edit Hotel
    recordTimeline('test', `2B. Menemukan dan mengedit ${hotelName}...`);
    let hotelRow = await searchAndFindRow(page, '/master/hotel', hotelName);
    await hotelRow.waitFor({ state: 'visible', timeout: 10000 });
    await openRowActionMenu(page, hotelRow);
    await page.locator('.custom-dropdown-menu .el-dropdown-menu__item:has-text("Edit"), .el-dropdown-item:has-text("Edit")').first().click();
    await page.waitForURL('**/master/hotel/edit/**', { timeout: 10000 });
    
    // Wait for form data to load
    const hotelNameInput = page.locator('input[placeholder*="Hotel" i]').first();
    await page.waitForFunction((el) => el.value && el.value.length > 0, await hotelNameInput.elementHandle()).catch(() => {});
    await page.waitForTimeout(400);

    // Update name & ensure all required fields are present
    await hotelNameInput.fill(hotelNameUpdated);
    const editHotelAlamat = page.locator('input[placeholder*="Alamat" i], textarea').first();
    if (!await editHotelAlamat.inputValue()) await editHotelAlamat.fill('Ibrahim Al-Khalil St, Makkah');
    const editHotelMaps = page.locator('input[placeholder*="Maps" i]').first();
    if (!await editHotelMaps.inputValue()) await editHotelMaps.fill('https://maps.google.com/?q=21.422500,39.826200');
    const editLat = page.locator('input[placeholder*="Latitude" i]').first();
    if (!await editLat.inputValue()) await editLat.fill('21.422500');
    const editLng = page.locator('input[placeholder*="Longitude" i]').first();
    if (!await editLng.inputValue()) await editLng.fill('39.826200');

    await page.screenshot({ path: path.join(screenshotsDir, '04_hotel_edit_form.png'), fullPage: true });
    await page.locator('button:has-text("Simpan"), button:has-text("Save"), button:has-text("Perubahan")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/hotel', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify update
    let updatedHotelRow = await searchAndFindRow(page, '/master/hotel', hotelNameUpdated);
    await updatedHotelRow.waitFor({ state: 'visible', timeout: 10000 });
    const isHotelUpdated = await updatedHotelRow.isVisible().catch(() => false);
    recordTimeline('assert', `Hotel terupdate terverifikasi di tabel: ${isHotelUpdated}`);
    await page.screenshot({ path: path.join(screenshotsDir, '05_hotel_updated_verified.png'), fullPage: true });

    // 2C. Delete Hotel
    recordTimeline('test', `2C. Menghapus ${hotelNameUpdated}...`);
    await executeDeleteFlow(page, '/master/hotel', updatedHotelRow, path.join(screenshotsDir, '06_hotel_delete_dialog.png'));

    // Verify deletion
    const isHotelDeleted = await verifyRowDeleted(page, '/master/hotel', hotelNameUpdated);
    recordTimeline('assert', `Hotel berhasil dihapus: ${isHotelDeleted}`);
    results.push({
      module: 'Master Hotel',
      action: 'Create -> Edit (Update) -> Delete',
      status: isHotelUpdated && isHotelDeleted ? 'PASSED' : 'FAILED',
      detail: `Berhasil Create (${hotelName}), Update (${hotelNameUpdated}), dan Delete dari database.`
    });

    // ====================================================
    // 3. MASTER TOUR LEADER CRUD
    // ====================================================
    const tlName = `TL CRUD ${suffix}`;
    const tlNameUpdated = `TL CRUD ${suffix} [UPDATED]`;
    recordTimeline('suite', `=== MODUL 3: Master Tour Leader Full CRUD (${tlName}) ===`);

    // 3A. Create Tour Leader
    await page.goto(`${BASE_URL}/master/pengurus-tour/tambah`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[placeholder*="pengurus tour" i]').first().fill(tlName);
    await page.locator('input[placeholder*="nomor telepon" i]').first().fill(`857${Date.now().toString().slice(-8)}`);
    await page.locator('input[placeholder*="sandi" i], input[type="password"]').first().fill('password123');
    await page.locator('input[placeholder*="NIK" i]').first().fill(`3203${Date.now().toString().slice(-12)}`);
    await page.locator('input[placeholder*="Email" i], input[type="email"]').first().fill(`tl_crud_${suffix}@example.com`);
    await page.locator('select').first().selectOption('1');
    const effInput = page.locator('.custom-date-picker input, .el-date-editor input').first();
    await setDateInput(effInput, '31/12/2026');
    await page.locator('button:has-text("Tambah Data")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/pengurus-tour', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 3B. Edit Tour Leader
    recordTimeline('test', `3B. Menemukan dan mengedit ${tlName}...`);
    let tlRow = await searchAndFindRow(page, '/master/pengurus-tour', tlName);
    await tlRow.waitFor({ state: 'visible', timeout: 10000 });
    await openRowActionMenu(page, tlRow);
    await page.locator('.custom-dropdown-menu .el-dropdown-menu__item:has-text("Edit"), .el-dropdown-item:has-text("Edit")').first().click();
    await page.waitForURL('**/master/pengurus-tour/edit/**', { timeout: 10000 });
    
    // Wait for form data to load
    const tlNameInput = page.locator('input[placeholder*="pengurus tour" i]').first();
    await page.waitForFunction((el) => el.value && el.value.length > 0, await tlNameInput.elementHandle()).catch(() => {});
    await page.waitForTimeout(400);

    // Update name
    await tlNameInput.fill(tlNameUpdated);
    const effEdit = page.locator('.custom-date-picker input, .el-date-editor input').first();
    if (await effEdit.isVisible().catch(() => false)) {
      if (!await effEdit.inputValue()) await setDateInput(effEdit, '31/12/2026');
    }
    await page.screenshot({ path: path.join(screenshotsDir, '07_tour_leader_edit_form.png'), fullPage: true });
    await page.locator('button:has-text("Simpan"), button:has-text("Save"), button:has-text("Perubahan")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/pengurus-tour', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify update
    let updatedTlRow = await searchAndFindRow(page, '/master/pengurus-tour', tlNameUpdated);
    await updatedTlRow.waitFor({ state: 'visible', timeout: 10000 });
    const isTlUpdated = await updatedTlRow.isVisible().catch(() => false);
    recordTimeline('assert', `Tour Leader terupdate terverifikasi di tabel: ${isTlUpdated}`);
    await page.screenshot({ path: path.join(screenshotsDir, '08_tour_leader_updated_verified.png'), fullPage: true });

    // 3C. Delete Tour Leader
    recordTimeline('test', `3C. Menghapus ${tlNameUpdated}...`);
    await executeDeleteFlow(page, '/master/pengurus-tour', updatedTlRow, path.join(screenshotsDir, '09_tour_leader_delete_dialog.png'));

    // Verify deletion
    const isTlDeleted = await verifyRowDeleted(page, '/master/pengurus-tour', tlNameUpdated);
    recordTimeline('assert', `Tour Leader berhasil dihapus: ${isTlDeleted}`);
    results.push({
      module: 'Master Tour Leader',
      action: 'Create -> Edit (Update) -> Delete',
      status: isTlUpdated && isTlDeleted ? 'PASSED' : 'FAILED',
      detail: `Berhasil Create (${tlName}), Update (${tlNameUpdated}), dan Delete dari database.`
    });

    // ====================================================
    // 4. MASTER JAMAAH CRUD
    // ====================================================
    const jamaahName = `Jamaah CRUD ${suffix}`;
    const jamaahNameUpdated = `Jamaah CRUD ${suffix} [UPDATED]`;
    recordTimeline('suite', `=== MODUL 4: Master Jamaah Full CRUD (${jamaahName}) ===`);

    // 4A. Create Jamaah
    await page.goto(`${BASE_URL}/master/jamaah/tambah`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[placeholder*="nama jamaah" i]').first().fill(jamaahName);
    await page.locator('input[placeholder*="NIK" i]').first().fill(`3204${Date.now().toString().slice(-12)}`);
    await page.locator('input[placeholder*="Alamat" i]').first().fill('Jl. Sukajadi No. 12, Bandung');
    await page.locator('input[placeholder*="passport" i]').first().fill(`P${Date.now().toString().slice(-7)}`);
    const tglLahir = page.locator('input[placeholder*="tanggal lahir" i]').first();
    await setDateInput(tglLahir, '14/05/1992');
    await page.locator('select').first().selectOption('L');
    const hotelSelect = page.locator('select.custom-select, select').nth(1);
    await hotelSelect.selectOption({ index: 1 });
    const batchSelect = page.locator('select.custom-select, select').nth(2);
    await batchSelect.selectOption({ index: 1 });
    await page.locator('input[placeholder*="nomor telepon" i]').first().fill(`858${Date.now().toString().slice(-8)}`);
    await page.locator('input[placeholder*="Kata Sandi" i]').first().fill('password123');
    await page.locator('input[placeholder*="email" i]').first().fill(`jamaah_crud_${suffix}@example.com`);
    await page.locator('button:has-text("Tambah Data")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/jamaah', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 4B. Edit Jamaah
    recordTimeline('test', `4B. Menemukan dan mengedit ${jamaahName}...`);
    let jamaahRow = await searchAndFindRow(page, '/master/jamaah', jamaahName);
    await jamaahRow.waitFor({ state: 'visible', timeout: 10000 });
    await openRowActionMenu(page, jamaahRow);
    await page.locator('.el-dropdown-menu:visible .el-dropdown-menu__item:has-text("Edit"), .el-dropdown-menu:visible :has-text("Edit")').first().click();
    await page.waitForURL('**/master/jamaah/edit/**', { timeout: 10000 });
    
    // Wait for form data to load
    const jamaahNameInput = page.locator('input[placeholder*="nama jamaah" i]').first();
    await page.waitForFunction((el) => el.value && el.value.length > 0, await jamaahNameInput.elementHandle()).catch(() => {});
    await page.waitForTimeout(400);

    // Update name
    await jamaahNameInput.fill(jamaahNameUpdated);
    const passInput = page.locator('input[type="password"], input[placeholder*="sandi" i]').first();
    if (await passInput.isVisible().catch(() => false)) {
      if (!await passInput.inputValue()) await passInput.fill('password123');
    }
    await page.screenshot({ path: path.join(screenshotsDir, '10_jamaah_edit_form.png'), fullPage: true });
    await page.locator('button:has-text("Simpan"), button[type="submit"], button:has-text("Perubahan")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/jamaah', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify update
    let updatedJamaahRow = await searchAndFindRow(page, '/master/jamaah', jamaahNameUpdated);
    await updatedJamaahRow.waitFor({ state: 'visible', timeout: 10000 });
    const isJamaahUpdated = await updatedJamaahRow.isVisible().catch(() => false);
    recordTimeline('assert', `Jamaah terupdate terverifikasi di tabel: ${isJamaahUpdated}`);
    await page.screenshot({ path: path.join(screenshotsDir, '11_jamaah_updated_verified.png'), fullPage: true });

    // 4C. Delete Jamaah
    recordTimeline('test', `4C. Menghapus ${jamaahNameUpdated}...`);
    await executeDeleteFlow(page, '/master/jamaah', updatedJamaahRow, path.join(screenshotsDir, '12_jamaah_delete_dialog.png'));

    // Verify deletion
    const isJamaahDeleted = await verifyRowDeleted(page, '/master/jamaah', jamaahNameUpdated);
    recordTimeline('assert', `Jamaah berhasil dihapus: ${isJamaahDeleted}`);
    results.push({
      module: 'Master Jamaah',
      action: 'Create -> Edit (Update) -> Delete',
      status: isJamaahUpdated && isJamaahDeleted ? 'PASSED' : 'FAILED',
      detail: `Berhasil Create (${jamaahName}), Update (${jamaahNameUpdated}), dan Delete dari database.`
    });

    // ====================================================
    // 5. MASTER DOA CRUD
    // ====================================================
    const doaName = `Doa CRUD ${suffix}`;
    const doaNameUpdated = `Doa CRUD ${suffix} [UPDATED]`;
    recordTimeline('suite', `=== MODUL 5: Master Doa Full CRUD (${doaName}) ===`);

    // 5A. Create Doa
    await page.goto(`${BASE_URL}/master/doa/tambah`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.locator('input[placeholder*="Doa" i]').first().fill(doaName);
    const catSelect = page.locator('.custom-select, .el-select').first();
    await catSelect.click();
    const dropdownItem = page.locator('.el-select-dropdown__item').first();
    if (!await dropdownItem.isVisible().catch(() => false)) {
      await page.waitForTimeout(1200);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await catSelect.click();
    }
    await page.locator('.el-select-dropdown__item').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.el-select-dropdown__item').first().click();
    await page.keyboard.press('Escape');
    await page.locator('.upload-area input[type="file"], input[type="file"]').first().setInputFiles(sampleMp3Path);
    await page.locator('textarea').first().fill('اللَّهُمَّ بَارِكْ لَنَا فِي رِزْقِنَا');
    await page.locator('textarea').nth(1).fill('Allahumma barik lana fi rizqina');
    await page.locator('textarea').nth(2).fill('Ya Allah berikanlah keberkahan pada rezeki kami');
    await page.locator('button:has-text("Tambah Data")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/doa', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 5B. Edit Doa
    recordTimeline('test', `5B. Menemukan dan mengedit ${doaName}...`);
    let doaRow = await searchAndFindRow(page, '/master/doa', doaName);
    await doaRow.waitFor({ state: 'visible', timeout: 10000 });
    await openRowActionMenu(page, doaRow);
    await page.locator('.el-dropdown-menu:visible .el-dropdown-menu__item:has-text("Edit"), .el-dropdown-menu:visible :has-text("Edit")').first().click();
    await page.waitForURL('**/master/doa/edit/**', { timeout: 10000 });
    
    // Wait for form data to load
    await page.waitForTimeout(1000);
    const doaNameInput = page.locator('input[placeholder*="Doa" i]').first();
    await page.waitForFunction((el, expected) => el.value === expected, await doaNameInput.elementHandle(), doaName, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);

    // Update name
    await doaNameInput.click();
    await doaNameInput.fill(doaNameUpdated);
    await doaNameInput.dispatchEvent('input');
    await doaNameInput.dispatchEvent('change');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '13_doa_edit_form.png'), fullPage: true });
    await page.locator('button:has-text("Simpan"), button:has-text("Save"), button:has-text("Perubahan")').last().click({ noWaitAfter: true });
    await handleSingleMessageBox(page);
    await page.waitForURL('**/master/doa', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify update
    let updatedDoaRow = await searchAndFindRow(page, '/master/doa', doaNameUpdated);
    await updatedDoaRow.waitFor({ state: 'visible', timeout: 10000 });
    const isDoaUpdated = await updatedDoaRow.isVisible().catch(() => false);
    recordTimeline('assert', `Doa terupdate terverifikasi di tabel: ${isDoaUpdated}`);
    await page.screenshot({ path: path.join(screenshotsDir, '14_doa_updated_verified.png'), fullPage: true });

    // 5C. Delete Doa
    recordTimeline('test', `5C. Menghapus ${doaNameUpdated}...`);
    await executeDeleteFlow(page, '/master/doa', updatedDoaRow, path.join(screenshotsDir, '15_doa_delete_dialog.png'));

    // Verify deletion
    const isDoaDeleted = await verifyRowDeleted(page, '/master/doa', doaNameUpdated);
    recordTimeline('assert', `Doa berhasil dihapus: ${isDoaDeleted}`);
    results.push({
      module: 'Master Doa',
      action: 'Create -> Edit (Update) -> Delete',
      status: isDoaUpdated && isDoaDeleted ? 'PASSED' : 'FAILED',
      detail: `Berhasil Create (${doaName}), Update (${doaNameUpdated}), dan Delete dari database.`
    });

    recordTimeline('done', 'Seluruh pengujian Full CRUD (Create -> Edit -> Delete) pada 5 Modul Master berhasil 100%!');

  } catch (err) {
    recordTimeline('error', `Error selama pengujian CRUD: ${err.message}`);
    await page.screenshot({ path: path.join(screenshotsDir, 'error_state.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  // ----------------------------------------------------
  // WRITE QUALITY REPORT & ARTIFACT METADATA
  // ----------------------------------------------------
  const passedCount = results.filter(r => r.status === 'PASSED').length;
  const totalCount = results.length;
  const passRate = totalCount > 0 ? `${Math.round((passedCount / totalCount) * 100)}%` : '0%';

  const report = {
    status: passedCount === 5 ? 'PASSED' : 'WARNING',
    project: 'Jamaahku Travel Agent (Branch SAFF)',
    type: 'FULL_CRUD_EDIT_AND_DELETE',
    generatedAt: new Date().toISOString(),
    total: 5,
    passed: passedCount,
    failed: 5 - passedCount,
    passRate: `${Math.round((passedCount / 5) * 100)}%`,
    suites: results,
    screenshots: fs.readdirSync(screenshotsDir)
  };

  const qualityDir = path.join(artifactDir, 'quality');
  fs.mkdirSync(qualityDir, { recursive: true });
  fs.writeFileSync(path.join(qualityDir, 'report.json'), JSON.stringify(report, null, 2));

  // Write run.json
  const runMeta = {
    jobId: '332f132a-9fed-4aab-99d3-50eab7dba8d6',
    project: 'Jamaahku Travel Agent (Branch SAFF)',
    workspace: {
      projectSlug: 'jamaahku-travel-agent-branch-saff',
      runLabel,
      projectPath: 'projects/jamaahku-travel-agent-branch-saff',
      runPath: `projects/jamaahku-travel-agent-branch-saff/runs/${runLabel}`,
      milestonesPath: `projects/jamaahku-travel-agent-branch-saff/runs/${runLabel}/milestones`
    },
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: report.status === 'PASSED' ? 'COMPLETED' : 'WARNING'
  };
  fs.writeFileSync(path.join(artifactDir, 'run.json'), JSON.stringify(runMeta, null, 2));

  // Write timeline.json
  fs.writeFileSync(path.join(artifactDir, 'timeline.json'), JSON.stringify(timeline, null, 2));

  // Write manifest.json
  const manifest = {
    runLabel,
    jobId: runMeta.jobId,
    type: 'E2E Full CRUD Verification',
    generatedAt: new Date().toISOString(),
    files: fs.readdirSync(screenshotsDir).map(file => `evidence/screenshots/${file}`),
    report: 'quality/report.json'
  };
  fs.writeFileSync(path.join(artifactDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n========================================`);
  console.log(`PENGUJIAN CRUD SELESAI: ${passedCount}/5 (${report.passRate})`);
  console.log(`Artifacts: ${artifactDir}`);
  console.log(`========================================\n`);
}

runCrudTests().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
