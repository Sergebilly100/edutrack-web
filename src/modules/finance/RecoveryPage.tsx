import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { WalletCards } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { PageLayout } from "@/shared/components/PageLayout"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { financeRecoveryTourSteps } from "@/shared/lib/tour-steps"
import { todayInBusinessTimezone } from "@/shared/lib/business-date"
import { formatFcfa } from "@/shared/utils/formatting"
import { studentNoun, studentPlural } from "@/shared/utils/student-label"
import { RateBar, ratePercent } from "./components/RateBar"
import { RecoveryStudentsDialog } from "./components/RecoveryStudentsDialog"
import { RecoveryTable } from "./components/RecoveryTable"
import { StatCard } from "./components/StatCard"
import { fetchRecoverySummary, fetchRecoveryYears, type RecoveryClass } from "./finance.api"

/** Date du jour dans le fuseau métier existant, au format JJ/MM/AAAA. */
const schoolToday = () => todayInBusinessTimezone().split("-").reverse().join("/")

export default function RecoveryPage() {
  const labels = useStudentLabels()
  const { hasPermission } = usePermissions()
  const tour = useTourGuide("finance-recovery", true)
  const [searchParams, setSearchParams] = useSearchParams()
  const years = useQuery({ queryKey: ["finance", "recovery", "years"], queryFn: fetchRecoveryYears })
  const yearChoice = searchParams.get("annee") ?? ""
  const levelId = searchParams.get("niveau") ?? ""
  const classId = searchParams.get("classe") ?? ""
  const [detailClass, setDetailClass] = useState<RecoveryClass | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const schoolYearId = yearChoice || years.data?.find((item) => item.status === "active")?.id || years.data?.[0]?.id || ""

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key) }
    setSearchParams(next, { replace: true })
    setDetailClass(null)
  }

  const base = useQuery({ queryKey: ["finance", "recovery", schoolYearId, "", ""], queryFn: () => fetchRecoverySummary(schoolYearId), enabled: Boolean(schoolYearId) })
  const summary = useQuery({
    queryKey: ["finance", "recovery", schoolYearId, levelId, classId],
    queryFn: () => fetchRecoverySummary(schoolYearId, levelId || undefined, classId || undefined),
    enabled: Boolean(schoolYearId),
  })
  const allLevels = base.data?.levels ?? []
  const allClasses = (base.data?.classes ?? []).filter((item) => !levelId || item.levelId === levelId)
  const levelName = allLevels.find((item) => item.levelId === levelId)?.levelName
  const className = base.data?.classes.find((item) => item.classId === classId)?.className
  const loading = years.isLoading || summary.isLoading || base.isLoading
  const selection = summary.data?.selection

  if (years.isError) return <PageLayout title="Recouvrement détaillé"><QueryErrorState message="Impossible de charger les années scolaires." onRetry={() => void years.refetch()} /></PageLayout>

  const yearSelect = <Select value={schoolYearId} onValueChange={(value) => updateParams({ annee: value, niveau: "", classe: "" })}>
    <SelectTrigger className="min-h-12 w-full sm:w-64" aria-label="Année scolaire" data-tour="finance-recovery-year"><SelectValue placeholder="Année scolaire" /></SelectTrigger>
    <SelectContent>{years.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}{item.status === "active" ? " · Active" : ""}</SelectItem>)}</SelectContent>
  </Select>

  return <>
  <TourGuide steps={financeRecoveryTourSteps} run={tour.run} stepIndex={tour.stepIndex} onStepChange={tour.setStepIndex} onFinish={tour.markDone} />
  <PageLayout title="Recouvrement détaillé" subtitle={`Suivi des encaissements par niveau, classe et ${studentNoun(labels, 1)}.`} actions={yearSelect}>
    <section aria-label="Filtres de recouvrement" data-tour="finance-recovery-filters" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={levelId || "all"} onValueChange={(value) => updateParams({ niveau: value === "all" ? "" : value, classe: "" })} disabled={!schoolYearId || base.isLoading}>
        <SelectTrigger className="min-h-12 w-full sm:w-72" aria-label="Niveau"><SelectValue>Niveau : {levelName ?? "Tous les niveaux"}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="all">Tous les niveaux</SelectItem>{allLevels.map((item) => <SelectItem key={item.levelId} value={item.levelId}>{item.levelName}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={classId || "all"} onValueChange={(value) => {
        const picked = base.data?.classes.find((item) => item.classId === value)
        updateParams({ classe: value === "all" ? "" : value, ...(picked ? { niveau: picked.levelId } : {}) })
      }} disabled={!schoolYearId || base.isLoading}>
        <SelectTrigger className="min-h-12 w-full sm:w-72" aria-label="Classe"><SelectValue>Classe : {className ?? "Toutes les classes"}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="all">Toutes les classes</SelectItem>{allClasses.map((item) => <SelectItem key={item.classId} value={item.classId}>{item.className}</SelectItem>)}</SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground sm:ml-auto">Situation au {schoolToday()}</p>
    </section>

    {loading ? <div aria-label="Chargement du recouvrement" className="space-y-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-64 w-full" /></div> : null}
    {!years.isLoading && !schoolYearId ? <EmptyState icon={WalletCards} title="Aucune année scolaire" message="Créez une année scolaire pour consulter le recouvrement." /> : null}
    {summary.isError || base.isError ? <QueryErrorState message="Impossible de charger le recouvrement." onRetry={() => { void summary.refetch(); void base.refetch() }} /> : null}

    {selection && summary.data && !loading ? <>
      <section aria-label="Indicateurs de recouvrement" data-tour="finance-recovery-stats" className="grid gap-3 lg:grid-cols-[2fr_1.2fr_1.2fr]">
        <StatCard title="Taux de recouvrement">
          <div className="flex items-center gap-4"><p className="text-4xl font-semibold tabular-nums">{ratePercent(selection.recoveryRate)} %</p><RateBar rate={selection.recoveryRate} label="Taux de recouvrement" className="flex-1" barClassName="h-2" /></div>
          <p className="text-sm text-muted-foreground">{formatFcfa(selection.paid)} encaissés sur {formatFcfa(selection.expected)} attendus à date</p>
        </StatCard>
        <StatCard title="Reste à collecter"><p className="text-3xl font-semibold tabular-nums">{formatFcfa(selection.remaining)}</p></StatCard>
        <StatCard title={`${studentPlural(labels, { capitalized: true })} à suivre`}>
          <p className="text-3xl font-semibold tabular-nums">{selection.studentsToFollow}</p>
          <p className="text-sm text-muted-foreground">sur {selection.studentCount} inscription{selection.studentCount > 1 ? "s" : ""} confirmée{selection.studentCount > 1 ? "s" : ""}</p>
        </StatCard>
      </section>
      {selection.studentCount === 0
        ? <EmptyState icon={WalletCards} title="Aucune inscription confirmée" message={`Aucun ${studentNoun(labels, 1)} ne correspond aux filtres sélectionnés.`} />
        : <section className="min-w-0 space-y-3" data-tour="finance-recovery-table"><h2 className="text-lg font-semibold">Par niveau et par classe</h2><RecoveryTable levels={summary.data.levels} classes={summary.data.classes} total={selection} labels={labels} onViewStudents={(item, opener) => { openerRef.current = opener; setDetailClass(item) }} /></section>}
    </> : null}

    <RecoveryStudentsDialog open={detailClass !== null} onClose={() => setDetailClass(null)} schoolYearId={schoolYearId} levelId={detailClass?.levelId} schoolClass={detailClass} labels={labels} canOpenStudent={hasPermission("payments.view")} returnFocusRef={openerRef} />
  </PageLayout>
  </>
}
