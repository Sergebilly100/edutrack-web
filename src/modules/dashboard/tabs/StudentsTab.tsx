import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState, emptyStateIcons } from "@/shared/components/EmptyState"
import { getStudentAbsenceStats, getTodayAbsences } from "@/modules/students/students.api"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import {
  TodayStudentAbsenceList,
  type TodayStudentAbsenceItem,
} from "@/modules/dashboard/DashboardPage"

const QUERY_STALE_TIME = 3 * 60_000
const TODAY_REFETCH_INTERVAL = 5 * 60_000

type StudentsTabProps = {
  canViewStudents: boolean
}

export function StudentsTab({ canViewStudents }: StudentsTabProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const studentLabels = useStudentLabels()

  const [showAllTodayStudentAbsences, setShowAllTodayStudentAbsences] = useState(false)

  const currentMonthRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = new Date()
    return {
      from: start.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    }
  }, [])

  const todayStudentAbsencesQuery = useQuery({
    queryKey: ["dashboard", "today-student-absences"],
    queryFn: getTodayAbsences,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: canViewStudents,
  })

  const riskStudentsQuery = useQuery({
    queryKey: ["dashboard", "risk-students", currentMonthRange.from, currentMonthRange.to],
    queryFn: () =>
      getStudentAbsenceStats({
        from: currentMonthRange.from,
        to: currentMonthRange.to,
        minAbsences: 1,
      }),
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: canViewStudents,
  })

  const todayStudentAbsenceItems: TodayStudentAbsenceItem[] = useMemo(() => {
    const groups = todayStudentAbsencesQuery.data ?? []
    return groups.flatMap((g) =>
      g.absences.map((abs) => ({
        studentId: abs.studentId,
        studentName: `${abs.studentFirstName} ${abs.studentLastName}`,
        className: g.className,
        createdAt: abs.createdAt,
        smsStatus: abs.smsStatus,
      }))
    )
  }, [todayStudentAbsencesQuery.data])

  const canToggleTodayStudentAbsences = todayStudentAbsenceItems.length > 6

  const topRiskStudents = (riskStudentsQuery.data ?? [])
    .sort((a, b) => b.absenceCount - a.absenceCount)
    .slice(0, 5)

  const riskStudentsLink = `/students?filter=risk&from=${currentMonthRange.from}&to=${currentMonthRange.to}`

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Absences élèves aujourd'hui */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg font-semibold">{`Absences ${studentLabels.pluralLower} aujourd'hui`}</CardTitle>
            {canToggleTodayStudentAbsences ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => setShowAllTodayStudentAbsences((current) => !current)}
              >
                {showAllTodayStudentAbsences ? "Afficher moins" : "Afficher tout"}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <TodayStudentAbsenceList
              items={todayStudentAbsenceItems}
              onOpenStudent={(studentId) =>
                navigate(
                  `/students/${studentId}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`
                )
              }
              expanded={showAllTodayStudentAbsences}
            />
          </CardContent>
        </Card>

        {/* Élèves à risque */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg font-semibold">{`${studentLabels.plural} à risque`}</CardTitle>
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <Link to={riskStudentsLink}>Voir tous</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {topRiskStudents.length === 0 ? (
              <EmptyState
                icon={emptyStateIcons.allGood}
                title={`Aucun ${studentLabels.singularLower} à risque`}
                message={`Aucun ${studentLabels.singularLower} ne dépasse le seuil d'alerte ce mois-ci.`}
              />
            ) : (
              <div className="space-y-2">
                {topRiskStudents.map((student) => (
                  <Button
                    key={student.studentId}
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-lg border border-border p-3"
                    onClick={() =>
                      navigate(
                        `/students/${student.studentId}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`
                      )
                    }
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium">{student.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.className} • {student.absenceCount} absence(s) •{" "}
                          {(student.absenceRate ?? 0).toFixed(2)}%
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
