import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSubjectMock, listLevelsMock, listSubjectsMock, updateSubjectMock } = vi.hoisted(() => ({
  createSubjectMock: vi.fn(),
  listLevelsMock: vi.fn(),
  listSubjectsMock: vi.fn(),
  updateSubjectMock: vi.fn(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  createSubject: (payload: unknown) => createSubjectMock(payload),
  listLevels: () => listLevelsMock(),
  listSubjects: () => listSubjectsMock(),
  updateSubject: (id: string, payload: unknown) => updateSubjectMock(id, payload),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))

vi.mock("@/shared/components/OfflineIndicator", () => ({ OfflineIndicator: () => null }))

import SubjectsPage from "@/modules/academic/SubjectsPage"

const level = {
  id: "level-1",
  name: "6ème",
  orderIndex: 1,
  isExamClass: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/academic/subjects"]}><SubjectsPage /></MemoryRouter>
  </QueryClientProvider>
)

describe("SubjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listLevelsMock.mockResolvedValue([level])
    listSubjectsMock.mockResolvedValue([{
      id: "subject-1",
      levelId: level.id,
      levelName: level.name,
      name: "Mathématiques",
      coefficient: 4,
    }])
    createSubjectMock.mockResolvedValue({})
  })

  it("affiche les matières avec leur niveau et leur coefficient", async () => {
    renderPage()

    expect((await screen.findAllByText("Mathématiques")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("6ème").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Coef. 4").length).toBeGreaterThan(0)
    expect(screen.getByRole("tab", { name: "Matières" })).toHaveAttribute("data-state", "active")
  })

  it("crée une matière pour le niveau sélectionné", async () => {
    renderPage()

    await screen.findAllByText("Mathématiques")
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une matière" }))
    fireEvent.change(screen.getByPlaceholderText("Mathématiques"), { target: { value: "Français" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(createSubjectMock).toHaveBeenCalledWith({
      levelId: "level-1",
      name: "Français",
      coefficient: 1,
    }))
  })
})
