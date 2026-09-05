import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listSchoolYears } from "@/modules/academic/academic.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { FinancialDashboard } from "./components/FinancialDashboard"
import { PaymentHistoryPanel } from "./components/PaymentHistoryPanel"
import { QuickPaymentEntry } from "./components/QuickPaymentEntry"
import { CashJournalPanel } from "./components/CashJournalPanel"
import { PaymentImportPanel } from "./components/PaymentImportPanel"
import type { FinanceView } from "./finance.routes"
import { Button } from "@/components/ui/button"
import { useToast } from "@/shared/hooks/use-toast"
import { fetchFinancialSummary, recalculateFinancialCache } from "./finance.api"
import { Spinner } from "@/shared/components/Spinner"
import { RefreshCw } from "lucide-react"

const VIEW_COPY: Record<FinanceView, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Vue financière",
    subtitle: "Suivez le recouvrement et les situations de paiement par année scolaire.",
  },
  journal: {
    title: "Journal de caisse",
    subtitle: "Consultez le journal de caisse (Paiements de scolarité filtrés par période, classe et mode de paiement) et exportez les données.",
  },
  entry: {
    title: "Encaissements",
    subtitle: "Enregistrez et importez rapidement les versements de caisse.",
  },
  history: {
    title: "Historique & reçus",
    subtitle: "Retrouvez les paiements enregistrés et leurs reçus.",
  },
}

export default function FinancePage({ view, studentId, initialSchoolYearId }: { view: FinanceView; studentId?: string; initialSchoolYearId?: string }) {
  const { hasPermission } = usePermissions()
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

  if (yearsQuery.isError) {
    return <PageLayout title={VIEW_COPY[view].title}><QueryErrorState message="Impossible de charger les années scolaires." onRetry={() => void yearsQuery.refetch()} /></PageLayout>
  }

  return (  
    <PageLayout
      title={VIEW_COPY[view].title}
      subtitle={VIEW_COPY[view].subtitle}
      actions={
        <div className="flex gap-3 justify-end">
          {view === "dashboard" ? 
          <div className="space-y-1 text-left">
            <Button className="min-h-12" disabled={recalculateMutation.isPending} onClick={() => recalculateMutation.mutate()}>
              {recalculateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {recalculateMutation.isPending ? "Recalcul en cours…" : "Recalculer"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {school?.last_computed_at ? `Dernier calcul: ${new Date(school.last_computed_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}` : "Aucun calcul disponible"}
            </p>
          </div>
          : null}
   
          <Select value={schoolYearId} onValueChange={setSchoolYearId}>
            <SelectTrigger className="min-h-12 w-50" aria-label="Année scolaire"><SelectValue placeholder="Année scolaire" /></SelectTrigger>
            <SelectContent>{yearsQuery.data?.map((year) => <SelectItem key={year.id} value={year.id}>{year.label}{year.status === "active" ? " · Active" : ""}</SelectItem>)}</SelectContent>
          </Select> 
        </div>
      }
    >
      {schoolYearId && selectedYear && view === "dashboard" ? <FinancialDashboard schoolYearId={schoolYearId} /> : null}
      {schoolYearId && selectedYear && view === "entry" ? (
      
      <Tabs value={entryTab} onValueChange={setentryTab} className="space-y-5">
        <TabsList className="grid h-auto w-full rounded-xl border border-border bg-muted/50 p-1 sm:w-full grid-cols-2 md:w-[420px]">
          <TabsTrigger value="enregistrement" className="min-h-12">Enregistrement</TabsTrigger>
          <TabsTrigger value="import" className="min-h-12">Importer les paiements</TabsTrigger>
        </TabsList>
        <TabsContent value="enregistrement"><QuickPaymentEntry schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} /></TabsContent>
        <TabsContent value="import"><PaymentImportPanel /></TabsContent>
      </Tabs>
      ) : null}
      {schoolYearId && selectedYear && view === "journal" ? <CashJournalPanel schoolYearId={schoolYearId} /> : null}
      {schoolYearId && selectedYear && view === "history" ? <PaymentHistoryPanel schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} canCancel={hasPermission("payments.cancel")} studentId={studentId} /> : null}
    </PageLayout>
  )
}
