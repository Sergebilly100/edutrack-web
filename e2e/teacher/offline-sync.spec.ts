import { test, expect } from "@playwright/test"

test.describe("Teacher Flow - Offline to Online Sync", () => {
  test.beforeEach(async ({ page }) => {
    // Login en tant que prof
    await page.goto("/login")
    await page.fill('input[name="username"]', "diallo.ibra")
    await page.fill('input[name="password"]', "password123")
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/attendance/)
  })

  test("should complete full flow offline then sync when online", async ({ page, context }) => {
    // Étape 1 : Vérifier que le prof voit ses cours
    await expect(page.locator("text=Mathématiques")).toBeVisible()

    // Étape 2 : Passer hors ligne
    await context.setOffline(true)

    // Vérifier que l'indicateur offline s'affiche
    await expect(page.locator("text=Hors ligne")).toBeVisible()

    // Étape 3 : Check-in offline
    await page.click('button:has-text("Démarrer le cours")')
    await page.click('button:has-text("Je suis présent(e)")')

    // Vérifier la confirmation
    await expect(page.locator("text=Présence enregistrée")).toBeVisible({ timeout: 5000 })

    // Étape 4 : QR scan offline
    // Simuler un scan QR (ceci nécessite un mock du scanner ou un QR test)
    // Pour simplifier, on vérifie que l'étape QR s'affiche
    await expect(page.locator("text=Scanner le QR code")).toBeVisible()

    // Simuler un scan via input (fallback manuel si caméra indisponible)
    const validQrToken = "a".repeat(64) // Token préalablement caché en IndexedDB

    // Si l'app a un fallback input pour QR scan :
    await page.fill('input[placeholder*="code"]', validQrToken)
    await page.click('button:has-text("Valider")')

    await expect(page.locator("text=Scan validé")).toBeVisible({ timeout: 3000 })

    // Étape 5 : Appel élèves offline
    await expect(page.locator("text=Appel des élèves")).toBeVisible()

    // Cocher 2 élèves absents
    await page.click('input[type="checkbox"][data-student-id="student-1"]')
    await page.click('input[type="checkbox"][data-student-id="student-2"]')

    await page.click('button:has-text("Terminer l\'appel")')

    // Vérifier la confirmation
    await expect(page.locator("text=Appel enregistré")).toBeVisible({ timeout: 3000 })

    // Étape 6 : Vérifier que les 3 mutations sont en queue
    // (visible via DevTools ou un indicateur UI "X actions en attente")
    await expect(page.locator("text=3 actions en attente de synchronisation")).toBeVisible()

    // Étape 7 : Retour en ligne
    await context.setOffline(false)

    // L'indicateur offline devrait disparaître
    await expect(page.locator("text=Hors ligne")).not.toBeVisible({ timeout: 5000 })

    // Étape 8 : Vérifier la synchronisation automatique
    await expect(page.locator("text=Synchronisation réussie")).toBeVisible({ timeout: 10000 })

    // Vérifier que la queue est vide
    await expect(page.locator("text=en attente de synchronisation")).not.toBeVisible()

    // Étape 9 : Vérifier que les données sont bien enregistrées côté serveur
    // Recharger la page et vérifier que le cours est marqué comme "terminé"
    await page.reload()

    await expect(page.locator('text="Cours terminé"')).toBeVisible({ timeout: 5000 })
  })

  test("should retry failed mutations when back online", async ({ page, context }) => {
    // Passer hors ligne
    await context.setOffline(true)

    // Effectuer un check-in
    await page.click('button:has-text("Démarrer le cours")')
    await page.click('button:has-text("Je suis présent(e)")')

    await expect(page.locator("text=Présence enregistrée")).toBeVisible({ timeout: 3000 })

    // Revenir en ligne
    await context.setOffline(false)

    // La mutation devrait se synchroniser automatiquement
    await expect(page.locator("text=Synchronisation réussie")).toBeVisible({ timeout: 10000 })

    // Vérifier dans le dashboard directeur (si accessible)
    // que le pointage apparaît bien
  })

  test("should show error if sync fails even when online", async ({ page, context }) => {
    // Intercepter la requête check-in pour simuler une erreur serveur
    await page.route("**/api/v1/attendance/check-in", (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    })

    await page.click('button:has-text("Démarrer le cours")')
    await page.click('button:has-text("Je suis présent(e)")')

    // L'erreur devrait s'afficher
    await expect(page.locator("text=Erreur lors de l'enregistrement")).toBeVisible({
      timeout: 5000,
    })

    // La mutation devrait rester en queue pour retry ultérieur
    await expect(page.locator("text=en attente de synchronisation")).toBeVisible()
  })

  test("should handle QR scan when room not in IndexedDB cache", async ({ page, context }) => {
    // Vider le cache IndexedDB (simuler premier usage de l'app)
    await page.evaluate(() => {
      return indexedDB.deleteDatabase("edutrack_offline")
    })

    // Passer hors ligne
    await context.setOffline(true)

    await page.click('button:has-text("Démarrer le cours")')
    await page.click('button:has-text("Je suis présent(e)")')

    await expect(page.locator("text=Scanner le QR code")).toBeVisible()

    // Scanner un QR inconnu
    const unknownToken = "z".repeat(64)

    await page.fill('input[placeholder*="code"]', unknownToken)
    await page.click('button:has-text("Valider")')

    // L'app devrait afficher une erreur
    await expect(page.locator("text=QR non reconnu")).toBeVisible({ timeout: 3000 })

    // La mutation ne devrait pas être créée
    await expect(page.locator("text=en attente de synchronisation")).not.toBeVisible()
  })
})
