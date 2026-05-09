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
  applyEndScanAction,
  approveValidation,
  cancelEndScanSanction,
  fetchMissingEndScans,
  getPendingValidations,
  rejectValidation,
  sendEndScanWarning,
  type EndScanAction,
  type MissingEndScanSession,
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

type ApproveShortHoursTarget = {
  item: PendingValidationItem
  validatedHours?: number
  label: string
}

type EndScanActionTarget = {
  session: MissingEndScanSession
  teacher: MissingEndScanTeacher
  action: EndScanAction
}

type CancelSanctionTarget = {
  session: MissingEndScanSession
  teacher: MissingEndScanTeacher
}

function EndScanStatusBadge({ session }: { session: MissingEndScanSession }) {
  if (!session.endScanAction) return null

  if (session.endScanActionCancelledAt) {
    return (
      <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
        Sanction annulée
      </Badge>
    )
  }

  if (session.endScanAction === "warned") {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        Averti
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
      Sanctionné
    </Badge>
  )
}

export default function ValidationsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [approveTarget, setApproveTarget] = useState<PendingValidationItem | null>(null)
  const [approveShortHoursTarget, setApproveShortHoursTarget] = useState<ApproveShortHoursTarget | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingValidationItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  // End-scan tab state
  const [endScanMonth, setEndScanMonth] = useState(() => getCurrentMonth())
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null)
  const [endScanActionTarget, setEndScanActionTarget] = useState<EndScanActionTarget | null>(null)
  const [cancelSanctionTarget, setCancelSanctionTarget] = useState<CancelSanctionTarget | null>(null)
  const [cancelSanctionReason, setCancelSanctionReason] = useState("")
  const endScanMonthOptions = useMemo(() => getRecentMonthOptions(getCurrentMonth(), 12), [])

  const pendingQuery = useQuery({
    queryKey: ["validations", "pending"],
    queryFn: getPendingValidations,
    staleTime: 30_000,
  })

  const groups = pendingQuery.data ?? { gps_suspicious: [], short_hours: [] }
  const total = groups.gps_suspicious.length + groups.short_hours.length

  const invalidateQueries = async () => {
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
      await invalidateQueries()
      toast({ title: "Validation enregistrée", description: "Les heures ont été mises à jour." })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: rejectValidation,
    onSuccess: async () => {
      setRejectTarget(null)
      setRejectReason("")
      await invalidateQueries()
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

  const endScanActionMutation = useMutation({
    mutationFn: (input: { attendanceId: string; action: EndScanAction; reason: string }) =>
      applyEndScanAction(input),
    onSuccess: async (_, variables) => {
      setEndScanActionTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["validations", "missing-end-scans"] }),
        queryClient.invalidateQueries({ queryKey: ["salaries"] }),
      ])
      const label = variables.action === "warned" ? "Avertissement enregistré" : "Sanction enregistrée"
      const desc =
        variables.action === "warned"
          ? "L'enseignant a été averti. Son salaire reste intact."
          : "Le cours ne sera pas comptabilisé. L'enseignant doit se rendre à l'administration."
      toast({ title: label, description: desc })
    },
  })

  const cancelSanctionMutation = useMutation({
    mutationFn: (input: { attendanceId: string; reason: string }) => cancelEndScanSanction(input),
    onSuccess: async () => {
      setCancelSanctionTarget(null)
      setCancelSanctionReason("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["validations", "missing-end-scans"] }),
        queryClient.invalidateQueries({ queryKey: ["salaries"] }),
      ])
      toast({ title: "Sanction annulée", description: "L'enseignant a été informé de l'annulation." })
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
              <TableHead>Créneau</TableHead>
              <TableHead>Salle</TableHead>
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
                <TableCell>{item.slotLabel ?? "-"}</TableCell>
                <TableCell>{item.roomName ?? "-"}</TableCell>
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
              <TableHead>Créneau</TableHead>
              <TableHead>Salle</TableHead>
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
                  <TableCell>{item.slotLabel ?? "-"}</TableCell>
                  <TableCell>{item.roomName ?? "-"}</TableCell>
                  <TableCell>{formatMinutes(item.scheduleDurationMinutes)}</TableCell>
                  <TableCell>{formatMinutes(item.actualMinutes)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-[48px]"
                        disabled={approveMutation.isPending}
                        onClick={() =>
                          setApproveShortHoursTarget({
                            item,
                            validatedHours: undefined,
                            label: `${formatMinutes(item.scheduleDurationMinutes)}${plannedAmount !== null ? ` — ${formatFcfa(plannedAmount)}` : ""}`,
                          })
                        }
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
                          setApproveShortHoursTarget({
                            item,
                            validatedHours: Math.round(actualHours * 100) / 100,
                            label: `${formatMinutes(item.actualMinutes)}${actualAmount !== null ? ` — ${formatFcfa(actualAmount)}` : ""}`,
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
                  {teacher.warningCount > 0 ? (
                    <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                      {teacher.warningCount} avertissement{teacher.warningCount > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                  {teacher.sanctionCount > 0 ? (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                      {teacher.sanctionCount} sanction{teacher.sanctionCount > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                  {teacher.warningSent ? (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      Notifié
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
                        <TableHead>Salle</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacher.sessions.map((session) => {
                        const hasActiveAction =
                          session.endScanAction !== null && session.endScanActionCancelledAt === null
                        const isSanctioned =
                          session.endScanAction === "sanctioned" && session.endScanActionCancelledAt === null

                        return (
                          <TableRow key={session.attendanceId}>
                            <TableCell>{formatDate(session.date)}</TableCell>
                            <TableCell>{session.subject}</TableCell>
                            <TableCell>{session.timeSlot}</TableCell>
                            <TableCell>{session.roomName ?? "-"}</TableCell>
                            <TableCell>
                              <EndScanStatusBadge session={session} />
                            </TableCell>
                            <TableCell className="text-right">
                              {hasActiveAction ? (
                                isSanctioned ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="min-h-[36px] text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => setCancelSanctionTarget({ session, teacher })}
                                  >
                                    Annuler la sanction
                                  </Button>
                                ) : null
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="min-h-[36px] text-amber-700 border-amber-200 hover:bg-amber-50"
                                    disabled={endScanActionMutation.isPending}
                                    onClick={() =>
                                      setEndScanActionTarget({ session, teacher, action: "warned" })
                                    }
                                  >
                                    Tolérer avec avertissement
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="min-h-[36px]"
                                    disabled={endScanActionMutation.isPending}
                                    onClick={() =>
                                      setEndScanActionTarget({ session, teacher, action: "sanctioned" })
                                    }
                                  >
                                    Sanctionner
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
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

      {/* ── Modale confirmation accordé heures courtes ──────────────────────── */}
      <Dialog open={approveShortHoursTarget !== null} onOpenChange={(open) => !open && setApproveShortHoursTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'accord d'heures</DialogTitle>
            <DialogDescription>
              Cette action sera enregistrée dans le calcul de salaire de {approveShortHoursTarget?.item.teacherName}.
            </DialogDescription>
          </DialogHeader>
          {approveShortHoursTarget ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{approveShortHoursTarget.item.courseName} • {approveShortHoursTarget.item.className}</p>
                <p className="mt-1 text-muted-foreground">{formatDate(approveShortHoursTarget.item.date)}</p>
                {approveShortHoursTarget.item.slotLabel ? (
                  <p className="mt-0.5 text-muted-foreground">Créneau : {approveShortHoursTarget.item.slotLabel}</p>
                ) : null}
                {approveShortHoursTarget.item.roomName ? (
                  <p className="mt-0.5 text-muted-foreground">Salle : {approveShortHoursTarget.item.roomName}</p>
                ) : null}
              </div>
              <p className="text-sm font-medium">Heures accordées : {approveShortHoursTarget.label}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveShortHoursTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={approveMutation.isPending || !approveShortHoursTarget}
              onClick={() => {
                if (!approveShortHoursTarget) return
                approveMutation.mutate({
                  attendanceId: approveShortHoursTarget.item.attendanceId,
                  validatedHours: approveShortHoursTarget.validatedHours,
                })
                setApproveShortHoursTarget(null)
              }}
            >
              {approveMutation.isPending ? "Validation..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale valider présence suspecte ────────────────────────────────── */}
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

      {/* ── Modale refuser présence suspecte ────────────────────────────────── */}
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

      {/* ── Modale action scan de fin (Avertir / Sanctionner) ───────────────── */}
      <Dialog
        open={endScanActionTarget !== null}
        onOpenChange={(open) => !open && setEndScanActionTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {endScanActionTarget?.action === "warned"
                ? "Tolérer avec avertissement"
                : "Sanctionner l'enseignant"}
            </DialogTitle>
            <DialogDescription>
              {endScanActionTarget?.teacher.teacherName} — {endScanActionTarget?.session.subject} du{" "}
              {endScanActionTarget ? formatDate(endScanActionTarget.session.date) : ""}
            </DialogDescription>
          </DialogHeader>
          {endScanActionTarget ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 text-sm space-y-1">
                <p className="text-muted-foreground">Créneau : {endScanActionTarget.session.timeSlot}</p>
                {endScanActionTarget.session.roomName ? (
                  <p className="text-muted-foreground">Salle : {endScanActionTarget.session.roomName}</p>
                ) : null}
              </div>
              {endScanActionTarget.action === "warned" ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Le salaire de l'enseignant reste intact. Un message d'avertissement lui sera envoyé.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Ce cours ne sera pas comptabilisé. L'enseignant devra se rendre à l'administration pour se justifier.</span>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEndScanActionTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant={endScanActionTarget?.action === "sanctioned" ? "destructive" : "default"}
              disabled={endScanActionMutation.isPending || !endScanActionTarget}
              onClick={() => {
                if (!endScanActionTarget) return
                endScanActionMutation.mutate({
                  attendanceId: endScanActionTarget.session.attendanceId,
                  action: endScanActionTarget.action,
                  reason:
                    endScanActionTarget.action === "warned"
                      ? "Scan de fin manquant — toléré avec avertissement"
                      : "Scan de fin manquant — sanctionné",
                })
              }}
            >
              {endScanActionMutation.isPending
                ? "En cours..."
                : endScanActionTarget?.action === "warned"
                  ? "Confirmer l'avertissement"
                  : "Confirmer la sanction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale annulation de sanction ───────────────────────────────────── */}
      <Dialog
        open={cancelSanctionTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelSanctionTarget(null)
            setCancelSanctionReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la sanction</DialogTitle>
            <DialogDescription>
              {cancelSanctionTarget?.teacher.teacherName} — {cancelSanctionTarget?.session.subject} du{" "}
              {cancelSanctionTarget ? formatDate(cancelSanctionTarget.session.date) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={cancelSanctionReason}
              onChange={(event) => setCancelSanctionReason(event.target.value)}
              placeholder="Motif de l'annulation (ex: erreur de saisie, situation résolue...)"
            />
            <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Le cours sera à nouveau comptabilisé et l'enseignant recevra une notification d'information.</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCancelSanctionTarget(null)
                setCancelSanctionReason("")
              }}
            >
              Fermer
            </Button>
            <Button
              type="button"
              disabled={cancelSanctionMutation.isPending || cancelSanctionReason.trim().length < 3 || !cancelSanctionTarget}
              onClick={() => {
                if (!cancelSanctionTarget) return
                cancelSanctionMutation.mutate({
                  attendanceId: cancelSanctionTarget.session.attendanceId,
                  reason: cancelSanctionReason.trim(),
                })
              }}
            >
              {cancelSanctionMutation.isPending ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
