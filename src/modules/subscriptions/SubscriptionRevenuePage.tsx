import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { AlertBanner, EmptyState, PageLayout } from "@/shared/components"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import RevenueOverviewCard from "@/modules/subscriptions/components/RevenueOverviewCard"
import { Badge } from "@/components/ui/badge"
import {
  getSubscriptionsRevenueHistory,
  getSubscriptionsRevenueSummary,
  recordCommissionPayment,
} from "@/modules/subscriptions/subscriptions.api"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"

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
  const user = useAuthStore((state) => state.user)

  const [monthCursor, setMonthCursor] = useState<Date>(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  const month = useMemo(() => toMonth(monthCursor), [monthCursor])

  const summaryQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "summary", month],
    queryFn: () => getSubscriptionsRevenueSummary(month),
  })

  const historyQuery = useQuery({
    queryKey: ["subscriptions", "revenue", "history"],
    queryFn: () => getSubscriptionsRevenueHistory(12),
  })

  const paymentMutation = useMutation({
    mutationFn: (payload: { period_month: string; amount_fcfa: number; notes?: string; idempotency_key: string }) =>
      recordCommissionPayment(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions", "revenue", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["subscriptions", "revenue", "history"] }),
      ])
      setPaymentAmount("")
      setPaymentNotes("")
      setPaymentOpen(false)
      toast({ title: "Versement enregistré" })
    },
  })

  const summary = summaryQuery.data
  const history = historyQuery.data ?? []
  const canRecordPayment = user?.role === "super_admin" && hasPermission("subscriptions.revenue")

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
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {summary ? <RevenueOverviewCard summary={summary} loading={summaryQuery.isLoading} /> : null}

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

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">Historique 12 mois</h2>
        {history.length === 0 ? (
          <EmptyState title="Aucun historique" message="Pas encore de données de commission." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead>Nb nouvelles</TableHead>
                <TableHead>Nb actives</TableHead>
                <TableHead>Encaissé</TableHead>
                <TableHead>Revenu école/mois</TableHead>
                <TableHead>Commission due</TableHead>
                <TableHead>Versé</TableHead>
                <TableHead>Reste</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => {
                const remaining = item.commission_remaining_fcfa
                return (
                  <TableRow key={item.month} className={remaining > 0 ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}>
                    <TableCell className="capitalize">{monthLabel(item.month)}</TableCell>
                    <TableCell>{item.subscriptions_new_this_month}</TableCell>
                    <TableCell>{item.subscriptions_active_count}</TableCell>
                    <TableCell>{formatFcfa(item.total_collected_fcfa)}</TableCell>
                    <TableCell>{formatFcfa(item.monthly_revenue_prorated_fcfa)}</TableCell>
                    <TableCell>{formatFcfa(item.commission_due_fcfa)}</TableCell>
                    <TableCell>{formatFcfa(item.commission_paid_fcfa)}</TableCell>
                    <TableCell>{formatFcfa(remaining)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.payment_status === "paid"
                          ? "Versé"
                          : item.payment_status === "partial"
                            ? "Partiel"
                            : "En attente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

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
    </PageLayout>
  )
}
