import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import TeacherCheckInFlow from "@/modules/attendance/components/TeacherCheckInFlow"
import CourseCard from "@/modules/attendance/components/CourseCard"
import { teacherScheduleApi, type ScheduleSlot, type TeacherAttendance } from "@/modules/attendance/attendance.api"
import { useRollCallStore } from "@/shared/store/rollCall.store"

vi.mock("@/modules/attendance/QRScanner", () => ({
  default: ({ onTokenDetected }: { onTokenDetected: (token: string) => void }) => (
    <button type="button" onClick={() => onTokenDetected("room-token")}>Confirmer la salle</button>
  ),
}))

vi.mock("@/shared/utils/indexedDB", () => ({ getRoomByToken: vi.fn().mockResolvedValue(null) }))
vi.mock("@/shared/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => ({ isOnline: true }) }))
vi.mock("@/shared/hooks/useStudentLabel", () => ({
  useStudentLabels: () => ({ singularLower: "élève", pluralLower: "élèves" }),
}))

vi.mock("@/modules/attendance/attendance.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/attendance/attendance.api")>("@/modules/attendance/attendance.api")
  return {
    ...actual,
    teacherScheduleApi: {
      checkIn: vi.fn(), scanQr: vi.fn(), skipQr: vi.fn(),
      getTeacherAttendancePolicy: vi.fn(), getMyAttendanceForDate: vi.fn(),
      getStudentsByClass: vi.fn(), getStudentRollCall: vi.fn(),
      submitStudentAttendance: vi.fn(), checkOut: vi.fn(),
    },
  }
})

const slot: ScheduleSlot = {
  id: "schedule-1", class_id: "class-1", class_name: "6ème A",
  subject_name: "Mathématiques", room_id: "room-1", room_name: "Salle 1",
  day_of_week: 2, start_time: "00:00", end_time: "23:59", date: new Date().toISOString().slice(0, 10),
}

function PresenceStatus() {
  const attendance = useQuery({
    queryKey: ["teacher-attendance", slot.date],
    queryFn: () => teacherScheduleApi.getMyAttendanceForDate(slot.date!),
    staleTime: 5 * 60_000,
  })
  return (
    <>
      <span data-testid="presence-status">{attendance.data?.[0]?.validation_status ?? "absente"}</span>
      <CourseCard slot={slot} attendance={attendance.data?.[0]} onStartCourse={vi.fn()} onAddSpontaneousGrade={vi.fn()} />
    </>
  )
}

describe("TeacherCheckInFlow présence confirmée", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRollCallStore.setState({ flows: {}, startScans: {} })
    vi.mocked(teacherScheduleApi.getTeacherAttendancePolicy).mockResolvedValue({
      allow_teacher_qr_skip: false, geo_check_enabled: false,
    } as Awaited<ReturnType<typeof teacherScheduleApi.getTeacherAttendancePolicy>>)
    vi.mocked(teacherScheduleApi.checkIn).mockResolvedValue({ late_minutes: null, geo_status: "not_checked" })
    vi.mocked(teacherScheduleApi.scanQr).mockResolvedValue({ room_mismatch: false } as Awaited<ReturnType<typeof teacherScheduleApi.scanQr>>)
    vi.mocked(teacherScheduleApi.getStudentsByClass).mockResolvedValue([])
    vi.mocked(teacherScheduleApi.getStudentRollCall).mockResolvedValue([])
  })

  it("rafraîchit la présence juste après le QR, sans attendre l’appel des élèves", async () => {
    const confirmed: TeacherAttendance = {
      schedule_id: slot.id, status: "present", date: slot.date,
      checked_in_at: new Date().toISOString(), validation_status: "not_required",
    }
    vi.mocked(teacherScheduleApi.getMyAttendanceForDate)
      .mockResolvedValueOnce([])
      .mockResolvedValue([confirmed])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <PresenceStatus />
        <TeacherCheckInFlow open slot={slot} onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(await screen.findByTestId("presence-status")).toHaveTextContent("absente")
    expect(screen.queryByTestId("teacher-spontaneous-grade-schedule-1")).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("teacher-checkin-submit"))
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer la salle" }))

    await waitFor(() => expect(screen.getByTestId("presence-status")).toHaveTextContent("not_required"))
    expect(screen.getByTestId("teacher-spontaneous-grade-schedule-1")).toBeInTheDocument()
    expect(teacherScheduleApi.getMyAttendanceForDate).toHaveBeenCalledTimes(2)
    expect(teacherScheduleApi.submitStudentAttendance).not.toHaveBeenCalled()
  })

  it("rafraîchit aussi la présence quand le QR est dispensé", async () => {
    vi.mocked(teacherScheduleApi.getTeacherAttendancePolicy).mockResolvedValue({
      allow_teacher_qr_skip: true, geo_check_enabled: false,
    } as Awaited<ReturnType<typeof teacherScheduleApi.getTeacherAttendancePolicy>>)
    vi.mocked(teacherScheduleApi.skipQr).mockResolvedValue({ success: true })
    vi.mocked(teacherScheduleApi.getMyAttendanceForDate)
      .mockResolvedValueOnce([])
      .mockResolvedValue([{
        schedule_id: slot.id, status: "present", date: slot.date,
        checked_in_at: new Date().toISOString(), validation_status: "not_required",
      }])

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PresenceStatus />
        <TeacherCheckInFlow open slot={slot} onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(await screen.findByTestId("presence-status")).toHaveTextContent("absente")
    fireEvent.click(screen.getByTestId("teacher-checkin-submit"))
    fireEvent.click(await screen.findByTestId("teacher-checkin-skip-qr"))

    await waitFor(() => expect(screen.getByTestId("teacher-spontaneous-grade-schedule-1")).toBeInTheDocument())
    expect(teacherScheduleApi.submitStudentAttendance).not.toHaveBeenCalled()
  })
})
