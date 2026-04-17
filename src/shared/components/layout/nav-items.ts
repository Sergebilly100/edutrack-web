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
    label: "Salles & QR",
    href: "/rooms",
    icon: RoomIcon,
    roles: ["director", "secretary"],
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

export function getNavItemsByRole(role: AuthRole | undefined): NavItem[] {
  if (!role) {
    return []
  }

  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
