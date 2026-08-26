import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/shared/api/client", () => {
  return {
    apiClient: {
      get: getMock,
      post: postMock,
    },
  }
})

import {
  getDashboardStats,
  getDashboardActionItems,
  getAttendanceHistory,
  getQRAlerts,
  getSMSLog,
  getTodayAttendance,
  resolveDashboardActionItem,
} from "@/modules/dashboard/dashboard.api"

describe("dashboard.api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("falls back to /attendance/active when /attendance/today fails", async () => {
    getMock
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({
        data: {
          date: "2026-04-14",
          items: [
            {
              scheduleId: "sch-1",
              subject: "Maths",
              className: "6A",
              roomName: "A1",
              timeSlot: { label: "08:00-09:00", startTime: "08:00", endTime: "09:00" },
              attendance: { status: "present", lateMinutes: 0, roomMismatch: false, roomScannedName: "A1" },
            },
          ],
        },
      })

    const data = await getTodayAttendance()

    expect(getMock).toHaveBeenNthCalledWith(1, "/attendance/today")
    expect(getMock).toHaveBeenNthCalledWith(2, "/attendance/active")
    expect(data.presentCount).toBe(1)
    expect(data.absentCount).toBe(0)
    expect(data.unmarkedCount).toBe(0)
    expect(data.courses[0]?.subject).toBe("Maths")
  })

  it("normalizes history payload variants", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          { date: "2026-04-10", present_count: 8, total_count: 10 },
          { date: "2026-04-11", present: 7, total: 10, rate: 70 },
        ],
      },
    })

    const rows = await getAttendanceHistory(7)

    expect(getMock).toHaveBeenCalledWith("/attendance/history", { params: { days: 7 } })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: "2026-04-10", attendanceRate: 80 })
    expect(rows[1]).toMatchObject({ date: "2026-04-11", attendanceRate: 70 })
  })

  it("normalizes sms log payload variants", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        notifications: [
          {
            id: "notif-1",
            type: "teacher_late_director",
            recipient_phone: "2250700000000",
            message: "Test",
            status: "sent",
            sent_at: "2026-04-14T08:10:00.000Z",
          },
        ],
      },
    })

    const rows = await getSMSLog(10)

    expect(getMock).toHaveBeenCalledWith("/notifications/log", { params: { limit: 10 } })
    expect(rows[0]).toMatchObject({
      id: "notif-1",
      status: "sent",
      recipientPhone: "2250700000000",
    })
  })

  it("reads open action items and resolves them through the shared endpoint", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "d1b9a7d1-59fa-4b85-8387-000000000001",
            type: "salary_pending",
            referenceId: null,
            priority: "medium",
            message: "2 fiches à terminer",
            generatedAt: "2026-05-12T08:00:00.000Z",
          },
        ],
      },
    })
    postMock.mockResolvedValueOnce({ data: { resolved: true } })

    const items = await getDashboardActionItems()
    await resolveDashboardActionItem(items[0]!.id)

    expect(items).toEqual([
      expect.objectContaining({ type: "salary_pending", priority: "medium", referenceId: null }),
    ])
    expect(getMock).toHaveBeenCalledWith("/dashboard/action-items")
    expect(postMock).toHaveBeenCalledWith(`/dashboard/action-items/${items[0]!.id}/resolve`)
  })

  it("normalizes dashboard stats financial fields", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        teacherAttendance: {
          globalRate: "50",
          partTime: { rate: "50", present: "1", expected: "2" },
          fullTime: null,
        },
        studentAttendance: { rate: "26.7", present: "8", absent: "2", notMarked: "20", total: "30" },
        salaries: {
          monthlyTotal: "393035",
          toPayCurrentPeriod: "402500",
          totalPaid: "0",
          remainingToPay: "393035",
          economy: { label: "Du 1er au 11 mai", plannedHours: "100.5", completedHours: "80.5", savedAmount: "100000" },
        },
        subscriptions: {
          collectedAmount: "5000",
          activeSubscribers: "2",
          collectionRate: "100",
          expectedAmount: "5000",
        },
      },
    })

    const stats = await getDashboardStats("2026-05-11", "2026-05")

    expect(getMock).toHaveBeenCalledWith("/dashboard/stats", {
      params: { date: "2026-05-11", month: "2026-05" },
    })
    expect(stats.salaries.remainingToPay).toBe(393035)
    expect(stats.salaries.totalPaid).toBe(0)
    expect(stats.subscriptions.collectedAmount).toBe(5000)
    expect(stats.subscriptions.activeSubscribers).toBe(2)
  })

  it("fetches and parses qr alerts", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        notifications: [
          {
            id: "qr-1",
            type: "teacher_qr_mismatch",
            status: "sent",
            message:
              "EduTrack: M. Diallo a scanné salle B2 au lieu de A1 - Mathématiques 08:00-09:00",
            sent_at: new Date().toISOString(),
          },
        ],
      },
    })

    const alerts = await getQRAlerts(20)

    expect(getMock).toHaveBeenCalledWith("/notifications/log", {
      params: {
        types: "teacher_qr_mismatch,teacher_qr_missing_scan,teacher_qr_scan_out_of_time",
        limit: 20,
      },
    })
    expect(alerts[0]).toMatchObject({
      id: "qr-1",
      type: "teacher_qr_mismatch",
      teacherName: "M. Diallo",
      expectedRoom: "A1",
      scannedRoom: "B2",
      subject: "Mathématiques",
      slotLabel: "08:00-09:00",
      isToday: true,
    })
  })
})
