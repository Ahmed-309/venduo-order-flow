import { expect, test } from '@playwright/test';
import { addFabric, fillDelivery, fillDetails, pickFit, requestQuote, startDraft, waitForSaved } from './helpers';

test('create, complete, submit, confirm, find in My orders, reopen read-only', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await expect(page.getByText('VND-0001')).toBeVisible();

  await fillDetails(page);
  await pickFit(page);
  await addFabric(page, 'Cotton jersey');
  await waitForSaved(page);

  await requestQuote(page);

  await expect(page.getByRole('checkbox', { name: /Everyday tee/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Quantity').fill('500');
  await page.getByLabel(/Comment for the factory/).fill('Samples first, please.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await fillDelivery(page, '+20 101 234 5678');
  await page.getByRole('button', { name: 'Send quote request' }).click();

  await page.waitForURL(/\/quote\/confirmation\//);
  await expect(page.getByRole('heading', { name: 'Your quote request is in' })).toBeVisible();
  await expect(page.getByText('Reference QR-0001')).toBeVisible();
  await expect(page.getByText('What happens next')).toBeVisible();
  await expect(page.getByText('01012345678')).toBeVisible();
  await expect(page.getByText('Comment: Samples first, please.')).toBeVisible();

  await page.getByRole('link', { name: 'Go to My orders' }).click();
  await page.waitForURL(/\/orders/);

  const sent = page.getByRole('link', { name: /QR-0001/ });
  await expect(sent).toContainText('Quote requested');
  await expect(sent).toContainText('Everyday tee');
  await expect(page.getByText('Everyday tee')).toHaveCount(1);

  await sent.click();
  await page.waitForURL(/confirmation/);
  await page.getByRole('link', { name: /View tech pack/ }).click();
  await page.waitForURL(/\/tech-packs\//);
  await expect(page.getByText(/frozen and opens read-only/)).toBeVisible();
  await expect(page.getByLabel('Name')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Details options' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Request a quote' })).toHaveCount(0);

  await page.goto('/quote');
  await expect(page.getByRole('checkbox', { name: /Everyday tee/ })).toHaveCount(0);
});
