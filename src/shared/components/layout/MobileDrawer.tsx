import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { getSmsFeatureSettings } from "@/modules/subscriptions/subscriptions.api"
import { useEndOfYearReviewStatus } from "@/modules/class-decisions/useEndOfYearReviewStatus"
import { filterNavItemsByFeatures, getNavItemsByRole, isNavItemActive } from "@/shared/components/layout/nav-items"
import { UserMenu } from "@/shared/components/layout/UserMenu"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { isStaffRole, useAuthStore } from "@/shared/store/auth.store"

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  variant?: "default" | "super_admin"
}

const navLinkClassName = "flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150"

export function MobileDrawer({ open, onClose, variant = "default" }: MobileDrawerProps) {
  const userRole = useAuthStore((state) => state.user?.role)
  const permissions = useAuthStore((state) => state.permissions)
  const studentLabels = useStudentLabels()
  const location = useLocation()
  const isSuperAdmin = variant === "super_admin"
  const smsFeatureQuery = useQuery({
    queryKey: ["subscriptions", "feature-settings", "mobile-drawer"],
    queryFn: getSmsFeatureSettings,
    staleTime: 60_000,
    enabled: !isSuperAdmin && (userRole === "director" || isStaffRole(userRole)),
  })
  const subscriptionsEnabled = smsFeatureQuery.data?.monetize_parent_alerts === true
  const endOfYearStatusQuery = useEndOfYearReviewStatus()
  const items = filterNavItemsByFeatures(
    getNavItemsByRole(userRole, permissions, studentLabels.plural),
    { subscriptionsEnabled, endOfYearReviewVisible: endOfYearStatusQuery.data?.visible === true },
  )
  const navigationGroups = items.reduce<Array<{ label: string; items: typeof items }>>(
    (groups, item) => {
      const current = groups[groups.length - 1]
      if (current?.label === item.group) current.items.push(item)
      else groups.push({ label: item.group, items: [item] })
      return groups
    },
    [],
  )
  const activeGroup = navigationGroups.find((group) =>
    group.items.some((item) => isNavItemActive(item, location.pathname, location.search)),
  )?.label
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  const toggleGroup = (groupLabel: string) => {
    if (groupLabel === activeGroup) return
    setExpandedGroup((current) => current === groupLabel ? null : groupLabel)
  }

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
            <span className="ml-2 text-sm font-semibold">IvoirEdu</span>
          </div>

          <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
            <div className="space-y-2">
              {navigationGroups.map((group) => (
                <Collapsible
                  key={group.label}
                  open={group.label === expandedGroup || group.label === activeGroup}
                  onOpenChange={() => toggleGroup(group.label)}
                  className="space-y-1"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {group.label}
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-150 data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon

                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={onClose}
                          className={cn(
                            navLinkClassName,
                            isNavItemActive(item, location.pathname, location.search)
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <Icon size={18} strokeWidth={1.75} />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </CollapsibleContent>
                </Collapsible>
              ))}
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
