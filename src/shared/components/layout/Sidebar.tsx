import { useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import {
  Building2,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  ReceiptText,
  QrCode,
  Settings2,
  TrendingUp,
  Upload,
  User,
  UserCircle,
  Users,
  Wallet,
  Sun,
  type LucideIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { logout as logoutApi } from "@/modules/auth/auth.api"
import { useTheme } from "@/shared/hooks/useTheme"
import { getUserRoleLabel } from "@/shared/lib/user-role-label"
import { isStaffRole, type AuthRole, type PermissionKey } from "@/shared/store/auth.store"
import { useAuthStore } from "@/shared/store/auth.store"
import { useSidebarStore } from "@/shared/store/sidebar.store"

type UserRole = Exclude<AuthRole, "teacher">

type NavItem = {
  label: string
  icon: LucideIcon
  href: string
  roles: UserRole[]
  requiredPermissions?: PermissionKey[]
  requiredAnyPermissions?: PermissionKey[]
  matchExact?: boolean
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", icon: LayoutDashboard, href: "/dashboard", roles: ["director", "staff"] },
  {
    label: "Emploi du temps",
    icon: CalendarDays,
    href: "/schedule",
    roles: ["director", "staff"],
    requiredPermissions: ["schedule.view"],
  },
  {
    label: "Professeurs",
    icon: Users,
    href: "/teachers",
    roles: ["director", "staff"],
    requiredPermissions: ["teachers.view"],
  },
  {
    label: "Élèves",
    icon: GraduationCap,
    href: "/students",
    roles: ["director", "staff"],
    requiredPermissions: ["students.view"],
  },
  { label: "Salaires", icon: Wallet, href: "/salaries", roles: ["director"] },
  { label: "Import", icon: Upload, href: "/import", roles: ["director"] },
  {
    label: "Salles & QR Codes",
    icon: QrCode,
    href: "/rooms",
    roles: ["director", "staff"],
    requiredPermissions: ["schedule.edit"],
  },
  {
    label: "Paramètres",
    icon: Settings2,
    href: "/settings",
    roles: ["director", "staff"],
    requiredAnyPermissions: ["settings.positions", "settings.school", "settings.sms_templates"],
  },
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin",
    roles: ["super_admin"],
    matchExact: true,
  },
  { label: "Écoles", icon: Building2, href: "/admin/schools", roles: ["super_admin"] },
  { label: "Revenus", icon: TrendingUp, href: "/admin/revenue", roles: ["super_admin"] },
  { label: "Plan & Tarifs", icon: ReceiptText, href: "/admin/plans", roles: ["super_admin"] },
  { label: "SMS & Notifs", icon: MessageSquare, href: "/admin/sms", roles: ["super_admin"] },
  { label: "Maintenance", icon: Settings2, href: "/admin/maintenance", roles: ["super_admin"] },
  { label: "Mon compte", icon: User, href: "/admin/account", roles: ["super_admin"] },
]

function canAccessItem(item: NavItem, role: UserRole, permissions: PermissionKey[]): boolean {
  if (!item.roles.includes(role)) {
    return false
  }

  if (!isStaffRole(role)) {
    return true
  }

  const permissionSet = new Set<PermissionKey>(permissions)
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    const hasAll = item.requiredPermissions.every((permission) => permissionSet.has(permission))
    if (!hasAll) {
      return false
    }
  }

  if (item.requiredAnyPermissions && item.requiredAnyPermissions.length > 0) {
    return item.requiredAnyPermissions.some((permission) => permissionSet.has(permission))
  }

  return true
}

function isSidebarRole(role: AuthRole | undefined): role is UserRole {
  return role === "director" || isStaffRole(role) || role === "super_admin"
}

function NavItemComponent({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation()
  const isActive = item.matchExact ? location.pathname === item.href : location.pathname.startsWith(item.href)

  const linkContent = (
    <Link
      to={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 min-h-[44px] text-sm font-medium",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground",
        collapsed && "justify-center px-0 w-11"
      )}
    >
      <item.icon className="w-[18px] h-[18px] shrink-0" />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {item.label}
      </span>
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.logout)
  const permissions = useAuthStore((state) => state.permissions)
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed)
  const togglePinned = useSidebarStore((state) => state.togglePinned)
  const pinned = useSidebarStore((state) => state.pinned)
  const { theme, setTheme, resolvedTheme } = useTheme()

  const role = user?.role
  const visibleItems = isSidebarRole(role) ? navItems.filter((item) => canAccessItem(item, role, permissions)) : []

  const handleTogglePinned = () => {
    if (!pinned && collapsed) {
      toggleCollapsed()
    }
    togglePinned()
  }

  const handleToggleCollapsed = () => {
    if (pinned) {
      return
    }
    toggleCollapsed()
  }

  const handleLogout = async (): Promise<void> => {
    try {
      await logoutApi()
    } finally {
      clearSession()
      queryClient.clear()
      navigate("/login", { replace: true })
    }
  }

  return (
    <div className="flex h-full flex-col gap-1 p-2">
      <div className={cn("flex items-center min-h-[52px] mb-1", collapsed ? "justify-center flex-col gap-1" : "justify-between px-1")}>
        {!collapsed && <span className="text-sm font-semibold tracking-tight">EduTrack CI</span>}
        <div className="flex items-center gap-1">
          {!collapsed && (
            <button
              type="button"
              onClick={handleTogglePinned}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors"
              aria-label={pinned ? "Désépingler" : "Épingler"}
            >
              {pinned ? <Pin className="w-4 h-4 text-primary" /> : <PinOff className="w-4 h-4 text-muted-foreground" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleCollapsed}
            className={cn(
              "hidden lg:flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              pinned ? "text-muted-foreground/60" : "hover:bg-accent"
            )}
            aria-label={collapsed ? "Ouvrir" : "Réduire"}
            disabled={pinned}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1 min-w-0">
        {visibleItems.map((item) => (
          <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {!collapsed && (
        <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
          <span className="text-xs font-medium text-muted-foreground">Thème</span>
          <div className="flex gap-0.5">
            {([
              { value: "light", icon: Sun },
              { value: "dark", icon: Moon },
              { value: "system", icon: Monitor },
            ] as const).map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  theme === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={value}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {collapsed && (
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent"
          aria-label="Changer le thème"
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-auto flex w-full items-center gap-3 rounded-lg p-2",
              "cursor-pointer border-t pt-3 transition-colors hover:bg-accent",
              collapsed && "justify-center"
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user?.profilePhotoUrl ?? undefined} alt={user?.name ?? "Utilisateur"} />
              <AvatarFallback className="text-xs">{user?.name?.slice(0, 2).toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "overflow-hidden text-left transition-all duration-200 min-w-0",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            >
              <p className="truncate text-sm font-medium leading-none">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{getUserRoleLabel(user)}</p>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="mb-1 w-52">
          <DropdownMenuItem onClick={() => navigate("/account")}>
            <UserCircle className="mr-2 h-4 w-4" />
            Mon compte
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void handleLogout()}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function DesktopSidebar() {
  const collapsed = useSidebarStore((state) => state.collapsed)
  const pinned = useSidebarStore((state) => state.pinned)
  const effectiveCollapsed = pinned ? false : collapsed

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r bg-background shrink-0 h-screen sticky top-0",
        "transition-[width] duration-200 ease-in-out",
        effectiveCollapsed ? "w-[56px]" : "w-[240px]"
      )}
    >
      <SidebarContent collapsed={effectiveCollapsed} />
    </aside>
  )
}

export function MobileSidebar() {
  const mobileOpen = useSidebarStore((state) => state.mobileOpen)
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, setMobileOpen])

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[280px] p-0">
        <div className="sr-only">
          <SheetTitle>Navigation principale</SheetTitle>
        </div>
        <SidebarContent collapsed={false} />
      </SheetContent>
    </Sheet>
  )
}

export function MobileMenuButton() {
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen)

  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors"
      aria-label="Ouvrir le menu de navigation"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}

export const Sidebar = DesktopSidebar
