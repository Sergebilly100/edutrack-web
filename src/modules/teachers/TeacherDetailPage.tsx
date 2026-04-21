import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import TeacherForm from "@/modules/teachers/components/TeacherForm"
import {
  blockTeacher,
  getTeacherById,
  getTeacherMonthlyAttendance,
  getTeacherStats,
  unblockTeacher,
  type TeacherUpsertPayload,
  updateTeacher,
} from "@/modules/teachers/teachers.api"
import { fetchWeeklySchedule } from "@/modules/schedule/schedule.api"
import {
  DocumentList,
  DocumentUpload,
  PageLayout,
  PresenceHeatmap,
  TeacherProfileCard,
} from "@/shared/components"
import { BackIcon, WarningIcon } from "@/shared/components/icons"

const getCurrentMonth = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${now.getFullYear()}-${month}`
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

function WeeklyScheduleCard({ teacherId }: { teacherId: string }) {
  const weeklyScheduleQuery = useQuery({
    queryKey: ["schedule", "weekly", teacherId],
    queryFn: fetchWeeklySchedule,
  })

  const rows = useMemo(() => {
    const schedules = weeklyScheduleQuery.data?.schedules ?? []
    return schedules
      .filter((item) => item.teacher.id === teacherId)
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.timeSlot.sortOrder - b.timeSlot.sortOrder
      })
  }, [teacherId, weeklyScheduleQuery.data?.schedules])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">EDT de la semaine</CardTitle>
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
                <p className="text-sm font-medium">{row.subject}</p>
                <p className="text-xs text-muted-foreground">
                  Jour {row.dayOfWeek} • {row.timeSlot.label} • {row.class.name} • {row.room.name}
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
    return <p className="text-sm text-red-600">Impossible de charger les présences du mois.</p>
  }

  const data = monthlyQuery.data
  const now = new Date()
  const rowsSorted = [...data.rows]
    .filter((row) => new Date(`${row.date}T${row.startTime || "00:00"}:00`).getTime() <= now.getTime())
    .sort((a, b) => {
      const aTs = new Date(`${a.date}T${a.startTime || "00:00"}:00`).getTime()
      const bTs = new Date(`${b.date}T${b.startTime || "00:00"}:00`).getTime()
      return bTs - aTs
    })

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
            <Input
              type="month"
              value={month}
              className="min-h-12"
              onChange={(event) => setMonth(event.target.value || getCurrentMonth())}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <PresenceHeatmap month={data.month} rows={data.rows} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
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
            <p className="text-xs text-muted-foreground">Statut salaire</p>
            <p className="text-lg font-semibold">{data.summary.status}</p>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Créneau</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Retard</TableHead>
                    <TableHead>Prévu</TableHead>
                    <TableHead>Fait</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row, index) => (
                    <TableRow key={`${row.date}-${row.slotLabel}-${index}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.startTime}</TableCell>
                      <TableCell>{row.endTime}</TableCell>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell>{row.className}</TableCell>
                      <TableCell>{row.slotLabel}</TableCell>
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
                      <TableCell>{row.checkedInAt ? row.checkedInAt.slice(11, 16) : "—"}</TableCell>
                      <TableCell>{row.lateMinutes ? `${row.lateMinutes} min` : "—"}</TableCell>
                      <TableCell>{row.hoursPlanned.toFixed(2)}h</TableCell>
                      <TableCell>{row.hoursDone.toFixed(2)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les informations",
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

  return (
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
            type: teacher.type,
            subjects: teacher.subjects,
            hourlyRate: teacher.hourlyRate,
          }}
          isPending={updateMutation.isPending}
          submitLabel="Enregistrer"
          onSubmit={async (payload) => {
            await updateMutation.mutateAsync({ teacherId, payload })
          }}
        />
      </CardContent>
    </Card>
  )
}

export default function TeacherDetailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { teacherId = "" } = useParams<{ teacherId: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockReason, setBlockReason] = useState("")
  const [desktopTab, setDesktopTab] = useState<"presences" | "documents" | "infos">("presences")
  const [mobileTab, setMobileTab] = useState<"profil" | "presences" | "documents" | "infos">(
    "profil"
  )

  const teacherQuery = useQuery({
    queryKey: ["teacher", teacherId],
    queryFn: () => getTeacherById(teacherId),
    enabled: teacherId.trim().length > 0,
  })

  const statsQuery = useQuery({
    queryKey: ["teacher", teacherId, "stats"],
    queryFn: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return getTeacherStats(
        teacherId,
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10)
      )
    },
    enabled: teacherId.trim().length > 0,
  })

  const closeBlockDialog = () => {
    setBlockDialogOpen(false)
    setBlockReason("")
  }

  // ── Mutation blocage — cible teachers.is_blocked via blockTeacher ──────────
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

  // ── Mutation déblocage — efface teachers.is_blocked via unblockTeacher ─────
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

  const monthStats = {
    hours_done: Math.round((statsQuery.data?.hoursWorked ?? 0) * 10) / 10,
    hours_planned: Math.max(Math.round((statsQuery.data?.hoursWorked ?? 0) * 10) / 10, 0),
    attendance_rate: Math.round(statsQuery.data?.attendanceRate ?? 0),
    status: teacher.isBlocked ? "blocked" : "active",
  } as const

  const profileSection = (
    <div className="space-y-4">
      <TeacherProfileCard
        teacher={{
          id: teacher.id,
          name: teacher.fullName,
          username: teacher.username,
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
          setDesktopTab("documents")
          setMobileTab("documents")
        }}
      />

      <WeeklyScheduleCard teacherId={teacher.id} />
    </div>
  )

  const rightTabs = (
    <Tabs
      value={desktopTab}
      onValueChange={(value) =>
        setDesktopTab(value as "presences" | "documents" | "infos")
      }
      className="space-y-4"
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="presences">Présences</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="infos">Infos</TabsTrigger>
      </TabsList>

      <TabsContent value="presences">
        <AttendancePanel teacherId={teacher.id} />
      </TabsContent>
      <TabsContent value="documents">
        <DocumentsPanel teacherId={teacher.id} />
      </TabsContent>
      <TabsContent value="infos">
        <InfosPanel teacherId={teacher.id} />
      </TabsContent>
    </Tabs>
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
          Retour liste
        </Button>
      }
    >
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

      {/* Desktop layout */}
      <div
        className="hidden gap-6 lg:grid lg:grid-cols-[360px_minmax(0,1fr)]"
        data-testid="teacher-detail-desktop-layout"
      >
        {profileSection}
        {rightTabs}
      </div>

      {/* Mobile layout */}
      <div className="space-y-4 lg:hidden">
        <Tabs
          value={mobileTab}
          onValueChange={(value) =>
            setMobileTab(value as "profil" | "presences" | "documents" | "infos")
          }
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="presences">Présences</TabsTrigger>
            <TabsTrigger value="documents" data-testid="teacher-documents-tab-mobile">
              Documents
            </TabsTrigger>
            <TabsTrigger value="infos">Infos</TabsTrigger>
          </TabsList>

          <TabsContent value="profil" className="space-y-4">
            {profileSection}
          </TabsContent>
          <TabsContent value="presences">
            <AttendancePanel teacherId={teacher.id} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsPanel teacherId={teacher.id} />
          </TabsContent>
          <TabsContent value="infos">
            <InfosPanel teacherId={teacher.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modal de blocage ── */}
      <Dialog open={blockDialogOpen} onOpenChange={(open) => { if (!open) closeBlockDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquer ce professeur</DialogTitle>
            <DialogDescription>La raison du blocage est obligatoire.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">Raison du blocage</p>
            <Input
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
                // blockReason est maintenant transmis à blockTeacher()
                // qui le persistera dans teachers.blocked_reason
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
