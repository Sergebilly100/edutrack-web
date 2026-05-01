import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, XCircle } from "lucide-react"
import { Link } from "react-router-dom"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components"
import { getParentAbsences, listParentStudents } from "@/modules/parent-portal/parent.api"
import { currentIsoMonth, formatDateFr, monthLabelFr } from "@/modules/parent-portal/parent.utils"

const SELECTED_STUDENT_STORAGE_KEY = "parent_selected_student_id"

const lastMonths = (count: number): string[] => {
  const items: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    items.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`)
  }
  return items
}

export default function ParentAbsenceHistoryPage() {
  const studentsQuery = useQuery({
    queryKey: ["parent", "students", "history"],
    queryFn: listParentStudents,
  })

  const [selectedStudentId, setSelectedStudentId] = useState(
    () => sessionStorage.getItem(SELECTED_STUDENT_STORAGE_KEY) ?? ""
  )
  const [month, setMonth] = useState(currentIsoMonth())

  useEffect(() => {
    const students = studentsQuery.data ?? []
    if (students.length === 0) return
    if (students.some((s) => s.id === selectedStudentId)) return
    setSelectedStudentId(students[0].id)
  }, [studentsQuery.data, selectedStudentId])

  const absencesQuery = useQuery({
    queryKey: ["parent", "absences", selectedStudentId, month],
    queryFn: () => getParentAbsences(selectedStudentId, month),
    enabled: selectedStudentId.length > 0,
  })

  const selectedStudent = useMemo(
    () => (studentsQuery.data ?? []).find((item) => item.id === selectedStudentId) ?? null,
    [studentsQuery.data, selectedStudentId]
  )

  if (studentsQuery.isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />
  }

  return (
    <div className="space-y-4 text-base">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">
          Historique des absences - {selectedStudent?.first_name ?? "Élève"}
        </h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            value={selectedStudentId}
            onValueChange={(value) => {
              setSelectedStudentId(value)
              sessionStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, value)
            }}
          >
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Sélectionnez un élève" />
            </SelectTrigger>
            <SelectContent>
              {(studentsQuery.data ?? []).map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} · {student.class_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lastMonths(6).map((item) => (
                <SelectItem key={item} value={item}>
                  {monthLabelFr(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {absencesQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : absencesQuery.data?.length ? (
        <div className="space-y-3">
          {absencesQuery.data.map((row, index) => (
            <div
              key={`${row.date}-${index}`}
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{row.subject}</p>
                <p className="text-xs text-muted-foreground">{formatDateFr(row.date)}</p>
                <p className="text-xs text-muted-foreground">{row.time_label} · M/Mme {row.teacher_name}</p>
              </div>
            </div>
          ))}
          <p className="pt-1 text-sm font-medium text-muted-foreground">
            {absencesQuery.data.length} absence(s) en {monthLabelFr(month)}
          </p>
        </div>
      ) : (
        <EmptyState title="Aucune absence ce mois. Bravo !" message="Votre enfant n'a pas d'absence enregistrée sur cette période." />
      )}
    </div>
  )
}
