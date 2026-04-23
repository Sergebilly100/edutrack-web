import { expect, test } from "@playwright/test"

import { loginAsTeacherUI, mockTeacherFlowApis, toDateKey } from "./helpers"

test.describe("Flux pointage prof", () => {
  test("le prof voit son EDT du jour", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)

    await loginAsTeacherUI(page)

    await expect(page.getByTestId("teacher-schedule-page")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mon planning" })).toBeVisible()
    await expect(page.getByTestId(`teacher-course-card-${slot.id}`)).toBeVisible()
    await expect(page.getByText(`${slot.subject_name} - ${slot.class_name}`)).toBeVisible()
  })

  test('le bouton "Démarrer le cours" est actif au bon créneau', async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)

    await loginAsTeacherUI(page)

    const startButton = page.getByTestId(`teacher-start-course-${slot.id}`)
    await expect(startButton).toBeVisible()
    await expect(startButton).toBeEnabled()
  })

  test('le pointage app → confirmation "Présent"', async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page, { checkInLateMinutes: 0 })

    await loginAsTeacherUI(page)

    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await expect(page.getByTestId("teacher-checkin-step-1")).toBeVisible()

    await page.getByTestId("teacher-checkin-submit").click()

    await expect(page.getByText("Présence notée").first()).toBeVisible()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()
  })

  test("le scan QR ouvre la caméra", async ({ page, context }) => {
    await context.grantPermissions(["camera"])
    await page.addInitScript(() => {
      class MockHtml5Qrcode {
        static async getCameras() {
          return [{ id: "camera-1", label: "Mock Camera" }]
        }

        private elementId: string

        constructor(elementId: string) {
          this.elementId = elementId
        }

        async start() {
          const container = document.getElementById(this.elementId)
          if (container && !container.querySelector("video")) {
            const video = document.createElement("video")
            video.setAttribute("playsinline", "true")
            video.setAttribute("data-testid", "teacher-qr-video")
            container.appendChild(video)
          }
        }

        async stop() {
          return undefined
        }

        async clear() {
          return undefined
        }
      }

      ;(window as Window & { __EDUTRACK_HTML5_QRCODE__?: unknown }).__EDUTRACK_HTML5_QRCODE__ = MockHtml5Qrcode
    })

    const { slot } = await mockTeacherFlowApis(page)

    await loginAsTeacherUI(page)

    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()

    await page.getByTestId("teacher-qr-open-camera").click()

    await expect(page.locator("#qr-reader video")).toBeVisible()
  })

  test("l'appel élèves liste la classe correcte", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)

    await loginAsTeacherUI(page)

    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()

    await page.getByTestId("teacher-checkin-skip-qr").click()
    await expect(page.getByText("Faire le pointage des élèves maintenant ?")).toBeVisible()
    await page.getByRole("button", { name: "Oui, maintenant" }).click()

    await expect(page.getByTestId("teacher-checkin-step-3")).toBeVisible()
    await expect(page.getByTestId("teacher-student-list")).toContainText("Aya Kouamé")
    await expect(page.getByTestId("teacher-student-list")).toContainText("Koffi N'Guessan")
  })

  test('déjà pointé → message "Déjà enregistré" sans bouton', async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page, {
      attendance: [
        {
          schedule_id: "slot-e2e-today",
          status: "present",
          date: toDateKey(new Date()),
        },
      ],
    })

    await loginAsTeacherUI(page)

    await expect(page.getByTestId(`teacher-course-status-${slot.id}`)).toHaveText("Présence confirmée")
    await expect(page.getByTestId(`teacher-start-course-${slot.id}`)).toHaveCount(0)
  })
})
