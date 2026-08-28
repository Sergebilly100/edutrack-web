import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({ summary: vi.fn(), confirm: vi.fn() }))

vi.mock("../enrollments.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../enrollments.api")>()),
  getEnrollmentPaymentSummary: apiMocks.summary,
  confirmEnrollmentPayment: apiMocks.confirm,
}))

import EnrollmentPaymentPage from "../EnrollmentPaymentPage"

describe("EnrollmentPaymentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.summary.mockResolvedValue({
      enrollment: {
        id: "enrollment-1",
        studentId: "student-1",
        classId: "class-1",
        schoolYearId: "year-1",
        className: "6ème A",
        schoolYearLabel: "2026-2027",
        status: "pending_cashier",
        type: "new",
      },
      amountDue: 125000,
      totalDue: 150000,
      confirmedPaid: 25000,
      currency: "FCFA",
    })
    apiMocks.confirm.mockResolvedValue({ enrollment: { id: "enrollment-1", status: "confirmed" } })
  })

  it("saisit et confirme un paiement partiel sans imposer le solde", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/enrollments/enrollment-1/payment"]}>
          <Routes><Route path="/enrollments/:enrollmentId/payment" element={<EnrollmentPaymentPage />} /><Route path="/enrollments" element={<p>Liste des inscriptions</p>} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect((await screen.findAllByText(/125\s*000 FCFA/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/25\s*000 FCFA déjà versés/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Saisir le montant reçu" })).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Montant reçu *"), { target: { value: "30000" } })
    expect(screen.getByRole("button", { name: /Enregistrer 30\s*000 FCFA/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Référence du reçu de caisse *"), { target: { value: "RC-2026-0042" } })
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer 30\s*000 FCFA/ }))
    await waitFor(() => expect(apiMocks.confirm).toHaveBeenCalledWith("enrollment-1", {
      amount: 30000,
      method: "cash",
      schoolReceiptReference: "RC-2026-0042",
    }))
  })
})
