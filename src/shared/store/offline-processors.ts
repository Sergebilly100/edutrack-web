// Registry global des processors offline pour les mutations critiques.
//
// Pourquoi ce fichier existe : useOfflineMutation enregistre son processor via
// useEffect côté composant. Si l'utilisateur quitte la page entre la mise en
// file et le retour réseau, le processor est désinscrit et l'item reste en
// queue sans pouvoir être rejoué (voir offline.store.ts:134 — warning).
//
// Pour les actions critiques (paiements, planning), on enregistre les
// processors au démarrage de l'app, indépendamment de la vie des composants.
import { queryClient } from "@/shared/api/query-client"
import {
  bulkStudents,
  checkIn,
  checkOut,
  qrScan,
  qrSkip,
  type BulkStudentsPayload,
  type BulkStudentsResponse,
  type CheckOutPayload,
  type CheckOutResponse,
  type CheckInPayload,
  type CheckInResponse,
  type QrScanPayload,
  type QrScanResponse,
  type QrSkipPayload,
} from "@/modules/attendance/attendance.api"
import {
  computeSalaries,
  updateSalaryStatus,
  type UpdateSalaryStatusInput,
} from "@/modules/salaries/salaries.api"
import {
  deleteScheduleSlot,
  deleteScheduleSlotFromDate,
  updateScheduleSlot,
  type ScheduleDeleteScope,
  type ScheduleUpdatePayload,
} from "@/modules/schedule/schedule.api"
import { excuseAbsence } from "@/modules/students/students.api"
import {
  approveValidation,
  rejectValidation,
} from "@/modules/validations/validations.api"
import { registerGlobalOfflineProcessor } from "@/shared/store/offline.store"

// Les queueKey sont des constantes partagées entre composant et processor
// pour éviter les typos silencieux. À chaque ajout, déclarer ici puis
// l'importer dans le composant qui appelle useOfflineMutation.
export const OFFLINE_QUEUE_KEYS = {
  salaryMarkPaid: "salary-mark-paid",
  salaryCompute: "salary-compute",
  scheduleUpdate: "schedule-update",
  scheduleDelete: "schedule-delete",
  scheduleDeleteFromDate: "schedule-delete-from-date",
  // Attendance : les 3 étapes prof. Les composants TeacherFlow et
  // TeacherCheckInFlow utilisent ces queueKey mais avec des wrappers
  // d'API parfois différents (teacherScheduleApi.* vs fonctions
  // standalone) — heureusement, ils visent les mêmes endpoints HTTP,
  // donc rejouer avec la version standalone est sûr.
  attendanceCheckin: "attendance-checkin",
  attendanceQrScan: "attendance-qr-scan",
  attendanceQrSkip: "attendance-qr-skip",
  attendanceQrEndScan: "attendance-qr-end-scan",
  attendanceQrEndSkip: "attendance-qr-end-skip",
  attendanceStudentsBulk: "attendance-students-bulk",
  attendanceCheckout: "attendance-checkout",
  validationApprove: "validation-approve",
  validationReject: "validation-reject",
  studentAbsenceExcuse: "student-absence-excuse",
} as const

export type ScheduleUpdateOfflinePayload = {
  scheduleId: string
  payload: ScheduleUpdatePayload
}

export type ScheduleDeleteFromDateOfflinePayload = {
  scheduleId: string
  effectiveFrom: string
  deleteScope?: ScheduleDeleteScope
}

export type StudentAbsenceExcuseOfflinePayload = {
  id: string
  reason: string
}

let installed = false

export function installOfflineProcessors(): void {
  if (installed) return
  installed = true

  registerGlobalOfflineProcessor<void, UpdateSalaryStatusInput>(
    OFFLINE_QUEUE_KEYS.salaryMarkPaid,
    {
      mutationFn: updateSalaryStatus,
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["salaries"] })
        void queryClient.invalidateQueries({ queryKey: ["salaries-stats"] })
      },
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<{ month: string; updatedCount: number }, string>(
    OFFLINE_QUEUE_KEYS.salaryCompute,
    {
      mutationFn: computeSalaries,
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["salaries"] })
      },
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<{ id: string }, ScheduleUpdateOfflinePayload>(
    OFFLINE_QUEUE_KEYS.scheduleUpdate,
    {
      mutationFn: ({ scheduleId, payload }) => updateScheduleSlot(scheduleId, payload),
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["schedule"] })
      },
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<void, string>(
    OFFLINE_QUEUE_KEYS.scheduleDelete,
    {
      mutationFn: deleteScheduleSlot,
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["schedule"] })
      },
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<void, ScheduleDeleteFromDateOfflinePayload>(
    OFFLINE_QUEUE_KEYS.scheduleDeleteFromDate,
    {
      mutationFn: ({ scheduleId, effectiveFrom, deleteScope }) =>
        deleteScheduleSlotFromDate(scheduleId, effectiveFrom, deleteScope),
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["schedule"] })
      },
      maxRetries: 3,
    }
  )

  // ── Attendance : 3 étapes prof + scans de fin ─────────────────────────
  const invalidateAttendance = () => {
    void queryClient.invalidateQueries({ queryKey: ["teacher-attendance"] })
    void queryClient.invalidateQueries({ queryKey: ["teacher-compliance"] })
    void queryClient.invalidateQueries({ queryKey: ["attendance"] })
  }

  registerGlobalOfflineProcessor<CheckInResponse, CheckInPayload>(
    OFFLINE_QUEUE_KEYS.attendanceCheckin,
    {
      mutationFn: checkIn,
      onSync: invalidateAttendance,
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<QrScanResponse, QrScanPayload>(
    OFFLINE_QUEUE_KEYS.attendanceQrScan,
    {
      mutationFn: qrScan,
      onSync: invalidateAttendance,
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<{ success: true }, QrSkipPayload>(
    OFFLINE_QUEUE_KEYS.attendanceQrSkip,
    {
      mutationFn: qrSkip,
      onSync: invalidateAttendance,
      maxRetries: 3,
    }
  )

  // Scan de fin partage les mêmes endpoints (qr-scan / qr-skip avec
  // scan_type = "end") mais avec des queueKey distincts pour permettre
  // au composant de différencier les toasts.
  registerGlobalOfflineProcessor<QrScanResponse, QrScanPayload>(
    OFFLINE_QUEUE_KEYS.attendanceQrEndScan,
    {
      mutationFn: qrScan,
      onSync: invalidateAttendance,
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<{ success: true }, QrSkipPayload>(
    OFFLINE_QUEUE_KEYS.attendanceQrEndSkip,
    {
      mutationFn: qrSkip,
      onSync: invalidateAttendance,
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<BulkStudentsResponse, BulkStudentsPayload>(
    OFFLINE_QUEUE_KEYS.attendanceStudentsBulk,
    {
      mutationFn: bulkStudents,
      onSync: invalidateAttendance,
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<CheckOutResponse, CheckOutPayload>(
    OFFLINE_QUEUE_KEYS.attendanceCheckout,
    {
      mutationFn: checkOut,
      onSync: invalidateAttendance,
      maxRetries: 3,
    }
  )

  // ── Validations ────────────────────────────────────────────────────────
  const invalidateValidations = () => {
    void queryClient.invalidateQueries({ queryKey: ["validations"] })
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    void queryClient.invalidateQueries({ queryKey: ["salaries"] })
  }

  registerGlobalOfflineProcessor<void, { attendanceId: string; validatedHours?: number }>(
    OFFLINE_QUEUE_KEYS.validationApprove,
    {
      mutationFn: approveValidation,
      onSync: invalidateValidations,
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<void, { attendanceId: string; reason: string }>(
    OFFLINE_QUEUE_KEYS.validationReject,
    {
      mutationFn: rejectValidation,
      onSync: invalidateValidations,
      maxRetries: 3,
    }
  )

  // ── Justification d'absence élève ──────────────────────────────────────
  registerGlobalOfflineProcessor<
    { id: string; status: string; excuseReason: string },
    StudentAbsenceExcuseOfflinePayload
  >(OFFLINE_QUEUE_KEYS.studentAbsenceExcuse, {
    mutationFn: ({ id, reason }) => excuseAbsence(id, reason),
    onSync: () => {
      void queryClient.invalidateQueries({ queryKey: ["students"] })
    },
    maxRetries: 3,
  })
}
