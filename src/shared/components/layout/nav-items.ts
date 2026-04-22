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
} from "@/shared/components/icons"
import { Building2, MessageSquare, Settings2, TrendingUp, User } from "lucide-react"

import type { AuthRole, PermissionKey } from "@/shared/store/auth.store"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: () => number | undefined
  roles: AuthRole[]
  requiredPermissions?: PermissionKey[]
  requiredAnyPermissions?: PermissionKey[]
  mobileVisible: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: DashboardIcon,
    roles: ["director", "secretary"],
    requiredPermissions: ["attendance.view"],
    mobileVisible: true,
  },
  {
    label: "Emploi du temps",
    href: "/schedule",
    icon: ScheduleIcon,
    roles: ["director", "secretary"],
    requiredPermissions: ["schedule.view"],
    mobileVisible: true,
  },
  {
    label: "Professeurs",
    href: "/teachers",
    icon: TeachersIcon,
    roles: ["director", "secretary"],
    requiredPermissions: ["teachers.view"],
    mobileVisible: false,
  },
  {
    label: "Élèves",
    href: "/students",
    icon: StudentsIcon,
    roles: ["director", "secretary"],
    requiredPermissions: ["students.view"],
    mobileVisible: false,
  },
  {
    label: "Salaires",
    href: "/salaries",
    icon: SalaryIcon,
    roles: ["director"],
    requiredPermissions: ["salary.view"],
    mobileVisible: true,
  },
  {
    label: "Import",
    href: "/import",
    icon: ImportIcon,
    roles: ["director"],
    mobileVisible: false,
  },
  {
    label: "Salles & QR Codes",
    href: "/rooms",
    icon: RoomIcon,
    roles: ["director", "secretary"],
    requiredPermissions: ["schedule.edit"],
    mobileVisible: false,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: SettingsIcon,
    roles: ["director", "secretary"],
    requiredAnyPermissions: ["settings.positions", "settings.school"],
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
  },
  {
    label: "Écoles",
    href: "/admin/schools",
    icon: Building2,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "Revenus",
    href: "/admin/revenue",
    icon: TrendingUp,
    roles: ["super_admin"],
    mobileVisible: true,
  },
  {
    label: "SMS & Notifs",
    href: "/admin/sms",
    icon: MessageSquare,
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

export function getNavItemsByRole(
  role: AuthRole | undefined,
  permissions: PermissionKey[] = []
): NavItem[] {
  if (!role) {
    return []
  }

  const roleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))
  if (role === "director" || role === "super_admin" || role === "teacher") {
    return roleItems
  }

  const permissionsSet = new Set<PermissionKey>(permissions)
  return roleItems.filter((item) => hasPermissions(item, permissionsSet))
}
