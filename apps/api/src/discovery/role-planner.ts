import type { InventoryPage } from './source-scanner.ts';

export type RoleActionExpectation = 'EXPECTED' | 'CANDIDATE' | 'REQUIRES_RUNTIME';
export type RoleActionRow = { role: string; page: string; authentication: string; actions: string[]; expectation: RoleActionExpectation; checks: string[] };
export type RoleActionPlan = { version: '1.0'; generatedAt: string; roles: string[]; rows: RoleActionRow[]; totals: { rows: number; expected: number; candidate: number; runtime: number }; limitations: string[] };

export function buildRoleActionPlan(input: { pages: InventoryPage[]; accounts: Array<{ role?: string }> }): RoleActionPlan {
  const roles = [...new Set(input.accounts.map((account) => account.role?.trim()).filter(Boolean) as string[])];
  if (!roles.length) roles.push('tester');
  const rows: RoleActionRow[] = [];
  for (const page of input.pages) {
    const actions = [...new Set((page.elements ?? []).filter((element) => ['button', 'link', 'a', 'input', 'select', 'textarea'].includes(element.type)).map((element) => element.name).filter(Boolean))].slice(0, 30);
    if (!actions.length) continue;
    for (const role of roles) {
      const auth = page.authentication || 'unknown';
      const sameRole = auth === `authenticated:${role}` || auth === 'public';
      const knownRole = auth.startsWith('authenticated:') || auth.startsWith('source-');
      rows.push({
        role, page: page.path, authentication: auth, actions,
        expectation: auth === 'public' ? 'EXPECTED' : sameRole ? 'EXPECTED' : knownRole ? 'CANDIDATE' : 'REQUIRES_RUNTIME',
        checks: ['visible action matches role', 'disabled/hidden action cannot be invoked', 'direct route/API returns expected authorization', 'no cross-role data leakage'],
      });
    }
  }
  return {
    version: '1.0', generatedAt: new Date().toISOString(), roles, rows,
    totals: {
      rows: rows.length,
      expected: rows.filter((row) => row.expectation === 'EXPECTED').length,
      candidate: rows.filter((row) => row.expectation === 'CANDIDATE').length,
      runtime: rows.filter((row) => row.expectation === 'REQUIRES_RUNTIME').length,
    },
    limitations: ['Static discovery cannot prove server-side authorization.', 'Each configured role needs a runtime session to verify hidden, disabled, direct URL, and API behavior.'],
  };
}
