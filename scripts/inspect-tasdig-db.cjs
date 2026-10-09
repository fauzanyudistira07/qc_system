const fs = require('fs');
const { execSync } = require('child_process');

const phpScript = `<?php
require 'C:/Users/admin/Documents/PKL- SOLU/taskia_digital/tasdig_dashboard/vendor/autoload.php';
$app = require_once 'C:/Users/admin/Documents/PKL- SOLU/taskia_digital/tasdig_dashboard/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use App\\Models\\TasdigHapalan;

echo "=== HAPALAN SISWA ID: 2 ===\\n";
$hapalans = TasdigHapalan::where('siswa_id', 2)->get();
foreach ($hapalans as $h) {
    echo "ID: {$h->id} | Tanggal: {$h->tanggal} | Tipe: {$h->tipe} | Status: {$h->status} | Nilai: {$h->nilai}\\n";
}
`;

fs.writeFileSync('C:/Users/admin/Documents/PKL- SOLU/taskia_digital/tasdig_dashboard/check_data.php', phpScript);
try {
  const out = execSync('php check_data.php', { cwd: 'C:/Users/admin/Documents/PKL- SOLU/taskia_digital/tasdig_dashboard' }).toString();
  console.log(out);
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
} finally {
  try { fs.unlinkSync('C:/Users/admin/Documents/PKL- SOLU/taskia_digital/tasdig_dashboard/check_data.php'); } catch {}
}
