import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { FileDown, GraduationCap, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  downloadPdfExportFile,
  getPdfExportJobStatus,
  triggerBlobDownload,
} from "@/shared/api/pdfExport.api"
import {
  listParentReportCards,
  listParentStudents,
  requestParentReportCardPdf,
} from "./parent.api"

export default function ParentReportCardsPage() {
  const { toast } = useToast()
  const [studentId, setStudentId] = useState("")

  const studentsQuery = useQuery({
    queryKey: ["parent", "students"],
    queryFn: listParentStudents,
  })

  const cardsQuery = useQuery({
    queryKey: ["parent", "report-cards", studentId],
    queryFn: () => listParentReportCards(studentId),
    enabled: Boolean(studentId),
  })

  const downloadMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const jobId = await requestParentReportCardPdf(studentId, cardId)
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const status = await getPdfExportJobStatus(jobId)
        if (status.downloadUrl) {
          const { blob, fileName } = await downloadPdfExportFile(status.downloadUrl)
          triggerBlobDownload(blob, fileName ?? `bulletin_${cardId}.pdf`)
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

  // Un seul enfant : sélection automatique.
  const students = studentsQuery.data ?? []
  useEffect(() => {
    if (!studentId && students.length === 1) {
      setStudentId(students[0]!.id)
    }
  }, [studentId, students])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bulletins scolaires</h1>
          <p className="text-sm text-muted-foreground">Bulletins publiés par l&apos;école uniquement.</p>
        </div>
      </div>

      {(studentsQuery.data?.length ?? 0) > 1 ? (
        <div className="space-y-2">
          <Label>Enfant</Label>
          <Select value={studentId || "none"} onValueChange={(value) => setStudentId(value === "none" ? "" : value)}>
            <SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir un enfant" /></SelectTrigger>
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

      {!studentId && students.length > 1 ? (
        <EmptyState
          title="Choisissez un enfant"
          description="Sélectionnez l'enfant dont vous voulez consulter les bulletins."
        />
      ) : null}

      {studentId ? (
        cardsQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : (cardsQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Aucun bulletin publié"
            description="Les bulletins apparaîtront ici dès que l'école les aura publiés."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(cardsQuery.data ?? []).map((card) => (
              <Card key={card.id} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{card.periodLabel} · {card.schoolYearLabel}</CardDescription>
                  <CardTitle className="text-2xl font-bold">{card.generalAverage.toFixed(2)}/20</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge variant="outline">Rang {card.rank} / {card.classHeadcount}</Badge>
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
        )
      ) : null}
    </div>
  )
}
