import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

export type RetentionPolicy = {
  enabled: boolean;
  cloneDays: number;
  artifactDays: number;
  cleanupIntervalHours: number;
  maxActiveProjects: number;
};

const integerEnv = (name: string, fallback: number, min: number, max: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
};

export function runtimePolicy(): RetentionPolicy {
  return {
    enabled: process.env.QC_RETENTION_ENABLED !== 'false',
    cloneDays: integerEnv('QC_CLONE_RETENTION_DAYS', 7, 1, 365),
    artifactDays: integerEnv('QC_ARTIFACT_RETENTION_DAYS', 30, 1, 3650),
    cleanupIntervalHours: integerEnv('QC_RETENTION_CLEANUP_INTERVAL_HOURS', 6, 1, 168),
    maxActiveProjects: integerEnv('QC_MAX_ACTIVE_PROJECTS', 2, 1, 2),
  };
}

async function removeExpiredChildren(root: string, cutoff: number, label: string): Promise<string[]> {
  const removed: string[] = [];
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return removed; }
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    try {
      const metadata = await stat(target);
      if (metadata.mtimeMs >= cutoff) continue;
      await rm(target, { recursive: entry.isDirectory(), force: true });
      removed.push(`${label}/${entry.name}`);
    } catch { /* A concurrent run may have removed or locked the item. */ }
  }
  return removed;
}

/**
 * Retention is deliberately scoped to known artifact buckets. It never walks
 * the workspace root or the user's source repository.
 */
export async function cleanupRetention(artifactRoot: string, policy = runtimePolicy()): Promise<{ removed: string[]; policy: RetentionPolicy }> {
  if (!policy.enabled) return { removed: [], policy };
  const now = Date.now();
  const removed = [
    ...(await removeExpiredChildren(path.join(artifactRoot, 'clones'), now - policy.cloneDays * 86_400_000, 'clones')),
    ...(await removeExpiredChildren(path.join(artifactRoot, 'projects'), now - policy.artifactDays * 86_400_000, 'projects')),
    ...(await removeExpiredChildren(path.join(artifactRoot, 'jobs'), now - policy.artifactDays * 86_400_000, 'jobs')),
    ...(await removeExpiredChildren(path.join(artifactRoot, 'test-runs'), now - policy.artifactDays * 86_400_000, 'test-runs')),
    ...(await removeExpiredChildren(path.join(artifactRoot, 'runs'), now - policy.artifactDays * 86_400_000, 'runs')),
  ];
  return { removed, policy };
}
