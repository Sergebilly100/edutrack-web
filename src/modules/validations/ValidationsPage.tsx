import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleX, Info, Send, TriangleAlert } from "lucide-react"

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState, OfflineIndicator, emptyStateIcons } from "@/shared/components"
import { getCurrentMonth, getRecentMonthOptions, formatMonthLabel } from "@/shared/utils/month"
import {
  approveValidation,
  fetchMissingEndScans,
  getPendingValidations,
  invalidateSession,
  rejectValidation,
  sendEndScanWarning,
  type MissingEndScanTeacher,
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

  // End-scan tab state
  const [endScanMonth, setEndScanMonth] = useState(() => getCurrentMonth())
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null)
  const [invalidateTarget, setInvalidateTarget] = useState<{ attendanceId: string; teacherName: string; subject: string; date: string } | null>(null)
  const [invalidateReason, setInvalidateReason] = useState("")
  const endScanMonthOptions = useMemo(() => getRecentMonthOptions(getCurrentMonth(), 12), [])

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

  // End-scan queries/mutations
  const endScanQuery = useQuery({
    queryKey: ["validations", "missing-end-scans", endScanMonth],
    queryFn: () => fetchMissingEndScans(endScanMonth),
    staleTime: 60_000,
  })

  const warnMutation = useMutation({
    mutationFn: (teacherIds: string[]) => sendEndScanWarning(teacherIds, endScanMonth),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["validations", "missing-end-scans"] })
      toast({ title: "Avertissement envoyé", description: `${data.sentCount} enseignant(s) notifié(s).` })
    },
  })

  const invalidateMutation = useMutation({
    mutationFn: (params: { attendanceId: string; reason: string }) => invalidateSession(params.attendanceId, params.reason),
    onSuccess: async () => {
      setInvalidateTarget(null)
      setInvalidateReason("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["validations", "missing-end-scans"] }),
        queryClient.invalidateQueries({ queryKey: ["salaries"] }),
      ])
      toast({ title: "Cours invalidé", description: "Le cours ne sera pas comptabilisé." })
    },
  })

  const endScanTeachers = endScanQuery.data ?? []
  const endScanTotal = endScanTeachers.reduce((sum, t) => sum + t.missingEndScanCount, 0)

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

  const renderEndScanTab = () => {
    if (endScanQuery.isLoading) return <LoadingRows />
    if (endScanTeachers.length === 0) {
      return <EmptyState icon={emptyStateIcons.allGood} title="Aucun scan de fin manquant" message="Tous les enseignants ont effectué leur scan de fin pour ce mois." />
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{endScanTeachers.length} enseignant(s), {endScanTotal} cours sans scan de fin</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={warnMutation.isPending}
            onClick={() => warnMutation.mutate(endScanTeachers.map((t) => t.teacherId))}
          >
            <Send className="mr-2 h-4 w-4" />
            {warnMutation.isPending ? "Envoi..." : "Avertir tous"}
          </Button>
        </div>

        <div className="space-y-2">
          {endScanTeachers.map((teacher) => (
            <Collapsible
              key={teacher.teacherId}
              open={expandedTeacher === teacher.teacherId}
              onOpenChange={(open) => setExpandedTeacher(open ? teacher.teacherId : null)}
            >
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <CollapsibleTrigger className="flex items-center gap-2 text-left">
                  {expandedTeacher === teacher.teacherId ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{teacher.teacherName}</span>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    {teacher.missingEndScanCount} cours
                  </Badge>
                  {teacher.warningSent ? (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      Averti
                    </Badge>
                  ) : null}
                </CollapsibleTrigger>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={warnMutation.isPending}
                  onClick={() => warnMutation.mutate([teacher.teacherId])}
                >
                  <Send className="mr-2 h-3 w-3" />
                  Avertir
                </Button>
              </div>

              <CollapsibleContent>
                <div className="ml-6 mt-1 overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Matière</TableHead>
                        <TableHead>Créneau</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacher.sessions.map((session) => (
                        <TableRow key={session.attendanceId}>
                          <TableCell>{formatDate(session.date)}</TableCell>
                          <TableCell>{session.subject}</TableCell>
                          <TableCell>{session.timeSlot}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="min-h-[36px]"
                              onClick={() =>
                                setInvalidateTarget({
                                  attendanceId: session.attendanceId,
                                  teacherName: teacher.teacherName,
                                  subject: session.subject,
                                  date: session.date,
                                })
                              }
                            >
                              Ne pas comptabiliser
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
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
            <TabsTrigger value="end-scan">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              Scan de fin ({endScanTotal})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="gps" className="space-y-4">
            <InfoBox>Ces enseignants ont été détectés hors du périmètre de la salle au moment du scan. Vérifiez avec eux avant de valider.</InfoBox>
            {renderGpsTable(groups.gps_suspicious)}
          </TabsContent>
          <TabsContent value="hours" className="space-y-4">
            <InfoBox>Ces enseignants ont terminé leur cours avant l'heure prévue. Choisissez les heures à accorder.</InfoBox>
            {renderShortHoursTable(groups.short_hours)}
          </TabsContent>
          <TabsContent value="end-scan" className="space-y-4">
            <div className="flex items-center justify-between">
              <InfoBox>Ces enseignants ont pointé leur arrivée mais n'ont pas effectué le scan de fin de cours.</InfoBox>
              <Select value={endScanMonth} onValueChange={setEndScanMonth}>
                <SelectTrigger className="ml-4 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {endScanMonthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderEndScanTab()}
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

      <Dialog open={invalidateTarget !== null} onOpenChange={(open) => !open && setInvalidateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ne pas comptabiliser ce cours</DialogTitle>
            <DialogDescription>
              {invalidateTarget?.teacherName} — {invalidateTarget?.subject} du {invalidateTarget ? formatDate(invalidateTarget.date) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={invalidateReason}
              onChange={(event) => setInvalidateReason(event.target.value)}
              placeholder="Motif (ex: enseignant absent, scan oublié...)"
            />
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Ce cours sera marqué comme &quot;non comptabilisé&quot; et l&apos;enseignant sera notifié.</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInvalidateTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={invalidateMutation.isPending || invalidateReason.trim().length < 3 || !invalidateTarget}
              onClick={() => {
                if (!invalidateTarget) return
                invalidateMutation.mutate({ attendanceId: invalidateTarget.attendanceId, reason: invalidateReason.trim() })
              }}
            >
              {invalidateMutation.isPending ? "En cours..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
