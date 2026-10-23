import { beforeEach, expect, it, vi } from "vitest"

const apiClient = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient }))

import { getParentGrades } from "../parent.api"

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.get.mockResolvedValue({
    data: {
      schoolYear: {
        id: "00000000-0000-4000-8000-000000000001",
        label: "2026-2027",
        internalAudit: "must-not-pass",
      },
      periods: [{
        id: "00000000-0000-4000-8000-000000000002",
        label: "Trimestre 1",
      }],
      selectedGradingPeriodId: "00000000-0000-4000-8000-000000000002",
      conductGrade: 14.5,
      resultsInRevision: false,
      subjects: [{
        id: "00000000-0000-4000-8000-000000000003",
        name: "Mathématiques",
        average: 14.5,
        rank: 1,
        studentId: "other-student",
        evaluations: [{
          id: "00000000-0000-4000-8000-000000000004",
          label: "Composition",
          date: "2026-10-15",
          type: "scheduled",
          coefficient: 2,
          score: 8,
          maxScore: 10,
          comment: "Commentaire privé",
        }],
      }],
    },
  })
})

it("valide le contrat parent, envoie la période demandée et élimine les champs internes", async () => {
  const response = await getParentGrades(
    "00000000-0000-4000-8000-000000000005",
    "00000000-0000-4000-8000-000000000002",
  )

  expect(apiClient.get).toHaveBeenCalledWith(
    "/parent/students/00000000-0000-4000-8000-000000000005/grades",
    { params: { gradingPeriodId: "00000000-0000-4000-8000-000000000002" } },
  )
  expect(JSON.stringify(response)).not.toMatch(/rank|studentId|comment|audit/i)
  expect(response.subjects[0]?.average).toBe(14.5)
})
