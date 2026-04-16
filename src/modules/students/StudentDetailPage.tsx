import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { BookOpen, Clock3, MessageSquare, Phone, UserCheck } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { getStudentById, updateStudent } from "@/modules/students/students.api"
import { DocumentList, DocumentUpload, PageLayout, PresenceDonut, StatCard } from "@/shared/components"
import { BackIcon } from "@/shared/components/icons"

const initials = (firstName: string, lastName: string) =>
  `${lastName?.[0] ?? ""}${firstName?.[0] ?? ""}`.toUpperCase()

const smsLabel: Record<"queued" | "sent" | "failed" | "delivered", string> = {
  queued: "En attente",
  sent: "Envoyé",
  failed: "Échec",
  delivered: "Livré",
}

const recentSmsLabel: Record<"sent" | "failed" | "not_sent" | "none", string> = {
  sent: "Envoyé",
  failed: "Échec",
  not_sent: "Non envoyé",
  none: "-",
}

export default function StudentDetailPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { studentId = "" } = useParams<{ studentId: string }>()

  const [parentName, setParentName] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [parentName2, setParentName2] = useState("")
  const [parentPhone2, setParentPhone2] = useState("")
  const [note, setNote] = useState("")
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const lastSavedNoteRef = useRef("")
  const hydratedRef = useRef(false)

  const studentQuery = useQuery({
    queryKey: ["students", "detail", studentId],
    queryFn: () => getStudentById(studentId),
    enabled: studentId.trim().length > 0,
  })

  const saveContactsMutation = useMutation({
    mutationFn: () =>
      updateStudent(studentId, {
        parentName: parentName.trim() ? parentName.trim() : null,
        parentPhone: parentPhone.trim() ? parentPhone.trim() : null,
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

  useEffect(() => {
    const student = studentQuery.data
    if (!student) {
      return
    }

    setParentName(student.parentName ?? "")
    setParentPhone(student.parentPhone ?? "")
    setParentName2(student.parentName2 ?? "")
    setParentPhone2(student.parentPhone2 ?? "")
    setNote(student.note ?? "")
    lastSavedNoteRef.current = student.note ?? ""
    hydratedRef.current = true
    setNoteStatus("idle")
  }, [studentQuery.data])

  useEffect(() => {
    if (!studentId || !hydratedRef.current) {
      return
    }

    if (note === lastSavedNoteRef.current) {
      if (noteStatus !== "idle") {
        setNoteStatus("idle")
      }
      return
    }

    setNoteStatus("saving")
    const timer = window.setTimeout(() => {
      void saveNoteMutation.mutateAsync(note)
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [note, noteStatus, saveNoteMutation, studentId])

  const estimatedPresentDays = useMemo(() => {
    const schoolDaysEstimate = 22
    const absences = studentQuery.data?.absenceSummary.thisMonth ?? 0
    return Math.max(0, schoolDaysEstimate - absences)
  }, [studentQuery.data?.absenceSummary.thisMonth])

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

  return (
    <PageLayout
      title="Fiche élève"
      subtitle={`${student.lastName} ${student.firstName}`.trim()}
      actions={
        <Button variant="outline" onClick={() => navigate("/students")}>
          <BackIcon className="mr-2 h-4 w-4" />
          Retour liste
        </Button>
      }
    >
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{initials(student.firstName, student.lastName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{student.lastName} {student.firstName}</p>
              <p className="text-sm text-muted-foreground">{student.className}</p>
            </div>
          </div>
          <Badge variant={student.isActive ? "secondary" : "destructive"}>
            {student.isActive ? "Actif" : "Inactif"}
          </Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="informations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="informations">Informations</TabsTrigger>
          <TabsTrigger value="absences">Absences</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="sms">SMS Parents</TabsTrigger>
        </TabsList>

        <TabsContent value="informations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts parents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={parentName} onChange={(event) => setParentName(event.target.value)} placeholder="Nom parent 1" />
                <div className="flex gap-2">
                  <Input value={parentPhone} onChange={(event) => setParentPhone(event.target.value)} placeholder="Téléphone parent 1" />
                  <Button type="button" variant="outline" asChild disabled={!parentPhone.trim()}>
                    <a href={parentPhone.trim() ? `tel:${parentPhone.trim()}` : undefined}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <Input value={parentName2} onChange={(event) => setParentName2(event.target.value)} placeholder="Nom parent 2" />
                <div className="flex gap-2">
                  <Input value={parentPhone2} onChange={(event) => setParentPhone2(event.target.value)} placeholder="Téléphone parent 2" />
                  <Button type="button" variant="outline" asChild disabled={!parentPhone2.trim()}>
                    <a href={parentPhone2.trim() ? `tel:${parentPhone2.trim()}` : undefined}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <Button type="button" onClick={() => saveContactsMutation.mutate()} disabled={saveContactsMutation.isPending}>
                {saveContactsMutation.isPending ? "Enregistrement..." : "Modifier les contacts"}
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
                rows={6}
                placeholder="Ajouter une note sur cet élève..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {noteStatus === "saving" ? "Sauvegarde..." : ""}
                {noteStatus === "saved" ? "Sauvegardé" : ""}
                {noteStatus === "error" ? "Erreur de sauvegarde" : ""}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absences" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard title="Total absences" value={student.absenceSummary.total} icon={<BookOpen className="h-4 w-4" />} variant="danger" />
            <StatCard title="Ce mois" value={student.absenceSummary.thisMonth} icon={<Clock3 className="h-4 w-4" />} variant="warning" />
            <StatCard title="Cette semaine" value={student.absenceSummary.thisWeek} icon={<UserCheck className="h-4 w-4" />} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Présence estimée (mois en cours)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <PresenceDonut present={estimatedPresentDays} absent={student.absenceSummary.thisMonth} late={0} size="sm" />
              <p className="text-sm text-muted-foreground">
                Estimation sur 22 jours d'école: {estimatedPresentDays} jours présents / {student.absenceSummary.thisMonth} absences.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Absences récentes</CardTitle>
            </CardHeader>
            <CardContent>
              {student.recentAbsences.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune absence récente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Matière</TableHead>
                      <TableHead>Professeur</TableHead>
                      <TableHead>SMS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.recentAbsences.map((row, index) => {
                      const statusKey = row.smsStatus ?? "none"
                      return (
                        <TableRow key={`${row.date}-${row.subject}-${index}`}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.subject}</TableCell>
                          <TableCell>{row.teacherName}</TableCell>
                          <TableCell>
                            <Badge variant={row.smsStatus === "failed" ? "destructive" : "secondary"}>
                              {recentSmsLabel[statusKey]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
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

        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique SMS parents</CardTitle>
            </CardHeader>
            <CardContent>
              {student.parentSms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun SMS trouvé pour cet élève.</p>
              ) : (
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
                          <Button type="button" size="sm" variant="outline" disabled={row.status !== "failed"}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Renvoyer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
