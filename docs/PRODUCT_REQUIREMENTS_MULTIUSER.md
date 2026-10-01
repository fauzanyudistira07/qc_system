# QC Maestro — Multi-user dan Retention Contract

Dokumen ini menjadi keputusan produk untuk evolusi QC Maestro dari single-user lokal menjadi server multi-user. Target repository tetap read-only; mutation hanya boleh terjadi pada clone/workspace sementara dan database fixture yang dibuat untuk run.

## Keputusan yang sudah disetujui

- Business Flow wajib direview sebelum eksekusi.
- Business Flow dapat diedit user pembuat form sebelum approval.
- Hanya user pembuat run yang boleh approve Business Flow.
- Admin dapat melihat seluruh project, report, evidence, dan audit log, tetapi approval bisnis tetap berasal dari user pemilik run.
- Report disimpan di database agar user dan admin dapat melihatnya dari project context yang sama.
- Screenshot, video, trace, log, report, dan clone mempunyai storage bucket/logical folder yang berbeda.
- Clone repository dipertahankan selama 7 hari secara default.
- Report dan evidence non-clone dipertahankan selama 30 hari secara default.
- Retention dapat diubah melalui konfigurasi admin/server tanpa mengubah source target.
- Maksimal 2 project aktif secara bersamaan.
- Satu project dapat memiliki service frontend dan backend yang dijalankan di sandbox terpisah dalam satu run.

## Policy runtime saat ini

Nilai default sudah disiapkan melalui environment:

```text
QC_MAX_ACTIVE_PROJECTS=2
QC_CLONE_RETENTION_DAYS=7
QC_ARTIFACT_RETENTION_DAYS=30
QC_RETENTION_CLEANUP_INTERVAL_HOURS=6
```

Retention cleanup hanya menyentuh bucket artifact yang dikenal di bawah `ARTIFACT_ROOT`; engine tidak melakukan recursive delete pada workspace source user atau repository asal.

## Kontrak storage database berikutnya

Database server perlu memiliki entity `users`, `projects`, `discovery_runs`, `business_flow_reviews`, `reports`, `evidence_assets`, `artifact_policies`, dan `audit_events`. Password tidak boleh disimpan pada report; credential runtime tetap ephemeral dan hanya diberikan ke runner.

## Batasan keamanan

- Clone dapat berisi konfigurasi project; environment produksi tidak boleh digunakan.
- Token GitHub dan credential integration harus berasal dari secret store server.
- User hanya dapat membaca project/run yang dimilikinya.
- Admin dapat membaca seluruh report/evidence sesuai audit policy.
- Source target tidak pernah ditulis oleh engine.
