import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), patchMock: vi.fn(), postMock: vi.fn() }))

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: getMock, post: postMock, patch: patchMock, delete: vi.fn() },
}))

import { createSubjectsBulk, fetchTeacherAcademicContext, listClasses, listLevels, listSchoolYears, updateSubjectsBulk } from "@/modules/academic/academic.api"

describe("academic.api", () => {
  beforeEach(() => vi.clearAllMocks())

  it("transmet le filtre d’année scolaire et normalise les classes", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        schoolYear: { id: "year-1", label: "09/2025 - 06/2026", status: "closed", startDate: "2025-09-01", endDate: "2026-06-30" },
        activeSchoolYear: { id: "year-2", label: "09/2026 - 06/2027", status: "active", startDate: "2026-09-01", endDate: "2027-06-30" },
        classes: [{
          id: "class-1",
          name: "6ème A",
          studentCount: "32",
          isActive: true,
          level: { id: "level-1", name: "6ème", orderIndex: 1 },
          schoolYear: { id: "year-1", label: "09/2025 - 06/2026" },
          homeroomTeacher: { id: "teacher-1", name: "Awa Koné" },
        }],
      },
    })

    const result = await listClasses("year-1")

    expect(getMock).toHaveBeenCalledWith("/classes", { params: { schoolYearId: "year-1" } })
    expect(result.classes[0]).toMatchObject({
      id: "class-1",
      studentCount: 32,
      homeroomTeacher: { name: "Awa Koné" },
    })
    expect(result.schoolYear?.status).toBe("closed")
    expect(result.activeSchoolYear?.id).toBe("year-2")
  })

  it("normalise les variantes snake_case des référentiels", async () => {
    getMock
      .mockResolvedValueOnce({ data: { schoolYears: [{ id: "year-1", label: "09/2026 - 06/2027", start_date: "2026-09-01", end_date: "2027-06-30", end_of_year_review_start_date: "2027-05-31", status: "active" }] } })
      .mockResolvedValueOnce({ data: { levels: [{ id: "level-1", name: "Terminale", order_index: "12", is_exam_class: true }] } })

    const [years, levels] = await Promise.all([listSchoolYears(), listLevels()])

    expect(years[0]).toMatchObject({ startDate: "2026-09-01", endOfYearReviewStartDate: "2027-05-31", status: "active" })
    expect(levels[0]).toMatchObject({ orderIndex: 12, isExamClass: true })
  })

  it("charge le référentiel académique dédié au professeur sans permission staff", async () => {
    const payload = { classes: [{ id: "c1", name: "6ème A" }], gradingPeriods: [{ id: "p1", label: "T1" }] }
    getMock.mockResolvedValueOnce({ data: payload })

    await expect(fetchTeacherAcademicContext()).resolves.toEqual(payload)
    expect(getMock).toHaveBeenCalledWith("/academic/teacher-context")
  })

  it("envoie une création groupée avec les coefficients propres à chaque niveau", async () => {
    postMock.mockResolvedValueOnce({ data: { subjects: [{ id: "s1", levelId: "l1", levelName: "6ème", name: "Mathématiques", coefficient: 4 }] } })

    await expect(createSubjectsBulk({
      name: "Mathématiques",
      assignments: [{ levelId: "l1", coefficient: 4 }],
    })).resolves.toEqual([expect.objectContaining({ id: "s1", coefficient: 4 })])
    expect(postMock).toHaveBeenCalledWith("/subjects/bulk", {
      name: "Mathématiques",
      assignments: [{ levelId: "l1", coefficient: 4 }],
    })
  })

  it("met à jour un groupe de matière avec tous ses coefficients", async () => {
    const payload = {
      name: "Mathématiques",
      assignments: [{ subjectId: "s1", levelId: "l1", coefficient: 5 }],
    }
    patchMock.mockResolvedValueOnce({ data: { subjects: [{ id: "s1", levelId: "l1", levelName: "6ème", name: "Mathématiques", coefficient: 5 }] } })

    await expect(updateSubjectsBulk(payload)).resolves.toEqual([
      expect.objectContaining({ id: "s1", coefficient: 5 }),
    ])
    expect(patchMock).toHaveBeenCalledWith("/subjects/bulk", payload)
  })
})
