import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ listFinancialProfiles: vi.fn(), listCashierCandidates: vi.fn() }))
vi.mock("@/modules/students/students.api", () => ({ listFinancialProfiles: mocks.listFinancialProfiles, listCashierCandidates: mocks.listCashierCandidates }))
import { StudentSearch } from "../components/StudentSearch"

describe("StudentSearch financial dossiers", () => {
  it("cherche les inscrits confirmés dans l’année de l’opération", async () => {
    const student = { id: "student-current", firstName: "Jean", lastName: "Recette", matricule: "NEW-001", classId: "class-current", className: "6ème A" }
    mocks.listFinancialProfiles.mockResolvedValue({ data: [student] })
    const onChange = vi.fn()
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentSearch schoolYearId="year-current" value={null} onChange={onChange} /></QueryClientProvider>)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Jean" } })
    fireEvent.click(await screen.findByRole("option", { name: /Recette Jean/ }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(student))
    expect(mocks.listFinancialProfiles).toHaveBeenCalledWith({ schoolYearId: "year-current", search: "Jean", limit: 8, isActive: true })
  })

  it("propose les réinscriptions bloquées uniquement pour la saisie des encaissements", async () => {
    const student = { id: "student-blocked", firstName: "Aya", lastName: "Koné", matricule: "OLD-001", classId: "old-class", className: "5ème A", blockedReEnrollment: true, paymentSchoolYearId: "year-previous", paymentSchoolYearLabel: "2025-2026" }
    mocks.listCashierCandidates.mockResolvedValue({ data: [student] })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentSearch schoolYearId="year-current" includeBlockedReEnrollments value={null} onChange={vi.fn()} /></QueryClientProvider>)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Koné\u00a0Aya" } })
    expect(await screen.findByText("Réinscription bloquée · dette 2025-2026")).toBeInTheDocument()
    expect(mocks.listCashierCandidates).toHaveBeenCalledWith({ schoolYearId: "year-current", search: "Koné Aya", limit: 8, isActive: true })
  })
})
