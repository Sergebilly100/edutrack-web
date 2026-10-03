import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useAuthStore } from "@/shared/store/auth.store"

const mocks = vi.hoisted(() => ({ classes: vi.fn(), levels: vi.fn(), years: vi.fn() }))
vi.mock("@/modules/academic/academic.api", () => ({
  listClasses: mocks.classes,
  listLevels: mocks.levels,
  listSchoolYears: mocks.years,
  createClass: vi.fn(),
  updateClass: vi.fn(),
  archiveClass: vi.fn(),
}))
vi.mock("@/modules/teachers/teachers.api", () => ({ getAllTeachers: vi.fn() }))

import ClassesPage from "../ClassesPage"

describe("ClassesPage - effectif confirmé", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: "director-1", role: "director", name: "Directeur", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false, tenantId: "tenant-1", schemaName: "school_test", plan: "standard" }, permissions: [] })
    const year = { id: "year-1", label: "2026-2027", status: "active" }
    mocks.years.mockResolvedValue([year])
    mocks.levels.mockResolvedValue([{ id: "level-1", name: "6ème", orderIndex: 1 }])
    mocks.classes.mockResolvedValue({ schoolYear: year, activeSchoolYear: year, classes: [
      { id: "class-1", name: "6ème A", studentCount: 0, isActive: true, level: { id: "level-1", name: "6ème", orderIndex: 1 }, schoolYear: year, homeroomTeacher: null },
      { id: "class-2", name: "6ème B", studentCount: 1, isActive: true, level: { id: "level-1", name: "6ème", orderIndex: 1 }, schoolYear: year, homeroomTeacher: null },
    ] })
  })

  it("affiche les compteurs confirmés de zéro et un fournis par l'API", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><ClassesPage /></MemoryRouter></QueryClientProvider>)

    expect(await screen.findByRole("columnheader", { name: "Élèves confirmés" })).toBeInTheDocument()
    expect(screen.getByText("6ème · 0 élève confirmé")).toBeInTheDocument()
    expect(screen.getByText("6ème · 1 élève confirmé")).toBeInTheDocument()
  })
})
