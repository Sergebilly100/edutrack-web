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
import { Building2, ClipboardCheck, FileCheck2, GraduationCap, Landmark, HandCoins, MessageSquareCode, ReceiptText, Settings2, TrendingUp, User, WalletCards } from "lucide-react"

import { isStaffRole, type AuthRole, type PermissionKey } from "@/shared/store/auth.store"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: () => number | undefined
  roles: AuthRole[]
  requiredPermissions?: PermissionKey[]
  requiredAnyPermissions?: PermissionKey[]
  mobileVisible: boolean
  matchExact?: boolean
  requiresEndOfYearReview?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: DashboardIcon,
    roles: ["director", "staff"],
    mobileVisible: true,
  },
  {
    label: "Emploi du temps",
    href: "/schedule",
    icon: ScheduleIcon,
    roles: ["director", "staff"],
    requiredPermissions: ["schedule.view"],
    mobileVisible: true,
  },
  {
    label: "Professeurs",
    href: "/teachers",
    icon: TeachersIcon,
    roles: ["director", "staff"],
    requiredPermissions: ["teachers.view"],
    mobileVisible: false,
  },
  {
    label: "Élèves",
    href: "/students",
    icon: StudentsIcon,
    roles: ["director", "staff"],
    requiredPermissions: ["students.view"],
    mobileVisible: false,
  },
  {
    label: "Structure scolaire",
    href: "/academic",
    icon: ClassIcon,
    roles: ["director", "staff"],
    requiredAnyPermissions: ["school_years.view", "classes.view"],
    mobileVisible: false,
  },
  {
    label: "Fin d’année",
    href: "/end-of-year",
    icon: GraduationCap,
    roles: ["director", "staff"],
    requiredPermissions: ["class_decisions.view"],
    mobileVisible: false,
    requiresEndOfYearReview: true,
  },
  {
    label: "Inscriptions",
    href: "/enrollments",
    icon: FileCheck2,
    roles: ["director", "staff"],
    requiredAnyPermissions: ["enrollments.view", "enrollments.create", "enrollments.edit", "enrollments.confirm_payment"],
    mobileVisible: true,
  },
  {
    label: "Frais & paiements",
    href: "/finance",
    icon: ReceiptText,
    roles: ["director", "staff"],
    requiredAnyPermissions: ["tuition.view", "tuition.edit", "tuition.grant_discount", "payments.view", "payments.record", "payments.cancel", "subscription_plans.view", "subscription_plans.edit", "settings.school"],
    mobileVisible: true,
  },
  {
    label: "Salaires",
    href: "/salaries",
    icon: SalaryIcon,
    roles: ["director", "staff"],
    requiredPermissions: ["salary.view"],
    mobileVisible: true,
  },
  {
    label: "Validations",
    href: "/validations",
    icon: ClipboardCheck,
    roles: ["director", "staff"],
    requiredPermissions: ["validations.view"],
    mobileVisible: true,
  },
  {
    label: "Import",
    href: "/import",
    icon: ImportIcon,
    roles: ["director", "staff"],
    requiredAnyPermissions: ["import.students", "import.teachers", "import.schedule"],
    mobileVisible: false,
  },
  {
    label: "Salles & QR Codes",
    href: "/rooms",
    icon: RoomIcon,
    roles: ["director", "staff"],
    requiredPermissions: ["rooms.view"],
    mobileVisible: false,
  },
  {
    label: "Abonnements",
    href: "/subscriptions",
    icon: WalletCards,
    roles: ["director", "staff"],
    requiredPermissions: ["subscriptions.view"],
    mobileVisible: true,
    matchExact: true,
  },
  {
    label: "Revenus abonnements",
    href: "/subscriptions/revenue",
    icon: TrendingUp,
    roles: ["director", "staff"],
    requiredPermissions: ["subscriptions.revenue"],
    mobileVisible: false,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: SettingsIcon,
    roles: ["director", "staff"],
    requiredAnyPermissions: ["settings.positions", "settings.school", "settings.sms_templates", "enrollments.view"],
    mobileVisible: false,
  },
  {
    label: "Mon planning",
    href: "/attendance",
    icon: AttendanceIcon,
    roles: ["teacher"],
    mobileVisible: true,
  },
  {
    label: "Dashboard",
    href: "/admin",
    icon: AdminIcon,
    roles: ["super_admin"],
    mobileVisible: true,
    matchExact: true,
  },
  {
    label: "Écoles",
    href: "/admin/schools",
    icon: Building2,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Plan & Tarifs",
    href: "/admin/plans",
    icon: ReceiptText,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Pilotage SMS",
    href: "/admin/sms",
    icon: MessageSquareCode,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Revenus Écoles",
    href: "/admin/revenue",
    icon: Landmark,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Revenus SMS",
    href: "/admin/revenuSms",
    icon: HandCoins,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Maintenance",
    href: "/admin/maintenance",
    icon: Settings2,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Mon compte",
    href: "/admin/account",
    icon: User,
    roles: ["super_admin"],
    mobileVisible: false,
  },
]

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
  if (role === "director" || role === "super_admin" || role === "teacher") {
    return withStudentLabel(roleItems, studentPluralLabel)
  }

  if (!isStaffRole(role)) {
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
