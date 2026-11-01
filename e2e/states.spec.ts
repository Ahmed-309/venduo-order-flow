import { expect, test, type Page } from '@playwright/test';
import { loadFixture, setFaults, startDraft } from './helpers';

test('My orders: empty', async ({ page }) => {
  await page.goto('/orders');
  await expect(page.getByText('No tech packs yet')).toBeVisible();
  await page.getByRole('link', { name: 'Choose a style' }).click();
  await page.waitForURL(/\/$/);
});

test('My orders: partial tells you what is next', async ({ page }) => {
  await loadFixture(page, 'Partial');
  await expect(page.getByRole('link', { name: /Campus hoodie/ })).toContainText('Next: Add at least one body fabric.');
  await expect(page.getByText('Nothing sent yet.')).toBeVisible();
});

test('My orders: populated shows every record with its status', async ({ page }) => {
  await loadFixture(page, 'Populated');
  const packs = page.getByRole('region', { name: 'Tech packs' });
  await expect(packs.getByRole('listitem')).toHaveCount(4);
  await expect(packs.getByText('Draft')).toHaveCount(3);
  await expect(packs.getByText('Quote requested')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Quote requests' }).getByText('QR-0001')).toBeVisible();
});

test('loading shows skeletons, then the content', async ({ page }) => {
  await page.goto('/orders');
  await setFaults(page, { delayMs: 1500 });
  await page.reload();
  await expect(page.getByRole('status', { name: 'Loading your tech packs' })).toBeVisible();
  await expect(page.getByText('No tech packs yet')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('status', { name: 'Loading your tech packs' })).toHaveCount(0);
});

const SCREENS: [string, string, string][] = [
  ['Choose a style', '/', "We couldn't load the styles."],
  ['My orders', '/orders', "We couldn't load your tech packs."],
  ['Tech pack', '/tech-packs/any', "We couldn't load this tech pack."],
  ['Request a quote', '/quote', "We couldn't load your quote request."],
  ['Confirmation', '/quote/confirmation/any', "We couldn't load your confirmation."],
];

for (const [name, path, message] of SCREENS) {
  test(`${name}: a load failure offers a working retry`, async ({ page }) => {
    await page.goto('/');
    await setFaults(page, { failReads: true });
    await page.goto(path);
    await expect(page.getByText(message)).toBeVisible();
    await setFaults(page, {});
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText(message)).toHaveCount(0);
  });
}

test('starting a draft can fail and be retried', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^T-shirt/ })).toBeEnabled();
  await setFaults(page, { failWrites: true });
  await page.getByRole('button', { name: /^T-shirt/ }).click();
  await expect(page.getByText(/couldn't start your tech pack/)).toBeVisible();
  await setFaults(page, {});
  await page.getByRole('button', { name: /^T-shirt/ }).click();
  await page.waitForURL(/\/tech-packs\//);
});

/** Nothing may push the page sideways, and every control must be big enough to tap. */
async function checkLayout(page: Page) {
  const report = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const small = [...document.querySelectorAll<HTMLElement>('button, a.btn, a.nav-link, select, input:not(.visually-hidden), textarea, .choice-pill')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && !element.closest('[hidden]') && box.height < 44 && element.getAttribute('type') !== 'checkbox';
      })
      .map((element) => `${element.tagName}:${element.textContent?.slice(0, 30) ?? ''}`);
    const tinyText = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.childNodes.length > 0 && parseFloat(getComputedStyle(element).fontSize) < 12)
      .map((element) => element.tagName);
    return { overflow, small, tinyText };
  });
  expect(report.overflow, 'horizontal overflow').toBeLessThanOrEqual(0);
  expect(report.small, 'touch targets under 44px').toEqual([]);
  expect(report.tinyText, 'text under 12px').toEqual([]);
}

test('every screen fits, with big enough targets, at this viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Hoodie/ })).toBeVisible();
  await checkLayout(page);

  await loadFixture(page, 'Populated');
  await expect(page.getByRole('link', { name: /Everyday tee/ })).toBeVisible();
  await checkLayout(page);

  await page.getByRole('link', { name: /Harbour crewneck/ }).click();
  await page.waitForURL(/\/tech-packs\//);
  for (const id of ['mockups', 'measurements', 'fabrics', 'trims']) {
    await page.locator(`#section-${id} button[aria-controls]`).click();
  }
  await checkLayout(page);

  await page.goto('/quote');
  await page.getByRole('checkbox', { name: /Everyday tee/ }).check();
  await checkLayout(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await checkLayout(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await checkLayout(page);

  await page.goto('/orders');
  await page.getByRole('region', { name: 'Quote requests' }).getByRole('link').click();
  await page.waitForURL(/confirmation/);
  await expect(page.getByText('What happens next')).toBeVisible();
  await checkLayout(page);
});

test('the design rules hold: Geist, no page shadows, token colours', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  const report = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const shadowed = [...document.querySelectorAll<HTMLElement>('.panel, .btn, .input')].filter(
      (element) => getComputedStyle(element).boxShadow !== 'none',
    );
    return {
      font: body.fontFamily,
      background: body.backgroundColor,
      color: body.color,
      shadowed: shadowed.length,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary-strong').trim(),
    };
  });
  expect(report.font.toLowerCase()).toContain('geist');
  expect(report.background).toBe('rgb(241, 244, 248)');
  expect(report.color).toBe('rgb(20, 24, 27)');
  expect(report.shadowed).toBe(0);
  expect(report.primary.toLowerCase()).toBe('#3b5de8');
});
