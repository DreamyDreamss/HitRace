import { expect, test } from '@playwright/test';

// The core commercial loop, end to end in a real browser:
//   login → home → simulated run → summary → forge → collection.

test('run → forge → collect happy path', async ({ page }) => {
  await page.goto('/');

  // Login gate → start with demo.
  await page.getByRole('button', { name: /데모로 시작하기/ }).click();

  // Home dashboard shows the equipped legendary and the start CTA.
  await expect(page.getByText('대장간')).toBeVisible();
  await expect(page.getByText('한강 새벽선').first()).toBeVisible();

  // Go running.
  await page.getByRole('button', { name: '러닝 시작' }).click();
  await expect(page.getByText('실시간 주조')).toBeVisible();

  // Use the deterministic simulation (no GPS needed).
  await page.getByRole('button', { name: /데모 러닝/ }).click();

  // Wait for the simulation to COMPLETE (finished state shows "요약 보기"),
  // so the full ~6km track is captured before we forge.
  await page.getByRole('button', { name: '요약 보기' }).click({ timeout: 25_000 });
  await expect(page.getByText('러닝 완료')).toBeVisible({ timeout: 20_000 });

  // Forge the sword (authoritative server call).
  await page.getByRole('button', { name: '검 주조하기' }).click();

  // Forge result reveal.
  await expect(page.getByText(/FORGED/)).toBeVisible({ timeout: 15_000 });

  // Finish → home.
  await page.getByRole('button', { name: '완료' }).click();
  await expect(page.getByText('대장간')).toBeVisible();
});

test('collection shows seeded blades', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /데모로 시작하기/ }).click();
  await page.getByRole('link', { name: '컬렉션' }).click();
  await expect(page.getByText('한강 새벽선').first()).toBeVisible();
  await expect(page.getByText('남산 곡도')).toBeVisible();
});
