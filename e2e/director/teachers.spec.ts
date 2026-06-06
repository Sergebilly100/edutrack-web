import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const TEACHER_ID = "teacher-e2e-1"

const TEACHER_DETAIL = {
  id: TEACHER_ID,
  name: "M. Koné",
  username: "kone",
  email: "kone@test.ci",
  phone: "0600000001",
  subjects: ["Maths"],
  teacherType: "vacataire",
  is_blocked: false,
  isBlocked: false,
  contractHoursPerWeek: null,
  blockReason: null,
  blockedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
}

const mockTeachersApis = async (page: import("@playwright/test").Page) => {
  // Route liste teachers — regex pour éviter de matcher les routes avec ID
  await page.route(/\/api\/v1\/teachers(\?|$)/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [TEACHER_DETAIL],
          pagination: { page: 1, limit: 200, total: 1, totalPages: 1 },
        }),
      })
    } else {
      await route.continue()
    }
  })

  await page.route(`**/api/v1/teachers/${TEACHER_ID}*`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(TEACHER_DETAIL),
      })
    } else if (route.request().method() === "PUT") {
      // Blocage / mise à jour teacher via PUT teachers/:id
      const body = route.request().postDataJSON() as Record<string, unknown> | null ?? {}
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...TEACHER_DETAIL, ...body, is_blocked: body.is_blocked ?? false }),
      })
    } else {
      await route.continue()
    }
  })

  await page.route(`**/api/v1/attendance/teachers/${TEACHER_ID}*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    })
  })

  await page.route(`**/api/v1/documents/teacher/${TEACHER_ID}*`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      })
    } else if (route.request().method() === "POST") {
      const fileName = "e2e-doc.pdf"
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "doc-e2e-1",
          name: fileName,
          url: `https://storage.example.com/${fileName}`,
          uploadedAt: "2026-06-06T10:00:00Z",
        }),
      })
    } else {
      await route.continue()
    }
  })

  // Stats par prof (utilisées dans la page détail)
  await page.route(`**/api/v1/teachers/${TEACHER_ID}/stats*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        attendanceRate: 0.9,
        totalScheduled: 10,
        totalPresent: 9,
        totalAbsent: 1,
        totalLate: 0,
      }),
    })
  })

  // Historique présences mensuel par prof
  await page.route(`**/api/v1/attendance/teachers/${TEACHER_ID}/monthly*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    })
  })
}

const openTeacherDetail = async (page: import("@playwright/test").Page) => {
  const cards = page.getByTestId("teacher-mobile-card")
  await expect(cards.first()).toBeVisible({ timeout: 10000 })
  await cards.first().click()
  await expect(page).toHaveURL(/\/teachers\/.+/)
}

test.describe("Gestion profs", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectorAuth(page)
    await mockTeachersApis(page)
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Professeurs" }).click()
    await expect(page).toHaveURL(/\/teachers/)
    await expect(page.getByRole("heading", { name: /Professeurs/i })).toBeVisible()
  })

  test("la liste des profs se charge", async ({ page }) => {
    await expect(page.getByTestId("teachers-list-table")).toBeVisible()
    await expect(page.getByTestId("teacher-mobile-card").first()).toBeVisible()
  })

  test("la recherche filtre les résultats", async ({ page }) => {
    const cards = page.getByTestId("teacher-mobile-card")
    await expect(cards.first()).toBeVisible()

    const firstTeacherName = (await cards.first().locator("p").first().textContent())?.trim() ?? ""
    expect(firstTeacherName.length).toBeGreaterThan(0)

    await page.getByTestId("datatable-search-input").fill(firstTeacherName)

    await expect(page.getByTestId("teacher-mobile-card")).toHaveCount(1)
    await expect(page.getByText(firstTeacherName).first()).toBeVisible()
  })

  test("navigation vers le détail prof", async ({ page }) => {
    await openTeacherDetail(page)
    await expect(page.getByRole("tab", { name: "Présences" }).first()).toBeVisible()
  })

  test("le blocage d'un prof requiert une raison", async ({ page }) => {
    await openTeacherDetail(page)
    await expect(page.getByRole("tab", { name: "Présences" }).first()).toBeVisible()

    const blockButton = page.getByRole("button", { name: "Bloquer" }).first()
    await blockButton.scrollIntoViewIfNeeded()
    await blockButton.click()

    const confirmButton = page.getByTestId("teacher-block-confirm-button")
    await expect(confirmButton).toBeDisabled()

    await page.getByTestId("teacher-block-reason-input").fill("Test E2E blocage")
    await expect(confirmButton).toBeEnabled()
  })

  test("upload d'un document apparaît dans la liste", async ({ page }) => {
    // Après l'upload, le mock GET documents renvoie le document créé
    let documentUploaded = false
    await page.route(`**/api/v1/documents/teacher/${TEACHER_ID}*`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: documentUploaded
              ? [{ id: "doc-e2e-1", name: "e2e-director.pdf", url: "https://storage.example.com/e2e-director.pdf", uploadedAt: "2026-06-06T10:00:00Z" }]
              : [],
          }),
        })
      } else if (route.request().method() === "POST") {
        documentUploaded = true
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "doc-e2e-1",
            name: "e2e-director.pdf",
            url: "https://storage.example.com/e2e-director.pdf",
            uploadedAt: "2026-06-06T10:00:00Z",
          }),
        })
      } else {
        await route.continue()
      }
    })

    await openTeacherDetail(page)
    await expect(page.getByRole("tab", { name: "Documents" }).first()).toBeVisible()

    await page.getByRole("tab", { name: "Documents" }).first().click()
    await expect(page.getByTestId("document-upload-dropzone")).toBeVisible()

    const fileName = `e2e-director-${Date.now()}.pdf`

    await page.getByTestId("document-upload-input").setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% E2E test file\n"),
    })

    await expect(page.getByText("Téléversé")).toBeVisible({ timeout: 10000 })
  })
})
