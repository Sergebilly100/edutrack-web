import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

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

const VIEW_COPY: Record<FinanceView, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Vue financière",
    subtitle: "Suivez le recouvrement et les situations de paiement par année scolaire.",
  },
  journal: {
    title: "Journal de caisse",
    subtitle: "Consultez le journal de caisse (Paiements de scolarité filtréspar période, classe et mode de paiement) et exportez les données.",
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

export default function FinancePage({ view }: { view: FinanceView }) {
  const { hasPermission } = usePermissions()
  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const [schoolYearId, setSchoolYearId] = useState("")
  const [entryTab, setentryTab] = useState("enregistrement")

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
        <Select value={schoolYearId} onValueChange={setSchoolYearId}>
          <SelectTrigger className="min-h-12 w-full sm:w-64" aria-label="Année scolaire"><SelectValue placeholder="Année scolaire" /></SelectTrigger>
          <SelectContent>{yearsQuery.data?.map((year) => <SelectItem key={year.id} value={year.id}>{year.label}{year.status === "active" ? " · Active" : ""}</SelectItem>)}</SelectContent>
        </Select>
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
      {schoolYearId && selectedYear && view === "history" ? <PaymentHistoryPanel schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} canCancel={hasPermission("payments.cancel")} /> : null}
    </PageLayout>
  )
}
