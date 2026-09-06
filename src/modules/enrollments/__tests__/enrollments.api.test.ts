import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, putMock, patchMock, deleteMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), putMock: vi.fn(), patchMock: vi.fn(), deleteMock: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock, post: postMock, put: putMock, patch: patchMock, delete: deleteMock } }))

import { archiveRequiredDocumentType, confirmEnrollmentPayment, createRequiredDocumentTypes, getStudentAcademicSummary, listEnrollments, listReEnrollmentCandidates, listRequiredDocumentLevels, listRequiredDocumentTypes, syncRequiredDocumentTypes, updateEnrollment, updateRequiredDocumentType, updateStudentDocument, uploadStudentDocument, verifyStudentDocuments } from "../enrollments.api"

describe("enrollments.api", () => {
  beforeEach(() => vi.clearAllMocks())

  it("normalise aussi l’ancienne réponse imbriquée sans faire planter la page", async () => {
    getMock.mockResolvedValueOnce({ data: {
      enrollments: {
        enrollments: [{
          id: "enrollment-1", student_id: "student-1", class_id: "class-1", class_name: "6e A",
          student_first_name: "Awa", student_last_name: "Koné", school_year_id: "year-1",
          school_year_label: "2026-2027", type: "new_registration", status: "pending_cashier",
          enrolled_at: "2026-09-01T08:00:00.000Z", document_status: "incomplete",
          missing_mandatory_document_count: 1,
        }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    } })

    await expect(listEnrollments()).resolves.toEqual(expect.objectContaining({
      enrollments: [expect.objectContaining({ id: "enrollment-1", studentId: "student-1", studentFirstName: "Awa" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }))
  })

  it("charge les pièces requises du niveau", async () => {
    getMock.mockResolvedValueOnce({ data: { documentTypes: [{ id: "doc-1", level_id: "level-1", level_name: "CP1", name: "Extrait", is_mandatory: true, is_active: true }] } })
    await expect(listRequiredDocumentTypes("level-1")).resolves.toEqual([{
      id: "doc-1", levelId: "level-1", levelName: "CP1", name: "Extrait", isMandatory: true, isActive: true,
    }])
    expect(getMock).toHaveBeenCalledWith("/required-document-types", { params: { level_id: "level-1" } })
  })

  it("charge les niveaux accessibles au paramétrage documentaire", async () => {
    getMock.mockResolvedValueOnce({ data: { levels: [{ id: "level-1", name: "CP1" }] } })
    await expect(listRequiredDocumentLevels()).resolves.toEqual([{ id: "level-1", name: "CP1" }])
    expect(getMock).toHaveBeenCalledWith("/required-document-levels")
  })

  it("charge et normalise les élèves réinscriptibles ainsi que leur synthèse", async () => {
    getMock.mockResolvedValueOnce({ data: {
      candidates: [{
        student_id: "student-1", student_first_name: "Awa", student_last_name: "Koné", student_matricule: "MAT-001",
        current_class_name: "6e A", current_school_year_id: "year-1", current_school_year_label: "2026-2027",
        final_decision: "promoted", next_level_id: "level-2", next_level_name: "5e", enrollment_id: null,
      }],
      pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
    } }).mockResolvedValueOnce({ data: {
      student: { id: "student-1", firstName: "Awa", lastName: "Koné", matricule: "MAT-001" },
      years: [],
    } })

    await expect(listReEnrollmentCandidates({ search: "Awa", sourceSchoolYearId: "year-1", levelId: "level-1", classId: "class-1" })).resolves.toMatchObject({
      candidates: [expect.objectContaining({ studentId: "student-1", finalDecision: "promoted" })],
      pagination: { total: 1 },
    })
    await expect(getStudentAcademicSummary("student-1")).resolves.toMatchObject({ student: { matricule: "MAT-001" } })
    expect(getMock).toHaveBeenCalledWith("/enrollments/re-enrollment/candidates", { params: { page: 1, limit: 20, source_school_year_id: "year-1", level_id: "level-1", class_id: "class-1", search: "Awa" } })
    expect(getMock).toHaveBeenCalledWith("/enrollments/re-enrollment/students/student-1/summary")
  })

  it("branche la création, la modification et l’archivage des règles documentaires", async () => {
    postMock.mockResolvedValueOnce({ data: { documentTypes: [{ id: "doc-1", level_id: "level-1", name: "Extrait", is_mandatory: true, is_active: true }] } })
    putMock.mockResolvedValueOnce({ data: { documentTypes: [{ id: "doc-1", level_id: "level-2", name: "Extrait", is_mandatory: false, is_active: true }] } })
    patchMock.mockResolvedValueOnce({ data: { documentType: { id: "doc-1", level_id: "level-1", name: "Extrait", is_mandatory: false, is_active: true } } })
    deleteMock.mockResolvedValueOnce({ data: { archived: true } })

    await createRequiredDocumentTypes({ levelIds: ["level-1"], name: "Extrait", isMandatory: true })
    await syncRequiredDocumentTypes({ documentTypeIds: ["doc-1"], levelIds: ["level-2"], name: "Extrait", isMandatory: false })
    await updateRequiredDocumentType("doc-1", { isMandatory: false })
    await archiveRequiredDocumentType("doc-1")

    expect(postMock).toHaveBeenCalledWith("/required-document-types/bulk", { levelIds: ["level-1"], name: "Extrait", isMandatory: true })
    expect(putMock).toHaveBeenCalledWith("/required-document-types/bulk", { documentTypeIds: ["doc-1"], levelIds: ["level-2"], name: "Extrait", isMandatory: false })
    expect(patchMock).toHaveBeenCalledWith("/required-document-types/doc-1", { isMandatory: false })
    expect(deleteMock).toHaveBeenCalledWith("/required-document-types/doc-1")
  })

  it("envoie le document en multipart avec son type", async () => {
    postMock.mockResolvedValueOnce({ data: { document: { id: "stored" } } })
    const file = new File(["scan"], "scan.pdf", { type: "application/pdf" })
    await uploadStudentDocument("student-1", "doc-type-1", file)
    const form = postMock.mock.calls[0]?.[1] as FormData
    expect(postMock.mock.calls[0]?.[0]).toBe("/students/student-1/enrollment-documents/upload")
    expect(form.get("documentTypeId")).toBe("doc-type-1")
    expect(form.get("file")).toBe(file)
  })

  it("branche les mutations de vérification, statut et caisse", async () => {
    patchMock.mockResolvedValueOnce({ data: { document: { id: "doc-1" } } })
      .mockResolvedValueOnce({ data: { enrollment: { id: "enrollment-1", classId: "class-2" } } })
    postMock.mockResolvedValueOnce({ data: { dossierComplete: false, notificationQueued: true } })
      .mockResolvedValueOnce({ data: { enrollment: { id: "enrollment-1", status: "confirmed" } } })
    await updateStudentDocument("doc-1", { status: "to_renew" })
    await updateEnrollment("enrollment-1", { classId: "class-2" })
    await verifyStudentDocuments("student-1")
    await confirmEnrollmentPayment("enrollment-1", { amount: 25000, method: "cash", schoolReceiptReference: "RC-API-001" })
    expect(patchMock).toHaveBeenCalledWith("/student-documents/doc-1", { status: "to_renew" })
    expect(patchMock).toHaveBeenCalledWith("/enrollments/enrollment-1", { classId: "class-2" })
    expect(postMock).toHaveBeenCalledWith("/students/student-1/enrollment-documents/verify")
    expect(postMock).toHaveBeenCalledWith("/enrollments/enrollment-1/confirm-payment", { amount: 25000, method: "cash", schoolReceiptReference: "RC-API-001" })
  })
})
