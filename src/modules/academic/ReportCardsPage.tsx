import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileDown, Loader2, Send, Sparkles } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  fetchClassReportCards,
  fetchClassCompletion,
  fetchReadiness,
  generateReportCards,
  listClasses,
  listGradingPeriods,
  publishBulkReportCards,
  publishReportCard,
  requestReportCardPdf,
} from "./academic.api"

export default function ReportCardsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")

  const classesQuery = useQuery({
    queryKey: ["academic", "classes-for-report-cards"],
    queryFn: () => listClasses(),
  })
  const periodsQuery = useQuery({
    queryKey: ["academic", "grading-periods"],
    queryFn: listGradingPeriods,
  })
  useEffect(() => {
    if (gradingPeriodId || !periodsQuery.data?.length) return
    const current = periodsQuery.data.find((period) => period.isCurrent)
    if (current) setGradingPeriodId(current.id)
  }, [gradingPeriodId, periodsQuery.data])
  const readinessEnabled = Boolean(gradingPeriodId)
  const readinessQuery = useQuery({
    queryKey: ["report-cards-readiness", gradingPeriodId],
    queryFn: () => fetchReadiness(gradingPeriodId),
    enabled: readinessEnabled,
  })
  const enabled = Boolean(classId) && Boolean(gradingPeriodId)
  const cardsQuery = useQuery({
    queryKey: ["report-cards-class", classId, gradingPeriodId],
    queryFn: () => fetchClassReportCards(classId, gradingPeriodId),
    enabled,
  })
  const completionQuery = useQuery({
    queryKey: ["class-completion", classId, gradingPeriodId],
    queryFn: () => fetchClassCompletion(classId, gradingPeriodId),
    enabled,
  })

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["report-cards-class", classId, gradingPeriodId] }),
      queryClient.invalidateQueries({ queryKey: ["report-cards-readiness", gradingPeriodId] }),
      queryClient.invalidateQueries({ queryKey: ["class-completion", classId, gradingPeriodId] }),
    ])
  }

  const generateMutation = useMutation({
    mutationFn: () => generateReportCards({ class_id: classId, grading_period_id: gradingPeriodId }),
    onSuccess: async (result) => {
      await invalidate()
      await queryClient.invalidateQueries({ queryKey: ["academic", "grading-periods"] })
      toast({ title: `${result.generatedCount} bulletin(s) généré(s)`, description: result.periodCompleted ? "La période est complète : la période suivante devient la période en cours." : undefined })
    },
    onError: (error) =>
      toast({
        title: "Génération impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
        duration: 6000,
      }),
  })

  const bulkPublishMutation = useMutation({
    mutationFn: () => publishBulkReportCards({ class_id: classId, grading_period_id: gradingPeriodId }),
    onSuccess: async (result) => {
      await invalidate()
      toast({ title: `${result.publishedCount} bulletin(s) publié(s)` })
    },
    onError: (error) =>
      toast({ title: "Publication impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  const pdfFor = async (cardId: string): Promise<void> => {
    try {
      const { getExportJobStatus, downloadSalaryExportFile } = await import("@/modules/salaries/salaries.api")
      const jobId = await requestReportCardPdf(cardId)
      // Le rendu passe par la queue partagée : on attend la complétion.
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const status = await getExportJobStatus(jobId)
        if (status.downloadUrl) {
          const { blob, fileName } = await downloadSalaryExportFile(status.downloadUrl)
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = fileName ?? `bulletin_${cardId}.pdf`
          link.click()
          URL.revokeObjectURL(url)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      toast({ title: "PDF non prêt", description: "Réessayez dans un instant.", variant: "destructive" })
    } catch (error) {
      toast({
        title: "Génération PDF impossible",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    }
  }

  const readinessForClass = readinessQuery.data?.find(
    (entry) => entry.classId === classId
  )
  const selectedPeriod = periodsQuery.data?.find((period) => period.id === gradingPeriodId)
  const completionSubjects = completionQuery.data?.subjects ?? []
  const completedSubjectsCount = completionSubjects.filter((subject) => subject.status === "completed").length
  const allSubjectsCompleted = completionSubjects.length > 0 && completedSubjectsCount === completionSubjects.length
  const allStudentsAveraged = readinessForClass !== undefined && readinessForClass.studentsWithGeneralAverage >= readinessForClass.headcount && readinessForClass.headcount > 0
  const canGenerate = Boolean(selectedPeriod?.isCurrent) && allSubjectsCompleted && allStudentsAveraged
  const preparationLoading = completionQuery.isLoading || readinessQuery.isLoading
  const preparationError = completionQuery.isError || readinessQuery.isError

  const generationBlocker = (): string | null => {
    if (!selectedPeriod?.isCurrent) return "Sélectionnez la période scolaire en cours pour générer les bulletins."
    if (!allSubjectsCompleted) return "Clôturez et validez les moyennes de chaque matière avant de générer."
    if (!allStudentsAveraged) return "Calculez une moyenne générale pour tous les élèves de la classe."
    return null
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bulletins</h1>
        <p className="text-sm text-muted-foreground">
          Génération figée par période, publication manuelle classe par classe.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="report-cards-class">Classe</Label>
          <Select value={classId || "none"} onValueChange={(value) => setClassId(value === "none" ? "" : value)}>
            <SelectTrigger id="report-cards-class" className="min-h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
            <SelectContent>
              {(classesQuery.data?.classes ?? []).map((klass) => (
                <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-cards-period">Période</Label>
          <Select
            value={gradingPeriodId || "none"}
            onValueChange={(value) => setGradingPeriodId(value === "none" ? "" : value)}
          >
            <SelectTrigger id="report-cards-period" className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
            <SelectContent>
              {(periodsQuery.data ?? []).map((period) => (
                <SelectItem key={period.id} value={period.id}>{period.label}{period.isCurrent ? " · en cours" : period.isCompleted ? " · finalisée" : " · à venir"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!enabled ? (
        <EmptyState title="Choisissez une classe et une période" description="Les bulletins s'afficheront ici." />
      ) : (
        <>
          {preparationError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger l’état de préparation de cette classe. Réessayez dans un instant.</AlertDescription>
            </Alert>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Préparation de la classe</CardTitle>
              <CardDescription>
                Vérifiez les matières et les moyennes avant de générer les bulletins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {preparationLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : completionSubjects.length === 0 ? (
                <EmptyState
                  title="Aucune matière pour ce niveau"
                  description="Ajoutez les matières enseignées avant de préparer les bulletins."
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={allSubjectsCompleted ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
                      {completedSubjectsCount}/{completionSubjects.length} matières validées
                    </Badge>
                    {readinessForClass ? (
                      <Badge variant="outline" className={allStudentsAveraged ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
                        {readinessForClass.studentsWithGeneralAverage}/{readinessForClass.headcount} moyennes générales
                      </Badge>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matière</TableHead>
                          <TableHead>Professeur</TableHead>
                          <TableHead>État</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completionSubjects.map((subject) => (
                          <TableRow key={subject.subjectId}>
                            <TableCell className="font-medium">{subject.subjectName}</TableCell>
                            <TableCell>{subject.teacher?.name ?? <span className="text-muted-foreground">Non identifié</span>}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={subject.status === "completed" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
                                {subject.status === "completed" ? "Moyennes validées" : subject.calculationStarted ? "Calcul en cours" : "Saisie à clôturer"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {readinessForClass ? (
            <Card className="shadow-sm">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm text-muted-foreground">
                  {canGenerate ? "Cette classe est prête à générer ses bulletins." : generationBlocker()}
                </p>
                <Button
                  type="button"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || !canGenerate}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Générer les bulletins de la classe
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1">
                <CardTitle>Bulletins de la classe</CardTitle>
                <CardDescription>
                  Publiés = visibles par les parents. Un bulletin publié n&apos;est plus modifiable.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => bulkPublishMutation.mutate()}
                disabled={bulkPublishMutation.isPending || (cardsQuery.data?.length ?? 0) === 0}
              >
                {bulkPublishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publier tous les générés
              </Button>
            </CardHeader>
            <CardContent>
              {(cardsQuery.data?.length ?? 0) === 0 ? (
                <EmptyState
                  title="Aucun bulletin généré"
                  description="Lancez d'abord la génération pour cette classe et cette période."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rang</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead>Moyenne</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(cardsQuery.data ?? []).map((card) => (
                      <TableRow key={card.id}>
                        <TableCell>{card.rank}</TableCell>
                        <TableCell className="font-medium">{card.studentName}</TableCell>
                        <TableCell>{card.generalAverage.toFixed(2)}/20</TableCell>
                        <TableCell>
                          {card.status === "published" ? (
                            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                              Publié
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                              Généré
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {card.status === "generated" ? (
                            <PublishOneButton cardId={card.id} onDone={invalidate} />
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-10"
                            onClick={() => void pdfFor(card.id)}
                          >
                            <FileDown className="mr-1.5 h-4 w-4" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function PublishOneButton({ cardId, onDone }: { cardId: string; onDone: () => Promise<void> }) {
  const { toast } = useToast()
  const mutation = useMutation({
    mutationFn: () => publishReportCard(cardId),
    onSuccess: async () => {
      await onDone()
      toast({ title: "Bulletin publié" })
    },
    onError: () => toast({ title: "Publication impossible", variant: "destructive" }),
  })

  return (
    <Button
      type="button"
      size="sm"
      className="min-h-10"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
      Publier
    </Button>
  )
}
