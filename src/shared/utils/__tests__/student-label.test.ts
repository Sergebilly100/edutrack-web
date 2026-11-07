import { describe, expect, it } from "vitest"

import {
  FALLBACK_STUDENT_LABELS,
  countedStudents,
  studentNoun,
  studentPlural,
  toFollowColumnLabel,
} from "../student-label"

const students = { singular: "Étudiant(e)", plural: "Étudiants", singularLower: "étudiant(e)", pluralLower: "étudiants" }

describe("student-label", () => {
  it("falls back to « élèves » when no label is configured", () => {
    expect(toFollowColumnLabel(undefined)).toBe("À suivre (élèves)")
    expect(toFollowColumnLabel(null)).toBe("À suivre (élèves)")
    expect(toFollowColumnLabel(FALLBACK_STUDENT_LABELS)).toBe("À suivre (élèves)")
  })

  it("uses the configured plural for the column header", () => {
    expect(toFollowColumnLabel(students)).toBe("À suivre (étudiants)")
  })

  it("agrees singular and plural with the count", () => {
    expect(studentNoun(undefined, 0)).toBe("élève")
    expect(studentNoun(undefined, 1)).toBe("élève")
    expect(studentNoun(undefined, 2)).toBe("élèves")
    expect(studentNoun(students, 2)).toBe("étudiants")
    expect(countedStudents(undefined, 25)).toBe("25 élèves")
  })

  it("capitalizes on demand", () => {
    expect(studentPlural(undefined, { capitalized: true })).toBe("Élèves")
    expect(studentNoun(students, 1, { capitalized: true })).toBe("Étudiant(e)")
  })
})
