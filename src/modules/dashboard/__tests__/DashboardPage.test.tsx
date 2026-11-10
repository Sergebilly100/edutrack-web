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
      if (url === "/grading-periods") {
        return Promise.resolve({
          data: {
            gradingPeriods: [
              { id: "period-current", school_year_id: "school-year-1", label: "Trimestre 1", isCurrent: true, isCompleted: false, notesEntryOpen: true, conductReviewOpen: false, isClosed: false },
              { id: "period-upcoming", school_year_id: "school-year-1", label: "Trimestre 2", isCurrent: false, isCompleted: false, notesEntryOpen: false, conductReviewOpen: false, isClosed: false },
            ],
          },
        })
      }
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
const listSchoolYearsMock = vi.fn()
const getConductReviewWorkspaceMock = vi.fn()

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

vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: () => listSchoolYearsMock(),
  fetchConductDecisionWorkspace: () => getConductReviewWorkspaceMock(),
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
  it("affiche tous les cours du jour puis revient aux six premiers", async () => {
    getTodayAttendanceMock.mockResolvedValue({
      date: "2026-05-12",
      courses: Array.from({ length: 7 }, (_, index) => ({
        id: `course-${index + 1}`,
        startTime: `${String(7 + index).padStart(2, "0")}:00:00`,
        endTime: `${String(8 + index).padStart(2, "0")}:00:00`,
        teacherName: `Professeur ${index + 1}`,
        subject: "Mathématiques",
        className: "6A",
        status: "present",
      })),
    })
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByRole("button", { name: "Afficher tout" })).toBeInTheDocument()
    expect(screen.queryByText("Professeur 7")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Afficher tout" }))
    expect(await screen.findByText("Professeur 7")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Afficher moins" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Afficher moins" }))
    expect(screen.queryByText("Professeur 7")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Afficher tout" })).toBeInTheDocument()
  })

  it("affiche les horaires exacts sans secondes dans les présences professeurs", async () => {
    getTodayAttendanceMock.mockResolvedValue({
      date: "2026-05-12", presentCount: 0,
      courses: [{
        id: "course-1", startTime: "07:30:00", endTime: "08:30:00",
        teacherName: "Professeur Test", subject: "Mathématiques", className: "6A",
        roomName: "Salle A1", status: null,
      }],
    })
    renderWithQueryClient(<DashboardPage />)
    expect(await screen.findByText("07:30 – 08:30")).toBeInTheDocument()
    expect(screen.queryByText("07:30:00 – 08:30:00")).not.toBeInTheDocument()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()

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
      school: { total_expected_to_date: "1200000", total_paid: "840000", remaining_to_collect: "360000", annual_total_due: "1000000", annual_remaining: "160000", upcoming_due: "-200000", recovery_rate: "0.7", students_late_count: 4 },
      levels: [{ level_id: "level-1", level_name: "6e", total_expected_to_date: "600000", total_paid: "420000", remaining_to_collect: "180000", annual_total_due: "500000", annual_remaining: "80000", upcoming_due: "-100000", students_late_count: 2 }],
      upcomingInstallments: [{ due_date: "2026-06-15", expected_amount: "350000", student_count: 42 }],
    })
    listSchoolYearsMock.mockResolvedValue([
      { id: "school-year-1", label: "2025-2026", status: "active" },
    ])
    getConductReviewWorkspaceMock.mockResolvedValue({ teacherActions: [], decisionScopes: [], decisionActions: [] })
  })

  it("affiche les KPI, le graphique distinct et les libellés financiers à date", async () => {
    getAttendanceHistoryMock.mockResolvedValue([
      { date: "2026-05-11", presentCount: 10, lateCount: 1, absentCount: 2, notCheckedCount: 0, totalCount: 13, attendanceRate: 84.62 },
      { date: "2026-05-12", presentCount: 12, lateCount: 0, absentCount: 1, notCheckedCount: 0, totalCount: 13, attendanceRate: 92.31 },
    ])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Bonjour, Directeur Test")).toBeInTheDocument()
    expect(await screen.findByText("Présence des professeurs, 7 derniers jours", {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByText("Présences professeurs aujourd’hui")).toBeInTheDocument()
    expect(await screen.findByText("Notes saisies")).toBeInTheDocument()
    expect(screen.getByText("Notes ≥ 10/20")).toBeInTheDocument()
    expect(screen.getByLabelText("Légende du graphique")).toHaveTextContent("Présents")
    expect(screen.getByLabelText("Légende du graphique")).toHaveTextContent("Retards")
    expect(screen.getByLabelText("Légende du graphique")).toHaveTextContent("Absents")
    expect(await screen.findByText("Suivi financier")).toBeInTheDocument()
    expect(screen.getByText("Recouvrement à date").parentElement).toHaveTextContent("70%")
    expect(screen.getByText("Impayé à date").parentElement).toHaveTextContent(/360\s*000/)
    expect(screen.getByText("Solde annuel restant").parentElement).toHaveTextContent(/160\s*000 FCFA/)
    expect(screen.getByRole("progressbar", { name: "Recouvrement à date 6e, 70 %" })).toHaveClass("[&>div]:bg-primary")
    expect(screen.getByRole("link", { name: /Élèves confirmés : 312/ })).toHaveAttribute("href", "/students")
    expect(screen.getByRole("link", { name: /Professeurs : 13/ })).toHaveAttribute("href", "/teachers")
    expect(await screen.findByRole("link", { name: /Baisse de moyenne/ })).toHaveAttribute(
      "href",
      "/dashboard/risks?tab=students&category=grades&schoolYearId=school-year-1&gradingPeriodId=period-current",
    )
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })

  it("conserve les indicateurs à date si le total annuel du niveau manque", async () => {
    fetchFinancialSummaryMock.mockResolvedValueOnce({
      school: {
        total_expected_to_date: "1200000",
        total_paid: "840000",
        annual_total_due: "1000000",
      },
      levels: [{
        level_id: "level-1",
        level_name: "6e",
        total_expected_to_date: "600000",
        total_paid: "420000",
      }],
    })

    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Suivi financier")).toBeInTheDocument()
    const levelRate = await screen.findByText("70 % à date")
    expect(levelRate.closest("tr")).toHaveTextContent(/180\s*000 FCFA/)
    expect(screen.getByText("Solde annuel restant").parentElement).toHaveTextContent(/160\s*000 FCFA/)
  })

  it("explique l'absence d'effectif confirmé sans cacher les niveaux fournis par l'API", async () => {
    getDashboardPilotageMock.mockResolvedValue({
      population: { activeStudents: 0, activeTeachers: 1, activeClasses: 1 },
      academic: [{ levelId: "level-1", levelName: "6e", classCount: 1, expectedSubjects: 0, completedSubjects: 0, completionRate: 0, studentsWithAverage: 0, averageScore: null, performingStudents: 0, attentionStudents: 0, criticalStudents: 0, gradeCount: 0, gradesAtLeastTen: 0 }],
      risks: { studentAbsences: 0, studentGrades: 0, studentPayments: 0, teacherAbsences: 0, teacherLateness: 0, teachersAtRisk: 0 },
    })
    renderWithQueryClient(<DashboardPage />)

    // La période par défaut est choisie après le chargement des périodes : on attend l'état stabilisé.
    await waitFor(() => {
      expect(screen.getByText("Aucun élève confirmé")).toBeInTheDocument()
      expect(screen.getByText(/Les dossiers en attente ne font pas partie/)).toBeInTheDocument()
    })
    expect(screen.getAllByRole("row", { name: /6e/ }).length).toBeGreaterThan(0)
    expect(screen.getByText("Élèves confirmés")).toBeInTheDocument()
  })

  it("signale le total enseignant sans additionner deux fois les signaux", async () => {
    getDashboardPilotageMock.mockResolvedValue({
      population: { activeStudents: 10, activeTeachers: 1, activeClasses: 1 },
      academic: [],
      risks: { studentAbsences: 8, studentGrades: 8, studentPayments: 8, teacherAbsences: 1, teacherLateness: 1, teachersAtRisk: 1 },
    })
    renderWithQueryClient(<DashboardPage />)
    expect(await screen.findByRole("link", { name: /Retards répétés/ })).toHaveAttribute("href", "/dashboard/risks?tab=teachers&signal=lateness")
    expect(await screen.findByText("1 à risque")).toBeInTheDocument()
  })

  it("actualise toutes les données visibles du dashboard", async () => {
    renderWithQueryClient(<DashboardPage />)

    const refreshButton = await screen.findByRole("button", { name: "Mettre à jour les données" })
    const initialCalls = {
      pilotage: getDashboardPilotageMock.mock.calls.length,
      stats: getDashboardStatsMock.mock.calls.length,
      financial: fetchFinancialSummaryMock.mock.calls.length,
      actionItems: getDashboardActionItemsMock.mock.calls.length,
      schoolYears: listSchoolYearsMock.mock.calls.length,
    }
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(getDashboardPilotageMock.mock.calls.length).toBeGreaterThan(initialCalls.pilotage)
      expect(getDashboardStatsMock.mock.calls.length).toBeGreaterThan(initialCalls.stats)
      expect(fetchFinancialSummaryMock.mock.calls.length).toBeGreaterThan(initialCalls.financial)
      expect(getDashboardActionItemsMock.mock.calls.length).toBeGreaterThan(initialCalls.actionItems)
      expect(listSchoolYearsMock.mock.calls.length).toBeGreaterThan(initialCalls.schoolYears)
    })
    expect(await screen.findByText(/Mis à jour :/)).toBeInTheDocument()
  })

  it("conserve la dernière actualisation après le rechargement de la page", async () => {
    window.localStorage.setItem("edutrack.dashboard.last-refresh:tenant-1", "2026-10-17T08:30:00.000Z")

    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Mis à jour : 17 oct. 2026 à 08:30")).toBeInTheDocument()
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

  it("travaille sur l'année active : ligne de contexte en lecture seule, sans sélecteur d'année, avec la pastille du nom de l'école", async () => {
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText(/Année scolaire 2025-2026/)).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Année scolaire" })).not.toBeInTheDocument()
    expect(await screen.findByText("École Sainte Marie")).toBeInTheDocument()
    expect(await screen.findByRole("combobox", { name: "Période" })).toBeInTheDocument()
    expect(screen.getByText("Trimestre 1 · en cours")).toBeInTheDocument()
  })

  it("sans année active : message clair avec lien de configuration, sans erreur", async () => {
    listSchoolYearsMock.mockResolvedValue([{ id: "school-year-0", label: "2024-2025", status: "closed" }])
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText(/Aucune année scolaire active/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Configurer l'année scolaire" })).toHaveAttribute("href", "/academic/school-years")
    expect(screen.queryByRole("combobox", { name: "Période" })).not.toBeInTheDocument()
    expect(screen.queryByText("Tableau de bord indisponible")).not.toBeInTheDocument()
  })

  it("rend une période à venir indisponible à la sélection", async () => {
    renderWithQueryClient(<DashboardPage />)

    await screen.findByText("Trimestre 1 · en cours")
    fireEvent.click(await screen.findByRole("combobox", { name: "Période" }))

    expect(screen.getByRole("option", { name: /trimestre 2.*à venir/i })).toHaveAttribute("aria-disabled", "true")
  })

  it("trie les présences par absent, à pointer puis présent", async () => {
    getTodayAttendanceMock.mockResolvedValue({
      date: "2026-05-12",
      courses: [
        { id: "present", startTime: "07:00:00", endTime: "08:00:00", teacherName: "Présent", subject: "Maths", className: "6A", status: "present" },
        { id: "pending", startTime: "08:00:00", endTime: "09:00:00", teacherName: "À pointer", subject: "Maths", className: "6A", status: null },
        { id: "absent", startTime: "09:00:00", endTime: "10:00:00", teacherName: "Absent", subject: "Maths", className: "6A", status: "absent" },
      ],
    })
    renderWithQueryClient(<DashboardPage />)

    const rows = await screen.findAllByRole("row")
    const attendanceRows = rows.filter((row) => /Présent|À pointer|Absent/.test(row.textContent ?? ""))
    expect(attendanceRows.map((row) => row.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining("Absent"),
      expect.stringContaining("À pointer"),
      expect.stringContaining("Présent"),
    ]))
    expect(attendanceRows.findIndex((row) => row.textContent?.includes("Absent"))).toBeLessThan(attendanceRows.findIndex((row) => row.textContent?.includes("À pointer")))
    expect(attendanceRows.findIndex((row) => row.textContent?.includes("À pointer"))).toBeLessThan(attendanceRows.findIndex((row) => row.textContent?.includes("Présent")))
    expect(screen.queryByRole("button", { name: "Contacter" })).not.toBeInTheDocument()
  })

  it("affiche uniquement les validations en attente dans les actions prioritaires", async () => {
    getDashboardActionItemsMock.mockResolvedValue([
      { id: "validations", type: "validations_pending", referenceId: null, priority: "high", message: "2 décision(s) à prendre sur les pointages.", generatedAt: "2026-05-12" },
      { id: "students", type: "student_at_risk", referenceId: null, priority: "high", message: "10 élèves à suivre", generatedAt: "2026-05-12" },
      { id: "teachers", type: "teacher_at_risk", referenceId: null, priority: "high", message: "6 professeur(s) à suivre pour leur assiduité", generatedAt: "2026-05-12" },
      { id: "absence", type: "teacher_absences_high", referenceId: null, priority: "high", message: "52 absences de professeurs sur les 7 derniers jours", generatedAt: "2026-05-12" },
      { id: "salary", type: "salary_pending", referenceId: null, priority: "medium", message: "1 fiche de salaire à terminer", generatedAt: "2026-05-12" },
    ])
    renderWithQueryClient(<DashboardPage />)

    const actions = await screen.findByText("Actions prioritaires")
    const actionCard = actions.closest("div[class*='rounded-lg']")
    expect(actionCard).toHaveTextContent("1 sujet")
    expect(actionCard).toHaveTextContent("Validations en attente")
    expect(actionCard).toHaveTextContent("2")
    expect(actionCard).not.toHaveTextContent("Élèves à risque")
    expect(actionCard).not.toHaveTextContent("Professeurs à suivre")
    expect(actionCard).not.toHaveTextContent("Absences profs élevées")
    expect(actionCard).not.toHaveTextContent("Salaires à terminer")
  })

})
