import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import type { PermissionKey } from "@/shared/store/auth.store"

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

const getTodayAttendanceMock = vi.fn()
const getAttendanceHistoryMock = vi.fn()
const getDashboardCountsMock = vi.fn()
const getSMSLogMock = vi.fn()
const getNextWeekCoverageStateMock = vi.fn()
const getSalarySummaryMock = vi.fn()
const getTopRiskTeachersMock = vi.fn()
const getTeacherComplianceMock = vi.fn()
const getCurrentMonthKeyMock = vi.fn()
const getPreviousMonthKeyMock = vi.fn()
const getTeacherTrendFromSummariesMock = vi.fn()
const getTotalPendingSalariesMock = vi.fn()
const getDashboardStatsMock = vi.fn()
const fetchSchoolInfoMock = vi.fn()
const getTodayAbsencesMock = vi.fn()
const getStudentAbsenceStatsMock = vi.fn()
const getSalaryUnpaidAlertsMock = vi.fn()
const getPendingValidationCountMock = vi.fn()

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
    getDashboardStats: () => getDashboardStatsMock(),
    getSMSLog: (limit: number) => getSMSLogMock(limit),
    getNextWeekCoverageState: () => getNextWeekCoverageStateMock(),
    getSalarySummary: (month: string) => getSalarySummaryMock(month),
    getTopRiskTeachers: (month: string) => getTopRiskTeachersMock(month),
    getTeacherCompliance: (month: string) => getTeacherComplianceMock(month),
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

vi.mock("@/modules/salaries/salaries.api", () => {
  return {
    getSalaryUnpaidAlerts: (month: string) => getSalaryUnpaidAlertsMock(month),
  }
})

vi.mock("@/modules/validations/validations.api", () => {
  return {
    getPendingValidationCount: () => getPendingValidationCountMock(),
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

function setAuth(role: "director" | "staff", permissions: PermissionKey[] = []) {
  useAuthStore.setState({
    user: {
      id: "user-1",
      name: role === "director" ? "Directeur Test" : "Staff Test",
      role,
      phone: null,
      email: "user@example.com",
      profilePhotoUrl: null,
      mustChangePassword: false,
      tenantId: "tenant-1",
      schemaName: "school_sainte_marie",
      plan: "standard",
    },
    permissions,
    accessToken: null,
  })
}

const SALARY_SECTION = "Résumé salaires du mois"
const VALIDATIONS_SECTION = "Validations en attente"
const TEACHER_PRESENCE_SECTION = "Présences professeurs aujourd'hui"

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    setAuth("director")

    getTodayAttendanceMock.mockResolvedValue({
      date: "2026-05-12",
      presentCount: 12,
      courses: [],
    })
    getAttendanceHistoryMock.mockResolvedValue([])
    getDashboardCountsMock.mockResolvedValue({
      students: { total: 320, active: 312 },
      teachers: { total: 14, active: 13 },
    })
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
      subscriptions: {
        isEnabled: false,
        collectedAmount: 0,
        activeSubscribers: 0,
        collectionRate: 0,
        expectedAmount: 0,
      },
    })
    getSMSLogMock.mockResolvedValue([])
    getNextWeekCoverageStateMock.mockResolvedValue({ nextWeekHasCoverage: true })
    getSalarySummaryMock.mockResolvedValue({ items: [] })
    getTopRiskTeachersMock.mockResolvedValue([])
    getTeacherComplianceMock.mockResolvedValue([])
    getCurrentMonthKeyMock.mockReturnValue("2026-05")
    getPreviousMonthKeyMock.mockReturnValue("2026-04")
    getTeacherTrendFromSummariesMock.mockReturnValue(null)
    getTotalPendingSalariesMock.mockReturnValue({ totalFcfa: 1000000, count: 8 })
    getTodayAbsencesMock.mockResolvedValue([])
    getStudentAbsenceStatsMock.mockResolvedValue([])
    getSalaryUnpaidAlertsMock.mockResolvedValue({ count: 0, totalRemainingFcfa: 0 })
    getPendingValidationCountMock.mockResolvedValue({
      total: 0,
      gps_suspicious: 0,
      short_hours: 0,
      missing_end_scan: 0,
    })
    fetchSchoolInfoMock.mockResolvedValue({
      id: "school-1",
      name: "École Sainte Marie",
      address: "Abidjan",
      phone: "2250700000000",
      email: "school@example.com",
      logoUrl: null,
    })
  })

  it("affiche toutes les sections pour un directeur", async () => {
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Directeur Test")).toBeInTheDocument()
    // Le directeur voit toutes les sections sensibles.
    expect(await screen.findByText(TEACHER_PRESENCE_SECTION)).toBeInTheDocument()
    expect(await screen.findByText(VALIDATIONS_SECTION)).toBeInTheDocument()
    expect(await screen.findByText(SALARY_SECTION)).toBeInTheDocument()
  })

  it("masque les sections non autorisées pour un staff (validations seulement)", async () => {
    setAuth("staff", ["validations.view"])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Staff Test")).toBeInTheDocument()
    // Section autorisée présente…
    expect(await screen.findByText(VALIDATIONS_SECTION)).toBeInTheDocument()
    // …et les sections sensibles non autorisées sont absentes.
    expect(screen.queryByText(SALARY_SECTION)).not.toBeInTheDocument()
    expect(screen.queryByText(TEACHER_PRESENCE_SECTION)).not.toBeInTheDocument()
  })

  it("affiche le résumé salaires pour un staff avec salary.view", async () => {
    setAuth("staff", ["salary.view"])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText(SALARY_SECTION)).toBeInTheDocument()
    // Sans validations.view, la section validations reste masquée.
    expect(screen.queryByText(VALIDATIONS_SECTION)).not.toBeInTheDocument()
  })

  it("ne déclenche pas la requête salaires pour un staff sans salary.view", async () => {
    setAuth("staff", ["validations.view"])
    renderWithQueryClient(<DashboardPage />)

    await screen.findByText(VALIDATIONS_SECTION)
    // La requête salaire est gardée par enabled:canViewSalary → jamais appelée.
    expect(getSalarySummaryMock).not.toHaveBeenCalled()
    expect(getSalaryUnpaidAlertsMock).not.toHaveBeenCalled()
  })
})
