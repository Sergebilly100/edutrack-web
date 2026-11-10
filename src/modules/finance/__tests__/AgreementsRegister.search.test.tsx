import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const listMock = vi.hoisted(() => vi.fn())
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }))
vi.mock("../finance.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../finance.api")>()),
  listAgreementsRegister: listMock,
}))
vi.mock("../components/StudentSearch", () => ({ StudentSearch: () => null }))
vi.mock("../components/AgreementDetailDialog", () => ({ AgreementDetailDialog: () => null }))

import { AgreementsRegister } from "../components/AgreementsRegister"

const entry = {
  id: "a1", kind: "override", status: "active", student_id: "s1", school_year_id: "y1", student_name: "Fatou Koné",
  matricule: "M1", class_name: "6ème A", level_name: "6ème", discount_amount: 1000, override_total_amount: 0,
  active_discount_amount: 0, plan_total_amount: 10000, total_paid: 0, remaining_due: 9000, financial_status: "up_to_date",
  created_at: "2026-10-01T10:00:00Z", created_by_name: null, withdrawn_at: null, step_count: 0, schedule_total_amount: 0, next_due_date: null,
}
const page = (entries: unknown[]) => ({ entries, pagination: { page: 1, limit: 20, total: entries.length, totalPages: 1 } })

const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter><AgreementsRegister schoolYearId="y1" /></MemoryRouter></QueryClientProvider>)

describe("AgreementsRegister – recherche fluide", () => {
  beforeEach(() => { listMock.mockReset().mockResolvedValue(page([entry])) })

  it("garde le champ monté, le focus et la liste pendant la requête, avec une seule requête par pause", async () => {
    mount()
    const input = await screen.findByLabelText("Rechercher un accord")
    expect(await screen.findByText("Fatou Koné")).toBeInTheDocument()
    expect(listMock).toHaveBeenCalledTimes(1)
    let resolve!: (value: unknown) => void
    listMock.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    input.focus()
    fireEvent.change(input, { target: { value: "f" } })
    fireEvent.change(input, { target: { value: "fa" } })
    fireEvent.change(input, { target: { value: "fat" } })
    expect(input).toHaveValue("fat")
    expect(listMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2), { timeout: 1500 })
    expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: "fat", page: 1 }))
    expect(screen.getByLabelText("Rechercher un accord")).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(screen.getByText("Fatou Koné")).toBeInTheDocument()
    expect(await screen.findByRole("status")).toHaveTextContent("Recherche")
    resolve(page([entry]))
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull())
  })

  it("efface la recherche avec le bouton dédié", async () => {
    mount()
    const input = await screen.findByLabelText("Rechercher un accord")
    fireEvent.change(input, { target: { value: "kone" } })
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: "kone" })), { timeout: 1500 })
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }))
    expect(input).toHaveValue("")
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: "" })), { timeout: 1500 })
  })
})
