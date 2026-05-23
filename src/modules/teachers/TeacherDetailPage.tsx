import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import TeacherForm from "@/modules/teachers/components/TeacherForm"
import {
  blockTeacher,
  getTeacherById,
  getTeacherMonthlyAttendance,
  resetTeacherPassword,
  unblockTeacher,
  type TeacherUpsertPayload,
  updateTeacher,
  fetchWeeklySchedule,
  getTeacherSalaryDetails,
} from "@/modules/teachers/teachers.api"
import {
  DocumentList,
  DocumentUpload,
  PageLayout,
  PresenceHeatmap,
  TeacherProfileCard,
} from "@/shared/components"
import { BackIcon, WarningIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { getCurrentMonth, formatMonthLabel } from "@/shared/utils/month"
import { computeAbsenceHours, computeRemainingHours, toDisplayedStatus, toSortableTime } from "@/shared/utils/salary-helpers"

const updateTeacherErrorMessages: Record<string, string> = {
  TEACHER_TYPE_CHANGE_BLOCKED:
    "Changement de type impossible: tous les salaires du professeur doivent d'abord être marqués comme payés.",
  HOURLY_RATE_REQUIRED: "Le taux horaire est obligatoire pour un professeur vacataire.",
  MONTHLY_SALARY_REQUIRED: "Le salaire fixe est obligatoire pour un professeur permanent.",
  BAD_REQUEST: "Certaines informations sont invalides. Vérifiez le formulaire puis réessayez.",
}

const resolveUpdateTeacherErrorMessage = (error: unknown): string => {
  const fallback = "Impossible de mettre à jour les informations"
  if (!isAxiosError(error)) {
    return fallback
  }

  const payload = error.response?.data as { code?: unknown; error?: unknown } | undefined
  const code = typeof payload?.code === "string" ? payload.code : null
  if (code && updateTeacherErrorMessages[code]) {
    return updateTeacherErrorMessages[code]
  }

  if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
    return payload.error
  }

  return fallback
}

const getRecentMonthOptionsWithLabels = (count = 12): Array<{ value: string; label: string }> => {
  const now = new Date()
  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const label = formatMonthLabel(value)
    return { value, label }
  })
}

const statusLabel: Record<string, string> = {
  present: "Présent",
  absent: "Absent",
  late: "Retard",
  excused: "Excusé",
  not_marked: "Non marqué",
}

const statusBadgeClass: Record<string, string> = {
  present: "border-green-200 bg-green-50 text-green-700",
  absent: "border-red-200 bg-red-50 text-red-700",
  late: "border-amber-200 bg-amber-50 text-amber-700",
  excused: "border-blue-200 bg-blue-50 text-blue-700",
  not_marked: "border-slate-200 bg-slate-50 text-slate-600",
}

const dayMeta: Record<number, { label: string; className: string }> = {
  1: { label: "Lundi", className: "border-blue-200 bg-blue-50 text-blue-700" },
  2: { label: "Mardi", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  3: { label: "Mercredi", className: "border-violet-200 bg-violet-50 text-violet-700" },
  4: { label: "Jeudi", className: "border-amber-200 bg-amber-50 text-amber-700" },
  5: { label: "Vendredi", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  6: { label: "Samedi", className: "border-rose-200 bg-rose-50 text-rose-700" },
  7: { label: "Dimanche", className: "border-slate-200 bg-slate-50 text-slate-700" },
}


function WeeklyScheduleCard({ teacherId }: { teacherId: string }) {
  const [showFullWeek, setShowFullWeek] = useState(false)
  const weeklyScheduleQuery = useQuery({
    queryKey: ["schedule", "weekly", teacherId],
    queryFn: fetchWeeklySchedule,
  })

  const todayIsoDow = (() => {
    const jsDay = new Date().getDay()
    return jsDay === 0 ? 7 : jsDay
  })()
  const tomorrowIsoDow = todayIsoDow === 7 ? 1 : todayIsoDow + 1

  const rows = useMemo(() => {
    const schedules = weeklyScheduleQuery.data?.schedules ?? []
    const filtered = schedules
      .filter((item) => item.teacher.id === teacherId)
      .filter((item) => showFullWeek || item.dayOfWeek === todayIsoDow || item.dayOfWeek === tomorrowIsoDow)
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.timeSlot.sortOrder - b.timeSlot.sortOrder
      })
    return filtered
  }, [showFullWeek, teacherId, todayIsoDow, tomorrowIsoDow, weeklyScheduleQuery.data?.schedules])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">EDT de la semaine</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="min-h-12"
            onClick={() => setShowFullWeek((value) => !value)}
          >
            {showFullWeek ? "Afficher moins" : "Voir EDT semaine complète"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {weeklyScheduleQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun créneau trouvé pour ce professeur.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={dayMeta[row.dayOfWeek]?.className ?? "border-slate-200 bg-slate-50 text-slate-700"}
                  >
                    {dayMeta[row.dayOfWeek]?.label ?? `Jour ${row.dayOfWeek}`}
                  </Badge>
                  <p className="text-sm font-medium">{row.subject}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.timeSlot.label} • {row.class.name} • {row.room.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AttendancePanel({ teacherId }: { teacherId: string }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [page, setPage] = useState(1)
  const pageSize = 12
  const monthOptions = useMemo(() => getRecentMonthOptionsWithLabels(18), [])
  const studentLabels = useStudentLabels()

  const monthlyQuery = useQuery({
    queryKey: ["teacher", teacherId, "monthly-attendance", month],
    queryFn: () => getTeacherMonthlyAttendance(teacherId, month),
  })

  useEffect(() => {
    setPage(1)
  }, [month])

  if (monthlyQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (monthlyQuery.isError || !monthlyQuery.data) {
    const errorMessage = monthlyQuery.error && isAxiosError(monthlyQuery.error) && monthlyQuery.error.response?.status === 404
      ? "Aucune donnée de présence disponible pour ce mois."
      : "Impossible de charger les présences du mois. Vérifiez votre connexion."
    return <p className="text-sm text-red-600">{errorMessage}</p>
  }

  const data = monthlyQuery.data
  const todayIso = new Date().toISOString().slice(0, 10)
  const rowsSorted = [...data.rows]
    .filter((row) => row.date <= todayIso)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return toSortableTime(b.startTime).localeCompare(toSortableTime(a.startTime))
    })

  const now = new Date()
  const allRows = [...data.rows]
  const absenceHours = computeAbsenceHours(allRows, now)
  const remainingHours = computeRemainingHours(allRows, now)

  const totalPages = Math.max(1, Math.ceil(rowsSorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pagedRows = rowsSorted.slice(start, start + pageSize)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="max-w-60 space-y-2">
            <p className="text-sm font-medium">Mois analysé</p>
            <Select
              value={month}
              onValueChange={(value) => setMonth(value || getCurrentMonth())}
            >
              <SelectTrigger className="min-h-12">
                <SelectValue placeholder="Choisir un mois" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <PresenceHeatmap month={data.month} rows={data.rows} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Heures prévues</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.summary.hoursPlanned.toFixed(1)}h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Heures faites</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.summary.hoursDone.toFixed(1)}h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Heures d'absence</p>
            <p className="text-lg font-semibold tabular-nums text-red-700">
              {absenceHours.toFixed(1)}h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Heures restantes</p>
            <p className="text-lg font-semibold tabular-nums text-amber-700">
              {remainingHours.toFixed(1)}h
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des présences</CardTitle>
        </CardHeader>
        <CardContent>
          {rowsSorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune présence enregistrée pour ce mois.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Créneau</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Retard</TableHead>                    
                    <TableHead>Entrée en salle</TableHead>
                    <TableHead>Sortie de salle</TableHead>
                    <TableHead>Salle</TableHead>
                    <TableHead>{`Pointage ${studentLabels.pluralLower}`}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row, index) => (
                    <TableRow key={`${row.date}-${row.slotLabel}-${index}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.slotLabel}</TableCell>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell>{row.className}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            statusBadgeClass[row.attendanceStatus] ?? statusBadgeClass.not_marked
                          }
                        >
                          {statusLabel[row.attendanceStatus] ?? statusLabel.not_marked}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.lateMinutes ? `${row.lateMinutes} min` : "—"}</TableCell>
                      <TableCell>{row.checkedInAt ? row.checkedInAt.slice(11, 16) : "—"}</TableCell>
                      <TableCell>
                        {row.checkedOutAt ? row.checkedOutAt.slice(11, 16) : "—"}
                      </TableCell>
                      <TableCell>
                        {/* C'est seulement si le prof est présent qu'on vérifie si la salle était correcte */}
                        {row.attendanceStatus === "present" || row.attendanceStatus === "late" ?  (
                            row.roomMismatch ? (
                              <Badge variant="destructive">Incorrecte</Badge>
                            ) : (
                              <Badge className="border-green-200 bg-green-50 text-green-700">Correcte</Badge>
                            )
                          ) : ("N/A")
                        }
                      </TableCell>
                      <TableCell>
                        {(row.attendanceStatus === "present" || row.attendanceStatus === "late") && row.rollcallMissing ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700">Manquant</Badge>
                        ) : (row.attendanceStatus === "present" || row.attendanceStatus === "late") && row.rollcallDone ? (
                          <Badge className="border-green-200 bg-green-50 text-green-700">Effectué</Badge>
                        ) : (
                          <Badge variant="outline">N/A</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} / {totalPages} • {rowsSorted.length} ligne(s)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-12"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-12"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentsPanel({ teacherId }: { teacherId: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter un document</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUpload
            entityType="teacher"
            entityId={teacherId}
            onUploadSuccess={() => undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentList entityType="teacher" entityId={teacherId} />
        </CardContent>
      </Card>
    </div>
  )
}

function InfosPanel({ teacherId }: { teacherId: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [resetResult, setResetResult] = useState<{
    open: boolean
    plainPassword?: string
    email?: string | null
    emailSent: boolean
  }>({ open: false, emailSent: false })

  const teacherQuery = useQuery({
    queryKey: ["teacher", teacherId],
    queryFn: () => getTeacherById(teacherId),
    enabled: teacherId.trim().length > 0,
  })

  const updateMutation = useMutation({
    mutationFn: ({ payload }: { teacherId: string; payload: TeacherUpsertPayload }) =>
      updateTeacher(teacherId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["teacher", teacherId] })
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: "Informations mises à jour" })
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: resolveUpdateTeacherErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => resetTeacherPassword(teacherId),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["teacher", teacherId] })
      setResetResult({
        open: true,
        plainPassword: data.plainPassword,
        email: data.email,
        emailSent: data.emailSent,
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser le mot de passe.",
        variant: "destructive",
      })
    },
  })

  if (teacherQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (!teacherQuery.data) {
    return <p className="text-sm text-red-600">Impossible de charger les informations.</p>
  }

  const teacher = teacherQuery.data
  const hasEmail = Boolean(teacher.email?.trim())

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations du professeur</CardTitle>
        </CardHeader>
        <CardContent>
          <TeacherForm
            initialValues={{
              firstName: teacher.firstName,
              lastName: teacher.lastName,
              phone: teacher.phone,
              email: teacher.email,
              type: teacher.type,
              subjects: teacher.subjects,
              hourlyRate: teacher.hourlyRate,
              monthlySalary: teacher.monthlySalary,
            }}
            lockSubjects
            isPending={updateMutation.isPending}
            submitLabel="Enregistrer"
            onSubmit={async (payload) => {
              await updateMutation.mutateAsync({ teacherId, payload })
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Génère un nouveau mot de passe temporaire et l'envoie {hasEmail ? `à ${teacher.email}` : "(aucun email renseigné — le mot de passe sera affiché à l'écran)"}.
            Le professeur devra le changer à sa prochaine connexion.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={resetPasswordMutation.isPending}
            onClick={() => resetPasswordMutation.mutate()}
          >
            {resetPasswordMutation.isPending ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={resetResult.open}
        onOpenChange={(open) => setResetResult((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mot de passe réinitialisé</DialogTitle>
            <DialogDescription>
              {resetResult.emailSent
                ? `Les identifiants ont été envoyés à ${resetResult.email}.`
                : "Aucun email n'a pu être envoyé. Transmettez le mot de passe ci-dessous au professeur."}
            </DialogDescription>
          </DialogHeader>
          {!resetResult.emailSent && resetResult.plainPassword ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="text-xs uppercase tracking-wide">Mot de passe temporaire</p>
              <p className="mt-1 font-mono text-lg font-semibold">{resetResult.plainPassword}</p>
              <p className="mt-2 text-xs">
                Notez-le immédiatement — il ne sera plus affiché après fermeture.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setResetResult((prev) => ({ ...prev, open: false }))}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SyntheseInfos({ teacherId, canViewSalary }: { teacherId: string; canViewSalary: boolean }) {

  const month= getCurrentMonth()

  const monthlyQuery = useQuery({
    queryKey: ["teacher", teacherId, "salary-details", month],
    queryFn: () => getTeacherSalaryDetails(teacherId, month),
    enabled: canViewSalary,
  })

  if (!canViewSalary) {
    return (
      <div className="bg-background px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Votre poste ne donne pas accès aux données de salaire de ce professeur.
        </p>
      </div>
    )
  }

  if (monthlyQuery.isLoading) {
    return (
      <div className="grid gap-px bg-border sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-background px-4 py-3">
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (monthlyQuery.isError || !monthlyQuery.data) {
    const errorMessage = monthlyQuery.error && isAxiosError(monthlyQuery.error) && monthlyQuery.error.response?.status === 404
      ? "Aucune donnée de présence disponible pour ce mois."
      : "Impossible de charger les infos de présences du mois. Vérifiez votre connexion."
    return <p className="text-sm text-red-600">{errorMessage}</p>
  }

  const data = monthlyQuery.data

  const now = new Date()
  const allRows = [...data.rows]
  const absenceHours = computeAbsenceHours(allRows, now)
  const remainingHours = computeRemainingHours(allRows, now)

  return (
    <div className="grid gap-px bg-border sm:grid-cols-5">
      <div className="bg-background px-4 py-3">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Heures prévues</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{data.summary.hoursPlanned.toFixed(1)}h</p>
      </div>
      <div className="bg-background px-4 py-3">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Heures faites</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{data.summary.hoursDone.toFixed(1)}h</p>
      </div>
      <div className="bg-background px-4 py-3">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Heures d'absence</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{absenceHours.toFixed(1)}h</p>
      </div>
      <div className="bg-background px-4 py-3">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Heures restantes</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{remainingHours.toFixed(1)}h</p>
      </div>
      <div className="bg-background px-4 py-3">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Statut salaire</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{toDisplayedStatus(data.summary.status, data.summary.isPartiallyPaid)}</p>
      </div>
    </div>
  )
}

export default function TeacherDetailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { teacherId = "" } = useParams<{ teacherId: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockReason, setBlockReason] = useState("")
  const [detailTab, setDetailTab] = useState<"presences" | "documents" | "infos">("presences")
  const canManageTeacherDocuments = hasPermission("teachers.documents")
  const canViewSalary = hasPermission("salary.view")

  const teacherQuery = useQuery({
    queryKey: ["teacher", teacherId],
    queryFn: () => getTeacherById(teacherId),
    enabled: teacherId.trim().length > 0,
  })

  const currentMonth = useMemo(() => getCurrentMonth(), [])
  const currentMonthAttendanceQuery = useQuery({
    queryKey: ["teacher", teacherId, "monthly-attendance", currentMonth],
    queryFn: () => getTeacherMonthlyAttendance(teacherId, currentMonth),
    enabled: teacherId.trim().length > 0,
  })

  const closeBlockDialog = () => {
    setBlockDialogOpen(false)
    setBlockReason("")
  }

  const blockMutation = useMutation({
    mutationFn: (reason: string) => blockTeacher(teacherId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["teacher", teacherId] })
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: "Professeur bloqué" })
      closeBlockDialog()
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de bloquer le professeur",
        variant: "destructive",
      })
    },
  })

  const unblockMutation = useMutation({
    mutationFn: () => unblockTeacher(teacherId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["teacher", teacherId] })
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: "Professeur débloqué" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de débloquer le professeur",
        variant: "destructive",
      })
    },
  })

  if (!teacherId) {
    return <p className="p-4 text-sm text-red-600">Identifiant professeur manquant.</p>
  }

  if (teacherQuery.isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (teacherQuery.isError || !teacherQuery.data) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Professeur introuvable.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const teacher = teacherQuery.data
  const returnTo = searchParams.get("returnTo")
  const currentMonthRows = currentMonthAttendanceQuery.data?.rows ?? []
  const currentMonthSummary = currentMonthAttendanceQuery.data?.summary
  const presentLikeCount = currentMonthRows.filter(
    (row) =>
      row.attendanceStatus === "present" ||
      row.attendanceStatus === "late" ||
      row.attendanceStatus === "excused"
  ).length
  const attendanceRate =
    currentMonthRows.length > 0 ? (presentLikeCount / currentMonthRows.length) * 100 : 0
  const absentOrMissingCount = currentMonthRows.filter(
    (row) => row.attendanceStatus === "absent" || row.attendanceStatus === "not_marked"
  ).length
  const issueCount = currentMonthRows.filter(
    (row) => row.roomMismatch || row.rollcallMissing || row.attendanceStatus === "late"
  ).length

  const monthStats = {
    hours_done: Math.round((currentMonthSummary?.hoursDone ?? 0) * 10) / 10,
    hours_planned: Math.round((currentMonthSummary?.hoursPlanned ?? 0) * 10) / 10,
    attendance_rate: Math.round(attendanceRate),
    status: teacher.isBlocked ? "blocked" : "active",
  } as const

  const profileSection = (
    <TeacherProfileCard
      teacher={{
        id: teacher.id,
        name: teacher.fullName,
        phone: teacher.phone,
        email: teacher.email,
        subjects: teacher.subjects,
        type: teacher.type,
        blockReason: teacher.blockReason ?? undefined,
      }}
      monthStats={monthStats}
      onBlock={async () => {
        setBlockDialogOpen(true)
      }}
      onUnblock={async () => {
        await unblockMutation.mutateAsync()
      }}
      onViewDocuments={() => {
        setDetailTab(canManageTeacherDocuments ? "documents" : "presences")
      }}
    />
  )

  return (
    <PageLayout
      title="Détail professeur"
      subtitle={teacher.fullName}
      actions={
        <Button
          variant="outline"
          onClick={() => {
            if (returnTo) {
              navigate(returnTo)
              return
            }
            navigate(-1)
          }}
        >
          <BackIcon className="mr-2 h-4 w-4" />
          Retour
        </Button>
      }
    >
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 bg-muted/30 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold">Synthèse du mois en cours</p>
          </div>
        </div>
        <SyntheseInfos teacherId={teacher.id} canViewSalary={canViewSalary} />
      </div>

      {teacher.isBlocked ? (
        <Alert variant="destructive" className="mb-4">
          <WarningIcon className="h-4 w-4" />
          <AlertTitle>Professeur bloqué</AlertTitle>
          <AlertDescription>
            {teacher.blockReason?.trim() ||
              "Ce professeur est actuellement bloqué. Débloquez-le pour réactiver son accès."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        {profileSection}
        <WeeklyScheduleCard teacherId={teacher.id} />
      </div>

      <div className="space-y-4">
        <Tabs
          value={detailTab}
          onValueChange={(value) => setDetailTab(value as "presences" | "documents" | "infos")}
          className="space-y-4"
        >
          <TabsList
            className={`grid h-auto min-h-12 w-full ${canManageTeacherDocuments ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <TabsTrigger value="presences" className="min-h-12">Présences</TabsTrigger>
            {canManageTeacherDocuments ? <TabsTrigger value="documents" className="min-h-12">Documents</TabsTrigger> : null}
            <TabsTrigger value="infos" className="min-h-12">Infos</TabsTrigger>
          </TabsList>

          <TabsContent value="presences">
            <AttendancePanel teacherId={teacher.id} />
          </TabsContent>
          {canManageTeacherDocuments ? (
            <TabsContent value="documents">
              <DocumentsPanel teacherId={teacher.id} />
            </TabsContent>
          ) : null}
          <TabsContent value="infos">
            <InfosPanel teacherId={teacher.id} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={blockDialogOpen} onOpenChange={(open) => { if (!open) closeBlockDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquer ce professeur</DialogTitle>
            <DialogDescription>La raison du blocage est obligatoire.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="teacher-detail-block-reason">Raison du blocage</Label>
            <Input
              id="teacher-detail-block-reason"
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="Ex: Dossier RH incomplet"
              data-testid="teacher-block-reason-input"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeBlockDialog}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={blockMutation.isPending || blockReason.trim().length === 0}
              data-testid="teacher-block-confirm-button"
              onClick={() => {
                void blockMutation.mutateAsync(blockReason.trim())
              }}
            >
              {blockMutation.isPending ? "Blocage..." : "Confirmer le blocage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
