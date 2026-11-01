import { expect, type Locator, type Page } from '@playwright/test';

export const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1280) < 768;

export async function startDraft(page: Page, garment: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(`^${garment}`) }).click();
  await page.waitForURL(/\/tech-packs\//);
  await expect(page.getByLabel('Name')).toBeVisible();
}

export async function openSection(page: Page, id: string): Promise<Locator> {
  const section = page.locator(`#section-${id}`);
  const toggle = section.locator('button[aria-controls]');
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return section;
}

export async function fillDetails(page: Page, name = 'Everyday tee'): Promise<void> {
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Short description').fill('A soft regular-fit garment.');
}

export async function pickFit(page: Page, fit = 'Regular'): Promise<void> {
  const section = await openSection(page, 'measurements');
  await section.locator('label', { hasText: fit }).click();
}

/** Selects a fabric from the list, then confirms the dialog with its defaults. */
export async function addFabric(page: Page, fabric: string, options: { hub?: string } = {}): Promise<void> {
  const section = await openSection(page, 'fabrics');
  await section.getByRole('button', { name: `Select ${fabric}` }).click();
  const dialog = page.getByRole('dialog');
  if (options.hub) await dialog.locator('label', { hasText: options.hub }).click();
  await dialog.getByRole('button', { name: 'Add fabric' }).click();
}

export async function addTrim(page: Page, trim: string): Promise<void> {
  const section = await openSection(page, 'trims');
  await section.getByRole('button', { name: `Select ${trim}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add trim' }).click();
}

/** The rail, wherever this viewport puts it. On phones this opens the bottom sheet. */
export async function openRail(page: Page): Promise<Locator> {
  if (isPhone(page)) {
    await page.getByRole('button', { name: /sections complete/ }).click();
    return page.getByRole('dialog', { name: 'Summary' });
  }
  return page.getByRole('complementary', { name: 'Completeness and price' });
}

export async function closeRail(page: Page): Promise<void> {
  if (isPhone(page)) await page.getByRole('dialog', { name: 'Summary' }).getByRole('button', { name: 'Close' }).click();
}

export async function requestQuote(page: Page): Promise<void> {
  const rail = await openRail(page);
  await rail.getByRole('button', { name: 'Request a quote' }).click();
  await page.waitForURL(/\/quote/);
}

export async function fillDelivery(page: Page, mobile = '01012345678'): Promise<void> {
  await page.getByLabel('Recipient name').fill('Salma Hassan');
  await page.getByLabel('Egyptian mobile number').fill(mobile);
  await page.getByLabel('Governorate').selectOption('Giza');
  await page.getByLabel('City').fill('Dokki');
}

/** Waits until the autosave has written everything, so a reload cannot lose it. */
export async function waitForSaved(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();
}

export async function setFaults(page: Page, faults: Record<string, unknown>): Promise<void> {
  await page.evaluate((value) => localStorage.setItem('venduo.faults', JSON.stringify(value)), faults);
}

export async function loadFixture(page: Page, label: 'Empty' | 'Partial' | 'Populated'): Promise<void> {
  await page.goto('/orders');
  await page.getByRole('button', { name: 'Demo' }).click();
  await page.getByRole('dialog').getByRole('button', { name: label }).click();
  await page.waitForLoadState('load');
}
