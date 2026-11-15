// Prueba de humo: diccionario → importar → tocar palabras → repaso → backup → offline.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('flujo completo del lector', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('./');

  // SYS-1: el diccionario se instala la primera vez
  await expect(page.getByRole('heading', { name: 'Ελληνικό' })).toBeVisible({ timeout: 90_000 });

  // IMP: libro de ejemplo
  await page.getByRole('button', { name: /Probar con/ }).click();
  await expect(page.locator('.book .title', { hasText: 'Τα ψηλά βουνά (cap. 1–3)' })).toBeVisible();
  await page.locator('.book .title', { hasText: 'Τα ψηλά βουνά (cap. 1–3)' }).click();

  // LEC-1 / IMP-3: texto convertido a monotónico
  await expect(page.locator('.reader')).toContainText('Τι λαμπρή φωτιά είναι αυτή που φάνηκε στο βουνό!');
  await expect(page.locator('.reader .w.new').first()).toBeVisible();

  // LEC-3: tocar «φάνηκε» → φαίνομαι
  await page.locator('.reader .w', { hasText: /^φάνηκε$/ }).first().click();
  const sheet = page.getByRole('dialog', { name: /Palabra φάνηκε/ });
  await expect(sheet.locator('.wc-lemma')).toHaveText(/φαίνομαι|φαίνω/);
  await expect(sheet.locator('.wc-analysis')).toContainText('aoristo');
  await expect(sheet.getByRole('radio', { name: 'aprendiendo' })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.locator('.reader .w.learning', { hasText: /^φάνηκε$/ }).first()).toBeVisible();

  // Forma ambigua: «το» ofrece varios lemas
  await page.locator('.reader .w', { hasText: /^το$/ }).first().click();
  await expect(page.locator('.cands button')).not.toHaveCount(0);
  expect(await page.locator('.cands button').count()).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // VOC-1: aparece en el vocabulario
  await page.getByRole('button', { name: 'Biblioteca' }).click();
  await page.getByRole('link', { name: /Vocabulario/ }).click();
  await expect(page.locator('.vocab-item .lemma').first()).toBeVisible();

  // VOC-2: repaso con la frase de contexto
  await page.getByRole('link', { name: /Repaso/ }).click();
  await expect(page.locator('.review-card .ctx')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar traducción' }).click();
  await page.getByRole('button', { name: /^Bien/ }).click();

  // SYS-2: exportar backup
  await page.getByRole('link', { name: /Ajustes/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar backup' }).click()]);
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(backup.app).toBe('elliniko');
  expect(backup.tables.lexemes.length).toBeGreaterThan(0);
  expect(backup.tables.books.length).toBe(1);

  // SYS-1: modo avión
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
  });
  await context.setOffline(true);
  await page.goto('./#/');
  await expect(page.locator('.book .title', { hasText: 'Τα ψηλά βουνά (cap. 1–3)' })).toBeVisible();
  await page.locator('.book .title', { hasText: 'Τα ψηλά βουνά (cap. 1–3)' }).click();
  await page.locator('.reader .w', { hasText: /^βουνό$/ }).first().click();
  await expect(page.locator('.wc-lemma')).toHaveText('βουνό');
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
