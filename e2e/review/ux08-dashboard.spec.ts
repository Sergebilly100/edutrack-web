import { expect, test } from "@playwright/test"

import { returningUser } from "../ui-helpers"

test.use({ timezoneId: "Europe/Paris" })

test("résumé professeur terminé lisible sur mobile en clair et sombre", async ({ page }) => {
  await returningUser(page)
  await page.clock.install({ time: new Date("2026-10-15T12:00:00.000Z") })

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    const user = { id: "teacher-ux08", role: "teacher", name: "Professeur UX08", phone: null, email: "prof@example.com", profilePhotoUrl: null }
    let body: unknown = {}
    if (path.endsWith("/auth/login/teacher")) body = { accessToken: "ux08-token", tokenType: "Bearer", expiresIn: "3600", user }
    else if (path.endsWith("/auth/refresh")) body = { accessToken: "ux08-token", tokenType: "Bearer", expiresIn: "3600" }
    else if (path.endsWith("/auth/me")) body = { user }
    else if (path.endsWith("/permissions/me")) body = { permissions: ["attendance.view"] }
    else if (path.endsWith("/schedule/teacher/me")) body = {
      date: "2026-10-15",
      schedules: [
        {
          id: "slot-1", schedulePeriodId: "period-1", dayOfWeek: 4, subject: "Mathématiques", subjectDisplay: "Mathématiques",
          teacher: { id: "teacher-ux08", name: "Professeur UX08", username: "prof.ux08" },
          class: { id: "class-1", name: "6ème A" }, room: { id: "room-1", name: "A1", qrToken: "qr" },
          timeSlot: { id: "time-1", label: "08:00 – 09:00", startTime: "08:00:00", endTime: "09:00:00", sortOrder: 1 },
          attendance: { status: null },
        },
        {
          id: "slot-2", schedulePeriodId: "period-1", dayOfWeek: 4, subject: "Français", subjectDisplay: "Français",
          teacher: { id: "teacher-ux08", name: "Professeur UX08", username: "prof.ux08" },
          class: { id: "class-1", name: "6ème A" }, room: { id: "room-1", name: "A1", qrToken: "qr" },
          timeSlot: { id: "time-2", label: "10:17 – 11:23", startTime: "10:17:00", endTime: "11:23:00", sortOrder: 2 },
          attendance: { status: "absent" },
        },
      ],
    }
    else if (path.endsWith("/academic/teacher-context")) body = { classes: [], gradingPeriods: [] }
    else if (path.endsWith("/conduct/teacher-actions")) body = { teacherActions: [] }
    else if (path.endsWith("/teacher/notifications")) body = []
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })

  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/dashboard/)

  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => localStorage.setItem("edutrack-theme", value), theme)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/)

    for (const width of [320, 360, 393]) {
      await page.setViewportSize({ width, height: 780 })
      const region = page.getByRole("region", { name: "Résumé des cours du jour" })
      await expect(region.getByRole("heading", { name: "Journée terminée" })).toBeVisible()
      await expect(region).toContainText("Vos 2 cours prévus aujourd’hui sont terminés")
      await expect(page.getByText("Absent", { exact: true })).toBeVisible()
      await expect(page.getByText("Terminé", { exact: true })).toBeVisible()
      await expect(page.getByText("10:17", { exact: true })).toBeVisible()
      const button = region.getByRole("button", { name: "Voir le planning" })
      await expect(button).toBeVisible()
      expect(await button.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48)
      expect(await region.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
  }
})
