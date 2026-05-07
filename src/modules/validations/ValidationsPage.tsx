import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, CircleX, Info, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState, OfflineIndicator, emptyStateIcons } from "@/shared/components"
import {
  approveValidation,
  getPendingValidations,
  rejectValidation,
  type PendingValidationItem,
} from "./validations.api"

const formatMinutes = (minutes: number | null): string => {
  if (minutes === null) return "-"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest}min`
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`
}

const formatDate = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const formatTime = (value: string | null): string => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 5)
  return parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

const formatFcfa = (amount: number): string => `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}

function InfoBox({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

export default function ValidationsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [approveTarget, setApproveTarget] = useState<PendingValidationItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingValidationItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const pendingQuery = useQuery({
    queryKey: ["validations", "pending"],
    queryFn: getPendingValidations,
    staleTime: 30_000,
  })

  const groups = pendingQuery.data ?? { gps_suspicious: [], short_hours: [] }
  const total = groups.gps_suspicious.length + groups.short_hours.length

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["validations"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["salaries"] }),
    ])
  }

  const approveMutation = useMutation({
    mutationFn: approveValidation,
    onSuccess: async () => {
      setApproveTarget(null)
      await invalidate()
      toast({ title: "Validation enregistrée", description: "Les heures ont été mises à jour." })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: rejectValidation,
    onSuccess: async () => {
      setRejectTarget(null)
      setRejectReason("")
      await invalidate()
      toast({ title: "Présence refusée", description: "L'enseignant sera notifié." })
    },
  })

  const selectedAmount = useMemo(() => {
    if (!rejectTarget?.hourlyRate) return null
    return formatFcfa(rejectTarget.hourlyRate * (rejectTarget.scheduleDurationMinutes / 60))
  }, [rejectTarget])

  const renderGpsTable = (items: PendingValidationItem[]) => {
    if (pendingQuery.isLoading) return <LoadingRows />
    if (items.length === 0) {
      return <EmptyState icon={emptyStateIcons.allGood} title="Aucune présence suspecte" message="Les scans GPS hors périmètre apparaîtront ici." />
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Enseignant</TableHead>
              <TableHead>Cours</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Heure</TableHead>
              <TableHead>Écart GPS</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.attendanceId}>
                <TableCell className="font-medium">{item.teacherName}</TableCell>
                <TableCell>{item.courseName} • {item.className}</TableCell>
                <TableCell>{formatDate(item.date)}</TableCell>
                <TableCell>{formatTime(item.checkedInAt)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    {item.checkinDistance === null ? "Non mesuré" : `+${Math.round(item.checkinDistance)}m`}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-[48px]"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => setApproveTarget(item)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Valider
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="min-h-[48px]"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => setRejectTarget(item)}
                    >
                      <CircleX className="mr-2 h-4 w-4" />
                      Absent
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderShortHoursTable = (items: PendingValidationItem[]) => {
    if (pendingQuery.isLoading) return <LoadingRows />
    if (items.length === 0) {
      return <EmptyState icon={emptyStateIcons.allGood} title="Aucune heure courte" message="Les cours terminés trop tôt apparaîtront ici." />
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Enseignant</TableHead>
              <TableHead>Cours</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Prévu</TableHead>
              <TableHead>Effectué</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const plannedHours = item.scheduleDurationMinutes / 60
              const actualHours = (item.actualMinutes ?? 0) / 60
              const plannedAmount = item.hourlyRate === null ? null : item.hourlyRate * plannedHours
              const actualAmount = item.hourlyRate === null ? null : item.hourlyRate * actualHours
              return (
                <TableRow key={item.attendanceId}>
                  <TableCell className="font-medium">{item.teacherName}</TableCell>
                  <TableCell>{item.courseName} • {item.className}</TableCell>
                  <TableCell>{formatDate(item.date)}</TableCell>
                  <TableCell>{formatMinutes(item.scheduleDurationMinutes)}</TableCell>
                  <TableCell>{formatMinutes(item.actualMinutes)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-[48px]"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ attendanceId: item.attendanceId })}
                      >
                        Accorder {formatMinutes(item.scheduleDurationMinutes)}
                        {plannedAmount !== null ? ` - ${formatFcfa(plannedAmount)}` : ""}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-[48px]"
                        disabled={approveMutation.isPending || item.actualMinutes === null}
                        onClick={() =>
                          approveMutation.mutate({
                            attendanceId: item.attendanceId,
                            validatedHours: Math.round(actualHours * 100) / 100,
                          })
                        }
                      >
                        Accorder {formatMinutes(item.actualMinutes)}
                        {actualAmount !== null ? ` - ${formatFcfa(actualAmount)}` : ""}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <>
      <OfflineIndicator />
      <div className="space-y-6 animate-in fade-in duration-200">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Validation des horaires</h1>
          <p className="text-sm text-muted-foreground">{total} présence(s) en attente de décision.</p>
        </header>

        <Tabs defaultValue="gps" className="space-y-4">
          <TabsList>
            <TabsTrigger value="gps">Présences suspectes ({groups.gps_suspicious.length})</TabsTrigger>
            <TabsTrigger value="hours">Heures à valider ({groups.short_hours.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="gps" className="space-y-4">
            <InfoBox>Ces enseignants ont été détectés hors du périmètre de la salle au moment du scan. Vérifiez avec eux avant de valider.</InfoBox>
            {renderGpsTable(groups.gps_suspicious)}
          </TabsContent>
          <TabsContent value="hours" className="space-y-4">
            <InfoBox>Ces enseignants ont terminé leur cours avant l'heure prévue. Choisissez les heures à accorder.</InfoBox>
            {renderShortHoursTable(groups.short_hours)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={approveTarget !== null} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider la présence de {approveTarget?.teacherName}</DialogTitle>
            <DialogDescription>
              Les heures planifiées seront comptabilisées dans le salaire après confirmation.
            </DialogDescription>
          </DialogHeader>
          {approveTarget ? (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{approveTarget.courseName} • {approveTarget.className}</p>
              <p className="mt-1 text-muted-foreground">
                {formatDate(approveTarget.date)} à {formatTime(approveTarget.checkedInAt)}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={approveMutation.isPending || !approveTarget}
              onClick={() => {
                if (!approveTarget) return
                approveMutation.mutate({ attendanceId: approveTarget.attendanceId })
              }}
            >
              {approveMutation.isPending ? "Validation..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la présence de {rejectTarget?.teacherName}</DialogTitle>
            <DialogDescription>Une notification sera envoyée à l'enseignant avec ce motif.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Motif du refus"
            />
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{selectedAmount ? `Montant planifié concerné : ${selectedAmount}. ` : ""}Les heures refusées ne seront pas comptabilisées.</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending || rejectReason.trim().length < 3 || !rejectTarget}
              onClick={() => {
                if (!rejectTarget) return
                rejectMutation.mutate({ attendanceId: rejectTarget.attendanceId, reason: rejectReason.trim() })
              }}
            >
              {rejectMutation.isPending ? "Refus..." : "Confirmer refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
