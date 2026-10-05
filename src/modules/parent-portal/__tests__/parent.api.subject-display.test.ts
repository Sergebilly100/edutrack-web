import { describe, expect, it, vi } from "vitest"

const getMock = vi.hoisted(() => vi.fn())
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock } }))

import { getParentSchedule } from "../parent.api"

describe("parent schedule API", () => {
  it("uses the display value and preserves the canonical subject with a historical fallback", async () => {
    getMock.mockResolvedValueOnce({ data: {
      week_label: "2026-W41", days: [{ day: "2026-10-05", slots: [
        { time: "8h", subject: "Mathématiques", subjectDisplay: "Maths", teacher: "Mme Koné", room: "A1", status: "upcoming" },
        { time: "9h", subject: "Français", teacher: "Mme Koné", room: "A1", status: "upcoming" },
      ] }],
    } })
    const response = await getParentSchedule("student-1", "2026-W41")
    expect(response.days[0]?.slots[0]).toMatchObject({ subject: "Mathématiques", subjectDisplay: "Maths" })
    expect(response.days[0]?.slots[1]).toMatchObject({ subject: "Français", subjectDisplay: "Français" })
  })
})
