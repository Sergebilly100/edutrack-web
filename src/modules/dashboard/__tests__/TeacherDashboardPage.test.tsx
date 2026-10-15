import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { navigateMock, scheduleMock, contextMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  scheduleMock: vi.fn(),
  contextMock: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock("@/modules/schedule/schedule.api", () => ({
  fetchTeacherSchedule: () => scheduleMock(),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  fetchTeacherAcademicContext: () => contextMock(),
  fetchConductTeacherActions: () => Promise.resolve({ teacherActions: [] }),
}))

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: [] }) },
}))

import TeacherDashboardPage from "@/modules/dashboard/TeacherDashboardPage"
import { useAuthStore } from "@/shared/store/auth.store"

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter><QueryClientProvider client={client}>{ui}</QueryClientProvider></MemoryRouter>)
}

describe("TeacherDashboardPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"))
    vi.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: "teacher-1", name: "Mariam Coulibaly", role: "teacher", phone: null, email: "mariam@example.com",
        profilePhotoUrl: null, mustChangePassword: false, tenantId: "tenant-1", schemaName: "school_sainte_marie", plan: "standard",
      },
      permissions: [], accessToken: null,
    })
    scheduleMock.mockResolvedValue([{
      id: "slot-1", class_id: "class-1", class_name: "6ème A", subject_name: "Mathématiques", room_id: "room-1", room_name: "A1",
      start_at: "2099-01-01T08:00:00.000Z", end_at: "2099-01-01T09:00:00.000Z",
    }])
    contextMock.mockResolvedValue({
      classes: [{ id: "class-1", name: "6ème A", levelId: "level-1", levelName: "6ème", schoolYearId: "year-1", schoolYearLabel: "2098-2099" }],
      gradingPeriods: [{ id: "period-1", schoolYearId: "year-1", label: "1er trimestre", startDate: "2098-09-01", endDate: "2098-12-20", isCompleted: false, isCurrent: true, notesEntryOpen: true }],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("donne accès au cours du jour et aux notes de la classe attribuée", async () => {
    renderWithClient(<TeacherDashboardPage />)

    expect(await screen.findByText("Prochain cours")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Revoir le guide" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mes notifications" })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: "Saisir les notes" }))
    expect(navigateMock).toHaveBeenCalledWith("/academic/notes?classId=class-1&gradingPeriodId=period-1")
    fireEvent.click(screen.getAllByRole("button", { name: /6ème A/ })[1])
    expect(navigateMock).toHaveBeenCalledWith("/academic/notes?classId=class-1&gradingPeriodId=period-1")
  })

  it("ouvre T2 pour la saisie pendant la revue de T1", async () => {
    contextMock.mockResolvedValue({
      classes: [{ id: "class-1", name: "6ème A", levelId: "level-1", levelName: "6ème", schoolYearId: "year-1", schoolYearLabel: "2098-2099" }],
      gradingPeriods: [
        { id: "period-1", label: "1er trimestre", isCurrent: true, notesEntryOpen: false, conductReviewOpen: true },
        { id: "period-2", label: "2e trimestre", isCurrent: true, notesEntryOpen: true, conductReviewOpen: false },
      ],
    })
    renderWithClient(<TeacherDashboardPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Saisir les notes" }))
    expect(navigateMock).toHaveBeenCalledWith("/academic/notes?classId=class-1&gradingPeriodId=period-2")
  })

  it("affiche une journée terminée avec les statuts de chaque cours", async () => {
    scheduleMock.mockResolvedValue([{
      id: "slot-past", class_id: "class-1", class_name: "6ème A", subject_name: "Mathématiques", room_id: "room-1", room_name: "A1",
      start_at: "2026-10-15T08:00:00.000Z", end_at: "2026-10-15T09:00:00.000Z",
    }, {
      id: "slot-absent", class_id: "class-1", class_name: "6ème A", subject_name: "Français", room_id: "room-1", room_name: "A1",
      start_at: "2026-10-15T10:17:00.000Z", end_at: "2026-10-15T11:23:00.000Z", attendance_status: "absent",
    }])

    renderWithClient(<TeacherDashboardPage />)

    expect(await screen.findByRole("heading", { name: "Journée terminée" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Résumé des cours du jour" })).toHaveTextContent("Vos 2 cours prévus aujourd’hui sont terminés. Consultez leur statut ci-dessous.")
    expect(screen.getByText("Terminé")).toBeInTheDocument()
    expect(screen.getByText("Absent")).toBeInTheDocument()
    expect(screen.getByText("10:17")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ouvrir le cours" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Préparer le cours" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("region", { name: "Résumé des cours du jour" }).querySelector("button")!)
    expect(navigateMock).toHaveBeenCalledWith("/attendance")
  })

  it("accorde le résumé au singulier", async () => {
    scheduleMock.mockResolvedValue([{ id: "slot-1", class_id: "class-1", class_name: "6ème A", subject_name: "Mathématiques", start_at: "2026-10-15T08:00:00.000Z", end_at: "2026-10-15T09:00:00.000Z" }])
    renderWithClient(<TeacherDashboardPage />)
    expect(await screen.findByText("Votre cours prévu aujourd’hui est terminé. Consultez son statut ci-dessous.")).toBeInTheDocument()
  })

  it("réserve journée libre à une vraie journée sans cours", async () => {
    scheduleMock.mockResolvedValue([])
    renderWithClient(<TeacherDashboardPage />)
    expect(await screen.findByRole("heading", { name: "Journée libre" })).toBeInTheDocument()
    expect(screen.getByText(/Aucun cours prévu aujourd’hui/)).toBeInTheDocument()
    expect(screen.getByText("Vos cours apparaîtront ici lorsqu’ils seront planifiés.")).toBeInTheDocument()
    expect(screen.queryByText("Journée terminée")).not.toBeInTheDocument()
  })

  it("conserve les actions du cours en cours", async () => {
    scheduleMock.mockResolvedValue([{ id: "slot-1", class_id: "class-1", class_name: "6ème A", subject_name: "Mathématiques", start_at: "2026-10-15T11:17:00.000Z", end_at: "2026-10-15T12:43:00.000Z" }])
    renderWithClient(<TeacherDashboardPage />)
    expect(await screen.findByText("Cours en cours")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le cours" }))
    expect(navigateMock).toHaveBeenCalledWith("/attendance")
  })

  it("passe automatiquement de prochain à en cours puis à terminée", async () => {
    const ticks: Array<() => void> = []
    vi.spyOn(window, "setInterval").mockImplementation((callback) => {
      if (typeof callback === "function") ticks.push(callback)
      return ticks.length
    })
    vi.setSystemTime(new Date("2026-10-15T08:59:00.000Z"))
    scheduleMock.mockResolvedValue([{ id: "slot-1", class_id: "class-1", class_name: "6ème A", subject_name: "Mathématiques", start_at: "2026-10-15T09:00:00.000Z", end_at: "2026-10-15T10:00:00.000Z" }])

    renderWithClient(<TeacherDashboardPage />)
    expect(await screen.findByText("Prochain cours")).toBeInTheDocument()
    await act(async () => {
      vi.setSystemTime(new Date("2026-10-15T09:00:00.000Z"))
      ticks.forEach((tick) => tick())
    })
    expect(screen.getByText("Cours en cours")).toBeInTheDocument()
    await act(async () => {
      vi.setSystemTime(new Date("2026-10-15T10:01:00.000Z"))
      ticks.forEach((tick) => tick())
    })
    expect(screen.getByRole("heading", { name: "Journée terminée" })).toBeInTheDocument()
  })

  it("recharge les cours du nouveau jour métier après minuit", async () => {
    const ticks: Array<() => void> = []
    vi.spyOn(window, "setInterval").mockImplementation((callback) => {
      if (typeof callback === "function") ticks.push(callback)
      return ticks.length
    })
    vi.setSystemTime(new Date("2026-10-15T23:59:00.000Z"))
    scheduleMock.mockReset()
    scheduleMock.mockResolvedValueOnce([{ id: "slot-1", class_id: "class-1", class_name: "6ème A", subject_name: "Mathématiques", start_at: "2026-10-15T08:00:00.000Z", end_at: "2026-10-15T09:00:00.000Z" }])
      .mockResolvedValue([])

    renderWithClient(<TeacherDashboardPage />)
    expect(await screen.findByRole("heading", { name: "Journée terminée" })).toBeInTheDocument()
    await act(async () => {
      vi.setSystemTime(new Date("2026-10-16T00:01:00.000Z"))
      ticks.forEach((tick) => tick())
    })
    expect(ticks.length).toBeGreaterThan(0)
    expect(scheduleMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    await waitFor(() => expect(screen.getByRole("heading", { name: "Journée libre" })).toBeInTheDocument())
  })
})
