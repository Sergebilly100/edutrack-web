import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type TeacherProfile = {
  id: string
  name: string
  username: string
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
}

const getInitials = (value: string) => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) {
    return "?"
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

const getAvatarBackground = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return `hsl(${Math.abs(hash) % 360} 85% 92%)`
}

const formatHours = (value: number) => `${value}h`

export function TeacherProfileCard({
  teacher,
  monthStats,
  onBlock,
  onUnblock,
  onViewDocuments,
}: TeacherProfileCardProps) {
  const [isBlocking, setIsBlocking] = useState(false)
  const [isUnblocking, setIsUnblocking] = useState(false)
  const [openBlockDialog, setOpenBlockDialog] = useState(false)
  const isBlocked = monthStats.status === "blocked"

  return (
    <Card className="rounded-2xl border shadow-card">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full border border-border/60 text-xl font-semibold text-slate-700 dark:text-slate-100"
            style={{ backgroundColor: getAvatarBackground(teacher.name) }}
          >
            {getInitials(teacher.name)}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{teacher.name}</h3>
          <p className="text-sm text-muted-foreground">@{teacher.username}</p>
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

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => onViewDocuments(teacher.id)} className="flex-1">
            Voir documents
          </Button>

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
            <Dialog open={openBlockDialog} onOpenChange={setOpenBlockDialog}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" className="flex-1">
                  Bloquer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bloquer ce professeur ?</DialogTitle>
                  <DialogDescription>
                    Le compte sera désactivé temporairement pour les pointages et accès sensibles.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenBlockDialog(false)}>
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isBlocking}
                    onClick={async () => {
                      setIsBlocking(true)
                      try {
                        await onBlock(teacher.id)
                        setOpenBlockDialog(false)
                      } finally {
                        setIsBlocking(false)
                      }
                    }}
                  >
                    {isBlocking ? "Blocage..." : "Confirmer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
