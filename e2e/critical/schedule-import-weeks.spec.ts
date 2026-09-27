import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { navigateMenu, returningUser } from '../ui-helpers';

const apiRequire = createRequire(new URL('../../../edutrack-api/package.json', import.meta.url));
const ExcelJS: typeof import('../../../edutrack-api/node_modules/exceljs') = apiRequire('exceljs');
const api = () => process.env.E2E_API_URL!;

for (const device of [{ name: 'Android', width: 393, height: 851, offset: 1, mobile: true }, { name: 'bureau', width: 1280, height: 900, offset: 4, mobile: false }]) {
  test.describe(`C11 ${device.name}`, () => {
    test.use({ viewport: { width: device.width, height: device.height }, isMobile: device.mobile, hasTouch: device.mobile });
    test('premier EDT → dates complètes → aperçu → confirmation → ajout manuel couvert', async ({ page }) => {
      test.setTimeout(90000);
      await returningUser(page); await page.goto('/login');
      await page.getByLabel('Identifiant', { exact: true }).fill('2250701234567');
      await page.getByLabel('Mot de passe', { exact: true }).fill('director2024');
      const auth = page.waitForResponse((r) => r.url().includes('/auth/login/') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Se connecter' }).click();
      const headers = { authorization: `Bearer ${(await (await auth).json()).accessToken}` };
      await expect(page).toHaveURL(/\/dashboard$/);
      const periods = await (await page.request.get(`${api()}/schedule/periods`, { headers })).json();
      for (const period of periods.periods) {
        expect((await page.request.put(`${api()}/schedule/periods/${period.id}`, { headers, data: { is_active: false } })).ok()).toBe(true);
      }
      const directory = await (await page.request.get(`${api()}/teachers`, { headers, params: { limit: 100 } })).json();
      const teacher = directory.data.find((item: { username: string }) => item.username === 'qa.teacher');
      const classes = await (await page.request.get(`${api()}/classes`, { headers })).json();
      const klass = classes.classes.find((item: { name: string }) => item.name === 'Classe QA');
      const subjects = await (await page.request.get(`${api()}/subjects`, { headers, params: { levelId: klass.level.id } })).json();
      const subject = subjects.subjects.find((item: { name: string }) => item.name === 'Mathematiques');
      expect((await page.request.put(`${api()}/teachers/${teacher.id}`, { headers, data: { teaching_assignments: [{ subject_id: subject.id, class_id: klass.id }] } })).ok()).toBe(true);

      await navigateMenu(page, 'Vie scolaire', 'Emploi du temps');
      await expect(page.getByRole('button', { name: "Importer l'EDT", exact: true })).toBeVisible();
      await expect(page.locator('[data-tour="schedule-add-btn"]')).toHaveCount(0);
      await page.getByRole('button', { name: "Importer l'EDT", exact: true }).click();
      await expect(page).toHaveURL(/\/import\?type=schedule$/);
      const startInput = page.getByLabel('Du lundi', { exact: true });
      const endInput = page.getByLabel('Au dimanche', { exact: true });
      await expect(startInput).toHaveValue(''); await expect(endInput).toHaveValue('');
      await expect(page.getByLabel(/nom.*période/i)).toHaveCount(0);
      const start = new Date(); start.setUTCHours(0,0,0,0);
      start.setUTCDate(start.getUTCDate() + ((8-start.getUTCDay())%7 || 7) + (device.offset - 1) * 7);
      const end = new Date(start); end.setUTCDate(end.getUTCDate()+13);
      const tuesday = new Date(start); tuesday.setUTCDate(tuesday.getUTCDate()+1);
      await startInput.fill(tuesday.toISOString().slice(0,10));
      await expect(startInput).toHaveAttribute('aria-invalid','true');
      await expect(page.getByRole('alert')).toHaveText('La période doit commencer un lundi.');
      await startInput.fill(start.toISOString().slice(0,10));
      const saturday = new Date(end); saturday.setUTCDate(saturday.getUTCDate()-1);
      await endInput.fill(saturday.toISOString().slice(0,10));
      await expect(endInput).toHaveAttribute('aria-invalid','true');
      await endInput.fill(end.toISOString().slice(0,10));
      const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('EDT');
      sheet.addRow(['Nom professeur*','Classe*','Matière*','Jour*','Créneau*','Salle']);
      sheet.addRow([teacher.name,klass.name,'Mathematiques','Lundi','08:00 - 09:00','Salle A1']);
      await page.locator('input[type="file"]').setInputFiles({ name:'c11.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer()) });
      await page.getByRole('button', { name:'Suivant →' }).click();
      const formatted = (date: Date) => new Intl.DateTimeFormat('fr-FR',{ day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Abidjan' }).format(date);
      await expect(page.getByText(`Du lundi ${formatted(start)} au dimanche ${formatted(end)}`)).toBeVisible();
      await expect(page.getByText('2 semaines complètes, 1 créneau hebdomadaire à importer.')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('[aria-label="Période d’application de l’EDT"]').screenshot({ path:test.info().outputPath(`c11-preview-${device.name}.png`) });
      const written = page.waitForResponse((r) => r.url().endsWith('/import/schedule/confirm') && r.request().method()==='POST');
      await page.getByRole('button', { name:'Importer →' }).click();
      const confirmed = await written; expect(confirmed.status()).toBe(200); expect((await confirmed.json()).imported).toBe(1);

      await navigateMenu(page, 'Vie scolaire', 'Emploi du temps');
      for (let i=0;i<device.offset;i++) await page.getByRole('button',{ name:'Semaine suivante',exact:true }).click();
      const add = page.locator('[data-tour="schedule-add-btn"]'); await expect(add).toBeEnabled(); await add.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('radio',{ name:/Récurrent/ }).check();
      const select = async (index:number,name:string) => {
        await dialog.getByRole('combobox').nth(index).click();
        await page.getByRole('option',{ name,exact:true }).click();
      };
      await select(1,teacher.name); await select(2,'Mathematiques'); await select(3,'Classe QA');
      await select(4,'Sam'); await select(5,'14:00'); await select(6,'15:00');
      const manual = page.waitForResponse((r) => r.url().endsWith('/schedule') && r.request().method()==='POST');
      await dialog.getByRole('button',{ name:'Ajouter le créneau',exact:true }).click();
      const added = await manual; expect(added.status()).toBe(201);
      await expect(dialog).toHaveCount(0);
      const date = new Date(start); date.setUTCDate(date.getUTCDate()+5);
      const active = await (await page.request.get(`${api()}/schedule/active`,{ headers,params:{ date:date.toISOString().slice(0,10) } })).json();
      const id = (await added.json()).schedule.id;
      expect(active.schedules.some((slot: { id:string }) => slot.id===id)).toBe(true);
      const after = await (await page.request.get(`${api()}/teachers/${teacher.id}`,{ headers })).json();
      expect(after.teaching_assignments).toHaveLength(1);
    });
  });
}
