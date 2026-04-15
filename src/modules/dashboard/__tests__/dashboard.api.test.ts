import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/shared/api/client", () => {
  return {
    apiClient: {
      get: getMock,
    },
  }
})

import {
  getAttendanceHistory,
  getQRAlerts,
  getSMSLog,
  getTodayAttendance,
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
