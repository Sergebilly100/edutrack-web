import { test, expect } from "@playwright/test"

test.describe("Director - Geo Validation Review", () => {
  test.beforeEach(async ({ page }) => {
    // Login en tant que directeur
    await page.goto("/login")
    await page.fill('input[name="username"]', "director")
    await page.fill('input[name="password"]', "director123")
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("should display suspicious geo attendances", async ({ page }) => {
    // Naviguer vers la page des présences suspectes
    await page.click('a[href="/attendance/suspicious"]')

    await expect(page).toHaveURL(/\/attendance\/suspicious/)

    // Vérifier que la liste des présences suspectes s'affiche
    await expect(page.locator("h1:has-text('Présences suspectes')")).toBeVisible()

    // Attendre le chargement des données
    await page.waitForSelector('[data-testid="suspicious-list"]', { timeout: 5000 })

    // Vérifier qu'au moins une présence suspecte s'affiche
    const firstRow = page.locator('[data-testid="suspicious-row"]').first()
    await expect(firstRow).toBeVisible()

    // Vérifier les colonnes affichées
    await expect(firstRow.locator("text=Diallo Ibrahim")).toBeVisible() // Nom du prof
    await expect(firstRow.locator("text=Mathématiques")).toBeVisible() // Matière
    await expect(firstRow.locator('[data-testid="geo-distance"]')).toBeVisible() // Distance
    await expect(firstRow.locator('[data-testid="geo-accuracy"]')).toBeVisible() // Précision
  })

  test("should validate suspicious geo attendance", async ({ page }) => {
    await page.goto("/attendance/suspicious")

    // Attendre qu'une présence suspecte soit visible
    const firstRow = page.locator('[data-testid="suspicious-row"]').first()
    await firstRow.waitFor({ state: "visible" })

    // Récupérer l'ID de l'attendance pour vérification ultérieure
    const attendanceId = await firstRow.getAttribute("data-attendance-id")

    // Cliquer sur le bouton "Valider"
    await firstRow.locator('button:has-text("Valider")').click()

    // Vérifier la modal de confirmation
    await expect(page.locator("text=Confirmer la validation")).toBeVisible()
    await expect(
      page.locator("text=Cette présence sera comptabilisée dans les heures payées")
    ).toBeVisible()

    // Confirmer
    await page.click('button:has-text("Confirmer")')

    // Vérifier le toast de succès
    await expect(page.locator("text=Présence validée avec succès")).toBeVisible({
      timeout: 3000,
    })

    // La ligne devrait disparaître de la liste
    await expect(
      page.locator(`[data-attendance-id="${attendanceId}"]`)
    ).not.toBeVisible({ timeout: 3000 })
  })

  test("should reject suspicious geo attendance", async ({ page }) => {
    await page.goto("/attendance/suspicious")

    const firstRow = page.locator('[data-testid="suspicious-row"]').first()
    await firstRow.waitFor({ state: "visible" })

    const attendanceId = await firstRow.getAttribute("data-attendance-id")

    // Cliquer sur le bouton "Rejeter"
    await firstRow.locator('button:has-text("Rejeter")').click()

    // Vérifier la modal de confirmation
    await expect(page.locator("text=Confirmer le rejet")).toBeVisible()
    await expect(
      page.locator("text=Cette présence ne sera pas comptabilisée dans les heures payées")
    ).toBeVisible()

    // Confirmer
    await page.click('button:has-text("Rejeter la présence")')

    // Vérifier le toast
    await expect(page.locator("text=Présence rejetée")).toBeVisible({ timeout: 3000 })

    // La ligne devrait disparaître
    await expect(
      page.locator(`[data-attendance-id="${attendanceId}"]`)
    ).not.toBeVisible({ timeout: 3000 })
  })

  test("should update teacher salary after validation", async ({ page }) => {
    await page.goto("/attendance/suspicious")

    const firstRow = page.locator('[data-testid="suspicious-row"]').first()
    await firstRow.waitFor({ state: "visible" })

    // Récupérer le nom du prof
    const teacherName = await firstRow.locator('[data-testid="teacher-name"]').textContent()

    // Valider la présence
    await firstRow.locator('button:has-text("Valider")').click()
    await page.click('button:has-text("Confirmer")')

    await expect(page.locator("text=Présence validée avec succès")).toBeVisible({
      timeout: 3000,
    })

    // Naviguer vers la page des salaires
    await page.goto("/teachers/salary")

    // Rechercher le prof
    await page.fill('input[placeholder*="Rechercher"]', teacherName || "")

    // Attendre les résultats de recherche
    await page.waitForTimeout(500)

    // Vérifier que les heures payées ont été mises à jour
    const teacherRow = page.locator(`tr:has-text("${teacherName}")`).first()
    await expect(teacherRow).toBeVisible()

    const hoursCell = teacherRow.locator('[data-testid="hours-done"]')
    const hours = await hoursCell.textContent()

    // Les heures devraient inclure la présence validée (vérifier qu'elles sont > 0)
    expect(Number(hours)).toBeGreaterThan(0)
  })

  test("should filter suspicious attendances by date range", async ({ page }) => {
    await page.goto("/attendance/suspicious")

    // Sélectionner une plage de dates
    await page.fill('input[name="from"]', "2026-05-01")
    await page.fill('input[name="to"]', "2026-05-31")
    await page.click('button:has-text("Filtrer")')

    // Attendre le rechargement
    await page.waitForLoadState("networkidle")

    // Vérifier que les résultats sont filtrés
    const rows = page.locator('[data-testid="suspicious-row"]')
    const count = await rows.count()

    // Vérifier que les dates affichées sont dans la plage
    if (count > 0) {
      const firstDate = await rows.first().locator('[data-testid="attendance-date"]').textContent()
      expect(firstDate).toMatch(/2026-05-(0[1-9]|[12][0-9]|3[01])/)
    }
  })

  test("should display geo details on hover", async ({ page }) => {
    await page.goto("/attendance/suspicious")

    const firstRow = page.locator('[data-testid="suspicious-row"]').first()
    await firstRow.waitFor({ state: "visible" })

    // Survoler l'icône de distance
    const distanceIcon = firstRow.locator('[data-testid="geo-distance-icon"]')
    await distanceIcon.hover()

    // Le tooltip devrait s'afficher avec les détails
    await expect(page.locator('[role="tooltip"]')).toBeVisible({ timeout: 2000 })
    await expect(page.locator("text=Distance du point de pointage à la salle")).toBeVisible()
    await expect(page.locator("text=Précision GPS")).toBeVisible()
  })

  test("should show empty state if no suspicious attendances", async ({ page }) => {
    // Valider toutes les présences suspectes d'abord
    await page.goto("/attendance/suspicious")

    const rows = page.locator('[data-testid="suspicious-row"]')
    const initialCount = await rows.count()

    if (initialCount > 0) {
      // Valider toutes les lignes
      for (let i = 0; i < initialCount; i++) {
        await rows.first().locator('button:has-text("Valider")').click()
        await page.click('button:has-text("Confirmer")')
        await page.waitForTimeout(500) // Attendre la disparition
      }
    }

    // Vérifier l'état vide
    await expect(page.locator("text=Aucune présence suspecte")).toBeVisible({ timeout: 3000 })
    await expect(
      page.locator("text=Toutes les présences géolocalisées sont validées")
    ).toBeVisible()
  })
})
