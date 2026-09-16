import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { DocumentList } from "@/shared/components/DocumentList"
import { DocumentUpload } from "@/shared/components/DocumentUpload"
import { TeacherProfileCard } from "@/shared/components/TeacherProfileCard"

const listDocumentsMock = vi.fn()
const uploadDocumentMock = vi.fn()
const getDocumentDownloadUrlMock = vi.fn()
const downloadDocumentFileMock = vi.fn()
const deleteDocumentMock = vi.fn()
const replaceDocumentMock = vi.fn()
const listStudentDocumentsMock = vi.fn()
const getStudentDocumentDownloadUrlMock = vi.fn()
const updateStudentDocumentMock = vi.fn()
const uploadStudentDocumentMock = vi.fn()

vi.mock("@/shared/api/documents.api", () => {
  return {
    listDocuments: (...args: unknown[]) => listDocumentsMock(...args),
    uploadDocument: (...args: unknown[]) => uploadDocumentMock(...args),
    getDocumentDownloadUrl: (...args: unknown[]) => getDocumentDownloadUrlMock(...args),
    downloadDocumentFile: (...args: unknown[]) => downloadDocumentFileMock(...args),
    deleteDocument: (...args: unknown[]) => deleteDocumentMock(...args),
    replaceDocument: (...args: unknown[]) => replaceDocumentMock(...args),
  }
})

vi.mock("@/modules/enrollments/enrollments.api", () => ({
  listStudentDocuments: (...args: unknown[]) => listStudentDocumentsMock(...args),
  getStudentDocumentDownloadUrl: (...args: unknown[]) => getStudentDocumentDownloadUrlMock(...args),
  updateStudentDocument: (...args: unknown[]) => updateStudentDocumentMock(...args),
  uploadStudentDocument: (...args: unknown[]) => uploadStudentDocumentMock(...args),
}))

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("B3 components", () => {
  it("renders TeacherProfileCard states", async () => {
    renderWithQueryClient(
      <TeacherProfileCard
        teacher={{ id: "t-1", name: "M. Yao", username: "yao.marc", type: "vacataire" }}
        monthStats={{ hours_done: 12, hours_planned: 15, attendance_rate: 80, status: "active" }}
        onBlock={async () => undefined}
        onUnblock={async () => undefined}
        onViewDocuments={() => undefined}
      />
    )

    expect(screen.getByText("M. Yao")).toBeInTheDocument()
    expect(screen.getByText("Vacataire")).toBeInTheDocument()
    expect(screen.getByText("Actif")).toBeInTheDocument()
    expect(screen.getByText("Bloquer")).toBeInTheDocument()
  })

  it("renders DocumentUpload and handles local validation error", async () => {
    uploadDocumentMock.mockResolvedValue({
      id: "doc-1",
      entityType: "teacher",
      entityId: "t-1",
      type: "autre",
      name: "Contrat",
      uploadedBy: "u-1",
      createdAt: new Date().toISOString(),
      url: "https://example.com/doc.pdf",
    })

    const view = renderWithQueryClient(
      <DocumentUpload entityType="teacher" entityId="t-1" onUploadSuccess={() => undefined} />
    )

    expect(screen.getByText("Déposer un fichier ou cliquer pour parcourir")).toBeInTheDocument()

    const input = view.container.querySelector("input[type='file']") as HTMLInputElement | null
    expect(input).not.toBeNull()
    if (!input) {
      throw new Error("File input not found")
    }
    const invalidFile = new File(["hello"], "test.txt", { type: "text/plain" })
    fireEvent.change(input, { target: { files: [invalidFile] } })

    expect(await screen.findByText(/Type de fichier non supporté/i)).toBeInTheDocument()
  })

  it("envoie le fichier sélectionné dans le formulaire multipart", async () => {
    uploadDocumentMock.mockResolvedValue({
      id: "doc-2",
      entityType: "student",
      entityId: "student-1",
      type: "autre",
      name: "Justificatif.pdf",
      uploadedBy: "u-1",
      createdAt: new Date().toISOString(),
      url: "https://example.com/justificatif.pdf",
    })

    const view = renderWithQueryClient(
      <DocumentUpload entityType="student" entityId="student-1" onUploadSuccess={() => undefined} />
    )
    const input = view.container.querySelector("input[type='file']") as HTMLInputElement
    const file = new File(["%PDF-1.4"], "Justificatif.pdf", { type: "application/pdf" })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(uploadDocumentMock).toHaveBeenCalledWith({
      entityType: "student",
      entityId: "student-1",
      file,
    }))
    expect(await screen.findByText("Téléversé")).toBeInTheDocument()
  })

  it("renders DocumentList empty state", async () => {
    listDocumentsMock.mockResolvedValue([])

    renderWithQueryClient(<DocumentList entityType="teacher" entityId="t-1" />)

    expect(await screen.findByText("Aucun document")).toBeInTheDocument()
  })

  it("affiche les documents d'inscription dans la liste unique de l'élève", async () => {
    listDocumentsMock.mockResolvedValue([])
    listStudentDocumentsMock.mockResolvedValue([
      {
        id: "enrollment-document-1",
        documentTypeName: "Extrait de naissance",
        status: "provided",
        providedAt: "2026-06-06T10:00:00Z",
        fileUrl: "https://storage.example.com/extrait.pdf",
      },
    ])

    renderWithQueryClient(
      <DocumentList
        entityType="student"
        entityId="student-1"
        includeSharedDocuments
        includeEnrollmentDocuments
      />
    )

    expect(await screen.findByText("Extrait de naissance")).toBeInTheDocument()
    expect(screen.getByText("Document d'inscription")).toBeInTheDocument()
    expect(screen.queryByText("Aucun document")).not.toBeInTheDocument()
  })

  it("permet de marquer un document d'inscription à renouveler", async () => {
    listDocumentsMock.mockResolvedValue([])
    listStudentDocumentsMock.mockResolvedValue([
      {
        id: "enrollment-document-2",
        documentTypeId: "document-type-2",
        documentTypeName: "Carnet de vaccination",
        status: "provided",
        providedAt: "2026-06-06T10:00:00Z",
        fileUrl: "https://storage.example.com/carnet.pdf",
      },
    ])
    updateStudentDocumentMock.mockResolvedValue({})

    renderWithQueryClient(
      <DocumentList
        entityType="student"
        entityId="student-1"
        includeSharedDocuments={false}
        includeEnrollmentDocuments
        canManageEnrollmentDocuments
      />
    )

    const button = await screen.findByRole("button", { name: "À renouveler" })
    fireEvent.click(button)
    await waitFor(() => expect(updateStudentDocumentMock).toHaveBeenCalledWith(
      "enrollment-document-2",
      { status: "to_renew" },
    ))
  })
})
