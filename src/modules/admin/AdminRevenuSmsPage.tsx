import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ChevronLeft, ChevronRight, MessageSquare, TrendingUp, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSmsFeatureGlobalStats } from "@/modules/admin/admin.api"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const fmt = (v: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} FCFA`

const toMonth = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y!, (mo ?? 1) - 1, 1))
  )
}

export default function AdminRevenuSmsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const now = new Date()
  const [cursor, setCursor] = useState(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
  const month = toMonth(cursor)
  const currentMonth = toMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))

  const q = useQuery({
    queryKey: ["admin", "sms-feature", "global-stats", month],
    queryFn: () => getSmsFeatureGlobalStats(month),
  })

  if (!user) return <Navigate to="/" replace />
  if (user.role !== "super_admin") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
      </Alert>
    )
  }

  const rows = q.data ?? []

  // KPIs mois ciblé
  const totalDue          = rows.reduce((s, r) => s + r.commission_due_fcfa, 0)
  const totalPaid         = rows.reduce((s, r) => s + r.commission_paid_fcfa, 0)
  const totalRemaining    = rows.reduce((s, r) => s + r.commission_remaining_fcfa, 0)
  const totalCollected    = rows.reduce((s, r) => s + r.total_collected_fcfa, 0)
  const totalSms          = rows.reduce((s, r) => s + r.sms_sent_this_month, 0)
  const overdueRows       = rows.filter((r) => r.commission_remaining_fcfa > 0)
  const recoveryRate      = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : null

  // KPIs annuels (année scolaire sept→mois courant)
  const totalCollectedYtd   = rows.reduce((s, r) => s + r.collected_ytd_fcfa, 0)
  const totalCommissionYtd  = rows.reduce((s, r) => s + r.commission_ytd_fcfa, 0)

  const isCurrentMonth = month === currentMonth

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Revenus SMS</h1>
        <p className="text-sm text-muted-foreground">
          Commissions IvoirEdu sur la feature SMS — abonnements parents par école.
          Les SMS comptés sont les <strong>notifications d&apos;absence envoyées aux parents</strong> abonnés.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="outline" size="icon"
            onClick={() => setCursor((p) => new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() - 1, 1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium capitalize">{monthLabel(month)}</span>
          <Button type="button" variant="outline" size="icon" disabled={isCurrentMonth}
            onClick={() => setCursor((p) => new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() + 1, 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {overdueRows.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{overdueRows.length} école{overdueRows.length > 1 ? "s" : ""}</strong> avec commission non reversée —{" "}
            <strong>{fmt(totalRemaining)}</strong> à percevoir ce mois.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs mois */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          {isCurrentMonth ? "Mois en cours" : `Mois : ${monthLabel(month)}`}
        </p>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Encaissé (école)"
            value={fmt(totalCollected)}
            subtitle="Abonnements parents facturés ce mois"
            icon={<Wallet className="h-4 w-4" />}
            loading={q.isLoading}
          />
          <StatCard
            title="Commission due"
            value={fmt(totalDue)}
            subtitle={`Taux moyen : ${rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.commission_pct, 0) / rows.length) : 0}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            loading={q.isLoading}
          />
          <StatCard
            title="Reste à percevoir"
            value={fmt(totalRemaining)}
            subtitle={recoveryRate !== null ? `${recoveryRate}% reversé` : overdueRows.length === 0 ? "Tout reversé" : undefined}
            icon={<Wallet className="h-4 w-4" />}
            variant={totalRemaining > 0 ? "danger" : "default"}
            loading={q.isLoading}
          />
          <StatCard
            title="SMS abonnements"
            value={totalSms}
            subtitle={`${rows.length} école(s) avec feature active`}
            icon={<MessageSquare className="h-4 w-4" />}
            loading={q.isLoading}
          />
        </section>
      </div>

      {/* KPIs annuels */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Cumul année scolaire (sept → {isCurrentMonth ? "aujourd'hui" : monthLabel(month)})
        </p>
        <section className="grid gap-4 sm:grid-cols-2">
          <Card className="shadow-sm">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Total encaissé par les écoles (abonnements parents)</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalCollectedYtd)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Base de calcul de nos commissions</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-green-200 bg-green-50/30">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Commission IvoirEdu générée (feature SMS)</p>
              <p className="text-2xl font-bold mt-1 text-green-700">{fmt(totalCommissionYtd)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gain annuel estimé — {rows.length > 0 ? `taux moyen ${Math.round(rows.reduce((s, r) => s + r.commission_pct, 0) / rows.length)}%` : "—"}
              </p>
            </CardContent>
          </Card>
        </section>
      </div>

      {q.isError && (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les revenus SMS.</AlertDescription>
        </Alert>
      )}

      {/* Tableau par école */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Détail par école — {monthLabel(month)}</CardTitle>
          <CardDescription>
            Triées par commission restante décroissante.
            La colonne <em>SMS</em> compte les notifications d&apos;absence envoyées aux parents abonnés ce mois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead className="text-right">Abonnés actifs</TableHead>
                  <TableHead className="text-right">Encaissé école</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead className="text-right">Commission due</TableHead>
                  <TableHead className="text-right">Reversé</TableHead>
                  <TableHead className="text-right">Reste</TableHead>
                  <TableHead className="text-right">Encaissé (année)</TableHead>
                  <TableHead className="text-right">Commission (année)</TableHead>
                  <TableHead className="text-right">SMS ce mois</TableHead>
                  <TableHead>Dernier versement</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const pending = row.commission_remaining_fcfa > 0
                  return (
                    <TableRow key={row.tenant_id} className={pending ? "bg-red-50/30" : ""}>
                      <TableCell className="font-medium">{row.school_name}</TableCell>
                      <TableCell className="text-right">{row.subscriptions_active}</TableCell>
                      <TableCell className="text-right">{fmt(row.total_collected_fcfa)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.commission_pct}%</TableCell>
                      <TableCell className="text-right font-medium">{fmt(row.commission_due_fcfa)}</TableCell>
                      <TableCell className="text-right text-green-700">
                        {row.commission_paid_fcfa > 0 ? fmt(row.commission_paid_fcfa) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {pending ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium whitespace-nowrap">
                            {fmt(row.commission_remaining_fcfa)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium">
                            Soldé
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(row.collected_ytd_fcfa)}</TableCell>
                      <TableCell className="text-right font-medium text-green-700">{fmt(row.commission_ytd_fcfa)}</TableCell>
                      <TableCell className="text-right">{row.sms_sent_this_month}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.last_payment_at
                          ? new Date(row.last_payment_at).toLocaleDateString("fr-FR")
                          : "Jamais"}
                      </TableCell>
                      <TableCell>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2"
                          onClick={() => navigate(`/admin/schools/${row.tenant_id}?tab=sms-feature`)}>
                          Gérer
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!q.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-6 text-sm">
                      Aucune école avec feature SMS activée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {rows.length > 0 && (
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {overdueRows.length > 0
                  ? `${overdueRows.length} école(s) en attente de reversement`
                  : "Tous les reversements du mois sont à jour"}
              </span>
              <span>
                Commission due : <strong>{fmt(totalDue)}</strong>
                {" · "}Reversé : <strong className="text-green-700">{fmt(totalPaid)}</strong>
                {totalRemaining > 0 && <>{" · "}Reste : <strong className="text-destructive">{fmt(totalRemaining)}</strong></>}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
