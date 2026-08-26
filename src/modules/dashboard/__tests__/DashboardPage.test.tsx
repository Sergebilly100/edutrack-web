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
const VALIDATIONS_PRIORITY = "Validations en attente"
const TEACHER_PRESENCE_SECTION = "Présences professeurs aujourd'hui"

// Radix Tabs active l'onglet sur mouseDown (pas onClick).
function openTab(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }))
}

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
  })

  it("affiche toutes les sections pour un directeur", async () => {
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Directeur Test")).toBeInTheDocument()
    // Le directeur voit les trois onglets du tableau de bord.
    expect(screen.getByRole("tab", { name: /Vue d'ensemble/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Présences/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Salaires/ })).toBeInTheDocument()

    // Onglet Présences : présence professeurs du jour.
    openTab(/Présences/)
    expect(await screen.findByText(TEACHER_PRESENCE_SECTION)).toBeInTheDocument()

    // Onglet Salaires : résumé salaires du mois.
    openTab(/Salaires/)
    expect(await screen.findByText(SALARY_SECTION)).toBeInTheDocument()
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

    expect(await screen.findByText("Absences profs élevées")).toBeInTheDocument()
    const notificationButton = screen.getByRole("button", { name: "Voir les notifications" })
    expect(notificationButton.querySelector("span")?.textContent).toBe("2")
    fireEvent.click(notificationButton)
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
    // Action prioritaire validations visible (validations.view présent)…
    expect(await screen.findByText(VALIDATIONS_PRIORITY)).toBeInTheDocument()
    // …et la requête salaire reste désactivée.
    expect(getSalarySummaryMock).not.toHaveBeenCalled()

    // Onglet Présences : sections sensibles absentes sans attendance.view / teachers.view.
    openTab(/Présences/)
    expect(screen.queryByText(TEACHER_PRESENCE_SECTION)).not.toBeInTheDocument()
    expect(screen.queryByText(/à risque/)).not.toBeInTheDocument()
  })

  it("affiche le résumé salaires pour un staff avec salary.view", async () => {
    setAuth("staff", ["salary.view"])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Staff Test")).toBeInTheDocument()
    // Sans validations.view, l'action prioritaire validations reste masquée.
    expect(screen.queryByText(VALIDATIONS_PRIORITY)).not.toBeInTheDocument()

    openTab(/Salaires/)
    expect(await screen.findByText(SALARY_SECTION)).toBeInTheDocument()
  })

  it("ne déclenche pas la requête salaires pour un staff sans salary.view", async () => {
    setAuth("staff", ["validations.view"])
    renderWithQueryClient(<DashboardPage />)

    await screen.findByText("Bonjour, Staff Test")
    openTab(/Salaires/)

    // L'onglet s'affiche en état vide : aucune requête salaire n'a été lancée.
    await screen.findByText("Aucune fiche salaire")
    // Les requêtes salaires sont gardées par enabled:canViewSalary → jamais appelées.
    expect(getSalarySummaryMock).not.toHaveBeenCalled()
  })
})
