import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getDashboardStatsMock = vi.fn()

vi.mock("@/modules/dashboard/dashboard.api", () => ({
  getDashboardStats: () => getDashboardStatsMock(),
}))

import { DashboardStatsCards } from "@/modules/dashboard/components/DashboardStatsCards"

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const SUBSCRIPTION_LABEL = "abonnements encaissé"
const SALARY_LABEL = "Salaire à payer ce mois"

describe("DashboardStatsCards - carte abonnements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDashboardStatsMock.mockResolvedValue({
      teacherAttendance: {
        globalRate: 90,
        partTime: { rate: 88, present: 10, expected: 12 },
        fullTime: { rate: 92, present: 11, expected: 12 },
      },
      studentAttendance: { rate: 95, present: 300, absent: 12, total: 320, notMarked: 8 },
      salaries: {
        remainingToPay: 1000000,
        totalPaid: 500000,
        economy: { plannedHours: 100, completedHours: 95, savedAmount: 50000 },
      },
      // Fonctionnalité abonnements activée côté école.
      subscriptions: {
        isEnabled: true,
        collectedAmount: 250000,
        activeSubscribers: 12,
        collectionRate: 80,
        expectedAmount: 300000,
      },
    })
  })

  it("masque la carte abonnements sans droit abonnements, même avec droit salaire", async () => {
    renderWithClient(
      <DashboardStatsCards
        showTeacherCard
        showStudentCard
        showSalaryCard
        showSubscriptionCard={false}
      />
    )

    // La carte salaire (droit accordé) est présente…
    expect(await screen.findByText(SALARY_LABEL)).toBeInTheDocument()
    // …mais la carte abonnements ne doit PAS apparaître (droit abonnements refusé).
    expect(screen.queryByText(SUBSCRIPTION_LABEL)).not.toBeInTheDocument()
  })

  it("affiche la carte abonnements avec le droit abonnements et la feature activée", async () => {
    renderWithClient(
      <DashboardStatsCards
        showTeacherCard
        showStudentCard
        showSalaryCard
        showSubscriptionCard
      />
    )

    expect(await screen.findByText(SUBSCRIPTION_LABEL)).toBeInTheDocument()
  })

  it("masque la carte abonnements si la feature est désactivée même avec le droit", async () => {
    getDashboardStatsMock.mockResolvedValueOnce({
      teacherAttendance: {
        globalRate: 90,
        partTime: { rate: 88, present: 10, expected: 12 },
        fullTime: { rate: 92, present: 11, expected: 12 },
      },
      studentAttendance: { rate: 95, present: 300, absent: 12, total: 320, notMarked: 8 },
      salaries: {
        remainingToPay: 1000000,
        totalPaid: 500000,
        economy: { plannedHours: 100, completedHours: 95, savedAmount: 50000 },
      },
      subscriptions: {
        isEnabled: false,
        collectedAmount: 0,
        activeSubscribers: 0,
        collectionRate: 0,
        expectedAmount: 0,
      },
    })

    renderWithClient(
      <DashboardStatsCards showTeacherCard showStudentCard showSalaryCard showSubscriptionCard />
    )

    expect(await screen.findByText(SALARY_LABEL)).toBeInTheDocument()
    expect(screen.queryByText(SUBSCRIPTION_LABEL)).not.toBeInTheDocument()
  })
})
