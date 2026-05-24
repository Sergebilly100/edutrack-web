import { expect, test, type Page } from "@playwright/test"

const allPermissions = [
  "teachers.view",
  "students.view",
  "schedule.view",
  "schedule.edit",
  "attendance.view",
  "salary.view",
  "salary.mark_paid",
  "validations.view",
  "rooms.view",
  "import.students",
  "import.teachers",
  "import.schedule",
  "settings.school",
  "settings.positions",
  "settings.sms_templates",
  "subscriptions.view",
  "subscriptions.revenue",
]

const fakeJwt = () => {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    sub: "director-offline-e2e",
    role: "director",
    schemaName: "school_offline_e2e",
  })}.signature`
}

const weeklySchedulePayload = {
  date: "2026-05-18",
  period: {
    id: "period-offline-e2e",
    name: "Trimestre offline",
    valid_from: "2026-05-01",
    valid_to: "2026-06-30",
    is_active: true,
  },
  teachers: [
    {
      id: "teacher-offline-e2e",
      name: "Prof Offline",
      username: "prof.offline",
      subjects: ["Mathématiques"],
      is_blocked: false,
    },
  ],
  classes: [{ id: "class-offline-e2e", name: "3ème Offline" }],
  rooms: [{ id: "room-offline-e2e", name: "Salle Offline", qrToken: "qr-offline" }],
  time_slots: [
    {
      id: "slot-time-offline-e2e",
      label: "08:00 - 09:00",
      startTime: "08:00",
      endTime: "09:00",
      sortOrder: 1,
    },
  ],
  schedules: [
    {
      id: "schedule-offline-e2e",
      schedulePeriodId: "period-offline-e2e",
      dayOfWeek: 1,
      subject: "Mathématiques",
      startDate: null,
      endDate: null,
      pastAttendanceCount: 0,
      hasPastAttendance: false,
      teacher: {
        id: "teacher-offline-e2e",
        name: "Prof Offline",
        username: "prof.offline",
      },
      class: { id: "class-offline-e2e", name: "3ème Offline" },
      room: { id: "room-offline-e2e", name: "Salle Offline", qrToken: "qr-offline" },
      timeSlot: {
        id: "slot-time-offline-e2e",
        label: "08:00 - 09:00",
        startTime: "08:00",
        endTime: "09:00",
        sortOrder: 1,
      },
    },
  ],
}

async function mockDirectorApis(page: Page) {
  let apiOnline = true
  const token = fakeJwt()

  await page.route("**/api/v1/**", async (route) => {
    if (!apiOnline) {
      await route.abort("internetdisconnected")
      return
    }

    const url = new URL(route.request().url())
    const pathname = url.pathname

    if (pathname.endsWith("/auth/login/teacher") || pathname.endsWith("/auth/refresh")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: token,
          tokenType: "Bearer",
          expiresIn: "3600",
          user: {
            id: "director-offline-e2e",
            role: "director",
            name: "Directeur Offline",
            phone: null,
            email: "director.offline@example.com",
            profilePhotoUrl: null,
            mustChangePassword: false,
          },
        }),
      })
      return
    }

    if (pathname.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "director-offline-e2e",
            role: "director",
            name: "Directeur Offline",
            phone: null,
            email: "director.offline@example.com",
            profilePhotoUrl: null,
            mustChangePassword: false,
          },
          tenant: { id: "tenant-offline-e2e", status: "active", trialEndsAt: null },
        }),
      })
      return
    }

    if (pathname.endsWith("/permissions/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ permissions: allPermissions }),
      })
      return
    }

    if (pathname.endsWith("/school/info")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ onboarding_completed: true }),
      })
      return
    }

    if (pathname.endsWith("/settings/sms-price")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_enabled: true,
          monetize_parent_alerts: true,
          commission_pct: 10,
          sms_unit_price_fcfa: 10,
        }),
      })
      return
    }

    if (pathname.endsWith("/schedule/weekly")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(weeklySchedulePayload),
      })
      return
    }

    if (pathname.endsWith("/schedule/active")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: "2026-05-18",
          dayOfWeek: 1,
          period: weeklySchedulePayload.period,
          schedules: weeklySchedulePayload.schedules,
        }),
      })
      return
    }

    if (pathname.endsWith("/teachers")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "teacher-offline-e2e",
              name: "Prof Offline",
              username: "prof.offline",
              subjects: ["Mathématiques"],
              is_blocked: false,
            },
          ],
          pagination: { page: 1, limit: 200, total: 1, totalPages: 1 },
        }),
      })
      return
    }

    if (pathname.endsWith("/validations/pending/count")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total: 0, gps_suspicious: 0, short_hours: 0, missing_end_scan: 0 }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    })
  })

  return {
    goOffline: () => {
      apiOnline = false
    },
  }
}

test("restaure les anciennes donnees metier apres reload quand l'API est offline", async ({
  page,
}) => {
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`[browser:${message.type()}] ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => {
    console.error(`[browser:pageerror] ${error.message}`)
  })

  const api = await mockDirectorApis(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: "Emploi du temps" })).toBeVisible()
  await expect(page.getByText("Prof Offline").last()).toBeVisible()
  await expect(page.getByText("3ème Offline").last()).toBeVisible()

  await page.waitForFunction(async () => {
    const request = indexedDB.open("keyval-store")
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const tx = db.transaction("keyval", "readonly")
    const store = tx.objectStore("keyval")
    const getRequest = store.get("edutrack-query-cache-v1")
    const cache = await new Promise<{ queries?: Array<{ queryKey?: unknown[] }> } | undefined>(
      (resolve, reject) => {
        getRequest.onerror = () => reject(getRequest.error)
        getRequest.onsuccess = () => resolve(getRequest.result)
      }
    )
    db.close()
    return cache?.queries?.some((query) => query.queryKey?.[0] === "schedule-weekly")
  })

  api.goOffline()

  await page.reload()
  await expect(page.getByRole("heading", { name: "Emploi du temps" })).toBeVisible()
  await expect(page.getByText("Prof Offline").last()).toBeVisible()
  await expect(page.getByText("3ème Offline").last()).toBeVisible()
})
