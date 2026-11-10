import { expect, test, type Page } from "@playwright/test"

async function loginDirector(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Identifiant", { exact: true }).fill("2250701234567")
  await page.getByLabel("Mot de passe", { exact: true }).fill("director2024")
  const login = page.waitForResponse((response) =>
    response.url().includes("/auth/login/") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Se connecter" }).click()
  expect((await login).status()).toBe(200)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { name: /^Bonjour,/ })).toBeVisible()
}

test("B04 : la visite ne démarre pas seule, se lance depuis l'aide et cède la place au dialogue de navigation", async ({ page }, testInfo) => {
  await loginDirector(page)
  const guide = page.getByRole("button", { name: "Fermer la visite" })
  // Aucun démarrage automatique après la connexion.
  await page.waitForTimeout(1500)
  await expect(guide).toHaveCount(0)

  await page.getByRole("button", { name: "Ouvrir l'aide de la page" }).click()
  await page.getByRole("button", { name: "Visite guidée de la page" }).click()
  await expect(guide).toBeVisible()

  // Joyride couvre les autres commandes pendant le tour. Déclencher le bouton
  // réel permet de vérifier le cas où un dialogue s'ouvre malgré cet overlay.
  await page.getByRole("button", { name: "Ouvrir le menu de navigation" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("dialog", { name: "Navigation principale" })).toBeVisible()
  await expect(guide).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("b04-dialogue-guide.png"), fullPage: true })
})

test("B06 : l'aide s'ouvre à 360 px et le centre d'aide est atteignable depuis le menu", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await loginDirector(page)
  await page.goto("/students")
  await page.getByRole("button", { name: "Ouvrir l'aide de la page" }).click()
  const panel = page.getByRole("dialog")
  await expect(panel.getByText("À quoi sert cette page")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await panel.getByRole("button", { name: "Fermer" }).click()
  await page.goto("/aide")
  await expect(page.getByRole("heading", { name: "Aide", exact: true })).toBeVisible()
})

for (const width of [320, 360, 393]) {
  test(`B05 : tableau de bord réel sans débordement à ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 })
    await loginDirector(page)
    await expect(page.getByText("Suivi financier", { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(await page.locator("main").evaluate((main) => main.scrollWidth - main.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`b05-dashboard-${width}.png`), fullPage: true })
  })
}
