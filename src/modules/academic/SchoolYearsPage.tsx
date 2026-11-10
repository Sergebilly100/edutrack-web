import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Check, ChevronDown, ChevronUp, LockKeyhole } from "lucide-react"
import { Link } from "react-router-dom"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { createGradingPeriod, listGradingPeriods, listSchoolYears, updateGradingPeriod, updateSchoolYearReviewDate, type GradingPeriod, type SchoolYear } from "@/modules/academic/academic.api"
import { AcademicNavigation } from "@/modules/academic/components/AcademicNavigation"
import { AcademicTimeline } from "@/shared/components/AcademicTimeline"
import { EmptyState, PageLayout, QueryErrorState, Spinner } from "@/shared/components"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { schoolYearsTourSteps } from "@/shared/lib/tour-steps"
import { CalendarIcon } from "@/shared/components/icons"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { businessToday, daysUntil, formatAcademicDate, nextAcademicDeadline, periodDateErrors, periodOverlap } from "@/shared/lib/academic-calendar"
import { currentAcademicPeriodId } from "@/shared/lib/academic-context"
import { isCivilDate } from "@/shared/lib/date-validation"

const SCHOOL_YEARS_KEY = ["academic", "school-years"] as const
const GRADING_PERIODS_KEY = ["academic", "grading-periods"] as const
const dateKeys = ["startDate", "reviewStartDate", "endDate"] as const
const dateLabels = { startDate: "Début de période", reviewStartDate: "Début de revue", endDate: "Fin de période" }
const dateHelp = {
  startDate: "Premier jour couvert par la période.",
  reviewStartDate: "Ouvre la conduite et la préparation des bulletins ; les notes restent modifiables jusqu’à la validation de chaque matière.",
  endDate: "Borne finale, égale ou postérieure au début de revue.",
}
const apiErrorMessage = (error: unknown, fallback: string) => axios.isAxiosError(error) && typeof error.response?.data?.error === "string" ? error.response.data.error : fallback
const countdown = (date: string, today: string) => {
  const days = daysUntil(date, today)
  return days === null ? "Date indisponible" : days > 0 ? `dans ${days} jour${days > 1 ? "s" : ""}` : days === 0 ? "aujourd’hui" : "passée"
}

function PeriodEditor({ period, previous, next, year, isCurrent, canEdit, onSave, pending, today }: {
  period: GradingPeriod; previous?: GradingPeriod; next?: GradingPeriod; year: SchoolYear; isCurrent: boolean
  canEdit: boolean; onSave: (period: GradingPeriod, dates: Pick<GradingPeriod, "startDate" | "reviewStartDate" | "endDate">) => void
  pending: boolean; today: string
}) {
  const [open, setOpen] = useState(isCurrent && !period.isClosed)
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dates, setDates] = useState({ startDate: period.startDate, reviewStartDate: period.reviewStartDate, endDate: period.endDate })
  const draft = { ...dates, orderIndex: period.orderIndex }
  const errors = periodDateErrors(draft, year, previous, next)
  const dirty = dateKeys.some((key) => dates[key] !== period[key])
  const valid = Object.keys(errors).length === 0
  const overlap = periodOverlap(draft, previous)
  const transitionErrors = previous ? periodDateErrors(draft, year, previous) : null
  const transitionError = transitionErrors?.startDate ?? transitionErrors?.reviewStartDate
  const save = () => {
    if (!dirty || !valid) return
    if (isCurrent) setConfirmOpen(true)
    else onSave(period, dates)
  }
  const cancel = () => {
    setDates({ startDate: period.startDate, reviewStartDate: period.reviewStartDate, endDate: period.endDate })
    setEditing(false)
  }
  return <div className={`rounded-lg border ${isCurrent ? "border-blue-600" : "border-border"}`}>
    <Button type="button" variant="ghost" className="flex h-auto min-h-12 w-full flex-wrap justify-start gap-2 whitespace-normal px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800" aria-expanded={open} onClick={() => setOpen(!open)}>
      {period.isClosed ? <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <span className="font-semibold">{period.label}</span>
      <Badge variant="outline" className={period.isClosed ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100" : isCurrent ? "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-100" : ""}>
        {period.isClosed ? "Clôturée" : year.status === "closed" ? "Année clôturée" : year.status === "draft" || period.startDate > today ? "À venir" : period.conductReviewOpen ? "Revue de conduite" : period.notesEntryOpen ? "Saisie des notes" : "À venir"}
      </Badge>
      {previous && transitionError ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">Transition avec {previous.label} : {transitionError}</Badge> : previous && overlap ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-100">Recouvre {previous.label} du {formatAcademicDate(overlap.start)} au {formatAcademicDate(overlap.end)} ({overlap.days} jours) · normal</Badge> : null}
      <span className="ml-auto hidden text-sm text-slate-700 dark:text-slate-200 sm:inline">{formatAcademicDate(period.startDate)} → {formatAcademicDate(period.endDate)}</span>
      {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
    </Button>
    {open ? <div className="space-y-4 border-t px-4 py-4">
      <p className="text-sm text-slate-700 dark:text-slate-200 sm:hidden">{formatAcademicDate(period.startDate)} → {formatAcademicDate(period.endDate)}</p>
      {editing ? <>
        {dirty ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">Modifications non enregistrées</Badge> : null}
        <div className="grid gap-4 lg:grid-cols-3">{dateKeys.map((key) => <label key={key} className="space-y-2 text-sm font-medium">
          <span>{dateLabels[key]}</span><Input type="date" value={dates[key]} aria-invalid={Boolean(errors[key])} aria-describedby={`${period.id}-${key}-help`} onChange={(event) => setDates((current) => ({ ...current, [key]: event.target.value }))} />
          <span id={`${period.id}-${key}-help`} className="block text-sm font-normal text-slate-700 dark:text-slate-200">{dateHelp[key]}</span>
          {errors[key] ? <span role="alert" className="block text-sm font-normal text-destructive">{errors[key]}</span> : null}
        </label>)}</div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100"><strong>Impact :</strong> la revue s’ouvre le {formatAcademicDate(dates.reviewStartDate)}, {countdown(dates.reviewStartDate, today)}.</div>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" className="min-h-12" onClick={cancel} disabled={pending}>Annuler</Button><Button type="button" className="min-h-12" disabled={!dirty || !valid || pending} onClick={save}>{pending ? <Spinner size="sm" className="mr-2" /> : null}Enregistrer {period.label}</Button></div>
      </> : <>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">{dateKeys.map((key) => <div key={key}><dt className="font-medium">{dateLabels[key]}</dt><dd>{formatAcademicDate(period[key])}</dd></div>)}</dl>
        {period.hasGeneratedCards ? <p className="text-sm text-slate-700 dark:text-slate-200">Calendrier figé depuis la génération des bulletins.</p> : canEdit ? <div className="flex justify-end"><Button type="button" variant="outline" className="min-h-12" onClick={() => setEditing(true)}>Modifier {period.label}</Button></div> : null}
      </>}
    </div> : null}
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Modifier la période courante ?</AlertDialogTitle><AlertDialogDescription>Les dates du calendrier de {period.label} vont changer. Vérifiez leurs effets sur la revue et les bulletins avant de continuer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel><AlertDialogAction className="min-h-12" onClick={() => onSave(period, dates)}>Confirmer l’enregistrement</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function NewPeriod({ year, previous, onSave, pending }: { year: SchoolYear; previous?: GradingPeriod; onSave: (label: string, dates: Pick<GradingPeriod, "startDate" | "reviewStartDate" | "endDate">) => void; pending: boolean }) {
  const [label, setLabel] = useState("")
  const [dates, setDates] = useState({ startDate: "", reviewStartDate: "", endDate: "" })
  const errors = periodDateErrors({ ...dates, orderIndex: (previous?.orderIndex ?? 0) + 1 }, year, previous)
  return <div className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Ajouter la période {(previous?.orderIndex ?? 0) + 1}</h3>
    <label className="block space-y-2 text-sm font-medium">Nom<Input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
    <div className="grid gap-3 lg:grid-cols-3">{dateKeys.map((key) => <label key={key} className="space-y-2 text-sm font-medium">{dateLabels[key]}<Input type="date" value={dates[key]} aria-invalid={Boolean(dates[key] && errors[key])} onChange={(event) => setDates((current) => ({ ...current, [key]: event.target.value }))} />{dates[key] && errors[key] ? <span role="alert" className="block text-sm font-normal text-destructive">{errors[key]}</span> : null}</label>)}</div>
    <div className="flex justify-end"><Button className="min-h-12" disabled={!label.trim() || Object.keys(errors).length > 0 || pending} onClick={() => onSave(label.trim(), dates)}>{pending ? <Spinner size="sm" className="mr-2" /> : null}Ajouter la période</Button></div>
  </div>
}

export default function SchoolYearsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const tour = useTourGuide("school-years", true)
  const canEdit = hasPermission("school_years.edit")
  const canViewDecisions = hasPermission("class_decisions.view")
  const today = businessToday()
  const [selectedYearId, setSelectedYearId] = useState("")
  const [reviewDateDraft, setReviewDateDraft] = useState<string | null>(null)
  const yearsQuery = useQuery({ queryKey: SCHOOL_YEARS_KEY, queryFn: listSchoolYears })
  const years = yearsQuery.data ?? []
  const activeYear = years.find((year) => year.status === "active") ?? null
  const selectedYear = years.find((year) => year.id === selectedYearId) ?? activeYear ?? years[0] ?? null
  const periodsQuery = useQuery({ queryKey: GRADING_PERIODS_KEY, queryFn: listGradingPeriods, enabled: years.length > 0 })
  const periods = (periodsQuery.data ?? []).filter((period) => period.schoolYearId === selectedYear?.id).sort((a, b) => a.orderIndex - b.orderIndex)
  const activePeriods = (periodsQuery.data ?? []).filter((period) => period.schoolYearId === activeYear?.id)
  const activePeriodId = currentAcademicPeriodId(activePeriods, today)
  const currentPeriodId = selectedYear?.status === "active" ? currentAcademicPeriodId(periods, today) : ""
  const activePeriod = activePeriods.find((period) => period.id === activePeriodId)
  const deadline = activeYear ? nextAcademicDeadline(activeYear, activePeriods, today) : null
  const reviewDate = reviewDateDraft ?? selectedYear?.endOfYearReviewStartDate ?? ""
  const reviewDateValid = isCivilDate(reviewDate) && Boolean(selectedYear && reviewDate < selectedYear.endDate)
  const selectedEditable = canEdit && selectedYear?.status === "active"

  const reviewMutation = useMutation({
    mutationFn: () => updateSchoolYearReviewDate(selectedYear!.id, { endOfYearReviewStartDate: reviewDate }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["academic"] }); await queryClient.invalidateQueries({ queryKey: ["class-decisions", "review-status"] }); setReviewDateDraft(null); toast({ title: "Ouverture des décisions mise à jour" }) },
    onError: (error) => toast({ title: "Enregistrement impossible", description: apiErrorMessage(error, "La date doit précéder la fin de l’année scolaire."), variant: "destructive" }),
  })
  const periodMutation = useMutation({
    mutationFn: ({ period, label, dates }: { period?: GradingPeriod; label?: string; dates: Pick<GradingPeriod, "startDate" | "reviewStartDate" | "endDate"> }) => period ? updateGradingPeriod(period.id, dates) : createGradingPeriod({ schoolYearId: selectedYear!.id, type: selectedYear!.gradingPeriodType, orderIndex: periods.length + 1, label: label!, ...dates }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: GRADING_PERIODS_KEY }); toast({ title: "Calendrier de période enregistré" }) },
    onError: (error) => toast({ title: "Calendrier impossible à enregistrer", description: apiErrorMessage(error, "Vérifiez les dates et la transition entre périodes."), variant: "destructive" }),
  })
  return <>
  <TourGuide steps={schoolYearsTourSteps} run={tour.run} stepIndex={tour.stepIndex} onStepChange={tour.setStepIndex} onFinish={tour.markDone} />
  <PageLayout title="Structure scolaire" subtitle="Configurez les périodes d’évaluation et l’ouverture des décisions de fin d’année.">
    <AcademicNavigation />
    {yearsQuery.isLoading ? <div className="py-6"><Spinner /></div> : null}
    {yearsQuery.isError ? <QueryErrorState onRetry={() => void yearsQuery.refetch()} isRetrying={yearsQuery.isFetching} message="Impossible de charger les années scolaires." /> : null}
    {yearsQuery.isSuccess && years.length === 0 ? <EmptyState icon={CalendarIcon} title="Aucune année scolaire" message="La prochaine année scolaire doit être ouverte depuis l’espace super administrateur." /> : null}
    {activeYear ? <div className="grid gap-4 md:grid-cols-3" data-tour="years-summary">
      <div className="rounded-lg border bg-card p-4"><p className="text-sm font-medium text-slate-700 dark:text-slate-200">Année active</p><p className="mt-2 text-xl font-semibold">{activeYear.label}</p><p className="mt-1 text-sm">Fin {countdown(activeYear.endDate, today)}</p></div>
      <div className="rounded-lg border bg-card p-4"><p className="text-sm font-medium text-slate-700 dark:text-slate-200">Période courante</p><p className="mt-2 text-xl font-semibold">{periodsQuery.isLoading ? "Chargement…" : activePeriod?.label ?? "Aucune période commencée"}</p><p className="mt-1 text-sm">{activePeriod ? activePeriod.isClosed ? "Clôturée" : activePeriod.conductReviewOpen ? "Revue de conduite" : activePeriod.notesEntryOpen ? "Saisie des notes" : "À venir" : ""}</p></div>
      <div className="rounded-lg border bg-card p-4"><p className="text-sm font-medium text-slate-700 dark:text-slate-200">Prochaine échéance</p><p className="mt-2 text-xl font-semibold">{periodsQuery.isLoading ? "Chargement…" : deadline ? formatAcademicDate(deadline.date) : "Aucune échéance"}</p><p className="mt-1 text-sm">{deadline ? `${deadline.label} · ${countdown(deadline.date, today)}` : ""}</p></div>
    </div> : null}
    {years.length > 0 ? <div className="overflow-x-auto rounded-lg border bg-card" data-tour="years-table"><Table><TableHeader><TableRow><TableHead>Année</TableHead><TableHead>Période</TableHead><TableHead>Cycle</TableHead><TableHead>Ouverture des décisions</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{years.map((year) => <TableRow key={year.id} className={`cursor-pointer ${selectedYear?.id === year.id ? "bg-blue-50 dark:bg-blue-950" : ""}`} onClick={() => { setSelectedYearId(year.id); setReviewDateDraft(null) }}><TableCell><Button type="button" variant="ghost" className="min-h-12 justify-start gap-2 font-semibold" aria-current={selectedYear?.id === year.id ? "true" : undefined}>{selectedYear?.id === year.id ? <Check className="h-4 w-4 text-blue-700" aria-hidden="true" /> : <span className="w-4" />}{year.label}</Button></TableCell><TableCell className="whitespace-nowrap">{formatAcademicDate(year.startDate)} au {formatAcademicDate(year.endDate)}</TableCell><TableCell className="whitespace-nowrap">{year.gradingPeriodType === "semester" ? "2 semestres" : "3 trimestres"}</TableCell><TableCell className="whitespace-nowrap">{formatAcademicDate(year.endOfYearReviewStartDate)} · {countdown(year.endOfYearReviewStartDate, today)}</TableCell><TableCell><Badge variant="outline" className={year.status === "active" ? "border-green-200 bg-green-50 text-green-800" : year.status === "closed" ? "bg-slate-100 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{year.status === "active" ? "Active" : year.status === "closed" ? "Clôturée" : "À venir"}</Badge></TableCell></TableRow>)}</TableBody></Table></div> : null}
    {selectedYear && periodsQuery.isSuccess ? <AcademicTimeline year={selectedYear} periods={periods} currentPeriodId={currentPeriodId} today={today} /> : null}
    {selectedYear ? <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]">
      <section className="space-y-4 rounded-lg border bg-card p-4 md:p-6" aria-labelledby="periods-heading" data-tour="years-periods"><h2 id="periods-heading" className="text-xl font-semibold">Périodes d’évaluation · {selectedYear.label}</h2>
        {periodsQuery.isLoading ? <Spinner /> : null}
        {periodsQuery.isError ? <QueryErrorState onRetry={() => void periodsQuery.refetch()} isRetrying={periodsQuery.isFetching} message="Le calendrier des périodes n’a pas pu être chargé. Réessayez avant de le modifier." /> : null}
        {periodsQuery.isSuccess && periods.length === 0 ? <EmptyState icon={CalendarIcon} title="Aucune période" message="Ajoutez la première période de l’année scolaire." /> : null}
        {periodsQuery.isSuccess ? periods.map((period, index) => <PeriodEditor key={`${period.id}-${period.startDate}-${period.reviewStartDate}-${period.endDate}`} period={period} previous={periods[index - 1]} next={periods[index + 1]} year={selectedYear} isCurrent={period.id === currentPeriodId} canEdit={Boolean(selectedEditable && !period.hasGeneratedCards)} pending={periodMutation.isPending} today={today} onSave={(item, dates) => periodMutation.mutate({ period: item, dates })} />) : null}
        {periodsQuery.isSuccess && selectedEditable && periods.length < (selectedYear.gradingPeriodType === "semester" ? 2 : 3) ? <NewPeriod year={selectedYear} previous={periods[periods.length - 1]} pending={periodMutation.isPending} onSave={(label, dates) => periodMutation.mutate({ label, dates })} /> : null}
      </section>
      <section className="space-y-5 rounded-lg border bg-card p-4 md:p-6" aria-labelledby="decisions-heading" data-tour="years-decisions"><h2 id="decisions-heading" className="text-xl font-semibold">Décisions de fin d’année · {selectedYear.label}</h2>
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">{daysUntil(selectedYear.endOfYearReviewStartDate, today) !== null && daysUntil(selectedYear.endOfYearReviewStartDate, today)! > 0 ? `S’ouvre ${countdown(selectedYear.endOfYearReviewStartDate, today)}` : `Ouvert depuis le ${formatAcademicDate(selectedYear.endOfYearReviewStartDate)}`}</Badge>
        <p className="text-sm text-slate-700 dark:text-slate-200">Cette date ouvre le menu « Fin d’année » et la validation des décisions de passage.</p>
        <label className="block space-y-2 text-sm font-medium">Ouverture des décisions de fin d’année<Input type="date" value={reviewDate} max={selectedYear.endDate} disabled={!selectedEditable || reviewMutation.isPending} aria-invalid={Boolean(reviewDate && !reviewDateValid)} onChange={(event) => setReviewDateDraft(event.target.value)} /></label>
        <p className="text-sm text-slate-800 dark:text-slate-100">Doit précéder le {formatAcademicDate(selectedYear.endDate)}, fin de l’année scolaire.</p>
        {reviewDate && !reviewDateValid ? <p role="alert" className="text-sm text-destructive">La date doit précéder la fin de l’année scolaire.</p> : null}
        {selectedEditable ? <Button className="min-h-12 w-full" disabled={reviewMutation.isPending || !reviewDateValid || reviewDate === selectedYear.endOfYearReviewStartDate} onClick={() => reviewMutation.mutate()}>{reviewMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}Enregistrer la date</Button> : null}
        <div className="border-t pt-4"><Button asChild={canViewDecisions && selectedYear.status === "active" && today >= selectedYear.endOfYearReviewStartDate} variant="outline" className="min-h-12 w-full" disabled={!canViewDecisions || selectedYear.status !== "active" || today < selectedYear.endOfYearReviewStartDate}>{canViewDecisions && selectedYear.status === "active" && today >= selectedYear.endOfYearReviewStartDate ? <Link to="/end-of-year">Ouvrir Fin d’année</Link> : "Ouvrir Fin d’année"}</Button>{today < selectedYear.endOfYearReviewStartDate ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Disponible à partir du {formatAcademicDate(selectedYear.endOfYearReviewStartDate)}.</p> : null}</div>
      </section>
    </div> : null}
  </PageLayout>
  </>
}
