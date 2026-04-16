import { useMemo, useState } from "react"
import type { ColumnDef, Column } from "@tanstack/react-table"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

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
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import TeacherForm from "@/modules/teachers/components/TeacherForm"
import {
  createTeacher,
  exportTeacherHours,
  getTeacherStats,
  getTeachers,
  setTeacherActiveStatus,
  type TeacherListItem,
} from "@/modules/teachers/teachers.api"
import {
  AddIcon,
  AppIcon,
  BlockIcon,
  ChevronRightIcon,
  ExportIcon,
  FilterIcon,
  MoreIcon,
  TeachersIcon,
  UnblockIcon,
  ViewIcon,
} from "@/shared/components/icons"
import { DataTable, EmptyState, PageLayout } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30

const toISODate = (date: Date) => date.toISOString().slice(0, 10)

const getDefaultExportPeriod = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return {
    dateFrom: toISODate(start),
    dateTo: toISODate(end),
  }
}

const getLast30DaysPeriod = () => {
  const end = new Date()
  const start = new Date(end.getTime() - THIRTY_DAYS_MS)

  return {
    dateFrom: toISODate(start),
    dateTo: toISODate(end),
  }
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

type TeacherStatsMap = Record<string, { attendanceRate: number; hoursWorked: number; amountDue: number }>

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

function SortableHeader<TData>({ column, label }: { column: Column<TData, unknown>; label: string }) {
  return (
    <span className={cn("text-sm font-medium", column.getIsSorted() ? "text-foreground" : "text-muted-foreground")}>
      {label}
    </span>
  )
}

function TeacherRowActions({
  teacher,
  onViewProfile,
  onToggleBlocked,
  onExportPdf,
}: {
  teacher: TeacherTableRow
  onViewProfile: () => void
  onToggleBlocked: () => void
  onExportPdf: () => void
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
          <DropdownMenuItem onSelect={onToggleBlocked}>
            {teacher.isBlocked ? <UnblockIcon className="mr-2 h-4 w-4" /> : <BlockIcon className="mr-2 h-4 w-4" />}
            {teacher.isBlocked ? "Débloquer" : "Bloquer"}
          </DropdownMenuItem>
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
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [typeFilter, setTypeFilter] = useState<"all" | "vacataire" | "permanent">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [subjectFilter, setSubjectFilter] = useState("")

  const [teacherForStatusChange, setTeacherForStatusChange] = useState<TeacherListItem | null>(null)
  const [teacherForExport, setTeacherForExport] = useState<TeacherListItem | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [exportPeriod, setExportPeriod] = useState(getDefaultExportPeriod)

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
      if (result) {
        acc[teacher.id] = result
      }
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
      toast({ title: "Erreur", description: "Impossible d'ajouter le professeur", variant: "destructive" })
    },
  })

  const setStatusMutation = useMutation({
    mutationFn: ({ teacherId, isActive }: { teacherId: string; isActive: boolean }) =>
      setTeacherActiveStatus(teacherId, isActive),
    onSuccess: async (_, variables) => {
      setTeacherForStatusChange(null)
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: variables.isActive ? "Professeur débloqué" : "Professeur bloqué" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" })
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
      toast({ title: "Erreur", description: "Impossible d'exporter les heures", variant: "destructive" })
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
      {
        accessorKey: "attendanceRate",
        header: ({ column }) => <SortableHeader column={column} label="Présence" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  row.original.attendanceRate >= 90
                    ? "bg-green-500"
                    : row.original.attendanceRate >= 70
                      ? "bg-amber-500"
                      : "bg-red-500"
                )}
                style={{ width: `${row.original.attendanceRate}%` }}
              />
            </div>
            <span className="text-xs tabular-nums">{row.original.attendanceRate}%</span>
          </div>
        ),
      },
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
            onToggleBlocked={() => setTeacherForStatusChange(row.original)}
            onExportPdf={() => {
              setTeacherForExport(row.original)
              setExportPeriod(getDefaultExportPeriod())
            }}
          />
        ),
      },
    ],
    [navigate]
  )

  if (!user) {
    return null
  }

  if (user.role !== "director" && user.role !== "secretary") {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Cette page est réservée à la direction et au secrétariat.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <PageLayout
      title={`Professeurs (${activeCount} actifs)`}
      subtitle="Gestion des profs, blocage et export"
      actions={
        <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
          <AddIcon className="mr-2 h-4 w-4" />
          Ajouter un prof
        </Button>
      }
    >
      <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="teachers-filters">
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

          <div className="relative">
            <FilterIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              placeholder="Filtrer par matière"
              data-testid="teachers-subject-filter-input"
            />
          </div>
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
                action={{ label: "Ajouter un prof", onClick: () => setCreateOpen(true) }}
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
                  <p className="truncate text-xs text-muted-foreground">{teacher.subjects.join(", ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={teacher.isBlocked ? "destructive" : "secondary"} className="text-xs">
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un professeur</DialogTitle>
            <DialogDescription>Renseignez les informations du nouveau professeur.</DialogDescription>
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

      <Dialog
        open={Boolean(teacherForStatusChange)}
        onOpenChange={(open) => !open && setTeacherForStatusChange(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {teacherForStatusChange?.isBlocked ? "Débloquer le professeur" : "Bloquer le professeur"}
            </DialogTitle>
            <DialogDescription>
              {teacherForStatusChange?.isBlocked
                ? "Le professeur retrouvera l'accès à ses actions habituelles."
                : "Le professeur sera marqué comme bloqué dans la liste."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherForStatusChange(null)}>
              Annuler
            </Button>
            <Button
              variant={teacherForStatusChange?.isBlocked ? "secondary" : "destructive"}
              disabled={setStatusMutation.isPending}
              onClick={() => {
                if (!teacherForStatusChange) return
                void setStatusMutation.mutateAsync({
                  teacherId: teacherForStatusChange.id,
                  isActive: teacherForStatusChange.isBlocked,
                })
              }}
            >
              {setStatusMutation.isPending
                ? "Traitement..."
                : teacherForStatusChange?.isBlocked
                  ? "Débloquer"
                  : "Bloquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </PageLayout>
  )
}
