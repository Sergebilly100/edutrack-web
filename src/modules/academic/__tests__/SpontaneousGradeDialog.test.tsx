import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SpontaneousGradeDialog } from "@/modules/academic/components/SpontaneousGradeDialog"
import { createSpontaneousGrade, fetchEntryPeriod, fetchEvaluationsScope } from "@/modules/academic/academic.api"
import type { ScheduleSlot, TeacherAttendance } from "@/modules/attendance/attendance.api"
import { listStudents } from "@/modules/students/students.api"

vi.mock("@/modules/academic/academic.api", () => ({
  createSpontaneousGrade: vi.fn(),
  fetchEntryPeriod: vi.fn(),
  fetchEvaluationsScope: vi.fn(),
}))
vi.mock("@/modules/students/students.api", () => ({ listStudents: vi.fn() }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

const slot: ScheduleSlot = {
  id: "slot-1", class_id: "class-1", class_name: "6ème A",
  subject_name: "Mathématiques", subject_id: "subject-1",
  room_id: "room-1", room_name: "Salle 1", day_of_week: 2,
  start_time: "08:00", end_time: "09:00", date: "2026-10-13",
}
const attendance: TeacherAttendance = {
  schedule_id: slot.id, status: "present", date: slot.date,
  checked_in_at: "2026-10-13T08:00:00.000Z", validation_status: "not_required",
  student_rollcall_done: false,
}

const renderDialog = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SpontaneousGradeDialog open slot={slot} attendance={attendance} onOpenChange={vi.fn()} />
  </QueryClientProvider>,
)

describe("SpontaneousGradeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLElement.prototype.scrollIntoView = vi.fn()
    vi.mocked(fetchEntryPeriod).mockResolvedValue({
      period: { id: "period-1" } as Awaited<ReturnType<typeof fetchEntryPeriod>>["period"],
      state: "open", code: null,
    })
    vi.mocked(listStudents).mockResolvedValue({
      data: [{ id: "student-1", firstName: "Awa", lastName: "Koné" }],
    } as Awaited<ReturnType<typeof listStudents>>)
  })

  it("charge la matière du créneau et les élèves sans appel des élèves", async () => {
    renderDialog()

    await waitFor(() => expect(listStudents).toHaveBeenCalledWith({ classId: "class-1", isActive: true, limit: 100 }))
    expect(fetchEntryPeriod).toHaveBeenCalledWith("class-1", "2026-10-13")
    expect(fetchEvaluationsScope).not.toHaveBeenCalled()
    expect(screen.queryByText(/Impossible de vérifier ce cours ou ses élèves/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ajouter un point" })).toBeEnabled()
    fireEvent.click(screen.getByRole("combobox", { name: "Élève" }))
    fireEvent.click(await screen.findByRole("option", { name: "Awa Koné" }))
    fireEvent.change(screen.getByLabelText("Justificatif"), { target: { value: "Participation" } })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un point" }))
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(createSpontaneousGrade).toHaveBeenCalledWith(expect.objectContaining({
      lessonSlotId: "slot-1", subjectId: "subject-1", studentId: "student-1", adjustment: 1,
    })))
  })
})
