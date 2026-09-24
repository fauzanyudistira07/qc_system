import { parse } from 'yaml';
import { z } from 'zod';

export const platformSchema = z.enum(['web', 'android']);
export const actionSchema = z.enum([
  'open', 'launchApp', 'click', 'input', 'clear', 'back', 'scroll',
  'waitFor', 'assertVisible', 'assertNotVisible', 'assertText',
  'assertUrl', 'screenshot', 'reload'
]);

export const locatorSchema = z.object({
  strategy: z.enum(['text', 'id', 'testId', 'css', 'role', 'label', 'placeholder', 'accessibilityId']),
  value: z.string().min(1),
  role: z.string().optional(),
  name: z.string().optional(),
  exact: z.boolean().optional(),
  optional: z.boolean().optional()
}).superRefine((locator, ctx) => {
  if (locator.strategy === 'role' && !locator.role) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'role locator membutuhkan field role' });
  }
});

export const targetSchema = z.union([
  locatorSchema,
  z.object({
    text: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    testId: z.string().min(1).optional(),
    selector: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    placeholder: z.string().min(1).optional(),
    accessibilityId: z.string().min(1).optional(),
    optional: z.boolean().optional()
  }).refine((target) => Object.values(target).some(Boolean), 'target tidak boleh kosong')
]);

export type FlowStep = {
  id?: string;
  action: z.infer<typeof actionSchema>;
  target?: z.infer<typeof targetSchema>;
  url?: string;
  value?: unknown;
  name?: string;
  optional?: boolean;
  timeoutMs?: number;
  durationMs?: number;
};

export const stepSchema: z.ZodType<FlowStep> = z.object({
  id: z.string().min(1).optional(),
  action: actionSchema,
  target: targetSchema.optional(),
  url: z.string().optional(),
  value: z.unknown().optional(),
  name: z.string().optional(),
  optional: z.boolean().optional(),
  timeoutMs: z.number().int().positive().max(300_000).optional(),
  durationMs: z.number().int().nonnegative().max(300_000).optional()
}) as z.ZodType<FlowStep>;

export const flowSchema = z.object({
  schemaVersion: z.string().default('1.0'),
  version: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  metadata: z.object({
    code: z.string().optional(),
    owner: z.string().optional(),
    tags: z.array(z.string()).default([])
  }).optional(),
  target: z.object({
    platform: platformSchema,
    targetId: z.string().optional(),
    environment: z.string().optional(),
    baseUrl: z.string().url().optional(),
    appId: z.string().optional(),
    browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).optional()
  }),
  variables: z.record(z.unknown()).default({}),
  execution: z.object({
    timeoutMs: z.number().int().positive().max(600_000).default(30_000),
    retries: z.number().int().min(0).max(5).default(0),
    screenshot: z.enum(['off', 'always', 'on-failure']).default('on-failure'),
    trace: z.enum(['off', 'on', 'retain-on-failure']).default('retain-on-failure'),
    video: z.enum(['off', 'on', 'retain-on-failure']).default('retain-on-failure')
  }).default({}),
  steps: z.array(stepSchema).min(1),
  cleanup: z.array(stepSchema).optional()
}).superRefine((flow, ctx) => {
  flow.steps.forEach((step, index) => {
    if (step.action === 'open' && !step.url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index, 'url'], message: 'action open membutuhkan url' });
    }
    if (['click', 'input', 'clear', 'assertVisible', 'assertNotVisible', 'assertText'].includes(step.action) && !step.target) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index, 'target'], message: `${step.action} membutuhkan target` });
    }
    if (flow.target.platform === 'web' && step.target && 'strategy' in step.target && step.target.strategy === 'accessibilityId') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index, 'target'], message: 'accessibilityId belum didukung untuk web adapter' });
    }
    if (flow.target.platform === 'android' && step.action === 'open') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index], message: 'action open hanya untuk web; gunakan launchApp untuk Android' });
    }
  });
});

export type QCFlow = z.infer<typeof flowSchema>;
export type NormalizedFlow = Omit<QCFlow, 'steps' | 'cleanup'> & {
  steps: Array<FlowStep & { id: string; timeoutMs: number; target?: { strategy: string; value: string; role?: string; name?: string; exact?: boolean } }>;
  cleanup: Array<FlowStep & { id: string; timeoutMs: number; target?: { strategy: string; value: string; role?: string; name?: string; exact?: boolean } }>;
};

export type FlowValidation = {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  flow?: QCFlow;
  normalized?: NormalizedFlow;
};

function issuePath(path: PropertyKey[]): string {
  return path.length ? path.map(String).join('.') : 'flow';
}

function normalizeTarget(target: any): { strategy: string; value: string; role?: string; name?: string; exact?: boolean } | undefined {
  if (!target) return undefined;
  if ('strategy' in target && target.strategy) {
    return {
      strategy: String(target.strategy),
      value: String(target.value || ''),
      role: target.role,
      name: target.name,
      exact: target.exact
    };
  }
  if (target.testId) return { strategy: 'testId', value: String(target.testId) };
  if (target.selector) return { strategy: 'css', value: String(target.selector) };
  if (target.label) return { strategy: 'label', value: String(target.label) };
  if (target.placeholder) return { strategy: 'placeholder', value: String(target.placeholder) };
  if (target.accessibilityId) return { strategy: 'accessibilityId', value: String(target.accessibilityId) };
  if (target.id) return { strategy: 'id', value: String(target.id) };
  return { strategy: 'text', value: String(target.text ?? '') };
}

export function normalizeFlow(flow: QCFlow): NormalizedFlow {
  const defaultTimeout = flow.execution.timeoutMs;
  const normalizeSteps = (steps: FlowStep[] | undefined, prefix: string) => (steps ?? []).map((step, index) => ({
    ...step,
    id: step.id ?? `${prefix}-${String(index + 1).padStart(3, '0')}`,
    target: normalizeTarget(step.target),
    timeoutMs: step.timeoutMs ?? defaultTimeout
  }));
  return { ...flow, steps: normalizeSteps(flow.steps, 'step') as any, cleanup: normalizeSteps(flow.cleanup, 'cleanup') as any };
}

export function validateFlow(source: string | unknown): FlowValidation {
  try {
    const parsed = typeof source === 'string' ? parse(source) : source;
    const result = flowSchema.safeParse(parsed);
    if (!result.success) return { valid: false, errors: result.error.issues.map((issue) => ({ path: issuePath(issue.path), message: issue.message })) };
    return { valid: true, errors: [], flow: result.data, normalized: normalizeFlow(result.data) };
  } catch (error) {
    return { valid: false, errors: [{ path: 'yaml', message: error instanceof Error ? error.message : 'YAML tidak valid' }] };
  }
}
