import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const listHistoryProfiles = vi.hoisted(() => vi.fn())
const listStudents = vi.hoisted(() => vi.fn())
const listSchoolYears = vi.hoisted(() => vi.fn())
const listLevels = vi.hoisted(() => vi.fn())
vi.mock("@/modules/students/students.api", () => ({ listHistoryProfiles, listStudents }))
vi.mock("@/modules/academic/academic.api", () => ({ listSchoolYears, listLevels }))
import StudentHistoryDirectoryPage from "../StudentHistoryDirectoryPage"

describe("StudentHistoryDirectoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
    listSchoolYears.mockResolvedValue([{ id: "year-old", label: "2024-2025", status: "closed" }, { id: "year-active", label: "2025-2026", status: "active" }])
    listLevels.mockResolvedValue([{ id: "level-1", name: "6e" }])
  })

  it("retrouve un ancien profil par matricule et ouvre son historique", async () => {
    listHistoryProfiles.mockResolvedValue({
      data: [{ id: "former-student", firstName: "Aya", lastName: "Koné", matricule: "MAT-42" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/students/history"]}><Routes>
        <Route path="/students/history" element={<StudentHistoryDirectoryPage />} />
        <Route path="/students/:studentId/history" element={<p>Historique ouvert</p>} />
      </Routes></MemoryRouter>
    </QueryClientProvider>)
    expect(await screen.findByText("Koné Aya")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("searchbox", { name: "Nom ou matricule" }), { target: { value: "MAT-42" } })
    await waitFor(() => expect(listHistoryProfiles).toHaveBeenCalledWith(expect.objectContaining({ search: "MAT-42" })))
    fireEvent.click(await screen.findByRole("link", { name: "Ouvrir le dossier" }))
    expect(await screen.findByText("Historique ouvert")).toBeInTheDocument()
  })

  it("sépare la recherche de tous les dossiers et les effectifs confirmés", async () => {
    listHistoryProfiles.mockResolvedValue({
      data: [{ id: "former-student", firstName: "Aya", lastName: "Koné", matricule: "MAT-42" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    listStudents.mockResolvedValue({
      data: [{ id: "current-student", firstName: "Awa", lastName: "Yao", matricule: "MAT-43", className: "5e A" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/students/history"]}><Routes>
        <Route path="/students/history" element={<StudentHistoryDirectoryPage />} />
      </Routes></MemoryRouter>
    </QueryClientProvider>)
    expect(await screen.findByText("Koné Aya")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Inscrits cette année" }))
    expect(await screen.findByText("Yao Awa")).toBeInTheDocument()
    expect(listStudents).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
    expect(screen.queryByText("Koné Aya")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Tous les dossiers" }))
    expect(await screen.findByText("Koné Aya")).toBeInTheDocument()
  })

  it("filtre les dossiers historiques par année et niveau puis ouvre l’année sélectionnée", async () => {
    listHistoryProfiles.mockResolvedValue({
      data: [{ id: "former-student", firstName: "Aya", lastName: "Koné", matricule: "MAT-42", className: "6e A", schoolYearLabel: "2024-2025" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    listStudents.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/students/history"]}><Routes><Route path="/students/history" element={<StudentHistoryDirectoryPage />} /></Routes></MemoryRouter>
    </QueryClientProvider>)
    expect(await screen.findByRole("combobox", { name: "Année scolaire" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Année scolaire" }))
    fireEvent.click(await screen.findByRole("option", { name: "2024-2025" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "6e" }))
    await waitFor(() => expect(listHistoryProfiles).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: "year-old", levelId: "level-1" })))
    expect(screen.getByRole("link", { name: "Ouvrir le dossier" })).toHaveAttribute("href", expect.stringContaining("year=year-old"))
    fireEvent.click(screen.getByRole("button", { name: "Inscrits cette année" }))
    await waitFor(() => expect(listStudents).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: undefined, levelId: "level-1" })))
    expect(screen.queryByRole("combobox", { name: "Année scolaire" })).not.toBeInTheDocument()
  })
})
