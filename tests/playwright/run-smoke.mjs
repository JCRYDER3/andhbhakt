/**
 * Playwright-core smoke test: Central Schemes fallback + mock toggle.
 * Uses system Chrome. Expects the frontend on http://localhost:3100
 * (or BASE_URL). Does not start the API.
 */
import { chromium } from 'playwright-core';

const base = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];

  {
    const page = await browser.newPage();
    page.on('pageerror', (err) => errors.push(`offline pageerror: ${err.message}`));
    await page.goto(`${base}/central-schemes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    const banner = page.getByTestId('schemes-offline-banner');
    const empty = page.getByTestId('schemes-empty-state');
    const cta = page.getByTestId('enable-mock-schemes');
    if (!(await banner.count())) errors.push('expected offline banner on /central-schemes');
    if (!(await empty.count())) errors.push('expected empty state on /central-schemes');
    if (!(await cta.count())) errors.push('expected Load sample schemes CTA');
    const live = await empty.getAttribute('aria-live');
    if (live !== 'polite') errors.push(`empty state aria-live should be polite, got ${live}`);
    await page.close();
  }

  {
    const page = await browser.newPage();
    page.on('pageerror', (err) => errors.push(`mock pageerror: ${err.message}`));
    await page.goto(`${base}/central-schemes?mockSchemes=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(800);
    const cards = page.locator('[data-testid^="card-scheme-"]');
    const cardCount = await cards.count();
    if (cardCount < 1) errors.push('expected at least one scheme card with mockSchemes=1');

    const search = page.getByTestId('input-search-schemes');
    await search.fill('Jal Jeevan');
    await page.waitForTimeout(200);
    const jal = page.locator('[data-testid="card-scheme-jal-jeevan"]');
    if (!(await jal.count())) errors.push('search for Jal Jeevan should keep that card');
    await search.fill('zzzz-no-such-scheme');
    await page.waitForTimeout(200);
    const after = await page.locator('[data-testid^="card-scheme-"]').count();
    if (after !== 0) errors.push('nonsense search should hide all cards');
    const empty = page.getByTestId('schemes-empty-state');
    if (!(await empty.count())) errors.push('filtered-out mock search should show empty status');
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.goto(`${base}/central-schemes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    const cta = page.getByTestId('enable-mock-schemes');
    if (await cta.count()) {
      await cta.click();
      await page.waitForTimeout(400);
      const cards = await page.locator('[data-testid^="card-scheme-"]').count();
      if (cards < 1) errors.push('enable-mock CTA should render sample cards');
    }
    await page.close();
  }

  await browser.close();

  if (errors.length) {
    console.error('FAIL');
    for (const e of errors) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log('PASS central-schemes fallback smoke');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
