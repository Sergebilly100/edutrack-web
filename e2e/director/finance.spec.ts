import { expect, test, type Page } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const mockFinanceApis = async (page: Page) => {
  let paymentRequests = 0
  await page.route("**/api/v1/permissions/me*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ permissions: [
      "payments.view", "payments.record", "payments.cancel",
      "tuition.view", "tuition.edit", "tuition.grant_discount",
      "settings.school", "subscription_plans.view", "subscription_plans.edit",
    ] }),
  }))
  await page.route("**/api/v1/school-years*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ schoolYears: [{ id: "year-1", label: "2026-2027", status: "active", startDate: "2026-09-01", endDate: "2027-06-30", endOfYearReviewStartDate: "2027-05-01" }] }),
  }))
  await page.route("**/api/v1/levels*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ levels: [{ id: "level-1", name: "6ème", orderIndex: 1, isExamClass: false }] }),
  }))
  await page.route("**/api/v1/tuition-plans?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ tuitionPlans: [] }),
  }))
  await page.route("**/api/v1/students?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      data: [{ id: "student-1", firstName: "Awa", lastName: "Koné", matricule: "MAT-001", classId: "class-1", className: "6ème A", isActive: true }],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
    }),
  }))
  await page.route("**/api/v1/payments", async (route) => {
    paymentRequests += 1
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        payment: { id: `payment-${paymentRequests}`, studentId: "student-1", schoolYearId: "year-1", amount: 25000, method: "cash", source: "cashier_manual", status: "confirmed", receiptNumber: `REC-${paymentRequests}`, createdAt: new Date().toISOString() },
        financialStatus: { studentId: "student-1", schoolYearId: "year-1", totalDue: 100000, confirmedPaid: 25000, remainingDue: 75000, cumulativeExpectedAtDate: 0, standing: "up_to_date", currency: "FCFA" },
      }),
    })
  })
  return { getPaymentRequests: () => paymentRequests }
}

test("saisie rapide : recherche, Entrée unique et adaptation mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockDirectorAuth(page)
  const finance = await mockFinanceApis(page)
  await loginAsDirectorUI(page)
  await page.goto("/finance/encaissements")
  await expect(page.getByRole("heading", { name: "Encaissements" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Enregistrement" })).toHaveAttribute("aria-selected", "true")
  const studentSearch = page.getByRole("combobox", { name: "Nom ou matricule" })
  await studentSearch.fill("Awa")
  await page.getByRole("option", { name: /Awa/ }).click()
  const amount = page.getByLabel("Montant ligne 1")
  await amount.fill("25000")
  await amount.press("Enter")
  await amount.press("Enter")

  await expect(page.getByText("1 paiement enregistré", { exact: true })).toBeVisible()
  expect(finance.getPaymentRequests()).toBe(1)

  await page.setViewportSize({ width: 393, height: 851 })
  await expect(page.getByRole("button", { name: "Enregistrer et continuer" })).toBeVisible()
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflows).toBe(false)
})
