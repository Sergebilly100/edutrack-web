import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { BookOpen, Clock3, MessageSquare, Phone, UserCheck } from "lucide-react"
import { useDebounce } from "@/shared/hooks/useDebounce"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  excuseAbsence,
  getStudentAbsenceRecords,
  getStudentById,
  retrySmsNotification,
  updateStudent,
  type StudentAbsenceRecord,
} from "@/modules/students/students.api"
import { DocumentList, DocumentUpload, OfflineDisabledFieldset, PageLayout, PresenceDonut, StatCard } from "@/shared/components"
import { BackIcon, InfoIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabel, useStudentLabels } from "@/shared/hooks/useStudentLabel"
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

export default function StudentDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { studentId = "" } = useParams<{ studentId: string }>()
  const studentLabel = useStudentLabel()
  const studentLabels = useStudentLabels()
  const { hasPermission } = usePermissions()
  const canManageStudentDocuments = hasPermission("students.documents")
  const canEditStudent = hasPermission("students.edit")
  const canViewAttendance = hasPermission("attendance.view")
  const tour = useTourGuide("student-detail", true)

  const [parentName, setParentName] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [parentName2, setParentName2] = useState("")
  const [parentPhone2, setParentPhone2] = useState("")
  const [note, setNote] = useState("")
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [recentAbsencesPage, setRecentAbsencesPage] = useState(1)

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

  const studentQuery = useQuery({
    queryKey: ["students", "detail", studentId],
    queryFn: () => getStudentById(studentId),
    enabled: studentId.trim().length > 0,
  })

  const absenceRecordsQuery = useQuery({
    queryKey: [
      "students",
      "detail",
      studentId,
      "absence-records",
      ABSENCE_HISTORY_RANGE.from,
      ABSENCE_HISTORY_RANGE.to,
    ],
    queryFn: () => getStudentAbsenceRecords(studentId, ABSENCE_HISTORY_RANGE),
    enabled: canViewAttendance && studentId.trim().length > 0,
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

  const absenceRows = useMemo<StudentAbsenceRecord[]>(() => {
    if (canViewAttendance) {
      return absenceRecordsQuery.data ?? []
    }

    return (studentQuery.data?.recentAbsences ?? []).map((row) => ({
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
  }, [absenceRecordsQuery.data, canViewAttendance, studentQuery.data])

  const absenceMonthOptions = useMemo(() => {
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
  }, [absenceRows])

  const absenceSubjectOptions = useMemo(() => {
    const subjects = new Set<string>()
    for (const row of absenceRows) subjects.add(row.subject)
    return [...subjects].sort()
  }, [absenceRows])

  const filteredAbsences = useMemo(() => {
    return absenceRows.filter((row) => {
      if (absenceFilterMonth !== "all" && !row.date.startsWith(absenceFilterMonth)) return false
      if (absenceFilterSubject !== "all" && row.subject !== absenceFilterSubject) return false
      if (absenceFilterStatus !== "all" && row.status !== absenceFilterStatus) return false
      return true
    })
  }, [absenceRows, absenceFilterMonth, absenceFilterSubject, absenceFilterStatus])

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

  if (studentQuery.isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
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
  const params = new URLSearchParams(location.search)
  const returnTo = params.get("returnTo") || "/students"
  const sentSmsCount = student.parentSms.filter((row) => row.status === "sent" || row.status === "delivered").length
  const failedSmsCount = student.parentSms.filter((row) => row.status === "failed").length
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

  const canExcuse = hasPermission("students.excuse")
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
      title={`Fiche ${studentLabel.toLowerCase()}`}
      subtitle={`${student.lastName} ${student.firstName}`.trim()}
      actions={
        <div className="flex gap-2">
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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-tour="student-detail-profile">
        <div className="flex flex-col gap-4 bg-muted/30 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarFallback className="text-sm font-semibold">
                {initials(student.firstName, student.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{student.lastName} {student.firstName}</p>
              <p className="truncate text-sm text-muted-foreground">{student.className}</p>
              {student.matricule ? (
                <p className="truncate text-xs text-muted-foreground">Matricule : {student.matricule}</p>
              ) : null}
              {student.birthDate ? (
                <p className="truncate text-xs text-muted-foreground">
                  Né(e) le {new Date(student.birthDate).toLocaleDateString("fr-FR")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={student.isActive ? "secondary" : "destructive"} className="rounded-md px-2.5 py-1">
              {student.isActive ? "Actif" : "Inactif"}
            </Badge>
            <Badge variant={student.absenceSummary.thisMonth > 3 ? "destructive" : "outline"} className="rounded-md px-2.5 py-1">
              {absenceRiskLabel}
            </Badge>
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-4">
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Absences mois</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{student.absenceSummary.thisMonth}</p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Cette semaine</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{student.absenceSummary.thisWeek}</p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Contact parent</p>
            <p className="mt-1 truncate text-sm font-medium">{hasParentContact ? "Renseigné" : "Manquant"}</p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Alertes envoyés</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{sentSmsCount}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="absences" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mt-2">
          <TabsTrigger value="absences" data-tour="student-detail-tab-absences">Absences</TabsTrigger>
          <TabsTrigger value="informations" data-tour="student-detail-tab-informations">Informations</TabsTrigger>
          {canManageStudentDocuments ? <TabsTrigger value="documents" data-tour="student-detail-tab-documents">Documents</TabsTrigger> : null}
          <TabsTrigger value="sms" data-tour="student-detail-tab-sms">Notifications Parents</TabsTrigger>
        </TabsList>

        <TabsContent value="absences" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4" data-tour="student-detail-absences">
            <StatCard title="Total absences" value={student.absenceSummary.total} icon={<BookOpen className="h-4 w-4" />} variant="danger" />
            <StatCard title="Ce mois" value={student.absenceSummary.thisMonth} icon={<Clock3 className="h-4 w-4" />} variant="warning" />
            <StatCard title="Cette semaine" value={student.absenceSummary.thisWeek} icon={<UserCheck className="h-4 w-4" />} />
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Présence estimée (mois en cours)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <PresenceDonut present={estimatedPresentDays} absent={student.absenceSummary.thisMonth} late={0} size="sm" />
                <p className="text-sm text-muted-foreground">
                  Estimation sur 22 jours d'école: {estimatedPresentDays} jours présents / {student.absenceSummary.thisMonth} absences.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Absences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtres */}
              <div className="flex flex-wrap gap-2">
                <Select
                  value={absenceFilterMonth}
                  onValueChange={(v) => { setAbsenceFilterMonth(v); setRecentAbsencesPage(1) }}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs">
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
                  <SelectTrigger className="h-8 w-[150px] text-xs">
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
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue placeholder="Tous statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="excused">Excusé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
        </TabsContent>
        
        <TabsContent value="informations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts parents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

        {canManageStudentDocuments ? (
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ajouter un document</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentUpload entityType="student" entityId={student.id} onUploadSuccess={() => undefined} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentList entityType="student" entityId={student.id} />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique Notifications parents</CardTitle>
            </CardHeader>
            <CardContent>
              {student.parentSms.length === 0 ? (
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
                      <TableHead className="w-[130px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.parentSms.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.date).toLocaleString()}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{row.reason}</TableCell>
                        <TableCell>{row.recipientPhone}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>{smsLabel[row.status]}</Badge>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
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
