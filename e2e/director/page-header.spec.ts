import { expect, test, type Page } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) })

const PERMISSIONS = [
  "teachers.view", "students.view", "attendance.view", "validations.view",
  "salary.view", "salary.compute", "salary.export",
  "payments.view", "payments.record", "tuition.view", "school_years.view", "settings.school",
]

const mockCommon = async (page: Page, withNote: boolean) => {
  await mockDirectorAuth(page)
  await page.route("**/api/v1/permissions/me*", (route) => route.fulfill(json({ permissions: PERMISSIONS })))
  await page.route("**/api/v1/school-years*", (route) => route.fulfill(json({ schoolYears: [{ id: "year-1", label: "2026-2027", status: "active", startDate: "2026-09-01", endDate: "2027-06-30", endOfYearReviewStartDate: "2027-05-01" }] })))
  await page.route("**/api/v1/billing/salary/summary*", (route) => route.fulfill(json({ month: "2026-11", lastComputedAt: withNote ? "2026-11-07T22:31:00Z" : null, items: [] })))
  await page.route("**/api/v1/billing/salary/unpaid-alerts*", (route) => route.fulfill(json({ referenceMonth: "2026-11", count: 0, totalRemainingFcfa: 0, months: [] })))
  await page.route("**/api/v1/finance/financial-summary*", (route) => route.fulfill(json({ school: withNote ? { last_computed_at: "2026-11-09T14:30:00Z" } : null })))
}

type Box = { x: number; y: number; width: number; height: number }

/** Mesure les contrôles visibles de la zone d'actions (hors mention) et la mention éventuelle. */
const measure = async (page: Page) => {
  const actions = page.locator("[data-page-header-actions]")
  await expect(actions).toBeVisible({ timeout: 15000 })
  return actions.evaluate((container) => {
    const rect = (el: Element): Box => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const controls = Array.from(container.querySelectorAll<HTMLElement>("button, [role=combobox]"))
      .filter((el) => el.offsetParent !== null && !el.closest("[data-header-note]"))
      .filter((el) => !el.querySelector("button, [role=combobox]"))
    const note = container.querySelector<HTMLElement>("[data-header-note]")
    return { controls: controls.map((el) => ({ label: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "", box: rect(el) })), note: note ? rect(note) : null }
  })
}

const PAGES = [
  { name: "Gestion des salaires", path: "/salaries", noteButton: "Calculer les salaires" },
  { name: "Vue financière", path: "/finance/dashboard", noteButton: "Recalculer les données" },
]

for (const width of [1280, 1440]) {
  for (const target of PAGES) {
    test.describe(`${target.name} à ${width}px`, () => {
      test("contrôles alignés, Aide en dernier, mention sous le bouton sans rien décaler", async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await mockCommon(page, true)
        await loginAsDirectorUI(page)
        await page.goto(target.path)
        const withNote = await measure(page)
        expect(withNote.note, "mention affichée").not.toBeNull()

        const heights = withNote.controls.map((c) => c.box.height)
        const centers = withNote.controls.map((c) => c.box.y + c.box.height / 2)
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
        expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1)
        expect(withNote.controls.at(-1)?.label).toMatch(/aide/i)

        const button = withNote.controls.find((c) => c.label.includes(target.noteButton))!
        expect(withNote.note!.y).toBeGreaterThanOrEqual(button.box.y + button.box.height - 1)
        expect(Math.abs(withNote.note!.x + withNote.note!.width - (button.box.x + button.box.width))).toBeLessThanOrEqual(2)

        await page.unrouteAll({ behavior: "ignoreErrors" })
        await mockCommon(page, false)
        await page.reload()
        const withoutNote = await measure(page)
        // Vue financière affiche « Aucun calcul disponible » quand il n'y a pas de calcul : la mention reste hors flux.
        if (target.path === "/salaries") expect(withoutNote.note).toBeNull()
        const sameLabels = withoutNote.controls.filter((c) => withNote.controls.some((o) => o.label === c.label))
        for (const control of sameLabels) {
          const before = withNote.controls.find((o) => o.label === control.label)!
          expect(Math.abs(control.box.y - before.box.y)).toBeLessThanOrEqual(1)
          expect(Math.abs(control.box.height - before.box.height)).toBeLessThanOrEqual(1)
        }
      })
    })
  }
}

test("à 390 px, aucun contrôle n'est coupé ni superposé", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCommon(page, true)
  await loginAsDirectorUI(page)
  await page.goto("/salaries")
  const result = await measure(page)
  for (const control of result.controls) {
    expect(control.box.x).toBeGreaterThanOrEqual(0)
    expect(control.box.x + control.box.width).toBeLessThanOrEqual(390)
    expect(control.box.height).toBeGreaterThanOrEqual(40)
  }
  for (const [i, a] of result.controls.entries()) {
    for (const b of result.controls.slice(i + 1)) {
      const overlap = a.box.x < b.box.x + b.box.width && b.box.x < a.box.x + a.box.width && a.box.y < b.box.y + b.box.height && b.box.y < a.box.y + a.box.height
      expect(overlap, `${a.label} / ${b.label}`).toBe(false)
    }
  }
  const lastControl = result.controls.reduce((max, c) => Math.max(max, c.box.y + c.box.height), 0)
  expect(result.note!.y).toBeGreaterThanOrEqual(lastControl - 1)
})

for (const width of [1280, 1440]) {
  test(`Dashboard directeur à ${width}px : contrôles alignés, Aide en dernier, mention sous « Actualiser »`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockCommon(page, true)
    await page.route("**/api/v1/grading-periods*", (route) => route.fulfill(json({ gradingPeriods: [{ id: "p1", schoolYearId: "year-1", label: "Trimestre 1", orderIndex: 1, startDate: "2026-09-01", endDate: "2026-12-20", notesEntryOpen: true, conductReviewOpen: false, isClosed: false, isCurrent: true }] })))
    await page.route("**/api/v1/dashboard/**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x", code: "X", statusCode: 500 }) }))
    await loginAsDirectorUI(page)
    await page.goto("/dashboard")
    const result = await measure(page)
    const heights = result.controls.map((c) => c.box.height)
    const centers = result.controls.map((c) => c.box.y + c.box.height / 2)
    expect(result.controls.length).toBeGreaterThanOrEqual(4)
    // Option A : le sélecteur de période est sur la même ligne que « Actualiser », avant la cloche.
    expect(result.controls[0]?.label).toMatch(/période|trimestre/i)
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1)
    expect(result.controls.at(-1)?.label).toMatch(/aide/i)
    const refresh = result.controls.find((c) => /mettre à jour/i.test(c.label))!
    expect(result.note!.y).toBeGreaterThanOrEqual(refresh.box.y + refresh.box.height - 1)
    expect(Math.abs(result.note!.x + result.note!.width - (refresh.box.x + refresh.box.width))).toBeLessThanOrEqual(2)
  })
}
