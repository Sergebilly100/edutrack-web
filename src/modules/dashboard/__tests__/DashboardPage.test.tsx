import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import type { PermissionKey } from "@/shared/store/auth.store"

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock("@/shared/api/client", () => ({
  apiClient: {
    get: vi.fn((url: string) => {
      if (url === "/dashboard/action-items") {
        return Promise.resolve({
          data: {
            items: [
              {
                id: "item-1",
                type: "validations_pending",
                reference_id: null,
                priority: "high",
                message: "2 décision(s) à prendre sur les pointages.",
              },
            ],
          },
        })
      }
      return Promise.resolve({ data: {} })
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

const getTodayAttendanceMock = vi.fn()
const getAttendanceHistoryMock = vi.fn()
const getDashboardCountsMock = vi.fn()
const getDashboardPilotageMock = vi.fn()
const getDashboardActionItemsMock = vi.fn()
const resolveDashboardActionItemMock = vi.fn()
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
const fetchFinancialSummaryMock = vi.fn()

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
    getDashboardPilotage: () => getDashboardPilotageMock(),
    getDashboardStats: () => getDashboardStatsMock(),
    getDashboardActionItems: () => getDashboardActionItemsMock(),
    resolveDashboardActionItem: (id: string) => resolveDashboardActionItemMock(id),
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

vi.mock("@/modules/finance/finance.api", () => ({
  fetchFinancialSummary: () => fetchFinancialSummaryMock(),
}))

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

const VALIDATIONS_PRIORITY = "Validations en attente"

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
    getDashboardPilotageMock.mockResolvedValue({
      population: { activeStudents: 312, activeTeachers: 13, activeClasses: 14 },
      academic: [{ levelId: "level-1", levelName: "6e", classCount: 2, expectedSubjects: 12, completedSubjects: 9, completionRate: 75, studentsWithAverage: 30, averageScore: 11.8, performingStudents: 21, attentionStudents: 6, criticalStudents: 3, gradeCount: 120, gradesAtLeastTen: 82 }],
      risks: { studentAbsences: 0, studentGrades: 0, studentPayments: 0, teacherAbsences: 0 },
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
    getDashboardActionItemsMock.mockResolvedValue([
      {
        id: "item-1",
        type: "validations_pending",
        referenceId: null,
        priority: "high",
        message: "2 décision(s) à prendre sur les pointages.",
        generatedAt: "2026-05-12T08:00:00.000Z",
      },
    ])
    resolveDashboardActionItemMock.mockResolvedValue(undefined)
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
    fetchSchoolInfoMock.mockResolvedValue({
      id: "school-1",
      name: "École Sainte Marie",
      address: "Abidjan",
      phone: "2250700000000",
      email: "school@example.com",
      logoUrl: null,
    })
    fetchFinancialSummaryMock.mockResolvedValue({
      school: { total_expected_to_date: "1200000", total_paid: "840000", recovery_rate: "0.7", students_late_count: 4 },
      levels: [{ level_id: "level-1", level_name: "6e", total_expected_to_date: "600000", total_paid: "420000", students_late_count: 2 }],
      upcomingInstallments: [{ due_date: "2026-06-15", expected_amount: "350000", student_count: 42 }],
    })
  })

  it("affiche une vue de pilotage unique pour un directeur", async () => {
    getAttendanceHistoryMock.mockResolvedValue([
      { date: "2026-05-11", presentCount: 10, absentCount: 2, notCheckedCount: 1, totalCount: 13, attendanceRate: 76.92 },
      { date: "2026-05-12", presentCount: 12, absentCount: 1, notCheckedCount: 0, totalCount: 13, attendanceRate: 92.31 },
    ])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Directeur Test")).toBeInTheDocument()
    expect(await screen.findByText("Vue de pilotage")).toBeInTheDocument()
    expect(await screen.findByText("Présences aujourd’hui")).toBeInTheDocument()
    expect(screen.getByText("Notes saisies")).toBeInTheDocument()
    expect(screen.getByText("Notes ≥ 10/20")).toBeInTheDocument()
    expect(screen.getByLabelText("Légende du graphique")).toHaveTextContent("Non pointés")
    expect(await screen.findByText("Suivi financier")).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })

  it("garde la cloche et les priorités synchronisées après une résolution serveur", async () => {
    const actions = [
      {
        id: "absence-item",
        type: "teacher_absences_high",
        referenceId: null,
        priority: "high" as const,
        message: "4 absences de professeurs sur les 7 derniers jours",
        generatedAt: "2026-05-12T08:00:00.000Z",
      },
      {
        id: "salary-item",
        type: "salary_pending",
        referenceId: null,
        priority: "medium" as const,
        message: "1 fiche de salaire à terminer",
        generatedAt: "2026-05-12T08:00:00.000Z",
      },
    ]
    getDashboardActionItemsMock
      .mockResolvedValueOnce(actions)
      .mockResolvedValueOnce([actions[1]])

    renderWithQueryClient(<DashboardPage />)

    await screen.findByText("Bonjour, Directeur Test")
    const notificationButton = screen.getByRole("button", { name: "Voir les notifications" })
    await waitFor(() => expect(notificationButton.querySelector("span")?.textContent).toBe("2"))
    fireEvent.click(notificationButton)
    expect((await screen.findAllByText("Absences profs élevées")).length).toBeGreaterThan(0)
    expect(await screen.findByText("2 point(s) à suivre")).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: "Masquer cette notification" })[0]!)

    await waitFor(() => {
      expect(resolveDashboardActionItemMock).toHaveBeenCalledWith("absence-item")
      expect(screen.queryByText("Absences profs élevées")).not.toBeInTheDocument()
    })
    expect(screen.getByText("1 point(s) à suivre")).toBeInTheDocument()
    expect(notificationButton.querySelector("span")?.textContent).toBe("1")
  })

  it("masque les données non autorisées pour un staff (validations seulement)", async () => {
    setAuth("staff", ["validations.view"])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Staff Test")).toBeInTheDocument()
    // L'action est visible dans la zone « À surveiller » et aucune donnée financière n'est chargée.
    expect(await screen.findByRole("link", { name: new RegExp(VALIDATIONS_PRIORITY) })).toBeInTheDocument()
    expect(getSalarySummaryMock).not.toHaveBeenCalled()
    expect(fetchFinancialSummaryMock).not.toHaveBeenCalled()
  })

  it("ne mélange pas la permission salaire avec les données financières", async () => {
    setAuth("staff", ["salary.view"])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Staff Test")).toBeInTheDocument()
    expect(screen.queryByText(VALIDATIONS_PRIORITY)).not.toBeInTheDocument()
    expect(screen.queryByText("Suivi financier")).not.toBeInTheDocument()
    expect(fetchFinancialSummaryMock).not.toHaveBeenCalled()
  })

  it("n'affiche pas les anciens onglets de présence ou de salaire", async () => {
    setAuth("staff", ["validations.view"])
    renderWithQueryClient(<DashboardPage />)

    await screen.findByText("Bonjour, Staff Test")
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(getSalarySummaryMock).not.toHaveBeenCalled()
  })
})
