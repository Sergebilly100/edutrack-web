import { describe, expect, it } from "vitest"

import { getScheduleTimeErrors, occurrenceDateFromWeek, parseScheduleTime, weekMondayAndDayFromDate } from "../schedule.helpers"

describe("horaires EDT", () => {
  it.each(["00:00", "23:59", "07:15", "12:20"])("accepte %s", (time) => {
    expect(parseScheduleTime(time)).not.toBeNull()
  })
  it.each(["", "24:00", "12:60", "07:1", "07:15x"])("rejette %s", (time) => {
    expect(parseScheduleTime(time)).toBeNull()
  })
  it("signale la fin égale ou antérieure près du champ fin", () => {
    expect(getScheduleTimeErrors("07:15", "07:15").endTime).toMatch(/strictement/)
    expect(getScheduleTimeErrors("08:05", "07:45").endTime).toMatch(/strictement/)
    expect(getScheduleTimeErrors("07:15", "08:05")).toEqual({ startTime: null, endTime: null })
  })
})

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
