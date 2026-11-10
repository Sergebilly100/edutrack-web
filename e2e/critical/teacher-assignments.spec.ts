import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { navigateMenu, returningUser } from '../ui-helpers';

const apiRequire = createRequire(new URL('../../../edutrack-api/package.json', import.meta.url));
const ExcelJS: typeof import('../../../edutrack-api/node_modules/exceljs') = apiRequire('exceljs');
const api = () => process.env.E2E_API_URL!;
const { Pool }: typeof import('../../../edutrack-api/node_modules/@types/pg') = apiRequire('pg');
async function file(headers: string[], rows: Array<Array<string | number>>) {
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Données');
  sheet.addRow(headers); rows.forEach((row) => sheet.addRow(row));
  return { name: 'c10.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await book.xlsx.writeBuffer()) };
}
async function login(page: Page, admin = false) {
  await returningUser(page); await page.goto(admin ? '/admin/login' : '/login');
  await page.getByLabel('Identifiant', { exact: true }).fill(admin ? 'superadmin.integration@edutrack.local' : '2250701234567');
  await page.getByLabel('Mot de passe', { exact: true }).fill(admin ? 'SuperAdmin!2024' : 'director2024');
  const response = page.waitForResponse((r) => r.url().includes('/auth/login/') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const result = await response; expect(result.status()).toBe(200);
  await expect(page).toHaveURL(admin ? /\/admin$/ : /\/dashboard$/);
  return (await result.json()).accessToken as string;
}
async function selectClasses(page: Page, index: number, names: string[]) {
  await page.getByRole('button', { name: `Modifier les classes du bloc ${index}` }).click();
  for (const name of names) await page.getByRole('menuitemcheckbox').filter({ hasText: name }).click();
  await page.keyboard.press('Escape');
}

for (const device of [{ name: 'Android', width: 393, height: 851, mobile: true }, { name: 'bureau', width: 1280, height: 900, mobile: false }]) {
  test.describe(device.name, () => {
    test.use({ viewport: { width: device.width, height: device.height }, isMobile: device.mobile, hasTouch: device.mobile });
    test('Rappel professeur principal dans les listes et lien vers Classes', async ({ page }) => {
      await login(page);
      await navigateMenu(page, 'Vie scolaire', 'Professeurs');
      await expect(page.getByRole('link', { name: 'Ouvrir l’onglet Classes' })).toHaveAttribute('href', '/academic/classes');
      await page.getByRole('button', { name: 'Ajouter un prof', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Ajouter un bloc' }).click();
      await expect(dialog.getByText(/Rappel : classes sans professeur principal/)).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('link', { name: 'Ouvrir l’onglet Classes' }).click();
      await expect(page).toHaveURL(/\/academic\/classes$/);
      await expect(page.getByRole('tab', { name: 'Classes', exact: true })).toHaveAttribute('aria-selected', 'true');
      await navigateMenu(page, 'Vie scolaire', 'Élèves');
      await page.getByRole('link', { name: 'Ouvrir l’onglet Classes' }).click();
      await expect(page).toHaveURL(/\/academic\/classes$/);
      await expect(page.getByRole('tab', { name: 'Classes', exact: true })).toHaveAttribute('aria-selected', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
    test('C10 : inscription et classe → blocs individuels → premier EDT réel', async ({ page }) => {
      test.setTimeout(90000);
      const token = await login(page); const headers = { authorization: `Bearer ${token}` };
      const suffix = `C10-${device.name}-${Date.now()}`;
      const initial = await file(['Matricule','Nom*','Prénom*','Type*','Email','Taux horaire FCFA'], [[suffix, suffix, 'Aya', 'vacataire', `${suffix}@example.ci`, 5000]]);
      // The shared browser school is configured; initial profile import needs its initial phase.
      const schema = (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as { schemaName: string }).schemaName;
      if (!process.env.DATABASE_URL_TEST || !schema?.startsWith('school_test_')) throw new Error('C10 requires the disposable QA school');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
      const savedInitialPhase = await pool.query<{ onboarding_completed: boolean }>('SELECT onboarding_completed FROM public.tenants WHERE schema_name=$1', [schema]);
      try {
        await pool.query('UPDATE public.tenants SET onboarding_completed=false WHERE schema_name=$1', [schema]);
        const imported = await page.request.post(`${api()}/import/teachers/confirm`, { headers, multipart: { file: initial } });
        expect(imported.status(), await imported.text()).toBe(200);
      } finally {
        await pool.query('UPDATE public.tenants SET onboarding_completed=$1 WHERE schema_name=$2', [savedInitialPhase.rows[0]!.onboarding_completed, schema]);
        await pool.end();
      }
      const directory = await (await page.request.get(`${api()}/teachers`, { headers, params: { search: suffix, limit: 100 } })).json();
      const teacher = directory.data[0]; expect(teacher.teaching_assignments).toEqual([]);

      await navigateMenu(page, 'Vie scolaire', 'Inscriptions');
      await page.getByRole('link', { name: 'Nouvelle inscription' }).click();
      await page.getByLabel('Prénom *', { exact: true }).fill('Aya C10');
      await page.getByLabel('Nom *', { exact: true }).fill(suffix);
      await page.getByLabel('Matricule (facultatif)').fill(`E-${suffix}`);
      await expect(page.getByText(/Année scolaire active QA \d{4}/)).toBeVisible();
      await page.getByRole('combobox', { name: 'Niveau visé' }).click();
      await page.getByRole('option', { name: 'Niveau QA', exact: true }).click();
      await page.getByRole('button', { name: 'Créer une classe', exact: true }).click();
      const className = `Classe ${suffix}`;
      await page.getByLabel('Libellé de la classe', { exact: true }).fill(className);
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: 'Retour à l’inscription', exact: true }).click();
      await page.getByRole('button', { name: 'Créer et continuer' }).click();
      await page.getByRole('button', { name: 'Terminer le dossier' }).click();
      await page.getByRole('row', { name: new RegExp(suffix) }).getByRole('link', { name: 'Caisse' }).click();
      await page.getByLabel('Montant reçu *').fill('25000');
      await page.getByLabel('Référence du reçu de caisse *').fill(`RC-${suffix}`);
      await page.getByRole('button', { name: /Enregistrer 25/ }).click();
      await expect(page).toHaveURL(/\/enrollments$/);

      // A second level keeps this test's new subject out of Classe QA's report-card prerequisites.
      const isolatedLevel = await page.request.post(`${api()}/levels`, { headers, data: { name: `Niveau ${suffix}`, orderIndex: 100, isExamClass: false } });
      expect(isolatedLevel.status(), await isolatedLevel.text()).toBe(201);
      const isolatedLevelId = (await isolatedLevel.json()).level.id as string;
      const isolatedClassName = `Classe matière ${suffix}`;
      const isolatedClass = await page.request.post(`${api()}/classes`, { headers, data: { name: isolatedClassName, levelId: isolatedLevelId } });
      expect(isolatedClass.status(), await isolatedClass.text()).toBe(201);
      const chemistry = await page.request.post(`${api()}/subjects`, { headers, data: { levelId: isolatedLevelId, name: `Chimie ${device.name}`, coefficient: 1 } });
      expect(chemistry.ok()).toBeTruthy();
      const chemistryName = (await chemistry.json()).subject.name as string;
      await navigateMenu(page, 'Vie scolaire', 'Professeurs');
      await expect(page.getByRole('link', { name: 'Ouvrir l’onglet Classes' })).toHaveAttribute('href', '/academic/classes');
      await page.goto(`/teachers/${teacher.id}`);
      await page.getByRole('tab', { name: 'Infos', exact: true }).click();
      await page.getByRole('button', { name: 'Ajouter un bloc' }).click();
      await page.getByRole('combobox', { name: 'Matière du bloc 1' }).click();
      await page.getByRole('option', { name: 'Mathematiques', exact: true }).click();
      await selectClasses(page, 1, [className, 'Classe inscription QA']);
      await page.getByRole('button', { name: 'Ajouter un bloc' }).click();
      await page.getByRole('combobox', { name: 'Matière du bloc 2' }).click();
      await page.getByRole('option', { name: chemistryName, exact: true }).click();
      await selectClasses(page, 2, [isolatedClassName]);
      await expect(page.getByText(/Rappel : classes sans professeur principal/)).toHaveCount(0);
      const saved = page.waitForResponse((r) => r.url().endsWith(`/teachers/${teacher.id}`) && r.request().method() === 'PUT');
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      const result = await saved; expect(result.status()).toBe(200);
      const savedTeacher = await result.json(); expect(savedTeacher.teaching_assignments).toHaveLength(3);
      expect(savedTeacher.teaching_assignments.some((item: { subjectName: string; className: string }) => item.subjectName.startsWith('Chimie') && item.className === className)).toBe(false);
      await page.reload(); await page.getByRole('tab', { name: 'Infos', exact: true }).click();
      await expect(page.getByRole('combobox', { name: /Matière du bloc/ }).filter({ hasText: chemistryName })).toHaveCount(1);
      await expect(page.getByRole('combobox', { name: /Matière du bloc/ }).filter({ hasText: 'Mathematiques' })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      await page.goto('/schedule');
      await page.getByRole('button', { name: "Importer l'EDT" }).click();
      await expect(page.getByLabel('Du lundi', { exact: true })).toBeVisible();
      const edt = await file(['Nom professeur*','Classe*','Matière*','Jour*','Créneau*','Salle'], [[`Aya ${suffix}`, className, 'Mathematiques', 'Lundi', '08:00 - 09:00', 'Salle A1']]);
      await page.locator('input[type="file"]').setInputFiles(edt);
      const start = new Date(); start.setUTCDate(start.getUTCDate() + ((8-start.getUTCDay())%7 || 7) + (device.mobile ? 7 : 14));
      const end = new Date(start); end.setUTCDate(start.getUTCDate()+6);
      await page.getByLabel('Du lundi').fill(start.toISOString().slice(0,10));
      await page.getByLabel('Au dimanche').fill(end.toISOString().slice(0,10));
      await page.getByRole('button', { name: 'Suivant →' }).click();
      await expect(page.getByRole('button', { name: 'Importer →' })).toBeEnabled();
      const written = page.waitForResponse((r) => r.url().endsWith('/import/schedule/confirm') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Importer →' }).click();
      const importedEdt = await written; expect(importedEdt.status()).toBe(200); expect((await importedEdt.json()).imported).toBe(1);
      const after = await (await page.request.get(`${api()}/teachers/${teacher.id}`, { headers })).json();
      expect(after.teaching_assignments).toHaveLength(3);
      await navigateMenu(page, 'Vie scolaire', 'Élèves');
      await page.getByRole('link', { name: 'Ouvrir l’onglet Classes' }).click();
      await expect(page).toHaveURL(/\/academic\/classes$/);
      await expect(page.getByRole('tab', { name: 'Classes', exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.screenshot({ path: test.info().outputPath(`c10-${device.name}.png`), fullPage: true });
    });
  });
}

test('C10 : import d’affectations accessible depuis la fiche école, avec aperçu et rappel non bloquant', async ({ page }) => {
  const token = await login(page, true); const headers = { authorization: `Bearer ${token}` };
  const schools = await (await page.request.get(`${api()}/admin/schools`, { headers, params: { search: 'École QA navigateur' } })).json();
  const tenantId = schools.schools[0].tenantId;
  const years = await (await page.request.get(`${api()}/admin/schools/${tenantId}/school-year`, { headers })).json();
  expect(years.activeYear).toBeTruthy();
  const mapping = await page.request.put(`${api()}/admin/schools/${tenantId}/midyear-import/teacher_assignments/profile`, { headers, data: { fields: ['Matricule','Matière','Classes'].map((sourceColumnLabel,index) => ({ sourceColumnLabel, targetField: ['matricule','matiere','classes'][index], translations: [] })) } });
  expect(mapping.ok()).toBeTruthy();
  const menu = page.getByRole('button', { name: 'Ouvrir le menu de navigation' });
  await expect(menu.or(page.getByRole('link', { name: 'Écoles', exact: true })).first()).toBeVisible();
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Écoles', exact: true }).first().click();
  await page.getByPlaceholder('Rechercher une école').fill('École QA navigateur');
  await page.getByRole('row', { name: /École QA navigateur/ }).first().getByRole('button', { name: 'Voir détail' }).click();
  await page.getByRole('tab', { name: 'Imports de l’école' }).click();
  await page.getByRole('button', { name: /^6 · Professeurs : affectations$/ }).click();
  await page.getByRole('combobox', { name: 'Année scolaire concernée' }).click();
  await page.getByRole('option', { name: /QA \d{4}/ }).click();
  const fileData = await file(['Matricule','Matière','Classes'], [['ABSENT','Mathematiques','Classe QA']]);
  await page.getByLabel(/Fichier Excel/).setInputFiles(fileData);
  await page.getByRole('button', { name: 'Analyser les colonnes' }).click();
  await page.getByRole('button', { name: 'Prévisualiser la reprise' }).click();
  await expect(page.getByText('Professeur introuvable : ABSENT')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lancer l’import définitif' })).toBeDisabled();
  await expect(page.getByText(/Rappel : classes sans professeur principal/)).toBeVisible();
});
