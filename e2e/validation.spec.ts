import { expect, test } from '@playwright/test';

/**
 * Guards the lost-submit-click fix (useFieldErrors.holdForSubmit): with focus in an empty field, pressing
 * "Book appointment" must still validate the whole form, not only show the blurred field's message.
 * Messages are the browser's own validation text, linked to each control through aria-describedby.
 */
test('focusing Name then clicking Book appointment shows every required-field message', async ({ page }) => {
  await page.goto('/');
  const booking = page.getByRole('region', { name: 'Book an appointment' });
  const name = booking.getByRole('textbox', { name: 'Name', exact: true });
  await name.focus();

  await booking.getByRole('button', { name: 'Book appointment' }).click();

  await expect(name).toHaveAccessibleDescription(/fill out this field/i);
  await expect(booking.getByRole('textbox', { name: 'Phone', exact: true })).toHaveAccessibleDescription(
    /fill out this field/i,
  );
  await expect(booking.getByRole('textbox', { name: 'License plate', exact: true })).toHaveAccessibleDescription(
    /fill out this field/i,
  );
  await expect(booking.getByRole('combobox', { name: 'Dealership', exact: true })).toHaveAccessibleDescription(
    /select an item/i,
  );
});
