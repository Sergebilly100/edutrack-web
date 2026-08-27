import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { listLevelsMock, listDocumentsMock, createMock, updateMock, archiveMock, toastMock } = vi.hoisted(() => ({
  listLevelsMock: vi.fn(),
  listDocumentsMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  archiveMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock("@/modules/enrollments/enrollments.api", () => ({
  listRequiredDocumentLevels: listLevelsMock,
  listRequiredDocumentTypes: listDocumentsMock,
  createRequiredDocumentType: createMock,
  updateRequiredDocumentType: updateMock,
  archiveRequiredDocumentType: archiveMock,
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange?.(event.target.checked)} />
  ),
}))

import { RequiredDocumentsSettings } from "../components/RequiredDocumentsSettings"

const renderPanel = (canEdit = true) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <RequiredDocumentsSettings canEdit={canEdit} />
  </QueryClientProvider>,
)

describe("RequiredDocumentsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listLevelsMock.mockResolvedValue([{ id: "level-1", name: "CP1" }])
    listDocumentsMock.mockResolvedValue([{
      id: "doc-1", levelId: "level-1", levelName: "CP1", name: "Extrait de naissance", isMandatory: true, isActive: true,
    }])
    createMock.mockResolvedValue({ id: "doc-2" })
    updateMock.mockResolvedValue({ id: "doc-1" })
    archiveMock.mockResolvedValue(undefined)
  })

  it("affiche les règles du niveau et permet d’en ajouter une", async () => {
    renderPanel()
    expect(await screen.findByText("Extrait de naissance")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nom du document"), { target: { value: "Photo d’identité" } })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter le document" }))

    await waitFor(() => expect(createMock).toHaveBeenCalledWith({
      levelId: "level-1", name: "Photo d’identité", isMandatory: true,
    }))
  })

  it("archive avec confirmation et conserve un mode lecture seule", async () => {
    const { rerender } = renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: "Archiver" }))
    expect(screen.getByText("Archiver ce document ?")).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archiver" }))
    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith("doc-1"))

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RequiredDocumentsSettings canEdit={false} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/votre poste ne permet pas de la modifier/i)).toBeInTheDocument()
  })
})
