import type { DiscoveryJob } from '../discovery/types.ts';
import { groupResultsIntoAttempts, type TestAttempt } from './attempt-grouper.ts';
import type { BusinessFlowMap } from '../discovery/business-flow.ts';

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
    featureContracts?: {
      total: number;
      readyForReview: number;
      requiresReview: number;
      candidate: number;
      scenarioTotals: Record<string, number>;
      contracts: Array<{ id: string; capabilityId: string; label: string; status: string; confidence: number; routes: string[]; apiRoutes: string[]; scenarioCount: number; limitations: string[] }>;
      limitations: string[];
    };
    businessFlows?: Pick<BusinessFlowMap, 'version' | 'generatedAt' | 'status' | 'productProfile' | 'summary' | 'limitations'> & { flows: BusinessFlowMap['flows'] };
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
      videos: Array<{
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
      const steps = (r.steps || []).map((s: any) => {
        const rawMsg = s.errorMessage || '';
        const lowerMsg = rawMsg.toLowerCase();
        const isEngine = s.errorOrigin === 'qc_maestro_engine' ||
          r.status === 'INFRA_ERROR' ||
          lowerMsg.includes('driver error') ||
          lowerMsg.includes('playwright internal') ||
          lowerMsg.includes('spawn enoent') ||
          lowerMsg.includes('socket hang up') ||
          lowerMsg.includes('daemon crashed') ||
          lowerMsg.includes('runner internal');
        const errorOrigin = s.status === 'FAILED' ? (isEngine ? 'qc_maestro_engine' : 'user_target_application') : undefined;

        return {
          action: s.action || '',
          status: s.status || '',
          durationMs: s.durationMs || 0,
          errorMessage: s.errorMessage || undefined,
          errorOrigin
        };
      });
      const totalDuration = steps.reduce((sum: number, s: any) => sum + s.durationMs, 0);

      const screenshots: Array<{ name: string; path: string; url: string }> = [];
      const videos: Array<{ name: string; path: string; url: string }> = [];
      const logs: Array<{ name: string; path: string; url: string }> = [];

      for (const a of r.artifacts || []) {
        const aPath = typeof a === 'string' ? a : a.path || '';
        const aName = typeof a === 'string' ? a.split(/[/\\]/).pop() || 'artifact' : a.name || aPath.split(/[/\\]/).pop() || 'artifact';
        
        // Bersihkan path relatif dari root artifact job agar valid di browser
        const jobMarker = `/jobs/${job.id}/`;
        const normalized = aPath.replace(/\\/g, '/');
        const markerIdx = normalized.indexOf(jobMarker);
        const relPath = markerIdx !== -1 
          ? normalized.slice(markerIdx + jobMarker.length) 
          : normalized.split('/').slice(-2).join('/');
        const cleanRel = relPath.replace(/^\/+/, '');

        const item = {
          name: aName,
          path: cleanRel,
          url: `${artifactPrefix}${cleanRel}`
        };
        const lower = cleanRel.toLowerCase();
        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || (typeof a !== 'string' && (a as any).type === 'video')) {
          videos.push(item);
        } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || (typeof a !== 'string' && (a as any).type === 'screenshot')) {
          screenshots.push(item);
        } else {
          logs.push(item);
        }
      }

      const hasFailedStep = steps.some((s: any) => s.status === 'FAILED');
      const isEngineFlow = r.status === 'INFRA_ERROR' || steps.some((s: any) => s.errorOrigin === 'qc_maestro_engine');
      const errorOrigin = (r.status !== 'PASSED' || hasFailedStep)
        ? (isEngineFlow ? 'qc_maestro_engine' : 'user_target_application')
        : undefined;

      return {
        flowId: r.flowId,
        flowName: flowDef?.name || r.flowId,
        status: r.status,
        errorOrigin,
        runId: r.runId,
        finishedAt: r.finishedAt,
        durationMs: totalDuration,
        steps,
        screenshots,
        videos,
        logs
      };
    });

    const userAppErrors = flows.filter(f => f.errorOrigin === 'user_target_application').length;
    const qcEngineErrors = flows.filter(f => f.errorOrigin === 'qc_maestro_engine').length;

    return {
      id: att.id,
      attemptNumber: att.attemptNumber,
      name: att.name,
      status: att.status,
      isLatest: att.isLatest,
      startedAt: att.startedAt,
      finishedAt: att.finishedAt,
      durationMs: att.durationMs,
      metrics: {
        ...att.metrics,
        userAppErrors,
        qcEngineErrors
      },
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
      featureContracts: job.inventory?.featureContractPlan ? {
        total: job.inventory.featureContractPlan.total,
        readyForReview: job.inventory.featureContractPlan.readyForReview,
        requiresReview: job.inventory.featureContractPlan.requiresReview,
        candidate: job.inventory.featureContractPlan.candidate,
        scenarioTotals: job.inventory.featureContractPlan.scenarioTotals,
        contracts: job.inventory.featureContractPlan.contracts.map((contract) => ({
          id: contract.id,
          capabilityId: contract.capabilityId,
          label: contract.label,
          status: contract.status,
          confidence: contract.confidence,
          routes: contract.routes,
          apiRoutes: contract.apiRoutes,
          scenarioCount: contract.scenarios.length,
          limitations: contract.limitations,
        })),
        limitations: job.inventory.featureContractPlan.limitations,
      } : undefined,
      businessFlows: job.businessFlowMap,
    },
    filterApplied: {
      attempt: options?.attempt || 'all',
      status: options?.status || 'all'
    },
    attempts: structuredAttempts
  };
}
