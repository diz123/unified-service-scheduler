import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Smoke tests for the booking page (ADR-0002 Amendment 1). Serial: lookup and conflict reuse the booking from the
 * first test. Global setup resets bookings and re-seeds, so every run starts from the same data.
 */
test.describe.configure({ mode: 'serial' });

/** Chips from index 3 on are at least 3 days ahead in the dealership's timezone, so no slot is in the past. */
const DAYS_AHEAD = 3;

interface Customer {
  name: string;
  phone: string;
  plate: string;
}

const FIRST: Customer = { name: 'Nguyen Van A', phone: '0901 111 111', plate: '51A-111.11' };
const OVERNIGHT: Customer = { name: 'Tran Thi B', phone: '0902 222 222', plate: '51A-222.22' };

/** Filled in by the first test, read by the lookup and conflict tests. */
const firstBooking = { date: '', dateLabel: '' };

const bookingArea = (page: Page): Locator => page.getByRole('region', { name: 'Book an appointment' });
const lookupArea = (page: Page): Locator => page.getByRole('complementary', { name: 'Find my appointment' });

/** `YYYY-MM-DD` plus one calendar day. */
const nextDay = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

// Fields are found by role + accessible name: getByLabel matches the label text including the decorative "*".
async function fillCustomer(booking: Locator, customer: Customer): Promise<void> {
  await booking.getByRole('textbox', { name: 'Name', exact: true }).fill(customer.name);
  await booking.getByRole('textbox', { name: 'Phone', exact: true }).fill(customer.phone);
  await booking.getByRole('textbox', { name: 'License plate', exact: true }).fill(customer.plate);
}

async function chooseService(booking: Locator, dealership: string, service: string): Promise<void> {
  await booking.getByRole('combobox', { name: 'Dealership', exact: true }).selectOption({ label: dealership });
  await booking.getByRole('combobox', { name: 'Service type', exact: true }).selectOption({ label: service });
}

/** Checks a date chip and returns its `YYYY-MM-DD` value and its full-date accessible name. */
async function pickDate(chip: Locator): Promise<{ date: string; dateLabel: string }> {
  await chip.check();
  const date = await chip.getAttribute('value');
  const dateLabel = await chip.getAttribute('aria-label');
  if (!date || !dateLabel) throw new Error('Date chip is missing its value or aria-label');
  return { date, dateLabel };
}

const dateChips = (booking: Locator): Locator => booking.getByRole('group', { name: 'Date' }).getByRole('radio');
const timeChip = (booking: Locator, time: string): Locator =>
  booking.getByRole('group', { name: 'Time' }).getByRole('radio', { name: time, exact: true });
const submit = (booking: Locator): Promise<void> => booking.getByRole('button', { name: 'Book appointment' }).click();

test('booking Phu My Hung oil change shows the confirmed local start and end', async ({ page }) => {
  await page.goto('/');
  const booking = bookingArea(page);
  await fillCustomer(booking, FIRST);
  await chooseService(booking, 'Phu My Hung Service Center', 'Oil change');
  Object.assign(firstBooking, await pickDate(dateChips(booking).nth(DAYS_AHEAD)));
  await timeChip(booking, '10:00').check();

  await submit(booking);

  await expect(booking.getByRole('heading', { name: 'Appointment booked' })).toBeVisible();
  await expect(booking.getByText('10:00', { exact: true })).toBeVisible();
  await expect(booking.getByText('11:00', { exact: true })).toBeVisible();
  await expect(booking.getByText(firstBooking.date, { exact: true })).toHaveCount(2);
  await expect(booking.getByText('Confirmed', { exact: true })).toBeVisible();
});

test('a service past closing asks for overnight consent, keeps the form, then books into the next day', async ({ page }) => {
  await page.goto('/');
  const booking = bookingArea(page);
  await fillCustomer(booking, OVERNIGHT);
  await chooseService(booking, 'Ben Thanh Service Center', 'Brake inspection');
  const { date } = await pickDate(dateChips(booking).nth(DAYS_AHEAD));
  await timeChip(booking, '16:30').check();

  await submit(booking);

  await expect(booking.getByRole('alert').filter({ hasText: 'runs past closing time' })).toBeVisible();
  const consent = booking.getByRole('checkbox', { name: 'I agree to leave my vehicle overnight' });
  await expect(consent).toBeVisible();
  await expect(booking.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(OVERNIGHT.name);
  await expect(booking.getByRole('textbox', { name: 'Phone', exact: true })).toHaveValue(OVERNIGHT.phone);
  await expect(booking.getByRole('textbox', { name: 'License plate', exact: true })).toHaveValue(OVERNIGHT.plate);
  await expect(booking.getByRole('combobox', { name: 'Dealership', exact: true }).locator('option:checked')).toHaveText(
    'Ben Thanh Service Center',
  );
  await expect(booking.getByRole('combobox', { name: 'Service type', exact: true }).locator('option:checked')).toHaveText(
    'Brake inspection',
  );
  await expect(dateChips(booking).nth(DAYS_AHEAD)).toBeChecked();
  await expect(timeChip(booking, '16:30')).toBeChecked();

  await consent.check();
  await submit(booking);

  await expect(booking.getByRole('heading', { name: 'Appointment booked' })).toBeVisible();
  // 16:30 + 90 min with a 17:00 close: 30 min today, 60 min from the 08:00 opening the next day.
  await expect(booking.getByText(nextDay(date), { exact: true })).toBeVisible();
  await expect(booking.getByText('09:00', { exact: true })).toBeVisible();
});

test('lookup with the first booking plate and phone lists it in local time', async ({ page }) => {
  await page.goto('/');
  const lookup = lookupArea(page);
  await lookup.getByRole('textbox', { name: 'License plate', exact: true }).fill(FIRST.plate);
  await lookup.getByRole('textbox', { name: 'Phone', exact: true }).fill(FIRST.phone);

  await lookup.getByRole('button', { name: 'Find appointments' }).click();

  const row = lookup.getByRole('listitem').filter({ hasText: 'Phu My Hung Service Center' });
  await expect(row).toContainText('Oil change');
  await expect(row).toContainText(`${firstBooking.date} 10:00 → ${firstBooking.date} 11:00`);
  await expect(row).toContainText('Confirmed');
});

test('lookup with the right plate and a wrong phone shows not found and keeps both values', async ({ page }) => {
  await page.goto('/');
  const lookup = lookupArea(page);
  await lookup.getByRole('textbox', { name: 'License plate', exact: true }).fill(FIRST.plate);
  await lookup.getByRole('textbox', { name: 'Phone', exact: true }).fill('0909 999 999');

  await lookup.getByRole('button', { name: 'Find appointments' }).click();

  await expect(lookup.getByRole('alert')).toHaveText('No appointments found for these details.');
  await expect(lookup.getByRole('textbox', { name: 'License plate', exact: true })).toHaveValue(FIRST.plate);
  await expect(lookup.getByRole('textbox', { name: 'Phone', exact: true })).toHaveValue('0909 999 999');
});

test('booking the same plate again at the same slot is rejected and the form is kept', async ({ page }) => {
  await page.goto('/');
  const booking = bookingArea(page);
  await fillCustomer(booking, FIRST);
  await chooseService(booking, 'Phu My Hung Service Center', 'Oil change');
  await booking.getByRole('radio', { name: firstBooking.dateLabel, exact: true }).check();
  await timeChip(booking, '10:00').check();

  await submit(booking);

  await expect(booking.getByRole('alert')).toHaveText('This vehicle already has an appointment at that time.');
  await expect(booking.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(FIRST.name);
  await expect(booking.getByRole('textbox', { name: 'Phone', exact: true })).toHaveValue(FIRST.phone);
  await expect(booking.getByRole('textbox', { name: 'License plate', exact: true })).toHaveValue(FIRST.plate);
  await expect(booking.getByRole('combobox', { name: 'Dealership', exact: true }).locator('option:checked')).toHaveText(
    'Phu My Hung Service Center',
  );
  await expect(booking.getByRole('combobox', { name: 'Service type', exact: true }).locator('option:checked')).toHaveText(
    'Oil change',
  );
  await expect(booking.getByRole('radio', { name: firstBooking.dateLabel, exact: true })).toBeChecked();
  await expect(timeChip(booking, '10:00')).toBeChecked();
});
