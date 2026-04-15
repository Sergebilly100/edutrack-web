import type { LucideIcon } from "lucide-react"

import {
  AdminIcon,
  AttendanceIcon,
  DashboardIcon,
  ImportIcon,
  SalaryIcon,
  ScheduleIcon,
  SettingsIcon,
  StudentsIcon,
  TeachersIcon,
} from "@/shared/components/icons"

import type { AuthRole } from "@/shared/store/auth.store"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: () => number | undefined
  roles: AuthRole[]
  mobileVisible: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: DashboardIcon,
    roles: ["director", "secretary"],
    mobileVisible: true,
  },
  {
    label: "Emploi du temps",
    href: "/schedule",
    icon: ScheduleIcon,
    roles: ["director", "secretary"],
    mobileVisible: true,
  },
  {
    label: "Professeurs",
    href: "/teachers",
    icon: TeachersIcon,
    roles: ["director", "secretary"],
    mobileVisible: false,
  },
  {
    label: "Élèves",
    href: "/students",
    icon: StudentsIcon,
    roles: ["director", "secretary"],
    mobileVisible: false,
  },
  {
    label: "Salaires",
    href: "/salaries",
    icon: SalaryIcon,
    roles: ["director"],
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
    label: "Paramètres",
    href: "/settings",
    icon: SettingsIcon,
    roles: ["director"],
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
    label: "Console Admin",
    href: "/admin",
    icon: AdminIcon,
    roles: ["super_admin"],
    mobileVisible: true,
  },
]

export function getNavItemsByRole(role: AuthRole | undefined): NavItem[] {
  if (!role) {
    return []
  }

  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
