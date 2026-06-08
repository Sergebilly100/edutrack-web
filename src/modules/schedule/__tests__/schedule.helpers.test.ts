import { describe, expect, it } from "vitest"

import { occurrenceDateFromWeek, weekMondayAndDayFromDate } from "../schedule.helpers"

describe("weekMondayAndDayFromDate", () => {
  it("dérive le lundi de la semaine et le jour ISO d'une date en milieu de semaine", () => {
    // 2099-01-07 est un mercredi ; le lundi de sa semaine est le 2099-01-05.
    expect(weekMondayAndDayFromDate("2099-01-07")).toEqual({
      weekMonday: "2099-01-05",
      dayOfWeek: 3,
    })
  })

  it("gère un lundi (jour 1, même date que le lundi de semaine)", () => {
    expect(weekMondayAndDayFromDate("2099-01-05")).toEqual({
      weekMonday: "2099-01-05",
      dayOfWeek: 1,
    })
  })

  it("gère un samedi (jour 6)", () => {
    expect(weekMondayAndDayFromDate("2099-01-10")).toEqual({
      weekMonday: "2099-01-05",
      dayOfWeek: 6,
    })
  })

  it("détecte le dimanche (jour 7) - cas à refuser côté UI", () => {
    expect(weekMondayAndDayFromDate("2099-01-11").dayOfWeek).toBe(7)
  })

  it("est l'inverse de occurrenceDateFromWeek", () => {
    const { weekMonday, dayOfWeek } = weekMondayAndDayFromDate("2099-03-18")
    expect(occurrenceDateFromWeek(weekMonday, dayOfWeek)).toBe("2099-03-18")
  })
})
