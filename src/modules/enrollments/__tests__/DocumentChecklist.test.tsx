import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }))
vi.mock("../enrollments.api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../enrollments.api")>()
  return {
    ...original,
    listStudentDocuments: listMock,
    uploadStudentDocument: vi.fn(),
    updateStudentDocument: vi.fn(),
  }
})
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { DocumentChecklist } from "../components/DocumentChecklist"

const renderChecklist = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <DocumentChecklist studentId="student-1" canEdit />
  </QueryClientProvider>,
)

describe("DocumentChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue([{
      id: "document-1", studentId: "student-1", documentTypeId: "type-1",
      documentTypeName: "Extrait de naissance", isMandatory: true, status: "missing",
      fileUrl: null, r2Key: null, providedAt: null, notes: null,
    }])
  })

  it("propose la capture mobile sans bouton de vérification manuel", async () => {
    const { container } = renderChecklist()
    expect(await screen.findByText("Extrait de naissance")).toBeInTheDocument()
    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute("capture", "environment")
    expect(screen.queryByRole("button", { name: "Valider la vérification" })).not.toBeInTheDocument()
  })
})
