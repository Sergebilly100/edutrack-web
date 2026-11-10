import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useLocation, useSearchParams } from "react-router-dom"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listSchoolYears } from "@/modules/academic/academic.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { HEADER_CONTROL_HEIGHT, HeaderAction } from "@/shared/components/PageHeader"
import { formatDateTimeFr } from "@/shared/utils/formatting"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { financeAgreementsTourSteps, financeDashboardTourSteps, financeEntryTourSteps, financeHistoryTourSteps, financeJournalTourSteps } from "@/shared/lib/tour-steps"
import { FinancialDashboard } from "./components/FinancialDashboard"
import { PaymentHistoryPanel } from "./components/PaymentHistoryPanel"
import { QuickPaymentEntry } from "./components/QuickPaymentEntry"
import { CashJournalPanel } from "./components/CashJournalPanel"
import { PaymentImportPanel } from "./components/PaymentImportPanel"
import { FINANCE_PATHS, type FinanceView } from "./finance.routes"
import { listFinancialProfiles } from "@/modules/students/students.api"
import { Button } from "@/components/ui/button"
import { useToast } from "@/shared/hooks/use-toast"
import { fetchFinancialSummary, getStudentAccountStatement, recalculateFinancialCache } from "./finance.api"
import { Spinner } from "@/shared/components/Spinner"
import { RefreshCw } from "lucide-react"
import { AgreementsRegister } from "./components/AgreementsRegister"

const VIEW_COPY: Record<FinanceView, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Vue financière",
    subtitle: "Suivez les encaissements et les soldes de scolarité par année scolaire.",
  },
  journal: {
    title: "Journal de caisse",
    subtitle: "Paiements de scolarité par période, classe, mode de paiement et statut.",
  },
  entry: {
    title: "Encaissements",
    subtitle: "Enregistrez et importez rapidement les versements de caisse.",
  },
  history: {
    title: "Historique & reçus",
    subtitle: "Retrouvez les paiements enregistrés et leurs reçus.",
  },
  agreements: { title: "Accords & ajustements", subtitle: "Suivez les dérogations individuelles sans modifier les montants financiers de référence." },
}

const FINANCE_TOURS = {
  dashboard: { id: "finance-dashboard", steps: financeDashboardTourSteps },
  entry: { id: "finance-entry", steps: financeEntryTourSteps },
  history: { id: "finance-history", steps: financeHistoryTourSteps },
  journal: { id: "finance-journal", steps: financeJournalTourSteps },
  agreements: { id: "finance-agreements", steps: financeAgreementsTourSteps },
} as const

export default function FinancePage({ view, studentId, initialSchoolYearId }: { view: FinanceView; studentId?: string; initialSchoolYearId?: string }) {
  const { hasPermission } = usePermissions()
  const financeTour = FINANCE_TOURS[view]
  const tour = useTourGuide(financeTour.id, !(view === "history" && Boolean(studentId)))
  const [searchParams] = useSearchParams()
  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const [schoolYearId, setSchoolYearId] = useState(initialSchoolYearId ?? searchParams.get("schoolYearId") ?? "")
  const [entryTab, setentryTab] = useState("enregistrement")

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const summaryQuery = useQuery({
    queryKey: ["finance", "financial-summary", schoolYearId],
    queryFn: () => fetchFinancialSummary(schoolYearId),
  })
  const school = summaryQuery.data?.school ?? null
  const recalculateMutation = useMutation({
    mutationFn: () => recalculateFinancialCache(schoolYearId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["finance", "financial-summary", schoolYearId] })
      toast({ title: "Vue financière recalculée", description: `${result.studentCount} élève${result.studentCount > 1 ? "s" : ""} mis à jour.` })
    },
    onError: () => toast({ title: "Recalcul impossible", description: "Réessayez dans quelques instants.", variant: "destructive" }),
  })

  useEffect(() => {
    const years = yearsQuery.data ?? []
    if (!schoolYearId && years.length > 0) setSchoolYearId((years.find((year) => year.status === "active") ?? years[0]).id)
  }, [schoolYearId, yearsQuery.data])

  useEffect(() => {
    if (view !== "entry") setentryTab("enregistrement")
  }, [view])

  const selectedYear = yearsQuery.data?.find((year) => year.id === schoolYearId)

  // Détail financier d'un élève : le fil d'Ariane remplace le titre. La requête partage sa clé avec le panneau (une seule requête réseau).
  const isStudentDetail = view === "history" && Boolean(studentId)
  const detailNameQuery = useQuery({
    queryKey: ["finance", "account-statement", studentId, schoolYearId],
    queryFn: () => getStudentAccountStatement(studentId!, schoolYearId),
    enabled: isStudentDetail && Boolean(schoolYearId),
  })
  const breadcrumb = isStudentDetail ? (
    <Breadcrumb>
      <BreadcrumbList className="text-base">
        <BreadcrumbItem><BreadcrumbLink asChild><Link to={`${FINANCE_PATHS.history}?schoolYearId=${schoolYearId}`}>Historique &amp; reçus</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage className="font-semibold">{detailNameQuery.data?.student.name ?? "Élève"}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ) : undefined

  // Encaissement pré-rempli depuis le détail financier : l'élève est retrouvé via la même recherche que le champ « Élève ».
  const location = useLocation()
  const payFor = (location.state as { payFor?: { studentId: string; search: string } } | null)?.payFor
  const prefillQuery = useQuery({
    queryKey: ["finance", "payment-prefill", schoolYearId, payFor?.studentId],
    queryFn: () => listFinancialProfiles({ schoolYearId, search: payFor!.search, limit: 8, isActive: true }),
    enabled: view === "entry" && Boolean(payFor?.studentId && payFor.search && schoolYearId),
    staleTime: 30_000,
  })
  const initialStudent = prefillQuery.data?.data.find((candidate) => candidate.id === payFor?.studentId) ?? null

  if (yearsQuery.isError) {
    return <PageLayout title={VIEW_COPY[view].title}><QueryErrorState message="Impossible de charger les années scolaires." onRetry={() => void yearsQuery.refetch()} /></PageLayout>
  }

  return (
    <>
    <TourGuide steps={financeTour.steps} run={tour.run} stepIndex={tour.stepIndex} onStepChange={tour.setStepIndex} onFinish={tour.markDone} />
    <PageLayout
      title={VIEW_COPY[view].title}
      subtitle={VIEW_COPY[view].subtitle}
      breadcrumb={breadcrumb}
      actions={
        <>
          <Select value={schoolYearId} onValueChange={setSchoolYearId}>
            <SelectTrigger className={`${HEADER_CONTROL_HEIGHT} w-50`} aria-label="Année scolaire" data-tour="finance-year"><SelectValue placeholder="Année scolaire" /></SelectTrigger>
            <SelectContent>{yearsQuery.data?.map((year) => <SelectItem key={year.id} value={year.id}>{year.label}{year.status === "active" ? " · Active" : ""}</SelectItem>)}</SelectContent>
          </Select>
          {view === "dashboard" ? (
            <HeaderAction note={school?.last_computed_at ? `Dernier calcul : ${formatDateTimeFr(school.last_computed_at)}` : "Aucun calcul disponible"}>
              <Button
                variant="outline"
                className={HEADER_CONTROL_HEIGHT}
                disabled={recalculateMutation.isPending}
                onClick={() => recalculateMutation.mutate()}
                data-tour="finance-recalc"
              >
                {recalculateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {recalculateMutation.isPending ? "Recalcul en cours…" : "Recalculer les données"}
              </Button>
            </HeaderAction>
          ) : null}
        </>
      }
    >
      {schoolYearId && selectedYear && view === "dashboard" ? <FinancialDashboard schoolYearId={schoolYearId} /> : null}
      {schoolYearId && selectedYear && view === "entry" ? (
      
      <Tabs value={entryTab} onValueChange={setentryTab} className="space-y-5">
        <TabsList className="grid h-auto w-full rounded-xl border border-border bg-muted/50 p-1 sm:w-full grid-cols-2 md:w-[420px]" data-tour="finance-entry-tabs">
          <TabsTrigger value="enregistrement" className="min-h-12">Enregistrement</TabsTrigger>
          <TabsTrigger value="import" className="min-h-12">Importer les paiements</TabsTrigger>
        </TabsList>
        <TabsContent value="enregistrement"><QuickPaymentEntry key={`${schoolYearId}-${initialStudent?.id ?? "none"}`} schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} initialStudent={initialStudent} /></TabsContent>
        <TabsContent value="import"><PaymentImportPanel /></TabsContent>
      </Tabs>
      ) : null}
      {schoolYearId && selectedYear && view === "journal" ? <CashJournalPanel schoolYearId={schoolYearId} /> : null}
      {schoolYearId && selectedYear && view === "history" ? <PaymentHistoryPanel schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} canCancel={hasPermission("payments.cancel")} studentId={studentId} /> : null}
      {schoolYearId && selectedYear && view === "agreements" ? <AgreementsRegister schoolYearId={schoolYearId} /> : null}
    </PageLayout>
    </>
  )
}
