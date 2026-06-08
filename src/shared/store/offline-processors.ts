// Registry global des processors offline pour les mutations critiques.
//
// Pourquoi ce fichier existe : useOfflineMutation enregistre son processor via
// useEffect côté composant. Si l'utilisateur quitte la page entre la mise en
// file et le retour réseau, le processor est désinscrit et l'item reste en
// queue sans pouvoir être rejoué (voir offline.store.ts:134 - warning).
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
import { useAuthStore } from "@/shared/store/auth.store"
import {
  registerGlobalOfflineProcessor,
  setCurrentOwnerResolver,
} from "@/shared/store/offline.store"

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
  // standalone) - heureusement, ils visent les mêmes endpoints HTTP,
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

  // Identité du user connecté pour le filtrage de la file offline : la sync ne
  // rejoue un item que sous l'identité qui l'a créé (sûreté appareil partagé).
  setCurrentOwnerResolver(() => useAuthStore.getState().user?.id)

  registerGlobalOfflineProcessor<void, UpdateSalaryStatusInput>(
    OFFLINE_QUEUE_KEYS.salaryMarkPaid,
    {
      mutationFn: updateSalaryStatus,
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["salaries"], refetchType: "active" })
        void queryClient.invalidateQueries({ queryKey: ["salaries-stats"], refetchType: "active" })
      },
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<{ month: string; updatedCount: number }, string>(
    OFFLINE_QUEUE_KEYS.salaryCompute,
    {
      mutationFn: computeSalaries,
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["salaries"], refetchType: "active" })
      },
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<{ id: string }, ScheduleUpdateOfflinePayload>(
    OFFLINE_QUEUE_KEYS.scheduleUpdate,
    {
      mutationFn: ({ scheduleId, payload }) => updateScheduleSlot(scheduleId, payload),
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["schedule"], refetchType: "active" })
      },
      maxRetries: 3,
    }
  )

  registerGlobalOfflineProcessor<void, string>(
    OFFLINE_QUEUE_KEYS.scheduleDelete,
    {
      mutationFn: deleteScheduleSlot,
      onSync: () => {
        void queryClient.invalidateQueries({ queryKey: ["schedule"], refetchType: "active" })
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
        void queryClient.invalidateQueries({ queryKey: ["schedule"], refetchType: "active" })
      },
      maxRetries: 3,
    }
  )

  // ── Attendance : 3 étapes prof + scans de fin ─────────────────────────
  // refetchType: "active" → invalidate + refetch des composants montés en un
  // seul appel. Sans ça, les listes/dashboards ne se rafraichissent qu'au
  // prochain mount ou via un refresh manuel.
  const invalidateAttendance = () => {
    const queryKeys = [
      ["teacher-attendance"],
      ["teacher-compliance"],
      ["teacher-schedule"],
      ["attendance"],
      ["dashboard"],
      ["validations"],
      ["teachers"],
      ["teacher"],
      ["salaries"],
      ["rooms"],
      ["students"],
      ["schedule"],
    ]

    for (const queryKey of queryKeys) {
      void queryClient.invalidateQueries({ queryKey, refetchType: "active" })
    }
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
    void queryClient.invalidateQueries({ queryKey: ["validations"], refetchType: "active" })
    void queryClient.invalidateQueries({ queryKey: ["dashboard"], refetchType: "active" })
    void queryClient.invalidateQueries({ queryKey: ["salaries"], refetchType: "active" })
    void queryClient.invalidateQueries({ queryKey: ["attendance"], refetchType: "active" })
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
      void queryClient.invalidateQueries({ queryKey: ["students"], refetchType: "active" })
      void queryClient.invalidateQueries({ queryKey: ["attendance"], refetchType: "active" })
    },
    maxRetries: 3,
  })
}
