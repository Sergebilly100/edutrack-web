import type { LucideIcon } from "lucide-react"
import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react"

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
    icon: LayoutDashboard,
    roles: ["director", "secretary"],
    mobileVisible: true,
  },
  {
    label: "Emploi du temps",
    href: "/schedule",
    icon: CalendarDays,
    roles: ["director", "secretary"],
    mobileVisible: true,
  },
  {
    label: "Professeurs",
    href: "/teachers",
    icon: UsersRound,
    roles: ["director", "secretary"],
    mobileVisible: false,
  },
  {
    label: "Élèves",
    href: "/students",
    icon: GraduationCap,
    roles: ["director", "secretary"],
    mobileVisible: false,
  },
  {
    label: "Salaires",
    href: "/salaries",
    icon: Banknote,
    roles: ["director"],
    mobileVisible: true,
  },
  {
    label: "Import",
    href: "/import",
    icon: FileUp,
    roles: ["director"],
    mobileVisible: false,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
    roles: ["director"],
    mobileVisible: false,
  },
  {
    label: "Mon planning",
    href: "/attendance",
    icon: ClipboardCheck,
    roles: ["teacher"],
    mobileVisible: true,
  },
  {
    label: "Console Admin",
    href: "/admin",
    icon: ShieldCheck,
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
