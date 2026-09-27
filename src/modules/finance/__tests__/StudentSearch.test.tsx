import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ listFinancialProfiles: vi.fn() }))
vi.mock("@/modules/students/students.api", () => ({ listFinancialProfiles: mocks.listFinancialProfiles }))
import { StudentSearch } from "../components/StudentSearch"

describe("StudentSearch financial dossiers", () => {
  it("retrouve un dossier financier même sans classe d’inscription confirmée", async () => {
    const student = { id: "student-legacy", firstName: "Jean", lastName: "Recette", matricule: "OLD-001", classId: null, className: null }
    mocks.listFinancialProfiles.mockResolvedValue({ data: [student] })
    const onChange = vi.fn()
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentSearch value={null} onChange={onChange} /></QueryClientProvider>)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Jean" } })
    fireEvent.click(await screen.findByRole("option", { name: /Recette Jean/ }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(student))
    expect(mocks.listFinancialProfiles).toHaveBeenCalledWith({ search: "Jean", limit: 8, isActive: true })
  })
})
