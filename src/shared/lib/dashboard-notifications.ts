import type { DashboardSmsItem } from "@/modules/dashboard/dashboard.api"
import type { NotificationPanelItem } from "@/shared/components/layout/NotificationsPanel"

export const DASHBOARD_DISMISSED_NOTIFICATIONS_KEY = "edutrack:dashboard:dismissed-notifications"

// SMS destinés au directeur — peuvent rester affichés même quand 'sent' (info utile pour lui).
// Les autres types (parents/profs) ne s'affichent que si retry possible (status='failed').
const DIRECTOR_SMS_TYPES = new Set([
  "teacher_late_director",
  "teacher_absent_director",
  "qr_invalid_alert",
  "payment_reminder",
  "subscription_expiry_alert",
  "subscription_revenue_payout",
])

// Types dont les SMS échoués peuvent être renvoyés depuis une page dédiée.
const RETRYABLE_FROM_PAGE: Record<string, { href: string; label: string }> = {
  student_absent_parent: { href: "/students", label: "Ouvrir les élèves" },
}

export const clearDashboardDismissedNotifications = (): void => {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(DASHBOARD_DISMISSED_NOTIFICATIONS_KEY)
}

export const readDashboardDismissedNotificationIds = (): Set<string> => {
  if (typeof window === "undefined") {
    return new Set()
  }

  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_DISMISSED_NOTIFICATIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [])
  } catch {
    return new Set()
  }
}

export const writeDashboardDismissedNotificationIds = (ids: Set<string>): void => {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(DASHBOARD_DISMISSED_NOTIFICATIONS_KEY, JSON.stringify([...ids]))
}

export const formatDashboardNotificationTime = (value: string | null): string => {
  if (!value) {
    return "Date inconnue"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const buildDirectorDashboardNotifications = ({
  nextWeekHasCoverage,
  weeklyAbsenceCount,
  salaryUnpaidCount,
  salaryUnpaidTotalFcfa,
  pendingValidationCount,
  smsLog,
}: {
  nextWeekHasCoverage: boolean | undefined
  weeklyAbsenceCount: number
  salaryUnpaidCount: number
  salaryUnpaidTotalFcfa: number
  pendingValidationCount: number
  smsLog: DashboardSmsItem[]
}): NotificationPanelItem[] => {
  const items: NotificationPanelItem[] = []

  if (nextWeekHasCoverage === false) {
    items.push({
      id: "coverage-next-week",
      title: "Semaine prochaine à compléter",
      message: "Certains créneaux de la semaine prochaine ne sont pas encore couverts.",
      meta: "Action conseillée: ouvrir l'emploi du temps",
      tone: "warning",
      targetHref: "/schedule",
      actionLabel: "Ouvrir l'emploi du temps",
    })
  }

  if (weeklyAbsenceCount > 3) {
    items.push({
      id: "teacher-absences-week",
      title: "Absences professeurs à surveiller",
      message: `${weeklyAbsenceCount} absences non justifiées ont été relevées sur les 7 derniers jours.`,
      meta: "Action conseillée: consulter les professeurs",
      tone: "warning",
      targetHref: "/teachers",
      actionLabel: "Consulter les professeurs",
    })
  }

  if (pendingValidationCount > 0) {
    items.push({
      id: "validations-pending-hours",
      title: "Validations horaires en attente",
      message: `${pendingValidationCount} présence(s) nécessitent une décision avant le calcul final des salaires.`,
      meta: "Action requise: valider les horaires",
      tone: "warning",
      targetHref: "/validations",
      actionLabel: "Ouvrir les validations",
    })
  }

  if (salaryUnpaidCount > 0) {
    items.push({
      id: "salary-unpaid-alerts",
      title: "Paiements salaires à terminer",
      message: `${salaryUnpaidCount} fiche(s) restent à solder, pour ${new Intl.NumberFormat("fr-FR").format(salaryUnpaidTotalFcfa)} FCFA.`,
      meta: "Action conseillée: ouvrir les salaires",
      tone: "warning",
      targetHref: "/salaries",
      actionLabel: "Ouvrir les salaires",
    })
  }

  for (const sms of smsLog) {
    const isDirectorSms = DIRECTOR_SMS_TYPES.has(sms.type)
    const isFailed = sms.status === "failed"

    // Pour les SMS destinés au directeur : on garde failed + queued (information utile).
    // Pour les autres : uniquement failed avec page de retry disponible.
    if (!isDirectorSms) {
      if (!isFailed) continue
      const retry = RETRYABLE_FROM_PAGE[sms.type]
      if (!retry) continue

      items.push({
        id: `sms-${sms.id}`,
        title: "SMS non envoyé",
        message: sms.message || "Message indisponible",
        meta: `${formatDashboardNotificationTime(sms.sentAt ?? sms.createdAt)} · ${sms.recipientPhone}`,
        tone: "danger",
        targetHref: retry.href,
        actionLabel: retry.label,
      })
      continue
    }

    if (!isFailed) continue

    items.push({
      id: `sms-${sms.id}`,
      title: "SMS directeur non envoyé",
      message: sms.message || "Message indisponible",
      meta: `${formatDashboardNotificationTime(sms.sentAt ?? sms.createdAt)} · ${sms.recipientPhone}`,
      tone: "danger",
    })
  }

  return items
}
