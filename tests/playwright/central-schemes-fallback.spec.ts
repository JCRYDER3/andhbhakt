/**
 * Smoke cases for Central Schemes offline fallback.
 * Executed by tests/playwright/run-smoke.mjs (playwright-core).
 *
 * 1. /central-schemes with API down → banner + empty state + mock CTA
 * 2. ?mockSchemes=1 → at least one scheme card; search filter works
 */
export const CASES = {
  offline: '/central-schemes',
  mock: '/central-schemes?mockSchemes=1',
} as const;
