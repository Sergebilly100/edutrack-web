import { beforeEach, describe, expect, it, vi } from "vitest"

const getMock = vi.hoisted(() => vi.fn())
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock } }))

import { fetchActiveSchedules, fetchTeacherSchedule, fetchWeeklySchedule } from "../schedule.api"

const schedule = {
  id: "slot-1", schedulePeriodId: "period-1", dayOfWeek: 1,
  subject: "Mathématiques", subjectDisplay: "Maths",
  teacher: { id: "teacher-1", name: "Mme Koné", username: "kone" },
  class: { id: "class-1", name: "6ème A" },
  room: { id: "room-1", name: "A1", qrToken: "qr" },
  timeSlot: { id: "time-1", label: "8h", startTime: "08:00:00", endTime: "09:00:00", sortOrder: 1 },
}

describe("schedule API subject display", () => {
  beforeEach(() => vi.clearAllMocks())

  it("preserves the canonical value alongside the display value in weekly and active reads", async () => {
    getMock.mockResolvedValueOnce({ data: {
      date: "2026-10-05", period: null, schedules: [schedule],
      teachers: [], classes: [], rooms: [], time_slots: [],
    } }).mockResolvedValueOnce({ data: {
      date: "2026-10-05", dayOfWeek: 1, period: null, schedules: [schedule],
    } })

    const weekly = await fetchWeeklySchedule("2026-10-05")
    const active = await fetchActiveSchedules("2026-10-05")
    expect(weekly.schedules[0]).toMatchObject({ subject: "Mathématiques", subjectDisplay: "Maths" })
    expect(active.schedules[0]).toMatchObject({ subject: "Mathématiques", subjectDisplay: "Maths" })
  })

  it("shows the display value for teachers and falls back for historical responses", async () => {
    getMock.mockResolvedValueOnce({ data: { date: "2026-10-05", schedules: [schedule] } })
      .mockResolvedValueOnce({ data: { date: "2026-10-05", schedules: [{ ...schedule, subjectDisplay: undefined }] } })
    expect((await fetchTeacherSchedule())[0]?.subject_name).toBe("Maths")
    expect((await fetchTeacherSchedule())[0]?.subject_name).toBe("Mathématiques")
  })
})
