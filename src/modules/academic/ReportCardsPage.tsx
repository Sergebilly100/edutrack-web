import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileDown, Loader2, Send, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

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
import { usePermissions } from "@/shared/hooks/usePermissions"
import { formatStudentRank } from "@/shared/lib/format-student-rank"
import {
  getPdfExportJobStatus,
  triggerPdfExportDownload,
} from "@/shared/api/pdfExport.api"
import {
  fetchClassReportCards,
  fetchClassCompletion,
  fetchConductBulletinAudit,
  fetchReadiness,
  listReportCardClaims,
  generateReportCards,
  listReportCardClasses,
  listGradingPeriodsForYear,
  listLevels,
  listSchoolYears,
  publishBulkReportCards,
  publishReportCard,
  requestReportCardPdf,
} from "./academic.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { invalidateAcademicReportScope } from "./academic-report-cache"

export default function ReportCardsPage() {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const [selectedYearId, setSelectedYearId] = useState("")
  const [levelId, setLevelId] = useState("")
  const [selectedClassId, setSelectedClassId] = useState("")
  const [gradingPeriodId, setGradingPeriodId] = useState("")

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const activeYear = yearsQuery.data?.find((year) => year.status === "active")
  const schoolYearId = selectedYearId || activeYear?.id || ""
  const selectedYear = yearsQuery.data?.find((year) => year.id === schoolYearId)
  const historicalYear = selectedYear?.status === "closed"
  const levelsQuery = useQuery({
    queryKey: ["academic", "levels"],
    queryFn: listLevels,
  })
  const classesQuery = useQuery({
    queryKey: ["report-cards", "classes", schoolYearId],
    queryFn: () => listReportCardClasses(schoolYearId),
    enabled: Boolean(schoolYearId),
  })
  const classes = classesQuery.data ?? []
  const levels = [...(levelsQuery.data ?? [])].filter((level) => classes.some((klass) => klass.level.id === level.id)).sort(
    (left, right) => left.orderIndex - right.orderIndex || left.name.localeCompare(right.name, "fr")
  )
  const filteredClasses = levelId ? classes.filter((klass) => klass.level.id === levelId) : classes
  const classId = filteredClasses.some((klass) => klass.id === selectedClassId) ? selectedClassId : ""
  const selectedClass = classes.find((klass) => klass.id === classId)
  const readOnlyClass = historicalYear || selectedClass?.isActive === false

  useEffect(() => {
    if (selectedClassId && classesQuery.data && !classId) setSelectedClassId("")
  }, [selectedClassId, classesQuery.data, classId])

  const periodsQuery = useQuery({
    queryKey: ["academic", "grading-periods", schoolYearId],
    queryFn: () => listGradingPeriodsForYear(schoolYearId),
    enabled: Boolean(schoolYearId),
  })
  const periods = (periodsQuery.data ?? []).filter((period) => period.schoolYearId === schoolYearId)
  const defaultPeriod = historicalYear
    ? periods.find((period) => period.hasGeneratedCards) ?? periods.find((period) => period.isClosed) ?? periods[0]
    : periods.find((period) => period.bulletinGenerationAvailable)
      ?? periods.find((period) => period.isClosed)
      ?? periods.find((period) => period.hasGeneratedCards)
  const periodId = periods.some((period) => period.id === gradingPeriodId) ? gradingPeriodId : defaultPeriod?.id ?? ""
  const readinessEnabled = Boolean(periodId) && !readOnlyClass
  const readinessQuery = useQuery({
    queryKey: ["report-cards-readiness", periodId],
    queryFn: () => fetchReadiness(periodId),
    enabled: readinessEnabled,
  })
  const conductAuditQuery = useQuery({ queryKey: ["report-cards", "conduct-audit"], queryFn: fetchConductBulletinAudit })
  const enabled = Boolean(classId) && Boolean(periodId)
  const cardsQuery = useQuery({
    queryKey: ["report-cards-class", classId, periodId],
    queryFn: () => fetchClassReportCards(classId, periodId),
    enabled,
  })
  const completionQuery = useQuery({
    queryKey: ["class-completion", classId, periodId],
    queryFn: () => fetchClassCompletion(classId, periodId),
    enabled: enabled && !readOnlyClass,
  })
  const claimsQuery = useQuery({
    queryKey: ["report-card-claims", classId, periodId],
    queryFn: () => listReportCardClaims({ classId, gradingPeriodId: periodId }),
    enabled: enabled && !readOnlyClass,
  })

  const invalidate = async (): Promise<void> => {
    await invalidateAcademicReportScope(queryClient, classId, periodId)
  }

  const generateMutation = useMutation({
    mutationFn: () => generateReportCards({ class_id: classId, grading_period_id: periodId }),
    onSuccess: async (result) => {
      await invalidate()
      await queryClient.invalidateQueries({ queryKey: ["academic", "grading-periods", schoolYearId] })
      toast({ title: `${result.generatedCount} bulletin(s) généré(s)`, description: result.classClosed ? "La revue de cette classe est clôturée pour cette période." : undefined })
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
    mutationFn: () => publishBulkReportCards({ class_id: classId, grading_period_id: periodId }),
    onSuccess: async (result) => {
      await invalidate()
      toast({ title: `${result.publishedCount} bulletin(s) publié(s)` })
    },
    onError: (error) =>
      toast({ title: "Publication impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  })

  const pdfFor = async (cardId: string): Promise<void> => {
    try {
      const jobId = await requestReportCardPdf(cardId)
      // Le rendu passe par la queue partagée : on attend la complétion.
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const status = await getPdfExportJobStatus(jobId)
        if (status.downloadUrl) {
          triggerPdfExportDownload(status.downloadUrl, `bulletin_${cardId}.pdf`)
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
  const selectedPeriod = periods.find((period) => period.id === periodId)
  const historicalAmbiguity = conductAuditQuery.data?.find(period => period.gradingPeriodId === periodId)
  const completionSubjects = completionQuery.data?.subjects ?? []
  const completedSubjectsCount = completionSubjects.filter((subject) => subject.status === "completed").length
  const allSubjectsCompleted = completionSubjects.length > 0 && completedSubjectsCount === completionSubjects.length
  const allStudentsAveraged = readinessForClass !== undefined && readinessForClass.studentsWithGeneralAverage >= readinessForClass.headcount && readinessForClass.headcount > 0
  const allStudentsHaveConduct = readinessForClass !== undefined && readinessForClass.studentsWithFinalConduct >= readinessForClass.headcount && readinessForClass.headcount > 0
  const hasGeneratedCards = cardsQuery.data?.some(card => card.status === "generated") === true
  const classClosed = selectedPeriod?.closedClassIds?.includes(classId) === true
  const canGenerate = hasPermission("report_cards.publish") && !readOnlyClass && Boolean(selectedYear && selectedYear.status !== "closed") && Boolean(selectedPeriod?.bulletinGenerationAvailable) && (!classClosed || hasGeneratedCards) && allSubjectsCompleted && allStudentsAveraged && allStudentsHaveConduct
  const preparationLoading = completionQuery.isLoading || readinessQuery.isLoading
  const preparationError = completionQuery.isError || readinessQuery.isError

  const generationBlocker = (): string | null => {
    if (historicalYear) return "Cette année scolaire est clôturée."
    if (!selectedPeriod?.bulletinGenerationAvailable) return "Sélectionnez une période dont la revue est ouverte pour générer les bulletins."
    if (classClosed && !hasGeneratedCards) return "Tous les bulletins sont publiés ou la revue est clôturée."
    if (!allSubjectsCompleted) return "Clôturez et validez les moyennes de chaque matière avant de générer."
    if (!allStudentsAveraged) return "Calculez une moyenne générale pour tous les élèves de la classe."
    if (!allStudentsHaveConduct) return "Arrêtez la note finale de conduite de chaque élève confirmé."
    return null
  }

  return (

    <PageLayout
      title="Bulletins"
      subtitle="Génération figée par période, publication manuelle classe par classe."
    >

      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="report-cards-year">Année scolaire</Label>
          <Select value={schoolYearId} onValueChange={(value) => {
            setSelectedYearId(value)
            setLevelId("")
            setSelectedClassId("")
            setGradingPeriodId("")
          }}>
            <SelectTrigger id="report-cards-year" className="min-h-12"><SelectValue placeholder="Choisir une année" /></SelectTrigger>
            <SelectContent>
              {yearsQuery.isPending ? <SelectItem value="loading-years" disabled>Chargement des années…</SelectItem> : null}
              {yearsQuery.isError ? <SelectItem value="years-error" disabled>Années indisponibles</SelectItem> : null}
              {(yearsQuery.data ?? []).map((year) => (
                <SelectItem key={year.id} value={year.id}>{year.label}{year.status === "active" ? " · active" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-cards-level">Niveau</Label>
          <Select
            value={levelId || "all"}
            onValueChange={(value) => {
              const nextLevelId = value === "all" ? "" : value
              if (selectedClassId && nextLevelId && !classes.some((klass) => klass.id === selectedClassId && klass.level.id === nextLevelId)) {
                setSelectedClassId("")
              }
              setLevelId(nextLevelId)
            }}
          >
            <SelectTrigger id="report-cards-level" className="min-h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {levelsQuery.isPending ? <SelectItem value="loading-levels" disabled>Chargement des niveaux…</SelectItem> : null}
              {levelsQuery.isError ? <SelectItem value="levels-error" disabled>Niveaux indisponibles</SelectItem> : null}
              {levels.map((level) => (
                <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-cards-class">Classe</Label>
          <Select value={classId} onValueChange={setSelectedClassId} disabled={!schoolYearId || classesQuery.isPending}>
            <SelectTrigger id="report-cards-class" className="min-h-12"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
            <SelectContent>
              {classesQuery.isPending ? <SelectItem value="loading-classes" disabled>Chargement des classes…</SelectItem> : null}
              {classesQuery.isError ? <SelectItem value="classes-error" disabled>Classes indisponibles</SelectItem> : null}
              {filteredClasses.map((klass) => (
                <SelectItem key={klass.id} value={klass.id}>{klass.name}{!klass.isActive ? " · archivée" : ""}</SelectItem>
              ))}
              {classesQuery.isSuccess && filteredClasses.length === 0 ? (
                <SelectItem value="no-class" disabled>Aucune classe pour ce niveau</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-cards-period">Période</Label>
          <Select
            value={periodId || "none"}
            onValueChange={(value) => setGradingPeriodId(value === "none" ? "" : value)}
            disabled={!schoolYearId || periodsQuery.isPending}
          >
            <SelectTrigger id="report-cards-period" className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id} disabled={!historicalYear && !period.bulletinGenerationAvailable && !period.isClosed && !period.hasGeneratedCards}>{period.label}{period.bulletinGenerationAvailable ? " · en revue" : period.isClosed ? " · finalisée" : historicalYear || period.hasGeneratedCards ? " · historique" : " · à venir"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedYear ? <p className="text-sm text-muted-foreground">Année scolaire consultée : <span className="font-medium text-foreground">{selectedYear.label}</span>{historicalYear ? " · clôturée, consultation uniquement" : ""}</p> : null}

      {classesQuery.isPending || periodsQuery.isPending ? <div className="space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-24 w-full" /></div> : null}
      {classesQuery.isError || periodsQuery.isError || yearsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les années, classes ou périodes. Réessayez dans un instant.</AlertDescription></Alert> : null}

      {!enabled && !classesQuery.isPending && !periodsQuery.isPending ? (
        classesQuery.isSuccess && classes.length === 0
          ? <EmptyState title={`Aucune classe pour ${selectedYear?.label ?? "cette année"}`} description="Cette année ne contient ni classe exploitable pour les bulletins ni bulletin historique." />
          : <EmptyState title="Choisissez une classe et une période" description="Les bulletins s'afficheront ici." />
      ) : enabled ? (
        <>
          {historicalAmbiguity ? <Alert variant="destructive"><AlertDescription>
            Période historique à vérifier : {historicalAmbiguity.generatedCount} bulletin(s) non publié(s) et {historicalAmbiguity.publishedCount} publié(s) présentent une conduite absente ou une moyenne incohérente. Les bulletins publiés restent figés.
          </AlertDescription></Alert> : null}
          {preparationError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger l’état de préparation de cette classe. Réessayez dans un instant.</AlertDescription>
            </Alert>
          ) : null}

          {!readOnlyClass ? <Card className="shadow-sm">
            <CardHeader className="pb-3 border-none">
              <CardTitle>Préparation de la classe</CardTitle>
              <CardDescription>
                Vérifiez les matières et les moyennes avant de générer les bulletins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!preparationLoading && readinessForClass?.headcount === 0 ? (
                <EmptyState title="Aucun élève confirmé" description="La préparation des bulletins commencera après la confirmation d’une inscription dans cette classe et cette année." classNameRendu="py-4" />
              ) : null}
              {preparationLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : completionSubjects.length === 0 ? (
                readinessForClass?.headcount === 0 ? null : <EmptyState
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
                    {readinessForClass ? <Badge variant="outline" className={allStudentsHaveConduct ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{readinessForClass.studentsWithFinalConduct}/{readinessForClass.headcount} conduites finales</Badge> : null}
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matière</TableHead>
                          <TableHead>Professeur</TableHead>
                          <TableHead>État</TableHead>
                          <TableHead>Réclamation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completionSubjects.map((subject) => (
                          <TableRow key={subject.subjectId}>
                            <TableCell className="font-medium">{subject.subjectName}</TableCell>
                            <TableCell>{subject.teacher?.name ?? <span className="text-muted-foreground">Non identifié</span>}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={subject.status === "completed" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
                                {subject.status === "completed" ? "Moyennes validées" : subject.calculationStarted ? "Moyennes calculées, révisables" : "Saisie en cours"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const claim = claimsQuery.data?.find((item) => item.subject_id === subject.subjectId && item.status !== "refused")
                                return claim ? <Badge variant="outline">{claim.status === "approved" ? "Correction ouverte" : claim.status === "republished" ? "Republiée" : claim.status === "regenerated" ? "Régénérée" : claim.status === "corrected" ? "Revalidée" : "En attente"}</Badge>
                                  : subject.status === "completed" && (hasPermission("report_cards.view") || hasPermission("report_cards.publish")) ? <Button asChild variant="outline" className="min-h-12"><Link to={`/academic/report-card-claims?schoolYearId=${encodeURIComponent(schoolYearId)}&gradingPeriodId=${encodeURIComponent(periodId)}&classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subject.subjectId)}`}>Ouvrir une réclamation</Link></Button>
                                    : <span className="text-sm text-muted-foreground">Après validation</span>
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card> : null}

          {readinessForClass && !readOnlyClass && hasPermission("report_cards.publish") ? (
            <Card className="shadow-sm">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm text-muted-foreground">
                  {canGenerate ? classClosed ? "Les bulletins générés peuvent être recalculés." : "Cette classe est prête à générer ses bulletins." : generationBlocker()}
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
                  {classClosed ? "Recalculer les bulletins non publiés" : "Générer les bulletins de la classe"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1">
                <CardTitle>Bulletins de la classe</CardTitle>
                <CardDescription>
                  Les bulletins publiés sont visibles par les parents. Une correction approuvée les retire et impose une nouvelle publication.
                </CardDescription>
              </div>
              {!readOnlyClass && selectedYear && selectedYear.status !== "closed" && hasPermission("report_cards.publish") && hasGeneratedCards ? <Button
                type="button"
                variant="outline"
                onClick={() => bulkPublishMutation.mutate()}
                disabled={bulkPublishMutation.isPending}
              >
                {bulkPublishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publier tous les générés
              </Button> : null}
            </CardHeader>
            <CardContent>
              {cardsQuery.isPending ? <div className="space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-24 w-full" /></div> : cardsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les bulletins de cette classe.</AlertDescription></Alert> : (cardsQuery.data?.length ?? 0) === 0 ? (
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
                        <TableCell aria-label={`Rang : ${formatStudentRank(card.rank) ?? "non renseigné"}`}>
                          {formatStudentRank(card.rank) ?? "-"}
                        </TableCell>
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
                          {card.status === "generated" && !readOnlyClass && selectedYear && selectedYear.status !== "closed" && hasPermission("report_cards.publish") ? (
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
      ) : null}
    </PageLayout>
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
