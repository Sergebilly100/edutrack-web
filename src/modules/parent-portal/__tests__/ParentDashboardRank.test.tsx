import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { expect, it, vi } from "vitest"

vi.mock("../parent.api", () => ({
  listParentStudents: vi.fn().mockResolvedValue([
    { id: "student-1", first_name: "Aya", last_name: "Koné", class_name: "6ème A" },
  ]),
  getParentSubscriptionStatus: vi.fn().mockResolvedValue({ subscription: { days_remaining: 90 } }),
  getParentStats: vi.fn().mockResolvedValue({ absences_this_week: 0, absences_this_month: 0, absence_rate_month: 0 }),
  getParentOverview: vi.fn().mockResolvedValue({
    financial: null,
    latestPublishedReportCard: {
      id: "card-1", periodLabel: "Trimestre 1", schoolYearLabel: "2026-2027",
      generalAverage: 16, rank: 2, classHeadcount: 30, publishedAt: "2026-10-01",
    },
  }),
  getParentSchedule: vi.fn().mockResolvedValue({ days: [] }),
  getParentAbsences: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/shared/pwa/InstallPwaCard", () => ({ InstallPwaCard: () => null }))
vi.mock("@/shared/components", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/components")>(),
  OfflineIndicator: () => null,
}))

import ParentDashboardPage from "../ParentDashboardPage"

it("affiche le rang du dernier bulletin dans le résumé parent", async () => {
  sessionStorage.clear()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={queryClient}><ParentDashboardPage /></QueryClientProvider></MemoryRouter>)

  const summary = await screen.findByText("Moyenne 16.00/20 · rang 2ème / 30")
  expect(summary).toHaveAttribute("aria-label", "Moyenne 16.00 sur 20, rang 2ème sur 30")
})
