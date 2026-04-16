import { expect, test } from "@playwright/test"

import { loginAsTeacherUI, mockTeacherFlowApis } from "./helpers"

const openStudentAttendanceStep = async (page: import("@playwright/test").Page) => {
  const { slot } = await mockTeacherFlowApis(page)

  await loginAsTeacherUI(page)
  await page.getByTestId(`teacher-start-course-${slot.id}`).click()
  await page.getByTestId("teacher-checkin-submit").click()
  await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()
  await page.getByTestId("teacher-checkin-skip-qr").click()
  await expect(page.getByTestId("teacher-checkin-step-3")).toBeVisible()
}

test.describe("Appel élèves", () => {
  test("tous les élèves sont présents par défaut", async ({ page }) => {
    await openStudentAttendanceStep(page)

    const firstCheckbox = page.getByRole("checkbox").first()
    await expect(firstCheckbox).toHaveAttribute("data-state", "checked")

    const allCheckboxes = page.getByRole("checkbox")
    await expect(allCheckboxes.first()).toBeVisible()
    const count = await allCheckboxes.count()
    expect(count).toBeGreaterThan(1)

    for (let index = 0; index < count; index += 1) {
      await expect(allCheckboxes.nth(index)).toHaveAttribute("data-state", "checked")
    }
  })

  test("cocher un absent → décocher → retour présent", async ({ page }) => {
    await openStudentAttendanceStep(page)

    const firstCheckbox = page.getByRole("checkbox").first()

    await firstCheckbox.click()
    await expect(firstCheckbox).toHaveAttribute("data-state", "unchecked")

    await firstCheckbox.click()
    await expect(firstCheckbox).toHaveAttribute("data-state", "checked")
  })

  test("soumettre l'appel → confirmation toast", async ({ page }) => {
    await openStudentAttendanceStep(page)

    await page.getByTestId("teacher-students-submit").click()

    await expect(page.getByText(/Appel enregistré, 0 absent\(s\) notifié\(s\)/i).first()).toBeVisible()
  })
})
