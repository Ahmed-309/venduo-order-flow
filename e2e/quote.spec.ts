import { expect, test } from '@playwright/test';
import { fillDelivery, loadFixture, setFaults } from './helpers';

/** The populated fixture holds two complete drafts, one partial draft and one sent request. */
async function openDeliveryStep(page: import('@playwright/test').Page) {
  await page.goto('/quote');
  await page.getByRole('checkbox', { name: /Everyday tee/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Recipient name')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await loadFixture(page, 'Populated');
  await expect(page.getByRole('link', { name: /Everyday tee/ })).toBeVisible();
});

test('incomplete packs show but cannot be ticked, with the reason', async ({ page }) => {
  await page.goto('/quote');
  const incomplete = page.getByRole('checkbox', { name: /Campus hoodie/ });
  await expect(incomplete).toBeDisabled();
  await expect(page.getByText('Not ready yet. Add at least one body fabric.')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByText('Tick at least one complete tech pack to continue.')).toBeVisible();
});

test('several products from different hubs go out in one request', async ({ page }) => {
  await page.goto('/quote');
  await page.getByRole('checkbox', { name: /Everyday tee/ }).check();
  await page.getByRole('checkbox', { name: /Harbour crewneck/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  const tee = page.getByRole('region', { name: 'Everyday tee' });
  const crewneck = page.getByRole('region', { name: 'Harbour crewneck' });
  await expect(crewneck.getByText('MOQ 300 because of your custom colour.')).toBeVisible();

  await tee.getByLabel('Quantity').fill('400');
  await crewneck.getByLabel('Quantity').fill('600');
  await tee.getByLabel(/Comment/).fill('Tee note');
  await page.getByRole('button', { name: 'Continue' }).click();
  await fillDelivery(page);
  await page.getByRole('button', { name: 'Send quote request' }).click();

  await page.waitForURL(/confirmation/);
  await expect(page.getByText('Reference QR-0002')).toBeVisible();
  await expect(page.getByText(/400 units · Cairo/)).toBeVisible();
  await expect(page.getByText(/600 units · Alexandria/)).toBeVisible();
});

test('quantities are validated per product and the estimate is live', async ({ page }) => {
  await page.goto('/quote');
  await page.getByRole('checkbox', { name: /Harbour crewneck/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  const card = page.getByRole('region', { name: 'Harbour crewneck' });
  const quantity = card.getByLabel('Quantity');
  const total = card.getByRole('definition').nth(1);

  await quantity.fill('100');
  await expect(card.getByText('Use at least 300, the minimum for this product.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByText('Give every product a quantity at or above its minimum.')).toBeVisible();

  await quantity.fill('');
  await expect(card.getByText('Add a quantity.')).toBeVisible();

  await quantity.fill('6000');
  await expect(card.getByText('Use 5,000 or fewer.')).toBeVisible();

  await quantity.fill('300');
  const before = await total.textContent();
  await quantity.fill('1000');
  await expect(total).not.toHaveText(before as string);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
});

test('delivery requires recipient, valid mobile, governorate and city, but not the street', async ({ page }) => {
  await openDeliveryStep(page);
  const send = page.getByRole('button', { name: 'Send quote request' });
  await expect(send).toBeDisabled();
  await expect(page.getByText('Fill in the required delivery details to send.')).toBeVisible();

  await page.getByLabel('Egyptian mobile number').fill('01312345678');
  await page.getByLabel('Egyptian mobile number').blur();
  await expect(page.getByText('Use an Egyptian mobile number, for example 01012345678.')).toBeVisible();

  await fillDelivery(page);
  await expect(page.getByText('Use an Egyptian mobile number', { exact: false })).toHaveCount(0);
  await expect(page.getByLabel(/Street address/)).toHaveValue('');
  await expect(send).toBeEnabled();
});

test('the whole quote draft survives a reload', async ({ page }) => {
  await page.goto('/quote');
  await page.getByRole('checkbox', { name: /Everyday tee/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Quantity').fill('750');
  await page.getByLabel(/Comment/).fill('Keep this note');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Recipient name').fill('Salma Hassan');
  await page.getByLabel('Egyptian mobile number').fill('01112345678');
  await page.getByLabel('Governorate').selectOption('Cairo');
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();

  await page.reload();

  await expect(page.getByLabel('Recipient name')).toHaveValue('Salma Hassan');
  await expect(page.getByLabel('Egyptian mobile number')).toHaveValue('01112345678');
  await expect(page.getByLabel('Governorate')).toHaveValue('Cairo');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Quantity')).toHaveValue('750');
  await expect(page.getByLabel(/Comment/)).toHaveValue('Keep this note');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('checkbox', { name: /Everyday tee/ })).toBeChecked();
});

test('a pack unticked after arriving from the builder stays unticked on reload', async ({ page }) => {
  await page.goto('/orders');
  const teeHref = await page.getByRole('link', { name: /Everyday tee/ }).getAttribute('href');
  const packId = teeHref?.split('/').pop();

  await page.goto(`/quote?pack=${packId}`);
  const tee = page.getByRole('checkbox', { name: /Everyday tee/ });
  await expect(tee).toBeChecked();
  await expect(page).toHaveURL(/\/quote$/);

  await tee.uncheck();
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();
  await page.reload();
  await expect(tee).not.toBeChecked();
});

test('if the draft cannot be saved before sending, nothing is sent and the form stays usable', async ({ page }) => {
  await openDeliveryStep(page);
  await fillDelivery(page);
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();

  await setFaults(page, { failWrites: true });
  await page.getByLabel('City').fill('Agouza');
  await page.getByRole('button', { name: 'Send quote request' }).click();
  await expect(page.getByText(/couldn't confirm your request was sent/)).toBeVisible();
  await expect(page).toHaveURL(/\/quote$/);

  await setFaults(page, {});
  await page.getByRole('button', { name: 'Send again' }).click();
  await page.waitForURL(/confirmation/);
  await expect(page.getByText('Dokki')).toHaveCount(0);
  await expect(page.getByText('Agouza, Giza')).toBeVisible();
});

test('a failed submission keeps the draft and can be sent again', async ({ page }) => {
  await openDeliveryStep(page);
  await fillDelivery(page);
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();

  await setFaults(page, { submission: 'reject' });
  await page.getByRole('button', { name: 'Send quote request' }).click();
  await expect(page.getByText(/couldn't confirm your request was sent/)).toBeVisible();
  await expect(page).toHaveURL(/\/quote$/);
  await expect(page.getByLabel('Recipient name')).toHaveValue('Salma Hassan');

  await page.reload();
  await expect(page.getByLabel('Recipient name')).toHaveValue('Salma Hassan');

  await setFaults(page, {});
  await page.getByRole('button', { name: 'Send quote request' }).click();
  await page.waitForURL(/confirmation/);
  await expect(page.getByText('Reference QR-0002')).toBeVisible();
});

test('retrying after a lost response returns the same request, with no duplicate', async ({ page }) => {
  await openDeliveryStep(page);
  await fillDelivery(page);
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();

  await setFaults(page, { submission: 'lost_response' });
  await page.getByRole('button', { name: 'Send quote request' }).click();
  await expect(page.getByText(/couldn't confirm your request was sent/)).toBeVisible();

  await setFaults(page, {});
  await page.getByRole('button', { name: 'Send again' }).click();
  await page.waitForURL(/confirmation/);
  await expect(page.getByText('Reference QR-0002')).toBeVisible();

  await page.getByRole('link', { name: 'Go to My orders' }).click();
  const requests = page.getByRole('region', { name: 'Quote requests' });
  await expect(requests.getByRole('listitem')).toHaveCount(2);
});

test('a repeated click cannot send twice', async ({ page }) => {
  await openDeliveryStep(page);
  await fillDelivery(page);
  await setFaults(page, { delayMs: 300 });

  const send = page.getByRole('button', { name: 'Send quote request' });
  await send.click();
  await expect(send).toBeDisabled();
  await expect(page.getByText('Sending your request.')).toBeVisible();
  await page.waitForURL(/confirmation/, { timeout: 15_000 });
  await expect(page.getByText('Reference QR-0002')).toBeVisible();
});
