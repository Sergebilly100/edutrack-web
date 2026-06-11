import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getAvatarColor, getInitials } from "@/shared/utils/avatar"
import { formatDecimalHours } from "../../../../edutrack-api/src/shared/utils/time"

type TeacherProfile = {
  id: string
  name: string
  username?: string
  phone?: string | null
  email?: string | null
  subjects?: string[]
  type: "vacataire" | "permanent"
  blockReason?: string
}

type MonthStats = {
  hours_done: number
  hours_planned: number
  attendance_rate: number
  status: "active" | "blocked"
}

type TeacherProfileCardProps = {
  teacher: TeacherProfile
  monthStats: MonthStats
  onBlock: (teacherId: string) => void | Promise<void>
  onUnblock: (teacherId: string) => void | Promise<void>
  onViewDocuments: (teacherId: string) => void
  canToggleBlocked?: boolean
}


const formatHours = (value: number) => formatDecimalHours(value)

export function TeacherProfileCard({
  teacher,
  monthStats,
  onBlock,
  onUnblock,
  onViewDocuments,
  canToggleBlocked = true,
}: TeacherProfileCardProps) {
  const [isUnblocking, setIsUnblocking] = useState(false)
  const isBlocked = monthStats.status === "blocked"

  return (
    <Card className="rounded-2xl border shadow-card">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full border border-border/60 text-xl font-semibold text-slate-700 dark:text-slate-700"
            style={{ backgroundColor: getAvatarColor(teacher.name) }}
          >
            {getInitials(teacher.name)}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{teacher.name}</h3>
          <p className="text-sm text-muted-foreground">
            {(teacher.subjects ?? []).length > 0 ? (teacher.subjects ?? []).join(", ") : "Aucune matière"}
          </p>
          <p className="text-sm text-muted-foreground">
            {teacher.phone?.trim() || "Téléphone non renseigné"}
          </p>
          <p className="text-sm text-muted-foreground break-all">
            {teacher.email?.trim() || "Email non renseigné"}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge
              variant="outline"
              className={
                teacher.type === "vacataire"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }
            >
              {teacher.type === "vacataire" ? "Vacataire" : "Permanent"}
            </Badge>
            <Badge
              variant="outline"
              className={
                isBlocked
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }
            >
              {isBlocked ? "Bloqué" : "Actif"}
            </Badge>
          </div>
        </div>

        {isBlocked ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {teacher.blockReason?.trim() || "Ce professeur est actuellement bloqué."}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Heures du mois</p>
            <p className="text-sm font-semibold tabular-nums">{formatHours(monthStats.hours_done)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Taux présence</p>
            <p className="text-sm font-semibold tabular-nums">{monthStats.attendance_rate}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Heures prévues</p>
            <p className="text-sm font-semibold tabular-nums">{formatHours(monthStats.hours_planned)}</p>
          </div>
        </div>

        {canToggleBlocked ? (
          <div className="flex flex-wrap gap-2">
          {/* <Button type="button" variant="outline" onClick={() => onViewDocuments(teacher.id)} className="flex-1">
            Voir documents
          </Button> */}

            {isBlocked ? (
              <Button
                type="button"
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
                disabled={isUnblocking}
                onClick={async () => {
                  setIsUnblocking(true)
                  try {
                    await onUnblock(teacher.id)
                  } finally {
                    setIsUnblocking(false)
                  }
                }}
              >
                {isUnblocking ? "Déblocage..." : "Débloquer"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => void onBlock(teacher.id)}
              >
                Bloquer
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
