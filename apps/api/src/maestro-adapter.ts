import { stringify } from 'yaml';
import type { NormalizedFlow } from '@qc/flow-schema';

type Target = { strategy: string; value: string; role?: string; name?: string; exact?: boolean; optional?: boolean };

function maestroTarget(raw?: Target, isOptional = false): Record<string, any> | string | undefined {
  if (!raw) return undefined;
  const opt = raw.optional || isOptional ? { optional: true } : {};
  switch (raw.strategy) {
    case 'text': return { text: raw.value, ...opt };
    case 'id':
    case 'testId':
    case 'accessibilityId': return { id: raw.value, ...opt };
    case 'label': return { text: raw.value, ...opt };
    case 'css': throw new Error('CSS selector tidak dapat dipetakan ke Android. Gunakan resource id atau text native.');
    case 'role': throw new Error('ARIA role web membutuhkan pemetaan selector native sebelum kompilasi Maestro.');
    case 'placeholder': return { text: raw.value, ...opt };
    default: return { text: raw.value, ...opt };
  }
}

export function compileMaestroFlow(flow: NormalizedFlow): string {
  if (flow.target.platform !== 'android' || !flow.target.appId?.trim()) throw new Error('Maestro membutuhkan platform android dan appId.');
  const commands: unknown[] = [];
  for (const step of [...flow.steps, ...flow.cleanup]) {
    const isStepOptional = Boolean(step.optional || (step.target as any)?.optional);
    const target = maestroTarget(step.target as Target | undefined, isStepOptional);
    const value = typeof step.value === 'string' ? step.value : step.value == null ? '' : String(step.value);
    switch (step.action) {
      case 'launchApp':
        // Aplikasi sudah diluncurkan langsung oleh adb runner ke foreground
        break;
      case 'click': commands.push({ tapOn: target }); break;
      case 'input': commands.push({ tapOn: target }, { inputText: value }); break;
      case 'clear': commands.push({ tapOn: target }, { eraseText: 100 }); break;
      case 'back': commands.push({ pressKey: 'BACK' }); break;
      case 'scroll': commands.push('scroll'); break;
      case 'waitFor': commands.push(step.durationMs ? { waitForAnimationToEnd: { timeout: step.durationMs } } : { extendedWaitUntil: { visible: target, timeout: step.timeoutMs } }); break;
      case 'assertVisible': commands.push({ assertVisible: target }); break;
      case 'assertNotVisible': commands.push({ assertNotVisible: target }); break;
      case 'assertText': commands.push({ assertVisible: { text: value } }); break;
      case 'screenshot': commands.push({ takeScreenshot: step.name ?? step.id }); break;
      case 'open':
      case 'assertUrl':
      case 'reload': throw new Error(`action ${step.action} tidak tersedia pada Maestro Android adapter`);
    }
  }
  return stringify({ appId: flow.target.appId, name: flow.name, ...(Object.keys(flow.variables).length ? { env: flow.variables } : {}) }) + '---\n' + stringify(commands, { indentSeq: false });
}
