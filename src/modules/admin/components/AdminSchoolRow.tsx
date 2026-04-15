import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type AdminSchoolRowItem = {
  id: string
  name: string
  city: string
  plan: "essential" | "pro" | "establishment"
  status: "trial" | "active" | "suspended" | "cancelled"
  usersCount: number
  lastConnectionAt: string | null
  mrrFcfa: number
}

type AdminSchoolRowProps = {
  school: AdminSchoolRowItem
  onViewDetail: (school: AdminSchoolRowItem) => void
  onOpenConfig: (school: AdminSchoolRowItem) => void
}

const formatRelativeDate = (isoDate: string | null) => {
  if (!isoDate) {
    return "jamais"
  }

  const now = Date.now()
  const target = new Date(isoDate).getTime()
  const deltaMs = Math.max(0, now - target)
  const days = Math.floor(deltaMs / (1000 * 60 * 60 * 24))

  if (days < 1) {
    const hours = Math.floor(deltaMs / (1000 * 60 * 60))
    if (hours < 1) {
      return "il y a quelques minutes"
    }

    return `il y a ${hours}h`
  }

  if (days < 7) {
    return `il y a ${days}j`
  }

  return new Date(isoDate).toLocaleDateString("fr-FR")
}

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`

const planClassName = (plan: AdminSchoolRowItem["plan"]) => {
  if (plan === "pro") {
    return "border-blue-200 bg-blue-50 text-blue-700"
  }

  if (plan === "establishment") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  return "border-slate-200 bg-slate-50 text-slate-700"
}

const statusClassName = (status: AdminSchoolRowItem["status"]) => {
  if (status === "active") {
    return "border-green-200 bg-green-50 text-green-700"
  }

  if (status === "trial") {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }

  if (status === "suspended") {
    return "border-red-200 bg-red-50 text-red-700"
  }

  return "border-slate-200 bg-slate-100 text-slate-700"
}

export default function AdminSchoolRow({ school, onViewDetail, onOpenConfig }: AdminSchoolRowProps) {
  return (
    <TableRow
      className={cn(
        "group",
        school.status === "suspended" && "bg-slate-100/70 text-muted-foreground hover:bg-slate-200/60"
      )}
    >
      <TableCell>
        <div className="space-y-1">
          <p className="text-sm font-medium">{school.name}</p>
          <p className="text-xs text-muted-foreground">{school.city}</p>
        </div>
      </TableCell>

      <TableCell>
        <Badge variant="outline" className={cn("capitalize", planClassName(school.plan))}>
          {school.plan}
        </Badge>
      </TableCell>

      <TableCell>
        <Badge variant="outline" className={cn("capitalize", statusClassName(school.status))}>
          {school.status}
        </Badge>
      </TableCell>

      <TableCell className="text-sm">{school.usersCount}</TableCell>
      <TableCell className="text-sm">{formatRelativeDate(school.lastConnectionAt)}</TableCell>
      <TableCell className="text-sm font-medium">{formatFcfa(school.mrrFcfa)}</TableCell>

      <TableCell>
        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button size="sm" variant="outline" onClick={() => onViewDetail(school)}>
            Voir détail
          </Button>
          <Button size="sm" onClick={() => onOpenConfig(school)}>
            Config
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
