import type { LucideIcon } from "lucide-react"

import {
  AdminIcon,
  AttendanceIcon,
  DashboardIcon,
  ImportIcon,
  RoomIcon,
  SalaryIcon,
  ScheduleIcon,
  SettingsIcon,
  StudentsIcon,
  TeachersIcon,
  ClassIcon,
} from "@/shared/components/icons"
import { BellRing, BookOpenCheck, Building2, ClipboardCheck, FileCheck2, FileSpreadsheet, GraduationCap, HandCoins, History, Landmark, LayoutDashboard, MessageSquareCode, NotebookPen, ReceiptText, Settings2, TrendingUp, User, WalletCards } from "lucide-react"

import { isStaffRole, type AuthRole, type PermissionKey } from "@/shared/store/auth.store"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  group: string
  badge?: () => number | undefined
  roles: AuthRole[]
  requiredPermissions?: PermissionKey[]
  requiredAnyPermissions?: PermissionKey[]
  mobileVisible: boolean
  matchExact?: boolean
  activePaths?: string[]
  requiresEndOfYearReview?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: DashboardIcon,
    group: "Pilotage",
    roles: ["director", "staff"],
    mobileVisible: true,
  },
  {
    label: "Validations",
    href: "/validations",
    icon: ClipboardCheck,
    group: "Pilotage",
    roles: ["director", "staff"],
    requiredPermissions: ["validations.view"],
    mobileVisible: true,
  },
  {
    label: "Inscriptions",
    href: "/enrollments",
    icon: FileCheck2,
    group: "Vie scolaire",
    roles: ["director", "staff"],
    requiredPermissions: ["enrollments.view"],
    mobileVisible: true,
  },
  {
    label: "Élèves",
    href: "/students",
    icon: StudentsIcon,
    group: "Vie scolaire",
    roles: ["director", "staff"],
    requiredPermissions: ["students.view"],
    mobileVisible: false,
  },
  {
    label: "Professeurs",
    href: "/teachers",
    icon: TeachersIcon,
    group: "Vie scolaire",
    roles: ["director", "staff"],
    requiredPermissions: ["teachers.view"],
    mobileVisible: false,
  },
  {
    label: "Emploi du temps",
    href: "/schedule",
    icon: ScheduleIcon,
    group: "Vie scolaire",
    roles: ["director", "staff"],
    requiredPermissions: ["schedule.view"],
    mobileVisible: false,
  },
  {
    label: "Salles",
    href: "/rooms",
    icon: RoomIcon,
    group: "Vie scolaire",
    roles: ["director", "staff"],
    requiredPermissions: ["rooms.view"],
    mobileVisible: false,
  },
  {
    label: "Structure",
    href: "/academic",
    icon: ClassIcon,
    group: "Académique",
    roles: ["director", "staff"],
    requiredAnyPermissions: ["school_years.view", "classes.view"],
    mobileVisible: false,
    activePaths: ["/academic", "/academic/school-years", "/academic/levels", "/academic/classes"],
  },
  {
    label: "Complétude",
    href: "/academic/completion",
    icon: ClipboardCheck,
    group: "Académique",
    roles: ["director", "staff"],
    requiredPermissions: ["report_cards.view"],
    mobileVisible: false,
  },
  {
    label: "Bulletins",
    href: "/academic/report-cards",
    icon: GraduationCap,
    group: "Académique",
    roles: ["director", "staff"],
    requiredPermissions: ["report_cards.view"],
    mobileVisible: false,
  },
  {
    label: "Fin d’année",
    href: "/end-of-year",
    icon: GraduationCap,
    group: "Académique",
    roles: ["director", "staff"],
    requiredPermissions: ["class_decisions.view"],
    mobileVisible: false,
    requiresEndOfYearReview: true,
  },
  {
    label: "Décision conduite",
    href: "/academic/conduct/decision",
    icon: ClipboardCheck,
    group: "Académique",
    roles: ["staff"],
    requiredPermissions: ["conduct.finalize"],
    mobileVisible: false,
  },
  {
    label: "Vue financière",
    href: "/finance?tab=dashboard",
    icon: LayoutDashboard,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["payments.view"],
    mobileVisible: true,
  },
  {
    label: "Encaissements",
    href: "/finance?tab=entry",
    icon: ReceiptText,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["payments.record"],
    mobileVisible: true,
  },
  {
    label: "Historique & reçus",
    href: "/finance?tab=history",
    icon: History,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["payments.view"],
    mobileVisible: false,
  },
  {
    label: "Journal & exports",
    href: "/finance?tab=journal",
    icon: WalletCards,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["payments.view"],
    mobileVisible: false,
  },
  {
    label: "Import paiements",
    href: "/finance?tab=import",
    icon: FileSpreadsheet,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["payments.record"],
    mobileVisible: false,
  },
  {
    label: "Frais & échéances",
    href: "/finance?tab=tuition",
    icon: BookOpenCheck,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["tuition.view"],
    mobileVisible: false,
  },
  {
    label: "Relances",
    href: "/finance?tab=alerts",
    icon: BellRing,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["payments.view"],
    mobileVisible: false,
  },
  {
    label: "Réglages finance",
    href: "/finance?tab=settings",
    icon: Settings2,
    group: "Finance",
    roles: ["director", "staff"],
    requiredAnyPermissions: ["settings.school", "subscription_plans.view"],
    mobileVisible: false,
  },
  {
    label: "Abonnements parents",
    href: "/subscriptions",
    icon: WalletCards,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["subscriptions.view"],
    mobileVisible: false,
    matchExact: true,
  },
  {
    label: "Revenus abonnements",
    href: "/subscriptions/revenue",
    icon: TrendingUp,
    group: "Finance",
    roles: ["director", "staff"],
    requiredPermissions: ["subscriptions.revenue"],
    mobileVisible: false,
  },
  {
    label: "Import courant",
    href: "/import",
    icon: ImportIcon,
    group: "Administration",
    roles: ["director", "staff"],
    requiredAnyPermissions: ["import.students", "import.teachers", "import.schedule"],
    mobileVisible: false,
  },
  {
    label: "Salaires",
    href: "/salaries",
    icon: SalaryIcon,
    group: "Administration",
    roles: ["director", "staff"],
    requiredPermissions: ["salary.view"],
    mobileVisible: false,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: SettingsIcon,
    group: "Administration",
    roles: ["director", "staff"],
    requiredAnyPermissions: [
      "settings.positions",
      "settings.school",
      "settings.sms_templates",
      "enrollments.view",
      "tuition.view",
      "payments.view",
      "subscription_plans.view",
    ],
    mobileVisible: false,
  },
  {
    label: "Mon planning",
    href: "/attendance",
    icon: AttendanceIcon,
    group: "Enseignement",
    roles: ["teacher"],
    mobileVisible: true,
  },
  {
    label: "Évaluations & notes",
    href: "/academic/notes",
    icon: NotebookPen,
    group: "Enseignement",
    roles: ["teacher"],
    mobileVisible: true,
  },
  {
    label: "Décision finale de conduite",
    href: "/academic/conduct/decision",
    icon: ClipboardCheck,
    group: "Enseignement",
    roles: ["teacher"],
    requiredPermissions: ["conduct.finalize"],
    mobileVisible: true,
  },
  {
    label: "Mon compte",
    href: "/account",
    icon: User,
    group: "Compte",
    roles: ["teacher"],
    mobileVisible: true,
  },
  {
    label: "Dashboard",
    href: "/admin",
    icon: AdminIcon,
    group: "Pilotage",
    roles: ["super_admin"],
    mobileVisible: true,
    matchExact: true,
  },
  {
    label: "Écoles",
    href: "/admin/schools",
    icon: Building2,
    group: "Pilotage",
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Plans & tarifs",
    href: "/admin/plans",
    icon: ReceiptText,
    group: "Plateforme",
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Pilotage SMS",
    href: "/admin/sms",
    icon: MessageSquareCode,
    group: "Plateforme",
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Revenus écoles",
    href: "/admin/revenue",
    icon: Landmark,
    group: "Plateforme",
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Revenus SMS",
    href: "/admin/revenuSms",
    icon: HandCoins,
    group: "Plateforme",
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Maintenance",
    href: "/admin/maintenance",
    icon: Settings2,
    group: "Plateforme",
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Mon compte",
    href: "/admin/account",
    icon: User,
    group: "Compte",
    roles: ["super_admin"],
    mobileVisible: false,
  },
]

export function isNavItemActive(item: NavItem, pathname: string, search: string): boolean {
  const [itemPath, itemQuery = ""] = item.href.split("?")

  if (item.activePaths) {
    return item.activePaths.includes(pathname)
  }

  if (itemQuery) {
    const expectedParams = new URLSearchParams(itemQuery)
    const currentParams = new URLSearchParams(search)
    return pathname === itemPath && [...expectedParams].every(([key, value]) => currentParams.get(key) === value)
  }

  if (item.matchExact) {
    return pathname === itemPath
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

const hasPermissions = (
  item: NavItem,
  permissionsSet: ReadonlySet<PermissionKey>
): boolean => {
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    const hasAll = item.requiredPermissions.every((permission) => permissionsSet.has(permission))
    if (!hasAll) {
      return false
    }
  }

  if (item.requiredAnyPermissions && item.requiredAnyPermissions.length > 0) {
    const hasOne = item.requiredAnyPermissions.some((permission) => permissionsSet.has(permission))
    if (!hasOne) {
      return false
    }
  }

  return true
}

const withStudentLabel = (items: NavItem[], studentPluralLabel: string | undefined): NavItem[] => {
  if (!studentPluralLabel) {
    return items
  }
  return items.map((item) =>
    item.href === "/students" ? { ...item, label: studentPluralLabel } : item,
  )
}

export function getNavItemsByRole(
  role: AuthRole | undefined,
  permissions: PermissionKey[] = [],
  studentPluralLabel?: string,
): NavItem[] {
  if (!role) {
    return []
  }

  const roleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))
  if (role === "director" || role === "super_admin") {
    return withStudentLabel(roleItems, studentPluralLabel)
  }

  if (!isStaffRole(role) && role !== "teacher") {
    return withStudentLabel(roleItems, studentPluralLabel)
  }

  const permissionsSet = new Set<PermissionKey>(permissions)
  return withStudentLabel(
    roleItems.filter((item) => hasPermissions(item, permissionsSet)),
    studentPluralLabel,
  )
}

export function filterNavItemsByFeatures(
  items: NavItem[],
  features: { subscriptionsEnabled: boolean; endOfYearReviewVisible: boolean },
): NavItem[] {
  return items.filter((item) => {
    if (item.href === "/subscriptions" || item.href === "/subscriptions/revenue") {
      return features.subscriptionsEnabled
    }
    if (item.requiresEndOfYearReview) {
      return features.endOfYearReviewVisible
    }
    return true
  })
}
