# CRUD Mutation Fixture Contract

Mutation CRUD hanya dijalankan jika konfigurasi quality audit menunjuk ke file ini dan file menyatakan `allowMutations: true`. Target harus berupa environment test/staging yang dapat di-reset.

```json
{
  "version": "1.0",
  "allowMutations": true,
  "login": {
    "path": "/login",
    "emailSelector": "input[name=email]",
    "passwordSelector": "input[name=password]",
    "submitSelector": "button[type=submit]",
    "successUrl": "/dashboard"
  },
  "scenarios": [
    {
      "id": "crud-create-product",
      "label": "Create product",
      "operation": "create",
      "steps": [
        { "action": "open", "url": "/products/new" },
        { "action": "input", "target": { "strategy": "label", "value": "Name" }, "value": "QC Fixture Product" },
        { "action": "click", "target": { "strategy": "role", "role": "button", "name": "Save" } },
        { "action": "assertVisible", "target": { "strategy": "text", "value": "QC Fixture Product" } }
      ],
      "cleanup": [
        { "action": "open", "url": "/products" }
      ]
    }
  ]
}
```

Supported actions: `open`, `click`, `input`, `clear`, `assertVisible`, `assertNotVisible`, `assertText`, `assertUrl`, `reload`, dan `wait`.

Gunakan scenario id seperti `crud-duplicate-record` dan `crud-delete-in-use` agar hasilnya otomatis dipetakan ke negative testing capability plan. `cleanup` wajib disediakan untuk setiap scenario yang membuat atau mengubah data. Mutation runner akan menggagalkan report jika cleanup tidak ada atau cleanup gagal.

Untuk CI, gunakan `npm run qc:ci` dengan `QC_REPORT_PATH` dan `QC_ALLOWED_FINDINGS`. Artifact lama dapat dibersihkan dengan `npm run qc:retain`; atur `QC_RETENTION_DAYS` dan `QC_RETENTION_KEEP_RUNS` sesuai kebijakan. Cleanup hanya menghapus run di bawah artifact root.
