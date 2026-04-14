import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import TeacherForm from "@/modules/teachers/components/TeacherForm"
import {
  createTeacher,
  exportTeacherHours,
  getTeacherStats,
  getTeachers,
  softDeleteTeacher,
  updateTeacher,
  type TeacherListItem,
  type TeacherUpsertPayload,
} from "@/modules/teachers/teachers.api"
import { QRCodeGenerator } from "@/shared/components/QRCodeGenerator"
import { EmptyState, PageLayout } from "@/shared/components"
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

const getPresenceBadgeClass = (rate: number) => {
  if (rate > 80) {
    return "border-green-200 bg-green-50 text-green-700"
  }

  if (rate >= 60) {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }

  return "border-red-200 bg-red-50 text-red-700"
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(value)

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

export default function TeachersPage() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [page, setPage] = useState(1)
  const [limit] = useState(10)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "vacataire" | "permanent">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [subjectFilter, setSubjectFilter] = useState("")

  const [teacherForQr, setTeacherForQr] = useState<TeacherListItem | null>(null)
  const [teacherForEdit, setTeacherForEdit] = useState<TeacherListItem | null>(null)
  const [teacherForDelete, setTeacherForDelete] = useState<TeacherListItem | null>(null)
  const [teacherForExport, setTeacherForExport] = useState<TeacherListItem | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [exportPeriod, setExportPeriod] = useState(getDefaultExportPeriod)

  const last30Days = useMemo(() => getLast30DaysPeriod(), [])

  const teachersQuery = useQuery({
    queryKey: [
      "teachers",
      page,
      limit,
      typeFilter,
      statusFilter,
      subjectFilter,
      search,
    ],
    queryFn: () =>
      getTeachers({
        page,
        limit,
        type: typeFilter,
        is_active: statusFilter === "all" ? "all" : statusFilter === "active",
        subject: subjectFilter.trim() || undefined,
        search: search.trim() || undefined,
      }),
  })

  const teachers = teachersQuery.data?.data ?? []
  const pagination = teachersQuery.data?.pagination

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

  const updateMutation = useMutation({
    mutationFn: ({ teacherId, payload }: { teacherId: string; payload: TeacherUpsertPayload }) =>
      updateTeacher(teacherId, payload),
    onSuccess: async () => {
      setTeacherForEdit(null)
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: "Professeur mis à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le professeur", variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: softDeleteTeacher,
    onSuccess: async () => {
      setTeacherForDelete(null)
      await queryClient.invalidateQueries({ queryKey: ["teachers"] })
      toast({ title: "Professeur désactivé" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de désactiver le professeur", variant: "destructive" })
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

  const columns = useMemo<ColumnDef<TeacherListItem>[]>(
    () => [
      {
        header: "Nom",
        cell: ({ row }) => {
          const teacher = row.original
          return (
            <div className="space-y-1">
              <p className="font-medium">{teacher.fullName}</p>
              <p className="text-xs text-muted-foreground">@{teacher.username}</p>
            </div>
          )
        },
      },
      {
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.type === "vacataire" ? "Vacataire" : "Permanent"}
          </Badge>
        ),
      },
      {
        header: "Matières",
        cell: ({ row }) => (
          <p className="max-w-[240px] text-sm text-muted-foreground">{row.original.subjects.join(", ")}</p>
        ),
      },
      {
        header: "Taux présence 30j",
        cell: ({ row }) => {
          const stats = statsMap[row.original.id]
          if (!stats) {
            return <Skeleton className="h-6 w-16" />
          }

          return (
            <Badge variant="outline" className={getPresenceBadgeClass(stats.attendanceRate)}>
              {stats.attendanceRate.toFixed(0)}%
            </Badge>
          )
        },
      },
      {
        header: "Statut",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.isActive
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-slate-200 bg-slate-100 text-slate-700"
            }
          >
            {row.original.isActive ? "Actif" : "Inactif"}
          </Badge>
        ),
      },
      {
        header: "Actions",
        cell: ({ row }) => {
          const teacher = row.original
          const stats = statsMap[teacher.id]

          return (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setTeacherForQr(teacher)}>
                QR Code
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setTeacherForEdit(teacher)}>
                Modifier
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTeacherForDelete(teacher)}>
                Désactiver
              </Button>
              {teacher.type === "vacataire" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTeacherForExport(teacher)
                    setExportPeriod(getDefaultExportPeriod())
                  }}
                >
                  Exporter les heures
                </Button>
              ) : null}
              {teacher.type === "vacataire" && stats ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  {stats.hoursWorked.toFixed(1)}h · {formatCurrency(stats.amountDue)}
                </Badge>
              ) : null}
            </div>
          )
        },
      },
    ],
    [statsMap]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable est la source d'état officielle de TanStack Table
  const table = useReactTable({
    data: teachers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

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
      title="Professeurs"
      subtitle="Gestion des profs, QR codes et export des heures"
      actions={
        <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
          Ajouter un prof
        </Button>
      }
    >
      <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            placeholder="Rechercher un professeur"
          />

          <Select
            value={typeFilter}
            onValueChange={(value: "all" | "vacataire" | "permanent") => {
              setPage(1)
              setTypeFilter(value)
            }}
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
            onValueChange={(value: "all" | "active" | "inactive") => {
              setPage(1)
              setStatusFilter(value)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={subjectFilter}
            onChange={(event) => {
              setPage(1)
              setSubjectFilter(event.target.value)
            }}
            placeholder="Filtrer par matière"
          />
        </div>
      </div>

      {teachersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : null}

      {teachersQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Impossible de charger la liste des professeurs.
          </AlertDescription>
        </Alert>
      ) : null}

      {!teachersQuery.isLoading && !teachersQuery.isError && teachers.length === 0 ? (
        <EmptyState
          title="Aucun professeur"
          description="Ajoutez un professeur ou ajustez les filtres pour afficher des résultats."
          action={{ label: "Ajouter un prof", onClick: () => setCreateOpen(true) }}
        />
      ) : null}

      {!teachersQuery.isLoading && !teachersQuery.isError && teachers.length > 0 ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Page {pagination?.page ?? page} / {Math.max(1, pagination?.totalPages ?? 1)} · {pagination?.total ?? 0} prof(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(pagination?.page ?? page) <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(pagination?.page ?? page) >= Math.max(1, pagination?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
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

      <Dialog open={Boolean(teacherForEdit)} onOpenChange={(open) => !open && setTeacherForEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le professeur</DialogTitle>
            <DialogDescription>Mettez à jour les informations du professeur.</DialogDescription>
          </DialogHeader>
          {teacherForEdit ? (
            <TeacherForm
              initialValues={{
                firstName: teacherForEdit.firstName,
                lastName: teacherForEdit.lastName,
                phone: teacherForEdit.phone,
                type: teacherForEdit.type,
                subjects: teacherForEdit.subjects,
                hourlyRate: teacherForEdit.hourlyRate,
              }}
              isPending={updateMutation.isPending}
              submitLabel="Enregistrer les modifications"
              onSubmit={async (payload) => {
                await updateMutation.mutateAsync({ teacherId: teacherForEdit.id, payload })
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(teacherForQr)} onOpenChange={(open) => !open && setTeacherForQr(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR code professeur</DialogTitle>
            <DialogDescription>
              Générez et téléchargez le QR code pour {teacherForQr?.fullName}.
            </DialogDescription>
          </DialogHeader>
          {teacherForQr ? (
            <div className="flex justify-center">
              <QRCodeGenerator roomToken={teacherForQr.username} roomName={teacherForQr.fullName} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(teacherForDelete)}
        onOpenChange={(open) => !open && setTeacherForDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver le professeur</DialogTitle>
            <DialogDescription>
              Le professeur sera désactivé (soft delete) et restera dans l'historique.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherForDelete(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!teacherForDelete) return
                void deleteMutation.mutateAsync(teacherForDelete.id)
              }}
            >
              {deleteMutation.isPending ? "Désactivation..." : "Confirmer"}
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
            <DialogTitle>Exporter les heures</DialogTitle>
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
              {exportMutation.isPending ? "Export..." : "Exporter (XLSX)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
