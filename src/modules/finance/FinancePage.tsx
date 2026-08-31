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
  entry: {
    title: "Encaissements",
    subtitle: "Enregistrez rapidement les versements reçus au guichet.",
  },
  history: {
    title: "Historique & reçus",
    subtitle: "Retrouvez les paiements enregistrés et leurs reçus.",
  },
  journal: {
    title: "Journal & exports",
    subtitle: "Consultez le journal de caisse, exportez les données et importez les versements de caisse.",
  },
}

export default function FinancePage({ view }: { view: FinanceView }) {
  const { hasPermission } = usePermissions()
  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const [schoolYearId, setSchoolYearId] = useState("")
  const [journalTab, setJournalTab] = useState("journal")

  useEffect(() => {
    const years = yearsQuery.data ?? []
    if (!schoolYearId && years.length > 0) setSchoolYearId((years.find((year) => year.status === "active") ?? years[0]).id)
  }, [schoolYearId, yearsQuery.data])

  useEffect(() => {
    if (view !== "journal") setJournalTab("journal")
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
      {schoolYearId && selectedYear && view === "dashboard" ? <FinancialDashboard /> : null}
      {schoolYearId && selectedYear && view === "entry" ? <QuickPaymentEntry schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} /> : null}
      {schoolYearId && selectedYear && view === "journal" ? (
        <Tabs value={journalTab} onValueChange={setJournalTab} className="space-y-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="journal" className="min-h-10">Journal</TabsTrigger>
            <TabsTrigger value="import" className="min-h-10">Importer les paiements</TabsTrigger>
          </TabsList>
          <TabsContent value="journal"><CashJournalPanel schoolYearId={schoolYearId} /></TabsContent>
          <TabsContent value="import"><PaymentImportPanel /></TabsContent>
        </Tabs>
      ) : null}
      {schoolYearId && selectedYear && view === "history" ? <PaymentHistoryPanel schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} canCancel={hasPermission("payments.cancel")} /> : null}
    </PageLayout>
  )
}
