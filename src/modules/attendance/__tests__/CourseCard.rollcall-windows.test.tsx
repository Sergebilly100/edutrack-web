import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
}

const renderCard = (overrides?: Partial<TeacherAttendance>, onEditRollCall?: (slot: ScheduleSlot) => void) =>
  render(
    <CourseCard
      slot={slot}
      attendance={{ ...attendance, ...overrides }}
      onStartCourse={vi.fn()}
      onEditRollCall={onEditRollCall}
    />
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
})
