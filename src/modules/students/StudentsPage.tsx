import { useMemo } from "react"
import type { Column, ColumnDef } from "@tanstack/react-table"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { fetchWeeklySchedule } from "@/modules/schedule/schedule.api"
import StudentAbsencePanel from "@/modules/students/components/StudentAbsencePanel"
import { getAttendanceHistory, listStudents, type StudentItem } from "@/modules/students/students.api"
import { DataTable, EmptyState, PageLayout } from "@/shared/components"
import { AddIcon, AppIcon, ChevronRightIcon, FilterIcon, StudentsIcon } from "@/shared/components/icons"
import { useAuthStore } from "@/shared/store/auth.store"
import { useStudentLabel } from "@/shared/hooks/useStudentLabel"

type StudentTableRow = StudentItem & {
  name: string
  parentDisplayName: string
  parentPhoneDisplay: string
  monthlyAbsences: number
}

const toMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  }
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

export default function StudentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const studentLabel = useStudentLabel()
  const activeTab = searchParams.get("tab") === "absences" ? "absences" : "liste"
  const classFilter = searchParams.get("list_class") ?? "all"
  const rawStatus = searchParams.get("list_status")
  const statusFilter: "all" | "active" | "inactive" =
    rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all"
  const searchTerm = searchParams.get("list_search") ?? ""
  const returnTo = `${window.location.pathname}${window.location.search}`

  const setListParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === fallback || value.length === 0) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    if (!next.has("tab")) {
      next.set("tab", "liste")
    }
    setSearchParams(next, { replace: true })
  }

  const monthRange = useMemo(() => toMonthRange(), [])

  const classesQuery = useQuery({
    queryKey: ["students", "classes"],
    queryFn: async () => {
      const schedule = await fetchWeeklySchedule()
      const unique = new Map<string, string>()
      for (const item of schedule.catalog.classes) {
        unique.set(item.id, item.name)
      }
      return Array.from(unique.entries()).map(([id, name]) => ({ id, name }))
    },
  })

  const studentsQuery = useQuery({
    queryKey: ["students", "list", classFilter, statusFilter, searchTerm],
    queryFn: () =>
      listStudents({
        page: 1,
        limit: 100,
        classId: classFilter === "all" ? undefined : classFilter,
        isActive: statusFilter === "all" ? undefined : statusFilter === "active",
        search: searchTerm.trim() || undefined,
      }),
  })

  const students = studentsQuery.data?.data ?? []

  const absenceQueries = useQueries({
    queries: students.map((student) => ({
      queryKey: [
        "students",
        "monthly-absences",
        student.id,
        monthRange.dateFrom,
        monthRange.dateTo,
      ],
      queryFn: () =>
        getAttendanceHistory({
          page: 1,
          limit: 1,
          studentId: student.id,
          dateFrom: monthRange.dateFrom,
          dateTo: monthRange.dateTo,
        }),
      staleTime: 1000 * 60,
    })),
  })

  const absencesMap = useMemo<Record<string, number>>(
    () =>
      students.reduce<Record<string, number>>((acc, student, index) => {
        const total = absenceQueries[index]?.data?.pagination.total ?? 0
        acc[student.id] = total
        return acc
      }, {}),
    [absenceQueries, students]
  )

  const tableData = useMemo<StudentTableRow[]>(
    () =>
      students.map((student) => ({
        ...student,
        name: `${student.lastName} ${student.firstName}`.trim(),
        parentDisplayName: "Parent",
        parentPhoneDisplay: student.parentPhone ?? student.parentPhone2 ?? "Non renseigné",
        monthlyAbsences: absencesMap[student.id] ?? 0,
      })),
    [absencesMap, students]
  )

  const columns = useMemo<ColumnDef<StudentTableRow>[]>(
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
              <p className="text-xs text-muted-foreground">Élève</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "className",
        header: "Classe",
        cell: ({ row }) => <span className="text-sm">{row.original.className}</span>,
      },
      {
        id: "parent",
        accessorFn: (row) => `${row.parentDisplayName} ${row.parentPhoneDisplay}`,
        header: "Parent",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{row.original.parentDisplayName}</p>
            <p className="text-xs text-muted-foreground">{row.original.parentPhoneDisplay}</p>
          </div>
        ),
      },
      {
        accessorKey: "monthlyAbsences",
        header: ({ column }) => <SortableHeader column={column} label="Absences mois" />,
        cell: ({ row }) => (
          <Badge variant={row.original.monthlyAbsences > 3 ? "destructive" : "secondary"}>
            {row.original.monthlyAbsences}
          </Badge>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Statut",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "secondary" : "destructive"}>
            {row.original.isActive ? "Actif" : "Inactif"}
          </Badge>
        ),
      },
    ],
    []
  )

  if (!user) {
    return null
  }

  if (user.role !== "director" && user.role !== "secretary") {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Cette page est réservée au secrétariat et à la direction.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <PageLayout
      title={studentLabel === "Élève" ? "Élèves" : "Étudiants"}
      subtitle={`Liste des ${studentLabel.toLowerCase()}s et suivi des absences`}
      actions={
        <Button type="button" disabled>
          <AddIcon className="mr-2 h-4 w-4" />
          Ajouter un élève
        </Button>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams)
          next.set("tab", value === "absences" ? "absences" : "liste")
          setSearchParams(next, { replace: true })
        }}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border bg-muted/50 p-1 sm:w-full md:w-[420px]">
          <TabsTrigger value="liste" className="min-h-12 rounded-lg text-sm font-medium">Liste</TabsTrigger>
          <TabsTrigger value="absences" className="min-h-12 rounded-lg text-sm font-medium">Absences</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={classFilter}
                onValueChange={(value) => setListParam("list_class", value, "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {(classesQuery.data ?? []).map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value: "all" | "active" | "inactive") =>
                  setListParam("list_status", value, "all")
                }
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

              <div className="relative">
                <FilterIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchTerm}
                  onChange={(event) =>
                    setListParam("list_search", event.target.value.trim(), "")
                  }
                  placeholder="Rechercher par nom"
                />
              </div>
            </div>
          </div>

          {studentsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger la liste des élèves.</AlertDescription>
            </Alert>
          ) : null}

          {!studentsQuery.isError ? (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={studentsQuery.isLoading}
              searchKey="name"
              searchPlaceholder="Rechercher un élève"
              pageSize={20}
              onRowClick={(student) =>
                navigate(`/students/${student.id}?returnTo=${encodeURIComponent(returnTo)}`)
              }
              emptyState={
                <EmptyState
                  icon={<AppIcon icon={StudentsIcon} size="md" className="text-muted-foreground" />}
                  title="Aucun élève"
                  message="Aucun élève trouvé avec les filtres actuels."
                />
              }
              mobileCard={(student) => (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-xl border bg-card p-4 text-left shadow-sm"
                  onClick={() =>
                    navigate(`/students/${student.id}?returnTo=${encodeURIComponent(returnTo)}`)
                  }
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="text-sm">{initials(student.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{student.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{student.className}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={student.monthlyAbsences > 3 ? "destructive" : "secondary"} className="text-xs">
                      {student.monthlyAbsences} abs.
                    </Badge>
                    <span className="text-xs text-muted-foreground">{student.parentPhoneDisplay}</span>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </Button>
              )}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="absences">
          <StudentAbsencePanel />
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
