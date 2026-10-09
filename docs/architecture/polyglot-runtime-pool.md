# QC Maestro — Universal Polyglot Runtime & Dependency Matrix

> Rencana Implementasi: On-Demand Dynamic Runtime & Dependency Pooling untuk Proyek Multi-Bahasa di QC Maestro.

---

## 1. Tujuan
Mendukung eksekusi pengujian otomatis untuk berbagai proyek yang di-clone dari Git tanpa perlu menginstall berbagai runtime dan SDK di host Windows. Setiap proyek akan otomatis terdeteksi bahasa, framework, dan versinya, lalu dieksekusi di dalam container yang sesuai dengan caching dependensi bersama.

---

## 2. Matriks Deteksi Ekosistem

| Bahasa / Framework | Indikator Manifest | Target Runtime Image | Cache Volume | Perintah Uji Default |
| :--- | :--- | :--- | :--- | :--- |
| **PHP (Laravel / Symfony)** | `composer.json` | `qc-runtime:php-8.0` s/d `8.3` | `qc-composer-cache` | `composer install && php artisan test` |
| **Node.js (JS / TS)** | `package.json`, `.nvmrc` | `node:18`, `20`, `22-alpine` | `qc-npm-cache` | `npm ci && npm test` |
| **Python (Django / FastAPI)** | `pyproject.toml`, `requirements.txt` | `python:3.10`, `3.11`, `3.12-slim`| `qc-pip-cache` | `pip install -r requirements.txt && pytest` |
| **Go (Golang)** | `go.mod` | `golang:1.21`, `1.22-alpine` | `qc-go-cache` | `go test ./...` |
| **Java / Kotlin** | `pom.xml`, `build.gradle` | `eclipse-temurin:17`, `21-jdk` | `qc-maven-cache` / `gradle` | `mvn test` / `./gradlew test` |
| **.NET / C#** | `*.csproj`, `*.sln` | `mcr.microsoft.com/dotnet/sdk:8.0` | `qc-nuget-cache` | `dotnet test` |
| **Custom Dockerfile** | `Dockerfile` | Custom built image | Docker layer cache | Sesuai ENTRYPOINT |

---

## 3. Alur Kerja Sistem (Pipeline)

1. **Manifest Scan (`detector.ts`)**:
   Membaca root repositori proyek dan mendeteksi bahasa utama beserta target versi (semver parsing).
2. **Runtime Provisioner (`image-provisioner.ts`)**:
   - Memeriksa ketersediaan Docker image di lokal (`docker image inspect`).
   - Jika belum ada, download image resmi atau build Dockerfile template ringan (Alpine). Image disimpan permanen di host Docker.
3. **Dependency Injection & Shared Cache (`project-runner.ts`)**:
   - Menjalankan container dengan mount folder proyek `.qc-workspaces/<job-id>` ke `/workspace`.
   - Menghubungkan named volume cache yang sesuai (`qc-*-cache`).
4. **Execution & Report Collection**:
   - Menangkap stdout/stderr, exit code, dan artifact test result (JUnit XML / coverage).
   - Menyimpan hasil ke database QC Maestro.

---

## 4. Struktur Modul Backend
Direktori: `apps/api/src/runtimes/`
- `detector.ts`
- `stack-definitions.ts`
- `image-provisioner.ts`
- `polyglot-runner.ts`
