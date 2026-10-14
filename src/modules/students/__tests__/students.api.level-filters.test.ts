import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock } }))

import {
  exportStudentAbsences,
  getStudentAbsenceRecords,
  getStudentAbsenceStats,
  listCashierCandidates,
  listFinancialProfiles,
  listHistoryProfiles,
  listStudents,
} from "@/modules/students/students.api"

const levelId = "66f048d8-d053-48e2-b4a8-7fce3ebc3ed8"
const classId = "66f048d8-d053-48e2-b4a8-7fce3ebc3ed9"

describe("students.api : filtres de niveau", () => {
  beforeEach(() => getMock.mockReset().mockResolvedValue({ data: [] }))

  it("transmet niveau et classe à la liste", async () => {
    await listStudents({ levelId, classId })
    expect(getMock).toHaveBeenCalledWith("/students", expect.objectContaining({
      params: expect.objectContaining({ level_id: levelId, class_id: classId }),
    }))
  })

  it("transmet l’année choisie à la recherche de dossiers financiers", async () => {
    await listFinancialProfiles({ schoolYearId: "year-current", includeBlockedReEnrollments: true, search: "Awa" })
    expect(getMock).toHaveBeenCalledWith("/students/financial-profiles", expect.objectContaining({
      params: expect.objectContaining({ school_year_id: "year-current", include_blocked_reenrollments: "true", search: "Awa" }),
    }))
  })

  it("transmet l’année et le niveau au répertoire de tous les dossiers", async () => {
    await listHistoryProfiles({ schoolYearId: "year-old", levelId, search: "Aya" })
    expect(getMock).toHaveBeenCalledWith("/students/history-directory", expect.objectContaining({
      params: expect.objectContaining({ school_year_id: "year-old", level_id: levelId, search: "Aya" }),
    }))
  })

  it("utilise une recherche dédiée pour la caisse", async () => {
    await listCashierCandidates({ schoolYearId: "year-current", search: "Awa" })
    expect(getMock).toHaveBeenCalledWith("/students/cashier-candidates", expect.objectContaining({
      params: expect.objectContaining({ school_year_id: "year-current", search: "Awa" }),
    }))
  })

  it("utilise les mêmes filtres pour statistiques, détail et PDF", async () => {
    const filters = {
      from: "2026-04-01", to: "2026-04-30", levelId, classId,
      subject: "Math", smsStatus: "failed" as const, minAbsences: 2,
    }
    await getStudentAbsenceStats(filters)
    expect(getMock).toHaveBeenCalledWith("/students/absence-stats", expect.objectContaining({
      params: expect.objectContaining({ level_id: levelId, class_id: classId, subject: "Math", sms_status: "failed", min_absences: 2 }),
    }))
    await getStudentAbsenceRecords("student-1", filters)
    expect(getMock).toHaveBeenCalledWith("/students/student-1/absences", expect.objectContaining({
      params: expect.objectContaining({ level_id: levelId, class_id: classId, subject: "Math" }),
    }))
    getMock.mockResolvedValueOnce({ data: { jobId: "job-1" } })
    expect(await exportStudentAbsences(filters)).toEqual({ jobId: "job-1" })
    expect(getMock).toHaveBeenCalledWith("/students/absence-stats/export", expect.objectContaining({
      params: expect.objectContaining({ level_id: levelId, class_id: classId, subject: "Math", sms_status: "failed", min_absences: 2 }),
    }))
  })
})
