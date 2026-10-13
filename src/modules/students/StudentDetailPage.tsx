import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Archive, CircleAlert, CircleCheck, GraduationCap, MessageSquare, Phone } from "lucide-react"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { ApiError } from "@/shared/api/client"
import { getFinancialStatus } from "@/modules/finance/finance.api"
import { formatFcfa } from "@/shared/utils/formatting"
import { normalizePhoneInput, isValidOptionalPhone } from "@/shared/utils/phone"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  excuseAbsence,
  getStudentAbsenceRecords,
  getCurrentStudentProfile,
  getHistoricalStudentProfile,
  retrySmsNotification,
  updateStudent,
  type StudentAbsenceRecord,
  type CurrentStudentProfile,
  type HistoricalStudentProfile,
} from "@/modules/students/students.api"
import { DocumentList, DocumentUpload, OfflineDisabledFieldset, PageLayout, PresenceDonut } from "@/shared/components"
import { StudentDossierTimeline } from "@/modules/students/components/StudentDossierTimeline"
import { StudentReportCards } from "@/modules/students/components/StudentReportCards"
import { StudentYearResults } from "@/modules/students/components/StudentYearResults"
import { StudentYearPayments } from "@/modules/students/components/StudentYearPayments"
import { DocumentChecklist } from "@/modules/enrollments/components/DocumentChecklist"
import { getStudentAcademicSummary, listStudentDocuments } from "@/modules/enrollments/enrollments.api"
import { enrollmentStatusLabel } from "@/modules/enrollments/enrollments.helpers"
import { countMissingMandatoryDocuments } from "@/modules/enrollments/enrollments.helpers"
import { BackIcon, InfoIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabel, useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { EmptyState } from "@/shared/components/EmptyState"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { studentDetailTourSteps } from "@/shared/lib/tour-steps"

const initials = (firstName: string, lastName: string) =>
  `${lastName?.[0] ?? ""}${firstName?.[0] ?? ""}`.toUpperCase()

const smsLabel: Record<"queued" | "sent" | "failed" | "delivered", string> = {
  queued: "En attente",
  sent: "Envoyé",
  failed: "Échec",
  delivered: "Livré",
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("fr-CI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`))

const formatSlot = (startTime: string | null, endTime: string | null) => {
  if (!startTime || !endTime) {
    return "-"
  }
  return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`
}

const ABSENCE_HISTORY_RANGE = {
  from: "2000-01-01",
  to: "2100-12-31",
} as const

export default function StudentDetailPage({ mode = "current" }: { mode?: "current" | "historical" }) {
  const historical = mode === "historical"
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { studentId = "" } = useParams<{ studentId: string }>()
  const studentLabel = useStudentLabel()
  const studentLabels = useStudentLabels()
  const { hasPermission } = usePermissions()
  const canViewSharedDocuments = hasPermission("students.documents")
  const canManageStudentDocuments = !historical && canViewSharedDocuments
  const canViewEnrollmentDocuments = hasPermission("enrollments.view")
  const canManageEnrollmentDocuments = !historical && hasPermission("enrollments.edit")
  const canViewDocuments = canViewSharedDocuments || canViewEnrollmentDocuments
  const canEditStudent = !historical && hasPermission("students.edit")
  const canViewAttendance = hasPermission("attendance.view")
  const canViewFinance = hasPermission("tuition.view") || hasPermission("payments.view") || hasPermission("payments.record")
  const canViewPaymentMovements = hasPermission("payments.view")
  const canViewReportCards = hasPermission("report_cards.view")
  const canViewEvaluations = hasPermission("evaluations.view")
  const tour = useTourGuide("student-detail", true)

  const [parentName, setParentName] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [parentName2, setParentName2] = useState("")
  const [parentPhone2, setParentPhone2] = useState("")
  const [note, setNote] = useState("")
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [recentAbsencesPage, setRecentAbsencesPage] = useState(1)
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string | null>(() => new URLSearchParams(location.search).get("year"))

  // Filtres tableau absences
  const [absenceFilterMonth, setAbsenceFilterMonth] = useState<string>("all")
  const [absenceFilterSubject, setAbsenceFilterSubject] = useState<string>("all")
  const [absenceFilterStatus, setAbsenceFilterStatus] = useState<string>("all")

  // Dialog excuse
  const [excuseDialogId, setExcuseDialogId] = useState<string | null>(null)
  const [excuseReason, setExcuseReason] = useState("")

  const lastSavedNoteRef = useRef("")
  const hydratedRef = useRef(false)
  const debouncedNote = useDebounce(note, 1000)

  const studentQuery = useQuery<CurrentStudentProfile | HistoricalStudentProfile>({
    queryKey: ["students", "detail", studentId, historical ? "historical-profile" : "school-profile"],
    queryFn: async () => historical ? getHistoricalStudentProfile(studentId) : getCurrentStudentProfile(studentId),
    enabled: studentId.trim().length > 0,
    refetchOnMount: "always",
  })

  const academicSummaryQuery = useQuery({
    queryKey: ["students", studentId, "academic-history"],
    queryFn: () => getStudentAcademicSummary(studentId),
    enabled: historical && Boolean(studentQuery.data) && !studentQuery.isFetching,
  })
  const academicYears = academicSummaryQuery.data?.years ?? []
  const preferredYearId = studentQuery.data && "confirmedInActiveYear" in studentQuery.data && studentQuery.data.confirmedInActiveYear
    ? studentQuery.data.activeSchoolYear?.id
    : studentQuery.data && "latestConfirmedSchoolYear" in studentQuery.data
      ? studentQuery.data.latestConfirmedSchoolYear?.id
      : null
  const defaultYear = academicYears.find((year) => year.schoolYearId === preferredYearId)
    ?? academicYears.find((year) => year.enrollmentStatus === "confirmed")
    ?? academicYears[0]
  const selectedYearId = selectedSchoolYearId ?? defaultYear?.schoolYearId ?? ""
  const selectedYear = academicYears.find((year) => year.schoolYearId === selectedYearId) ?? null
  const selectHistoricalYear = (value: string) => {
    setSelectedSchoolYearId(value)
    const params = new URLSearchParams(location.search)
    params.set("year", value)
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
    setRecentAbsencesPage(1)
    setAbsenceFilterMonth("all")
    setAbsenceFilterSubject("all")
    setAbsenceFilterStatus("all")
  }
  const absenceRange = historical && selectedYear?.startDate && selectedYear?.endDate
    ? { from: selectedYear.startDate, to: selectedYear.endDate }
    : !historical && studentQuery.data?.activeSchoolYear?.startDate && studentQuery.data.activeSchoolYear.endDate
      ? { from: studentQuery.data.activeSchoolYear.startDate, to: studentQuery.data.activeSchoolYear.endDate }
      : ABSENCE_HISTORY_RANGE

  const financialQuery = useQuery({
    queryKey: ["finance", "financial-status", studentId, studentQuery.data?.activeSchoolYear?.id],
    queryFn: () => getFinancialStatus(studentId, studentQuery.data!.activeSchoolYear!.id),
    enabled: !historical && canViewFinance && Boolean(studentQuery.data?.activeSchoolYear?.id) && !studentQuery.isFetching,
  })

  const enrollmentDocumentsQuery = useQuery({
    queryKey: ["enrollments", "documents", studentId],
    queryFn: () => listStudentDocuments(studentId),
    enabled: canViewEnrollmentDocuments && Boolean(studentQuery.data) && !studentQuery.isFetching,
  })
  const isEnrollmentDossierComplete = enrollmentDocumentsQuery.isSuccess &&
    countMissingMandatoryDocuments(enrollmentDocumentsQuery.data ?? []) === 0

  const absenceRecordsQuery = useQuery({
    queryKey: [
      "students",
      "detail",
      studentId,
      "absence-records",
      absenceRange.from,
      absenceRange.to,
    ],
    queryFn: () => getStudentAbsenceRecords(studentId, absenceRange),
    enabled: canViewAttendance && Boolean(studentQuery.data) && !studentQuery.isFetching && (!historical || Boolean(selectedYear)),
  })

  const saveContactsMutation = useMutation({
    mutationFn: () =>
      updateStudent(studentId, {
        parentName: parentName.trim() ? parentName.trim() : null,
        parentPhone: parentPhone.trim() ? parentPhone.trim() : null,
        parentEmail: parentEmail.trim() ? parentEmail.trim() : null,
        parentName2: parentName2.trim() ? parentName2.trim() : null,
        parentPhone2: parentPhone2.trim() ? parentPhone2.trim() : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["students", "detail", studentId] })
      await queryClient.invalidateQueries({ queryKey: ["students", "list"] })
      toast({ title: "Contacts parents mis à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour les contacts", variant: "destructive" })
    },
  })

  const saveNoteMutation = useMutation({
    mutationFn: (nextNote: string) =>
      updateStudent(studentId, {
        note: nextNote.trim() ? nextNote.trim() : null,
      }),
    onSuccess: async (_, savedNote) => {
      lastSavedNoteRef.current = savedNote
      setNoteStatus("saved")
      await queryClient.invalidateQueries({ queryKey: ["students", "detail", studentId] })
    },
    onError: () => {
      setNoteStatus("error")
    },
  })

  const retrySms = useMutation({
    mutationFn: (notificationId: string) => retrySmsNotification(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["students", "detail", studentId] })
      await queryClient.invalidateQueries({ queryKey: ["students", "detail", studentId, "absence-records"] })
      toast({ title: "SMS remis en file d'envoi" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de renvoyer le SMS", variant: "destructive" })
    },
  })

  const excuseAbsenceMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => excuseAbsence(id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["students", "detail", studentId] })
      await queryClient.invalidateQueries({ queryKey: ["students", "detail", studentId, "absence-records"] })
      setExcuseDialogId(null)
      setExcuseReason("")
      toast({ title: "Absence excusée" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'excuser l'absence", variant: "destructive" })
    },
  })

  useEffect(() => {
    const student = studentQuery.data
    if (!student) {
      return
    }

    setParentName(student.parentName ?? "")
    setParentPhone(student.parentPhone ?? "")
    setParentEmail(student.parentEmail ?? "")
    setParentName2(student.parentName2 ?? "")
    setParentPhone2(student.parentPhone2 ?? "")
    setNote(student.note ?? "")
    lastSavedNoteRef.current = student.note ?? ""
    hydratedRef.current = true
    setNoteStatus("idle")
    setRecentAbsencesPage(1)
    setAbsenceFilterMonth("all")
    setAbsenceFilterSubject("all")
    setAbsenceFilterStatus("all")
  }, [studentQuery.data])

  useEffect(() => {
    if (!canEditStudent || !studentId || !hydratedRef.current) {
      return
    }

    if (debouncedNote === lastSavedNoteRef.current) {
      if (noteStatus !== "idle") {
        setNoteStatus("idle")
      }
      return
    }

    setNoteStatus("saving")
    void saveNoteMutation.mutateAsync(debouncedNote)
  }, [canEditStudent, debouncedNote, noteStatus, saveNoteMutation, studentId])

  const estimatedPresentDays = useMemo(() => {
    const schoolDaysEstimate = 22
    const absences = studentQuery.data?.absenceSummary.thisMonth ?? 0
    return Math.max(0, schoolDaysEstimate - absences)
  }, [studentQuery.data?.absenceSummary.thisMonth])

  const absenceRows: StudentAbsenceRecord[] = (() => {
    if (canViewAttendance) {
      return absenceRecordsQuery.data ?? []
    }

    return (studentQuery.data?.recentAbsences ?? [])
      .filter((row) => !historical || (selectedYear && row.date >= selectedYear.startDate && row.date <= selectedYear.endDate))
      .map((row) => ({
      id: row.id,
      date: row.date,
      subject: row.subject,
      teacherName: row.teacherName,
      className: studentQuery.data?.className ?? "",
      startTime: row.startTime ?? "-",
      endTime: row.endTime ?? "-",
      status: row.status,
      excuseReason: row.excuseReason,
      smsPhone1: {
        phone: studentQuery.data?.parentPhone ?? null,
        status: row.smsStatus ?? "not_sent",
        sentAt: null,
      },
      smsPhone2: {
        phone: studentQuery.data?.parentPhone2 ?? null,
        status: "not_sent",
        sentAt: null,
      },
    }))
  })()
  const currentYearAbsenceTotal = absenceRows.filter((row) => row.status === "absent").length

  const absenceMonthOptions = (() => {
    const months = new Map<string, string>()
    for (const row of absenceRows) {
      const key = row.date.slice(0, 7)
      if (!months.has(key)) {
        const label = new Intl.DateTimeFormat("fr-CI", { month: "long", year: "numeric" })
          .format(new Date(`${key}-01T00:00:00Z`))
        months.set(key, label.charAt(0).toUpperCase() + label.slice(1))
      }
    }
    return [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  })()

  const absenceSubjectOptions = (() => {
    const subjects = new Set<string>()
    for (const row of absenceRows) subjects.add(row.subject)
    return [...subjects].sort()
  })()

  const filteredAbsences = (() => {
    return absenceRows.filter((row) => {
      if (absenceFilterMonth !== "all" && !row.date.startsWith(absenceFilterMonth)) return false
      if (absenceFilterSubject !== "all" && row.subject !== absenceFilterSubject) return false
      if (absenceFilterStatus !== "all" && row.status !== absenceFilterStatus) return false
      return true
    })
  })()

  const isValidOptionalEmail = (email: string) => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const areContactsValid = isValidOptionalPhone(parentPhone) && isValidOptionalPhone(parentPhone2) && isValidOptionalEmail(parentEmail)

  if (!studentId) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>{`Identifiant ${studentLabels.singularLower} manquant.`}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (studentQuery.isLoading || studentQuery.isFetching) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (studentQuery.isPaused && !studentQuery.data) {
    return <div className="p-4 md:p-6"><QueryErrorState className="[&_button]:min-h-12" title="Connexion indisponible" message="Reconnectez-vous pour charger la fiche de l’élève." onRetry={() => void studentQuery.refetch()} /></div>
  }

  if (studentQuery.isError && !(studentQuery.error instanceof ApiError && studentQuery.error.status === 404)) {
    return <div className="p-4 md:p-6"><QueryErrorState className="[&_button]:min-h-12" title="Fiche indisponible" message="Impossible de charger la fiche de l’élève. Réessayez dans un instant." onRetry={() => void studentQuery.refetch()} isRetrying={studentQuery.isFetching} /></div>
  }

  if (studentQuery.error instanceof ApiError && studentQuery.error.code === "STUDENT_NOT_CURRENTLY_ENROLLED") {
    return <PageLayout title="Fiche scolaire indisponible">
      <Alert><AlertDescription>Ce profil ne fait pas partie des élèves scolarisés confirmés dans l’année scolaire active. Son historique scolaire reste consultable dans son dossier.</AlertDescription></Alert>
      <Button className="mt-4 min-h-12" onClick={() => navigate(`/students/${studentId}/history`)}>Historique scolaire</Button>
    </PageLayout>
  }

  if (studentQuery.isError || !studentQuery.data) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>{`${studentLabels.singular} introuvable.`}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const student = studentQuery.data
  const resultsYearId = historical ? selectedYear?.schoolYearId : student.activeSchoolYear?.id
  const resultsYearLabel = historical ? selectedYear?.schoolYearLabel : student.activeSchoolYear?.label
  const latestConfirmedSchoolYear = "latestConfirmedSchoolYear" in student ? student.latestConfirmedSchoolYear : null
  const parentSmsRows = student.parentSms.filter((row) => !historical || (selectedYear &&
    row.date.slice(0, 10) >= selectedYear.startDate && row.date.slice(0, 10) <= selectedYear.endDate))
  const params = new URLSearchParams(location.search)
  const returnTo = params.get("returnTo") || "/records"
  const sentSmsCount = parentSmsRows.filter((row) => row.status === "sent" || row.status === "delivered").length
  const failedSmsCount = parentSmsRows.filter((row) => row.status === "failed").length
  const hasParentContact = Boolean(parentPhone.trim() || parentPhone2.trim())
  const absenceRiskLabel =
    student.absenceSummary.thisMonth > 3
      ? "Suivi renforcé"
      : student.absenceSummary.thisMonth > 0
        ? "À surveiller"
        : "RAS ce mois"

  const recentAbsencesPageSize = 8
  const recentAbsencesTotalPages = Math.max(1, Math.ceil(filteredAbsences.length / recentAbsencesPageSize))
  const recentAbsenceRows = filteredAbsences.slice(
    (recentAbsencesPage - 1) * recentAbsencesPageSize,
    recentAbsencesPage * recentAbsencesPageSize
  )

  const canExcuse = !historical && hasPermission("students.excuse")
  const isAbsenceTableLoading =
    canViewAttendance && absenceRecordsQuery.isLoading && !absenceRecordsQuery.data
  const hasAbsenceTableError = canViewAttendance && absenceRecordsQuery.isError

  return (
    <>
      <TourGuide
        steps={studentDetailTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <PageLayout
      title={historical ? `Dossier historique ${studentLabel.toLowerCase()}` : `Profil détaillé ${studentLabel.toLowerCase()}`}
      subtitle=""
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          {historical ? (
            "confirmedInActiveYear" in student && student.confirmedInActiveYear
              ? <Button className="min-h-12" onClick={() => navigate(`/students/${studentId}`)}>Voir l’année active</Button>
              : null
          ) : <Button className="min-h-12" onClick={() => navigate(`/students/${studentId}/history`)}>Historique scolaire</Button>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-muted-foreground"
            onClick={() => tour.restart()}
            aria-label="Revoir le guide"
          >
            <InfoIcon className="mr-1.5 h-4 w-4" />
            Guide
          </Button>
          <Button variant="outline" onClick={() => navigate(returnTo)}>
            <BackIcon className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
      }
    >
      <OfflineDisabledFieldset showNotice={false}>
      <nav aria-label="Fil d’Ariane" className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>Dossiers élèves</span>
        <span aria-hidden="true">/</span>
        <span>{student.lastName} {student.firstName}</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-foreground">{historical ? `Historique scolaire${selectedYear?.schoolYearLabel ? ` · ${selectedYear.schoolYearLabel}` : ""}` : "Année en cours"}</span>
      </nav>

      {historical ? (
        <section className="mb-5 overflow-hidden rounded-lg border border-blue-200 bg-blue-50/70" aria-label="Contexte du dossier historique">
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] sm:items-center sm:px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Archive className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Historique scolaire · lecture seule</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {student.activeSchoolYear && !("confirmedInActiveYear" in student && student.confirmedInActiveYear)
                    ? `Cet élève n’est pas inscrit dans l’année scolaire en cours : ${student.activeSchoolYear.label}. `
                    : ""}
                  {latestConfirmedSchoolYear ? `Dernière année scolaire confirmée : ${latestConfirmedSchoolYear.label} · ${latestConfirmedSchoolYear.className}. Vous consultez les données ${selectedYear?.schoolYearLabel ?? latestConfirmedSchoolYear.label}.` : "Vous consultez un dossier scolaire archivé."}
                </p>
              </div>
            </div>
            <div className="border-t border-blue-200 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-sm text-muted-foreground">Les années passées et l’année active se consultent ici en lecture seule.</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm" data-tour="student-detail-profile">
        <div className="flex flex-col gap-5 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-14 w-14 flex-shrink-0">
              <AvatarFallback className="text-base font-semibold">
                {initials(student.firstName, student.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight">{student.lastName} {student.firstName}</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{historical ? selectedYear?.className ?? latestConfirmedSchoolYear?.className ?? "Classe indisponible" : student.className ?? "Classe indisponible"} · {historical ? selectedYear?.schoolYearLabel ?? latestConfirmedSchoolYear?.label : student.activeSchoolYear?.label}</p>
              {student.matricule ? (
                <p className="mt-1 truncate text-sm text-muted-foreground">Matricule : {student.matricule}{student.birthDate ? ` · Né(e) le ${new Date(student.birthDate).toLocaleDateString("fr-FR")}` : ""}</p>
              ) : null}
            </div>
          </div>
          {historical ? (
            <div className="w-full space-y-2 md:w-auto md:min-w-[18rem]">
              <div className="flex justify-end"><Badge variant="outline" className="gap-1.5 rounded-md px-2.5 py-1"><Archive className="h-3.5 w-3.5" aria-hidden="true" />Lecture seule</Badge></div>
              <Label htmlFor="student-school-year">Année scolaire consultée</Label>
              <Select value={selectedYearId} onValueChange={selectHistoricalYear}>
                <SelectTrigger id="student-school-year" className="min-h-12 w-full bg-background">
                  <SelectValue placeholder="Choisir une année scolaire" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => <SelectItem key={year.schoolYearId} value={year.schoolYearId}>{year.schoolYearLabel} · {year.className}{year.schoolYearStatus === "active" ? " · Active" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid w-full gap-3 border-t pt-4 text-sm sm:grid-cols-2 md:w-auto md:min-w-[22rem] md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <div>
                <p className="text-muted-foreground">Contact parent</p>
                <p className="mt-1 font-semibold">{hasParentContact ? "Renseigné" : "Manquant"}</p>
              </div>
              <div className="sm:border-l sm:pl-4">
                <p className="text-muted-foreground">Statut</p>
                <div className="mt-1 flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${student.isActive ? "bg-green-600" : "bg-red-600"}`} aria-hidden="true" />{student.isActive ? "Actif" : "Inactif"}</div>
              </div>
            </div>
          )}
        </div>
        {historical ? <div className="grid border-t bg-muted/20 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b px-4 py-3.5 sm:border-r lg:border-b-0"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Absences de la sélection</p><p className="mt-1 text-xl font-semibold tabular-nums">{canViewAttendance ? absenceRows.length : "-"}</p></div>
          <div className="border-b px-4 py-3.5 lg:border-b-0 lg:border-r"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Année consultée</p><p className="mt-1 text-xl font-semibold tabular-nums">{selectedYear?.schoolYearLabel ?? "Toutes"}</p></div>
          <div className="border-b px-4 py-3.5 sm:border-r lg:border-b-0"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact parent</p><p className="mt-1 truncate text-sm font-semibold">{hasParentContact ? "Renseigné" : "Manquant"}</p></div>
          <div className="px-4 py-3.5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut de l’inscription</p><p className="mt-1 text-sm font-semibold">{selectedYear?.enrollmentStatus ? enrollmentStatusLabel[selectedYear.enrollmentStatus] : "Aucune inscription"}</p></div>
        </div> : null}
      </section>

      {historical && selectedSchoolYearId && !selectedYear && academicSummaryQuery.isSuccess ? (
        <Alert variant="destructive" className="mt-4"><AlertDescription>Cette année scolaire est introuvable dans le dossier de cet élève. Choisissez une année disponible.</AlertDescription></Alert>
      ) : null}

      {student.historicalSources?.length ? <section className="mt-4 grid gap-4 rounded-lg border border-dashed bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,24rem)] sm:p-5" aria-label="Références historiques importées">
        <div>
          <h2 className="text-sm font-semibold">Références importées</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{student.historicalSources.map((source) => <li key={source.schoolYearLabel}><span className="font-medium text-foreground">{source.schoolYearLabel}</span> · Ancienne classe : {source.oldClassName ?? "non renseignée"}</li>)}</ul>
        </div>
        <div className="flex gap-3 border-t pt-3 text-sm text-muted-foreground sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
          <p>Ces références complètent le dossier, mais ne constituent pas des inscriptions.</p>
        </div>
      </section> : null}

      {historical ? <section className="mt-4 overflow-hidden rounded-lg border bg-card" aria-label={canViewFinance ? "Parcours scolaire et situation financière" : "Parcours scolaire"}>
        <header className="border-b bg-muted/20 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <CardTitle className="text-base">{canViewFinance ? "Parcours scolaire et situation financière" : "Parcours scolaire"}</CardTitle>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Les données affichées correspondent à l’année sélectionnée dans le dossier historique.</p>
        </header>
        <div className="space-y-3 p-4 sm:p-5">
          {academicSummaryQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {academicSummaryQuery.isError ? <QueryErrorState title="Historique indisponible" message="Impossible de charger les années scolaires." onRetry={() => void academicSummaryQuery.refetch()} /> : null}
          {academicSummaryQuery.data && academicYears.length === 0 ? <EmptyState title="Aucune année scolaire" description="Ce dossier ne contient pas encore d’année scolaire à consulter." /> : null}
          {academicYears.filter((year) => year.schoolYearId === selectedYear?.schoolYearId).map((year) => {
            const hasFinancialData = [year.totalDue, year.confirmedPaid, year.waivedAmount, year.remainingDue].some((value) => value !== null)

            return <article key={year.schoolYearId} className="border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-base">{year.schoolYearLabel}</strong><span className="text-muted-foreground">· {year.className}</span><Badge variant="outline">{year.enrollmentStatus ? enrollmentStatusLabel[year.enrollmentStatus] : "Classe historique"}</Badge>{year.schoolYearStatus === "active" ? <Badge>Année active</Badge> : null}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Décision : {year.decision}</p>
                </div>
                <p className="text-sm text-muted-foreground">{year.schoolYearId === selectedYear?.schoolYearId ? "Année consultée" : "Historique"}</p>
              </div>
              {canViewFinance && hasFinancialData ? (
                <dl className="mt-4 grid divide-y rounded-md border bg-muted/20 text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                  <div className="p-3"><dt className="text-muted-foreground">Total dû</dt><dd className="mt-1 font-semibold tabular-nums">{year.totalDue === null ? "Non disponible" : formatFcfa(year.totalDue)}</dd></div>
                  <div className="p-3"><dt className="text-muted-foreground">Paiements confirmés</dt><dd className="mt-1 font-semibold tabular-nums">{year.confirmedPaid === null ? "Non disponible" : formatFcfa(year.confirmedPaid)}</dd></div>
                  <div className="p-3"><dt className="text-muted-foreground">Remises accordées</dt><dd className="mt-1 font-semibold tabular-nums">{year.waivedAmount === null ? "Non disponible" : formatFcfa(year.waivedAmount)}</dd></div>
                  <div className="p-3"><dt className="text-muted-foreground">Reste à régler</dt><dd className="mt-1 font-semibold tabular-nums">{year.remainingDue === null ? "Non disponible" : formatFcfa(year.remainingDue)}</dd></div>
                </dl>
              ) : canViewFinance ? (
                <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <p><span className="font-medium text-foreground">Situation financière indisponible pour {year.schoolYearLabel}.</span> {year.enrollmentStatus && year.enrollmentStatus !== "confirmed" ? "Cette inscription n’est pas encore confirmée." : year.financialStatus === "not_configured" ? "Les frais de cette année ne sont pas configurés." : "Aucun total annuel fiable ne peut être affiché."}</p>
                </div>
              ) : null}
            </article>
          })}
        </div>
      </section> : canViewFinance ? <section className="mt-4 overflow-hidden rounded-lg border" aria-label="Situation financière de l’élève">
          {financialQuery.isLoading ? <Skeleton className="h-20 w-full" aria-label="Chargement de la situation financière" /> : null}
          {financialQuery.isError ? <QueryErrorState title="Situation financière indisponible" message={financialQuery.error instanceof ApiError && financialQuery.error.code === "TUITION_PLAN_REQUIRED" ? "Les frais scolaires ne sont pas encore configurés pour cette année." : "Impossible de charger la situation financière."} onRetry={() => void financialQuery.refetch()} isRetrying={financialQuery.isFetching} /> : null}
          {financialQuery.data ? <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(10rem,0.72fr)_minmax(10rem,0.72fr)]">
            <div className={`flex gap-3 p-4 sm:p-5 ${financialQuery.data.standing === "late" ? "bg-red-50" : "bg-green-50"}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${financialQuery.data.standing === "late" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {financialQuery.data.standing === "late" ? <CircleAlert className="h-5 w-5" aria-hidden="true" /> : <CircleCheck className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Situation financière · {student.activeSchoolYear?.label}</p>
                <p className="mt-0.5 text-base font-semibold">{financialQuery.data.standing === "late" ? "Échéances en retard" : "Échéances à jour"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{financialQuery.data.standing === "late" ? "Une régularisation est attendue." : "Aucune échéance en attente de règlement."}</p>
              </div>
            </div>
            <div className="border-t px-4 py-4 sm:px-5 lg:border-l lg:border-t-0">
              <p className="text-sm text-muted-foreground">Reste total à régler</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatFcfa(financialQuery.data.remainingDue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Sur {formatFcfa(financialQuery.data.totalDue)} dûs</p>
            </div>
            <div className="border-t px-4 py-4 sm:px-5 lg:border-l lg:border-t-0">
              <p className="text-sm text-muted-foreground">Paiements confirmés</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatFcfa(financialQuery.data.confirmedPaid)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Remises : {formatFcfa(financialQuery.data.waivedAmount)}</p>
            </div>
          </div> : null}
      </section> : null}

      <Tabs defaultValue={canViewAttendance ? "absences" : "dossier"} className="mt-6 space-y-4">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-muted/60 p-1">
          {canViewAttendance ? <TabsTrigger value="absences" data-tour="student-detail-tab-absences" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">Absences</TabsTrigger> : null}
          <TabsTrigger value="dossier" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">Fil d'activité</TabsTrigger>
          {canViewDocuments ? <TabsTrigger value="documents" data-tour="student-detail-tab-documents" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">
            Dossier
          </TabsTrigger> : null}
          {canViewReportCards ? <TabsTrigger value="report-cards" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">Bulletins</TabsTrigger> : null}
          {canViewEvaluations ? <TabsTrigger value="results" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">Résultats</TabsTrigger> : null}
          {canViewPaymentMovements ? <TabsTrigger value="payments" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">Paiements et remises</TabsTrigger> : null}
          <TabsTrigger value="informations" data-tour="student-detail-tab-informations" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">
            Infos Parents
          </TabsTrigger>
          {canViewAttendance ? <TabsTrigger value="sms" data-tour="student-detail-tab-sms" className="min-h-12 shrink-0 px-4 data-[state=active]:bg-background">
            Notifications Parents
          </TabsTrigger> : null}
        </TabsList>

        {canViewAttendance ? <TabsContent value="absences" className="space-y-4">
          {!historical ? <section className="overflow-hidden rounded-lg border bg-card" data-tour="student-detail-absences" aria-label="Synthèse et estimation de présence">
            <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-4"><p className="text-sm text-muted-foreground">Total annuel</p><p className="mt-1 text-2xl font-semibold tabular-nums">{currentYearAbsenceTotal}</p></div>
              <div className="px-4 py-4"><p className="text-sm text-muted-foreground">Ce mois</p><p className="mt-1 text-2xl font-semibold tabular-nums">{student.absenceSummary.thisMonth}</p></div>
              <div className="px-4 py-4"><p className="text-sm text-muted-foreground">Cette semaine</p><p className="mt-1 text-2xl font-semibold tabular-nums">{student.absenceSummary.thisWeek}</p></div>
            </div>
            <div className="flex flex-col gap-4 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div><h3 className="text-sm font-semibold">Présence estimée, mois en cours</h3><p className="mt-1 max-w-xl text-sm text-muted-foreground">Estimation sur 22 jours d'école : {estimatedPresentDays} jours présents, {student.absenceSummary.thisMonth} absences. Le détail est disponible ci-dessous.</p></div>
              <PresenceDonut present={estimatedPresentDays} absent={student.absenceSummary.thisMonth} late={0} size="sm" />
            </div>
          </section> : <section className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4 text-sm" aria-label="Synthèse des absences archivées"><Archive className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" /><p>Absences pour {selectedYear?.schoolYearLabel ?? "toutes les années"} : <strong>{canViewAttendance ? absenceRows.length : "consultation non autorisée"}</strong></p></section>}

          <Card>
            <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Absences</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Filtrez l’historique sans quitter le dossier de l’élève.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={absenceFilterMonth}
                  onValueChange={(v) => { setAbsenceFilterMonth(v); setRecentAbsencesPage(1) }}
                >
                  <Label className="sr-only" htmlFor="student-absence-month">Mois</Label>
                  <SelectTrigger id="student-absence-month" className="min-h-12 w-full text-sm sm:w-[160px]">
                    <SelectValue placeholder="Tous les mois" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les mois</SelectItem>
                    {absenceMonthOptions.map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={absenceFilterSubject}
                  onValueChange={(v) => { setAbsenceFilterSubject(v); setRecentAbsencesPage(1) }}
                >
                  <Label className="sr-only" htmlFor="student-absence-subject">Matière</Label>
                  <SelectTrigger id="student-absence-subject" className="min-h-12 w-full text-sm sm:w-[170px]">
                    <SelectValue placeholder="Toutes matières" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes matières</SelectItem>
                    {absenceSubjectOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={absenceFilterStatus}
                  onValueChange={(v) => { setAbsenceFilterStatus(v); setRecentAbsencesPage(1) }}
                >
                  <Label className="sr-only" htmlFor="student-absence-status">Statut</Label>
                  <SelectTrigger id="student-absence-status" className="min-h-12 w-full text-sm sm:w-[150px]">
                    <SelectValue placeholder="Tous statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="excused">Excusé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasAbsenceTableError ? (
                <Alert variant="destructive">
                  <AlertDescription>Impossible de charger l&apos;historique complet des absences.</AlertDescription>
                </Alert>
              ) : null}

              {isAbsenceTableLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={`student-absence-history-skeleton-${index}`} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredAbsences.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune absence pour ces filtres.</p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Horaire</TableHead>
                          <TableHead>Matière</TableHead>
                          <TableHead>Professeur</TableHead>
                          <TableHead>Statut</TableHead>
                          {canExcuse ? <TableHead className="w-[110px] align-right">Action</TableHead> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentAbsenceRows.map((row) => {
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                              <TableCell>{formatSlot(row.startTime, row.endTime)}</TableCell>
                              <TableCell>{row.subject}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.teacherName}</TableCell>
                              <TableCell>
                                {row.status === "excused" ? (
                                  <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700">
                                    Excusé
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-red-200 bg-red-100 text-red-700">
                                    Absent
                                  </Badge>
                                )}
                                {row.excuseReason ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{row.excuseReason}</p>
                                ) : null}
                              </TableCell>
                              {canExcuse ? (
                                <TableCell>
                                  {row.status === "absent" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="default"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setExcuseDialogId(row.id)}
                                    >
                                      Excuser
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              ) : null}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {filteredAbsences.length} absence{filteredAbsences.length > 1 ? "s" : ""} - page {recentAbsencesPage} / {recentAbsencesTotalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={recentAbsencesPage <= 1}
                        onClick={() => setRecentAbsencesPage((p) => Math.max(1, p - 1))}
                      >
                        Précédent
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={recentAbsencesPage >= recentAbsencesTotalPages}
                        onClick={() => setRecentAbsencesPage((p) => Math.min(recentAbsencesTotalPages, p + 1))}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent> : null}

        <TabsContent value="dossier" className="space-y-4">
          {historical && !selectedYear ? <EmptyState title="Choisissez une année" description="La chronologie annuelle s’affichera pour l’année sélectionnée." /> :
            <StudentDossierTimeline studentId={student.id} schoolYear={selectedYear ? { id: selectedYear.schoolYearId } : student.activeSchoolYear ? { id: student.activeSchoolYear.id } : null} />}
        </TabsContent>

        {canViewDocuments ? (
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{historical ? "Documents du profil élève" : "Documents du dossier"}</CardTitle>
                  {!historical && isEnrollmentDossierComplete ? <Badge className="bg-green-600 text-white hover:bg-green-600">Complet</Badge> : null}
                  
                </div>
                <p className="text-xs text-muted-foreground">Les documents de profil restent permanents. Les pièces d’inscription existantes ne portent pas d’année scolaire et ne sont pas attribuées à l’année consultée.</p>
              </CardHeader>
              <CardContent className="space-y-6 mt-5">
                {canManageStudentDocuments ? (
                  <div className="space-y-3">
                    <DocumentUpload entityType="student" entityId={student.id} onUploadSuccess={() => undefined} />
                  </div>
                ) : null}
                <DocumentList
                  entityType="student"
                  entityId={student.id}
                  includeSharedDocuments={canViewSharedDocuments}
                  includeEnrollmentDocuments={canViewEnrollmentDocuments}
                  canManageEnrollmentDocuments={canManageEnrollmentDocuments}
                  readOnly={historical}
                  schoolYear={null}
                />
                {canViewEnrollmentDocuments && !historical && !isEnrollmentDossierComplete ? (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-medium">Pièces requises</h3>
                        <p className="text-xs text-muted-foreground">Complétez ou mettez à jour les pièces demandées pour l’inscription.</p>
                      </div>
                      <DocumentChecklist studentId={student.id} canEdit={!historical && hasPermission("enrollments.edit")} />
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {canViewReportCards ? <TabsContent value="report-cards" className="space-y-4">
          {historical && !selectedYear ? <EmptyState title="Choisissez une année" description="Les bulletins publiés apparaîtront pour l’année sélectionnée." /> : <StudentReportCards studentId={student.id} schoolYearId={historical ? selectedYear!.schoolYearId : student.activeSchoolYear?.id ?? null} />}
        </TabsContent> : null}

        {canViewEvaluations ? <TabsContent value="results" className="space-y-4">
          {resultsYearId && resultsYearLabel ? <StudentYearResults studentId={student.id} schoolYearId={resultsYearId} schoolYearLabel={resultsYearLabel} /> : <EmptyState title="Choisissez une année" description="Les notes de l’année sélectionnée s’afficheront ici." />}
        </TabsContent> : null}

        {canViewPaymentMovements ? <TabsContent value="payments" className="space-y-4">
          {resultsYearId && resultsYearLabel && (!historical || selectedYear?.enrollmentStatus === "confirmed")
            ? <StudentYearPayments studentId={student.id} schoolYearId={resultsYearId} schoolYearLabel={resultsYearLabel} />
            : <EmptyState title="Aucun paiement annuel à consulter" description="Choisissez une inscription confirmée pour consulter ses paiements et remises." />}
        </TabsContent> : null}

        <TabsContent value="informations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts parents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Le parent principal correspond à un compte réel. Le compte est créé ou réutilisé selon le téléphone ; les accès sont envoyés uniquement lorsqu’un nouveau compte est créé.
                </AlertDescription>
              </Alert>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="student-parent-name">Nom parent 1</Label>
                  <Input
                    id="student-parent-name"
                    value={parentName}
                    onChange={(event) => setParentName(event.target.value)}
                    placeholder="Nom parent 1"
                    disabled={!canEditStudent}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="student-parent-phone">Téléphone parent 1</Label>
                    <Input
                      id="student-parent-phone"
                      value={parentPhone}
                      onChange={(event) => setParentPhone(normalizePhoneInput(event.target.value))}
                      inputMode="tel"
                      maxLength={13}
                      placeholder="2250701234567"
                      disabled={!canEditStudent}
                    />
                  </div>
                  <Button type="button" variant="outline" asChild disabled={!parentPhone.trim()}>
                    <a href={parentPhone.trim() ? `tel:${parentPhone.trim()}` : undefined}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="student-parent-email">Email parent <span className="text-xs text-muted-foreground">(optionnel)</span></Label>
                <Input
                  id="student-parent-email"
                  type="email"
                  value={parentEmail}
                  onChange={(event) => setParentEmail(event.target.value)}
                  inputMode="email"
                  placeholder="parent@exemple.com"
                  disabled={!canEditStudent}
                />
                {parentEmail.trim() && !isValidOptionalEmail(parentEmail) ? (
                  <p className="text-xs text-destructive">Format email invalide</p>
                ) : null}
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="student-parent-name-2">Nom parent 2</Label>
                  <Input
                    id="student-parent-name-2"
                    value={parentName2}
                    onChange={(event) => setParentName2(event.target.value)}
                    placeholder="Nom parent 2"
                    disabled={!canEditStudent}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="student-parent-phone-2">Téléphone parent 2</Label>
                    <Input
                      id="student-parent-phone-2"
                      value={parentPhone2}
                      onChange={(event) => setParentPhone2(normalizePhoneInput(event.target.value))}
                      inputMode="tel"
                      maxLength={13}
                      placeholder="2250701234567"
                      disabled={!canEditStudent}
                    />
                  </div>
                  <Button type="button" variant="outline" asChild disabled={!parentPhone2.trim()}>
                    <a href={parentPhone2.trim() ? `tel:${parentPhone2.trim()}` : undefined}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
              {!areContactsValid ? (
                <Alert variant="destructive">
                  <AlertDescription>Les téléphones parents doivent respecter le format 225XXXXXXXXXX.</AlertDescription>
                </Alert>
              ) : null}

              {canEditStudent ? (
                <Button type="button" onClick={() => saveContactsMutation.mutate()} disabled={saveContactsMutation.isPending || !areContactsValid}>
                  {saveContactsMutation.isPending ? "Enregistrement..." : "Modifier les contacts"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {canViewAttendance ? <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique Notifications parents</CardTitle>
            </CardHeader>
            <CardContent>
              {parentSmsRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{`Aucun SMS trouvé pour cet ${studentLabels.singularLower}.`}</p>
              ) : (
                <div className="space-y-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{sentSmsCount} envoyés</Badge>
                  <Badge variant={failedSmsCount > 0 ? "destructive" : "outline"}>{failedSmsCount} échecs</Badge>
                </div>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Motif</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Statut</TableHead>
                      {!historical ? <TableHead className="w-[130px]">Action</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parentSmsRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.date).toLocaleString()}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{row.reason}</TableCell>
                        <TableCell>{row.recipientPhone}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>{smsLabel[row.status]}</Badge>
                        </TableCell>
                        {!historical ? <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={row.status !== "failed" || retrySms.isPending}
                            onClick={() => retrySms.mutate(row.id)}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Renvoyer
                          </Button>
                        </TableCell> : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent> : null}
      </Tabs>
      <Dialog
        open={excuseDialogId !== null}
        onOpenChange={(open) => {
          if (!open) { setExcuseDialogId(null); setExcuseReason("") }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excuser l&apos;absence</DialogTitle>
            <DialogDescription>
              {`Saisissez le motif d'excuse. Il sera enregistré sur le dossier de l'${studentLabels.singularLower}.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motif de l'excuse…"
            value={excuseReason}
            onChange={(e) => setExcuseReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setExcuseDialogId(null); setExcuseReason("") }}
              disabled={excuseAbsenceMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              disabled={!excuseReason.trim() || excuseAbsenceMutation.isPending}
              onClick={() => {
                if (excuseDialogId) {
                  excuseAbsenceMutation.mutate({ id: excuseDialogId, reason: excuseReason.trim() })
                }
              }}
            >
              {excuseAbsenceMutation.isPending ? "Enregistrement…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </OfflineDisabledFieldset>
    </PageLayout>
    </>
  )
}
