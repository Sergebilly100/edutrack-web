import { useEffect, useMemo } from "react"
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
import { listSchoolYears, updateSchoolYearReviewDate, type SchoolYear } from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { DataTable, EmptyState, PageLayout, QueryErrorState, Spinner } from "@/shared/components"
import { CalendarIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"

const SCHOOL_YEARS_KEY = ["academic", "school-years"] as const
const reviewDateSchema = z.object({
  endOfYearReviewStartDate: z.string().min(1, "La date de début de revue est requise"),
})
type ReviewDateForm = z.infer<typeof reviewDateSchema>

const statusLabel = { draft: "Brouillon", active: "Active", closed: "Clôturée" } as const
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`))
const previousIsoDate = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
const apiErrorMessage = (error: unknown) =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : "La date doit être strictement antérieure à la fin de l’année scolaire."

export default function SchoolYearsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("school_years.edit")
  const query = useQuery({ queryKey: SCHOOL_YEARS_KEY, queryFn: listSchoolYears })
  const activeYear = query.data?.find((year) => year.status === "active") ?? null
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
      toast({ title: "Date de revue mise à jour" })
    },
    onError: (error) => toast({
      title: "Enregistrement impossible",
      description: apiErrorMessage(error),
      variant: "destructive",
    }),
  })

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
    { id: "review", header: "Début de revue", cell: ({ row }) => formatDate(row.original.endOfYearReviewStartDate) },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => <Badge variant={row.original.status === "active" ? "default" : "outline"}>{statusLabel[row.original.status]}</Badge>,
    },
  ], [])

  return (
    <PageLayout title="Structure scolaire" subtitle="Consultez les années scolaires et configurez la période de revue de fin d’année.">
      <AcademicNavigation />
      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} message="Impossible de charger les années scolaires." />
      ) : null}

      {!query.isError && activeYear ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revue de fin d’année</CardTitle>
            <CardDescription>
              Le menu Fin d’année devient visible à cette date pour {activeYear.label}. La date de fin reste fixée au {formatDate(activeYear.endDate)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
                <FormField
                  control={form.control}
                  name="endOfYearReviewStartDate"
                  render={({ field }) => (
                    <FormItem className="w-full sm:max-w-xs">
                      <FormLabel>Date de début de revue</FormLabel>
                      <FormControl><Input type="date" max={previousIsoDate(activeYear.endDate)} disabled={!canEdit || mutation.isPending} {...field} /></FormControl>
                      <FormDescription>Par défaut, 30 jours avant la fin de l’année.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {canEdit ? (
                  <Button type="submit" className="min-h-12" disabled={mutation.isPending}>
                    {mutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
                    {mutation.isPending ? "Enregistrement…" : "Enregistrer la date"}
                  </Button>
                ) : null}
              </form>
            </Form>
          </CardContent>
        </Card>
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
                  <p className="mt-2 text-xs text-muted-foreground">Revue dès le {formatDate(schoolYear.endOfYearReviewStartDate)}</p>
                </div>
                <Badge variant={schoolYear.status === "active" ? "default" : "outline"}>{statusLabel[schoolYear.status]}</Badge>
              </div>
            </div>
          )}
        />
      ) : null}
    </PageLayout>
  )
}
