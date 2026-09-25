import type { DiscoveryJob } from '../discovery/types.ts';
import { groupResultsIntoAttempts, type TestAttempt } from './attempt-grouper.ts';

export interface StructuredJsonReport {
  reportVersion: string;
  generatedAt: string;
  target: {
    jobId: string;
    name: string;
    platform: string;
    appId?: string;
    deviceId?: string;
    baseUrl?: string;
    repositoryUrl?: string;
    status: string;
    createdAt: string;
    finishedAt?: string;
  };
  summary: {
    totalAttempts: number;
    latestAttempt: {
      attemptNumber: number;
      status: string;
      total: number;
      passed: number;
      failed: number;
      passRate: string;
      durationFormatted: string;
      finishedAt: string;
    };
    overallHealthScore: number;
    crud?: {
      resources: number;
      available: number;
      planned: number;
      requiresFixture: number;
      matrix: Array<{ resource: string; routes: string[]; operations: Record<string, string>; confidence: number }>;
      limitations: string[];
    };
    roleAction?: {
      roles: string[];
      rows: number;
      expected: number;
      candidate: number;
      runtime: number;
      limitations: string[];
    };
  };
  filterApplied?: {
    attempt?: string;
    status?: string;
  };
  attempts: Array<{
    id: string;
    attemptNumber: number;
    name: string;
    status: string;
    isLatest: boolean;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    metrics: {
      total: number;
      passed: number;
      failed: number;
      passRate: number;
    };
    flows: Array<{
      flowId: string;
      flowName: string;
      status: string;
      runId: string;
      finishedAt: string;
      durationMs: number;
      steps: Array<{
        action: string;
        status: string;
        durationMs: number;
        errorMessage?: string;
      }>;
      screenshots: Array<{
        name: string;
        path: string;
        url: string;
      }>;
      logs: Array<{
        name: string;
        path: string;
        url: string;
      }>;
    }>;
  }>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function buildJsonReport(
  job: DiscoveryJob,
  artifactPrefix = '',
  options?: { attempt?: string; status?: string }
): StructuredJsonReport {
  const attempts = groupResultsIntoAttempts(job.results, job.flows);
  const latest = attempts[0]; // attempts sorted newest first

  let filteredAttempts = [...attempts];
  if (options?.attempt && options.attempt !== 'all') {
    if (options.attempt === 'latest') {
      filteredAttempts = latest ? [latest] : [];
    } else {
      const num = parseInt(options.attempt, 10);
      if (!isNaN(num)) {
        filteredAttempts = attempts.filter(a => a.attemptNumber === num);
      } else {
        filteredAttempts = attempts.filter(a => a.id === options.attempt);
      }
    }
  }

  const structuredAttempts = filteredAttempts.map(att => {
    let results = att.results;
    if (options?.status && options.status !== 'all') {
      results = results.filter(r => r.status === options.status);
    }

    const flows = results.map(r => {
      const flowDef = job.flows.find(f => f.id === r.flowId);
      const steps = (r.steps || []).map((s: any) => ({
        action: s.action || '',
        status: s.status || '',
        durationMs: s.durationMs || 0,
        errorMessage: s.errorMessage || undefined
      }));
      const totalDuration = steps.reduce((sum: number, s: any) => sum + s.durationMs, 0);

      const screenshots: Array<{ name: string; path: string; url: string }> = [];
      const logs: Array<{ name: string; path: string; url: string }> = [];

      for (const a of r.artifacts || []) {
        const aPath = typeof a === 'string' ? a : a.path || '';
        const aName = typeof a === 'string' ? a.split(/[/\\]/).pop() || 'artifact' : a.name || aPath.split(/[/\\]/).pop() || 'artifact';
        const item = {
          name: aName,
          path: aPath,
          url: `${artifactPrefix}${aPath}`
        };
        if (aPath.toLowerCase().endsWith('.png') || aPath.toLowerCase().endsWith('.jpg') || (typeof a !== 'string' && a.type === 'screenshot')) {
          screenshots.push(item);
        } else {
          logs.push(item);
        }
      }

      return {
        flowId: r.flowId,
        flowName: flowDef?.name || r.flowId,
        status: r.status,
        runId: r.runId,
        finishedAt: r.finishedAt,
        durationMs: totalDuration,
        steps,
        screenshots,
        logs
      };
    });

    return {
      id: att.id,
      attemptNumber: att.attemptNumber,
      name: att.name,
      status: att.status,
      isLatest: att.isLatest,
      startedAt: att.startedAt,
      finishedAt: att.finishedAt,
      durationMs: att.durationMs,
      metrics: att.metrics,
      flows
    };
  });

  const latestStats = latest ? {
    attemptNumber: latest.attemptNumber,
    status: latest.status,
    total: latest.metrics.total,
    passed: latest.metrics.passed,
    failed: latest.metrics.failed,
    passRate: `${latest.metrics.passRate}%`,
    durationFormatted: formatDuration(latest.durationMs),
    finishedAt: latest.finishedAt
  } : {
    attemptNumber: 0,
    status: 'UNKNOWN',
    total: 0,
    passed: 0,
    failed: 0,
    passRate: '0%',
    durationFormatted: '0s',
    finishedAt: new Date().toISOString()
  };

  return {
    reportVersion: '2.0.0',
    generatedAt: new Date().toISOString(),
    target: {
      jobId: job.id,
      name: job.name,
      platform: job.config.platform,
      appId: job.config.appId,
      deviceId: job.config.deviceId,
      baseUrl: job.config.baseUrl,
      repositoryUrl: job.config.repositoryUrl,
      status: job.status,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt
    },
    summary: {
      totalAttempts: attempts.length,
      latestAttempt: latestStats,
      overallHealthScore: latest ? latest.metrics.passRate : 0,
      crud: job.inventory?.crudPlan ? {
        ...job.inventory.crudPlan.totals,
        matrix: job.inventory.crudPlan.resources.map((resource) => ({
          resource: resource.name,
          routes: resource.routes,
          operations: resource.operations,
          confidence: resource.confidence,
        })),
        limitations: job.inventory.crudPlan.limitations,
      } : undefined,
      roleAction: job.inventory?.roleActionPlan ? {
        roles: job.inventory.roleActionPlan.roles,
        ...job.inventory.roleActionPlan.totals,
        limitations: job.inventory.roleActionPlan.limitations,
      } : undefined,
    },
    filterApplied: {
      attempt: options?.attempt || 'all',
      status: options?.status || 'all'
    },
    attempts: structuredAttempts
  };
}
