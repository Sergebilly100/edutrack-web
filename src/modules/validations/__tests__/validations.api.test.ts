import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/shared/api/client", () => ({
  apiClient: {
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}))

import {
  applyEndScanAction,
  approveValidation,
  bulkWarnEndScans,
  cancelEndScanSanction,
  fetchMissingEndScans,
  fetchTeacherNotifications,
  getPendingValidationCount,
  getPendingValidations,
  markAllTeacherNotificationsRead,
  markTeacherNotificationRead,
  rejectValidation,
} from "../validations.api"

describe("validations.api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getPendingValidations ─────────────────────────────────────────────────

  describe("getPendingValidations", () => {
    it("normalise les deux groupes avec snake_case et camelCase", async () => {
      getMock.mockResolvedValueOnce({
        data: {
          gps_suspicious: [
            {
              attendance_id: "att-1",
              teacher_id: "t-1",
              teacher_name: "M. Koné",
              course_name: "Maths",
              class_name: "3A",
              date: "2026-05-01",
              checked_in_at: null,
              checked_out_at: null,
              geo_status: "suspicious",
              checkin_distance: "125",
              actual_minutes: null,
              schedule_duration_minutes: "60",
              validation_reason: null,
              hourly_rate: 5000,
              kind: "gps_suspicious",
              slot_label: "8h-9h",
              room_name: "Salle A1",
            },
          ],
          short_hours: [],
        },
      })

      const result = await getPendingValidations()

      expect(getMock).toHaveBeenCalledWith("/validations/pending")
      expect(result.gps_suspicious).toHaveLength(1)
      const item = result.gps_suspicious[0]!
      expect(item.attendanceId).toBe("att-1")
      expect(item.teacherName).toBe("M. Koné")
      expect(item.checkinDistance).toBe(125)
      expect(item.slotLabel).toBe("8h-9h")
      expect(item.roomName).toBe("Salle A1")
      expect(result.short_hours).toHaveLength(0)
    })

    it("retourne des groupes vides si la réponse est mal formée", async () => {
      getMock.mockResolvedValueOnce({ data: null })

      const result = await getPendingValidations()

      expect(result.gps_suspicious).toEqual([])
      expect(result.short_hours).toEqual([])
    })

    it("normalise les champs null correctement", async () => {
      getMock.mockResolvedValueOnce({
        data: {
          gps_suspicious: [],
          short_hours: [
            {
              attendance_id: "att-2",
              teacher_id: "t-1",
              teacher_name: "Mme Bah",
              course_name: "Français",
              class_name: "5B",
              date: "2026-05-02",
              checked_in_at: "2026-05-02T08:00:00",
              checked_out_at: "2026-05-02T08:40:00",
              geo_status: null,
              checkin_distance: null,
              actual_minutes: 40,
              schedule_duration_minutes: "60",
              validation_reason: null,
              hourly_rate: null,
              kind: "short_hours",
              slot_label: null,
              room_name: null,
            },
          ],
        },
      })

      const result = await getPendingValidations()
      const item = result.short_hours[0]!

      expect(item.checkinDistance).toBeNull()
      expect(item.hourlyRate).toBeNull()
      expect(item.slotLabel).toBeNull()
      expect(item.roomName).toBeNull()
    })
  })

  // ── getPendingValidationCount ─────────────────────────────────────────────

  describe("getPendingValidationCount", () => {
    it("retourne les compteurs numériques", async () => {
      getMock.mockResolvedValueOnce({
        data: { gps_suspicious: 3, short_hours: 7, total: 10 },
      })

      const result = await getPendingValidationCount()

      expect(result).toEqual({ gps_suspicious: 3, short_hours: 7, total: 10 })
    })
  })

  // ── approveValidation ─────────────────────────────────────────────────────

  describe("approveValidation", () => {
    it("appelle PATCH sans corps si validatedHours absent", async () => {
      patchMock.mockResolvedValueOnce({ data: {} })

      await approveValidation({ attendanceId: "att-1" })

      expect(patchMock).toHaveBeenCalledWith("/validations/att-1/approve", {})
    })

    it("appelle PATCH avec validated_hours si fourni", async () => {
      patchMock.mockResolvedValueOnce({ data: {} })

      await approveValidation({ attendanceId: "att-1", validatedHours: 0.75 })

      expect(patchMock).toHaveBeenCalledWith("/validations/att-1/approve", {
        validated_hours: 0.75,
      })
    })
  })

  // ── rejectValidation ──────────────────────────────────────────────────────

  describe("rejectValidation", () => {
    it("appelle PATCH avec la raison", async () => {
      patchMock.mockResolvedValueOnce({ data: {} })

      await rejectValidation({ attendanceId: "att-1", reason: "Fraude détectée" })

      expect(patchMock).toHaveBeenCalledWith("/validations/att-1/reject", {
        reason: "Fraude détectée",
      })
    })
  })

  // ── fetchMissingEndScans ──────────────────────────────────────────────────

  describe("fetchMissingEndScans", () => {
    it("normalise les données prof + sessions + actions", async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            teacher_id: "t-1",
            teacher_name: "M. Koné",
            missing_end_scan_count: 2,
            warning_count: 1,
            sanction_count: 0,
            sessions: [
              {
                date: "2026-05-01",
                schedule_id: "sch-1",
                attendance_id: "att-1",
                subject: "Maths",
                time_slot: "8h-9h",
                room_name: "Salle A1",
                end_scan_action: "warned",
                end_scan_action_reason: "Oublié",
                end_scan_action_at: "2026-05-02T10:00:00",
                end_scan_action_cancelled_at: null,
              },
            ],
          },
        ],
      })

      const result = await fetchMissingEndScans("2026-05")

      expect(getMock).toHaveBeenCalledWith("/validations/missing-end-scans", {
        params: { month: "2026-05" },
      })
      expect(result).toHaveLength(1)
      const teacher = result[0]!
      expect(teacher.teacherId).toBe("t-1")
      expect(teacher.missingEndScanCount).toBe(2)
      expect(teacher.warningCount).toBe(1)
      expect(teacher.sanctionCount).toBe(0)
      const session = teacher.sessions[0]!
      expect(session.attendanceId).toBe("att-1")
      expect(session.endScanAction).toBe("warned")
      expect(session.endScanActionCancelledAt).toBeNull()
    })

    it("retourne tableau vide si réponse non-tableau", async () => {
      getMock.mockResolvedValueOnce({ data: null })

      const result = await fetchMissingEndScans("2026-05")

      expect(result).toEqual([])
    })
  })

  // ── bulkWarnEndScans ──────────────────────────────────────────────────────

  describe("bulkWarnEndScans", () => {
    it("retourne teacherCount et warnedCount normalisés", async () => {
      postMock.mockResolvedValueOnce({ data: { teacher_count: 3, warned_count: 7 } })

      const result = await bulkWarnEndScans(["t-1", "t-2", "t-3"], "2026-05")

      expect(postMock).toHaveBeenCalledWith("/validations/bulk-warn-end-scans", {
        teacher_ids: ["t-1", "t-2", "t-3"],
        month: "2026-05",
      })
      expect(result.teacherCount).toBe(3)
      expect(result.warnedCount).toBe(7)
    })

    it("supporte aussi le format camelCase", async () => {
      postMock.mockResolvedValueOnce({ data: { teacherCount: 2, warnedCount: 5 } })

      const result = await bulkWarnEndScans(["t-1", "t-2"], "2026-05")

      expect(result.teacherCount).toBe(2)
      expect(result.warnedCount).toBe(5)
    })
  })

  // ── applyEndScanAction ────────────────────────────────────────────────────

  describe("applyEndScanAction", () => {
    it("POST avec les bons paramètres pour warned", async () => {
      postMock.mockResolvedValueOnce({ data: {} })

      await applyEndScanAction({
        attendanceId: "att-1",
        action: "warned",
        reason: "Scan oublié",
      })

      expect(postMock).toHaveBeenCalledWith("/validations/end-scan-action", {
        attendance_id: "att-1",
        action: "warned",
        reason: "Scan oublié",
      })
    })

    it("POST avec les bons paramètres pour sanctioned", async () => {
      postMock.mockResolvedValueOnce({ data: {} })

      await applyEndScanAction({
        attendanceId: "att-1",
        action: "sanctioned",
        reason: "Absent confirmé",
      })

      expect(postMock).toHaveBeenCalledWith("/validations/end-scan-action", {
        attendance_id: "att-1",
        action: "sanctioned",
        reason: "Absent confirmé",
      })
    })
  })

  // ── cancelEndScanSanction ─────────────────────────────────────────────────

  describe("cancelEndScanSanction", () => {
    it("POST avec les bons paramètres", async () => {
      postMock.mockResolvedValueOnce({ data: {} })

      await cancelEndScanSanction({ attendanceId: "att-1", reason: "Erreur de saisie" })

      expect(postMock).toHaveBeenCalledWith("/validations/cancel-end-scan-sanction", {
        attendance_id: "att-1",
        reason: "Erreur de saisie",
      })
    })
  })

  // ── fetchTeacherNotifications ─────────────────────────────────────────────

  describe("fetchTeacherNotifications", () => {
    it("normalise les notifications avec read_at depuis metadata", async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: "notif-1",
            type: "attendance_rejected",
            message: "Votre présence a été refusée",
            created_at: "2026-05-01T10:00:00",
            metadata: { read_at: "2026-05-01T11:00:00" },
          },
          {
            id: "notif-2",
            type: "scan_end_warning",
            message: "Scan de fin manquant",
            created_at: "2026-05-02T09:00:00",
            metadata: null,
          },
        ],
      })

      const result = await fetchTeacherNotifications()

      expect(getMock).toHaveBeenCalledWith("/teacher/notifications")
      expect(result).toHaveLength(2)
      expect(result[0]!.readAt).toBe("2026-05-01T11:00:00")
      expect(result[1]!.readAt).toBeNull()
    })

    it("retourne tableau vide si réponse non-tableau", async () => {
      getMock.mockResolvedValueOnce({ data: {} })

      const result = await fetchTeacherNotifications()

      expect(result).toEqual([])
    })
  })

  // ── markTeacherNotificationRead ───────────────────────────────────────────

  describe("markTeacherNotificationRead", () => {
    it("appelle PATCH sur le bon endpoint", async () => {
      patchMock.mockResolvedValueOnce({ data: {} })

      await markTeacherNotificationRead("notif-1")

      expect(patchMock).toHaveBeenCalledWith("/teacher/notifications/notif-1/read")
    })
  })

  // ── markAllTeacherNotificationsRead ──────────────────────────────────────

  describe("markAllTeacherNotificationsRead", () => {
    it("appelle PATCH read-all", async () => {
      patchMock.mockResolvedValueOnce({ data: {} })

      await markAllTeacherNotificationsRead()

      expect(patchMock).toHaveBeenCalledWith("/teacher/notifications/read-all")
    })
  })
})
