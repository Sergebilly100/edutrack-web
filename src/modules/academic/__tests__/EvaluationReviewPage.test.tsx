import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchOptions, fetchReview, fetchSpontaneous } = vi.hoisted(() => ({ fetchOptions: vi.fn(), fetchReview: vi.fn(), fetchSpontaneous: vi.fn() }))
vi.mock("@/modules/academic/evaluation-review.api", () => ({
  fetchReviewOptions: (...args: unknown[]) => fetchOptions(...args),
  fetchEvaluationReview: (...args: unknown[]) => fetchReview(...args),
  fetchSpontaneousReview: (...args: unknown[]) => fetchSpontaneous(...args),
}))

import EvaluationReviewPage from "@/modules/academic/EvaluationReviewPage"

const options = {
  schoolYears: [{ id: "y1", label: "2026-2027", active: true }, { id: "y2", label: "2027-2028", active: false }],
  gradingPeriods: [{ id: "p1", label: "Premier trimestre", schoolYearId: "y1", isCurrent: true, isFuture: false, hasEvaluations: true }],
  levels: [{ id: "l1", label: "6e" }], classes: [{ id: "c1", label: "6e A", levelId: "l1" }],
  subjects: [{ id: "s1", label: "Mathématiques", levelId: "l1" }], teachers: [{ id: "t1", label: "Professeur A" }],
}
const evaluation = {
  id: "e1", label: "Devoir 1", date: "2026-10-01", type: "scheduled", coefficient: 2,
  subject: { id: "s1", name: "Mathématiques" }, teacher: { id: "t1", name: "Professeur A" },
  class: { id: "c1", name: "6e A" }, level: { id: "l1", name: "6e" }, period: { id: "p1", name: "Premier trimestre" },
  notes: [{ studentId: "st1", studentName: "Kouassi Awa", score: 14, maxScore: 20, comment: "Bien" },
    { studentId: "st2", studentName: "Koné Moussa", score: null, maxScore: null, comment: null }],
}

const mount = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <EvaluationReviewPage />
</QueryClientProvider></MemoryRouter>)

describe("EvaluationReviewPage", () => {
  beforeEach(() => {
    fetchOptions.mockReset().mockResolvedValue(options)
    fetchReview.mockReset().mockResolvedValue({ items: [evaluation], summary: { evaluations: 1, grades: 1, missing: 1 }, page: 1, pageSize: 20, total: 1 })
    fetchSpontaneous.mockReset().mockResolvedValue({ students: [], totalStudents: 0, totalNotes: 0, page: 1, pageSize: 20 })
  })

  it("affiche le détail de l’évaluation et les notes manquantes sur une largeur mobile", async () => {
    window.innerWidth = 390
    mount()
    expect(screen.getByRole("note")).toHaveTextContent("Utilisez les filtres pour obtenir des résultats plus précis")
    expect(within(screen.getByRole("region", { name: "Filtres" })).getByRole("combobox", { name: "Classe" })).toBeDisabled()
    const toggle = await screen.findByRole("button", { name: /Devoir 1/ })
    expect(within(screen.getByRole("region", { name: "Synthèse" })).getAllByText("1", { selector: "strong" })).toHaveLength(3)
    fireEvent.click(toggle)
    expect(screen.getByText("Kouassi Awa")).toBeInTheDocument()
    expect(screen.getByText("14 / 20")).toBeInTheDocument()
    expect(screen.getByText("Bien")).toBeInTheDocument()
    expect(screen.getByText("Note manquante")).toBeInTheDocument()
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.queryByRole("button", { name: /modifier|supprimer|créer/i })).not.toBeInTheDocument()
  })

  it("efface les filtres enfants quand l’année change", async () => {
    mount()
    await screen.findByRole("button", { name: /Devoir 1/ })
    const filters = screen.getByRole("region", { name: "Filtres" })
    fireEvent.click(within(filters).getByRole("combobox", { name: "Année scolaire" }))
    fireEvent.click(screen.getByRole("option", { name: "2027-2028" }))
    await waitFor(() => expect(fetchOptions).toHaveBeenCalledWith({ schoolYearId: "y2", levelId: undefined, classId: undefined }))
    expect(fetchReview).not.toHaveBeenLastCalledWith(expect.objectContaining({ schoolYearId: "y2", levelId: "l1" }))
  })

  it("réinitialise classe, matière et professeur après un changement de niveau", async () => {
    fetchOptions.mockResolvedValue({ ...options,
      levels: [...options.levels, { id: "l2", label: "5e" }],
      classes: [...options.classes, { id: "c2", label: "5e A", levelId: "l2" }],
    })
    mount()
    await screen.findByRole("button", { name: /Devoir 1/ })
    const filters = screen.getByRole("region", { name: "Filtres" })
    for (const [label, option] of [["Niveau", "6e"], ["Classe", "6e A"], ["Matière", "Mathématiques"], ["Professeur", "Professeur A"]]) {
      const select = within(filters).getByRole("combobox", { name: label })
      await waitFor(() => expect(select).toBeEnabled())
      fireEvent.click(select)
      fireEvent.click(screen.getByRole("option", { name: option }))
    }
    await waitFor(() => expect(fetchReview).toHaveBeenLastCalledWith(expect.objectContaining({ classId: "c1", subjectId: "s1", teacherId: "t1" })))
    const levelSelect = within(filters).getByRole("combobox", { name: "Niveau" })
    await waitFor(() => expect(levelSelect).toBeEnabled())
    fireEvent.click(levelSelect)
    fireEvent.click(screen.getByRole("option", { name: "5e" }))
    await waitFor(() => expect(fetchReview).toHaveBeenLastCalledWith(expect.objectContaining({ levelId: "l2", classId: undefined, subjectId: undefined, teacherId: undefined })))
  })

  it("choisit d’abord une période renseignée et réinitialise les filtres après un changement de période", async () => {
    fetchOptions.mockResolvedValue({ ...options, gradingPeriods: [
      { id: "p2", label: "Deuxième trimestre", schoolYearId: "y1", isCurrent: false, isFuture: false, hasEvaluations: false },
      { id: "p1", label: "Premier trimestre", schoolYearId: "y1", isCurrent: false, isFuture: false, hasEvaluations: true },
    ] })
    mount()
    await waitFor(() => expect(fetchReview).toHaveBeenCalledWith(expect.objectContaining({ gradingPeriodId: "p1" })))
    const filters = screen.getByRole("region", { name: "Filtres" })
    for (const [label, option] of [["Niveau", "6e"], ["Classe", "6e A"], ["Matière", "Mathématiques"], ["Professeur", "Professeur A"]]) {
      const select = within(filters).getByRole("combobox", { name: label })
      await waitFor(() => expect(select).toBeEnabled())
      fireEvent.click(select)
      fireEvent.click(screen.getByRole("option", { name: option }))
    }
    await waitFor(() => expect(fetchReview).toHaveBeenLastCalledWith(expect.objectContaining({
      levelId: "l1", classId: "c1", subjectId: "s1", teacherId: "t1",
    })))
    fireEvent.click(within(filters).getByRole("combobox", { name: "Période" }))
    fireEvent.click(screen.getByRole("option", { name: "Deuxième trimestre" }))
    await waitFor(() => expect(fetchOptions).toHaveBeenLastCalledWith(expect.objectContaining({
      gradingPeriodId: "p2", levelId: undefined, classId: undefined, subjectId: undefined,
    })))
    await waitFor(() => expect(fetchReview).toHaveBeenLastCalledWith(expect.objectContaining({
      gradingPeriodId: "p2", levelId: undefined, classId: undefined, subjectId: undefined, teacherId: undefined,
    })))
  })

  it("laisse choisir une période future et charge ses filtres", async () => {
    fetchOptions.mockResolvedValue({ ...options, gradingPeriods: [
      { id: "p2", label: "Deuxième trimestre", schoolYearId: "y1", isCurrent: false, isFuture: true, hasEvaluations: false },
      { id: "p1", label: "Premier trimestre", schoolYearId: "y1", isCurrent: true, isFuture: false, hasEvaluations: true },
    ] })
    mount()
    await waitFor(() => expect(fetchReview).toHaveBeenCalledWith(expect.objectContaining({ gradingPeriodId: "p1" })))
    const filters = screen.getByRole("region", { name: "Filtres" })
    fireEvent.click(within(filters).getByRole("combobox", { name: "Période" }))
    fireEvent.click(screen.getByRole("option", { name: "Deuxième trimestre (à venir)" }))
    await waitFor(() => expect(fetchOptions).toHaveBeenLastCalledWith(expect.objectContaining({ gradingPeriodId: "p2" })))
    await waitFor(() => expect(fetchReview).toHaveBeenLastCalledWith(expect.objectContaining({ gradingPeriodId: "p2" })))
    expect(within(filters).getByRole("combobox", { name: "Période" })).toHaveTextContent("Deuxième trimestre (à venir)")
  })

  it("présente un état vide sans masquer les filtres", async () => {
    fetchReview.mockResolvedValue({ items: [], summary: { evaluations: 0, grades: 0, missing: 0 }, page: 1, pageSize: 20, total: 0 })
    mount()
    expect(await screen.findByText("Aucune évaluation")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Filtres" })).toBeInTheDocument()
  })

  it("signale l’absence de période configurée", async () => {
    fetchOptions.mockImplementation(({ schoolYearId }: { schoolYearId?: string }) => Promise.resolve(schoolYearId
      ? { ...options, gradingPeriods: [] } : options))
    mount()
    expect(await screen.findByText("Aucune période configurée")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Filtres" })).getByRole("combobox", { name: "Période" })).toBeDisabled()
    expect(fetchReview).not.toHaveBeenCalled()
    expect(fetchSpontaneous).not.toHaveBeenCalled()
  })

  it("présente les ajustements spontanés par élève puis matière sans notes manquantes", async () => {
    fetchSpontaneous.mockResolvedValue({ totalStudents: 1, totalNotes: 2, page: 1, pageSize: 20,
      students: [{ id: "st1", name: "Kouassi Awa", matricule: "CI-001", subjects: [
        { id: "s1", name: "Mathématiques", notes: [{ evaluationId: "sp1", date: "2026-10-02", adjustment: 3,
          teacher: { id: "t1", name: "Professeur A" }, className: "6e A", comment: "Bravo" }] },
        { id: "s2", name: "Français", notes: [{ evaluationId: "sp2", date: "2026-10-03", adjustment: -2,
          teacher: { id: "t2", name: "Professeur B" }, className: "6e A", comment: null }] },
      ] }],
    })
    mount()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes spontanées" }), { button: 0, ctrlKey: false })
    const section = await screen.findByRole("region", { name: "Notes spontanées" })
    const student = await within(section).findByRole("button", { name: /Kouassi Awa/ })
    expect(student).toHaveAttribute("aria-expanded", "false")
    expect(student).toHaveTextContent("6e A · CI-001")
    expect(within(section).queryByText("+3 points")).not.toBeInTheDocument()
    fireEvent.click(student)
    expect(student).toHaveAttribute("aria-expanded", "true")
    expect(within(section).getByRole("heading", { name: "Mathématiques" })).toBeInTheDocument()
    expect(within(section).getByRole("heading", { name: "Français" })).toBeInTheDocument()
    expect(within(section).getByText("+3 points")).toBeInTheDocument()
    expect(within(section).getByText("-2 points")).toBeInTheDocument()
    expect(within(section).getByText(/02\/10\/2026 · Professeur A/)).toBeInTheDocument()
    expect(within(section).getByText(/03\/10\/2026 · Professeur B/)).toBeInTheDocument()
    expect(within(section).queryByText("Koné Moussa")).not.toBeInTheDocument()
    expect(within(section).queryByText("Note manquante")).not.toBeInTheDocument()
  })

  it("recherche un élève dans toutes les pages et referme le détail quand la sélection change", async () => {
    const student = (id: string, name: string) => ({ id, name, matricule: null, subjects: [{ id: "s1", name: "Mathématiques", notes: [
      { evaluationId: `sp-${id}`, date: "2026-10-02", adjustment: 3, teacher: { id: "t1", name: "Professeur A" }, className: "6e A", comment: null },
    ] }] })
    fetchSpontaneous.mockImplementation(({ page, pageSize, studentSearch }: { page: number; pageSize: number; studentSearch?: string }) => Promise.resolve(
      studentSearch ? { students: [student("st21", "Koné Moussa")], totalStudents: 1, totalNotes: 1, page, pageSize } :
        { students: [student(page === 1 ? "st1" : "st2", page === 1 ? "Kouassi Awa" : "Yao Nina")], totalStudents: 21, totalNotes: 21, page, pageSize }))
    mount()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes spontanées" }), { button: 0, ctrlKey: false })
    const section = await screen.findByRole("region", { name: "Notes spontanées" })
    fireEvent.click(await within(section).findByRole("button", { name: /Kouassi Awa/ }))
    expect(within(section).getByText("+3 points")).toBeInTheDocument()
    fireEvent.click(within(section).getByRole("button", { name: "Suivant" }))
    await waitFor(() => expect(within(section).getByRole("button", { name: /Yao Nina/ })).toHaveAttribute("aria-expanded", "false"))
    fireEvent.change(within(section).getByLabelText("Rechercher un élève"), { target: { value: "Koné" } })
    fireEvent.click(within(section).getByRole("button", { name: "Rechercher" }))
    await waitFor(() => expect(fetchSpontaneous).toHaveBeenLastCalledWith(expect.objectContaining({ studentSearch: "Koné", page: 1 })))
    const searchedSection = await screen.findByRole("region", { name: "Notes spontanées" })
    expect(within(searchedSection).getByRole("button", { name: /Koné Moussa/ })).toHaveAttribute("aria-expanded", "false")
    expect(within(searchedSection).getByRole("button", { name: "Suivant" })).toBeDisabled()
  })

  it("ne garde ouvert que le détail de l’élève sélectionné", async () => {
    fetchSpontaneous.mockResolvedValue({ totalStudents: 2, totalNotes: 2, page: 1, pageSize: 20,
      students: ["Kouassi Awa", "Koné Moussa"].map((name, index) => ({ id: `st${index}`, name, matricule: null, subjects: [
        { id: "s1", name: "Mathématiques", notes: [{ evaluationId: `sp${index}`, date: "2026-10-02", adjustment: index + 1,
          teacher: { id: "t1", name: "Professeur A" }, className: "6e A", comment: null }] },
      ] })),
    })
    mount()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes spontanées" }), { button: 0, ctrlKey: false })
    const section = await screen.findByRole("region", { name: "Notes spontanées" })
    const awa = await within(section).findByRole("button", { name: /Kouassi Awa/ })
    const moussa = within(section).getByRole("button", { name: /Koné Moussa/ })
    fireEvent.click(awa)
    expect(within(section).getByText("+1 point")).toBeInTheDocument()
    fireEvent.click(moussa)
    expect(awa).toHaveAttribute("aria-expanded", "false")
    expect(moussa).toHaveAttribute("aria-expanded", "true")
    expect(within(section).queryByText("+1 point")).not.toBeInTheDocument()
    expect(within(section).getByText("+2 points")).toBeInTheDocument()
  })

  it("affiche une pagination visible et permet d’atteindre directement une page parmi mille élèves", async () => {
    fetchSpontaneous.mockImplementation(({ page, pageSize }: { page: number; pageSize: number }) => Promise.resolve({
      students: [{ id: "st1", name: "Kouassi Awa", matricule: null, subjects: [{ id: "s1", name: "Mathématiques", notes: [
        { evaluationId: "sp1", date: "2026-10-02", adjustment: 1, teacher: { id: "t1", name: "Professeur A" }, className: "6e A", comment: null },
      ] }] }], totalStudents: 1000, totalNotes: 1500, page, pageSize,
    }))
    mount()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes spontanées" }), { button: 0, ctrlKey: false })
    const section = await screen.findByRole("region", { name: "Notes spontanées" })
    const pagination = await within(section).findByRole("navigation", { name: "Pagination des élèves" })
    expect(within(pagination).getByText(/1–20 sur 1.000 élèves/)).toBeInTheDocument()
    expect(within(pagination).getByText("Page 1 sur 50")).toBeInTheDocument()
    fireEvent.change(within(pagination).getByLabelText("Aller à la page"), { target: { value: "17" } })
    fireEvent.click(within(pagination).getByRole("button", { name: "Aller" }))
    await waitFor(() => expect(fetchSpontaneous).toHaveBeenLastCalledWith(expect.objectContaining({ page: 17, pageSize: 20 })))
    const pageSizeSelect = await within(section).findByRole("combobox", { name: "Élèves par page" })
    fireEvent.click(pageSizeSelect)
    fireEvent.click(screen.getByRole("option", { name: "50" }))
    await waitFor(() => expect(fetchSpontaneous).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 })))
  })
})
