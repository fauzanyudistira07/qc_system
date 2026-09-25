# QC Maestro Quality Audit Rules

Quality Audit bersifat audit-only. Runner tidak mengubah source repository, database, atau request mutasi target. Probe negative yang membutuhkan request `POST`, `PUT`, `PATCH`, atau `DELETE` dibatalkan sebelum mencapai target.

## Checkpoint yang dijalankan

- HTTP dan authentication smoke.
- WCAG contrast heuristic, typography, clipping, overlap, dan responsive overflow.
- Accessible name, label association, duplicate `id`, referensi ARIA, `aria-hidden`, focus indicator, dan keyboard traversal.
- Visual regression PNG pixel-by-pixel terhadap baseline per browser, viewport, dan route.
- Table/form dense-data stress dengan data sintetis; default 100 baris dan 240 karakter.
- Empty/invalid form validation.
- Network failure recovery dan double-submit guard menggunakan request abort yang aman.
- Screenshot evidence dan report kategori.

## Visual baseline

Mode `capture` membuat baseline pertama di `.qc-artifacts/baselines/<project>`. Run berikutnya membandingkan setiap screenshot. Mode `required` menggagalkan audit jika baseline belum tersedia. `updateBaseline=true` dipakai hanya setelah perubahan UI memang disetujui.

Contoh gate lokal:

```powershell
$env:QC_REPORT_PATH = '.qc-artifacts/test-runs/<project>/quality/<timestamp>/report.json'
$env:QC_REQUIRE_REPORT = 'true'
$env:QC_ALLOWED_FINDINGS = '0'
npm run qc:gate
```

GitHub Actions tersedia di `.github/workflows/qc-regression-gate.yml`. Gate akan gagal jika jumlah finding melewati `QC_ALLOWED_FINDINGS`.
