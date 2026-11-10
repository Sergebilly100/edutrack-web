import type { NotificationPanelItem } from "@/shared/components/layout/NotificationsPanel"
import type { DashboardActionItem } from "./dashboard.api"

export const DASHBOARD_ACTION_ROUTES: Record<string, { href: string; label: string }> = {
  teacher_absences_high: { href: "/dashboard/risks?tab=teachers&signal=absences", label: "Voir les professeurs absents" },
  salary_pending: { href: "/salaries", label: "Ouvrir les salaires" },
  validations_pending: { href: "/validations", label: "Traiter les validations" },
  commission_overdue: { href: "/subscriptions/revenue", label: "Ouvrir les revenus abonnements" },
  payment_reminder_needed: { href: "/finance/dashboard", label: "Ouvrir la finance" },
  report_cards_blocked: { href: "/academic/completion", label: "Voir la complétude" },
  student_at_risk: { href: "/dashboard/risks?tab=students", label: "Voir les élèves à suivre" },
  teacher_at_risk: { href: "/dashboard/risks?tab=teachers", label: "Voir les professeurs" },
  dossier_incomplete: { href: "/enrollments", label: "Voir les inscriptions" },
  conduct_decision_pending: { href: "/academic/conduct", label: "Prendre les décisions" },
  config_active_year: { href: "/academic/school-years", label: "Voir les années scolaires" },
  config_school_info: { href: "/settings?tab=general", label: "Compléter les informations" },
  config_levels: { href: "/academic/levels", label: "Configurer les niveaux" },
  config_subjects: { href: "/academic/subjects", label: "Configurer les matières" },
  config_rooms: { href: "/rooms", label: "Ajouter des salles" },
  config_fees: { href: "/settings?tab=finance", label: "Configurer les frais" },
  config_required_documents: { href: "/settings?tab=scolarite", label: "Définir les documents requis" },
  config_schedule: { href: "/schedule", label: "Planifier l’emploi du temps" },
  config_grading_periods: { href: "/academic/school-years", label: "Configurer les périodes" },
  config_teachers: { href: "/teachers", label: "Ajouter des professeurs" },
  config_reminder_rules: { href: "/settings?tab=relances", label: "Configurer les relances" },
  config_risk_rules: { href: "/settings?tab=risques", label: "Configurer le suivi" },
  config_document_identity: { href: "/settings?tab=general", label: "Ajouter le logo et le cachet" },
}

/** Actions de configuration : affichées dans « Actions prioritaires » (directeur uniquement, filtré par l'API). */
export const CONFIG_ACTION_TYPES: readonly string[] = Object.keys(DASHBOARD_ACTION_ROUTES).filter((type) => type.startsWith("config_"))

const ACTION_TITLES: Record<string, string> = {
  teacher_absences_high: "Absences profs élevées",
  salary_pending: "Salaires à terminer",
  validations_pending: "Validations en attente",
  commission_overdue: "Reversement com. en retard",
  payment_reminder_needed: "Relances paiements",
  report_cards_blocked: "Bulletins bloqués",
  student_at_risk: "Élèves à risque",
  teacher_at_risk: "Professeurs à suivre",
  dossier_incomplete: "Dossier incomplet",
  conduct_decision_pending: "Décisions de conduite",
  config_active_year: "Année scolaire à ouvrir",
  config_school_info: "Informations de l’école",
  config_levels: "Niveaux à configurer",
  config_subjects: "Matières à configurer",
  config_rooms: "Salles à ajouter",
  config_fees: "Frais de scolarité à configurer",
  config_required_documents: "Documents requis à définir",
  config_schedule: "Emploi du temps à configurer",
  config_grading_periods: "Périodes de notation à configurer",
  config_teachers: "Professeurs à ajouter",
  config_reminder_rules: "Règles de relance à configurer",
  config_risk_rules: "Règles de suivi à configurer",
  config_document_identity: "Identité visuelle des documents",
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

/** Ligne lisible « Titre : message » décrivant ce qu'il faut faire derrière une pastille. */
export const describeActionItem = (item: DashboardActionItem): string => {
  const notification = actionItemToNotification(item)
  return `${notification.title} : ${notification.message}`
}
