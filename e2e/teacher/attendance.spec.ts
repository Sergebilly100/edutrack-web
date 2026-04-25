import { expect, test } from "@playwright/test"

import { loginAsTeacherUI, mockTeacherFlowApis } from "./helpers"

const markAllStudentsPresent = async (page: import("@playwright/test").Page) => {
  const presentButtons = page.locator('[data-testid^="teacher-student-present-"]')
  const count = await presentButtons.count()
  expect(count).toBeGreaterThan(0)
  for (let index = 0; index < count; index += 1) {
    await presentButtons.nth(index).click()
  }
}

const openStudentAttendanceStep = async (page: import("@playwright/test").Page) => {
  const { slot } = await mockTeacherFlowApis(page)

  await loginAsTeacherUI(page)
  await page.getByTestId(`teacher-start-course-${slot.id}`).click()
  await page.getByTestId("teacher-checkin-submit").click()
  await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()
  await page.getByTestId("teacher-checkin-skip-qr").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("button", { name: "Oui, maintenant" })).toBeVisible()
  await page.getByRole("button", { name: "Oui, maintenant" }).click()
  await expect(page.getByTestId("teacher-checkin-step-3")).toBeVisible()
}

test.describe("Appel élèves", () => {
  test("les élèves sont à marquer par défaut", async ({ page }) => {
    await openStudentAttendanceStep(page)

    await expect(page.getByText(/3 à marquer/i)).toBeVisible()
    await expect(page.getByTestId("teacher-students-submit")).toBeDisabled()
  })

  test("marquer absent puis présent met à jour les compteurs", async ({ page }) => {
    await openStudentAttendanceStep(page)

    const studentId = "student-e2e-1"
    const absentButton = page.getByTestId(`teacher-student-absent-${studentId}`)
    const presentButton = page.getByTestId(`teacher-student-present-${studentId}`)
    const row = page.getByTestId(`teacher-student-row-${studentId}`)

    await absentButton.click()
    await expect(row).toContainText("Aya Kouamé")
    await expect(page.getByText(/1 absent/i)).toBeVisible()

    await presentButton.click()
    await expect(page.getByText(/0 absent/i)).toBeVisible()
  })

  test("soumettre l'appel → confirmation toast", async ({ page }) => {
    await openStudentAttendanceStep(page)

    await markAllStudentsPresent(page)
    await page.getByTestId("teacher-students-submit").click()

    await expect(page.getByText(/Appel enregistré — 0 absent\(s\)/i).first()).toBeVisible()
  })
})
