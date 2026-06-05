import { useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  GraduationCap,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  UserCircle,
  Sun,
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
import { getSmsFeatureSettings } from "@/modules/subscriptions/subscriptions.api"
import { getPendingValidationCount } from "@/modules/validations/validations.api"
import { OfflineQueueBadge } from "@/shared/components/OfflineQueueBadge"
import { NotificationButton } from "@/shared/components/layout/NotificationButton"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { useTheme } from "@/shared/hooks/useTheme"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { getUserRoleLabel } from "@/shared/lib/user-role-label"
import { isStaffRole } from "@/shared/store/auth.store"
import { useAuthStore } from "@/shared/store/auth.store"
import { useSidebarStore } from "@/shared/store/sidebar.store"

function NavItemComponent({
  item,
  collapsed,
  badgeCount,
}: {
  item: ReturnType<typeof getNavItemsByRole>[number]
  collapsed: boolean
  badgeCount?: number
}) {
  const location = useLocation()
  const isActive = item.matchExact ? location.pathname === item.href : location.pathname.startsWith(item.href)

  const linkContent = (
    <Link
      to={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 min-h-[44px] text-sm font-medium",
        "transition-[background-color,color,box-shadow,transform] duration-150 ease-out-quint hover:bg-accent hover:text-accent-foreground active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
        isActive && "bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)] ring-1 ring-[var(--nav-active-border)]",
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
      {!collapsed && badgeCount && badgeCount > 0 ? (
        <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
          {badgeCount}
        </span>
      ) : null}
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
  const location = useLocation()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.logout)
  const permissions = useAuthStore((state) => state.permissions)
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed)
  const togglePinned = useSidebarStore((state) => state.togglePinned)
  const pinned = useSidebarStore((state) => state.pinned)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const studentLabels = useStudentLabels()

  const role = user?.role
  const smsFeatureQuery = useQuery({
    queryKey: ["subscriptions", "feature-settings", "sidebar"],
    queryFn: getSmsFeatureSettings,
    staleTime: 60_000,
    enabled: role === "director" || isStaffRole(role),
  })
  const subscriptionsEnabled = smsFeatureQuery.data?.monetize_parent_alerts === true
  const validationCountQuery = useQuery({
    queryKey: ["validations", "pending", "count", "sidebar"],
    queryFn: getPendingValidationCount,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: role === "director" || isStaffRole(role),
  })
  const visibleItems = getNavItemsByRole(role, permissions, studentLabels.plural).filter((item) => {
    if (item.href === "/subscriptions" || item.href === "/subscriptions/revenue") {
      return subscriptionsEnabled
    }
    return true
  })

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
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1a56db] shadow-sm">
              <GraduationCap className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <span className="truncate text-lg font-bold tracking-tight text-foreground">IvoirEdu</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && (
            <button
              type="button"
              onClick={handleTogglePinned}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 ease-out-quint hover:bg-accent active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
              aria-label={pinned ? "Désépingler" : "Épingler"}
            >
              {pinned ? <Pin className="w-4 h-4 text-primary" /> : <PinOff className="w-4 h-4 text-muted-foreground" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleCollapsed}
            className={cn(
              "hidden lg:flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 ease-out-quint active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
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
          <NavItemComponent
            key={item.href}
            item={item}
            collapsed={collapsed}
            badgeCount={item.href === "/validations" ? validationCountQuery.data?.total : undefined}
          />
        ))}
      </nav>

      {!collapsed && (
        <div className="space-y-1">
          <div className="flex justify-end px-2 pb-1">
            <OfflineQueueBadge />
          </div>
          {user?.role === "director" && location.pathname !== "/dashboard" ? (
            <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
              <span className="text-xs font-medium text-muted-foreground">Notifications</span>
              <NotificationButton />
            </div>
          ) : null}

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
                    "flex h-7 w-7 items-center justify-center rounded-md transition-[background-color,color,box-shadow,transform] duration-150 ease-out-quint active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
                    theme === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={value}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="space-y-1">
          {user?.role === "director" && location.pathname !== "/dashboard" ? <NotificationButton className="mx-auto" /> : null}
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 ease-out-quint hover:bg-accent active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            aria-label="Changer le thème"
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-auto flex w-full items-center gap-3 rounded-lg p-2",
              "cursor-pointer border-t pt-3 transition-[background-color,color,transform] duration-150 ease-out-quint hover:bg-accent active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
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
        "hidden lg:flex flex-col border-r bg-[hsl(var(--sidebar-bg))] shrink-0 h-screen sticky top-0",
        "transition-[width] duration-200 ease-out-expo motion-reduce:transition-none",
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
      <SheetContent side="left" className="w-[280px] bg-[hsl(var(--sidebar-bg))] p-0">
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
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 ease-out-quint hover:bg-accent active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      aria-label="Ouvrir le menu de navigation"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}

export const Sidebar = DesktopSidebar
