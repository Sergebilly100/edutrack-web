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

  it("utilise la date API et les horaires flexibles, avec le statut d'absence", async () => {
    getMock.mockResolvedValueOnce({ data: {
      date: "2026-10-16",
      schedules: [{ ...schedule, timeSlot: { ...schedule.timeSlot, startTime: "09:17:00", endTime: "10:43:00" }, attendance: { status: "absent" } }],
    } })

    expect(await fetchTeacherSchedule()).toEqual([expect.objectContaining({
      start_at: "2026-10-16T09:17:00.000Z",
      end_at: "2026-10-16T10:43:00.000Z",
      attendance_status: "absent",
    })])
  })

  it("rejette une réponse sans date métier au lieu d'utiliser celle de l'appareil", async () => {
    getMock.mockResolvedValueOnce({ data: [schedule] })
    await expect(fetchTeacherSchedule()).rejects.toThrow()
  })

  it("normalise les niveaux du catalogue et des créneaux, y compris une classe sans niveau", async () => {
    getMock.mockResolvedValueOnce({ data: {
      date: "2026-10-05", period: null,
      schedules: [
        { ...schedule, class: { ...schedule.class, levelId: "l6", levelName: "6ème" } },
        { ...schedule, id: "slot-2", class: { id: "class-2", name: "Ancienne classe", levelId: null, levelName: null } },
      ],
      teachers: [],
      classes: [
        { id: "class-1", name: "6ème A", levelId: "l6", levelName: "6ème" },
        { id: "class-2", name: "Ancienne classe", levelId: null, levelName: null },
      ],
      rooms: [], time_slots: [],
    } })

    const weekly = await fetchWeeklySchedule("2026-10-05")
    expect(weekly.catalog.classes.map((item) => [item.levelId, item.levelName])).toEqual([
      ["l6", "6ème"], [null, null],
    ])
    expect(weekly.schedules.map((item) => [item.class.levelId, item.class.levelName])).toEqual([
      ["l6", "6ème"], [null, null],
    ])
  })
})
