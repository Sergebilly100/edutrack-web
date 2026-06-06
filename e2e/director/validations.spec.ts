import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const currentMonth = new Date().toISOString().slice(0, 7)

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockPendingValidations = async (page: ReturnType<typeof test["use"]> extends never ? never : Parameters<Parameters<typeof test>[1]>[0]["page"], overrides?: {
  gps?: unknown[]
  shortHours?: unknown[]
}) => {
  const body = {
    gps_suspicious: overrides?.gps ?? [],
    short_hours: overrides?.shortHours ?? [],
  }
  await page.route("**/api/v1/validations/pending*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  )
}

const mockMissingEndScans = async (
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  teachers: unknown[] = []
) => {
  await page.route("**/api/v1/validations/missing-end-scans*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(teachers) })
  )
}

const mockPendingCount = async (page: Parameters<Parameters<typeof test>[1]>[0]["page"]) => {
  await page.route("**/api/v1/validations/pending/count*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ gps_suspicious: 0, short_hours: 0, total: 0 }),
    })
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Validations - directeur", () => {
  test.beforeEach(async ({ page }) => {
    // Desktop pour que les colonnes de table (Créneau, Salle) et les boutons soient visibles
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockDirectorAuth(page)
    await mockPendingCount(page)
  })

  // ── Navigation et structure ─────────────────────────────────────────────

  test("la page s'affiche avec les 3 onglets", async ({ page }) => {
    await mockPendingValidations(page)
    await mockMissingEndScans(page)
    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(page.getByRole("heading", { name: /validation des horaires/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /présences suspectes/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /heures à valider/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /scan de fin/i })).toBeVisible()
  })

  test("l'onglet GPS affiche les colonnes Créneau et Salle", async ({ page }) => {
    await mockPendingValidations(page, {
      gps: [
        {
          attendance_id: "att-e2e-1",
          teacher_id: "t-1",
          teacher_name: "M. Koné",
          course_name: "Maths",
          class_name: "3A",
          date: "2024-03-10",
          checked_in_at: "2024-03-10T08:02:00",
          checked_out_at: null,
          geo_status: "suspicious",
          checkin_distance: 150,
          actual_minutes: null,
          schedule_duration_minutes: 60,
          validation_reason: null,
          hourly_rate: 5000,
          kind: "gps_suspicious",
          slot_label: "8h-9h",
          room_name: "Salle A1",
        },
      ],
    })
    await mockMissingEndScans(page)
    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(page.getByRole("heading", { name: /validation des horaires/i })).toBeVisible()
    await page.getByRole("tab", { name: /présences suspectes/i }).click()

    await expect(page.getByRole("columnheader", { name: /créneau/i })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: /salle/i })).toBeVisible()
    await expect(page.getByText("8h-9h").filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText("Salle A1").filter({ visible: true }).first()).toBeVisible()
  })

  test("cliquer Valider ouvre une modale de confirmation GPS", async ({ page }) => {
    await mockPendingValidations(page, {
      gps: [
        {
          attendance_id: "att-e2e-1",
          teacher_id: "t-1",
          teacher_name: "M. Koné",
          course_name: "Maths",
          class_name: "3A",
          date: "2024-03-10",
          checked_in_at: "2024-03-10T08:02:00",
          checked_out_at: null,
          geo_status: "suspicious",
          checkin_distance: 150,
          actual_minutes: null,
          schedule_duration_minutes: 60,
          validation_reason: null,
          hourly_rate: null,
          kind: "gps_suspicious",
          slot_label: null,
          room_name: null,
        },
      ],
    })
    await mockMissingEndScans(page)
    await page.route("**/api/v1/validations/att-e2e-1/approve*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    )

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(page.getByRole("heading", { name: /validation des horaires/i })).toBeVisible()
    await page.getByRole("tab", { name: /présences suspectes/i }).click()

    await page.getByRole("button", { name: /valider/i }).first().click()

    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText(/valider la présence de M\. Koné/i)).toBeVisible()
  })

  // ── Onglet Scan de fin ──────────────────────────────────────────────────

  test("l'onglet Scan de fin affiche les compteurs avertissements/sanctions", async ({ page }) => {
    await mockPendingValidations(page)
    await mockMissingEndScans(page, [
      {
        teacher_id: "t-3",
        teacher_name: "M. Diallo",
        missing_end_scan_count: 1,
        warning_count: 1,
        sanction_count: 1,
        warning_sent: false,
        sessions: [
          {
            date: "2024-03-10",
            schedule_id: "sch-1",
            attendance_id: "att-e2e-2",
            subject: "Sciences",
            time_slot: "10h-11h",
            room_name: "Salle C3",
            end_scan_action: "sanctioned",
            end_scan_action_reason: "Absent confirmé",
            end_scan_action_at: "2024-03-11T10:00:00",
            end_scan_action_cancelled_at: null,
          },
        ],
      },
    ])

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await page.getByRole("tab", { name: /scan de fin/i }).click()

    await expect(page.getByText("M. Diallo")).toBeVisible()
    // Badge "X sanction" visible dans la ligne du prof
    await expect(page.getByText(/1 sanction/i)).toBeVisible()
  })

  test("les boutons Tolérer et Sanctionner apparaissent pour une session sans action", async ({ page }) => {
    await mockPendingValidations(page)
    await mockMissingEndScans(page, [
      {
        teacher_id: "t-3",
        teacher_name: "M. Diallo",
        missing_end_scan_count: 1,
        warning_count: 0,
        sanction_count: 0,
        warning_sent: false,
        sessions: [
          {
            date: "2024-03-10",
            schedule_id: "sch-1",
            attendance_id: "att-e2e-2",
            subject: "Sciences",
            time_slot: "10h-11h",
            room_name: "Salle C3",
            end_scan_action: null,
            end_scan_action_reason: null,
            end_scan_action_at: null,
            end_scan_action_cancelled_at: null,
          },
        ],
      },
    ])

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await page.getByRole("tab", { name: /scan de fin/i }).click()
    await page.getByText("M. Diallo").click()

    await expect(page.getByRole("button", { name: /tolérer avec avertissement/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /sanctionner/i })).toBeVisible()
  })

  test("cliquer Tolérer ouvre la modale avec info salaire intact", async ({ page }) => {
    await mockPendingValidations(page)
    await mockMissingEndScans(page, [
      {
        teacher_id: "t-3",
        teacher_name: "M. Diallo",
        missing_end_scan_count: 1,
        warning_count: 0,
        sanction_count: 0,
        warning_sent: false,
        sessions: [
          {
            date: "2024-03-10",
            schedule_id: "sch-1",
            attendance_id: "att-e2e-2",
            subject: "Sciences",
            time_slot: "10h-11h",
            room_name: "Salle C3",
            end_scan_action: null,
            end_scan_action_reason: null,
            end_scan_action_at: null,
            end_scan_action_cancelled_at: null,
          },
        ],
      },
    ])
    await page.route("**/api/v1/validations/end-scan-action*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    )

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await page.getByRole("tab", { name: /scan de fin/i }).click()
    await page.getByText("M. Diallo").click()
    await page.getByRole("button", { name: /tolérer avec avertissement/i }).click()

    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText(/avertissement sera envoyé/i)).toBeVisible()
  })

  test("le badge Sanctionné apparaît et le bouton Annuler la sanction est visible", async ({ page }) => {
    await mockPendingValidations(page)
    await mockMissingEndScans(page, [
      {
        teacher_id: "t-3",
        teacher_name: "M. Diallo",
        missing_end_scan_count: 1,
        warning_count: 0,
        sanction_count: 1,
        warning_sent: false,
        sessions: [
          {
            date: "2024-03-10",
            schedule_id: "sch-1",
            attendance_id: "att-e2e-2",
            subject: "Sciences",
            time_slot: "10h-11h",
            room_name: null,
            end_scan_action: "sanctioned",
            end_scan_action_reason: "Absent confirmé",
            end_scan_action_at: "2024-03-11T10:00:00",
            end_scan_action_cancelled_at: null,
          },
        ],
      },
    ])

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await page.getByRole("tab", { name: /scan de fin/i }).click()
    await page.getByText("M. Diallo").click()

    await expect(page.getByText("Sanctionné").filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /annuler la sanction/i })).toBeVisible()
  })
})
