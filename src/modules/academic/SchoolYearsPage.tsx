import { useEffect, useMemo } from "react"
import type { FormEvent } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { z } from "zod"
import axios from "axios"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { createGradingPeriod, listGradingPeriods, listSchoolYears, updateGradingPeriod, updateSchoolYearReviewDate, type GradingPeriod, type SchoolYear } from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { DataTable, EmptyState, PageLayout, QueryErrorState, Spinner } from "@/shared/components"
import { CalendarIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const SCHOOL_YEARS_KEY = ["academic", "school-years"] as const
const GRADING_PERIODS_KEY = ["academic", "grading-periods"] as const
const reviewDateSchema = z.object({
  endOfYearReviewStartDate: z.string().min(1, "La date de début de revue est requise"),
})
type ReviewDateForm = z.infer<typeof reviewDateSchema>

const statusLabel = { draft: "Brouillon", active: "Active", closed: "Clôturée" } as const
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`))
const previousIsoDate = (value: string) => { // retourne la date ISO du jour précédent pour une date donnée (ex: 2024-06-30 -> 2024-06-29)
  const date = new Date(`${value}T00:00:00.000Z`) 
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
const apiErrorMessage = (error: unknown, fallback = "La date doit être strictement antérieure à la fin de l’année scolaire.") =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : fallback

export default function SchoolYearsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("school_years.edit")
  const query = useQuery({ queryKey: SCHOOL_YEARS_KEY, queryFn: listSchoolYears })
  const activeYear = query.data?.find((year) => year.status === "active") ?? null
  const periodsQuery = useQuery({ queryKey: GRADING_PERIODS_KEY, queryFn: listGradingPeriods, enabled: Boolean(activeYear) })
  const periods = (periodsQuery.data ?? []).filter((period) => period.schoolYearId === activeYear?.id).sort((a, b) => a.orderIndex - b.orderIndex)
  const form = useForm<ReviewDateForm>({
    resolver: zodResolver(reviewDateSchema),
    defaultValues: { endOfYearReviewStartDate: "" },
  })

  useEffect(() => {
    form.reset({ endOfYearReviewStartDate: activeYear?.endOfYearReviewStartDate ?? "" })
  }, [activeYear?.endOfYearReviewStartDate, form])

  const mutation = useMutation({
    mutationFn: (values: ReviewDateForm) => {
      if (!activeYear) throw new Error("Aucune année scolaire active")
      return updateSchoolYearReviewDate(activeYear.id, values)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["academic"] })
      await queryClient.invalidateQueries({ queryKey: ["class-decisions", "review-status"] })
      toast({ title: "Ouverture des décisions de fin d’année mise à jour" })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: apiErrorMessage(error),
      variant: "destructive",
    }),
  })
  const periodMutation = useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: Pick<GradingPeriod, "startDate" | "reviewStartDate" | "endDate"> & Partial<Pick<GradingPeriod, "label">> }) => {
      if (id) return updateGradingPeriod(id, values)
      if (!activeYear || !values.label) throw new Error("Année ou nom de période manquant")
      return createGradingPeriod({
        schoolYearId: activeYear.id,
        type: activeYear.gradingPeriodType,
        orderIndex: periods.length + 1,
        label: values.label,
        startDate: values.startDate,
        reviewStartDate: values.reviewStartDate,
        endDate: values.endDate,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: GRADING_PERIODS_KEY })
      toast({ title: "Calendrier de période enregistré" })
    },
    onError: (error) => toast({ title: "Calendrier impossible à enregistrer", description: apiErrorMessage(error, "Vérifiez les trois dates et le chevauchement des périodes."), variant: "destructive" }),
  })
  const savePeriod = (event: FormEvent<HTMLFormElement>, id: string | null) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    periodMutation.mutate({ id, values: {
      label: String(formData.get("label") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      reviewStartDate: String(formData.get("reviewStartDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
    } })
  }

  const columns = useMemo<ColumnDef<SchoolYear>[]>(() => [
    {
      accessorKey: "label",
      header: "Année scolaire",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{row.original.label}</span>
          {row.original.status === "active" ? <Badge className="bg-green-100 text-green-700">Année en cours</Badge> : null}
        </div>
      ),
    },
    { id: "dates", header: "Période", cell: ({ row }) => `${formatDate(row.original.startDate)} au ${formatDate(row.original.endDate)}` },
    { id: "cycle", header: "Cycle", cell: ({ row }) => row.original.gradingPeriodType === "semester" ? "2 semestres" : "3 trimestres" },
    { id: "review", header: "Décisions dès le", cell: ({ row }) => formatDate(row.original.endOfYearReviewStartDate) },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => <Badge variant={row.original.status === "active" ? "default" : "outline"}>{statusLabel[row.original.status]}</Badge>,
    },
  ], [])

  return (
    <PageLayout title="Structure scolaire" subtitle="Configurez les périodes d’évaluation et l’ouverture des décisions de fin d’année.">
      <AcademicNavigation />
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} message="Impossible de charger les années scolaires." />
      ) : null}

      {!query.isError ? (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          isLoading={query.isLoading}
          searchKey="label"
          searchPlaceholder="Rechercher une année…"
          emptyState={<EmptyState icon={CalendarIcon} title="Aucune année scolaire" message="La prochaine année scolaire doit être ouverte depuis l’espace super administrateur." />}
          mobileCard={(schoolYear) => (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{schoolYear.label}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(schoolYear.startDate)} au {formatDate(schoolYear.endDate)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{schoolYear.gradingPeriodType === "semester" ? "2 semestres" : "3 trimestres"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Décisions dès le {formatDate(schoolYear.endOfYearReviewStartDate)}</p>
                </div>
                <Badge variant={schoolYear.status === "active" ? "default" : "outline"}>{statusLabel[schoolYear.status]}</Badge>
              </div>
            </div>
          )}
        />
      ) : null}

      {activeYear ? (
        <Card className="mt-5">
          <CardHeader className="border-none">
            <CardTitle className="text-lg">Périodes d’évaluation</CardTitle>
            <CardDescription>
              Début de période : premier jour couvert par la période. Début de revue : ouverture du travail de conduite et de préparation des bulletins. Les notes restent modifiables jusqu’à la validation définitive de chaque matière. Fin de période : borne finale du calendrier, égale ou postérieure au début de revue. Les dates des périodes successives doivent se chevaucher.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {periodsQuery.isLoading ? <Spinner /> : null}
            {periodsQuery.isError ? <QueryErrorState onRetry={() => void periodsQuery.refetch()} isRetrying={periodsQuery.isFetching} message="Le calendrier des périodes n’a pas pu être chargé. Réessayez avant de le modifier." /> : null}
            {periodsQuery.isSuccess && periods.length === 0 ? <EmptyState icon={CalendarIcon} title="Aucune période" message="Ajoutez la première période de l’année scolaire." /> : null}
            {periodsQuery.isSuccess ? periods.map((period, index) => {
              const previous = periods[index - 1]
              const transitionReady = previous
                && period.startDate > previous.startDate
                && period.startDate <= previous.reviewStartDate
                && period.reviewStartDate > previous.reviewStartDate
              const historicalCalendarLocked = Boolean(previous?.hasGeneratedCards && period.hasGeneratedCards)
              return (
                <form key={`${period.id}-${period.startDate}-${period.reviewStartDate}-${period.endDate}`} className="space-y-3 rounded-lg border p-4" onSubmit={(event) => savePeriod(event, period.id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{period.label}</strong>
                    {transitionReady ? <Badge variant="secondary">Chevauchement avec {previous.label}</Badge> : null}
                    {previous && !transitionReady ? (
                      <Badge variant={historicalCalendarLocked ? "outline" : "destructive"}>
                        {historicalCalendarLocked ? "Transition historique sans chevauchement" : "Transition à corriger"} avec {previous.label}
                      </Badge>
                    ) : null}
                    {period.notesEntryOpen ? <Badge>Saisie des notes</Badge> : null}
                    {period.conductReviewOpen ? <Badge variant="secondary">Revue de conduite</Badge> : null}
                    {period.isClosed ? <Badge variant="outline">Clôturée</Badge> : null}
                    {period.hasGeneratedCards && !period.isClosed ? <Badge variant="outline">Bulletins déjà générés</Badge> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
                    <label className="space-y-1 text-sm">Début de période<Input name="startDate" type="date" defaultValue={period.startDate} disabled={!canEdit || period.hasGeneratedCards} required /></label>
                    <label className="space-y-1 text-sm">Début de revue<Input name="reviewStartDate" type="date" defaultValue={period.reviewStartDate} disabled={!canEdit || period.hasGeneratedCards} required /></label>
                    <label className="space-y-1 text-sm">Fin de période<Input name="endDate" type="date" defaultValue={period.endDate} disabled={!canEdit || period.hasGeneratedCards} required /></label>
                    {canEdit && !period.hasGeneratedCards ? <Button type="submit" className="min-h-10 lg:self-end lg:whitespace-nowrap" disabled={periodMutation.isPending}>{periodMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}Enregistrer {period.label}</Button> : null}
                  </div>
                </form>
              )
            }) : null}
            {periodsQuery.isSuccess && canEdit && periods.length < (activeYear.gradingPeriodType === "semester" ? 2 : 3) ? (
              <form className="space-y-3 rounded-lg border p-4" onSubmit={(event) => savePeriod(event, null)}>
                <strong>Ajouter la période {periods.length + 1}</strong>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="space-y-1 text-sm">Nom<Input name="label" required /></label>
                  <label className="space-y-1 text-sm">Début de période<Input name="startDate" type="date" required /></label>
                  <label className="space-y-1 text-sm">Début de revue<Input name="reviewStartDate" type="date" required /></label>
                  <label className="space-y-1 text-sm">Fin de période<Input name="endDate" type="date" required /></label>
                </div>
                <Button type="submit" className="min-h-12" disabled={periodMutation.isPending}>{periodMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}Ajouter la période</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!query.isError && activeYear ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Décisions de fin d’année</CardTitle>
            <CardDescription>
              Cette date ouvre le menu "Fin d’année" et la validation des décisions de passage pour l'année scolaire {activeYear.label}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="my-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
                <FormField
                  control={form.control}
                  name="endOfYearReviewStartDate"
                  render={({ field }) => (
                    <FormItem className="w-full sm:max-w-[25rem] sm:min-w-[25rem]">
                      <FormLabel className="whitespace-nowrap">Ouverture des décisions de fin d’année</FormLabel>
                      <FormControl><Input type="date" max={previousIsoDate(activeYear.endDate)} disabled={!canEdit || mutation.isPending} {...field} /></FormControl>
                      <FormDescription>Cette date doit précéder le {formatDate(activeYear.endDate)}.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {canEdit ? (
                  <Button type="submit" className="min-h-10 self-start sm:self-end" disabled={mutation.isPending}>
                    {mutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
                    {mutation.isPending ? "Enregistrement…" : "Enregistrer la date"}
                  </Button>
                ) : null}
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : null}

    </PageLayout>
  )
}
