import { NavLink } from "react-router-dom"

import { cn } from "@/lib/utils"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { useAuthStore } from "@/shared/store/auth.store"

export function BottomNav() {
  const userRole = useAuthStore((state) => state.user?.role)
  const permissions = useAuthStore((state) => state.permissions)
  const items = getNavItemsByRole(userRole, permissions).filter((item) => item.mobileVisible)

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
