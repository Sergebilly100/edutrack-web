import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { listLevelsMock, listDocumentsMock, createMock, syncMock, archiveMock, toastMock } = vi.hoisted(() => ({
  listLevelsMock: vi.fn(),
  listDocumentsMock: vi.fn(),
  createMock: vi.fn(),
  syncMock: vi.fn(),
  archiveMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock("@/modules/enrollments/enrollments.api", () => ({
  listRequiredDocumentLevels: listLevelsMock,
  listRequiredDocumentTypes: listDocumentsMock,
  createRequiredDocumentTypes: createMock,
  syncRequiredDocumentTypes: syncMock,
  archiveRequiredDocumentType: archiveMock,
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange?.(event.target.checked)} />
  ),
}))
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange }: { children: React.ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void }) => (
    <label><input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />{children}</label>
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
    listLevelsMock.mockResolvedValue([{ id: "level-1", name: "CP1" }, { id: "level-2", name: "CP2" }])
    listDocumentsMock.mockResolvedValue([
      { id: "doc-1", levelId: "level-1", levelName: "CP1", name: "Extrait de naissance", isMandatory: true, isActive: true },
      { id: "doc-2", levelId: "level-2", levelName: "CP2", name: "Extrait de naissance", isMandatory: true, isActive: true },
    ])
    createMock.mockResolvedValue([{ id: "doc-2" }, { id: "doc-3" }])
    syncMock.mockResolvedValue([{ id: "doc-2" }])
    archiveMock.mockResolvedValue(undefined)
  })

  it("affiche le récapitulatif et associe un document à plusieurs niveaux", async () => {
    renderPanel()
    expect(await screen.findByText("Extrait de naissance")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nom du document"), { target: { value: "Photo d’identité" } })
    fireEvent.click(await screen.findByRole("checkbox", { name: "CP1" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "CP2" }))
    fireEvent.click(screen.getByRole("button", { name: "Ajouter aux niveaux sélectionnés" }))

    await waitFor(() => expect(createMock).toHaveBeenCalledWith({
      levelIds: ["level-1", "level-2"], name: "Photo d’identité", isMandatory: true,
    }))
  })

  it("modifie en une fois tous les niveaux associés au document", async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: "Modifier" }))
    expect(screen.getByRole("button", { name: "Niveaux concernés" })).toHaveTextContent("2 niveaux sélectionnés")
    fireEvent.click(await screen.findByRole("checkbox", { name: "CP1" }))
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }))

    await waitFor(() => expect(syncMock).toHaveBeenCalledWith({
      documentTypeIds: ["doc-1", "doc-2"],
      levelIds: ["level-2"],
      name: "Extrait de naissance",
      isMandatory: true,
    }))
  })

  it("archive avec confirmation et conserve un mode lecture seule", async () => {
    const { rerender } = renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: "Archiver" }))
    expect(screen.getByText("Archiver ce document ?")).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archiver" }))
    await waitFor(() => {
      expect(archiveMock).toHaveBeenCalledWith("doc-1")
      expect(archiveMock).toHaveBeenCalledWith("doc-2")
    })

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RequiredDocumentsSettings canEdit={false} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/votre poste ne permet pas de la modifier/i)).toBeInTheDocument()
  })
})
