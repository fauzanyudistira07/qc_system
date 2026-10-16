# Aturan Otomatis Push GitHub (QC Maestro)

Khusus untuk repository **QC Maestro** (`qc_system`):
- Setiap kali selesai melakukan update, perbaikan, atau penambahan kode, agent **WAJIB** langsung melakukan `git add`, `git commit` dengan pesan yang deskriptif, dan `git push origin main`.
- Token dan kredensial remote origin menggunakan URL yang sudah terkonfigurasi di `.git/config` atau `GITHUB_TOKEN` dari `.env`.
