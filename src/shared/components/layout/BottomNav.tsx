import { NavLink } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { getSmsFeatureSettings } from "@/modules/subscriptions/subscriptions.api"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { isStaffRole, useAuthStore } from "@/shared/store/auth.store"

export function BottomNav() {
  const userRole = useAuthStore((state) => state.user?.role)
  const permissions = useAuthStore((state) => state.permissions)
  const smsFeatureQuery = useQuery({
    queryKey: ["subscriptions", "feature-settings", "bottom-nav"],
    queryFn: getSmsFeatureSettings,
    staleTime: 60_000,
    enabled: userRole === "director" || isStaffRole(userRole),
  })
  const subscriptionsEnabled = smsFeatureQuery.data?.monetize_parent_alerts === true
  const items = getNavItemsByRole(userRole, permissions).filter((item) => {
    if (!item.mobileVisible) {
      return false
    }
    if (item.href === "/subscriptions" || item.href === "/subscriptions/revenue") {
      return subscriptionsEnabled
    }
    return true
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <ul className="grid h-full auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <li key={item.href} className="flex h-full items-center justify-center">
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-md px-1",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                <Icon size={22} className="fill-current" />
                <span className="text-[10px]">{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
