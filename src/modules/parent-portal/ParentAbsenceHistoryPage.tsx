import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [month, setMonth] = useState(currentIsoMonth())

  useEffect(() => {
    const students = studentsQuery.data ?? []
    if (students.length === 0) {
      return
    }
    const stored = sessionStorage.getItem(SELECTED_STUDENT_STORAGE_KEY)
    const next = students.find((item) => item.id === stored)?.id ?? students[0].id
    setSelectedStudentId(next)
  }, [studentsQuery.data])

  const absencesQuery = useQuery({
    queryKey: ["parent", "absences", selectedStudentId, month],
    queryFn: () => getParentAbsences(selectedStudentId, month),
    enabled: selectedStudentId.length > 0,
  })

  const selectedStudent = useMemo(
    () => (studentsQuery.data ?? []).find((item) => item.id === selectedStudentId) ?? null,
    [studentsQuery.data, selectedStudentId]
  )

  return (
    <div className="space-y-4 text-base">
      <Link to="/parent/dashboard" className="inline-flex h-12 items-center gap-2 text-base font-semibold">
        <ArrowLeft className="h-4 w-4" /> Tableau de bord
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Historique des absences — {selectedStudent?.first_name ?? "Élève"}
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

      {absencesQuery.data?.length ? (
        <div className="space-y-3">
          {absencesQuery.data.map((row, index) => {
            const prev = absencesQuery.data?.[index - 1]
            const showSeparator = !prev || new Date(`${prev.date}T00:00:00.000Z`).getUTCDate() - new Date(`${row.date}T00:00:00.000Z`).getUTCDate() > 7
            return (
              <div key={`${row.date}-${index}`} className="space-y-2">
                {showSeparator ? <p className="text-base font-semibold text-muted-foreground">Semaine</p> : null}
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <p className="font-semibold">{formatDateFr(row.date)}</p>
                    <p>{row.subject}</p>
                    <p>{row.time_label} · {row.teacher_name}</p>
                  </CardContent>
                </Card>
              </div>
            )
          })}
          <p className="text-base font-semibold">
            {absencesQuery.data.length} absence(s) en {monthLabelFr(month)}
          </p>
        </div>
      ) : (
        <EmptyState title="Aucune absence ce mois. Bravo !" message="Votre enfant n'a pas d'absence enregistrée sur cette période." />
      )}
    </div>
  )
}
