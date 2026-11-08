import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ permissions: new Set<string>(), detail: vi.fn(), list: vi.fn() }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (key: string) => mocks.permissions.has(key) }) }))
vi.mock("../finance.api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../finance.api")>()), getAgreementDetail: mocks.detail, listAgreementsRegister: mocks.list }))
vi.mock("../components/AgreementActionDialog", () => ({ AgreementActionDialog: () => null, Metric: () => null }))

import { AgreementDetailDialog } from "../components/AgreementDetailDialog"

const agreement = (over: Record<string, unknown> = {}) => ({
  id: "a1", kind: "override", status: "active", student_id: "s1", school_year_id: "y1", student_name: "Fanta Bamba", matricule: "M-69", class_name: "3ème A", level_name: "3ème",
  discount_amount: 50000, override_total_amount: 0, active_discount_amount: 0, plan_total_amount: 300000, total_paid: 150000, remaining_due: 100000,
  financial_status: "late", created_at: "2026-09-11", created_by_name: null, withdrawn_at: null, step_count: 0, schedule_total_amount: 0, next_due_date: null,
  reason: "Remise sociale", withdrawal_reason: null, schedule_steps: [], ...over,
})
const schedule = (over: Record<string, unknown> = {}) => agreement({
  id: "sc1", kind: "schedule", plan_total_amount: 270000, total_paid: 180000, remaining_due: 90000, active_discount_amount: 30000,
  schedule_steps: [{ dueDate: "2000-03-12", cumulativeAmountExpected: 90000 }, { dueDate: "2000-06-18", cumulativeAmountExpected: 270000 }], ...over,
})

const renderDialog = (kind: "overrides" | "schedules", extra: Record<string, unknown> = {}) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AgreementDetailDialog kind={kind} id="x" onClose={vi.fn()} onEdit={vi.fn()} {...extra} /></QueryClientProvider>)

beforeEach(() => { vi.clearAllMocks(); mocks.permissions = new Set() })

describe("détail d'une remise", () => {
  beforeEach(() => mocks.detail.mockResolvedValue({ agreement: agreement(), events: [] }))

  it("affiche le décompte, la progression, le responsable archivé et l'historique vide", async () => {
    renderDialog("overrides")
    expect(await screen.findByText("Solde à payer")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Remise sur frais" })).toBeInTheDocument()
    expect(screen.getByText("Fanta Bamba · 3ème A · M-69")).toBeInTheDocument()
    expect(screen.getByText(/150.000 FCFA encaissés sur 250.000 FCFA \(60 %\)/)).toBeInTheDocument()
    expect(screen.getByText("Ancien utilisateur (archivé)")).toBeInTheDocument()
    expect(screen.getByText("Aucun événement enregistré pour cet accord.")).toBeInTheDocument()
    expect(screen.getByText("Actif")).toBeInTheDocument()
    expect(screen.getByText("En retard")).toBeInTheDocument()
  })
  it("lecture seule : ni « Retirer la remise » ni « Modifier »", async () => {
    mocks.permissions = new Set(["tuition.view"])
    renderDialog("overrides")
    await screen.findByText("Solde à payer")
    expect(screen.queryByRole("button", { name: "Retirer la remise" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull()
  })
  it("avec tuition.grant_discount : actions visibles", async () => {
    mocks.permissions = new Set(["tuition.grant_discount"])
    renderDialog("overrides")
    expect(await screen.findByRole("button", { name: "Retirer la remise" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument()
  })
  it("erreur avec réessayer, accord disparu (404) et chargement", async () => {
    mocks.detail.mockRejectedValue(new Error("boom"))
    const { unmount } = renderDialog("overrides")
    expect(screen.getByLabelText("Chargement du détail de l'accord")).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: /Réessayer/ }, { timeout: 4000 }))
    await waitFor(() => expect(mocks.detail.mock.calls.length).toBeGreaterThanOrEqual(3))
    mocks.detail.mockReset()
    unmount()
    mocks.detail.mockRejectedValueOnce(Object.assign(new Error("nf"), { isAxiosError: true, response: { status: 404 } }))
    renderDialog("overrides")
    expect(await screen.findByText("Cet accord n'existe plus ou a été retiré.", {}, { timeout: 4000 })).toBeInTheDocument()
  })
})

describe("échéancier négocié et lien vers la remise", () => {
  beforeEach(() => { mocks.permissions = new Set(["tuition.view"]); mocks.detail.mockImplementation(async (kind: string) => ({ agreement: kind === "schedules" ? schedule() : agreement(), events: [] })) })

  it("titre dédié, lignes d'échéances et statuts calculés", async () => {
    renderDialog("schedules")
    expect(await screen.findByText("Arrangement convenu")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Échéancier négocié" })).toBeInTheDocument()
    expect(screen.getAllByText("Payée").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/En retard · \d+ jours/).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole("button", { name: "Réinitialiser" }).length).toBe(0)
  })
  it("remise active + permission : pastille et lien ; clic ouvre la remise, fermeture rend le focus au lien", async () => {
    mocks.list.mockResolvedValue({ entries: [{ id: "a1" }], pagination: {} })
    renderDialog("schedules")
    const link = await screen.findByRole("button", { name: "Voir l'accord de remise" })
    expect(screen.getByText(/Remise active : 30.000 FCFA/)).toBeInTheDocument()
    link.focus()
    fireEvent.click(link)
    expect(await screen.findByText("Solde à payer")).toBeInTheDocument()
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ kind: "overrides", studentId: "s1", status: "active" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" }).at(-1)!)
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Remise sur frais" })).toBeNull())
    await waitFor(() => expect(link).toHaveFocus())
    expect(screen.getByRole("heading", { name: "Échéancier négocié" })).toBeInTheDocument()
  })
  it("sans remise active : ni pastille ni lien", async () => {
    mocks.detail.mockResolvedValue({ agreement: schedule({ active_discount_amount: 0 }), events: [] })
    renderDialog("schedules")
    await screen.findByText("Arrangement convenu")
    expect(screen.queryByText(/Remise active/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Voir l'accord de remise" })).toBeNull()
  })
  it("sans permission de consulter les accords : pastille mais pas de lien", async () => {
    mocks.permissions = new Set()
    renderDialog("schedules")
    await screen.findByText("Arrangement convenu")
    expect(screen.getByText(/Remise active/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Voir l'accord de remise" })).toBeNull()
  })
  it("remise disparue entre-temps : message dédié", async () => {
    mocks.list.mockResolvedValue({ entries: [], pagination: {} })
    renderDialog("schedules")
    fireEvent.click(await screen.findByRole("button", { name: "Voir l'accord de remise" }))
    expect(await screen.findByText("Cette remise n'existe plus ou a été retirée.")).toBeInTheDocument()
  })
  it("erreur de chargement de la remise : réessayer", async () => {
    mocks.list.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ entries: [{ id: "a1" }], pagination: {} })
    renderDialog("schedules")
    fireEvent.click(await screen.findByRole("button", { name: "Voir l'accord de remise" }))
    fireEvent.click(await screen.findByRole("button", { name: /Réessayer/ }))
    expect(await screen.findByText("Solde à payer")).toBeInTheDocument()
  })
})
