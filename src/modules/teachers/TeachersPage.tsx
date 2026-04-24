import { useMemo, useState } from "react"
import type { ColumnDef, Column } from "@tanstack/react-table"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import TeacherAnalysisPanel from "@/modules/teachers/components/TeacherAnalysisPanel"
import TeacherForm from "@/modules/teachers/components/TeacherForm"
import {
  blockTeacher,
  createTeacher,
  exportTeacherHours,
  getTeacherStats,
  getTeachers,
  unblockTeacher,
  type TeacherListItem,
} from "@/modules/teachers/teachers.api"
import {
  AddIcon,
  AppIcon,
  BlockIcon,
  ChevronRightIcon,
  ExportIcon,
  MoreIcon,
  TeachersIcon,
  UnblockIcon,
  ViewIcon,
} from "@/shared/components/icons"
import { DataTable, EmptyState, PageLayout } from "@/shared/components"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { isStaffRole, useAuthStore } from "@/shared/store/auth.store"

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30

const toISODate = (date: Date) => date.toISOString().slice(0, 10)

const getDefaultExportPeriod = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { dateFrom: toISODate(start), dateTo: toISODate(end) }
}

const getLast30DaysPeriod = () => {
  const end = new Date()
  const start = new Date(end.getTime() - THIRTY_DAYS_MS)
  return { dateFrom: toISODate(start), dateTo: toISODate(end) }
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

type TeacherStatsMap = Record<
  string,
  { attendanceRate: number; hoursWorked: number; amountDue: number }
>

type TeacherTableRow = TeacherListItem & {
  name: string
  attendanceRate: number
}

const initials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("")

function SortableHeader<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>
  label: string
}) {
  return (
    <span
      className={cn(
        "text-sm font-medium",
        column.getIsSorted() ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}

function TeacherRowActions({
  teacher,
  onViewProfile,
  onToggleBlocked,
  onExportPdf,
  canToggleBlocked,
}: {
  teacher: TeacherTableRow
  onViewProfile: () => void
  onToggleBlocked: () => void
  onExportPdf: () => void
  canToggleBlocked: boolean
}) {
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreIcon className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onViewProfile}>
            <ViewIcon className="mr-2 h-4 w-4" />
            Voir le profil
          </DropdownMenuItem>
          {canToggleBlocked ? (
            <DropdownMenuItem onSelect={onToggleBlocked}>
              {teacher.isBlocked ? (
                <UnblockIcon className="mr-2 h-4 w-4" />
              ) : (
                <BlockIcon className="mr-2 h-4 w-4" />
              )}
              {teacher.isBlocked ? "Débloquer" : "Bloquer"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onExportPdf}>
            <ExportIcon className="mr-2 h-4 w-4" />
            Exporter PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function TeachersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const canToggleBlocked = hasPermission("teachers.block")
  const canCreateTeacher = hasPermission("teachers.create")

  const [typeFilter, setTypeFilter] = useState<"all" | "vacataire" | "permanent">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [subjectFilter, setSubjectFilter] = useState("")

  const [teacherForStatusChange, setTeacherForStatusChange] = useState<TeacherListItem | null>(null)
  const [blockReasonInput, setBlockReasonInput] = useState("")
  const [teacherForExport, setTeacherForExport] = useState<TeacherListItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [exportPeriod, setExportPeriod] = useState(getDefaultExportPeriod)
  const activeTab = searchParams.get("tab") === "analyse" ? "analyse" : "liste"

  const last30Days = useMemo(() => getLast30DaysPeriod(), [])

  const teachersQuery = useQuery({
    queryKey: ["teachers", typeFilter, statusFilter, subjectFilter],
    queryFn: () =>
      getTeachers({
        page: 1,
        limit: 100,
        type: typeFilter,
        is_active: statusFilter === "all" ? "all" : statusFilter === "active",
        subject: subjectFilter.trim() || undefined,
      }),
  })

  const teachers = teachersQuery.data?.data ?? []
  const subjectOptions = useMemo(() => {
    const set = new Set<string>()
    for (const teacher of teachers) {
      for (const subject of teacher.subjects) {
        const clean = subject.trim()
        if (clean.length > 0) set.add(clean)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))
  }, [teachers])

  const statsQueries = useQueries({
    queries: teachers.map((teacher) => ({
      queryKey: ["teacher-stats", teacher.id, last30Days.dateFrom, last30Days.dateTo],
      queryFn: () => getTeacherStats(teacher.id, last30Days.dateFrom, last30Days.dateTo),
      staleTime: 1000 * 60 * 2,
    })),
  })

  const statsMap = useMemo<TeacherStatsMap>(() => {
    return teachers.reduce<TeacherStatsMap>((acc, teacher, index) => {
      const result = statsQueries[index]?.data
      if (result) acc[teacher.id] = result
      return acc
    }, {})
  }, [statsQueries, teachers])

  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: async () => {
      setCreateOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: "Professeur ajouté" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le professeur",
        variant: "destructive",
      })
    },
  })

  const closeStatusDialog = () => {
    setTeacherForStatusChange(null)
    setBlockReasonInput("")
  }

  // Mutation de blocage — cible teachers.is_blocked via blockTeacher/unblockTeacher
  const toggleBlockMutation = useMutation({
    mutationFn: ({ teacher, reason }: { teacher: TeacherListItem; reason: string }) =>
      teacher.isBlocked ? unblockTeacher(teacher.id) : blockTeacher(teacher.id, reason),
    onSuccess: async (_, variables) => {
      closeStatusDialog()
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({
        title: variables.teacher.isBlocked ? "Professeur débloqué" : "Professeur bloqué",
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut",
        variant: "destructive",
      })
    },
  })

  const exportMutation = useMutation({
    mutationFn: exportTeacherHours,
    onSuccess: (result) => {
      downloadBlob(result.blob, result.filename)
      setTeacherForExport(null)
      toast({ title: "Export généré" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les heures",
        variant: "destructive",
      })
    },
  })

  const tableData = useMemo<TeacherTableRow[]>(
    () =>
      teachers.map((teacher) => ({
        ...teacher,
        name: teacher.fullName,
        attendanceRate: statsMap[teacher.id]?.attendanceRate ?? 0,
      })),
    [statsMap, teachers]
  )

  const activeCount = useMemo(
    () => tableData.filter((teacher) => !teacher.isBlocked).length,
    [tableData]
  )

  const columns = useMemo<ColumnDef<TeacherTableRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: ({ column }) => <SortableHeader column={column} label="Nom" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(row.original.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">@{row.original.username}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "subjects",
        header: "Matières",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.subjects.slice(0, 2).map((subject) => (
              <Badge key={subject} variant="secondary">
                {subject}
              </Badge>
            ))}
            {row.original.subjects.length > 2 ? (
              <Badge variant="outline">+{row.original.subjects.length - 2}</Badge>
            ) : null}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant={row.original.type === "vacataire" ? "default" : "secondary"}>
            {row.original.type}
          </Badge>
        ),
      },
      // {
      //   accessorKey: "attendanceRate",
      //   header: ({ column }) => <SortableHeader column={column} label="Présence" />,
      //   cell: ({ row }) => (
      //     <div className="flex items-center gap-2">
      //       <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      //         <div
      //           className={cn(
      //             "h-full rounded-full",
      //             row.original.attendanceRate >= 90
      //               ? "bg-green-500"
      //               : row.original.attendanceRate >= 70
      //                 ? "bg-amber-500"
      //                 : "bg-red-500"
      //           )}
      //           style={{ width: `${row.original.attendanceRate}%` }}
      //         />
      //       </div>
      //       <span className="text-xs tabular-nums">{row.original.attendanceRate}%</span>
      //     </div>
      //   ),
      // },
      {
        accessorKey: "isBlocked",
        header: "Statut",
        cell: ({ row }) => (
          <Badge variant={row.original.isBlocked ? "destructive" : "secondary"}>
            {row.original.isBlocked ? "Bloqué" : "Actif"}
          </Badge>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <TeacherRowActions
            teacher={row.original}
            onViewProfile={() => navigate(`/teachers/${row.original.id}`)}
            onToggleBlocked={() => {
              setTeacherForStatusChange(row.original)
              setBlockReasonInput("")
            }}
            onExportPdf={() => {
              setTeacherForExport(row.original)
              setExportPeriod(getDefaultExportPeriod())
            }}
            canToggleBlocked={canToggleBlocked}
          />
        ),
      },
    ],
    [canToggleBlocked, navigate]
  )

  if (!user) return null

  if (user.role !== "director" && !isStaffRole(user.role)) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Cette page est réservée à la direction et au staff.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <PageLayout
      title={`Professeurs`}
      subtitle="Gestion des profs, blocage et export"
      actions={
        canCreateTeacher ? (
          <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
            <AddIcon className="mr-2 h-4 w-4" />
            Ajouter un prof
          </Button>
        ) : null
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams)
          next.set("tab", value)
          setSearchParams(next, { replace: true })
        }}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border bg-muted/50 p-1 sm:w-full md:w-[420px]">
          <TabsTrigger value="liste" className="min-h-12 rounded-lg text-sm font-medium">Liste</TabsTrigger>
          <TabsTrigger value="analyse" className="min-h-12 rounded-lg text-sm font-medium">Analyse présence</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-6">
          {/* ── Filtres ── */}
          <div
            className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm"
            data-testid="teachers-filters"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={typeFilter}
                onValueChange={(value: "all" | "vacataire" | "permanent") => setTypeFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="vacataire">Vacataires</SelectItem>
                  <SelectItem value="permanent">Permanents</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Bloqués</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={subjectFilter || "all"}
                onValueChange={(value) => setSubjectFilter(value === "all" ? "" : value)}
              >
                <SelectTrigger data-testid="teachers-subject-filter-input">
                  <SelectValue placeholder="Filtrer par matière" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les matières</SelectItem>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {teachersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger la liste des professeurs.</AlertDescription>
            </Alert>
          ) : null}

          {!teachersQuery.isError ? (
            <div data-testid="teachers-list-table">
              <DataTable
                columns={columns}
                data={tableData}
                isLoading={teachersQuery.isLoading}
                searchKey="name"
                searchPlaceholder="Rechercher un professeur"
                pageSize={20}
                onRowClick={(teacher) => navigate(`/teachers/${teacher.id}`)}
                emptyState={
                  <EmptyState
                    icon={<AppIcon icon={TeachersIcon} size="md" className="text-muted-foreground" />}
                    title="Aucun professeur"
                    message="Ajoutez un professeur ou ajustez les filtres pour afficher des résultats."
                    action={canCreateTeacher ? { label: "Ajouter un prof", onClick: () => setCreateOpen(true) } : undefined}
                  />
                }
                mobileCard={(teacher) => (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm"
                    onClick={() => navigate(`/teachers/${teacher.id}`)}
                    data-testid="teacher-mobile-card"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="text-sm">{initials(teacher.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{teacher.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {teacher.subjects.join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={teacher.isBlocked ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {teacher.isBlocked ? "Bloqué" : "Actif"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{teacher.attendanceRate}%</span>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </button>
                )}
              />
            </div>
          ) : null}

          {/* ── Modal : créer un professeur ── */}
          {canCreateTeacher ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un professeur</DialogTitle>
                  <DialogDescription>
                    Renseignez les informations du nouveau professeur.
                  </DialogDescription>
                </DialogHeader>
                <TeacherForm
                  isPending={createMutation.isPending}
                  submitLabel="Créer le professeur"
                  onSubmit={async (payload) => {
                    await createMutation.mutateAsync(payload)
                  }}
                />
              </DialogContent>
            </Dialog>
          ) : null}

          {/* ── Modal : bloquer / débloquer ── */}
          {canToggleBlocked ? (
            <Dialog
              open={Boolean(teacherForStatusChange)}
              onOpenChange={(open) => { if (!open) closeStatusDialog() }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {teacherForStatusChange?.isBlocked
                      ? "Débloquer le professeur"
                      : "Bloquer le professeur"}
                  </DialogTitle>
                  <DialogDescription>
                    {teacherForStatusChange?.isBlocked
                      ? "Le professeur retrouvera l'accès à ses actions habituelles."
                      : "Saisissez le motif du blocage pour continuer."}
                  </DialogDescription>
                </DialogHeader>

                {/* Motif uniquement pour le blocage */}
                {!teacherForStatusChange?.isBlocked ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Raison du blocage</p>
                    <Input
                      value={blockReasonInput}
                      onChange={(event) => setBlockReasonInput(event.target.value)}
                      placeholder="Ex: Dossier RH incomplet"
                      data-testid="teachers-list-block-reason-input"
                    />
                  </div>
                ) : null}

                <DialogFooter>
                  <Button variant="outline" onClick={closeStatusDialog}>
                    Annuler
                  </Button>
                  <Button
                    variant={teacherForStatusChange?.isBlocked ? "secondary" : "destructive"}
                    disabled={
                      toggleBlockMutation.isPending ||
                      (!teacherForStatusChange?.isBlocked && blockReasonInput.trim().length === 0)
                    }
                    onClick={() => {
                      if (!teacherForStatusChange) return
                      void toggleBlockMutation.mutateAsync({
                        teacher: teacherForStatusChange,
                        reason: blockReasonInput.trim(),
                      })
                    }}
                  >
                    {toggleBlockMutation.isPending
                      ? "Traitement..."
                      : teacherForStatusChange?.isBlocked
                        ? "Débloquer"
                        : "Bloquer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}

          {/* ── Modal : export heures ── */}
          <Dialog
            open={Boolean(teacherForExport)}
            onOpenChange={(open) => !open && setTeacherForExport(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exporter PDF</DialogTitle>
                <DialogDescription>
                  Sélectionnez la période d'export pour {teacherForExport?.fullName}.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Date de début</p>
                  <Input
                    type="date"
                    value={exportPeriod.dateFrom}
                    onChange={(event) =>
                      setExportPeriod((current) => ({ ...current, dateFrom: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Date de fin</p>
                  <Input
                    type="date"
                    value={exportPeriod.dateTo}
                    onChange={(event) =>
                      setExportPeriod((current) => ({ ...current, dateTo: event.target.value }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setTeacherForExport(null)}>
                  Annuler
                </Button>
                <Button
                  disabled={exportMutation.isPending}
                  onClick={() => {
                    if (!teacherForExport) return
                    void exportMutation.mutateAsync({
                      teacherId: teacherForExport.id,
                      dateFrom: exportPeriod.dateFrom,
                      dateTo: exportPeriod.dateTo,
                    })
                  }}
                >
                  {exportMutation.isPending ? "Export..." : "Exporter"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="analyse">
          <TeacherAnalysisPanel />
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
