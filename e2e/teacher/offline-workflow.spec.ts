import { expect, test, type Page } from "@playwright/test"

import { loginAsTeacherUI, mockTeacherFlowApis } from "./helpers"

/**
 * Bascule les routes attendance en "déconnecté" : les requêtes seront
 * abort() comme si le réseau était coupé. Les autres routes (auth, EDT,
 * élèves, salles) restent disponibles pour que l'UI affiche les données.
 */
const setApiOffline = async (page: Page) => {
  await page.route("**/api/v1/attendance/check-in", (route) => route.abort("internetdisconnected"))
  await page.route("**/api/v1/attendance/qr-scan", (route) => route.abort("internetdisconnected"))
  await page.route("**/api/v1/attendance/qr-skip", (route) => route.abort("internetdisconnected"))
  await page.route("**/api/v1/attendance/students/bulk", (route) => route.abort("internetdisconnected"))
}

const setApiOnline = async (page: Page) => {
  // Important : unroute attend que les handlers en cours se terminent (await),
  // puis on remet les nouveaux handlers. Sans ça, l'abort initial peut être
  // toujours actif quand la sync rejoue les requêtes.
  await page.unroute("**/api/v1/attendance/check-in")
  await page.unroute("**/api/v1/attendance/qr-scan")
  await page.unroute("**/api/v1/attendance/qr-skip")
  await page.unroute("**/api/v1/attendance/students/bulk")

  await page.route("**/api/v1/attendance/check-in", (route) => {
    // eslint-disable-next-line no-console
    console.log("[mock] check-in → 200 (online)")
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { lateMinutes: 0 } }),
    })
  })
  await page.route("**/api/v1/attendance/qr-scan", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { roomMismatch: false } }),
    })
  )
  await page.route("**/api/v1/attendance/qr-skip", (route) => {
    // eslint-disable-next-line no-console
    console.log("[mock] qr-skip → 200 (online)")
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })
  await page.route("**/api/v1/attendance/students/bulk", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { upsertedCount: 1 } }),
    })
  )
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms)

test.describe("Workflow attendance prof - offline → online", () => {
  test("check-in + skip QR offline → badge apparaît → sync auto au retour online", async ({
    page,
  }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" || /offline|sync|queue/i.test(msg.text())) {
        // eslint-disable-next-line no-console
        console.log(`[browser:${msg.type()}] ${msg.text()}`)
      }
    })

    // 1) Login prof (avec backend mocké : voir helpers.ts)
    await mockTeacherFlowApis(page)
    await loginAsTeacherUI(page)
    await pause(page, 800)

    // Vérifier qu'on est bien sur l'interface PROF (pas directeur)
    await expect(page.getByRole("heading", { name: "Mon planning" })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Espace professeur")).toBeVisible()

    // 2) Couper le réseau attendance
    await setApiOffline(page)
    await pause(page, 500)

    // 3) Ouvrir le dialogue de pointage
    const slot = page.getByTestId(/teacher-start-course-/).first()
    await expect(slot).toBeVisible({ timeout: 5000 })
    await slot.click()
    await pause(page, 600)

    // Étape 1 : "Je suis présent(e)"
    await expect(page.getByTestId("teacher-checkin-step-1")).toBeVisible()
    await page.getByTestId("teacher-checkin-submit").click()
    await pause(page, 1200)

    // Étape 2 : on est dans le scan QR - on clique "Valider sans QR"
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible({ timeout: 5000 })
    const skipBtn = page.getByTestId("teacher-checkin-skip-qr")
    await expect(skipBtn).toBeVisible({ timeout: 3000 })
    await skipBtn.click()
    await pause(page, 1500)

    // À ce moment : checkIn + qrSkip ont été tentés et ont échoué (réseau coupé).
    // Le fix isNetworkLevelError doit les avoir queueés → badge visible dans la TopBar.
    const badge = page.locator("button[aria-label*='action en attente'], button[aria-label*='actions en attente']").first()
    await expect(badge).toBeVisible({ timeout: 5000 })
    await pause(page, 1500)

    const badgeText = await badge.textContent()
    // eslint-disable-next-line no-console
    console.log(`[test] Badge texte = "${badgeText}"`)

    // 4) Après le skip QR, l'app ouvre la modale "Appel maintenant ou plus tard ?"
    //    On clique "Le faire plus tard" → ferme tout, retour au planning prof.
    const laterBtn = page.getByRole("button", { name: /Le faire plus tard/i })
    await expect(laterBtn).toBeVisible({ timeout: 5000 })
    await laterBtn.click()
    await pause(page, 1000)

    // 5) Le sheet est fermé : on peut maintenant cliquer le badge normalement
    await badge.click()
    await pause(page, 800)
    const dialog = page.getByRole("dialog", { name: /Actions en attente/i })
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await pause(page, 1500)

    // 5) Rétablir le réseau - le bouton "Synchroniser maintenant" doit être enabled
    await setApiOnline(page)
    await pause(page, 800)

    // Vérifier navigator.onLine et l'état du store offline
    const debugState = await page.evaluate(() => {
      return {
        navigatorOnline: navigator.onLine,
      }
    })
    // eslint-disable-next-line no-console
    console.log("[test] State avant sync:", debugState)

    const syncBtn = dialog.getByRole("button", { name: /Synchroniser maintenant/i })
    await expect(syncBtn).toBeEnabled({ timeout: 5000 })
    // eslint-disable-next-line no-console
    console.log("[test] Click sur Synchroniser maintenant")
    await syncBtn.click()
    await pause(page, 5000)

    // 6) Vérifier que le badge disparait après sync réussie
    await expect(badge).toHaveCount(0, { timeout: 10_000 })
    await pause(page, 1500)
  })
})
