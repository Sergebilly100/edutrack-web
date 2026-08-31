import type { NotificationPanelItem } from "@/shared/components/layout/NotificationsPanel"
import type { DashboardActionItem } from "./dashboard.api"

export const DASHBOARD_ACTION_ROUTES: Record<string, { href: string; label: string }> = {
  teacher_absences_high: { href: "/teachers", label: "Ouvrir les professeurs" },
  salary_pending: { href: "/salaries", label: "Ouvrir les salaires" },
  validations_pending: { href: "/validations", label: "Traiter les validations" },
  commission_overdue: { href: "/subscriptions/revenue", label: "Ouvrir les revenus" },
  payment_reminder_needed: { href: "/finance/dashboard", label: "Ouvrir la finance" },
  report_cards_blocked: { href: "/academic/completion", label: "Voir la complétude" },
  student_at_risk: { href: "/students", label: "Voir les élèves" },
  teacher_at_risk: { href: "/teachers", label: "Voir les professeurs" },
  dossier_incomplete: { href: "/enrollments", label: "Voir les inscriptions" },
}

const ACTION_TITLES: Record<string, string> = {
  teacher_absences_high: "Absences profs élevées",
  salary_pending: "Salaires à terminer",
  validations_pending: "Validations en attente",
  commission_overdue: "Reversement com. en retard",
  payment_reminder_needed: "Relances paiements",
  report_cards_blocked: "Bulletins bloqués",
  student_at_risk: "Élèves à risque",
  teacher_at_risk: "Professeurs à risque",
  dossier_incomplete: "Dossier incomplet",
}

export const actionItemToNotification = (item: DashboardActionItem): NotificationPanelItem => {
  const route = DASHBOARD_ACTION_ROUTES[item.type] ?? { href: "/dashboard", label: "Consulter" }
  return {
    id: item.id,
    title: ACTION_TITLES[item.type] ?? "Action à traiter",
    message: item.message || "À traiter.",
    meta: item.priority === "high" ? "Priorité haute" : item.priority === "medium" ? "Priorité moyenne" : "Priorité basse",
    tone: item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "info",
    targetHref: route.href,
    actionLabel: route.label,
  }
}
