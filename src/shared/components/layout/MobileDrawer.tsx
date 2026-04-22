import { NavLink } from "react-router-dom"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { UserMenu } from "@/shared/components/layout/UserMenu"
import { useAuthStore } from "@/shared/store/auth.store"

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  variant?: "default" | "super_admin"
}

const navLinkClassName = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150"

export function MobileDrawer({ open, onClose, variant = "default" }: MobileDrawerProps) {
  const userRole = useAuthStore((state) => state.user?.role)
  const permissions = useAuthStore((state) => state.permissions)
  const items = getNavItemsByRole(userRole, permissions)
  const isSuperAdmin = variant === "super_admin"

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (nextOpen ? null : onClose())}>
      <SheetContent side="left" className={cn("w-[272px] p-0", isSuperAdmin ? "bg-slate-100 dark:bg-slate-900/80" : "")}>
        <div className="sr-only">
          <SheetTitle>Navigation principale</SheetTitle>
        </div>

        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center px-5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
              ET
            </span>
            <span className="ml-2 text-sm font-semibold">EduTrack CI</span>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-2">
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.matchExact === true}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(navLinkClassName, isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")
                    }
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </nav>

          <div className="border-t px-3 py-2">
            <UserMenu />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
