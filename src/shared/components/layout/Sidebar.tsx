import { NavLink } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/shared/components/ThemeToggle"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { UserMenu } from "@/shared/components/layout/UserMenu"
import { useAuthStore } from "@/shared/store/auth.store"

interface SidebarProps {
  className?: string
  variant?: "default" | "super_admin"
}

export function Sidebar({ className, variant = "default" }: SidebarProps) {
  const userRole = useAuthStore((state) => state.user?.role)
  const permissions = useAuthStore((state) => state.permissions)
  const items = getNavItemsByRole(userRole, permissions)
  const isSuperAdmin = variant === "super_admin"

  return (
    <aside className={cn(isSuperAdmin ? "bg-slate-100 dark:bg-slate-900/60" : "bg-background", className)}>
      <div className="flex h-16 items-center px-5">
        <NavLink to={userRole === "super_admin" ? "/admin" : "/dashboard"} className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            ET
          </span>
          <span className="text-sm font-semibold">EduTrack CI</span>
        </NavLink>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2">
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const count = item.badge?.() ?? 0

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                    isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
                  )
                }
              >
                <Icon size={18} strokeWidth={1.75} />
                <span>{item.label}</span>
                {count > 0 ? (
                  <Badge variant="destructive" className="ml-auto h-5 min-w-5 text-xs">
                    {count}
                  </Badge>
                ) : null}
              </NavLink>
            )
          })}
        </div>
      </nav>

      <div className="flex items-center border-t px-3 py-2">
        <div className="min-w-0 flex-1 pr-2">
          <UserMenu />
        </div>
        <ThemeToggle />
      </div>
    </aside>
  )
}
