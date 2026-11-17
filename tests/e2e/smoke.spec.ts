// Prueba de humo: diccionario → importar → tocar palabras → repaso → backup → offline.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** IDI-1: perfil ya elegido, sin pasar por la pantalla de inicio */
const setProfile = (p: { target: string; ui: string }) =>
  localStorage.setItem('elliniko.profile', JSON.stringify(p));

test('flujo completo del lector', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('./');

  // IDI-1: pantalla de inicio → aprender griego, interfaz en español
  await page.locator('.choice', { hasText: 'Ελληνικά' }).click();
  await page.getByRole('radio', { name: 'Español', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();

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

test('catálogo por niveles (IMP-5, IMP-6)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(setProfile, { target: 'el', ui: 'es' });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Ελληνικό' })).toBeVisible({ timeout: 90_000 });

  await page.getByRole('link', { name: /catálogo por niveles/ }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
  for (const l of ['A2', 'B1', 'B2', 'C1']) await expect(page.getByRole('tab', { name: new RegExp(`^${l}`) })).toBeVisible();

  // A2 por defecto; el primero es el más corto y fácil
  await expect(page.locator('.level-title')).toHaveText(/A2/);
  await expect(page.locator('.cat-book')).toHaveCount(13);
  const first = page.locator('.cat-book').first();
  const title = (await first.locator('.title').textContent())!;
  await first.getByRole('button', { name: /Añadir/ }).click();

  // Se descarga, se importa y se abre en el lector
  await expect(page.locator('.reader .w').first()).toBeVisible({ timeout: 30_000 });
  await page.goto('./#/catalogo');
  await expect(page.locator('.cat-book', { hasText: title }).getByRole('link', { name: 'Leer' })).toBeVisible();
  await page.goto('./#/');
  await expect(page.locator('.book .title', { hasText: title })).toBeVisible();
  expect(errors).toEqual([]);
});

test('aprender español con la interfaz en griego (IDI-1…IDI-4, DIC-7)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.locator('.choice', { hasText: 'Español' }).click();
  await page.getByRole('radio', { name: 'Ελληνικά', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ξεκίνα' })).toBeVisible(); // la pantalla cambia de idioma al vuelo
  await page.getByRole('button', { name: 'Ξεκίνα' }).click();

  await expect(page.getByRole('heading', { name: 'Español' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('link', { name: /Βιβλιοθήκη/ })).toBeVisible();

  // IMP-2: pegar un texto en español
  await page.getByRole('button', { name: 'Επικόλληση κειμένου' }).click();
  await page.locator('textarea').fill('—Dámelo ahora —dijo la niña. Las casas del pueblo eran blancas; el perro dormía.');
  await page.getByRole('button', { name: 'Αποθήκευση' }).click();
  await page.locator('.book .title').first().click();

  // DIC-7: enclíticos y análisis en griego
  await page.locator('.reader .w', { hasText: /^Dámelo$/ }).first().click();
  const sheet = page.getByRole('dialog', { name: /Λέξη Dámelo/ });
  await expect(sheet.locator('.wc-lemma')).toHaveText('dar');
  await expect(sheet.locator('.wc-analysis')).toContainText('προστακτική');
  await expect(sheet.locator('.wc-analysis')).toContainText('+ me, lo');
  await sheet.getByRole('button', { name: 'Κλείσιμο' }).click();

  // DIC-8: traducción al griego primero
  await page.locator('.reader .w', { hasText: /^perro$/ }).first().click();
  await expect(page.locator('.senses li').first()).toContainText(/σκύλος/);
  await page.getByRole('button', { name: 'Κλείσιμο' }).click();

  // IDI-3: la biblioteca del griego no se mezcla con la del español
  await page.evaluate(() => localStorage.setItem('elliniko.profile', JSON.stringify({ target: 'el', ui: 'es' })));
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ελληνικό' })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.book')).toHaveCount(0);
  expect(errors).toEqual([]);
});
