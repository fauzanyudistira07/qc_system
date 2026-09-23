export interface TestAttempt {
  id: string;
  attemptNumber: number;
  name: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'PASSED' | 'FAILED';
  isLatest: boolean;
  metrics: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  results: any[];
}

export function groupResultsIntoAttempts(results: any[], flows: any[] = []): TestAttempt[] {
  if (!results || results.length === 0) return [];

  // Urutkan berdasarkan waktu selesai secara kronologis
  const sorted = [...results].sort((a, b) => {
    const tA = new Date(a.finishedAt || 0).getTime();
    const tB = new Date(b.finishedAt || 0).getTime();
    return tA - tB;
  });

  const rawBatches: any[][] = [];
  let currentBatch: any[] = [];
  const seenFlowsInBatch = new Set<string>();
  let lastTimestamp = 0;

  for (const item of sorted) {
    const itemTime = new Date(item.finishedAt || 0).getTime();
    const timeGap = lastTimestamp > 0 ? itemTime - lastTimestamp : 0;
    // Jeda lebih dari 2.5 menit (150 detik) atau flowId sudah pernah muncul dalam batch ini
    const isNewBatch = currentBatch.length > 0 && (seenFlowsInBatch.has(item.flowId) || timeGap > 150000);

    if (isNewBatch) {
      rawBatches.push(currentBatch);
      currentBatch = [];
      seenFlowsInBatch.clear();
    }

    currentBatch.push(item);
    if (item.flowId) seenFlowsInBatch.add(item.flowId);
    lastTimestamp = itemTime;
  }

  if (currentBatch.length > 0) {
    rawBatches.push(currentBatch);
  }

  const totalBatches = rawBatches.length;
  const attempts: TestAttempt[] = rawBatches.map((batch, index) => {
    const attemptNumber = index + 1;
    const isLatest = attemptNumber === totalBatches;

    const firstTime = new Date(batch[0].finishedAt || 0).getTime();
    const lastTime = new Date(batch[batch.length - 1].finishedAt || 0).getTime();
    const totalStepDuration = batch.reduce((sum, r) => {
      const stepSum = (r.steps || []).reduce((s: number, st: any) => s + (st.durationMs || 0), 0);
      return sum + stepSum;
    }, 0);
    const durationMs = Math.max(lastTime - firstTime, totalStepDuration);

    const passed = batch.filter(r => r.status === 'PASSED').length;
    const failed = batch.filter(r => r.status !== 'PASSED').length;
    const total = batch.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const status: 'PASSED' | 'FAILED' = failed === 0 && total > 0 ? 'PASSED' : 'FAILED';

    return {
      id: `attempt-${String(attemptNumber).padStart(3, '0')}`,
      attemptNumber,
      name: `Percobaan #${attemptNumber}${isLatest ? ' (Terbaru)' : ''}`,
      startedAt: new Date(firstTime).toISOString(),
      finishedAt: new Date(lastTime).toISOString(),
      durationMs,
      status,
      isLatest,
      metrics: {
        total,
        passed,
        failed,
        passRate
      },
      results: batch
    };
  });

  // Urutkan dari percobaan terbaru ke terlama agar default menampilkan yang terbaru
  return attempts.reverse();
}
