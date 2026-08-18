import { describe, expect, it } from "vitest"

import { computeAbsenceHours } from "../salary-helpers"

describe("computeAbsenceHours", () => {
  it("compte le reliquat non valide comme absence partielle", () => {
    const now = new Date("2026-04-10T12:00:00.000Z")

    const total = computeAbsenceHours(
      [
        {
          date: "2026-04-10",
          endTime: "10:00",
          attendanceStatus: "present",
          validationStatus: "approved",
          hoursPlanned: 2,
          hoursDone: 1.5,
        },
      ],
      now
    )

    expect(total).toBe(0.5)
  })

  it("ignore le reliquat d'un cours encore en attente de validation", () => {
    const now = new Date("2026-04-10T12:00:00.000Z")

    const total = computeAbsenceHours(
      [
        {
          date: "2026-04-10",
          endTime: "10:00",
          attendanceStatus: "present",
          validationStatus: "pending",
          hoursPlanned: 2,
          hoursDone: 0,
        },
      ],
      now
    )

    expect(total).toBe(0)
  })

  it("conserve l'absence complete pour un cours absent ou non pointe", () => {
    const now = new Date("2026-04-10T12:00:00.000Z")

    const total = computeAbsenceHours(
      [
        {
          date: "2026-04-10",
          endTime: "10:00",
          attendanceStatus: "absent",
          hoursPlanned: 2,
          hoursDone: 0,
        },
        {
          date: "2026-04-10",
          endTime: "11:00",
          attendanceStatus: "not_marked",
          hoursPlanned: 1,
        },
      ],
      now
    )

    expect(total).toBe(3)
  })
})
