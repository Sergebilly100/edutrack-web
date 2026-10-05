import { describe, expect, it, vi } from "vitest"

const getMock = vi.hoisted(() => vi.fn())
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock } }))

import { teacherScheduleApi } from "../attendance.api"

describe("teacher schedule display", () => {
  it("uses the resolved display value for the mobile week view", async () => {
    getMock.mockResolvedValueOnce({ data: [
      { id: "slot-1", subject: "Mathématiques", subjectDisplay: "Maths", class_name: "6ème A" },
      { id: "slot-2", subject: "Français", class_name: "6ème A" },
    ] })

    const slots = await teacherScheduleApi.getMyScheduleWeek("2026-10-05")
    expect(slots.map((slot) => slot.subject_name)).toEqual(["Maths", "Français"])
  })
})
