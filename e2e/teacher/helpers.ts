import { expect, type Page } from "@playwright/test"

const TEACHER_IDENTIFIER = process.env.E2E_TEACHER_IDENTIFIER ?? "kouadio.nguessan@sainte-marie.ci"
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASSWORD ?? "Test1234!"
const TENANT_SCHEMA = process.env.E2E_SCHEMA_NAME ?? "school_sainte_marie"

type AttendanceStatus = "present" | "absent" | "late" | "excused"

type TeacherAttendance = {
  schedule_id: string
  status: AttendanceStatus
  date?: string
  late_minutes?: number | null
}

type Student = {
  id: string
  first_name: string
  last_name: string
}

type Slot = {
  id: string
  class_id: string
  class_name: string
  subject_name: string
  room_id: string
  room_name: string
  day_of_week: number
  start_time: string
  end_time: string
}

type TeacherFlowMockOptions = {
  slot?: Partial<Slot>
  attendance?: TeacherAttendance[]
  students?: Student[]
  checkInLateMinutes?: number | null
  roomMismatch?: boolean
}

const pad = (value: number) => String(value).padStart(2, "0")

export const toDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const toDayOfWeek = (date: Date): number => {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

const toTime = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`

export const createCurrentSlot = (): Slot => {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(start.getMinutes() - 5)

  const end = new Date(now)
  end.setMinutes(end.getMinutes() + 45)

  return {
    id: "slot-e2e-today",
    class_id: "class-e2e-3a",
    class_name: "3ème A",
    subject_name: "Mathématiques",
    room_id: "room-e2e-a1",
    room_name: "Salle A1",
    day_of_week: toDayOfWeek(now),
    start_time: toTime(start),
    end_time: toTime(end),
  }
}

export const createDefaultStudents = (): Student[] => [
  { id: "student-e2e-1", first_name: "Aya", last_name: "Kouamé" },
  { id: "student-e2e-2", first_name: "Koffi", last_name: "N'Guessan" },
  { id: "student-e2e-3", first_name: "Mariam", last_name: "Koné" },
]

export const mockTeacherFlowApis = async (
  page: Page,
  options: TeacherFlowMockOptions = {}
): Promise<{ slot: Slot; todayKey: string }> => {
  const baseSlot = createCurrentSlot()
  const slot: Slot = { ...baseSlot, ...(options.slot ?? {}) }
  const todayKey = toDateKey(new Date())

  await page.route("**/auth/login/teacher", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "teacher-e2e-token",
        tokenType: "Bearer",
        expiresIn: "3600",
        user: {
          id: "teacher-e2e-user",
          role: "teacher",
          name: "Professeur E2E",
          phone: null,
          email: TEACHER_IDENTIFIER,
          username: "prof.e2e",
        },
      }),
    })
  })

  await page.route("**/api/v1/schedule/teacher/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [slot] }),
    })
  })

  await page.route("**/api/v1/attendance/teacher/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: options.attendance ?? [] }),
    })
  })

  await page.route("**/api/v1/attendance/check-in", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { lateMinutes: options.checkInLateMinutes ?? 0 },
      }),
    })
  })

  await page.route("**/api/v1/attendance/qr-scan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { roomMismatch: options.roomMismatch ?? false },
      }),
    })
  })

  await page.route("**/api/v1/students*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: options.students ?? createDefaultStudents() }),
    })
  })

  await page.route("**/api/v1/attendance/students/bulk", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })

  return { slot, todayKey }
}

export const loginAsTeacherUI = async (page: Page) => {
  await page.goto("/login")

  await page.getByLabel("Identifiant").fill(TEACHER_IDENTIFIER)
  await page.getByLabel("Mot de passe").fill(TEACHER_PASSWORD)
  await page.getByLabel("Schéma tenant").fill(TENANT_SCHEMA)
  await page.getByRole("button", { name: "Se connecter" }).click()

  await page.waitForURL(/\/attendance/)
  await expect(page).toHaveURL(/\/attendance/)
}
