import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCashJournal: vi.fn(), exportCashJournalExcel: vi.fn(), exportCashJournalPdf: vi.fn(), requestPaymentReceipt: vi.fn(), listClasses: vi.fn(),
  permissions: new Set<string>(["payments.view"]), canExport: true,
}))
vi.mock("../finance.api", () => ({
  getCashJournal: mocks.getCashJournal, exportCashJournalExcel: mocks.exportCashJournalExcel, exportCashJournalPdf: mocks.exportCashJournalPdf, requestPaymentReceipt: mocks.requestPaymentReceipt,
}))
vi.mock("@/modules/academic/academic.api", () => ({ listClasses: mocks.listClasses }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (key: string) => mocks.permissions.has(key) }) }))
vi.mock("@/shared/hooks/useStudentLabel", () => ({ useStudentLabels: () => ({ singular: "Élève", plural: "Élèves", singularLower: "élève", pluralLower: "élèves" }) }))
vi.mock("@/shared/hooks/useCanExportData", () => ({ useCanExportData: () => mocks.canExport }))
vi.mock("@/shared/hooks/usePdfExportJob", () => ({ usePdfExportJob: () => ({ launch: async (run: () => Promise<unknown>) => { await run() }, isRunning: false }) }))

import { CashJournalPanel } from "../components/CashJournalPanel"

const base = { studentId: "s1", schoolYearId: "y", method: "cash", source: "cashier_manual", confirmedByUserId: null, providerReference: null, schoolReceiptReference: null, cancelledAt: null, cancellationReason: null, createdAt: "2026-11-05T10:00:00Z", studentMatricule: "DEMO-1", classId: "c", className: "6ème A", cancelledBy: null }
const confirmed = { ...base, id: "p1", amount: 100000, status: "confirmed", paymentDate: "2026-11-05", receiptNumber: "REC-0000000004", studentName: "Mohamed Ady Koffi", providerReference: "REF-2532" }
const noRef = { ...base, id: "p2", amount: 90000, status: "confirmed", paymentDate: "2026-11-05", receiptNumber: "REC-0000000003", studentName: "Serge Kouamé" }
const cancelled = { ...base, id: "p3", amount: 100000, status: "cancelled", paymentDate: "2026-11-05", receiptNumber: "REC-0000000005", studentName: "Fatou Kouassi", cancelledBy: "Direction Démo", cancelledAt: "2026-11-06T09:14:00Z", cancellationReason: "Erreur de saisie" }
const journalWith = (entries: unknown[], extra: Record<string, unknown> = {}) => ({
  entries, totals: { cash: 190000, mobile_money: 0, bank_transfer: 0, grandTotal: 190000 }, counts: { confirmed: 2, cancelled: 1 }, count: entries.length,
  pagination: { page: 1, limit: 20, total: entries.length, totalPages: 1 }, ...extra,
})

const renderPanel = (url = "/finance/journal") => render(<MemoryRouter initialEntries={[url]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CashJournalPanel schoolYearId="year" /></QueryClientProvider></MemoryRouter>)

const desktop = async () => within(await screen.findByRole("table"))

describe("CashJournalPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    mocks.permissions = new Set(["payments.view"]); mocks.canExport = true
    mocks.listClasses.mockResolvedValue({ classes: [{ id: "c", name: "6ème A" }] })
    mocks.getCashJournal.mockResolvedValue(journalWith([confirmed, noRef, cancelled]))
  })

  it("groups payments by day with a summary that excludes cancelled amounts", async () => {
    mocks.permissions = new Set(["payments.view", "payments.cancel"])
    renderPanel()
    const table = await screen.findByRole("table")
    expect(within(table).getByText("Jeudi 5 novembre 2026")).toBeInTheDocument()
    expect(within(table).getByText("2 confirmés · 190 000 FCFA · 1 annulé")).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: "Statut" })).toBeInTheDocument()
    expect(within(table).getAllByText("Confirmé")).toHaveLength(2)
    expect(screen.queryByText("00:00")).not.toBeInTheDocument()
  })

  it("shows « — » when the reference is missing", async () => {
    renderPanel()
    const row = (await desktop()).getByText("Serge Kouamé").closest("tr")!
    expect(within(row).getByText("—")).toBeInTheDocument()
  })

  it("renders a cancelled payment tinted, struck through, with who and when, and keeps it out of the total", async () => {
    mocks.permissions = new Set(["payments.view", "payments.cancel"])
    renderPanel()
    const row = (await desktop()).getByText("Fatou Kouassi").closest("tr")!
    expect(row.className).toContain("bg-red-50")
    expect(within(row).getByText("Annulé")).toBeInTheDocument()
    expect(within(row).getByText(/par Direction Démo · 6 nov\., 09:14/)).toBeInTheDocument()
    expect(within(row).getByText("Motif : Erreur de saisie")).toBeInTheDocument()
    expect(within(row).getByText("100 000 FCFA")).toHaveClass("line-through")
    expect(within(row).queryByRole("button", { name: /Télécharger le reçu/ })).not.toBeInTheDocument()
    expect(screen.getByText("1 annulé · exclu du total")).toBeInTheDocument()
    expect(screen.getByText("Total confirmé").closest("div")!.parentElement).toHaveTextContent("190 000 FCFA")
    expect(screen.getByText(/2 paiements confirmés · 1 annulé · Total confirmé de la sélection : 190 000 FCFA/)).toBeInTheDocument()
  })

  it("shows an archived author label as provided by the API", async () => {
    mocks.permissions = new Set(["payments.view", "payments.cancel"])
    mocks.getCashJournal.mockResolvedValue(journalWith([{ ...cancelled, cancelledBy: "Ancien utilisateur (archivé)" }]))
    renderPanel()
    expect((await desktop()).getByText(/par Ancien utilisateur \(archivé\)/)).toBeInTheDocument()
  })

  it("never asks for cancelled payments nor shows the status filter without payments.cancel", async () => {
    mocks.getCashJournal.mockResolvedValue(journalWith([confirmed], { counts: { confirmed: 1, cancelled: 0 } }))
    renderPanel("/finance/journal?statut=cancelled")
    await desktop()
    expect(screen.queryByRole("combobox", { name: "Statut" })).not.toBeInTheDocument()
    expect(mocks.getCashJournal).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }))
    expect(screen.queryByText(/exclu/)).not.toBeInTheDocument()
  })

  it("filters by status with payments.cancel", async () => {
    mocks.permissions = new Set(["payments.view", "payments.cancel"])
    renderPanel()
    fireEvent.click(await screen.findByRole("combobox", { name: "Statut" }))
    fireEvent.click(await screen.findByRole("option", { name: "Annulés" }))
    await waitFor(() => expect(mocks.getCashJournal).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" })))
  })

  it("applies period shortcuts to the date range", async () => {
    renderPanel()
    await screen.findByRole("table")
    fireEvent.click(screen.getByRole("button", { name: "Aujourd'hui" }))
    await waitFor(() => {
      const last = mocks.getCashJournal.mock.calls.at(-1)![0]
      expect(last.from).toBe(last.to)
    })
    fireEvent.click(screen.getByRole("button", { name: "Personnalisé" }))
    expect(await screen.findByLabelText("Du")).toBeInTheDocument()
    expect(screen.getByLabelText("Au")).toBeInTheDocument()
  })

  it("exports from a single menu, forwarding the filters", async () => {
    mocks.permissions = new Set(["payments.view", "payments.cancel"])
    renderPanel("/finance/journal?statut=cancelled")
    await screen.findByRole("table")
    fireEvent.keyDown(screen.getByRole("button", { name: /Exporter/ }), { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Excel" }))
    await waitFor(() => expect(mocks.exportCashJournalExcel).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: "year", status: "cancelled" })))
    fireEvent.keyDown(screen.getByRole("button", { name: /Exporter/ }), { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "PDF" }))
    await waitFor(() => expect(mocks.exportCashJournalPdf).toHaveBeenCalled())
  })

  it("disables exports when the school forbids data export", async () => {
    mocks.canExport = false
    renderPanel()
    await screen.findByRole("table")
    expect(screen.getByRole("button", { name: /Exporter/ })).toBeDisabled()
  })

  it("only links student names and receipts the user may open", async () => {
    mocks.permissions = new Set(["payments.view"])
    renderPanel()
    const row = (await desktop()).getByText("Mohamed Ady Koffi").closest("tr")!
    expect(within(row).getByRole("link", { name: "Mohamed Ady Koffi" })).toHaveAttribute("href", expect.stringContaining("/finance/history/s1"))
    fireEvent.click(within(row).getByRole("button", { name: "Télécharger le reçu REC-0000000004" }))
    await waitFor(() => expect(mocks.requestPaymentReceipt).toHaveBeenCalledWith("p1"))
    cleanupAndRenderWithout()
  })

  it("renders names as plain text without payments.view", async () => {
    mocks.permissions = new Set()
    renderPanel()
    const row = (await desktop()).getByText("Mohamed Ady Koffi").closest("tr")!
    expect(within(row).queryByRole("link")).not.toBeInTheDocument()
  })

  it("shows the empty and error states", async () => {
    mocks.getCashJournal.mockResolvedValueOnce(journalWith([], { counts: { confirmed: 0, cancelled: 0 } }))
    renderPanel()
    expect(await screen.findByText("Aucun paiement sur cette période")).toBeInTheDocument()
  })

  it("shows an error with retry", async () => {
    mocks.getCashJournal.mockRejectedValue(new Error("offline"))
    renderPanel()
    expect(await screen.findByText("Impossible de charger le journal de caisse.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument()
  })
})

function cleanupAndRenderWithout() { /* no-op: kept for readability of the permission scenarios above */ }
