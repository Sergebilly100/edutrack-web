import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import type { ClassesResponse, SchoolClass } from "@/modules/academic/academic.api"
import { HomeroomTeacherReminder } from "@/shared/components/HomeroomTeacherReminder"
import { useAuthStore } from "@/shared/store/auth.store"

const { listClassesMock } = vi.hoisted(() => ({ listClassesMock: vi.fn() }))
vi.mock("@/modules/academic/academic.api", () => ({ listClasses: () => listClassesMock() }))

const schoolClass = (id: string, overrides: Partial<SchoolClass> = {}): SchoolClass => ({
  id, name: id, isActive: true, studentCount: 20, level: { id: "level", name: "4e", orderIndex: 1 },
  schoolYear: { id: "active-year", label: "2026-2027" }, homeroomTeacher: null, createdAt: "", updatedAt: "", ...overrides,
})
const catalog: ClassesResponse = {
  activeSchoolYear: { id: "active-year", label: "2026-2027", status: "active", startDate: "2026-09-01", endDate: "2027-06-30", endOfYearReviewStartDate: "2027-05-30", gradingPeriodType: "trimester", createdAt: "", updatedAt: "" },
  schoolYear: null,
  classes: [
    schoolClass("4e A"),
    schoolClass("3e B", { homeroomTeacher: { id: "teacher", name: "Awa" } }),
    schoolClass("Classe archivée", { isActive: false }),
    schoolClass("Ancienne année", { schoolYear: { id: "closed-year", label: "2025-2026" } }),
  ],
}

function renderReminder(path = "/teachers") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/teachers" element={<HomeroomTeacherReminder />} />
          <Route path="/students" element={<HomeroomTeacherReminder />} />
          <Route path="/academic/classes" element={<><h1>Structure scolaire</h1><AcademicNavigation /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...rendered, queryClient }
}

describe("Rappel professeur principal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ permissions: ["classes.view"] })
    listClassesMock.mockResolvedValue(catalog)
  })

  it.each(["/teachers", "/students"])("ouvre Structure scolaire sur Classes depuis %s", async (path) => {
    renderReminder(path)
    const link = await screen.findByRole("link", { name: "Ouvrir l’onglet Classes" })
    expect(screen.getByRole("alert")).toHaveTextContent("1 classe de l’année active est concernée : 4e A")
    expect(screen.getByRole("alert")).not.toHaveTextContent("Classe archivée")
    expect(screen.getByRole("alert")).not.toHaveTextContent("Ancienne année")
    expect(screen.getByRole("alert")).not.toHaveTextContent("3e B")
    expect(link).toHaveAttribute("href", "/academic/classes")
    fireEvent.click(link)
    expect(await screen.findByRole("heading", { name: "Structure scolaire" })).toBeVisible()
    expect(screen.getByRole("tab", { name: "Classes" })).toHaveAttribute("aria-selected", "true")
  })

  it("ne consulte pas les classes sans permission de lecture", () => {
    useAuthStore.setState({ permissions: ["teachers.view"] })
    const { container } = renderReminder()
    expect(container).toBeEmptyDOMElement()
    expect(listClassesMock).not.toHaveBeenCalled()
  })

  it.each([
    { ...catalog, activeSchoolYear: null },
    { ...catalog, classes: [] },
    { ...catalog, classes: [schoolClass("4e A", { homeroomTeacher: { id: "teacher", name: "Awa" } })] },
  ])("n’affiche aucun rappel lorsqu’aucune classe active n’est concernée", async (data) => {
    listClassesMock.mockResolvedValue(data)
    const { container } = renderReminder()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it("permet de relancer la vérification après une erreur", async () => {
    listClassesMock.mockRejectedValueOnce(new Error("network")).mockResolvedValue(catalog)
    renderReminder()
    fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }))
    expect(await screen.findByRole("link", { name: "Ouvrir l’onglet Classes" })).toBeVisible()
  })

  it("retire le rappel après la désignation du professeur principal et l’invalidation des classes", async () => {
    const { queryClient, container } = renderReminder()
    await screen.findByRole("link", { name: "Ouvrir l’onglet Classes" })
    listClassesMock.mockResolvedValue({ ...catalog, classes: [schoolClass("4e A", { homeroomTeacher: { id: "teacher", name: "Awa" } })] })
    await queryClient.invalidateQueries({ queryKey: ["academic", "classes"] })
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
