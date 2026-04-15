import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getTodayAttendanceMock = vi.fn()
const getAttendanceHistoryMock = vi.fn()
const getSMSLogMock = vi.fn()
const getQRAlertsMock = vi.fn()
const fetchSchoolInfoMock = vi.fn()

let isOnlineMock = true

vi.mock("@/modules/dashboard/dashboard.api", () => {
  return {
    getTodayAttendance: () => getTodayAttendanceMock(),
    getAttendanceHistory: (days: number) => getAttendanceHistoryMock(days),
    getSMSLog: (limit: number) => getSMSLogMock(limit),
    getQRAlerts: (limit: number) => getQRAlertsMock(limit),
  }
})

vi.mock("@/modules/onboarding/onboarding.api", () => {
  return {
    fetchSchoolInfo: () => fetchSchoolInfoMock(),
  }
})

vi.mock("@/shared/hooks/useNetworkStatus", () => {
  return {
    useNetworkStatus: () => ({ isOnline: isOnlineMock, wasOffline: !isOnlineMock }),
  }
})

vi.mock("@/modules/dashboard/components/PresenceChart", () => {
  return {
    default: () => <div>Mock Presence Chart</div>,
  }
})

import DashboardPage from "@/modules/dashboard/DashboardPage"
import { useAuthStore } from "@/shared/store/auth.store"

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isOnlineMock = true

    useAuthStore.setState({
      user: {
        id: "user-1",
        name: "Directeur Test",
        role: "director",
        phone: null,
        email: "director@example.com",
        tenantId: "tenant-1",
        schemaName: "school_sainte_marie",
        plan: "standard",
      },
      accessToken: null,
    })

    getTodayAttendanceMock.mockResolvedValue({
      date: "2026-04-14",
      presentCount: 5,
      absentCount: 1,
      unmarkedCount: 2,
      courses: [
        {
          id: "course-1",
          subject: "Maths",
          className: "6A",
          roomName: "Salle A1",
          slotLabel: "08:00-09:00",
          startTime: "08:00",
          endTime: "09:00",
          status: "present",
          lateMinutes: 0,
          roomMismatch: false,
          roomScannedName: "Salle A1",
          checkedInAt: "2026-04-14T08:00:00.000Z",
        },
      ],
    })

    getAttendanceHistoryMock.mockResolvedValue([
      { date: "2026-04-10", presentCount: 8, totalCount: 10, attendanceRate: 80 },
    ])

    getSMSLogMock.mockResolvedValue([
      {
        id: "sms-1",
        type: "teacher_late_director",
        recipientPhone: "2250700000000",
        message: "SMS test",
        status: "sent",
        sentAt: "2026-04-14T08:10:00.000Z",
        createdAt: null,
      },
    ])

    getQRAlertsMock.mockResolvedValue([
      {
        id: "qr-1",
        type: "teacher_qr_mismatch",
        status: "sent",
        message:
          "EduTrack: M. Diallo a scanné salle B2 au lieu de A1 - Mathématiques 08:00-09:00",
        dateTime: new Date().toISOString(),
        teacherName: "M. Diallo",
        subject: "Mathématiques",
        className: null,
        expectedRoom: "A1",
        scannedRoom: "B2",
        slotLabel: "08:00-09:00",
        isToday: true,
      },
    ])

    fetchSchoolInfoMock.mockResolvedValue({ name: "École Sainte Marie" })
  })

  it("renders dashboard data and opens course detail modal", async () => {
    const view = renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Tableau de bord")).toBeInTheDocument()
    expect(screen.getByText("École Sainte Marie")).toBeInTheDocument()
    expect(screen.getByText("Présents")).toBeInTheDocument()
    expect(screen.getByText("Maths")).toBeInTheDocument()
    expect(view.container.querySelector("section.md\\:grid-cols-2")).toBeTruthy()
    expect(screen.getByText("Alertes QR")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Maths/i }))

    expect(await screen.findByText("Scan salle")).toBeInTheDocument()
    expect(screen.getByText("Mismatch salle")).toBeInTheDocument()
  })

  it("refresh button triggers dashboard refetch", async () => {
    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Tableau de bord")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }))

    await waitFor(() => {
      expect(getTodayAttendanceMock).toHaveBeenCalledTimes(2)
      expect(getAttendanceHistoryMock).toHaveBeenCalledTimes(2)
      expect(getSMSLogMock).toHaveBeenCalledTimes(2)
      expect(getQRAlertsMock).toHaveBeenCalledTimes(2)
    })
  })

  it("shows cached data badge while offline", async () => {
    isOnlineMock = false

    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText("Tableau de bord")).toBeInTheDocument()
    expect(screen.getByText(/Données mises en cache il y a/i)).toBeInTheDocument()
  })
})
