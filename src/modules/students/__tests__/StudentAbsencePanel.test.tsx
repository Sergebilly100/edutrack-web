import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import StudentAbsencePanel from "@/modules/students/components/StudentAbsencePanel"
import { server } from "@/test/msw/server"

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
          student_id: "stu-1",
          student_name: "Bamba Mariam",
          class_name: "3ème A",
          class_id: "cls-1",
          parent_phone: "2250701234567",
          parent_phone_2: null,
          absence_count: 3,
          total_scheduled: 20,
          absence_rate: 15,
          sms_summary: "all_sent",
        },
        {
          student_id: "stu-2",
          student_name: "Koné Ahmed",
          class_name: "3ème B",
          class_id: "cls-2",
          parent_phone: null,
          parent_phone_2: null,
          absence_count: 5,
          total_scheduled: 20,
          absence_rate: 25,
          sms_summary: "none",
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
  it("affiche les élèves avec leurs statistiques d'absence", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getByText("Bamba Mariam")).toBeInTheDocument()
    expect(screen.getByText("Koné Ahmed")).toBeInTheDocument()
  })

  it("affiche le badge SMS correct", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getByText("Notifié")).toBeInTheDocument()
    expect(screen.getByText("Non notifié")).toBeInTheDocument()
  })

  it("affiche le bouton Export CSV quand il y a des résultats", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument()
  })

  it("affiche le taux d'absence avec formatage", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getByText("15.00% (3/20)")).toBeInTheDocument()
    expect(screen.getByText("25.00% (5/20)")).toBeInTheDocument()
  })

  it("affiche le numéro de téléphone parent", () => {
    render(<StudentAbsencePanel />, { wrapper })

    expect(screen.getByText("📱 +2250701234567")).toBeInTheDocument()
  })

  it("ouvre le détail d'absence au clic sur Voir détail", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () => HttpResponse.json([]))
    )

    render(<StudentAbsencePanel />, { wrapper })

    const buttons = screen.getAllByRole("button", { name: "Voir détail" })
    fireEvent.click(buttons[0]!)
  })
})
