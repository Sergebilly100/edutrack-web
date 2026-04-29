import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"

import { AlertBanner, EmptyState } from "@/shared/components"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  getParentAbsences,
  getParentSchedule,
  getParentStats,
  getParentSubscriptionStatus,
  listParentStudents,
} from "@/modules/parent-portal/parent.api"
import {
  currentIsoWeek,
  formatDateFr,
  formatShortDate,
  shiftIsoWeek,
  weekDaysFr,
} from "@/modules/parent-portal/parent.utils"
import { monthKeyInBusinessTimezone, todayInBusinessTimezone } from "@/shared/lib/business-date"

const SELECTED_STUDENT_STORAGE_KEY = "parent_selected_student_id"

type DayViewItem = {
  date: string
  label: string
  slots: Array<{
    time: string
    subject: string
    teacher: string
    room: string
    status: "present" | "absent" | "upcoming" | "unknown"
  }>
}

export default function ParentDashboardPage() {
  const studentsQuery = useQuery({
    queryKey: ["parent", "students"],
    queryFn: listParentStudents,
  })

  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [week, setWeek] = useState(currentIsoWeek())

  useEffect(() => {
    const students = studentsQuery.data ?? []
    if (students.length === 0) {
      return
    }

    const stored = sessionStorage.getItem(SELECTED_STUDENT_STORAGE_KEY)
    const match = stored ? students.find((item) => item.id === stored) : null
    const next = match?.id ?? students[0].id
    setSelectedStudentId(next)
  }, [studentsQuery.data])

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId)
    sessionStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, studentId)
  }

  const subscriptionQuery = useQuery({
    queryKey: ["parent", "subscription-status"],
    queryFn: getParentSubscriptionStatus,
  })

  const statsQuery = useQuery({
    queryKey: ["parent", "stats", selectedStudentId],
    queryFn: () => getParentStats(selectedStudentId),
    enabled: selectedStudentId.length > 0,
  })

  const scheduleQuery = useQuery({
    queryKey: ["parent", "schedule", selectedStudentId, week],
    queryFn: () => getParentSchedule(selectedStudentId, week),
    enabled: selectedStudentId.length > 0,
  })

  const month = useMemo(() => {
    return monthKeyInBusinessTimezone()
  }, [])

  const absencesQuery = useQuery({
    queryKey: ["parent", "latest-absences", selectedStudentId, month],
    queryFn: async () => {
      const rows = await getParentAbsences(selectedStudentId, month)
      return rows.slice(0, 5)
    },
    enabled: selectedStudentId.length > 0,
  })

  const selectedStudent = useMemo(
    () => (studentsQuery.data ?? []).find((item) => item.id === selectedStudentId) ?? null,
    [selectedStudentId, studentsQuery.data]
  )

  const days: DayViewItem[] = (scheduleQuery.data?.days ?? []).map((day, index) => ({
    date: day.day,
    label: weekDaysFr[index] ?? "Jour",
    slots: day.slots,
  }))

  const daysRemaining = subscriptionQuery.data?.days_remaining ?? 999
  const subscriptionAlert =
    daysRemaining <= 30
      ? {
          type: daysRemaining <= 7 ? "error" : "warning",
          message: `Votre abonnement expire dans ${daysRemaining} jours (le ${formatShortDate(
            subscriptionQuery.data?.ends_at ?? todayInBusinessTimezone()
          )}). Contactez l'établissement pour renouveler.`,
        }
      : null

  return (
    <div className="space-y-4 text-base">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Tableau de bord parent</h1>

        {(studentsQuery.data?.length ?? 0) > 1 ? (
          <div className="space-y-2">
            <p className="text-base font-medium">Élève suivi</p>
            {(studentsQuery.data?.length ?? 0) <= 3 ? (
              <div className="flex flex-wrap gap-2">
                {(studentsQuery.data ?? []).map((student) => (
                  <Button
                    key={student.id}
                    type="button"
                    className="h-12 text-base"
                    variant={selectedStudentId === student.id ? "default" : "outline"}
                    onClick={() => handleSelectStudent(student.id)}
                  >
                    {student.first_name} {student.last_name}
                  </Button>
                ))}
              </div>
            ) : (
              <Select value={selectedStudentId} onValueChange={handleSelectStudent}>
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
            )}
          </div>
        ) : selectedStudent ? (
          <p className="text-base text-muted-foreground">
            Élève suivi: {selectedStudent.first_name} {selectedStudent.last_name} · {selectedStudent.class_name}
          </p>
        ) : null}
      </section>

      {subscriptionAlert ? (
        <AlertBanner
          type={subscriptionAlert.type as "warning" | "error"}
          title="Alerte abonnement"
          message={subscriptionAlert.message}
        />
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Cette semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {statsQuery.data?.absences_this_week ?? 0} absence(s) sur {scheduleQuery.data?.days.reduce((acc, day) => acc + day.slots.length, 0) ?? 0} cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Ce mois</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {statsQuery.data?.absences_this_month ?? 0} absence(s) — Taux de présence : {statsQuery.data?.attendance_rate_month ?? 0}%
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Programme de la semaine</h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setWeek((prev) => shiftIsoWeek(prev, -1))}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Semaine précédente
            </Button>
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setWeek((prev) => shiftIsoWeek(prev, 1))}>
              Semaine suivante <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full min-w-[900px] text-base">
            <thead className="bg-muted/40">
              <tr>
                {days.map((day) => (
                  <th key={day.date} className="px-3 py-3 text-left">{day.label} {formatShortDate(day.date)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map((day) => (
                  <td key={day.date} className="align-top">
                    <div className="space-y-2 p-2">
                      {day.slots.length === 0 ? (
                        <div className="rounded-lg bg-muted p-3 text-base">—</div>
                      ) : (
                        day.slots.map((slot, index) => (
                          <div
                            key={`${day.date}-${index}`}
                            className={
                              slot.status === "absent"
                                ? "rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900 dark:bg-red-950/30"
                                : slot.status === "present"
                                  ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30"
                                  : "rounded-lg border border-border bg-muted p-3"
                            }
                          >
                            <p className="font-semibold">{slot.subject}</p>
                            <p>{slot.time}</p>
                            <p>{slot.teacher}</p>
                            {slot.status === "absent" ? <p className="font-semibold">Absent(e)</p> : null}
                            {slot.status === "present" ? <p className="font-semibold">Présent(e)</p> : null}
                            {slot.status === "upcoming" ? <p className="font-semibold">Cours à venir</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2 md:hidden">
          {days.map((day) => (
            <Collapsible key={day.date} className="rounded-lg border">
              <CollapsibleTrigger className="flex h-12 w-full items-center justify-between px-3 text-base font-semibold">
                <span>{day.label} {formatShortDate(day.date)}</span>
                <span>Voir</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 border-t p-3">
                {day.slots.length === 0 ? (
                  <div className="rounded-lg bg-muted p-3 text-base">—</div>
                ) : (
                  day.slots.map((slot, index) => (
                    <div
                      key={`${day.date}-mobile-${index}`}
                      className={
                        slot.status === "absent"
                          ? "rounded-lg border border-red-200 bg-red-50 p-3 text-base text-red-700 dark:border-red-900 dark:bg-red-950/30"
                          : slot.status === "present"
                            ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-base text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30"
                            : "rounded-lg border border-border bg-muted p-3 text-base"
                      }
                    >
                      <p className="font-semibold">{slot.subject}</p>
                      <p>{slot.time}</p>
                      <p>{slot.teacher}</p>
                      {slot.status === "absent" ? <p className="font-semibold">Absent(e)</p> : null}
                      {slot.status === "present" ? <p className="font-semibold">Présent(e)</p> : null}
                      {slot.status === "upcoming" ? <p className="font-semibold">Cours à venir</p> : null}
                    </div>
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Dernières absences</h2>
        {absencesQuery.data?.length ? (
          <div className="space-y-2">
            {absencesQuery.data.map((row, index) => (
              <Card key={`${row.date}-${index}`}>
                <CardContent className="space-y-1 p-4">
                  <p className="font-semibold">{formatDateFr(row.date)}</p>
                  <p>{row.subject} · {row.time_label}</p>
                  <p className="text-muted-foreground">{row.teacher_name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Aucune absence" message="Aucune absence récente pour cet élève." />
        )}

        <Link to="/parent/absences" className="inline-flex h-12 items-center text-base font-semibold text-primary underline-offset-4 hover:underline">
          Voir tout l'historique →
        </Link>
      </section>
    </div>
  )
}
