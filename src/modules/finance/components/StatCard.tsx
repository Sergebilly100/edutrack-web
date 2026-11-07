import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardProps = { title: string; children: ReactNode; className?: string; headerExtra?: ReactNode; "aria-label"?: string }

/** Carte de chiffre clé : fond blanc (token card), bordure fine, sans ombre marquée. */
export function StatCard({ title, children, className, headerExtra, ...rest }: StatCardProps) {
  return <Card className={cn("rounded-lg border bg-card shadow-none", className)} {...rest}>
    <CardContent className="space-y-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-muted-foreground">{title}</p>{headerExtra}</div>
      {children}
    </CardContent>
  </Card>
}
