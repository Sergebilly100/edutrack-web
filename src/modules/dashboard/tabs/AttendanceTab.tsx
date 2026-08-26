import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState, emptyStateIcons } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { getInitials } from "@/shared/utils/avatar"
import {
  getCurrentMonthKey,
  getTeacherCompliance,
  getTodayAttendance,
  getTopRiskTeachers,
} from "@/modules/dashboard/dashboard.api"
import { getTodayAbsences } from "@/modules/students/students.api"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import {
  TodayPresenceList,
  TodayStudentAbsenceList,
  type TodayStudentAbsenceItem,
} from "@/modules/dashboard/DashboardPage"

const QUERY_STALE_TIME = 3 * 60_000
const TODAY_REFETCH_INTERVAL = 5 * 60_000

const statusToneBadge = {
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
}

type AttendanceTabProps = {
  canViewAttendance: boolean
  canViewTeachers: boolean
  canViewStudents: boolean
}

export function AttendanceTab({
  canViewAttendance,
  canViewTeachers,
  canViewStudents,
}: AttendanceTabProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const studentLabels = useStudentLabels()
  const currentMonth = getCurrentMonthKey(new Date())

  const [showAllTodayPresence, setShowAllTodayPresence] = useState(false)
  const [showAllTodayStudentAbsences, setShowAllTodayStudentAbsences] = useState(false)

  const todayQuery = useQuery({
    queryKey: ["dashboard", "today-v3"],
    queryFn: getTodayAttendance,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: TODAY_REFETCH_INTERVAL,
    retry: false,
    enabled: canViewAttendance,
  })

  const riskTeachersQuery = useQuery({
    queryKey: ["dashboard", "risk-teachers-v3", currentMonth],
    queryFn: () => getTopRiskTeachers(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewTeachers,
  })

  const teacherComplianceQuery = useQuery({
    queryKey: ["dashboard", "teacher-compliance", currentMonth],
    queryFn: () => getTeacherCompliance(currentMonth),
    staleTime: QUERY_STALE_TIME,
    retry: false,
    enabled: canViewTeachers,
  })

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

  // Tâche 7a : risque élève calculé côté serveur (student_risk_status).
  const riskStudentsQuery = useQuery({
    queryKey: ["dashboard", "risk-students-v2"],
    queryFn: async () => {
      const { apiClient } = await import("@/shared/api/client")
      const response = await apiClient.get<{ students: Array<Record<string, unknown>> }>("/risk/students")
      const payload = response.data ?? {}
      return Array.isArray(payload.students) ? payload.students : []
    },
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

  const topRiskStudents = useMemo(() => {
    return (riskStudentsQuery.data ?? [])
      .filter((student) => Number(student.risk_score ?? 0) > 0)
      .map((student) => ({
        studentId: String(student.student_id),
        studentName: String(student.student_name),
        className: String(student.class_name ?? ""),
        absenceCount: Number(student.absence_count ?? 0),
        absenceRate: Number(student.absence_rate ?? 0),
      }))
      .slice(0, 5)
  }, [riskStudentsQuery.data])

  const canToggleTodayPresence = (todayQuery.data?.courses.length ?? 0) > 5
  const canToggleTodayStudentAbsences = todayStudentAbsenceItems.length > 6

  const riskTeachersLink = `/teachers?filter=risk&month=${currentMonth}`
  const riskStudentsLink = `/students?filter=risk&from=${currentMonthRange.from}&to=${currentMonthRange.to}`

  return (
    <div className="space-y-6">
      {/* Présences professeurs + Profs à risque */}
      {canViewAttendance || canViewTeachers ? (
        <section
          className={
            canViewAttendance && canViewTeachers
              ? "grid grid-cols-1 gap-4 xl:grid-cols-3"
              : "grid grid-cols-1 gap-4"
          }
        >
          {canViewAttendance ? (
            <Card className={canViewAttendance && canViewTeachers ? "xl:col-span-2" : undefined}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold">Présences professeurs aujourd'hui</CardTitle>
                {canToggleTodayPresence ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => setShowAllTodayPresence((current) => !current)}
                  >
                    {showAllTodayPresence ? "Afficher moins" : "Afficher tout"}
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent>
                <TodayPresenceList
                  courses={todayQuery.data?.courses ?? []}
                  expanded={showAllTodayPresence}
                  date={todayQuery.data?.date ?? new Date().toISOString().slice(0, 10)}
                />
              </CardContent>
            </Card>
          ) : null}

          {canViewTeachers ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold">Profs à risque</CardTitle>
                <Button asChild variant="outline" size="sm" className="min-h-10">
                  <Link to={riskTeachersLink} data-testid="dashboard-risk-see-all">
                    Voir tous
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {(riskTeachersQuery.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={emptyStateIcons.allGood}
                    title="Aucun profil à risque"
                    message="Aucun professeur ne dépasse le seuil d'alerte ce mois-ci."
                  />
                ) : (
                  <div className="space-y-2">
                    {(riskTeachersQuery.data ?? []).map((teacher) => (
                      <Button
                        key={teacher.teacherId}
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-lg border border-border p-3"
                        onClick={() =>
                          navigate(
                            `/teachers/${teacher.teacherId}?returnTo=${encodeURIComponent(location.pathname + location.search)}`
                          )
                        }
                      >
                        <div className="animate-fade-in flex w-full items-center justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs font-semibold">
                                {getInitials(teacher.teacherName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 text-left">
                              <p className="truncate text-sm font-medium">{teacher.teacherName}</p>
                              <p className="text-xs text-muted-foreground">
                                {teacher.absenceCount} absence(s) • {Math.round(teacher.attendanceRate)}% présence
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* Conformité profs */}
      {canViewTeachers ? (
        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Conformité profs ce mois</CardTitle>
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link to="/teachers?tab=classement">Voir le classement complet</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {teacherComplianceQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : teacherComplianceQuery.isError ? (
                <QueryErrorState
                  onRetry={() => void teacherComplianceQuery.refetch()}
                  isRetrying={teacherComplianceQuery.isFetching}
                />
              ) : (teacherComplianceQuery.data ?? []).length === 0 ? (
                <EmptyState
                  icon={emptyStateIcons.noTeachers}
                  title="Aucun scan de fin"
                  message="Les taux apparaîtront dès que les cours seront terminés."
                />
              ) : (
                <div className="space-y-2">
                  {(teacherComplianceQuery.data ?? []).slice(0, 3).map((teacher) => (
                    <div
                      key={teacher.teacherId}
                      className="flex min-h-[48px] items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {teacher.rank}. {teacher.teacherName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.totalCheckouts}/{teacher.totalCheckins} cours
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          teacher.complianceRate >= 80
                            ? statusToneBadge.success
                            : teacher.complianceRate < 30
                              ? statusToneBadge.warning
                              : statusToneBadge.neutral
                        }
                      >
                        {Math.round(teacher.complianceRate)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Absences élèves aujourd'hui + Élèves à risque */}
      {canViewStudents ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
      ) : null}
    </div>
  )
}
