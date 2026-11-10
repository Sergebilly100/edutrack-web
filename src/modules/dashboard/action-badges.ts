import { useQuery } from "@tanstack/react-query"

import { useAuthStore } from "@/shared/store/auth.store"
import { describeActionItem } from "./dashboard-action-notifications"
import { getDashboardActionItems, type DashboardActionItem } from "./dashboard.api"

/**
 * Page (entrée du menu) et onglet des paramètres où traiter chaque type d'action.
 * Les validations et décisions de conduite ont déjà leur propre pastille dans le menu : non listées ici.
 */
export const ACTION_BADGE_TARGETS: Record<string, { href: string; settingsTab?: string }> = {
  config_active_year: { href: "/academic" },
  config_levels: { href: "/academic" },
  config_subjects: { href: "/academic" },
  config_grading_periods: { href: "/academic" },
  config_rooms: { href: "/rooms" },
  config_schedule: { href: "/schedule" },
  config_teachers: { href: "/teachers" },
  config_school_info: { href: "/settings", settingsTab: "general" },
  config_document_identity: { href: "/settings", settingsTab: "general" },
  config_required_documents: { href: "/settings", settingsTab: "scolarite" },
  config_fees: { href: "/settings", settingsTab: "finance" },
  config_reminder_rules: { href: "/settings", settingsTab: "relances" },
  config_risk_rules: { href: "/settings", settingsTab: "risques" },
  salary_pending: { href: "/salaries" },
  commission_overdue: { href: "/subscriptions/revenue" },
  report_cards_blocked: { href: "/academic/report-cards" },
}

export type ActionBadges = {
  byHref: Record<string, number>
  bySettingsTab: Record<string, number>
  /** Ce qu'il faut faire derrière chaque pastille (une ligne par action), pour l'infobulle et les lecteurs d'écran. */
  detailsByHref: Record<string, string[]>
  detailsBySettingsTab: Record<string, string[]>
}

export const summarizeActionBadges = (items: ReadonlyArray<DashboardActionItem>): ActionBadges => {
  const result: ActionBadges = { byHref: {}, bySettingsTab: {}, detailsByHref: {}, detailsBySettingsTab: {} }
  for (const item of items) {
    const target = ACTION_BADGE_TARGETS[item.type]
    if (!target) continue
    const line = describeActionItem(item)
    result.byHref[target.href] = (result.byHref[target.href] ?? 0) + 1
    result.detailsByHref[target.href] = [...(result.detailsByHref[target.href] ?? []), line]
    if (target.settingsTab) {
      result.bySettingsTab[target.settingsTab] = (result.bySettingsTab[target.settingsTab] ?? 0) + 1
      result.detailsBySettingsTab[target.settingsTab] = [...(result.detailsBySettingsTab[target.settingsTab] ?? []), line]
    }
  }
  return result
}

const NO_BADGES: ActionBadges = { byHref: {}, bySettingsTab: {}, detailsByHref: {}, detailsBySettingsTab: {} }

/** Pastilles du menu et des onglets : dérivées de la même liste d'actions que le tableau de bord et la cloche. */
export function useActionBadges(): ActionBadges {
  const role = useAuthStore((state) => state.user?.role)
  const query = useQuery({
    queryKey: ["dashboard", "action-items"],
    queryFn: getDashboardActionItems,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
    enabled: role === "director",
  })
  return query.data ? summarizeActionBadges(query.data) : NO_BADGES
}
