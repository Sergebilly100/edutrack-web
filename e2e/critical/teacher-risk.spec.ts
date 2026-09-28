import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

test("C13 : configure les retards et ouvre leur motif depuis le dashboard sur Android", async ({ page }) => {
  await returningUser(page)
  await page.goto("/login")
  await page.getByLabel("Identifiant", { exact: true }).fill("2250701234567")
  await page.getByLabel("Mot de passe", { exact: true }).fill("director2024")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto("/settings")
  await page.getByRole("tab", { name: "Risques", exact: true }).click()
  const rule = page.getByRole("form", { name: "Retards professeur", exact: true })
  await expect(rule.getByLabel("Nombre de retards")).toHaveValue("")
  await rule.getByLabel("Nombre de retards").fill("1")
  await rule.getByLabel("Tolérance en minutes").fill("0")
  await rule.getByRole("checkbox").check()
  const savedResponse = page.waitForResponse((response) => response.url().endsWith("/risk/rules/teacher/lateness") && response.request().method() === "PUT")
  await rule.getByRole("button", { name: "Enregistrer : Retards professeur", exact: true }).click()
  const saved = await savedResponse
  expect(saved.status()).toBe(200)
  await expect(page.getByText("Règle de risque enregistrée", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // Le parcours utilise l'API réelle et le même job que la production, sur le tenant QA jetable.
  const headers = await saved.request().allHeaders()
  const token = headers.authorization?.replace(/^Bearer /, "")
  const claims = token ? JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as { schemaName?: string } : {}
  const schema = headers["x-tenant-schema"] ?? claims.schemaName
  expect(schema).toMatch(/^school_test_/)
  execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `
    import { withTenantSchema } from './src/shared/database/db.ts';
    import { buildAttendanceService } from './src/modules/attendance/attendance.service.ts';
    import { buildRiskService } from './src/modules/risk/risk.service.ts';
    import { runDashboardActionsForSchema } from './src/modules/dashboard-actions/dashboard-actions.worker.ts';
    import { sql } from 'drizzle-orm';
    const schema = process.env.E2E_SCHEMA_NAME;
    if (!schema?.startsWith('school_test_')) throw new Error('Disposable schema required');
    await withTenantSchema(schema, async (db) => {
      const { rows } = await db.execute(sql\`SELECT s.id, t.user_id FROM schedules s INNER JOIN teachers t ON t.id=s.teacher_id WHERE t.username='qa.teacher' LIMIT 1\`);
      await buildAttendanceService(db).checkIn({ scheduleId: rows[0].id }, { schemaName: schema, userId: rows[0].user_id });
      await buildRiskService(db).recalculateTeachers();
    });
    await runDashboardActionsForSchema({ schemaName: schema });
    await runDashboardActionsForSchema({ schemaName: schema });
    process.exit(0);
  `], { cwd: fileURLToPath(new URL("../../../edutrack-api", import.meta.url)), env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST, E2E_SCHEMA_NAME: schema }, stdio: "pipe" })

  const actionResponse = await page.request.get(`${process.env.E2E_API_URL}/dashboard/action-items`, { headers: { authorization: headers.authorization! } })
  expect(actionResponse.status()).toBe(200)
  expect((await actionResponse.json()).items.filter((item: { type: string }) => item.type === "teacher_at_risk")).toHaveLength(1)

  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Mettre à jour les données" }).click()
  await page.getByRole("link").filter({ hasText: "Professeurs à suivre" }).first().click()
  await expect(page).toHaveURL(/\/dashboard\/risks\?tab=teachers$/)
  await expect(page.getByRole("tab", { name: "Professeurs" })).toHaveAttribute("aria-selected", "true")
  const row = page.getByRole("row").filter({ hasText: "Integration Teacher" })
  await expect(row).toHaveCount(1)
  await expect(row.getByText("Retards", { exact: true })).toBeVisible()
  await expect(row.getByText("Absences", { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
});
