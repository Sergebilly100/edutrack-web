import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const ROOM_ID = "room-e2e-mgmt-1"
const ROOM_TOKEN = "a".repeat(64)

const mockRoomsApis = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/v1/rooms", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rooms: [
            {
              id: ROOM_ID,
              name: "Salle Informatique",
              building: "Annexe",
              capacity: 25,
              latitude: null,
              longitude: null,
              geoRadius: 100,
              isActive: true,
              createdAt: "2026-01-01T00:00:00Z",
              stats: { weeklySchedulesCount: 3, scansCount: 10 },
            },
          ],
        }),
      })
    } else if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "room-e2e-new", name: "Nouvelle Salle" }),
      })
    } else {
      await route.continue()
    }
  })

  await page.route(`**/api/v1/rooms/${ROOM_ID}/qr`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        room_name: "Salle Informatique",
        qr_token: ROOM_TOKEN,
        qr_url: `https://app.ivoiredu.ci/scan?token=${ROOM_TOKEN}`,
      }),
    })
  })
}

test.describe("Gestion des salles — directeur", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectorAuth(page)
    await mockRoomsApis(page)
  })

  test("la liste des salles s'affiche avec le QR disponible", async ({ page }) => {
    await loginAsDirectorUI(page)

    await page.goto("/rooms")
    await expect(page.getByTestId("rooms-page")).toBeVisible()
    await expect(page.getByText("Salle Informatique")).toBeVisible()
  })

  test("cliquer sur QR ouvre le dialog avec le QRCodeGenerator", async ({ page }) => {
    await loginAsDirectorUI(page)

    await page.goto("/rooms")
    await expect(page.getByText("Salle Informatique")).toBeVisible()

    // Le bouton QR dans la ligne de la salle (texte "QR")
    await page.getByRole("button", { name: /^QR$/i }).first().click()

    // Le dialog QR doit s'ouvrir
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/QR code de salle/i)).toBeVisible()
  })

  test("créer une salle → succès toast 'Salle ajoutée'", async ({ page }) => {
    await loginAsDirectorUI(page)

    await page.goto("/rooms")
    await expect(page.getByTestId("rooms-page")).toBeVisible()

    await page.getByRole("button", { name: /ajouter une salle/i }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.getByPlaceholder(/nom de la salle/i).fill("Salle Test E2E")
    // Le bouton de soumission est "Ajouter" en mode création
    await page.getByRole("button", { name: /^Ajouter$/i }).click()

    // Le toast Shadcn affiche "Salle ajoutée" dans le titre du toast (li[role="status"])
    await expect(page.locator('[role="status"]').filter({ hasText: /salle ajoutée/i })).toBeVisible({ timeout: 5000 })
  })
})
