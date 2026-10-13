import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

const listPayments = vi.hoisted(() => vi.fn())
vi.mock("@/modules/finance/finance.api", () => ({ listPayments }))
import { StudentYearPayments } from "../components/StudentYearPayments"

describe("StudentYearPayments", () => {
  it("présente les encaissements et remises de la seule année consultée", async () => {
    listPayments.mockResolvedValue([
      { id: "payment-1", status: "confirmed", paymentDate: "2025-10-10", receiptNumber: "RC-1", amount: 30000 },
      { id: "waiver-1", status: "waived_by_school", paymentDate: "2025-11-01", receiptNumber: "", amount: 5000 },
    ])
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudentYearPayments studentId="student-1" schoolYearId="year-2025" schoolYearLabel="2025-2026" />
    </QueryClientProvider>)
    expect(await screen.findByText("Paiement confirmé")).toBeInTheDocument()
    expect(screen.getByText("Remise accordée")).toBeInTheDocument()
    expect(listPayments).toHaveBeenCalledWith("student-1", "year-2025")
  })
})
