import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import CourseCard from "@/modules/attendance/components/CourseCard"
import type { ScheduleSlot, TeacherAttendance } from "@/modules/attendance/attendance.api"

let flowState: string | null = null
const markReadyToFinishWithoutRollCall = vi.fn()

vi.mock("@/shared/store/rollCall.store", () => ({
  useRollCallStore: (selector: (state: {
    getFlowState: () => string | null
    markReadyToFinishWithoutRollCall: typeof markReadyToFinishWithoutRollCall
  }) => unknown) =>
    selector({
      getFlowState: () => flowState,
      markReadyToFinishWithoutRollCall,
    }),
}))

vi.mock("@/shared/hooks/useStudentLabel", () => ({
  useStudentLabels: () => ({
    pluralLower: "élèves",
    singularLower: "élève",
  }),
}))

const slot: ScheduleSlot = {
  id: "schedule-1",
  class_id: "class-1",
  class_name: "6ème A",
  subject_name: "Maths",
  room_id: "room-1",
  room_name: "Salle A1",
  day_of_week: 2,
  start_time: "08:00",
  end_time: "09:00",
  date: "2026-06-09",
}

const attendance: TeacherAttendance = {
  schedule_id: "schedule-1",
  status: "present",
  date: "2026-06-09",
  checked_in_at: "2026-06-09T08:00:00.000Z",
  validation_status: "not_required",
}

const renderCard = (overrides?: Partial<TeacherAttendance>, onEditRollCall?: (slot: ScheduleSlot) => void) =>
  render(
    <MemoryRouter>
      <CourseCard
        slot={slot}
        attendance={{ ...attendance, ...overrides }}
        onStartCourse={vi.fn()}
        onEditRollCall={onEditRollCall}
      />
    </MemoryRouter>
  )

describe("CourseCard rollcall windows", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    flowState = "rollcall_pending"
    markReadyToFinishWithoutRollCall.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("affiche encore le bouton de pointage pendant les 15 min de grâce", () => {
    vi.setSystemTime(new Date("2026-06-09T09:10:00"))

    renderCard()

    expect(screen.getByTestId("teacher-rollcall-schedule-1")).toBeInTheDocument()
    expect(screen.queryByTestId("teacher-finish-without-rollcall-schedule-1")).not.toBeInTheDocument()
  })

  it("affiche la clôture sans pointage après les notifications et avant fin + 30", () => {
    vi.setSystemTime(new Date("2026-06-09T09:21:00"))

    renderCard()

    expect(screen.queryByTestId("teacher-rollcall-schedule-1")).not.toBeInTheDocument()
    expect(screen.getByTestId("teacher-finish-without-rollcall-schedule-1")).toBeInTheDocument()
  })

  it("masque le badge incomplet si l'appel est déjà enregistré côté serveur", () => {
    flowState = "checkin_qr_done"
    vi.setSystemTime(new Date("2026-06-09T09:10:00"))

    renderCard({ student_rollcall_done: true })

    expect(screen.queryByText("Pointage incomplet")).not.toBeInTheDocument()
    expect(screen.queryByTestId("teacher-resume-course-schedule-1")).not.toBeInTheDocument()
  })

  it("masque Modifier l'appel quand le cours est clôturé", () => {
    flowState = null
    vi.setSystemTime(new Date("2026-06-09T08:45:00"))

    renderCard(
      { student_rollcall_done: true, checked_out_at: "2026-06-09T09:00:00.000Z" },
      vi.fn()
    )

    expect(screen.queryByTestId("teacher-edit-rollcall-schedule-1")).not.toBeInTheDocument()
  })

  it("ouvre la note spontanée directement depuis le créneau pendant le cours", () => {
    flowState = "checkin_qr_done"
    vi.setSystemTime(new Date("2026-06-09T08:30:00"))
    const onAddSpontaneousGrade = vi.fn()

    render(
      <MemoryRouter>
        <CourseCard
          slot={slot}
          attendance={attendance}
          onStartCourse={vi.fn()}
          onAddSpontaneousGrade={onAddSpontaneousGrade}
        />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "Note spontanée" }))
    expect(onAddSpontaneousGrade).toHaveBeenCalledWith(slot)
  })

  it("masque la note spontanée plus de 24 h après la fin du cours", () => {
    flowState = "checkin_qr_done"
    vi.setSystemTime(new Date("2026-06-10T09:01:00"))

    render(
      <MemoryRouter>
        <CourseCard slot={slot} attendance={attendance} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.queryByRole("button", { name: "Note spontanée" })).not.toBeInTheDocument()
    expect(screen.getByText(/fenêtre de note spontanée est expirée/)).toBeInTheDocument()
  })

  it.each([
    ["non pointé", null, undefined, false],
    ["professeur absent", null, { ...attendance, status: "absent" as const, checked_in_at: null }, false],
    ["validation en attente", null, { ...attendance, validation_status: "pending" as const }, false],
    ["validation rejetée", null, { ...attendance, validation_status: "rejected" as const }, false],
    ["présence validée automatiquement", null, attendance, true],
    ["présence validée manuellement", null, { ...attendance, validation_status: "approved" as const }, true],
    ["appel reporté", "rollcall_pending", attendance, true],
    ["appel achevé", "ready_to_finish", { ...attendance, student_rollcall_done: true }, true],
    ["cours clôturé", null, { ...attendance, checked_out_at: "2026-06-09T09:00:00.000Z" }, true],
  ])("montre la note spontanée sur un cours %s", (_label, state, teacherAttendance, enabled) => {
    flowState = state
    vi.setSystemTime(new Date("2026-06-09T08:30:00"))
    render(<MemoryRouter><CourseCard slot={slot} attendance={teacherAttendance} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} /></MemoryRouter>)
    if (enabled) expect(screen.getByRole("button", { name: "Note spontanée" })).toBeEnabled()
    else expect(screen.queryByRole("button", { name: "Note spontanée" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Présence du professeur à confirmer et valider/)).not.toBeInTheDocument()
  })

  it("ne propose aucune note après un cours passé avec professeur absent", () => {
    flowState = null
    vi.setSystemTime(new Date("2026-06-09T09:10:00"))
    render(<MemoryRouter><CourseCard slot={slot} attendance={{ ...attendance, status: "absent", checked_in_at: null }} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} /></MemoryRouter>)
    expect(screen.queryByRole("button", { name: "Note spontanée" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Présence du professeur à confirmer/)).not.toBeInTheDocument()
  })

  it("respecte exactement le début et fin + 24 h, et la date sélectionnée", () => {
    flowState = null
    vi.setSystemTime(new Date("2026-06-09T07:59:59"))
    const { rerender } = render(<MemoryRouter><CourseCard slot={slot} attendance={attendance} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} /></MemoryRouter>)
    expect(screen.queryByRole("button", { name: "Note spontanée" })).not.toBeInTheDocument()
    vi.setSystemTime(new Date("2026-06-09T08:00:00"))
    rerender(<MemoryRouter><CourseCard slot={slot} attendance={attendance} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} /></MemoryRouter>)
    expect(screen.getByRole("button", { name: "Note spontanée" })).toBeEnabled()
    vi.setSystemTime(new Date("2026-06-10T09:00:00"))
    rerender(<MemoryRouter><CourseCard slot={slot} attendance={attendance} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} /></MemoryRouter>)
    expect(screen.getByRole("button", { name: "Note spontanée" })).toBeEnabled()
    rerender(<MemoryRouter><CourseCard slot={{ ...slot, date: "2026-06-08" }} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} /></MemoryRouter>)
    expect(screen.queryByRole("button", { name: "Note spontanée" })).not.toBeInTheDocument()
    rerender(<MemoryRouter><CourseCard slot={{ ...slot, date: undefined }} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} /></MemoryRouter>)
    expect(screen.queryByRole("button", { name: "Note spontanée" })).not.toBeInTheDocument()
  })
})
