import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BookOpenCheck, FileSpreadsheet, History, LayoutDashboard, ReceiptText, Settings2, WalletCards, BellRing } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listSchoolYears } from "@/modules/academic/academic.api"
import { PageLayout } from "@/shared/components/PageLayout"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { FinancialAlertRules } from "./components/FinancialAlertRules"
import { FinancialDashboard } from "./components/FinancialDashboard"
import { FinanceSettings } from "./components/FinanceSettings"
import { PaymentHistoryPanel } from "./components/PaymentHistoryPanel"
import { QuickPaymentEntry } from "./components/QuickPaymentEntry"
import { TuitionConfiguration } from "./components/TuitionConfiguration"
import { CashJournalPanel } from "./components/CashJournalPanel"
import { PaymentImportPanel } from "./components/PaymentImportPanel"

type FinanceTab = "dashboard" | "entry" | "journal" | "history" | "import" | "tuition" | "alerts" | "settings"

export default function FinancePage() {
  const { hasPermission } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears })
  const [schoolYearId, setSchoolYearId] = useState("")
  const canRecord = hasPermission("payments.record")
  const canViewPayments = hasPermission("payments.view")
  const canViewTuition = hasPermission("tuition.view") || hasPermission("tuition.edit") || hasPermission("tuition.grant_discount")
  const canManageProviders = hasPermission("settings.school")
  const canManagePlans = hasPermission("subscription_plans.view") || hasPermission("subscription_plans.edit")
  const canEditAlerts = hasPermission("financial_alerts.edit")
  const availableTabs = useMemo<FinanceTab[]>(() => [
    ...(canViewPayments ? ["dashboard" as const] : []),
    ...(canRecord ? ["entry" as const] : []),
    ...(canViewPayments ? ["journal" as const] : []),
    ...(canViewPayments ? ["history" as const] : []),
    ...(canRecord ? ["import" as const] : []),
    ...(canViewTuition ? ["tuition" as const] : []),
    ...(canViewPayments ? ["alerts" as const] : []),
    ...(canManageProviders || canManagePlans ? ["settings" as const] : []),
  ], [canManagePlans, canManageProviders, canRecord, canViewPayments, canViewTuition])
  const requestedTab = searchParams.get("tab")
  const [tab, setTab] = useState<FinanceTab>(() =>
    requestedTab && availableTabs.includes(requestedTab as FinanceTab)
      ? requestedTab as FinanceTab
      : availableTabs[0] ?? "history",
  )

  useEffect(() => {
    const years = yearsQuery.data ?? []
    if (!schoolYearId && years.length > 0) setSchoolYearId((years.find((year) => year.status === "active") ?? years[0]).id)
  }, [schoolYearId, yearsQuery.data])

  useEffect(() => {
    const nextTab = requestedTab && availableTabs.includes(requestedTab as FinanceTab)
      ? requestedTab as FinanceTab
      : availableTabs[0]
    if (nextTab && nextTab !== tab) setTab(nextTab)
  }, [availableTabs, requestedTab, tab])

  const selectTab = (value: string) => {
    const nextTab = value as FinanceTab
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }

  const selectedYear = yearsQuery.data?.find((year) => year.id === schoolYearId)

  if (yearsQuery.isError) {
    return <PageLayout title="Frais et paiements"><QueryErrorState message="Impossible de charger les années scolaires." onRetry={() => void yearsQuery.refetch()} /></PageLayout>
  }

  return (
    <PageLayout
      title="Frais et paiements"
      subtitle="Enregistrez les versements, suivez les cumuls et configurez les frais de scolarité."
      actions={
        <Select value={schoolYearId} onValueChange={setSchoolYearId}>
          <SelectTrigger className="min-h-12 w-full sm:w-64" aria-label="Année scolaire"><SelectValue placeholder="Année scolaire" /></SelectTrigger>
          <SelectContent>{yearsQuery.data?.map((year) => <SelectItem key={year.id} value={year.id}>{year.label}{year.status === "active" ? " · Active" : ""}</SelectItem>)}</SelectContent>
        </Select>
      }
    >
      {schoolYearId && selectedYear ? (
        <Tabs value={tab} onValueChange={selectTab} className="space-y-5">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max justify-start">
              {canViewPayments ? <TabsTrigger value="dashboard" className="min-h-10"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</TabsTrigger> : null}
              {canRecord ? <TabsTrigger value="entry" className="min-h-10"><ReceiptText className="mr-2 h-4 w-4" />Saisie rapide</TabsTrigger> : null}
              {canViewPayments ? <TabsTrigger value="journal" className="min-h-10"><WalletCards className="mr-2 h-4 w-4" />Journal</TabsTrigger> : null}
              {canViewPayments ? <TabsTrigger value="history" className="min-h-10"><History className="mr-2 h-4 w-4" />Historique</TabsTrigger> : null}
              {canRecord ? <TabsTrigger value="import" className="min-h-10"><FileSpreadsheet className="mr-2 h-4 w-4" />Importer</TabsTrigger> : null}
              {canViewTuition ? <TabsTrigger value="tuition" className="min-h-10"><BookOpenCheck className="mr-2 h-4 w-4" />Frais</TabsTrigger> : null}
              {canViewPayments ? <TabsTrigger value="alerts" className="min-h-10"><BellRing className="mr-2 h-4 w-4" />Relances</TabsTrigger> : null}
              {canManageProviders || canManagePlans ? <TabsTrigger value="settings" className="min-h-10"><Settings2 className="mr-2 h-4 w-4" />Paramètres</TabsTrigger> : null}
            </TabsList>
          </div>
          {canViewPayments ? <TabsContent value="dashboard"><FinancialDashboard /></TabsContent> : null}
          {canRecord ? <TabsContent value="entry"><QuickPaymentEntry schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} /></TabsContent> : null}
          {canViewPayments ? <TabsContent value="journal"><CashJournalPanel schoolYearId={schoolYearId} /></TabsContent> : null}
          {canViewPayments ? <TabsContent value="history"><PaymentHistoryPanel schoolYearId={schoolYearId} schoolYearLabel={selectedYear.label} canCancel={hasPermission("payments.cancel")} /></TabsContent> : null}
          {canRecord ? <TabsContent value="import"><PaymentImportPanel /></TabsContent> : null}
          {canViewTuition ? <TabsContent value="tuition"><TuitionConfiguration schoolYearId={schoolYearId} canEdit={hasPermission("tuition.edit")} canGrantDiscount={hasPermission("tuition.grant_discount")} /></TabsContent> : null}
          {canViewPayments ? <TabsContent value="alerts"><FinancialAlertRules canEdit={canEditAlerts} /></TabsContent> : null}
          {canManageProviders || canManagePlans ? <TabsContent value="settings"><FinanceSettings canManageProviders={canManageProviders} canViewPlans={canManagePlans} canEditPlans={hasPermission("subscription_plans.edit")} /></TabsContent> : null}
        </Tabs>
      ) : null}
    </PageLayout>
  )
}
