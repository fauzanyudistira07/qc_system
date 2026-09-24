# Blueprint Arsitektur & Roadmap Pengembangan QC Maestro (Full-Code / Zero-AI)

Dokumen ini merupakan panduan spesifikasi teknis dan peta pengembangan (*enhancement roadmap*) untuk platform **QC Maestro**. Seluruh fitur dirancang berbasis **100% Full-Code (deterministik murni)** tanpa ketergantungan pada model AI/LLM, sehingga menjamin kecepatan eksekusi milidetik, hasil uji yang konsisten, hemat resource, dan siap diintegrasikan ke lingkungan CI/CD lokal maupun server perusahaan.

---

## 1. Filosofi & Fondasi Arsitektur

QC Maestro menggunakan pola **Canonical Intermediate Representation (IR)**:
```
                       ┌──► Web Adapter ────► Playwright API / .spec.ts (Browser)
[ QC Flow (YAML) ] ────┤
(Canonical Schema)     └──► Mobile Adapter ─► Maestro CLI / ADB (Android Device)
```

* **Keunggulan**: Menulis skenario pengujian satu kali, mengeksekusinya ke berbagai platform dengan kecepatan *native*.
* **Prinsip Utama**:
  1. **Deterministik**: 100% kode berbasis aturan pasti. Jika lolos berarti valid, jika gagal berarti terdapat cacat logika/antarmuka yang terukur.
  2. **Zero-Token Cost**: Tidak memerlukan API key AI, berjalan *offline* tanpa biaya operasional eksternal.
  3. **High-Performance**: Latensi antar-aksi berkisar antara 5–20 milidetik.

---

## 2. Enam Pilar Pengembangan Lanjutan (Full-Code)

### Pilar 1: Cascading Locators / Multi-Selector Fallback (Anti-Flaky)

**Masalah Saat Ini**: Jika sebuah tombol mengalami perubahan teks atau atribut `testId` diubah oleh developer frontend, skrip pengujian langsung gagal (*flaky test*).

**Solusi Teknis**:
Memperluas `locatorSchema` pada `packages/flow-schema` agar mendukung rangkaian prioritas selector berantai (*priority fallback list*):

```yaml
steps:
  - id: submit-button-click
    action: click
    target:
      cascade:
        - testId: btn-submit-order
        - id: submit-button
        - role: button
          name: "Kirim Pengajuan"
        - text: "Kirim"
      timeoutPerCandidateMs: 400
```

**Implementasi Logika pada Adapter**:
```typescript
// Iterasi berantai: jika kandidat pertama timeout/tidak ada, lanjut ke kandidat berikutnya
async function resolveCascadingLocator(page: Page, targets: TargetCandidate[]): Promise<Locator> {
  for (const candidate of targets) {
    try {
      const loc = resolveSingleLocator(page, candidate);
      await loc.waitFor({ state: 'visible', timeout: candidate.timeoutMs ?? 500 });
      return loc; // Ditemukan
    } catch {
      // Lanjut mencoba kandidat selector berikutnya
    }
  }
  throw new Error(`Seluruh kandidat selector gagal ditemukan: ${JSON.stringify(targets)}`);
}
```

---

### Pilar 2: Visual Regression Engine (Pixelmatch Matrix Diffing)

**Tujuan**: Mendeteksi cacat visual (tombol bergeser, CSS rusak, warna tidak sesuai, teks tumpang tindih) secara matematis murni.

**Mekanisme**:
1. Menggunakan pustaka native Node.js: `sharp` (manajemen buffer citra) dan `pixelmatch` (komparasi matriks piksel).
2. Membandingkan screenshot hasil eksekusi (*Current*) dengan screenshot acuan (*Baseline*):
   * Jika perbedaan piksel `<= threshold` (misal 0.05%): **PASSED**.
   * Jika perbedaan piksel `> threshold`: **FAILED**, sistem otomatis menghasilkan berkas `diff.png` dengan arsiran merah pada area yang cacat.

**Implementasi Logika**:
```typescript
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export function compareScreenshots(baselinePath: string, currentPath: string, diffPath: string) {
  const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
  const img2 = PNG.sync.read(fs.readFileSync(currentPath));
  const { width, height } = img1;
  const diff = new PNG({ width, height });

  const numDiffPixels = pixelmatch(
    img1.data, img2.data, diff.data, width, height,
    { threshold: 0.1, diffColor: [255, 0, 0] }
  );

  const diffRatio = numDiffPixels / (width * height);
  if (diffRatio > 0.001) { // Lebih dari 0.1% piksel berubah
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    return { passed: false, diffRatio, diffPath };
  }
  return { passed: true, diffRatio: 0 };
}
```

---

### Pilar 3: Network Interception & API Chaos Testing

**Tujuan**: Menguji ketahanan frontend web/aplikasi ketika backend server mengalami gangguan (error 500, response lambat, atau format JSON tidak valid) tanpa perlu mematikan backend sungguhan.

**Aksi Baru pada QC Flow**:
```yaml
steps:
  - id: mock-server-outage
    action: mockNetwork
    url: "**/api/mobile/absensi/**"
    status: 500
    contentType: "application/json"
    body: '{"status": false, "message": "Internal Server Error"}'

  - id: verify-error-banner
    action: assertVisible
    target:
      text: "Terjadi kesalahan server"
```

**Implementasi pada Playwright Adapter**:
```typescript
case 'mockNetwork':
  await page.route(step.url, route => {
    route.fulfill({
      status: step.status ?? 200,
      contentType: step.contentType ?? 'application/json',
      body: typeof step.body === 'string' ? step.body : JSON.stringify(step.body)
    });
  });
  break;
```

---

### Pilar 4: Hardware & Profiling Metrics Collector

Sistem QC yang matang tidak hanya memverifikasi apakah alur berjalan sukses, tetapi juga memastikan aplikasi tidak rakus memori atau menyebabkan *lag*.

#### A. Sisi Android (Murni Perintah ADB):
* **Memory Heap**: Menjalankan `adb shell dumpsys meminfo <appId>` sebelum dan sesudah alur selesai.
* **Frame Drop (Kelancaran UI)**: Menjalankan `adb shell dumpsys gfxinfo <appId>` untuk membaca metrik *Janky Frames*.

#### B. Sisi Web (Murni Chrome DevTools Protocol):
* **Console Trap**: Menangkap seluruh error JavaScript merah (`console.error`) dan kegagalan network (*unhandled promise rejection*).
* **Performance Timings**: Mengambil metrik navigasi (DNS, DOM Content Loaded, First Contentful Paint) via `page.evaluate(() => window.performance.timing)`.

---

### Pilar 5: Single-File Interactive HTML/PDF Reporter

Setiap kali pengujian selesai dijalankan, runner menghasilkan **satu file laporan HTML mandiri (*standalone*)**:
* Memiliki desain responsif yang rapi dan profesional.
* Seluruh tangkapan layar di-*encode* langsung sebagai `base64`, sehingga file HTML dapat dikirim via WhatsApp/Email tanpa ketergantungan folder gambar eksternal.
* Memuat grafik durasi per tahap (*waterfall chart*), log request-response, dan keterangan kesalahan secara detail.
* Fitur *Export to PDF* langsung menggunakan mode cetak bawaan browser.

---

### Pilar 6: Headless CLI untuk Pipeline CI/CD

Menyediakan antarmuka baris perintah (*CLI binary*) agar QC Maestro dapat langsung dijalankan oleh GitHub Actions, GitLab CI, atau skrip batch lokal:

```bash
# Contoh eksekusi terminal:
npx qc-maestro run ./flows/auth/login.yaml --target=web --headless --exit-code-on-fail
```

**Perilaku Exit Code**:
* `exit 0`: Seluruh skenario pengujian berhasil (`PASSED`).
* `exit 1`: Terdapat asersi yang gagal (`FAILED`) — secara otomatis menggagalkan *pull request* yang bermasalah.
* `exit 2`: Kesalahan infrastruktur / konfigurasi sistem (`INFRA_ERROR`).

---

## 3. Matriks Perbandingan Fitur

| Kebutuhan QC | Tanpa Fitur Ini (Kondisi Awal) | Dengan Fitur Baru (Full-Code) |
|---|---|---|
| **Perubahan ID/Label Tombol** | Tes langsung *fail* / merah | Lolos berkat *Cascading Locators* |
| **Pengecekan Tampilan Rusak** | Tidak terdeteksi jika elemen masih ada di DOM | Terdeteksi via *Pixelmatch Diffing* |
| **Server Backend Down/Mati** | Tes web macet dan menghasilkan *timeout* | Teruji secara deterministik via *Network Mocking* |
| **Penggunaan RAM Aplikasi** | Harus dipantau manual lewat Task Manager / Profiler | Tercatat otomatis per pengujian via ADB/CDP |
| **Berbagi Hasil Uji ke Tim** | Harus menyalakan server dashboard web | Cukup kirim file *Standalone HTML Report* |
| **Otomasi di Git / CI-CD** | Masih bergantung pada penekanan tombol di web UI | Berjalan otomatis setiap kali ada *commit* baru |

---

## 4. Jadwal & Urutan Implementasi yang Disarankan

1. **Tahap 1 (Stabilitas Dasar)**: Implementasikan *Cascading Locators* di `packages/flow-schema` dan `playwright-adapter.ts`.
2. **Tahap 2 (Pelaporan)**: Bangun generator *Single-File Interactive HTML Report* di `apps/api/src/report/`.
3. **Tahap 3 (Ketahanan Jaringan)**: Tambahkan aksi `mockNetwork` pada Playwright adapter untuk pengujian skenario error.
4. **Tahap 4 (Kualitas Visual)**: Integrasikan `pixelmatch` ke dalam artefak run untuk *Visual Regression Testing*.
5. **Tahap 5 (Metrik & CI/CD)**: Tambahkan pengumpulan profil memori ADB dan buat *CLI wrapper* untuk integrasi pipeline otomatis.

---
*Dokumen dirancang untuk implementasi teknis platform QC Maestro — Solu Digital Ecosystem.*
