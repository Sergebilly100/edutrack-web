import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const financeMocks = vi.hoisted(() => ({
  status: vi.fn(), payments: vi.fn(), options: vi.fn(), receipt: vi.fn(),
}))
vi.mock("@/modules/finance/finance.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/finance/finance.api")>()),
  getParentFinancialStatus: financeMocks.status,
  getParentAccountStatement: financeMocks.payments,
  getParentPaymentOptions: financeMocks.options,
  requestParentPaymentReceipt: financeMocks.receipt,
}))
vi.mock("../parent.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../parent.api")>()),
  listParentStudents: vi.fn().mockResolvedValue([{ id: "student-1", first_name: "Awa", last_name: "Koné", class_name: "6ème A" }]),
  fetchParentSchoolConfig: vi.fn().mockResolvedValue({ activeSchoolYear: "year-1" }),
}))
vi.mock("@/shared/hooks/usePdfExportJob", () => ({ usePdfExportJob: () => ({ launch: vi.fn(), isRunning: false }) }))

import ParentPaymentsPage from "../ParentPaymentsPage"

describe("ParentPaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    financeMocks.status.mockResolvedValue({ totalDue: 100000, confirmedPaid: 25000, remainingDue: 75000, cumulativeExpectedAtDate: 20000, standing: "up_to_date", currency: "FCFA" })
    financeMocks.payments.mockResolvedValue({ movements: [{ id: "payment-1", amount: 25000, method: "cash", status: "confirmed", receiptNumber: "REC-1", paymentDate: "2026-08-19", createdAt: "2026-08-19T10:00:00.000Z", balanceAfter: 75000 }] })
    financeMocks.options.mockResolvedValue({ inAppPaymentActive: false, disabledReason: "temporarily_disabled", manualPaymentChannels: [{ provider: "orange_money", merchantNumber: "0700000000" }] })
  })

  it("affiche les consignes manuelles sans bouton Payer", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ParentPaymentsPage /></QueryClientProvider>)

    expect(await screen.findByText((_content, element) =>
      element?.tagName === "P" && element.textContent?.replace(/\s/g, "") === "75000FCFA",
    )).toBeInTheDocument()
    expect(screen.getByText("0700000000")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Payer$/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Télécharger le reçu" })).toBeInTheDocument()
  })
})
