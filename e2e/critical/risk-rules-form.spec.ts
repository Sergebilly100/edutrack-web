import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

for (const device of [
  { name: "desktop", viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
  { name: "android", viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.hasTouch })
    test("règles de risque : configuration, validation, annulation et sauvegarde", async ({ page }) => {
      await returningUser(page)
      await page.goto("/login")
      await page.getByLabel("Identifiant", { exact: true }).fill("2250701234567")
      await page.getByLabel("Mot de passe", { exact: true }).fill("director2024")
      await page.getByRole("button", { name: "Se connecter" }).click()
      await expect(page).toHaveURL(/\/dashboard$/)
      await page.goto("/settings")
      await page.getByRole("tab", { name: "Risques", exact: true }).click()
      await expect(page.getByRole("tab", { name: "Risques", exact: true })).toHaveAttribute("aria-selected", "true")
      await expect(page.getByRole("region", { name: "Élèves", exact: true })).toBeVisible()
      await expect(page.getByRole("region", { name: "Professeurs", exact: true })).toBeVisible()
      const student = page.getByRole("form", { name: "Absences élèves", exact: true })
      const teacher = page.getByRole("form", { name: "Absences professeur", exact: true })
      const lateness = page.getByRole("form", { name: "Retards professeur", exact: true })
      const threshold = student.getByLabel("Nombre d'absences", { exact: true })
      const initial = await threshold.inputValue()
      const next = String(Number(initial) + 1)
      const save = student.getByRole("button", { name: "Enregistrer : Absences élèves", exact: true })
      await expect(save).toBeDisabled()
      await threshold.fill("0")
      await expect(threshold).toHaveAttribute("aria-invalid", "true")
      await expect(student.getByRole("alert")).toHaveText("Saisissez une valeur entre 1 et 999.")
      await expect(save).toBeDisabled()
      await student.getByRole("button", { name: "Annuler les modifications : Absences élèves", exact: true }).click()
      await expect(threshold).toHaveValue(initial)
      await expect(student.getByRole("status")).toContainText("Sans modification")
      await threshold.fill(next)
      await expect(student.getByRole("status")).toContainText("Modifications non enregistrées")
      await threshold.focus()
      await page.keyboard.press("Tab")
      await expect(student.getByLabel("Période (jours)", { exact: true })).toBeFocused()
      await expect(save).toBeEnabled()
      const savedResponse = page.waitForResponse((response) => response.url().endsWith("/risk/rules/student/absences") && response.request().method() === "PUT")
      await save.click()
      const saved = await savedResponse
      expect(saved.status()).toBe(200)
      expect(saved.request().postDataJSON()).toMatchObject({ thresholdValue: Number(next), periodDays: 30, isActive: true })
      await expect(student.getByRole("status")).toContainText("Enregistré")
      await expect(save).toBeDisabled()
      await expect(teacher.getByRole("status")).toContainText("Sans modification")
      await expect(lateness.getByText("Sur les 30 derniers jours, période fixe.")).toBeVisible()
      await expect(lateness.getByRole("spinbutton")).toHaveCount(2)
      await expect(lateness.getByRole("group", { name: "Tolérance du pointage" })).toBeVisible()
      await expect(lateness.getByRole("group", { name: "Signal sur le tableau de bord" })).toBeVisible()
      expect(await threshold.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48)
      expect(await save.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48)
      expect(await student.getByRole("checkbox").evaluate((element) => element.closest("label")?.getBoundingClientRect().height ?? 0)).toBeGreaterThanOrEqual(48)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.getByText("Règle de risque enregistrée", { exact: true })).toBeHidden()
      const panel = page.getByRole("tabpanel")
      // Expand scroll containers only for full-content captures; restore before layout checks.
      const captureStyles = await panel.evaluate((element) => {
        const original: Array<{ depth: number; style: string | null }> = []
        let depth = 0
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (getComputedStyle(parent).overflowY !== "visible") {
            original.push({ depth, style: parent.getAttribute("style") })
            parent.style.overflow = "visible"
            parent.style.height = "auto"
            parent.style.maxHeight = "none"
          }
          depth += 1
        }
        return original
      })
      try {
        await panel.screenshot({ path: `docs/design/risk-rules-${device.name}.png` })
        await lateness.screenshot({ path: `docs/design/risk-lateness-${device.name}.png` })
        await page.evaluate(() => document.documentElement.classList.add("dark"))
        await expect(lateness.getByLabel("Tolérance en minutes", { exact: true })).toBeVisible()
        await lateness.screenshot({ path: `docs/design/risk-lateness-${device.name}-dark.png` })
      } finally {
        await panel.evaluate((element, originals) => {
          let depth = 0
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const saved = originals.find((entry) => entry.depth === depth)
            if (saved) {
              if (saved.style === null) parent.removeAttribute("style")
              else parent.setAttribute("style", saved.style)
            }
            depth += 1
          }
        }, captureStyles)
        await page.evaluate(() => document.documentElement.classList.remove("dark"))
      }
      if (device.name === "desktop") {
        await page.setViewportSize({ width: 720, height: 1000 })
        await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      } else {
        await page.setViewportSize({ width: 320, height: 851 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
    })
  })
}
