import { expect, test } from '@playwright/test';
import {
  addFabric,
  addTrim,
  closeRail,
  fillDetails,
  isPhone,
  loadFixture,
  openRail,
  openSection,
  pickFit,
  setFaults,
  startDraft,
  waitForSaved,
} from './helpers';

// A 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('choose a style: coming soon cannot be picked', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tops' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bottoms' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Jacket/ })).toBeDisabled();
  await expect(page.getByText('Coming soon')).toBeVisible();
});

test('the quote button explains what is missing, by garment type', async ({ page }) => {
  await startDraft(page, 'Hoodie');
  await fillDetails(page, 'Campus hoodie');
  await pickFit(page);
  await addFabric(page, 'French terry', { hub: 'Cairo' });

  let rail = await openRail(page);
  await expect(rail.getByRole('button', { name: 'Request a quote' })).toBeDisabled();
  await expect(rail.getByText('To request a quote: Add a drawcord. A hoodie needs one.')).toBeVisible();
  await closeRail(page);

  await addTrim(page, 'Flat cotton drawcord');

  rail = await openRail(page);
  await expect(rail.getByRole('button', { name: 'Request a quote' })).toBeEnabled();
  await expect(rail.getByText('To request a quote:')).toHaveCount(0);
});

test('a T-shirt without trims only warns', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await fillDetails(page);
  await pickFit(page);
  await addFabric(page, 'Cotton jersey');

  const rail = await openRail(page);
  await expect(rail.getByText('No trims added. Is this intentional?')).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Request a quote' })).toBeEnabled();
});

test('hub lock: first fabric locks, the last one unlocks', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  const section = await openSection(page, 'fabrics');
  await expect(section.getByRole('button', { name: 'Select Combed cotton jersey' })).toBeVisible();

  await addFabric(page, 'Cotton jersey');
  await expect(section.getByText(/Showing Cairo fabrics only/)).toBeVisible();
  await expect(section.getByRole('button', { name: 'Select Combed cotton jersey' })).toHaveCount(0);

  const rail = await openRail(page);
  await expect(rail.getByText(/Your first fabric fixed the hub/)).toBeVisible();
  await closeRail(page);

  await section.getByRole('button', { name: 'Remove Body fabric' }).click();
  await expect(section.getByRole('button', { name: 'Select Combed cotton jersey' })).toBeVisible();
});

test('trims wait for a hub, and moving hub asks before removing them', async ({ page }) => {
  await startDraft(page, 'Trousers');
  const trims = await openSection(page, 'trims');
  await expect(trims.getByText('Pick a fabric first.', { exact: false })).toBeVisible();

  await addFabric(page, 'Cotton twill');
  await addTrim(page, 'Metal zip, 18 cm');
  await addTrim(page, 'Nylon zip, 18 cm');

  const fabrics = await openSection(page, 'fabrics');
  await fabrics.getByRole('button', { name: 'Remove Body fabric' }).click();
  await expect(trims.getByText(/on hold until you pick a fabric/)).toBeVisible();
  await expect(trims.getByRole('button', { name: 'Remove Metal zip, 18 cm' })).toBeVisible();

  // Cancel preserves everything.
  await addFabric(page, 'Stretch twill');
  let dialog = page.getByRole('dialog', { name: 'Move to Alexandria?' });
  await expect(dialog.getByText('Metal zip, 18 cm')).toBeVisible();
  await expect(dialog.getByText('Nylon zip, 18 cm')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Keep my trims' }).click();
  await expect(trims.getByRole('button', { name: 'Remove Metal zip, 18 cm' })).toBeVisible();
  await expect(fabrics.getByRole('button', { name: 'Remove Body fabric' })).toHaveCount(0);

  // Confirm removes only the incompatible trim.
  await addFabric(page, 'Stretch twill');
  dialog = page.getByRole('dialog', { name: 'Move to Alexandria?' });
  await dialog.getByRole('button', { name: 'Remove trims and continue' }).click();
  await expect(fabrics.getByText(/Showing Alexandria fabrics only/)).toBeVisible();
  await expect(trims.getByRole('button', { name: 'Remove Metal zip, 18 cm' })).toHaveCount(0);
  await expect(trims.getByRole('button', { name: 'Remove Nylon zip, 18 cm' })).toBeVisible();
});

test('a custom colour raises the MOQ and lead time, and the rail says why', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  const section = await openSection(page, 'fabrics');
  await section.getByRole('button', { name: 'Select Cotton jersey' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('label', { hasText: 'Custom Pantone' }).click();
  await expect(dialog.getByRole('button', { name: 'Add fabric' })).toBeDisabled();
  await expect(dialog.getByText('Add a valid Pantone code to continue.')).toBeVisible();
  await dialog.getByLabel('Pantone code').fill('19-4052 TCX');
  await dialog.getByRole('button', { name: 'Add fabric' }).click();

  const rail = await openRail(page);
  await expect(rail.getByText('MOQ 300 because of your custom colour.')).toBeVisible();
  await expect(rail.getByText('About 6 weeks')).toBeVisible();
});

test('the estimate responds to quantity, stays visible below MOQ and uses EGP', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await fillDetails(page);
  await pickFit(page);
  await addFabric(page, 'Cotton jersey');
  await waitForSaved(page);

  const rail = await openRail(page);
  const unit = rail.getByText(/EGP \/ unit$/);
  const atDefault = await unit.textContent();
  expect(atDefault).not.toContain('$');

  await rail.getByRole('slider').fill('3000');
  await expect(rail.getByText('3,000 units')).toBeVisible();
  await expect(unit).not.toHaveText(atDefault as string);

  await rail.getByRole('slider').fill('50');
  await expect(rail.getByText(/50 units is below it/)).toBeVisible();
  await expect(unit).toBeVisible();
});

test('grading: base edits follow, overrides stay, reset works, and all of it reloads', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await pickFit(page);
  const cell = (point: string, size: string) => page.getByLabel(`${point}, size ${size}, in centimetres`);

  await expect(cell('Chest width', 'L')).toHaveValue('54');

  await cell('Chest width', 'M').fill('60');
  await expect(cell('Chest width', 'L')).toHaveValue('62');
  await expect(cell('Chest width', 'XS')).toHaveValue('56');

  await cell('Chest width', 'L').fill('70');
  await cell('Chest width', 'M').fill('50');
  await expect(cell('Chest width', 'XL')).toHaveValue('54');
  await expect(cell('Chest width', 'L')).toHaveValue('70');

  await page.getByLabel('Base size').selectOption('S');
  await expect(cell('Chest width', 'L')).toHaveValue('70');
  await expect(cell('Chest width', 'S')).toHaveValue('48');

  await waitForSaved(page);
  await page.reload();
  await openSection(page, 'measurements');
  await expect(cell('Chest width', 'L')).toHaveValue('70');
  await expect(page.getByLabel('Base size')).toHaveValue('S');

  await page.getByRole('button', { name: 'Reset L to graded' }).click();
  await expect(cell('Chest width', 'L')).toHaveValue('52');
});

test('reload restores edits and uploaded mockups, and uploads are validated', async ({ page }) => {
  await startDraft(page, 'Polo');
  await fillDetails(page, 'Club polo');
  const section = await openSection(page, 'mockups');
  await expect(section.getByText('Front: Default sketch')).toBeVisible();

  const frontInput = section.locator('input[type=file]').first();
  await frontInput.setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  await expect(section.getByText('Use a PNG, JPEG or WebP image.')).toBeVisible();

  await frontInput.setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: PNG });
  await expect(section.getByText('Front: front.png')).toBeVisible();
  await waitForSaved(page);

  await page.reload();
  await expect(page.getByLabel('Name')).toHaveValue('Club polo');
  const reloaded = await openSection(page, 'mockups');
  await expect(reloaded.getByText('Front: front.png')).toBeVisible();
  const image = reloaded.getByRole('img', { name: 'Front mockup' });
  await expect(image).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
});

test('text saves without a button, even when leaving straight after typing', async ({ page }) => {
  await startDraft(page, 'Shorts');
  await page.getByLabel('Name').fill('Beach shorts');
  await page.getByRole('link', { name: 'My orders' }).click();
  await page.waitForURL(/\/orders/);
  await expect(page.getByRole('link', { name: /Beach shorts/ })).toBeVisible();
});

test('clear section removes selections; clearing fabrics unlocks the hub', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await addFabric(page, 'Cotton jersey');
  const section = await openSection(page, 'fabrics');

  await section.getByRole('button', { name: 'Fabrics options' }).click();
  await section.getByRole('menuitem', { name: 'Clear section' }).click();

  await expect(section.getByRole('list', { name: 'Selected fabrics' })).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Select Combed cotton jersey' })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Fabrics options' })).toBeFocused();
});

test('a failed save keeps the edit on screen, and retry stores it', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await setFaults(page, { failWrites: true });

  await page.getByLabel('Name').fill('Unsaved tee');
  await expect(page.getByText(/couldn't save your last change/)).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Unsaved tee');

  // Leaving is refused while the edit would be lost.
  await page.getByRole('link', { name: 'My orders' }).click();
  await expect(page).toHaveURL(/\/tech-packs\//);

  await setFaults(page, {});
  await page.getByRole('button', { name: 'Retry saving' }).click();
  await waitForSaved(page);

  await page.reload();
  await expect(page.getByLabel('Name')).toHaveValue('Unsaved tee');
});

test('a missing tech pack gets a real message', async ({ page }) => {
  await page.goto('/tech-packs/does-not-exist');
  await expect(page.getByText("We couldn't find this tech pack")).toBeVisible();
});

test('the accordion works from the keyboard', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  const toggle = page.locator('#section-mockups button[aria-controls]');
  await toggle.focus();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('the phone summary sheet traps focus and hands it back', async ({ page }) => {
  test.skip(!isPhone(page), 'Phone layout only');
  await startDraft(page, 'T-shirt');

  await expect(page.getByRole('complementary')).toBeHidden();
  const bar = page.getByRole('button', { name: /sections complete/ });
  await bar.focus();
  await page.keyboard.press('Enter');

  const sheet = page.getByRole('dialog', { name: 'Summary' });
  await expect(sheet).toBeVisible();

  for (let press = 0; press < 25; press += 1) {
    await page.keyboard.press('Tab');
    const isInside = await page.evaluate(() => {
      const active = document.activeElement;
      return active === document.body || active?.closest('dialog') !== null;
    });
    expect(isInside).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(bar).toBeFocused();
});

test('the rail and its quote button stay in view on desktop', async ({ page }) => {
  test.skip(isPhone(page), 'Desktop layout only');
  await startDraft(page, 'T-shirt');
  await openSection(page, 'measurements');
  await openSection(page, 'fabrics');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const rail = page.getByRole('complementary');
  await expect(rail.getByRole('heading', { name: 'Completeness' })).toBeInViewport();
  await expect(rail.getByRole('button', { name: 'Request a quote' })).toBeInViewport();
});

test('a quote cannot start on an unsaved change, and the rail says so', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await fillDetails(page);
  await pickFit(page);
  await addFabric(page, 'Cotton jersey');
  await waitForSaved(page);

  await setFaults(page, { failWrites: true });
  await page.getByLabel('Name').fill('Renamed');
  await expect(page.getByText(/couldn't save your last change/)).toBeVisible();

  const rail = await openRail(page);
  await rail.getByRole('button', { name: 'Request a quote' }).click();
  await expect(rail.getByText(/isn't saved yet/)).toBeVisible();
  await expect(page).toHaveURL(/\/tech-packs\//);

  await setFaults(page, {});
  await rail.getByRole('button', { name: 'Request a quote' }).click();
  await page.waitForURL(/\/quote/);
  await expect(page.getByRole('checkbox', { name: /Renamed/ })).toBeChecked();
});

for (const pause of [0, 100]) {
  test(`text typed ${pause}ms before a reload is not lost`, async ({ page }) => {
    await startDraft(page, 'T-shirt');
    await page.getByLabel('Name').fill('Typed just before reload');
    if (pause > 0) await page.waitForTimeout(pause);
    await page.reload();
    await expect(page.getByLabel('Name')).toHaveValue('Typed just before reload');
  });
}

test('a quote draft typed just before a reload is not lost', async ({ page }) => {
  await loadFixture(page, 'Populated');
  await expect(page.getByRole('link', { name: /Everyday tee/ })).toBeVisible();
  await page.goto('/quote');
  await page.getByRole('checkbox', { name: /Everyday tee/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/Comment/).fill('Typed just before reload');
  await page.reload();
  await expect(page.getByLabel(/Comment/)).toHaveValue('Typed just before reload');
});

test('an edit made during a slow upload survives the upload finishing', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await setFaults(page, { delayMs: 800 });
  const section = await openSection(page, 'mockups');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  await section
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Name').fill('Edited during upload');

  await expect(section.getByText('Front: front.png')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('Name')).toHaveValue('Edited during upload');

  await setFaults(page, {});
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByLabel('Name')).toHaveValue('Edited during upload');
  await expect((await openSection(page, 'mockups')).getByText('Front: front.png')).toBeVisible();
});

test('the rail shows the price and the MOQ reason without scrolling', async ({ page }) => {
  test.skip(isPhone(page), 'The phone rail is a sheet.');
  await startDraft(page, 'T-shirt');
  const rail = await openRail(page);
  await expect(rail.getByText(/^MOQ|minimum/i).first()).toBeInViewport({ ratio: 1 });
  await expect(rail.getByRole('button', { name: 'Request a quote' })).toBeInViewport({ ratio: 1 });
});

test('a bad measurement says what is wrong, and the message clears', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await pickFit(page);
  const cell = page.getByLabel('Chest width, size M, in centimetres');
  await cell.fill('abc');
  await expect(page.locator('#measurement-error')).toContainText('Chest width, size M: use a number above 0, up to 300 cm.');
  await expect(cell).toHaveAttribute('aria-describedby', 'measurement-error');
  await cell.blur();
  await expect(page.getByText('use a number above 0')).toHaveCount(0);
});

test('the base size column starts fully on screen', async ({ page }) => {
  await startDraft(page, 'T-shirt');
  await pickFit(page);
  const positions = await page.getByLabel('Chest width, size M, in centimetres').evaluate((cell) => ({
    cell: cell.getBoundingClientRect().right,
    scroller: cell.closest('[role=region]')!.getBoundingClientRect().right,
  }));
  expect(positions.cell).toBeLessThanOrEqual(positions.scroller);
});
