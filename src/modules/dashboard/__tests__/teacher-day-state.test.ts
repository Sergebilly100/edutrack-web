import { describe, expect, it } from "vitest"

import { getTeacherDayState } from "../teacher-day-state"

const course = (start: string, end: string, attendance_status?: "absent") => ({
  start_at: `2026-10-15T${start}:00.000Z`,
  end_at: `2026-10-15T${end}:00.000Z`,
  attendance_status,
})
const at = (time: string) => new Date(`2026-10-15T${time}:00.000Z`)

describe("getTeacherDayState", () => {
  it("distingue une journée sans aucun créneau", () => {
    expect(getTeacherDayState([], at("12:00"))).toEqual({ kind: "free" })
  })

  it("choisit le premier cours futur indépendamment de l'ordre reçu", () => {
    const early = course("09:17", "10:43")
    expect(getTeacherDayState([course("14:05", "15:10"), early], at("08:00")))
      .toEqual({ kind: "next", schedule: early })
  })

  it("considère le début et la fin exacts comme en cours", () => {
    const slot = course("09:17", "10:43")
    expect(getTeacherDayState([slot], at("09:17"))).toEqual({ kind: "current", schedule: slot })
    expect(getTeacherDayState([slot], at("10:43"))).toEqual({ kind: "current", schedule: slot })
  })

  it("bascule à terminée après la fin d'un cours", () => {
    expect(getTeacherDayState([course("09:17", "10:43")], new Date("2026-10-15T10:43:00.001Z")))
      .toEqual({ kind: "finished", count: 1 })
  })

  it("résume plusieurs cours tous terminés", () => {
    expect(getTeacherDayState([course("08:05", "09:12"), course("10:43", "11:19")], at("12:00")))
      .toEqual({ kind: "finished", count: 2 })
  })

  it("résume plusieurs cours passés, y compris un absent, sans changer leur présence", () => {
    const schedules = [course("08:05", "09:12"), course("10:43", "11:19", "absent")]
    expect(getTeacherDayState(schedules, at("12:00"))).toEqual({ kind: "finished", count: 2 })
    expect(schedules[1].attendance_status).toBe("absent")
  })

  it("donne priorité au cours en cours sur un cours futur", () => {
    const current = course("09:17", "10:43")
    expect(getTeacherDayState([course("12:05", "13:19"), current], at("10:00")))
      .toEqual({ kind: "current", schedule: current })
  })
})
