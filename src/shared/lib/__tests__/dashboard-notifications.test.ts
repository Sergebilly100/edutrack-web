import { describe, expect, it } from "vitest"

import {
  buildDirectorDashboardNotifications,
  type DashboardNotificationCapabilities,
} from "@/shared/lib/dashboard-notifications"
import type { DashboardSmsItem } from "@/modules/dashboard/dashboard.api"

const ALL_CAPS: DashboardNotificationCapabilities = {
  canViewSchedule: true,
  canViewTeachers: true,
  canViewValidations: true,
  canViewSalary: true,
  canViewSmsLog: true,
  canViewStudents: true,
}

const NO_CAPS: DashboardNotificationCapabilities = {
  canViewSchedule: false,
  canViewTeachers: false,
  canViewValidations: false,
  canViewSalary: false,
  canViewSmsLog: false,
  canViewStudents: false,
}

const failedParentSms: DashboardSmsItem = {
  id: "sms-parent-1",
  type: "student_absent_parent",
  status: "failed",
  message: "Votre enfant est absent",
  recipientPhone: "+2250700000000",
  sentAt: null,
  createdAt: "2026-05-12T08:00:00.000Z",
}

const failedDirectorSms: DashboardSmsItem = {
  id: "sms-dir-1",
  type: "teacher_absent_director",
  status: "failed",
  message: "Un professeur est absent",
  recipientPhone: "+2250700000001",
  sentAt: null,
  createdAt: "2026-05-12T08:05:00.000Z",
}

const baseInput = {
  nextWeekHasCoverage: false,
  weeklyAbsenceCount: 5,
  salaryUnpaidCount: 3,
  salaryUnpaidTotalFcfa: 150000,
  pendingValidationCount: 2,
  smsLog: [failedParentSms, failedDirectorSms],
}

const idsOf = (caps: DashboardNotificationCapabilities) =>
  buildDirectorDashboardNotifications({ ...baseInput, capabilities: caps }).map((n) => n.id)

describe("buildDirectorDashboardNotifications", () => {
  it("le directeur (toutes capacités) voit toutes les notifications", () => {
    const ids = idsOf(ALL_CAPS)
    expect(ids).toContain("coverage-next-week")
    expect(ids).toContain("teacher-absences-week")
    expect(ids).toContain("validations-pending-hours")
    expect(ids).toContain("salary-unpaid-alerts")
    expect(ids).toContain("sms-sms-parent-1")
    expect(ids).toContain("sms-sms-dir-1")
  })

  it("un staff sans aucune permission ne voit aucune notification", () => {
    expect(idsOf(NO_CAPS)).toHaveLength(0)
  })

  it("filtre la couverture EDT selon canViewSchedule", () => {
    expect(idsOf({ ...NO_CAPS, canViewSchedule: true })).toEqual(["coverage-next-week"])
  })

  it("filtre les absences profs selon canViewTeachers", () => {
    expect(idsOf({ ...NO_CAPS, canViewTeachers: true })).toEqual(["teacher-absences-week"])
  })

  it("filtre les validations selon canViewValidations", () => {
    expect(idsOf({ ...NO_CAPS, canViewValidations: true })).toEqual(["validations-pending-hours"])
  })

  it("filtre les salaires impayés selon canViewSalary", () => {
    expect(idsOf({ ...NO_CAPS, canViewSalary: true })).toEqual(["salary-unpaid-alerts"])
  })

  it("le SMS parent échoué (retry via /students) nécessite canViewStudents", () => {
    expect(idsOf({ ...NO_CAPS, canViewStudents: true })).toEqual(["sms-sms-parent-1"])
  })

  it("le SMS directeur échoué nécessite canViewSmsLog", () => {
    expect(idsOf({ ...NO_CAPS, canViewSmsLog: true })).toEqual(["sms-sms-dir-1"])
  })
})
