import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Info } from "lucide-react"

import { AlertBanner, EmptyState, PageLayout } from "@/shared/components"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SubscriptionsStatsCards } from "@/modules/subscriptions/components/SubscriptionsStatsCards"
import { OverdueReversalBanner } from "@/modules/subscriptions/components/OverdueReversalBanner"
import {
  exportSubscriptionsRevenue,
  getCommissionOverdueAlerts,
  getSubscriptionsRevenueHistory,
  getSubscriptionsRevenueDetails,
  getSubscriptionsRevenuePayments,
  getSubscriptionsRevenueSummary,
} from "@/modules/subscriptions/subscriptions.api"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { OfflineGuard} from "@/shared/components"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { subscriptionRevenueTourSteps } from "@/shared/lib/tour-steps"

const toMonth = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
const monthLabel = (month: string) => {
  const [year, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, (m ?? 1) - 1, 1))
  )
}
const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`

export default function SubscriptionRevenuePage() {
  const studentLabels = useStudentLabels()
  const tour = useTourGuide("subscription-revenue", true)

  const [monthCursor, setMonthCursor] = useState<Date>(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFromMonth, setExportFromMonth] = useState(toMonth(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 2, 1))))
  const [exportToMonth, setExportToMonth] = useState(toMonth(new Date()))

  const month = useMemo(() => toMonth(monthCursor), [monthCursor])

  const revenueExport = usePdfExportJob({
    fallbackFileName: "bilan-reversements.pdf",
    startedMessage: "Le bilan des reversements (PDF) est en cours de génération.",
    successMessage: "Bilan des reversements téléchargé",
    errorMessage: "Impossible d'exporter le bilan des reversements.",
  })

  const summaryQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "summary", month],
    queryFn: () => getSubscriptionsRevenueSummary(month),
  })

  const historyQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "history"],
    queryFn: () => getSubscriptionsRevenueHistory(12),
  })
  const monthSubscriptionsQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "details", month],
    queryFn: () => getSubscriptionsRevenueDetails(month),
  })
  const paymentsQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "payments", month],
    queryFn: () => getSubscriptionsRevenuePayments(month),
  })

  const commissionOverdueQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "commission-overdue"],
    queryFn: getCommissionOverdueAlerts,
    staleTime: 5 * 60 * 1000,
  })

  const summary = summaryQuery.data
  const history = historyQuery.data ?? []
  const monthSubscriptions = monthSubscriptionsQuery.data ?? []
  const currentMonth = toMonth(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const canGoNextMonth = month !== currentMonth
  const monthSubscriptionsCollected = monthSubscriptions.reduce((sum, item) => sum + item.amount_fcfa, 0)

  return (
    <>
      <TourGuide
        steps={subscriptionRevenueTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <PageLayout
      title="Revenus abonnements"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-muted-foreground"
            onClick={() => tour.restart()}
            aria-label="Revoir le guide"
          >
            <Info className="mr-1.5 h-4 w-4" />
            Guide
          </Button>
          <div className="flex items-center gap-1" data-tour="revenue-nav">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonthCursor((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() - 1, 1)))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-40 text-center text-sm capitalize">{monthLabel(month)}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonthCursor((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1)))}
              disabled={!canGoNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <OfflineGuard>
            <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
              Exporter bilan
            </Button>
          </OfflineGuard>
        </div>
      }
    >
      {(commissionOverdueQuery.data?.count ?? 0) > 0 ? (
        <OverdueReversalBanner overdueMonths={(commissionOverdueQuery.data?.months ?? []).map((m) => ({
          month: monthLabel(m.month),
          amount: m.remainingFcfa,
          dueDate: `${m.month}-15`,
          daysPastDue: 0,
        }))} />
      ) : null}

      <SubscriptionsStatsCards month={month} />

      {summary ? (
        <section className="space-y-3 rounded-lg border p-4" data-tour="revenue-commission">
          <div>
            <h2 className="text-sm font-semibold">Commission IvoirEdu</h2>
            <p className="text-sm text-muted-foreground">
              Commission de {summary.commission_pct}% sur les revenus de ce mois.
            </p>
          </div>

          {summary.commission_remaining_fcfa > 0 && summary.total_collected_fcfa > 0 ? (
            <AlertBanner
              type="warning"
              title="Reversement en attente"
              message={`Il reste ${formatFcfa(summary.commission_remaining_fcfa)} à reverser à IvoirEdu pour ${monthLabel(month)}. Contactez IvoirEdu pour effectuer le versement.`}
            />
          ) : null}
        </section>
      ) : null}

      <Tabs defaultValue="subscriptions" className="space-y-3">
        <TabsList>
          <TabsTrigger value="subscriptions" data-tour="revenue-tab-subscriptions">Détail abonnements du mois ({monthSubscriptions.length})</TabsTrigger>
          <TabsTrigger value="payments" data-tour="revenue-tab-payments">Historique des reversements du mois</TabsTrigger>
        </TabsList>
        <TabsContent value="subscriptions" className="rounded-lg border p-4">
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">Total abonnements</p>
              <p className="text-lg font-semibold">{monthSubscriptions.length}</p>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">Total encaissé (détail)</p>
              <p className="text-lg font-semibold">{formatFcfa(monthSubscriptionsCollected)}</p>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">Parents uniques</p>
              <p className="text-lg font-semibold">{new Set(monthSubscriptions.map((item) => item.parent_id)).size}</p>
            </div>
          </div>
          {monthSubscriptions.length === 0 ? (
            <EmptyState title="Aucun abonnement" message="Aucun abonnement trouvé pour ce mois." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>{studentLabels.plural}</TableHead>
	                  <TableHead>Date encaissement</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Fin abonnement</TableHead>
	                  <TableHead>Moyen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
	                {monthSubscriptions.map((item) => (
	                  <TableRow key={item.payment_id}>
	                    <TableCell>{item.full_name}</TableCell>
	                    <TableCell>{item.phone}</TableCell>
	                    <TableCell>{item.students_count}</TableCell>
	                    <TableCell>{item.paid_at.slice(0, 10)}</TableCell>
	                    <TableCell>{item.duration_months} mois</TableCell>
	                    <TableCell>{formatFcfa(item.amount_fcfa)}</TableCell>
	                    <TableCell>{item.ends_at}</TableCell>
	                    <TableCell>{item.payment_method}</TableCell>
	                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
        <TabsContent value="payments" className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Historique des reversements du mois</h2>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">Nombre de reversements</p>
              <p className="text-lg font-semibold">{(paymentsQuery.data ?? []).length}</p>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <p className="text-muted-foreground">Total reversé sur le mois</p>
              <p className="text-lg font-semibold">
                {formatFcfa((paymentsQuery.data ?? []).reduce((acc, item) => acc + item.amount_fcfa, 0))}
              </p>
            </div>
          </div>
          {(paymentsQuery.data ?? []).length === 0 ? (
            <EmptyState title="Aucun reversement" message="Aucun reversement enregistré sur ce mois." />
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Moyen</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(paymentsQuery.data ?? []).map((item) => {
                return (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>{formatFcfa(item.amount_fcfa)}</TableCell>
                    <TableCell>{item.period_month}</TableCell>
                    <TableCell>{item.payment_method || "-"}</TableCell>
                    <TableCell>{item.notes || "-"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exporter le bilan des reversements</DialogTitle>
            <DialogDescription>Sélectionnez la période d’export.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Du mois</Label>
              <Input type="month" value={exportFromMonth} onChange={(event) => setExportFromMonth(event.target.value)} max={currentMonth} />
            </div>
            <div className="space-y-1">
              <Label>Au mois</Label>
              <Input type="month" value={exportToMonth} onChange={(event) => setExportToMonth(event.target.value)} max={currentMonth} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExportOpen(false)}>Annuler</Button>
            <Button
              type="button"
              disabled={revenueExport.isRunning}
              onClick={() => {
                setExportOpen(false)
                void revenueExport.launch(() =>
                  exportSubscriptionsRevenue({
                    periodFrom: exportFromMonth,
                    periodTo: exportToMonth,
                  })
                )
              }}
            >
              {revenueExport.isRunning ? "Génération du PDF..." : "Exporter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
    </>
  )
}
