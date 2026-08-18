import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: getMock, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { listClasses, listLevels, listSchoolYears } from "@/modules/academic/academic.api"

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
})
