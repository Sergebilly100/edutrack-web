import { expect, test } from "@playwright/test"

import { mockDirectorAuth } from "./helpers"

const STUDENT_ID = "student-e2e-1"

const STUDENT = {
  id: STUDENT_ID,
  firstName: "Amara",
  lastName: "Koné",
  matricule: "MAT-001",
  classId: "class-e2e-1",
  className: "3ème A",
  parentName: "M. Koné Jean",
  parentPhone: "0700000001",
  parentPhone2: null,
  parentEmail: null,
  parentName2: null,
  birthDate: null,
  note: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

async function setupStudentsPage(page: import("@playwright/test").Page, students: unknown[] = [STUDENT]) {
  await page.setViewportSize({ width: 1280, height: 900 })

  // Un seul catch-all qui gère toutes les routes par path — pas de conflits de priorité
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

    if (path.endsWith("/auth/refresh")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ accessToken: "director-e2e-token" }) })
    }
    if (path.endsWith("/auth/me") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({
          user: { id: "director-e2e-user", role: "director", name: "Directeur E2E", phone: null,
            email: "directeur@sainte-marie.ci", profilePhotoUrl: null, mustChangePassword: false },
          tenant: { id: "tenant-e2e", status: "active", trialEndsAt: null },
        }) })
    }
    if (path.endsWith("/permissions/me")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ permissions: [
          "teachers.view", "teachers.edit", "teachers.block", "teachers.documents",
          "students.view", "students.create",
          "schedule.view", "schedule.edit",
          "attendance.view",
          "salary.view", "salary.mark_paid", "salary.export",
          "validations.view",
          "rooms.view", "rooms.create", "rooms.edit", "rooms.delete",
          "import.students", "import.teachers", "import.schedule",
          "settings.school", "settings.positions", "settings.sms_templates",
          "subscriptions.view", "subscriptions.revenue",
        ] }) })
    }
    if (path.endsWith("/school/info")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ onboarding_completed: true }) })
    }
    if (path.endsWith("/validations/pending/count")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ total: 0, gps_suspicious: 0, short_hours: 0, missing_end_scan: 0 }) })
    }
    // Liste élèves — chemin exact /students (avec ou sans query params)
    if (/\/students$/.test(path) && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({
          data: students,
          pagination: { page: 1, limit: 100, total: students.length, totalPages: students.length > 0 ? 1 : 0 },
        }) })
    }
    // Détail élève
    if (path.includes(`/students/${STUDENT_ID}`)) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: STUDENT }) })
    }
    if (path.endsWith("/schedule/weekly")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ date: "2026-06-06", period: null, schedules: [],
          teachers: [], classes: [{ id: "class-e2e-1", name: "3ème A" }], rooms: [], time_slots: [] }) })
    }
    if (path.endsWith("/schedule/periods")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ periods: [] }) })
    }
    if (path.includes("/attendance")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [], presentCount: 0, absentCount: 0, unmarkedCount: 0, courses: [] }) })
    }
    if (path.endsWith("/dashboard/stats")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({
          teacherAttendance: { globalRate: 0, partTime: { present: 0, expected: 0, rate: 0 }, fullTime: { present: 0, expected: 0, rate: 0 } },
          studentAttendance: { rate: 0, present: 0, absent: 0, notMarked: 0, total: 0 },
          salaries: { monthlyTotal: 0, toPayCurrentPeriod: 0, totalPaid: 0, remainingToPay: 0, economy: { label: "", plannedHours: 0, completedHours: 0, savedAmount: 0 } },
          subscriptions: { isEnabled: false, collectedAmount: 0, activeSubscribers: 0, collectionRate: 0, expectedAmount: 0 },
        }) })
    }
    if (path.includes("/billing/salary")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ month: "2026-06", lastComputedAt: null, items: [], referenceMonth: "2026-06", count: 0, totalRemainingFcfa: 0, months: [] }) })
    }
    if (path.includes("/teachers")) {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { page: 1, limit: 200, total: 0, totalPages: 0 } }) })
    }
    // Catch-all pour tout le reste
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ data: [] }) })
  })

  await page.goto("/login")
  await page.waitForURL(/\/(login|dashboard)/, { timeout: 15000 })
  if (page.url().includes("/login")) {
    await expect(page.getByLabel("Identifiant")).toBeVisible()
    await page.getByLabel("Identifiant").fill("directeur@sainte-marie.ci")
    await page.getByLabel("Mot de passe").fill("Test1234!")
    await page.getByRole("button", { name: "Se connecter" }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 25000 })
  }

  await page.goto("/students")
  await expect(page).toHaveURL(/\/students/)
}

test.describe("Gestion élèves — directeur", () => {
  test("la page élèves s'affiche avec le titre", async ({ page }) => {
    await setupStudentsPage(page)
    await expect(page.getByRole("heading", { name: /élèves/i })).toBeVisible({ timeout: 10000 })
  })

  test("la liste affiche un élève avec son nom et sa classe", async ({ page }) => {
    await setupStudentsPage(page)
    // Le nom est construit : lastName + " " + firstName → "Koné Amara"
    // .last() car le premier match peut être dans un élément caché (mobile card)
    await expect(page.getByText("Koné Amara").last()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("3ème A").last()).toBeVisible()
  })

  test("l'état vide s'affiche quand aucun élève n'est trouvé", async ({ page }) => {
    await setupStudentsPage(page, [])
    await expect(page.getByRole("heading", { name: /aucun élève/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test("navigation vers le détail d'un élève", async ({ page }) => {
    await setupStudentsPage(page)
    await expect(page.getByText("Koné Amara").last()).toBeVisible({ timeout: 10000 })
    await page.getByText("Koné Amara").last().click()
    await expect(page).toHaveURL(new RegExp(`/students/${STUDENT_ID}`))
  })

  test("le bouton 'Ajouter un élève' ouvre la modale", async ({ page }) => {
    await setupStudentsPage(page)
    await expect(page.getByRole("heading", { name: /élèves/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole("button", { name: /ajouter un élève/i }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("dialog").getByRole("heading", { name: /ajouter un élève/i })).toBeVisible()
  })
})
