import { expect, test } from "@playwright/test"

test("le parent voit la révision puis une seule nouvelle version du bulletin", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("ivoiredu-tour-done-parent-portal", "1"))
  let inRevision = true
  await page.route("**/api/v1/auth/login/parent", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    accessToken: "parent-c30-token", tokenType: "Bearer", expiresIn: "15m", user: {
      id: "parent-c30", role: "parent", phone: "0700000000", fullName: "Parent Test",
      studentIds: ["student-c30"], mustChangePassword: false,
    },
  }) }))
  await page.route("**/api/v1/parent/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }))
  await page.route("**/api/v1/school/public-info*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ name: "École Test" }) }))
  await page.route("**/api/v1/parent/notifications*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0 }) }))
  await page.route("**/api/v1/parent/students", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "student-c30", first_name: "Aya", last_name: "Test", class_name: "6ème A" }] }) }))
  await page.route("**/api/v1/parent/students/student-c30/overview", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ latestPublishedReportCard: null }) }))
  await page.route("**/api/v1/parent/students/student-c30/report-cards", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      reportCards: inRevision ? [] : [{ id: "card-revision-2", periodLabel: "Trimestre 1", schoolYearLabel: "2026-2027", generalAverage: 14, rank: 1, classHeadcount: 2 }],
      inRevision,
    }),
  }))

  await page.goto("/parent/login")
  await page.getByRole("textbox", { name: "Numéro de téléphone" }).fill("0700000000")
  await page.getByRole("textbox", { name: "Mot de passe" }).fill("Test1234!")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await page.waitForURL(/\/parent\/dashboard/)
  await page.getByRole("link", { name: "Consulter les bulletins scolaires" }).click()
  await expect(page.getByText("Bulletin en révision")).toBeVisible()
  await expect(page.getByText("Une note publiée est incorrecte")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /télécharger/i })).toHaveCount(0)
  inRevision = false
  await page.getByRole("link", { name: "Accueil" }).click()
  await page.getByRole("link", { name: "Consulter les bulletins scolaires" }).click()
  await expect(page.getByText("14.00/20")).toBeVisible()
  await expect(page.getByText("Bulletin en révision")).toHaveCount(0)
  await expect(page.getByText("14.00/20")).toHaveCount(1)
})
