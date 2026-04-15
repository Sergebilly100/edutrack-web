import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { DocumentList } from "@/shared/components/DocumentList"
import { DocumentUpload } from "@/shared/components/DocumentUpload"
import { TeacherProfileCard } from "@/shared/components/TeacherProfileCard"

const listDocumentsMock = vi.fn()
const uploadDocumentMock = vi.fn()
const getDocumentDownloadUrlMock = vi.fn()
const deleteDocumentMock = vi.fn()

vi.mock("@/shared/api/documents.api", () => {
  return {
    listDocuments: (...args: unknown[]) => listDocumentsMock(...args),
    uploadDocument: (...args: unknown[]) => uploadDocumentMock(...args),
    getDocumentDownloadUrl: (...args: unknown[]) => getDocumentDownloadUrlMock(...args),
    deleteDocument: (...args: unknown[]) => deleteDocumentMock(...args),
  }
})

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

  it("renders DocumentList empty state", async () => {
    listDocumentsMock.mockResolvedValue([])

    renderWithQueryClient(<DocumentList entityType="teacher" entityId="t-1" />)

    expect(await screen.findByText("Aucun document")).toBeInTheDocument()
  })
})
