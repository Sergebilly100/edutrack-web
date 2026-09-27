import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "@/shared/store/auth.store"
import { readTuitionRecovery } from "@/modules/finance/tuition-recovery"
import { ApiError } from "@/shared/api/client"

const apiMocks = vi.hoisted(() => ({ summary: vi.fn(), confirm: vi.fn() }))

vi.mock("../enrollments.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../enrollments.api")>()),
  getEnrollmentPaymentSummary: apiMocks.summary,
  confirmEnrollmentPayment: apiMocks.confirm,
}))

import EnrollmentPaymentPage from "../EnrollmentPaymentPage"

describe("EnrollmentPaymentPage", () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ permissions: [] })
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

  it.each([true, false])("affiche l’aide contextualisée et respecte tuition.edit (%s)", async (canEdit) => {
    const enrollmentId = "550e8400-e29b-41d4-a716-446655440001"
    const context = { schoolYearId: "550e8400-e29b-41d4-a716-446655440002", schoolYearLabel: "2026-2027", levelId: "550e8400-e29b-41d4-a716-446655440003", levelName: "Sixième" }
    useAuthStore.setState({ permissions: canEdit ? ["tuition.edit"] : [] })
    apiMocks.summary.mockRejectedValue(new ApiError("Frais requis", { code: "TUITION_PLAN_REQUIRED", cause: { isAxiosError: true, response: { status: 409, data: { code: "TUITION_PLAN_REQUIRED", context } } } }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/enrollments/${enrollmentId}/payment`]}><Routes><Route path="/enrollments/:enrollmentId/payment" element={<EnrollmentPaymentPage />} /></Routes></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByText(/Les frais du niveau Sixième pour l’année 2026-2027/)).toBeInTheDocument()
    expect(screen.queryByText(/Impossible de calculer/)).not.toBeInTheDocument()
    if (canEdit) {
      const href = screen.getByRole("link", { name: "Configurer les frais" }).getAttribute("href")!
      expect(readTuitionRecovery(new URLSearchParams(href.split("?")[1]))).toEqual({ ...context, enrollmentId, returnTo: `/enrollments/${enrollmentId}/payment` })
    } else {
      expect(screen.queryByRole("link", { name: "Configurer les frais" })).not.toBeInTheDocument()
      expect(screen.getByText(/Contactez le responsable habilité/)).toBeInTheDocument()
    }
  })

  it("traite aussi TUITION_PLAN_REQUIRED lors de la confirmation", async () => {
    apiMocks.confirm.mockRejectedValue({ isAxiosError: true, response: { data: { code: "TUITION_PLAN_REQUIRED" } } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/enrollments/enrollment-1/payment"]}><Routes><Route path="/enrollments/:enrollmentId/payment" element={<EnrollmentPaymentPage />} /></Routes></MemoryRouter></QueryClientProvider>)
    await screen.findByLabelText("Montant reçu *")
    fireEvent.change(screen.getByLabelText("Montant reçu *"), { target: { value: "30000" } })
    fireEvent.change(screen.getByLabelText("Référence du reçu de caisse *"), { target: { value: "RC-TEST" } })
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer 30\s*000 FCFA/ }))
    expect(await screen.findByText(/Le plan de frais nécessaire/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Enregistrer 30\s*000 FCFA/ })).toBeDisabled()
  })

  it("saisit et confirme un paiement partiel sans imposer le solde", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidate = vi.spyOn(client, "invalidateQueries")
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
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["students"] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["academic", "classes"] })
  })
})
