export const FINANCE_PATHS = {
  dashboard: "/finance/dashboard",
  entry: "/finance/encaissements",
  history: "/finance/history",
  historyDetail: (studentId: string) => `/finance/history/${studentId}`,
  journal: "/finance/journal",
} as const

export type FinanceView = "dashboard" | "entry" | "history" | "journal"

export function getFinancePathFromLegacyTab(tab: string | null): string {
  switch (tab) {
    case "entry":
      return FINANCE_PATHS.entry
    case "import":
      return FINANCE_PATHS.journal
    case "history":
      return FINANCE_PATHS.history
    case "journal":
      return FINANCE_PATHS.journal
    case "dashboard":
    default:
      return FINANCE_PATHS.dashboard
  }
}
