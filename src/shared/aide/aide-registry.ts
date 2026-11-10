import { matchPath } from "react-router-dom"

import { accountAide } from "@/modules/account/account.aide"
import { classesAide, conductAide, endOfYearAide, evaluationsAide, levelsAide, reportCardClaimsAide, reportCardsAide, schoolYearsAide, subjectsAide } from "@/modules/academic/academic.aide"
import { enrollmentDocumentsAide, enrollmentNewAide, enrollmentPaymentAide, enrollmentsAide } from "@/modules/enrollments/enrollments.aide"
import { financeAgreementsAide, financeDashboardAide, financeEntryAide, financeHistoryAide, financeHistoryDetailAide, financeJournalAide, financeRecoveryAide } from "@/modules/finance/finance.aide"
import { settingsAide } from "@/modules/settings/settings.aide"
import { teacherAppAide, teacherCalculationAide, teacherDashboardAide, teacherNotesAide } from "@/modules/attendance/teacher-space.aide"
import { parentAbsencesAide, parentAccountAide, parentDashboardAide, parentFirstLoginAide, parentGradesAide, parentNotificationsAide, parentPaymentsAide, parentReportCardsAide, parentScheduleAide } from "@/modules/parent-portal/parent-portal.aide"
import { directorDashboardAide, riskDetailsAide } from "@/modules/dashboard/director-pages.aide"
import { importAide } from "@/modules/import-export/import.aide"
import { subscriptionRevenueAide, subscriptionsAide } from "@/modules/subscriptions/subscriptions.aide"
import { roomsAide } from "@/modules/rooms/rooms.aide"
import { salariesAide } from "@/modules/salaries/salaries.aide"
import { scheduleAide } from "@/modules/schedule/schedule.aide"
import { studentDetailAide, studentsHistoryAide } from "@/modules/students/student-detail.aide"
import { studentsAide } from "@/modules/students/students.aide"
import { validationsAide } from "@/modules/validations/validations.aide"
import { teacherDetailAide, teachersAide } from "@/modules/teachers/teachers.aide"
import type { PermissionKey } from "@/shared/store/auth.store"
import type { AidePage, AideRole, AideTask, AideViewer } from "./aide.types"

/**
 * Registre central : une entrée par page documentée (un fichier *.aide.ts par module).
 * Ordre significatif : « /students/history » doit précéder « /students/:studentId ».
 */
export const AIDE_PAGES: AidePage[] = [
  studentsAide,
  studentsHistoryAide,
  studentDetailAide,
  teachersAide,
  teacherDetailAide,
  enrollmentsAide,
  enrollmentNewAide,
  enrollmentPaymentAide,
  enrollmentDocumentsAide,
  scheduleAide,
  roomsAide,
  validationsAide,
  salariesAide,
  accountAide,
  financeDashboardAide,
  financeRecoveryAide,
  financeEntryAide,
  financeHistoryAide,
  financeHistoryDetailAide,
  financeJournalAide,
  financeAgreementsAide,
  schoolYearsAide,
  levelsAide,
  classesAide,
  subjectsAide,
  evaluationsAide,
  conductAide,
  reportCardsAide,
  reportCardClaimsAide,
  endOfYearAide,
  settingsAide,
  teacherDashboardAide,
  teacherAppAide,
  teacherNotesAide,
  teacherCalculationAide,
  parentDashboardAide,
  parentAbsencesAide,
  parentScheduleAide,
  parentGradesAide,
  parentReportCardsAide,
  parentPaymentsAide,
  parentNotificationsAide,
  parentAccountAide,
  parentFirstLoginAide,
  directorDashboardAide,
  riskDetailsAide,
  importAide,
  subscriptionsAide,
  subscriptionRevenueAide,
]

type Restricted = { roles?: AideRole[]; requires?: PermissionKey[] }

export function canView(item: Restricted, viewer: AideViewer): boolean {
  if (item.roles && (!viewer.role || !item.roles.includes(viewer.role))) return false
  if (item.requires && item.requires.length > 0 && !item.requires.some((key) => viewer.hasPermission(key))) return false
  return true
}

/**
 * Page d'aide d'une route. Une même route peut avoir plusieurs aides selon le rôle (ex. /dashboard :
 * direction et professeur) : avec `viewer`, on garde la première aide que ce profil peut voir.
 */
export function findAideByPath(pathname: string, pages: AidePage[] = AIDE_PAGES, viewer?: AideViewer): AidePage | undefined {
  const matching = pages.filter((page) => page.chemins.some((chemin) => matchPath({ path: chemin, end: true }, pathname) !== null))
  return viewer ? matching.find((page) => canView(page, viewer)) : matching[0]
}

export function visibleAidePages(viewer: AideViewer, pages: AidePage[] = AIDE_PAGES): AidePage[] {
  return pages.filter((page) => canView(page, viewer))
}

export function isTaskAvailable(task: AideTask, viewer: AideViewer): boolean {
  return canView(task, viewer)
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Recherche insensible aux accents et à la casse dans le titre, le résumé, les tâches et leurs étapes. */
export function matchesQuery(page: AidePage, query: string): boolean {
  const needle = normalize(query.trim())
  if (!needle) return true
  const haystack = normalize([page.titre, page.resume, ...(page.prerequis ?? []), ...page.taches.flatMap((task) => [task.titre, ...task.etapes])].join(" "))
  return haystack.includes(needle)
}

export function taskMatchesQuery(task: AideTask, query: string): boolean {
  const needle = normalize(query.trim())
  if (!needle) return true
  return normalize([task.titre, ...task.etapes].join(" ")).includes(needle)
}
