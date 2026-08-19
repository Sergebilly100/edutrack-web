import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), patchMock: vi.fn() }))
vi.mock("@/shared/api/client", () => ({ apiClient: { get: getMock, post: postMock, patch: patchMock } }))

import { confirmEnrollmentPayment, listRequiredDocumentTypes, updateStudentDocument, uploadStudentDocument, verifyStudentDocuments } from "../enrollments.api"

describe("enrollments.api", () => {
  beforeEach(() => vi.clearAllMocks())

  it("charge les pièces requises du niveau", async () => {
    getMock.mockResolvedValueOnce({ data: { documentTypes: [{ id: "doc-1" }] } })
    await expect(listRequiredDocumentTypes("level-1")).resolves.toEqual([{ id: "doc-1" }])
    expect(getMock).toHaveBeenCalledWith("/required-document-types", { params: { level_id: "level-1" } })
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
    postMock.mockResolvedValueOnce({ data: { dossierComplete: false, notificationQueued: true } })
      .mockResolvedValueOnce({ data: { enrollment: { id: "enrollment-1", status: "confirmed" } } })
    await updateStudentDocument("doc-1", { status: "to_renew" })
    await verifyStudentDocuments("student-1")
    await confirmEnrollmentPayment("enrollment-1")
    expect(patchMock).toHaveBeenCalledWith("/student-documents/doc-1", { status: "to_renew" })
    expect(postMock).toHaveBeenCalledWith("/students/student-1/enrollment-documents/verify")
    expect(postMock).toHaveBeenCalledWith("/enrollments/enrollment-1/confirm-payment")
  })
})
