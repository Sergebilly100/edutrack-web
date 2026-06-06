import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import StudentAbsenceDetail from "@/modules/students/components/StudentAbsenceDetail"
import type { StudentAbsenceStat } from "@/modules/students/students.api"
import { server } from "@/test/msw/server"

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: vi.fn(() => ({ hasPermission: () => false })),
}))

import { usePermissions } from "@/shared/hooks/usePermissions"

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

const student: StudentAbsenceStat = {
  studentId: "stu-1",
  studentName: "Bamba Mariam",
  className: "3ème A",
  classId: "cls-1",
  parentPhone: "2250701234567",
  parentPhone2: null,
  absenceCount: 2,
  excusedCount: 0,
  totalScheduled: 20,
  absenceRate: 10,
  smsSummary: "all_sent",
}

const baseAbsence = {
  id: "att-1",
  date: "2026-05-05",
  subject: "Maths",
  className: "3ème A",
  startTime: "07:30:00",
  endTime: "09:00:00",
  status: "absent",
  excuseReason: null,
  smsPhone1: { phone: "2250701234567", status: "sent", sentAt: "2026-05-05T08:00:00.000Z" },
  smsPhone2: { phone: null, status: "not_sent", sentAt: null },
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
)

describe("StudentAbsenceDetail", () => {
  it("affiche les absences de l'élève avec date et matière", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([baseAbsence])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("05/05/2026 - Maths")
    expect(screen.getByText("07:30–09:00")).toBeInTheDocument()
  })

  it("affiche le badge SMS Notifié quand le SMS est envoyé", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([baseAbsence])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("05/05/2026 - Maths")
    expect(screen.getByText("Notifié")).toBeInTheDocument()
  })

  it("affiche le numéro de téléphone du parent", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([baseAbsence])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("2250701234567")
  })

  it("affiche EmptyState si aucune absence", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () => HttpResponse.json([]))
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("Aucune absence")
  })

  it("affiche le nom de l'élève dans le titre", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () => HttpResponse.json([]))
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    expect(screen.getByText("Absences de Bamba Mariam")).toBeInTheDocument()
  })

  it("affiche le badge Absent pour une absence non excusée", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([baseAbsence])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("05/05/2026 - Maths")
    expect(screen.getByText("Absent")).toBeInTheDocument()
  })

  it("affiche le badge Excusé pour une absence excusée", async () => {
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([{ ...baseAbsence, status: "excused", excuseReason: "Maladie" }])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("05/05/2026 - Maths")
    expect(screen.getByText("Excusé")).toBeInTheDocument()
    expect(screen.getByText("Motif : Maladie")).toBeInTheDocument()
  })

  it("n'affiche pas le bouton Excuser sans la permission students.excuse", async () => {
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: () => false, refreshPermissions: vi.fn() })
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([baseAbsence])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("05/05/2026 - Maths")
    expect(screen.queryByRole("button", { name: "Excuser" })).not.toBeInTheDocument()
  })

  it("affiche le bouton Excuser avec la permission students.excuse sur une absence non excusée", async () => {
    vi.mocked(usePermissions).mockReturnValue({
      hasPermission: (key: string) => key === "students.excuse",
      refreshPermissions: vi.fn(),
    })
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([baseAbsence])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("05/05/2026 - Maths")
    expect(screen.getByRole("button", { name: "Excuser" })).toBeInTheDocument()
  })

  it("n'affiche pas le bouton Excuser sur une absence déjà excusée", async () => {
    vi.mocked(usePermissions).mockReturnValue({
      hasPermission: (key: string) => key === "students.excuse",
      refreshPermissions: vi.fn(),
    })
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([{ ...baseAbsence, status: "excused", excuseReason: "Maladie" }])
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByText("05/05/2026 - Maths")
    expect(screen.queryByRole("button", { name: "Excuser" })).not.toBeInTheDocument()
  })

  it("ouvre la dialog Excuser et envoie le motif au clic sur Confirmer", async () => {
    vi.mocked(usePermissions).mockReturnValue({
      hasPermission: (key: string) => key === "students.excuse",
      refreshPermissions: vi.fn(),
    })
    server.use(
      http.get("*/students/stu-1/absences", () =>
        HttpResponse.json([baseAbsence])
      ),
      http.patch("*/students/absences/att-1/excuse", () =>
        HttpResponse.json({ data: { id: "att-1", status: "excused", excuseReason: "Maladie" } })
      )
    )

    render(
      <StudentAbsenceDetail
        open
        onOpenChange={vi.fn()}
        student={student}
        from="2026-05-01"
        to="2026-05-31"
      />,
      { wrapper }
    )

    await screen.findByRole("button", { name: "Excuser" })
    fireEvent.click(screen.getByRole("button", { name: "Excuser" }))

    expect(await screen.findByText("Excuser l'absence")).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText("Motif de l'excuse…")
    fireEvent.change(textarea, { target: { value: "Maladie" } })

    const confirmBtn = screen.getByRole("button", { name: "Confirmer" })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)

    await waitFor(() =>
      expect(screen.queryByText("Excuser l'absence")).not.toBeInTheDocument()
    )
  })
})
