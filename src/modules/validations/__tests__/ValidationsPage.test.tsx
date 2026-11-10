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
  bulkValidate: vi.fn(async () => ({ approved: 0, rejected: 0, skipped: 0, results: [] })),
  invalidateSession: vi.fn(),
  fetchValidationHistory: vi.fn(async () => ({ items: [], total: 0 })),
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
  QueryErrorState: ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
    <div role="alert">
      {message}
      <button type="button" onClick={onRetry}>Réessayer</button>
    </div>
  ),
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

const openHistoryView = () => {
  fireEvent.click(screen.getByRole("button", { name: "Historique" }))
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

      clickTab(/présences suspectes/i)

      await waitFor(() => {
        expect(screen.getByText("Tout est à jour")).toBeInTheDocument()
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

      clickTab(/présences suspectes/i)

      // Sous jsdom, les vues mobile (lg:hidden) et desktop (lg:block) sont
      // rendues toutes les deux : on utilise getAllByText et on vérifie qu'au
      // moins une occurrence existe.
      await waitFor(() => {
        expect(screen.getAllByText("Créneau").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Salle").length).toBeGreaterThan(0)
        expect(screen.getAllByText("8h-9h").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Salle A1").length).toBeGreaterThan(0)
      })
    })

    it("ouvre la modale de confirmation au clic Valider", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [makeGpsItem()],
        short_hours: [],
      })
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/présences suspectes/i)

      await waitFor(() => screen.getAllByText("Valider"))
      fireEvent.click(screen.getAllByRole("button", { name: /^valider$/i })[0]!)

      expect(screen.getByText(/valider la présence de M\. Koné/i)).toBeInTheDocument()
    })

    it("ouvre la modale de refus au clic Absent", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [makeGpsItem()],
        short_hours: [],
      })
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/présences suspectes/i)

      await waitFor(() => screen.getAllByText("Marquer absent"))
      fireEvent.click(screen.getAllByRole("button", { name: /marquer absent/i })[0]!)

      expect(screen.getByText(/refuser la présence de M\. Koné/i)).toBeInTheDocument()
    })
  })

  // ── Onglet heures courtes ─────────────────────────────────────────────────

  describe("onglet heures à valider (short hours)", () => {
    it("filtre les heures à valider par professeur", async () => {
      getPendingValidationsMock.mockResolvedValue({
        gps_suspicious: [],
        short_hours: [
          makeShortHoursItem(),
          makeShortHoursItem({ attendanceId: "att-4", teacherName: "M. Koné" }),
        ],
      })

      render(<ValidationsPage />, { wrapper })
      clickTab(/heures à valider/i)

      await waitFor(() => expect(screen.getAllByText("Mme Bah").length).toBeGreaterThan(0))
      fireEvent.change(screen.getByRole("textbox", { name: /rechercher un professeur à valider/i }), {
        target: { value: "Kone" },
      })

      expect(screen.getAllByText("M. Koné").length).toBeGreaterThan(0)
      expect(screen.queryAllByText("Mme Bah")).toHaveLength(0)
    })

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
    it("charge tous les mois et affiche par défaut les cours à traiter (les cours déjà traités sont dans l'historique)", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([
        makeEndScanTeacher({
          sessions: [
            { ...makeEndScanTeacher().sessions[0], endScanAction: null },
            { ...makeEndScanTeacher().sessions[0], attendanceId: "att-5", endScanAction: "warned" },
          ],
        }),
      ])

      render(<ValidationsPage />, { wrapper })
      clickTab(/scan de fin/i)

      await waitFor(() => expect(fetchMissingEndScansMock).toHaveBeenCalledWith())
      await waitFor(() => expect(screen.getAllByText("M. Diallo").length).toBeGreaterThan(0))
      fireEvent.click(screen.getAllByText("M. Diallo")[0]!)
      await waitFor(() => {
        expect(screen.getAllByText("Sciences")).toHaveLength(2)
      })
    })
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
      await waitFor(() => screen.getAllByText("M. Diallo"))
      fireEvent.click(screen.getAllByText("M. Diallo")[0]!)

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /tolérer avec avertissement/i }).length).toBeGreaterThan(0)
        expect(screen.getAllByRole("button", { name: /sanctionner/i }).length).toBeGreaterThan(0)
      })
    })

    it("ouvre la modale Avertir avec le bon contexte", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([makeEndScanTeacher()])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getAllByText("M. Diallo"))
      fireEvent.click(screen.getAllByText("M. Diallo")[0]!)
      await waitFor(() => screen.getAllByRole("button", { name: /tolérer avec avertissement/i }))
      fireEvent.click(screen.getAllByRole("button", { name: /tolérer avec avertissement/i })[0]!)

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByText(/message d'avertissement sera envoyé/i)).toBeInTheDocument()
      })
    })

    it("ouvre la modale Sanctionner avec avertissement rouge", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([makeEndScanTeacher()])
      
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      await waitFor(() => screen.getAllByText("M. Diallo"))
      fireEvent.click(screen.getAllByText("M. Diallo")[0]!)
      await waitFor(() => screen.getAllByRole("button", { name: /sanctionner/i }))
      fireEvent.click(screen.getAllByRole("button", { name: /sanctionner/i })[0]!)

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
      openHistoryView()
      await waitFor(() => screen.getAllByText("M. Diallo"))
      fireEvent.click(screen.getAllByText("M. Diallo")[0]!)

      await waitFor(() => {
        expect(screen.getAllByText("Averti").length).toBeGreaterThan(0)
        // Les boutons d'action par session doivent disparaître (le bouton global
        // "Tolérer tous avec un avertissement" reste, d'où des matchers stricts ici).
        expect(screen.queryAllByRole("button", { name: /^tolérer avec avertissement$/i })).toHaveLength(0)
        expect(screen.queryAllByRole("button", { name: /^sanctionner$/i })).toHaveLength(0)
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
      openHistoryView()
      await waitFor(() => screen.getAllByText("M. Diallo"))
      fireEvent.click(screen.getAllByText("M. Diallo")[0]!)

      await waitFor(() => {
        expect(screen.getAllByText("Sanctionné").length).toBeGreaterThan(0)
        expect(screen.getAllByRole("button", { name: /annuler la sanction/i }).length).toBeGreaterThan(0)
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
      openHistoryView()
      await waitFor(() => screen.getAllByText("M. Diallo"))
      fireEvent.click(screen.getAllByText("M. Diallo")[0]!)

      await waitFor(() => {
        expect(screen.getAllByText("Sanction annulée").length).toBeGreaterThan(0)
        expect(screen.queryAllByRole("button", { name: /annuler la sanction/i })).toHaveLength(0)
      })
    })
  })

  // ── État vide, compteurs, cohérence, action groupée ──────────────────────

  describe("états vides et compteurs", () => {
    it("sans donnée : un seul état vide, aucune recherche ni filtre, aucun compteur (0)", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      render(<ValidationsPage />, { wrapper })

      await waitFor(() => expect(screen.getByText("Tout est à jour")).toBeInTheDocument())
      expect(screen.getAllByText("Tout est à jour")).toHaveLength(1)
      expect(screen.queryByPlaceholderText(/rechercher/i)).not.toBeInTheDocument()
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
      expect(screen.queryByText(/\(0\)/)).not.toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "Heures à valider" })).toBeInTheDocument()
    })

    it("avec des données : « À traiter · N », recherche visible, bascule vers l'historique", async () => {
      getPendingValidationsMock.mockResolvedValue({ gps_suspicious: [], short_hours: [makeShortHoursItem()] })
      render(<ValidationsPage />, { wrapper })

      expect(await screen.findByRole("button", { name: "À traiter · 1" })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /heures à valider.*1/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Rechercher un professeur")).toBeInTheDocument()

      openHistoryView()
      await waitFor(() => expect(screen.getByText("Aucun historique")).toBeInTheDocument())
      expect(screen.queryByPlaceholderText("Rechercher un professeur")).not.toBeInTheDocument()
    })

    it("affiche une erreur avec « Réessayer » quand les validations ne se chargent pas", async () => {
      getPendingValidationsMock.mockRejectedValue(new Error("boom"))
      render(<ValidationsPage />, { wrapper })
      expect(await screen.findByText("Impossible de charger les validations en attente.")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument()
    })

    it("le panneau d'onglet ne porte pas d'anneau de focus", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      render(<ValidationsPage />, { wrapper })
      await waitFor(() => expect(screen.getByRole("tabpanel").className).toContain("focus-visible:ring-0"))
    })
  })

  describe("scan de fin : cohérence et action groupée", () => {
    const warnedOnly = makeEndScanTeacher({
      sessions: [{ ...makeEndScanTeacher().sessions[0], endScanAction: "warned", endScanActionAt: "2026-05-03T12:00:00" }],
    })

    it("tout est déjà traité : pas de compteur, pas de résumé « 1 professeur, 0 cours », pas de bouton groupé", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([warnedOnly])
      render(<ValidationsPage />, { wrapper })

      expect(screen.getByRole("tab", { name: "Scan de fin" })).toBeInTheDocument()
      clickTab(/scan de fin/i)
      await waitFor(() => expect(screen.getByText("Tout est à jour")).toBeInTheDocument())
      expect(screen.queryByText(/0 cours/)).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /tolérer tous/i })).not.toBeInTheDocument()
    })

    it("le compteur de l'onglet, le résumé et la liste comptent les mêmes cours", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      const base = makeEndScanTeacher().sessions[0]
      fetchMissingEndScansMock.mockResolvedValue([
        makeEndScanTeacher({
          sessions: [base, { ...base, attendanceId: "att-4" }, { ...base, attendanceId: "att-5", endScanAction: "warned" }],
        }),
        warnedOnly && makeEndScanTeacher({ teacherId: "t-4", teacherName: "Mme Traoré", sessions: [{ ...base, attendanceId: "att-6", endScanAction: "warned" }] }),
      ])
      render(<ValidationsPage />, { wrapper })

      expect(await screen.findByRole("tab", { name: /scan de fin.*2/i })).toBeInTheDocument()
      clickTab(/scan de fin/i)
      expect(await screen.findByText("1 professeur(s), 2 cours sans scan de fin à traiter")).toBeInTheDocument()
      expect(screen.queryByText("Mme Traoré")).not.toBeInTheDocument()
    })

    it("l'action groupée demande une confirmation détaillée avant d'agir", async () => {
      getPendingValidationsMock.mockResolvedValue(emptyGroups)
      fetchMissingEndScansMock.mockResolvedValue([makeEndScanTeacher()])
      render(<ValidationsPage />, { wrapper })

      clickTab(/scan de fin/i)
      fireEvent.click(await screen.findByRole("button", { name: "Tolérer tous avec un avertissement" }))

      const dialog = await screen.findByRole("dialog")
      expect(dialog).toHaveTextContent("1 cours sans scan de fin pour 1 professeur(s)")
      expect(dialog).toHaveTextContent("M. Diallo")
      expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Confirmer et tolérer" })).toBeInTheDocument()
    })
  })
})
