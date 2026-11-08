import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ permissions: new Set<string>(), status: vi.fn(), statement: vi.fn(), cancel: vi.fn(), navigate: vi.fn() }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (key: string) => mocks.permissions.has(key) }) }))
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useNavigate: () => mocks.navigate }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("../finance.api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../finance.api")>()), getFinancialStatus: mocks.status, getStudentAccountStatement: mocks.statement, cancelPayment: mocks.cancel }))

import { PaymentHistoryPanel } from "../components/PaymentHistoryPanel"

const payment = (id: string, date: string, amount: number, balanceAfter: number, over: Record<string, unknown> = {}) => ({
  id, studentId: "s1", schoolYearId: "y1", amount, method: "cash", source: "cashier_manual", status: "confirmed", providerReference: null,
  schoolReceiptReference: "REF-1", receiptNumber: `REC-${id}`, cancelledAt: null, cancellationReason: null, paymentDate: date, createdAt: `${date}T10:00:00Z`, runningPaid: 0, balanceAfter, ...over,
})
const status = (over: Record<string, unknown> = {}) => ({ studentId: "s1", schoolYearId: "y1", asOfDate: "2026-11-05", currency: "FCFA", totalDue: 300000, discountAmount: 0, confirmedPaid: 200000, remainingDue: 100000, cumulativeExpectedAtDate: 300000, standing: "late", ...over })

const renderPanel = (canCancel = false) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><PaymentHistoryPanel schoolYearId="y1" schoolYearLabel="03/2026 – 12/2026" canCancel={canCancel} studentId="s1" /></MemoryRouter></QueryClientProvider>)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = new Set(["payments.view"])
  mocks.status.mockResolvedValue(status())
  mocks.statement.mockResolvedValue({ student: { id: "s1", name: "Mohamed Ady Koffi", matricule: "ETS-234982", classId: "c", className: "6A" }, schoolYearId: "y1", currency: "FCFA", totalDue: 300000, movements: [payment("1", "2026-11-04", 100000, 200000), payment("2", "2026-11-05", 100000, 100000)] })
})

describe("Détail financier – remise près du Total dû", () => {
  it("affiche « Remise : X FCFA » avec une remise active", async () => {
    mocks.status.mockResolvedValue(status({ discountAmount: 50000 }))
    renderPanel()
    expect(await screen.findByText(/Remise : 50.000 FCFA/)).toBeInTheDocument()
  })
  it("n'affiche rien sans remise ou avec remise retirée (montant 0)", async () => {
    renderPanel()
    await screen.findByText("Cumul versé")
    expect(screen.queryByText(/Remise :/)).toBeNull()
  })
})

describe("Détail financier – contenu", () => {
  it("synthèse, écart intégré, total des paiements, plus récent d'abord, sans « 00:00 »", async () => {
    renderPanel()
    expect(await screen.findByText(/67 % réglé/)).toBeInTheDocument()
    expect(screen.getByText(/Seuil attendu à ce jour : 300.000 FCFA · il manque 100.000 FCFA/)).toBeInTheDocument()
    expect(screen.getByText(/2 paiements · 200.000 FCFA/)).toBeInTheDocument()
    expect(screen.queryByText(/00:00/)).toBeNull()
    const firstRow = screen.getAllByRole("row")[1]!
    expect(firstRow).toHaveTextContent("REC-2")
    expect(screen.queryByText(/Retour à l/)).toBeNull()
  })
  it("chargement, erreur avec réessayer, état vide", async () => {
    mocks.statement.mockResolvedValue({ student: { id: "s1", name: "A B", matricule: null, classId: "c", className: "x" }, schoolYearId: "y1", currency: "FCFA", totalDue: 0, movements: [] })
    renderPanel()
    expect(await screen.findByText("Aucun paiement")).toBeInTheDocument()
  })
  it("erreur : bouton réessayer", async () => {
    mocks.status.mockRejectedValue(new Error("boom"))
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: /Réessayer/ }))
    await waitFor(() => expect(mocks.status.mock.calls.length).toBeGreaterThan(1))
  })
})

describe("Détail financier – permissions", () => {
  it("« Enregistrer un paiement » exige payments.record", async () => {
    renderPanel()
    await screen.findByText("Cumul versé")
    expect(screen.queryByRole("button", { name: "Enregistrer un paiement" })).toBeNull()
  })
  it("avec payments.record : bouton visible et navigation vers l'encaissement", async () => {
    mocks.permissions = new Set(["payments.view", "payments.record"])
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer un paiement" }))
    expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/finance/encaissements?schoolYearId=y1"), expect.anything())
  })
  it("sans payments.view : pas de bouton Reçu ; sans payments.cancel : pas de menu d'annulation", async () => {
    mocks.permissions = new Set()
    renderPanel()
    await screen.findByText("Cumul versé")
    expect(screen.queryByRole("button", { name: "Reçu" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Autres actions/ })).toBeNull()
  })
  it("avec payments.cancel : menu « ··· », annulation avec motif obligatoire", async () => {
    mocks.permissions = new Set(["payments.view"])
    mocks.cancel.mockResolvedValue(undefined)
    renderPanel(true)
    expect((await screen.findAllByRole("button", { name: "Reçu" })).length).toBeGreaterThanOrEqual(2)
    const menu = screen.getAllByRole("button", { name: /Autres actions/ })[0]!
    fireEvent.keyDown(menu, { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Annuler le paiement" }))
    const confirm = await screen.findByRole("button", { name: "Confirmer l’annulation" })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Justification obligatoire"), { target: { value: "Erreur de saisie" } })
    fireEvent.click(confirm)
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith("2", "Erreur de saisie"))
  })
})
