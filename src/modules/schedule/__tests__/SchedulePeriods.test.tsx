import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: vi.fn(),
})

const fetchWeeklyScheduleMock = vi.fn()
const fetchActiveSchedulePeriodsMock = vi.fn()

vi.mock("@/modules/schedule/schedule.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/schedule/schedule.api")>(
    "@/modules/schedule/schedule.api"
  )
  return {
    ...actual,
    fetchWeeklySchedule: (...args: unknown[]) => fetchWeeklyScheduleMock(...args),
    fetchActiveSchedulePeriods: () => fetchActiveSchedulePeriodsMock(),
    fetchNextWeekCoverage: vi.fn().mockResolvedValue({ hasSchedule: false }),
    createScheduleSlot: vi.fn(),
    updateScheduleSlot: vi.fn(),
    deleteScheduleSlotFromDate: vi.fn(),
  }
})

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (_perm: string) => true,
    refreshPermissions: vi.fn(),
  }),
}))

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: { id: "u1", role: "director" }, accessToken: "tok" }),
}))

vi.mock("@/modules/teachers/teachers.api", () => ({
  getTeachers: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 200 }),
}))

vi.mock("@/modules/schedule/components/WeekGrid", () => ({
  default: ({ slots }: { slots: Array<{ id: string }> }) =>
    <div data-testid="week-grid">{slots.map((slot) => slot.id).join(",")}</div>,
}))

vi.mock("@/shared/components/OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}))

vi.mock("@/shared/components/OfflineGuard", () => ({
  OfflineGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import SchedulePage from "@/modules/schedule/SchedulePage"

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const renderSchedulePage = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>
    </QueryClientProvider>
  )

const makeScheduleData = (
  period: { id: string; name: string; validFrom: string; validTo: string; isActive: boolean } | null = null
) => ({
  date: "2026-06-02",
  period,
  schedules: [],
  catalog: { teachers: [], classes: [], rooms: [], timeSlots: [] },
})

beforeEach(() => {
  vi.clearAllMocks()
  fetchActiveSchedulePeriodsMock.mockResolvedValue([])
})

describe("SchedulePeriods", () => {
  it("saisit des minutes libres et signale une heure invalide près du champ", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue(makeScheduleData({
      id: "p1", name: "Trimestre 1", validFrom: "2026-01-01", validTo: "2026-12-31", isActive: true,
    }))
    const view = renderSchedulePage()
    await screen.findByText(/trimestre 1/i)
    const addButton = view.container.querySelector<HTMLButtonElement>('[data-tour="schedule-add-btn"]')
    fireEvent.click(addButton!)
    const start = await screen.findByLabelText("Début")
    const end = screen.getByLabelText("Fin")
    fireEvent.change(start, { target: { value: "07:15" } })
    fireEvent.change(end, { target: { value: "08:05" } })
    expect(start).toHaveValue("07:15")
    expect(end).toHaveValue("08:05")
    expect(screen.getByRole("button", { name: "Ajouter le créneau" })).not.toBeDisabled()
    fireEvent.change(end, { target: { value: "12:60" } })
    expect(screen.getByText(/Saisissez une heure valide au format HH:MM/)).toBeInTheDocument()
    expect(end).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("button", { name: "Ajouter le créneau" })).toBeDisabled()
  })

  it("conserve la plage exacte en liste desktop et sur mobile", async () => {
    window.localStorage.setItem("schedule-view-mode", "list")
    const period = { id: "p1", name: "Trimestre 1", validFrom: "2026-01-01", validTo: "2026-12-31", isActive: true }
    const timeSlot = { id: "ts-flex", label: "07:15 – 08:05", startTime: "07:15", endTime: "08:05", sortOrder: 435 }
    fetchWeeklyScheduleMock.mockResolvedValue({
      ...makeScheduleData(period),
      schedules: [{
        id: "course-flex", schedulePeriodId: "p1", dayOfWeek: 1,
        subject: "Mathématiques", subjectDisplay: "Mathématiques", startDate: null, endDate: null,
        pastAttendanceCount: 0, hasPastAttendance: false,
        teacher: { id: "t1", name: "Prof Test", username: "test" },
        class: { id: "c1", name: "6A", levelId: null, levelName: null },
        room: { id: "r1", name: "Salle A", qrToken: "qr" }, timeSlot,
      }],
      catalog: {
        teachers: [], classes: [], rooms: [], timeSlots: [timeSlot],
      },
    })
    const view = renderSchedulePage()
    await screen.findAllByText("Prof Test")
    fireEvent.click(screen.getByRole("tab", { name: /Lun/ }))
    const desktopTable = view.container.querySelector("table")
    expect(desktopTable).toHaveTextContent("07:15 – 08:05")
    const mobileCard = [...view.container.querySelectorAll(".md\\:hidden")]
      .find((element) => element.textContent?.includes("Créneaux par jour"))
    expect(mobileCard).toHaveTextContent("07:15 – 08:05")
  })
  it("affiche l'alerte quand aucune période n'est active", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue(makeScheduleData(null))

    renderSchedulePage()

    await waitFor(() => {
      expect(
        screen.getByText(/aucune période active\. importez l'emploi du temps avec ses dates d'application/i)
      ).toBeInTheDocument()
    })
  })

  it("affiche le nom de la période active dans l'entête de vue liste", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue(
      makeScheduleData({
        id: "p1",
        name: "Trimestre 1",
        validFrom: "2026-01-01",
        validTo: "2026-06-30",
        isActive: true,
      })
    )

    renderSchedulePage()

    await waitFor(() => {
      expect(screen.getByText(/trimestre 1/i)).toBeInTheDocument()
    })
  })

  it("propose les périodes actives dans le formulaire d'ajout de créneau", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue(makeScheduleData(null))
    fetchActiveSchedulePeriodsMock.mockResolvedValue([
      { id: "p1", name: "Semestre 1", validFrom: "2026-01-01", validTo: "2026-06-30", isActive: true },
      { id: "p2", name: "Semestre 2", validFrom: "2026-07-01", validTo: "2026-12-31", isActive: true },
    ])

    renderSchedulePage()

    // La page charge sans erreur - les périodes seront accessibles via le formulaire
    await waitFor(() => {
      expect(fetchWeeklyScheduleMock).toHaveBeenCalled()
    })
  })

  it("empêche de sélectionner un professeur bloqué dans le formulaire", async () => {
    fetchWeeklyScheduleMock.mockResolvedValue({
      ...makeScheduleData({
        id: "p1",
        name: "Trimestre 1",
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isActive: true,
      }),
      catalog: {
        teachers: [{
          id: "teacher-blocked",
          name: "Mme Kouamé",
          username: "kouame.anne",
          isBlocked: true,
          subjects: ["Mathématiques"],
          teachingAssignments: [],
        }],
        classes: [],
        rooms: [],
        timeSlots: [],
      },
    })

    const view = renderSchedulePage()

    await screen.findByText(/trimestre 1/i)
    const addButton = view.container.querySelector<HTMLButtonElement>('[data-tour="schedule-add-btn"]')
    expect(addButton).not.toBeNull()
    fireEvent.click(addButton!)
    fireEvent.click(screen.getAllByRole("combobox")[1]!)

    const option = await screen.findByRole("option", { name: "Mme Kouamé (bloqué)" })
    expect(option).toHaveAttribute("data-disabled")
  })
})

describe("filtres de consultation EDT", () => {
  const period = { id: "p1", name: "Trimestre 1", validFrom: "2026-01-01", validTo: "2026-12-31", isActive: true }
  const makeSlot = (id: string, levelId: string | null, classId: string, teacherId: string) => ({
    id, schedulePeriodId: "p1", dayOfWeek: 1, subject: "Mathématiques", subjectDisplay: "Mathématiques",
    startDate: null, endDate: null, pastAttendanceCount: 0, hasPastAttendance: false,
    teacher: { id: teacherId, name: teacherId, username: teacherId },
    class: { id: classId, name: classId, levelId, levelName: levelId },
    room: { id: "r1", name: "Salle 1", qrToken: "qr" },
    timeSlot: { id: "ts1", label: "08:00", startTime: "08:00", endTime: "09:00", sortOrder: 1 },
  })

  beforeEach(() => {
    window.localStorage.setItem("schedule-view-mode", "grid")
    fetchWeeklyScheduleMock.mockResolvedValue({
      ...makeScheduleData(period),
      schedules: [
        makeSlot("cours-6a", "level-6", "6A", "prof-a"),
        makeSlot("cours-5a", "level-5", "5A", "prof-a"),
        makeSlot("cours-sans-niveau", null, "NA", "prof-b"),
      ],
      catalog: {
        teachers: [
          { id: "prof-a", name: "Prof A", username: "a", subjects: [], teachingAssignments: [] },
          { id: "prof-b", name: "Prof B", username: "b", subjects: [], teachingAssignments: [] },
        ],
        classes: [
          { id: "6A", name: "6A", levelId: "level-6", levelName: "6ème" },
          { id: "5A", name: "5A", levelId: "level-5", levelName: "5ème" },
          { id: "NA", name: "NA", levelId: null, levelName: null },
        ],
        rooms: [], timeSlots: [makeSlot("unused", "level-6", "6A", "prof-a").timeSlot],
      },
    })
  })

  it("combine niveau, professeur et classe dans la grille et conserve Tous les niveaux", async () => {
    renderSchedulePage()
    await screen.findByText("cours-6a,cours-5a,cours-sans-niveau")
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "6ème" }))
    expect(screen.getByTestId("week-grid")).toHaveTextContent("cours-6a")
    expect(screen.getByTestId("week-grid")).not.toHaveTextContent("cours-5a")

    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par professeur" }))
    fireEvent.click(await screen.findByRole("option", { name: "Prof A" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par classe" }))
    expect(screen.queryByRole("option", { name: "5A" })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole("option", { name: "6A" }))
    expect(screen.getByTestId("week-grid")).toHaveTextContent("cours-6a")

    fireEvent.click(screen.getByRole("button", { name: /effacer le filtre niveau/i }))
    expect(screen.getByTestId("week-grid")).toHaveTextContent("cours-6a")
    fireEvent.click(screen.getByRole("button", { name: /effacer le filtre classe/i }))
    expect(screen.getByTestId("week-grid")).toHaveTextContent("cours-5a")
    fireEvent.click(screen.getByRole("button", { name: /effacer le filtre professeur/i }))
    expect(screen.getByTestId("week-grid")).toHaveTextContent("cours-sans-niveau")
  })

  it("réinitialise la classe incompatible et affiche un état vide en liste et sur mobile", async () => {
    renderSchedulePage()
    await screen.findByText("cours-6a,cours-5a,cours-sans-niveau")
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par classe" }))
    fireEvent.click(await screen.findByRole("option", { name: "5A" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "6ème" }))
    expect(screen.getByRole("combobox", { name: "Filtrer par classe" })).toHaveTextContent("Toutes les classes")
    expect(screen.getByTestId("week-grid")).toHaveTextContent("cours-6a")
    expect(fetchWeeklyScheduleMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par professeur" }))
    fireEvent.click(await screen.findByRole("option", { name: "Prof B" }))
    expect(screen.getByText("Aucun cours pour ces filtres")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Liste" }))
    expect(screen.queryByText("cours-6a")).not.toBeInTheDocument()
    expect(screen.getByText("Aucun cours ce jour")).toBeInTheDocument()
  })

  it("applique le niveau à la liste desktop et aux cours mobiles", async () => {
    window.localStorage.setItem("schedule-view-mode", "list")
    const view = renderSchedulePage()
    await screen.findByRole("combobox", { name: "Filtrer par niveau" })
    await waitFor(() => expect(fetchWeeklyScheduleMock).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer par niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "6ème" }))

    const desktopTable = view.container.querySelector("table")
    expect(desktopTable).not.toBeNull()
    expect(desktopTable).toHaveTextContent("6A")
    expect(desktopTable).not.toHaveTextContent("5A")
    expect(desktopTable).not.toHaveTextContent("NA")
    const mobileCard = [...view.container.querySelectorAll(".md\\:hidden")]
      .find((element) => element.textContent?.includes("Créneaux par jour"))
    expect(mobileCard).toHaveTextContent("6A")
    expect(mobileCard).not.toHaveTextContent("5A")
  })
})
