import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

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

const navigateMock = vi.fn()

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
        tenantId: "tenant-1",
        schemaName: "school_sainte_marie",
        plan: "standard",
      },
      accessToken: null,
    })

    getCurrentMonthKeyMock.mockReturnValue("2026-04")
    getPreviousMonthKeyMock.mockReturnValue("2026-03")

    getTodayAttendanceMock.mockResolvedValue({
      date: "2026-04-14",
      presentCount: 5,
      absentCount: 1,
      unmarkedCount: 1,
      courses: [
        {
          id: "course-1",
          teacherName: "M. Diallo",
          subject: "Maths",
          className: "6A",
          roomName: "Salle A1",
          slotLabel: "08:00-09:00",
          startTime: "08:00",
          endTime: "09:00",
          status: "present",
          lateMinutes: 0,
          roomMismatch: false,
          roomScannedName: "Salle A1",
          checkedInAt: "2026-04-14T08:00:00.000Z",
        },
      ],
    })

    getAttendanceHistoryMock.mockResolvedValue([
      { date: "2026-04-10", presentCount: 8, absentCount: 4, totalCount: 12, attendanceRate: 66.6 },
    ])

    getDashboardCountsMock.mockResolvedValue({
      activeTeachers: 12,
      activeStudents: 240,
    })

    getNextWeekCoverageStateMock.mockResolvedValue({ nextWeekHasCoverage: false })

    getSalarySummaryMock
      .mockResolvedValueOnce({
        month: "2026-04",
        items: [
          {
            teacherId: "t-1",
            teacherName: "M. Diallo",
            teacherType: "vacataire",
            hoursPlanned: 20,
            hoursDone: 18,
            hourlyRate: 2500,
            totalFcfa: 45000,
            status: "pending",
            salaryRecordId: "r-1",
          },
        ],
      })
      .mockResolvedValueOnce({
        month: "2026-03",
        items: [],
      })

    getTopRiskTeachersMock.mockResolvedValue([
      {
        teacherId: "t-1",
        teacherName: "M. Diallo",
        absenceCount: 4,
        attendanceRate: 60,
      },
    ])

    getTeacherTrendFromSummariesMock.mockReturnValue(12.5)
    getTotalPendingSalariesMock.mockReturnValue({ totalFcfa: 45000, count: 1 })

    fetchSchoolInfoMock.mockResolvedValue({ name: "École Sainte Marie" })
    getTodayAbsencesMock.mockResolvedValue([])
    getStudentAbsenceStatsMock.mockResolvedValue([] as const)
  })

  it("renders C1 dashboard sections with real data", async () => {
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Directeur Test")).toBeInTheDocument()
    expect(screen.getByText("École Sainte Marie")).toBeInTheDocument()
    expect(screen.getByText("Profs actifs")).toBeInTheDocument()
    expect(screen.getByText("Élèves actifs")).toBeInTheDocument()
    expect(screen.getByText("Présences profs — Aujourd'hui")).toBeInTheDocument()
    expect(screen.getAllByText("M. Diallo").length).toBeGreaterThan(0)
    expect(screen.getByText("Résumé salaires du mois")).toBeInTheDocument()
    expect(screen.getByText("Semaine prochaine non configurée")).toBeInTheDocument()
  })

  it("navigates to schedule from week coverage alert", async () => {
    renderWithQueryClient(<DashboardPage />)

    const button = await screen.findByRole("button", { name: "Configurer l'EDT" })
    fireEvent.click(button)

    expect(navigateMock).toHaveBeenCalledWith("/schedule")
  })
})
