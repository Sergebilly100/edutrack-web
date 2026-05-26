import { act, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const getPendingValidationsMock = vi.fn()
const fetchMissingEndScansMock = vi.fn()
const approveValidationMock = vi.fn()
const rejectValidationMock = vi.fn()
const applyEndScanActionMock = vi.fn()
const cancelEndScanSanctionMock = vi.fn()
const bulkWarnEndScansMock = vi.fn()

vi.mock("../validations.api", () => ({
  getPendingValidations: () => getPendingValidationsMock(),
  fetchMissingEndScans: () => fetchMissingEndScansMock(),
  approveValidation: (input: unknown) => approveValidationMock(input),
  rejectValidation: (input: unknown) => rejectValidationMock(input),
  applyEndScanAction: (input: unknown) => applyEndScanActionMock(input),
  cancelEndScanSanction: (input: unknown) => cancelEndScanSanctionMock(input),
  bulkWarnEndScans: (ids: unknown, month: unknown) => bulkWarnEndScansMock(ids, month),
  invalidateSession: vi.fn(),
}))

vi.mock("@/shared/utils/month", () => ({
  getCurrentMonth: () => "2026-05",
  getRecentMonthOptions: () => ["2026-05", "2026-04", "2026-03"],
  formatMonthLabel: (m: string) => m,
}))

vi.mock("@/shared/components", () => ({
  OfflineIndicator: () => null,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  emptyStateIcons: { allGood: "check" },
}))

import ValidationsPage from "../ValidationsPage"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const emptyGroups = { gps_suspicious: [], short_hours: [] }

const makeGpsItem = (overrides = {}) => ({
  attendanceId: "att-1",
  teacherId: "t-1",
  teacherName: "M. Koné",
  courseName: "Maths",
  className: "3A",
  date: "2026-05-01",
  checkedInAt: "2026-05-01T08:00:00",
  checkedOutAt: null,
  geoStatus: "suspicious" as const,
  checkinDistance: 150,
  actualMinutes: null,
  scheduleDurationMinutes: 60,
  validationReason: null,
  hourlyRate: 5000,
  kind: "gps_suspicious" as const,
  kinds: ["gps_suspicious" as const],
  slotLabel: "8h-9h",
  roomName: "Salle A1",
  ...overrides,
})

const makeShortHoursItem = (overrides = {}) => ({
  attendanceId: "att-2",
  teacherId: "t-2",
  teacherName: "Mme Bah",
  courseName: "Français",
  className: "5B",
  date: "2026-05-02",
  checkedInAt: "2026-05-02T08:00:00",
  checkedOutAt: "2026-05-02T08:40:00",
  geoStatus: null,
  checkinDistance: null,
  actualMinutes: 40,
  scheduleDurationMinutes: 60,
  validationReason: null,
  hourlyRate: 5000,
  kind: "short_hours" as const,
  kinds: ["short_hours" as const],
  slotLabel: "8h-9h",
  roomName: "Salle B2",
  ...overrides,
})

const makeEndScanTeacher = (overrides = {}) => ({
  teacherId: "t-3",
  teacherName: "M. Diallo",
  missingEndScanCount: 1,
  warningCount: 0,
  sanctionCount: 0,
  sessions: [
    {
      date: "2026-05-03",
      scheduleId: "sch-1",
      attendanceId: "att-3",
      subject: "Sciences",
      timeSlot: "10h-11h",
      roomName: "Salle C3",
      endScanAction: null,
      endScanActionReason: null,
      endScanActionAt: null,
      endScanActionCancelledAt: null,
    },
  ],
  ...overrides,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const clickTab = (name: RegExp) => {
  const tab = screen.getByRole("tab", { name })
  fireEvent.mouseDown(tab)
  fireEvent.click(tab)
}

// ── Wrapper ───────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
    }
  >
    {children}
  </QueryClientProvider>
)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ValidationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMissingEndScansMock.mockResolvedValue([])
  })

  // ── Rendu initial ─────────────────────────────────────────────────────────

  describe("rendu initial", () => {
    it("affiche le titre et les onglets", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)

      render(<ValidationsPage />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText("Validation des horaires")).toBeInTheDocument()
      })
      expect(screen.getByText(/Présences suspectes/)).toBeInTheDocument()
      expect(screen.getByText(/Heures à valider/)).toBeInTheDocument()
      expect(screen.getByText(/Scan de fin/)).toBeInTheDocument()
    })

    it("affiche l'état vide pour les présences suspectes", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)

      render(<ValidationsPage />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText("Aucune présence suspecte")).toBeInTheDocument()
      })
    })
  })

  // ── Onglet présences suspectes ────────────────────────────────────────────

  describe("onglet présences suspectes (GPS)", () => {
    it("affiche les colonnes Créneau et Salle", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [makeGpsItem()],
        short_hours: [],
      })

      render(<ValidationsPage />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText("Créneau")).toBeInTheDocument()
        expect(screen.getByText("Salle")).toBeInTheDocument()
        expect(screen.getByText("8h-9h")).toBeInTheDocument()
        expect(screen.getByText("Salle A1")).toBeInTheDocument()
      })
    })

    it("ouvre la modale de confirmation au clic Valider", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [makeGpsItem()],
        short_hours: [],
      })
      
      render(<ValidationsPage />, { wrapper })

      await waitFor(() => screen.getByText("Valider"))
      fireEvent.click(screen.getByRole("button", { name: /valider/i }))

      expect(screen.getByText(/valider la présence de M\. Koné/i)).toBeInTheDocument()
    })

    it("ouvre la modale de refus au clic Absent", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [makeGpsItem()],
        short_hours: [],
      })
      
      render(<ValidationsPage />, { wrapper })

      await waitFor(() => screen.getByText("Absent"))
      fireEvent.click(screen.getByRole("button", { name: /absent/i }))

      expect(screen.getByText(/refuser la présence de M\. Koné/i)).toBeInTheDocument()
    })
  })

  // ── Onglet heures courtes ─────────────────────────────────────────────────

  describe("onglet heures à valider (short hours)", () => {
    it("affiche les colonnes Créneau et Salle", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [],
        short_hours: [makeShortHoursItem()],
      })
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/heures à valider/i)

      await waitFor(() => {
        expect(screen.getByText("Salle B2")).toBeInTheDocument()
      })
    })

    it("ouvre la modale de confirmation pour Accorder les heures planifiées", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [],
        short_hours: [makeShortHoursItem()],
      })
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/heures à valider/i)

      await waitFor(() => screen.getAllByRole("button", { name: /accorder 1h/i }))
      fireEvent.click(screen.getAllByRole("button", { name: /accorder 1h/i })[0]!)

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByText(/confirmer l'accord d'heures/i)).toBeInTheDocument()
      })
    })
  })

  // ── Onglet scan de fin ────────────────────────────────────────────────────

  describe("onglet scan de fin", () => {
    it("affiche les compteurs avertissements/sanctions du prof", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([
        makeEndScanTeacher({ warningCount: 2, sanctionCount: 1 }),
      ])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)

      await waitFor(() => {
        expect(screen.getByText(/2 avertissements/i)).toBeInTheDocument()
        expect(screen.getByText(/1 sanction/i)).toBeInTheDocument()
      })
    })

    it("affiche les boutons Tolérer et Sanctionner quand aucune action", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([makeEndScanTeacher()])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getByText("M. Diallo"))
      fireEvent.click(screen.getByText("M. Diallo"))

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /tolérer avec avertissement/i })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /sanctionner/i })).toBeInTheDocument()
      })
    })

    it("ouvre la modale Avertir avec le bon contexte", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([makeEndScanTeacher()])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getByText("M. Diallo"))
      fireEvent.click(screen.getByText("M. Diallo"))
      await waitFor(() => screen.getByRole("button", { name: /tolérer avec avertissement/i }))
      fireEvent.click(screen.getByRole("button", { name: /tolérer avec avertissement/i }))

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByText(/salaire.*intact/i)).toBeInTheDocument()
      })
    })

    it("ouvre la modale Sanctionner avec avertissement rouge", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([makeEndScanTeacher()])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getByText("M. Diallo"))
      fireEvent.click(screen.getByText("M. Diallo"))
      await waitFor(() => screen.getByRole("button", { name: /sanctionner/i }))
      fireEvent.click(screen.getByRole("button", { name: /sanctionner/i }))

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByText(/ne sera pas comptabilisé/i)).toBeInTheDocument()
      })
    })

    it("affiche le badge Averti et cache les boutons quand action=warned", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([
        makeEndScanTeacher({
          sessions: [
            {
              date: "2026-05-03",
              scheduleId: "sch-1",
              attendanceId: "att-3",
              subject: "Sciences",
              timeSlot: "10h-11h",
              roomName: "Salle C3",
              endScanAction: "warned",
              endScanActionReason: "Oublié",
              endScanActionAt: "2026-05-03T12:00:00",
              endScanActionCancelledAt: null,
            },
          ],
        }),
      ])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getByText("M. Diallo"))
      fireEvent.click(screen.getByText("M. Diallo"))

      await waitFor(() => {
        expect(screen.getByText("Averti")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /tolérer/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /sanctionner/i })).not.toBeInTheDocument()
      })
    })

    it("affiche le bouton Annuler la sanction quand action=sanctioned", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([
        makeEndScanTeacher({
          sessions: [
            {
              date: "2026-05-03",
              scheduleId: "sch-1",
              attendanceId: "att-3",
              subject: "Sciences",
              timeSlot: "10h-11h",
              roomName: "Salle C3",
              endScanAction: "sanctioned",
              endScanActionReason: "Absent",
              endScanActionAt: "2026-05-03T12:00:00",
              endScanActionCancelledAt: null,
            },
          ],
        }),
      ])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getByText("M. Diallo"))
      fireEvent.click(screen.getByText("M. Diallo"))

      await waitFor(() => {
        expect(screen.getByText("Sanctionné")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /annuler la sanction/i })).toBeInTheDocument()
      })
    })

    it("affiche le badge Sanction annulée quand cancelledAt renseigné", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([
        makeEndScanTeacher({
          sessions: [
            {
              date: "2026-05-03",
              scheduleId: "sch-1",
              attendanceId: "att-3",
              subject: "Sciences",
              timeSlot: "10h-11h",
              roomName: null,
              endScanAction: "sanctioned",
              endScanActionReason: "Absent",
              endScanActionAt: "2026-05-03T12:00:00",
              endScanActionCancelledAt: "2026-05-04T09:00:00",
            },
          ],
        }),
      ])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getByText("M. Diallo"))
      fireEvent.click(screen.getByText("M. Diallo"))

      await waitFor(() => {
        expect(screen.getByText("Sanction annulée")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /annuler la sanction/i })).not.toBeInTheDocument()
      })
    })
  })
})
