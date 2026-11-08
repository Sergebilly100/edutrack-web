import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { SalarySummaryItem, SalaryTeacherDetails } from "../salaries.api"
import { MarkPaidDialog } from "../components/MarkPaidDialog"
import { SalaryDetailsDialog } from "../components/SalaryDetailsDialog"

const row = (over: Partial<SalarySummaryItem> = {}): SalarySummaryItem => ({
  teacherId: "t1", teacherName: "Éric Kouassi", teacherType: "vacataire", hoursPlanned: 66, hoursDone: 66, hourlyRate: 3500, totalFcfa: 231000,
  amountAlreadyPaid: 0, status: "pending", salaryRecordId: "rec-1", isPartiallyPaid: false, paidAt: null, ...over,
})
const course = (i: number, status: "absent" | "present" | "not_marked") => ({
  date: `2026-11-${String(i + 1).padStart(2, "0")}`, className: "6ème A", subject: "Anglais", startTime: "07:30", endTime: "08:30", attendanceStatus: status, validationStatus: null, hoursPlanned: 1, hoursDone: status === "present" ? 1 : 0,
})
const details = (summary: Partial<SalaryTeacherDetails["summary"]> = {}, rows = [course(1, "absent")]): SalaryTeacherDetails => ({
  teacher: { id: "t1", name: "Éric Kouassi", type: "vacataire", hourlyRate: 3500, monthlySalary: null },
  summary: { hoursPlanned: 66, hoursDone: 66, totalFcfa: null, status: "pending", absenceHours: 0, remainingPlannedHours: 0, currentEarnedAmount: 231000, amountAlreadyPaid: 0, amountRemainingToPayNow: 231000, remainingPotentialAmount: 0, absenceAmount: 0, hoursDoneSinceLastPayment: 0, isPartiallyPaid: false, ...summary },
  payment: { paidAt: null, paidBy: null, paidByName: null, paidByRole: null, notes: null },
  payments: [], rows,
})

const markPaid = (over: Partial<React.ComponentProps<typeof MarkPaidDialog>> = {}) =>
  render(<MarkPaidDialog open onOpenChange={() => {}} row={row()} details={details()} isLoading={false} isError={false} onRetry={() => {}} monthLabel="septembre 2026" isSubmitting={false} onConfirm={vi.fn()} {...over} />)

describe("MarkPaidDialog", () => {
  it("« Tout le reste » par défaut : le bouton annonce le montant et envoie toutes les heures", async () => {
    const onConfirm = vi.fn()
    markPaid({ onConfirm })
    const button = screen.getByRole("button", { name: /Confirmer le paiement de 231.000 FCFA/ })
    fireEvent.click(button)
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ hoursToPay: 66, notes: "" }))
  })

  it("saisie valide : montant calculé en direct et reste après paiement", () => {
    markPaid()
    fireEvent.click(screen.getByLabelText("Un nombre d'heures précis"))
    fireEvent.change(screen.getByLabelText("Nombre d'heures à payer"), { target: { value: "40" } })
    expect(screen.getByText(/= 140.000 FCFA/)).toBeInTheDocument()
    expect(screen.getByText(/Reste après paiement : 26.h/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Confirmer le paiement de 140.000 FCFA/ })).toBeEnabled()
  })

  it("saisie supérieure au maximum ou nulle : erreur et bouton désactivé", () => {
    markPaid()
    fireEvent.click(screen.getByLabelText("Un nombre d'heures précis"))
    const input = screen.getByLabelText("Nombre d'heures à payer")
    fireEvent.change(input, { target: { value: "70" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/maximum/)
    expect(screen.getByRole("button", { name: "Confirmer le paiement" })).toBeDisabled()
    fireEvent.change(input, { target: { value: "0" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/supérieur à 0/)
    expect(screen.getByRole("button", { name: "Confirmer le paiement" })).toBeDisabled()
  })

  it("double clic : un seul envoi", async () => {
    let release: () => void = () => {}
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    markPaid({ onConfirm })
    const button = screen.getByRole("button", { name: /Confirmer le paiement de/ })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    release()
  })

  it("reste nul : l'action n'est pas proposée", () => {
    markPaid({ details: details({ amountAlreadyPaid: 231000 }) })
    expect(screen.getByText("Rien à payer pour cette période.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Confirmer le paiement/ })).toBeNull()
  })

  it("états de chargement et d'erreur", () => {
    const { unmount } = markPaid({ isLoading: true, details: null })
    expect(screen.getByLabelText("Chargement des informations de paiement")).toBeInTheDocument()
    unmount()
    const onRetry = vi.fn()
    markPaid({ isError: true, details: null, onRetry })
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }))
    expect(onRetry).toHaveBeenCalled()
  })
})

const detailsDialog = (over: Partial<React.ComponentProps<typeof SalaryDetailsDialog>> = {}) =>
  render(<SalaryDetailsDialog open onOpenChange={() => {}} row={row()} details={details()} isLoading={false} isError={false} onRetry={() => {}} monthLabel="novembre 2026" canMarkPaid canExport isExporting={false} onExport={() => {}} onValidatePayment={() => {}} {...over} />)

describe("SalaryDetailsDialog – permissions", () => {
  it("avec permissions et un reste à payer : actions disponibles", () => {
    const onValidatePayment = vi.fn()
    detailsDialog({ onValidatePayment })
    fireEvent.click(screen.getByRole("button", { name: "Valider un paiement" }))
    expect(onValidatePayment).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Exporter la fiche" })).toBeInTheDocument()
  })
  it("sans salary.mark_paid : bouton désactivé avec la raison", () => {
    detailsDialog({ canMarkPaid: false })
    expect(screen.getByRole("button", { name: "Valider un paiement" })).toBeDisabled()
    expect(screen.getByText("Vous n'avez pas la permission de valider un paiement.")).toBeInTheDocument()
  })
  it("sans salary.export : « Exporter la fiche » absent", () => {
    detailsDialog({ canExport: false })
    expect(screen.queryByRole("button", { name: "Exporter la fiche" })).toBeNull()
  })
  it("rien à payer : désactivé avec message", () => {
    detailsDialog({ details: details({ amountRemainingToPayNow: 0 }) })
    expect(screen.getByRole("button", { name: "Valider un paiement" })).toBeDisabled()
    expect(screen.getByText("Rien à payer pour cette période.")).toBeInTheDocument()
  })
})

describe("SalaryDetailsDialog – contenu", () => {
  it("absences en rouge seulement si > 0 ; reste à payer jamais en rouge", () => {
    const { unmount } = detailsDialog({ details: details({ absenceHours: 12, absenceAmount: 42000, amountRemainingToPayNow: 0 }) })
    expect(screen.getByText(/^12.h$/).className).toMatch(/red/)
    expect(screen.getByText(/− 42.000 FCFA/).className).toMatch(/red/)
    expect(screen.getAllByText(/^0 FCFA$/).at(-1)?.className ?? "").not.toMatch(/red/)
    unmount()
    detailsDialog()
    expect(screen.getAllByText(/^0.h$/)[1]?.className ?? "").not.toMatch(/red/)
  })
  it("filtres avec compteurs et « Afficher les N autres cours »", () => {
    const rows = [...Array.from({ length: 7 }, (_, i) => course(i, "absent")), course(8, "present"), course(9, "not_marked")]
    detailsDialog({ details: details({}, rows) })
    expect(screen.getByRole("button", { name: "Tous · 9" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Absents · 7" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Afficher les 4 autres cours" }))
    expect(screen.queryByRole("button", { name: /Afficher les/ })).toBeNull()
  })
  it("permanent : libellés dédiés", () => {
    detailsDialog({ row: row({ teacherType: "permanent" }), details: { ...details({ absenceHours: 2 }), teacher: { ...details().teacher, type: "permanent", monthlySalary: 250000 } } })
    expect(screen.getByText("Heures manquées")).toBeInTheDocument()
    expect(screen.getByText("Montant fixe mensuel")).toBeInTheDocument()
  })
  it("chargement et erreur", () => {
    const { unmount } = detailsDialog({ isLoading: true, details: null })
    expect(screen.getByLabelText("Chargement des détails du salaire")).toBeInTheDocument()
    unmount()
    detailsDialog({ isError: true, details: null })
    expect(screen.getByRole("button", { name: /Réessayer/ })).toBeInTheDocument()
  })
})
