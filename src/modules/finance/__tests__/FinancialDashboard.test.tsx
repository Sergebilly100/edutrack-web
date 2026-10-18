import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { businessToday, dateMs, formatAcademicDate } from "@/shared/lib/academic-calendar"

const mocks = vi.hoisted(() => ({
  fetchClassStudentsStatus: vi.fn(),
  fetchFinancialSummary: vi.fn(),
}))

vi.mock("../finance.api", () => ({
  fetchClassStudentsStatus: mocks.fetchClassStudentsStatus,
  fetchFinancialSummary: mocks.fetchFinancialSummary,
}))

import { FinancialDashboard } from "../components/FinancialDashboard"

const dayOffset = (offset: number): string =>
  new Date(dateMs(businessToday()) + offset * 86_400_000).toISOString().slice(0, 10)

const summary = () => ({
  school: {
    total_expected_to_date: "14220000",
    total_paid: "13140000",
    remaining_to_collect: "1080000",
    annual_total_due: "21420000",
    annual_remaining: "8280000",
    upcoming_due: "7200000",
    recovery_rate: "0.9236",
    students_up_to_date_count: 65,
    students_late_count: 7,
    previous_period_total_paid: "0",
    last_computed_at: "2026-10-17T06:00:00.000Z",
  },
  classes: [{
    class_id: "class-1",
    class_name: "6e A",
    level_id: "level-1",
    level_name: "6e",
    total_expected_to_date: "14220000",
    total_paid: "13140000",
    remaining_to_collect: "1080000",
    annual_total_due: "21420000",
    annual_remaining: "8280000",
    upcoming_due: "7200000",
    students_up_to_date_count: 65,
    students_late_count: 7,
    last_computed_at: "2026-10-17T06:00:00.000Z",
  }],
  levels: [{
    level_id: "level-1",
    level_name: "6e",
    total_expected_to_date: "14220000",
    total_paid: "13140000",
    remaining_to_collect: "1080000",
    annual_total_due: "21420000",
    annual_remaining: "8280000",
    upcoming_due: "7200000",
    students_up_to_date_count: 65,
    students_late_count: 7,
    last_computed_at: "2026-10-17T06:00:00.000Z",
  }],
  collections: [
    { month_key: "2026-05", total_paid: "4000000" },
    { month_key: "2026-06", total_paid: "8900000" },
    { month_key: "2026-07", total_paid: "0" },
    { month_key: "2026-08", total_paid: "0" },
    { month_key: "2026-09", total_paid: "200000" },
    { month_key: "2026-10", total_paid: "0" },
  ],
  paymentMethods: [
    { method: "cash", total_paid: "4380000", payment_count: 12 },
    { method: "mobile_money", total_paid: "4380000", payment_count: 8 },
    { method: "bank_transfer", total_paid: "4380000", payment_count: 6 },
  ],
  upcomingInstallments: [
    { due_date: dayOffset(5), expected_amount: "7200000", student_count: 72 },
    { due_date: dayOffset(12), expected_amount: "500000", student_count: 8 },
    { due_date: dayOffset(-1), expected_amount: "250000", student_count: 3 },
  ],
  installmentScheduleComplete: true,
  aging: [
    { bucket: "0-30", total_amount: "1080000", student_count: 7 },
    { bucket: "31-60", total_amount: "0", student_count: 0 },
    { bucket: ">60", total_amount: "0", student_count: 0 },
  ],
  recentPayments: [{
    payment_id: "payment-1",
    student_id: "student-49",
    payment_date: dayOffset(-1),
    student_name: "Awa Koné",
    student_matricule: "DEMO-0049",
    class_name: "6e A",
    method: "cash",
    amount: "30000",
    receipt_number: "REC-0001",
  }],
})

const renderDashboard = () => render(
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FinancialDashboard schoolYearId="school-year-1" />
    </QueryClientProvider>
  </MemoryRouter>,
)

describe("FinancialDashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.fetchFinancialSummary.mockResolvedValue(summary())
    mocks.fetchClassStudentsStatus.mockResolvedValue([])
  })

  it("shows both balances with the required equations and clear rate labels", async () => {
    renderDashboard()

    expect(await screen.findByRole("heading", { name: "À ce jour · retards" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Sur l’année · trésorerie" })).toBeInTheDocument()
    expect(screen.getByText("Synthèse des encaissements")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Taux de recouvrement à date : 92 %" })).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Taux de recouvrement annuel : 61 %" })).toBeInTheDocument()
    expect(screen.getByText("Attendu à date").parentElement).toHaveTextContent(/14\s*220\s*000 FCFA/)
    expect(screen.getAllByText("Encaissé")[0]?.parentElement).toHaveTextContent(/13\s*140\s*000 FCFA/)
    expect(screen.getByText("Impayé à date").parentElement).toHaveTextContent(/1\s*080\s*000 FCFA/)
    expect(screen.getByText("Total annuel à encaisser").parentElement).toHaveTextContent(/21\s*420\s*000 FCFA/)
    expect(screen.getByText("Solde annuel restant").parentElement).toHaveTextContent(/8\s*280\s*000 FCFA/)
    expect(screen.getByText(/Dont impayé à date/)).toHaveTextContent(/1\s*080\s*000 FCFA \+ à venir 7\s*200\s*000 FCFA/)
  })

  it("keeps recovery by level available when annual totals are absent", async () => {
    const fixture = summary()
    mocks.fetchFinancialSummary.mockResolvedValue({
      ...fixture,
      levels: fixture.levels.map((level) => ({ ...level, annual_total_due: undefined })),
      classes: fixture.classes.map((classSummary) => ({ ...classSummary, annual_total_due: undefined })),
    })

    renderDashboard()

    expect(await screen.findByRole("button", { name: /6e.*92 % à date/ })).toBeInTheDocument()
    expect(screen.getByText(/1\s*080\s*000 FCFA impayés à date/)).toBeInTheDocument()
  })

  it("uses deadline urgency, monthly bars, accessible data, and payment shares", async () => {
    renderDashboard()

    expect(await screen.findByText("Dans 5 jours")).toHaveClass("bg-amber-50")
    expect(screen.getByText("Dans 12 jours")).toHaveClass("bg-muted/50")
    expect(screen.getByText("Dépassée depuis 1 jour")).toHaveClass("bg-red-50")
    expect(screen.getByText(/72 élèves concernés/).parentElement).toHaveTextContent(/7\s*200\s*000 FCFA/)
    expect(screen.getByRole("table", { name: "Tableau des encaissements mensuels" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Barres des encaissements confirmés par mois/ })).toBeInTheDocument()
    expect(screen.getByText("Montants encaissés")).toBeInTheDocument()
    const donut = screen.getByRole("img", { name: /Répartition des paiements/ })
    expect(donut.getAttribute("aria-label")?.replace(/\s/g, "")).toContain("13140000FCFA")
    expect(screen.getAllByText("33 %")).toHaveLength(3)
    expect(screen.getByText("REC-0001")).toBeInTheDocument()
    const paymentsTable = screen.getByRole("table", { name: "Derniers encaissements" })
    expect(paymentsTable).toHaveTextContent("Date de paiement")
    expect(paymentsTable).toHaveTextContent("Élève")
    expect(paymentsTable).toHaveTextContent("Classe · mode")
    expect(paymentsTable).toHaveTextContent("Reçu")
    expect(paymentsTable).toHaveTextContent("Statut")
    expect(paymentsTable).toHaveTextContent("Espèces")
    expect(paymentsTable).toHaveTextContent(formatAcademicDate(dayOffset(-1)))
    expect(paymentsTable).toHaveTextContent("DEMO-0049")
    expect(paymentsTable).toHaveTextContent(/30\s*000\s*FCFA/)
    expect(screen.getByText("Confirmé")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Détail financier" })).toHaveAttribute(
      "href",
      "/finance/history/student-49?schoolYearId=school-year-1",
    )
    expect(screen.getByText("Mobile Money").parentElement?.parentElement?.querySelector('[aria-hidden="true"]'))
      .toHaveClass("bg-[var(--stat-success-fg)]")
    expect(screen.getByText("Virement").parentElement?.parentElement?.querySelector('[aria-hidden="true"]'))
      .toHaveClass("bg-[var(--stat-warning-fg)]")
    expect(screen.getByText("Ancienneté des impayés")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: /0–30 jours : 1\s*080\s*000 FCFA/ })).toBeInTheDocument()
    expect(screen.getByText("7 élèves")).toBeInTheDocument()
  })

  it("explains when no future due dates are returned", async () => {
    mocks.fetchFinancialSummary.mockResolvedValue({ ...summary(), upcomingInstallments: [] })
    renderDashboard()
    expect(await screen.findByText("Aucune autre échéance enregistrée.")).toBeInTheDocument()
  })

  it("states when incomplete schedules make aging data unavailable instead of displaying fabricated zeroes", async () => {
    mocks.fetchFinancialSummary.mockResolvedValue({
      ...summary(),
      installmentScheduleComplete: false,
      aging: null,
    })
    renderDashboard()
    const statusMessages = await screen.findAllByRole("status")
    expect(statusMessages.some((message) => message.textContent?.includes(
      "Calcul indisponible : certains dossiers n’ont pas d’échéancier complet pour cette année.",
    ))).toBe(true)
    expect(screen.queryByRole("progressbar", { name: /0–30 jours/ })).not.toBeInTheDocument()
    expect(statusMessages.some((message) => message.textContent?.includes("Les montants affichés sont partiels."))).toBe(true)
  })

  it("opens class and student details from the level summary", async () => {
    renderDashboard()
    fireEvent.click(await screen.findByRole("button", { name: /6e.*92 % à date/ }))
    fireEvent.click(await screen.findByRole("button", { name: /6e A.*92 % à date/ }))
    expect(await screen.findByText("Aucun élève avec un statut financier calculé.")).toBeInTheDocument()
  })
})
