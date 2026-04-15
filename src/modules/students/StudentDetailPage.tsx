import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { DocumentList, DocumentUpload, PageLayout, PresenceDonut } from "@/shared/components"
import { BackIcon, SmsIcon } from "@/shared/components/icons"
import { getAttendanceHistory, getStudentById } from "@/modules/students/students.api"

const noteStorageKey = (studentId: string) => `edutrack:student-note:${studentId}`

const toMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  }
}

const getWeekdaysInMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const maxDay = new Date(year, month + 1, 0).getDate()

  let count = 0
  for (let day = 1; day <= maxDay; day += 1) {
    const current = new Date(year, month, day)
    const dow = current.getDay()
    if (dow !== 0) {
      count += 1
    }
  }

  return count
}

export default function StudentDetailPage() {
  const navigate = useNavigate()
  const { studentId = "" } = useParams<{ studentId: string }>()

  const [note, setNote] = useState("")
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle")

  const monthRange = useMemo(() => toMonthRange(), [])

  const studentQuery = useQuery({
    queryKey: ["students", "detail", studentId],
    queryFn: () => getStudentById(studentId),
    enabled: studentId.trim().length > 0,
  })

  const absencesQuery = useQuery({
    queryKey: [
      "students",
      "absences",
      "month",
      studentId,
      monthRange.dateFrom,
      monthRange.dateTo,
    ],
    queryFn: () =>
      getAttendanceHistory({
        page: 1,
        limit: 200,
        studentId,
        dateFrom: monthRange.dateFrom,
        dateTo: monthRange.dateTo,
      }),
    enabled: studentId.trim().length > 0,
  })

  useEffect(() => {
    if (!studentId) {
      return
    }
    const existing = localStorage.getItem(noteStorageKey(studentId))
    setNote(existing ?? "")
  }, [studentId])

  useEffect(() => {
    if (!studentId) {
      return
    }

    setNoteStatus("saving")
    const timer = window.setTimeout(() => {
      localStorage.setItem(noteStorageKey(studentId), note)
      setNoteStatus("saved")
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [note, studentId])

  if (!studentId) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Identifiant élève manquant.</AlertDescription>
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
          <AlertDescription>Élève introuvable.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const student = studentQuery.data
  const absences = absencesQuery.data?.data ?? []
  const absentCount = absencesQuery.data?.pagination.total ?? 0
  const expectedDays = getWeekdaysInMonth()
  const presentEstimate = Math.max(0, expectedDays - absentCount)

  const phone = student.parentPhone ?? student.parentPhone2

  return (
    <PageLayout
      title="Détail élève"
      subtitle={`${student.lastName} ${student.firstName}`.trim()}
      actions={
        <Button variant="outline" onClick={() => navigate("/students")}>
          <BackIcon className="mr-2 h-4 w-4" />
          Retour liste
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations élève</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Nom complet</p>
                <p className="text-sm font-medium">{student.lastName} {student.firstName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Classe</p>
                <p className="text-sm">{student.className}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parent 1</p>
                <p className="text-sm">{student.parentPhone ?? "Non renseigné"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parent 2</p>
                <p className="text-sm">{student.parentPhone2 ?? "Non renseigné"}</p>
              </div>
              <Badge variant={student.isActive ? "secondary" : "destructive"}>
                {student.isActive ? "Actif" : "Inactif"}
              </Badge>

              <Button asChild className="w-full" disabled={!phone}>
                <a href={phone ? `tel:${phone}` : undefined}>
                  <SmsIcon className="mr-2 h-4 w-4" />
                  SMS parent
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Note libre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ajouter une note sur cet élève..."
                rows={6}
                className={cn(
                  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              />
              <p className="text-xs text-muted-foreground">
                {noteStatus === "saving" ? "Sauvegarde..." : noteStatus === "saved" ? "Sauvegardé" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="absences" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="absences">Absences</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="absences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Absences du mois</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <PresenceDonut present={presentEstimate} absent={absentCount} late={0} size="sm" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Résumé</p>
                  <p className="text-xs text-muted-foreground">Absences enregistrées: {absentCount}</p>
                  <p className="text-xs text-muted-foreground">Période: {monthRange.dateFrom} → {monthRange.dateTo}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Liste des absences</CardTitle>
              </CardHeader>
              <CardContent>
                {absencesQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : absences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune absence ce mois-ci.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {absences.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.className}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">Absent</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
        </Tabs>
      </div>
    </PageLayout>
  )
}
