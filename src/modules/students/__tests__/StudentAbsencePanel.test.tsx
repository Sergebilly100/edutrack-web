import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import StudentAbsencePanel from "@/modules/students/components/StudentAbsencePanel"

vi.mock("@/modules/students/hooks/useStudentAbsences", () => ({
  useStudentAbsences: () => ({
    queryEnabled: true,
    formValues: {
      from: "2026-05-01",
      to: "2026-05-31",
      class_id: "all",
      subject: "",
      sms_status: "all",
      min_absences: 1,
    },
    setFormValues: vi.fn(),
    filters: {
      from: "2026-05-01",
      to: "2026-05-31",
      minAbsences: 1,
    },
    classesQuery: { data: [] },
    subjectsOptions: [],
    statsQuery: {
      isLoading: false,
      isError: false,
      data: [
        {
          studentId: "stu-1",
          studentName: "Bamba Mariam",
          className: "3ème A",
          classId: "cls-1",
          parentPhone: "2250701234567",
          parentPhone2: null,
          absenceCount: 3,
          excusedCount: 0,
          totalScheduled: 20,
          absenceRate: 15,
          smsSummary: "all_sent",
        },
        {
          studentId: "stu-2",
          studentName: "Koné Ahmed",
          className: "3ème B",
          classId: "cls-2",
          parentPhone: null,
          parentPhone2: null,
          absenceCount: 5,
          excusedCount: 0,
          totalScheduled: 20,
          absenceRate: 25,
          smsSummary: "none",
        },
      ],
    },
    handleApply: vi.fn(),
    handleReset: vi.fn(),
  }),
}))

vi.mock("@/modules/students/components/StudentAbsenceDetail", () => ({
  default: () => null,
}))

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
  </MemoryRouter>
)

describe("StudentAbsencePanel", () => {
  // Les vues mobile (lg:hidden) et desktop (lg:block) sont toutes deux rendues
  // sous jsdom (les media queries Tailwind n'ont pas d'effet) : on utilise donc
  // getAllByText et on vérifie qu'au moins une occurrence est présente.
  it("affiche les élèves avec leurs statistiques d'absence", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getAllByText("Bamba Mariam").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Koné Ahmed").length).toBeGreaterThan(0)
  })

  it("affiche le badge SMS correct", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getAllByText("Notifié").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Non notifié").length).toBeGreaterThan(0)
  })

  it("affiche le bouton Export CSV quand il y a des résultats", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument()
  })

  it("affiche le taux d'absence avec formatage", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getAllByText("15.00% (3/20)").length).toBeGreaterThan(0)
    expect(screen.getAllByText("25.00% (5/20)").length).toBeGreaterThan(0)
  })

  it("affiche le numéro de téléphone parent", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getAllByText("+2250701234567").length).toBeGreaterThan(0)
  })

  it("ouvre le détail d'absence au clic sur Voir détail", () => {
    render(<StudentAbsencePanel />, { wrapper })

    const buttons = screen.getAllByRole("button", { name: "Voir détail" })
    expect(buttons.length).toBeGreaterThan(0)
    fireEvent.click(buttons[0]!)
  })
})
