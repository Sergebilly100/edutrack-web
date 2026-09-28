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

test("B04 : le vrai guide cède la place au dialogue de navigation", async ({ page }, testInfo) => {
  await loginDirector(page)
  // Joyride masque son portail à l'arbre ARIA pendant le spotlight.
  const guide = page.locator("button").filter({ hasText: "Passer le tour" })
  await expect(guide).toBeVisible()

  // Joyride couvre les autres commandes pendant le tour. Déclencher le bouton
  // réel permet de vérifier le cas où un dialogue s'ouvre malgré cet overlay.
  await page.getByRole("button", { name: "Ouvrir le menu de navigation" })
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.getByRole("dialog", { name: "Navigation principale" })).toBeVisible()
  await expect(guide).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem("ivoiredu-tour-done-dashboard"))).toBeNull()
  await page.screenshot({ path: testInfo.outputPath("b04-dialogue-guide.png"), fullPage: true })
})

for (const width of [320, 360, 393]) {
  test(`B05 : tableau de bord réel sans débordement à ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(() => localStorage.setItem("ivoiredu-tour-done-dashboard", "1"))
    await loginDirector(page)
    await expect(page.getByText("Suivi financier", { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(await page.locator("main").evaluate((main) => main.scrollWidth - main.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`b05-dashboard-${width}.png`), fullPage: true })
  })
}
