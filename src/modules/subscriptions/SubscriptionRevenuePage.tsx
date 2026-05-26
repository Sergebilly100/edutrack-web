import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { AlertBanner, EmptyState, PageLayout } from "@/shared/components"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { SubscriptionsStatsCards } from "@/modules/subscriptions/components/SubscriptionsStatsCards"
import { OverdueReversalBanner } from "@/modules/subscriptions/components/OverdueReversalBanner"
import { getSubscriptionsRevenueStats } from "@/modules/subscriptions/subscriptions.api"
import {
  getSubscriptionsRevenueHistory,
  getSubscriptionsRevenueDetails,
  getSubscriptionsRevenuePayments,
  getSubscriptionsRevenueSummary,
  recordCommissionPayment,
} from "@/modules/subscriptions/subscriptions.api"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { useAuthStore } from "@/shared/store/auth.store"
import { OfflineGuard} from "@/shared/components"

const toMonth = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
const monthLabel = (month: string) => {
  const [year, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, (m ?? 1) - 1, 1))
  )
}
const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`

export default function SubscriptionRevenuePage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const studentLabels = useStudentLabels()
  const user = useAuthStore((state) => state.user)

  const [monthCursor, setMonthCursor] = useState<Date>(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "momo_mtn" | "momo_orange" | "bank_transfer">("cash")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFromMonth, setExportFromMonth] = useState(toMonth(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 2, 1))))
  const [exportToMonth, setExportToMonth] = useState(toMonth(new Date()))

  const month = useMemo(() => toMonth(monthCursor), [monthCursor])

  const summaryQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "summary", month],
    queryFn: () => getSubscriptionsRevenueSummary(month),
  })

  const statsQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "stats", month],
    queryFn: () => getSubscriptionsRevenueStats(month),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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

  const paymentMutation = useMutation({
    mutationFn: (payload: { period_month: string; amount_fcfa: number; payment_method?: "cash" | "momo_mtn" | "momo_orange" | "bank_transfer"; notes?: string; idempotency_key: string }) =>
      recordCommissionPayment(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions", "revenue", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["subscriptions", "revenue", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["subscriptions", "revenue", "history"] }),
      ])
      setPaymentAmount("")
      setPaymentMethod("cash")
      setPaymentNotes("")
      setPaymentOpen(false)
      toast({ title: "Versement enregistré" })
    },
  })

  const summary = summaryQuery.data
  const history = historyQuery.data ?? []
  const monthSubscriptions = monthSubscriptionsQuery.data ?? []
  const currentMonth = toMonth(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const canGoNextMonth = month !== currentMonth
  const canRecordPayment = user?.role === "super_admin" && hasPermission("subscriptions.revenue")
  const monthSubscriptionsCollected = monthSubscriptions.reduce((sum, item) => sum + item.amount_fcfa, 0)

  return (
    <PageLayout
      title="Revenus abonnements"
      actions={
        <div className="flex items-center gap-2">
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
          <OfflineGuard>
            <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
              Exporter bilan
            </Button>
          </OfflineGuard>
        </div>
      }
    >
      {statsQuery.data?.isReverseOverdue ? (
        <OverdueReversalBanner overdueMonths={statsQuery.data.overdueMonths} />
      ) : null}

      <SubscriptionsStatsCards month={month} />

      {summary ? (
        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Commission EduTrack</h2>
              <p className="text-sm text-muted-foreground">
                Commission de {summary.commission_pct}% sur les revenus de ce mois.
              </p>
            </div>
            {canRecordPayment ? (
              <Button type="button" onClick={() => setPaymentOpen(true)}>
                Enregistrer un versement
              </Button>
            ) : null}
          </div>

          {summary.commission_remaining_fcfa > 0 ? (
            <AlertBanner
              type="warning"
              title="Reversement en attente"
              message={`Il reste ${formatFcfa(summary.commission_remaining_fcfa)} à reverser à EduTrack pour ${monthLabel(month)}.`}
            />
          ) : null}
        </section>
      ) : null}

      <Tabs defaultValue="subscriptions" className="space-y-3">
        <TabsList>
          <TabsTrigger value="subscriptions">Détail abonnements du mois ({monthSubscriptions.length})</TabsTrigger>
          <TabsTrigger value="payments">Historique des reversements du mois</TabsTrigger>
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

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un versement</DialogTitle>
            <DialogDescription>Période {monthLabel(month)}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Période</Label>
              <Input value={month} disabled />
            </div>
            <div className="space-y-1">
              <Label>Montant (FCFA)</Label>
              <Input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-1">
              <Label>Moyen de versement</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="momo_mtn">MTN MoMo</SelectItem>
                  <SelectItem value="momo_orange">Orange Money</SelectItem>
                  <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                const amount = Number(paymentAmount)
                if (!Number.isFinite(amount) || amount <= 0) {
                  toast({
                    title: "Montant invalide",
                    description: "Saisissez un montant strictement positif.",
                    variant: "destructive",
                  })
                  return
                }
                paymentMutation.mutate({
                  period_month: month,
                  amount_fcfa: amount,
                  payment_method: paymentMethod,
                  notes: paymentNotes.trim() || undefined,
                  idempotency_key: crypto.randomUUID(),
                })
              }}
              disabled={paymentMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              onClick={() => {
                const rows = history
                  .filter((item) => item.month >= exportFromMonth && item.month <= exportToMonth)
                const esc = (value: string) =>
                  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                const win = window.open("", "_blank")
                if (!win) {
                  return
                }
                const htmlRows = rows
                  .map(
                    (item) =>
                      `<tr><td>${esc(item.month)}</td><td>${item.subscriptions_new_this_month}</td><td>${item.subscriptions_active_count}</td><td>${esc(formatFcfa(item.total_collected_fcfa))}</td><td>${esc(formatFcfa(item.commission_due_fcfa))}</td><td>${esc(formatFcfa(item.commission_paid_fcfa))}</td><td>${esc(formatFcfa(item.commission_remaining_fcfa))}</td><td>${esc(item.payment_status)}</td></tr>`
                  )
                  .join("")
                win.document.write(`
                  <html><head><title>Bilan reversements</title></head><body>
                  <h2>Bilan des reversements abonnements</h2>
                  <p>Période: ${esc(exportFromMonth)} à ${esc(exportToMonth)}</p>
                  <table border="1" cellspacing="0" cellpadding="6">
                    <thead><tr><th>Mois</th><th>Nouvelles</th><th>Actives</th><th>Encaissé</th><th>Commission due</th><th>Versé</th><th>Reste</th><th>Statut</th></tr></thead>
                    <tbody>${htmlRows}</tbody>
                  </table>
                  </body></html>
                `)
                win.document.close()
                win.focus()
                win.print()
                setExportOpen(false)
              }}
            >
              Exporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
