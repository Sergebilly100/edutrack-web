import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { recordMock, toastMock } = vi.hoisted(() => ({ recordMock: vi.fn(), toastMock: vi.fn() }))
vi.mock("../finance.api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../finance.api")>()), recordPayment: recordMock }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock("../components/StudentSearch", () => ({
  StudentSearch: ({ onChange }: { onChange: (student: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ id: "student-1", firstName: "Awa", lastName: "Koné", className: "6ème A", matricule: "MAT-1" })}>Choisir Awa Koné</button>
  ),
}))

import { QuickPaymentEntry } from "../components/QuickPaymentEntry"

describe("QuickPaymentEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recordMock.mockResolvedValue({ payment: { id: "payment-1" }, financialStatus: { remainingDue: 0 } })
  })

  it("enregistre une ligne à Entrée puis prépare la suivante", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QuickPaymentEntry schoolYearId="year-1" schoolYearLabel="2026-2027" /></QueryClientProvider>)

    fireEvent.click(screen.getAllByRole("button", { name: "Choisir Awa Koné" })[0]!)
    const amount = screen.getByLabelText("Montant ligne 1")
    fireEvent.change(amount, { target: { value: "25000" } })
    fireEvent.keyDown(amount, { key: "Enter" })
    fireEvent.keyDown(amount, { key: "Enter" })

    await waitFor(() => expect(recordMock).toHaveBeenCalledWith(expect.objectContaining({
      studentId: "student-1", schoolYearId: "year-1", amount: 25000, method: "cash",
    })))
    expect(recordMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText((_content, element) =>
      element?.tagName === "SPAN" && element.textContent === "1 paiement enregistré",
    )).toBeInTheDocument())
    expect(screen.getAllByRole("button", { name: "Choisir Awa Koné" }).length).toBeGreaterThan(1)
  })
})
