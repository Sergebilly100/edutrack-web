import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

const getTodayAttendanceMock = vi.fn()
const getAttendanceHistoryMock = vi.fn()
const getDashboardCountsMock = vi.fn()
const getNextWeekCoverageStateMock = vi.fn()
const getSalarySummaryMock = vi.fn()
const getTopRiskTeachersMock = vi.fn()
const getCurrentMonthKeyMock = vi.fn()
const getPreviousMonthKeyMock = vi.fn()
const getTeacherTrendFromSummariesMock = vi.fn()
const getTotalPendingSalariesMock = vi.fn()
const fetchSchoolInfoMock = vi.fn()
const getTodayAbsencesMock = vi.fn()
const getStudentAbsenceStatsMock = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock("@/modules/dashboard/dashboard.api", () => {
  return {
    getTodayAttendance: () => getTodayAttendanceMock(),
    getAttendanceHistory: (days: number) => getAttendanceHistoryMock(days),
    getDashboardCounts: () => getDashboardCountsMock(),
    getNextWeekCoverageState: () => getNextWeekCoverageStateMock(),
    getSalarySummary: (month: string) => getSalarySummaryMock(month),
    getTopRiskTeachers: (month: string) => getTopRiskTeachersMock(month),
    getCurrentMonthKey: () => getCurrentMonthKeyMock(),
    getPreviousMonthKey: () => getPreviousMonthKeyMock(),
    getTeacherTrendFromSummaries: (current: unknown, previous: unknown) =>
      getTeacherTrendFromSummariesMock(current, previous),
    getTotalPendingSalaries: (summary: unknown) => getTotalPendingSalariesMock(summary),
  }
})

vi.mock("@/modules/onboarding/onboarding.api", () => {
  return {
    fetchSchoolInfo: () => fetchSchoolInfoMock(),
  }
})

vi.mock("@/modules/students/students.api", () => {
  return {
    getTodayAbsences: () => getTodayAbsencesMock(),
    getStudentAbsenceStats: () => getStudentAbsenceStatsMock(),
  }
})

import DashboardPage from "@/modules/dashboard/DashboardPage"
import { useAuthStore } from "@/shared/store/auth.store"

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthStore.setState({
      user: {
        id: "user-1",
        name: "Directeur Test",
        role: "director",
        phone: null,
        email: "director@example.com",
        profilePhotoUrl: null,
        mustChangePassword: false,
        tenantId: "tenant-1",
        schemaName: "school_sainte_marie",
        plan: "standard",
      },
      accessToken: null,
    })

    getTodayAttendanceMock.mockResolvedValue({
      summary: { present: 12, total: 14, late: 1, absent: 1, excused: 0, pending: 0 },
      teachers: [],
    })
    getAttendanceHistoryMock.mockResolvedValue([])
    getDashboardCountsMock.mockResolvedValue({
      students: { total: 320, active: 312 },
      teachers: { total: 14, active: 13 },
    })
    getNextWeekCoverageStateMock.mockResolvedValue({ state: "not_configured", count: 0 })
    getSalarySummaryMock.mockResolvedValue({
      totalDue: 1500000,
      totalPaid: 500000,
      pendingCount: 8,
      paidCount: 6,
    })
    getTopRiskTeachersMock.mockResolvedValue([])
    getCurrentMonthKeyMock.mockReturnValue("2026-05")
    getPreviousMonthKeyMock.mockReturnValue("2026-04")
    getTeacherTrendFromSummariesMock.mockReturnValue(null)
    getTotalPendingSalariesMock.mockReturnValue(1000000)
    getTodayAbsencesMock.mockResolvedValue([])
    getStudentAbsenceStatsMock.mockResolvedValue([])
    fetchSchoolInfoMock.mockResolvedValue({
      id: "school-1",
      name: "École Sainte Marie",
      address: "Abidjan",
      phone: "2250700000000",
      email: "school@example.com",
      logoUrl: null,
    })
  })

  it("renders C1 dashboard sections with real data", async () => {
    renderWithQueryClient(<DashboardPage />)

    // Le header vient du store auth (rendu immédiatement) ; les compteurs et
    // sections proviennent de useQuery (asynchrones). On attend donc la première
    // donnée async avant d'asserter le reste. Les libellés peuvent apparaître en
    // double (vues mobile + desktop rendues ensemble sous jsdom), d'où getAllByText.
    expect(await screen.findByText("Bonjour, Directeur Test")).toBeInTheDocument()
    expect((await screen.findAllByText("Profs actifs")).length).toBeGreaterThan(0)

    const sectionLabels = [
      "École Sainte Marie",
      "Élèves actifs",
      "Présences professeurs aujourd'hui",
      "Résumé des salaires",
    ]
    for (const label of sectionLabels) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it("navigue vers /teachers au clic sur la carte « Profs actifs »", async () => {
    renderWithQueryClient(<DashboardPage />)

    // "Profs actifs" peut apparaître en double (mobile + desktop) ; on clique
    // chaque carte cliquable, l'une au moins doit naviguer vers /teachers.
    const labels = await screen.findAllByText("Profs actifs")
    for (const label of labels) {
      const card = label.closest("button")
      if (card) {
        fireEvent.click(card)
      }
    }

    expect(navigateMock).toHaveBeenCalledWith("/teachers")
  })
})
