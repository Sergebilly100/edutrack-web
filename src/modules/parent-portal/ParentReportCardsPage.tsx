import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { FileDown, GraduationCap, Loader2 } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  getPdfExportJobStatus,
  triggerPdfExportDownload,
} from "@/shared/api/pdfExport.api"
import {
  listParentReportCards,
  listParentStudents,
  requestParentReportCardPdf,
} from "./parent.api"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { formatStudentRank, formatStudentRankWithHeadcount } from "@/shared/lib/format-student-rank"

export default function ParentReportCardsPage() {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStudentId = searchParams.get("student")
  const [studentId, setStudentId] = useState(requestedStudentId ?? "")
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string | null>(null)

  const studentsQuery = useQuery({
    queryKey: ["parent", "students"],
    queryFn: listParentStudents,
  })

  const yearsQuery = useQuery({
    queryKey: ["parent", "report-cards", studentId, "years"],
    queryFn: () => listParentReportCards(studentId),
    staleTime: 0,
    refetchInterval: 15000,
    enabled: Boolean(studentId),
  })
  const availableSchoolYears = yearsQuery.data?.availableSchoolYears ?? []
  const schoolYearId = availableSchoolYears.some((year) => year.id === selectedSchoolYearId)
    ? selectedSchoolYearId ?? ""
    : availableSchoolYears[0]?.id ?? ""

  const cardsQuery = useQuery({
    queryKey: ["parent", "report-cards", studentId, schoolYearId],
    queryFn: () => listParentReportCards(studentId, schoolYearId),
    // A publication can occur in another session while this empty list is cached.
    staleTime: 0,
    refetchInterval: 15000,
    enabled: Boolean(studentId && schoolYearId),
  })

  const downloadMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const jobId = await requestParentReportCardPdf(studentId, cardId)
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const status = await getPdfExportJobStatus(jobId)
        if (status.downloadUrl) {
          triggerPdfExportDownload(status.downloadUrl, `bulletin_${cardId}.pdf`)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      throw new Error("Le PDF n'est pas encore prêt.")
    },
    onError: (error) =>
      toast({
        title: "Téléchargement impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  })

  const students = studentsQuery.data ?? []
  useEffect(() => {
    if (studentsQuery.isPending) return

    if (requestedStudentId && students.some((student) => student.id === requestedStudentId)) {
      if (studentId !== requestedStudentId) setStudentId(requestedStudentId)
      return
    }

    if (studentId && !students.some((student) => student.id === studentId)) {
      setStudentId("")
      setSelectedSchoolYearId(null)
      return
    }

    if (!studentId && students.length === 1) {
      setStudentId(students[0]!.id)
    }
  }, [requestedStudentId, studentId, students, studentsQuery.isPending])

  return (
    <>
      <div className="space-y-3 text-base">
        <OfflineIndicator />
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div className="mb-3">
            <h1 className="text-xl font-semibold tracking-tight">Bulletins scolaires</h1>
            <p className="text-sm text-muted-foreground">Consultez les bulletins en quelques clics.</p>
          </div>
        </div>

        {studentsQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des enfants…</p>
        ) : studentsQuery.isError ? (
          <Alert variant="destructive" role="alert"><AlertDescription>Impossible de charger les enfants. Réessayez plus tard.</AlertDescription></Alert>
        ) : students.length === 0 ? (
          <EmptyState title="Aucun enfant rattaché" description="Contactez l'école pour accéder aux bulletins." />
        ) : null}

        {(studentsQuery.data?.length ?? 0) > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="parent-report-student">Enfant</Label>
            <Select value={studentId || "none"} onValueChange={(value) => {
              setStudentId(value === "none" ? "" : value)
              setSelectedSchoolYearId(null)
              setSearchParams((current) => {
                const next = new URLSearchParams(current)
                if (value === "none") next.delete("student")
                else next.set("student", value)
                return next
              })
            }}>
              <SelectTrigger id="parent-report-student" className="min-h-12"><SelectValue placeholder="Choisir un enfant" /></SelectTrigger>
              <SelectContent>
                {(studentsQuery.data ?? []).map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.first_name} {student.last_name} · {student.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {studentId && availableSchoolYears.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="parent-report-year">Année scolaire</Label>
            <Select value={schoolYearId} onValueChange={setSelectedSchoolYearId}>
              <SelectTrigger id="parent-report-year" className="min-h-12"><SelectValue placeholder="Choisir une année" /></SelectTrigger>
              <SelectContent>
                {availableSchoolYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {!studentId && students.length > 1 ? (
          <EmptyState
            title="Choisissez un enfant"
            description="Sélectionnez l'enfant dont vous voulez consulter les bulletins."
          />
        ) : null}

        {studentId ? (
          yearsQuery.isLoading || (schoolYearId && cardsQuery.isLoading) ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </p>
          ) : yearsQuery.isError || cardsQuery.isError ? (
            <Alert variant="destructive" role="alert"><AlertDescription>Impossible de charger les bulletins. Réessayez plus tard.</AlertDescription></Alert>
          ) : (cardsQuery.data?.reportCards?.length ?? 0) === 0 ? (
            <EmptyState
              title={(cardsQuery.data?.inRevision ?? yearsQuery.data?.inRevision) ? "Bulletin en révision" : "Aucun bulletin publié"}
              description={(cardsQuery.data?.inRevision ?? yearsQuery.data?.inRevision) ? "L’école prépare une version corrigée. Elle apparaîtra ici après sa publication." : schoolYearId ? "Aucun bulletin publié pour cette année." : "Les bulletins apparaîtront ici dès que l'école les aura publiés."}
            />
          ) : (
            <div className="space-y-3">
              {cardsQuery.data?.inRevision ? <p role="status" className="rounded-lg border bg-muted p-3 text-sm">Un bulletin est en révision. Il sera visible après publication.</p> : null}
              <div className="grid gap-4 sm:grid-cols-2">
              {(cardsQuery.data?.reportCards ?? []).map((card) => (
                <Card key={card.id} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>{card.periodLabel} · {card.schoolYearLabel}</CardDescription>
                    <CardTitle className="text-2xl font-bold">{card.generalAverage.toFixed(2)}/20</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge variant="outline" aria-label={`Rang : ${formatStudentRank(card.rank) ?? "non renseigné"} sur ${card.classHeadcount}`}>Rang {formatStudentRankWithHeadcount(card.rank, card.classHeadcount) ?? "-"}</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full min-h-12"
                      disabled={downloadMutation.isPending}
                      onClick={() => downloadMutation.mutate(card.id)}
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                      )}
                      Télécharger le PDF
                    </Button>
                  </CardContent>
                </Card>
              ))}
              </div>
            </div>
          )
        ) : null}
      </div>
    </>
  )
}
