import { Navigate, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, BarChart3, Building2, TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getRevenueSummary } from "@/modules/admin/admin.api"
import RevenueChart from "@/modules/admin/components/RevenueChart"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const fmt = (v: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} FCFA`

const planBadge = (plan: string) => {
  const map: Record<string, string> = {
    essential: "bg-slate-100 text-slate-700",
    pro: "bg-blue-100 text-blue-700",
    establishment: "bg-purple-100 text-purple-700",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[plan] ?? "bg-muted text-muted-foreground"}`}>
      {plan}
    </span>
  )
}

const statusBadge = (s: string) => {
  if (s === "active")    return <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-xs">Actif</Badge>
  if (s === "trial")     return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-xs">Trial</Badge>
  if (s === "suspended") return <Badge variant="outline" className="border-amber-300 text-amber-900 bg-amber-50 text-xs">Suspendu</Badge>
  if (s === "cancelled") return <Badge variant="outline" className="border-slate-300 text-slate-500 text-xs">Résilié</Badge>
  return <Badge variant="outline" className="text-xs">{s}</Badge>
}

export default function AdminRevenuePage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const q = useQuery({ queryKey: ["admin", "revenue", "summary"], queryFn: getRevenueSummary })

  if (!user) return <Navigate to="/" replace />
  if (user.role !== "super_admin") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
      </Alert>
    )
  }

  const cards  = q.data?.cards
  const schools = q.data?.schools ?? []
  const monthly = q.data?.monthly ?? []

  const overdueSchools   = schools.filter((s) => s.overdueMonths > 0)
  const upToDateSchools  = schools.filter((s) => s.overdueMonths === 0 && s.effectiveMrr > 0)
  const noMrrSchools     = schools.filter((s) => s.effectiveMrr === 0)
  const mrrKnown         = schools.filter((s) => s.effectiveMrr > 0).length
  const totalOverdue     = cards?.totalOverdueFcfa ?? 0
  const collectionRate   = (cards?.mrrTotalFcfa ?? 0) > 0
    ? Math.round(((cards?.totalCollectedThisMonthFcfa ?? 0) / (cards?.mrrTotalFcfa ?? 1)) * 100)
    : null

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Revenus des Écoles</h1>
        <p className="text-sm text-muted-foreground">
          Suivi des encaissements, retards de paiement et santé financière du portefeuille IvoirEdu.
        </p>
      </header>

      {/* Alerte globale retard */}
      {(cards?.schoolsWithOverdue ?? 0) > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{cards!.schoolsWithOverdue} école{cards!.schoolsWithOverdue > 1 ? "s" : ""} en retard</strong>
            {" — "}IvoirEdu est dû <strong>{fmt(totalOverdue)}</strong> au total sur les mensualités impayées.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Encaissé ce mois"
          value={fmt(cards?.totalCollectedThisMonthFcfa ?? 0)}
          subtitle={collectionRate !== null ? `${collectionRate}% du MRR attendu` : "—"}
          icon={<Wallet className="h-4 w-4" />}
          variant={collectionRate !== null && collectionRate < 50 ? "warning" : "default"}
          loading={q.isLoading}
        />
        <StatCard
          title="Encaissé cette année"
          value={fmt(cards?.totalCollectedThisYearFcfa ?? 0)}
          subtitle="Depuis sept (année scolaire)"
          icon={<TrendingUp className="h-4 w-4" />}
          variant="success"
          loading={q.isLoading}
        />
        <StatCard
          title="Total impayé dû"
          value={fmt(totalOverdue)}
          subtitle={`${cards?.schoolsWithOverdue ?? 0} école(s) en retard`}
          icon={<TrendingDown className="h-4 w-4" />}
          variant={totalOverdue > 0 ? "danger" : "default"}
          loading={q.isLoading}
        />
        <StatCard
          title="MRR cible mensuel"
          value={fmt(cards?.mrrTotalFcfa ?? 0)}
          subtitle={`ARR : ${fmt(cards?.arrFcfa ?? 0)} · ${mrrKnown} écoles tracées`}
          icon={<BarChart3 className="h-4 w-4" />}
          loading={q.isLoading}
        />
      </section>

      {q.isError && (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les données de revenus.</AlertDescription>
        </Alert>
      )}

      {/* Graphe encaissements réels vs MRR cible */}
      <RevenueChart data={monthly.map((e) => ({ month: e.month, mrr_fcfa: e.mrr_fcfa, collected_fcfa: e.collected_fcfa }))} />

      {/* Bloc retard : vue détaillée prioritaire */}
      {overdueSchools.length > 0 && (
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-destructive">{overdueSchools.length} école{overdueSchools.length > 1 ? "s" : ""} en retard</span>
              <span className="ml-auto text-sm font-semibold text-destructive">{fmt(totalOverdue)} dus</span>
            </CardTitle>
            <CardDescription>
              Mois passés sans paiement rattaché (basé sur MRR configuré ou tarif plan).
              Cliquez sur une ligne pour accéder au calendrier de paiement de l&apos;école.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-red-100">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50/50">
                    <TableHead>École</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">MRR/mois</TableHead>
                    <TableHead className="text-center">Mois impayés</TableHead>
                    <TableHead className="text-right font-semibold">Total dû</TableHead>
                    <TableHead>Dernier paiement</TableHead>
                    <TableHead>Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueSchools.map((row) => (
                    <TableRow key={row.tenantId}
                      className="cursor-pointer hover:bg-red-50/60"
                      onClick={() => navigate(`/admin/schools/${row.tenantId}?tab=abonnement`)}>
                      <TableCell className="font-medium">{row.school}</TableCell>
                      <TableCell>{planBadge(row.plan)}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-right">
                        {fmt(row.effectiveMrr)}
                        {row.mrrFcfa === 0 && (
                          <span className="ml-1 text-xs text-amber-500" title="Estimé depuis tarif plan">~</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 font-semibold text-sm px-2.5 py-0.5">
                          {row.overdueMonths} mois
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">{fmt(row.overdueFcfa)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.lastPaymentDate
                          ? `${new Date(row.lastPaymentDate).toLocaleDateString("fr-FR")} · ${fmt(row.lastPaymentAmount)}`
                          : <span className="italic">Jamais payé</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.paymentMode ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-right text-muted-foreground">
              Sous-total retard : <strong className="text-destructive">{fmt(overdueSchools.reduce((s, r) => s + r.overdueFcfa, 0))}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tableau complet */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Toutes les écoles ({schools.length})
          </CardTitle>
          <CardDescription>
            Trié par retard décroissant. <span className="text-amber-600">~</span> = MRR estimé depuis le tarif plan (non confirmé).
            {noMrrSchools.length > 0 && ` · ${noMrrSchools.length} école(s) sans MRR ni prix plan configuré.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">MRR/mois</TableHead>
                  <TableHead className="text-right">Encaissé (année)</TableHead>
                  <TableHead className="text-center">Retard</TableHead>
                  <TableHead className="text-right">Montant dû</TableHead>
                  <TableHead>Dernier versement</TableHead>
                  <TableHead>Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((row) => {
                  const isOverdue = row.overdueMonths > 0
                  return (
                    <TableRow key={row.tenantId}
                      className={`cursor-pointer hover:bg-muted/40 ${isOverdue ? "bg-red-50/30" : ""}`}
                      onClick={() => navigate(`/admin/schools/${row.tenantId}?tab=abonnement`)}>
                      <TableCell className="font-medium">{row.school}</TableCell>
                      <TableCell>{planBadge(row.plan)}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-right">
                        {row.effectiveMrr > 0 ? (
                          <>
                            {fmt(row.effectiveMrr)}
                            {row.mrrFcfa === 0 && <span className="ml-1 text-xs text-amber-500" title="Estimé depuis plan">~</span>}
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Non configuré</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(row.collectedThisYearFcfa)}</TableCell>
                      <TableCell className="text-center">
                        {isOverdue ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium">
                            {row.overdueMonths} mois
                          </span>
                        ) : row.effectiveMrr > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium">
                            À jour
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {isOverdue ? fmt(row.overdueFcfa) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.lastPaymentDate
                          ? `${new Date(row.lastPaymentDate).toLocaleDateString("fr-FR")} · ${fmt(row.lastPaymentAmount)}`
                          : <span className="italic text-xs">Jamais</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.paymentMode ?? "—"}</TableCell>
                    </TableRow>
                  )
                })}
                {!q.isLoading && schools.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-6 text-sm">
                      Aucune école enregistrée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {schools.length > 0 && (
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {upToDateSchools.length} à jour · {overdueSchools.length} en retard · {noMrrSchools.length} sans MRR
              </span>
              <span>
                Encaissé cette année : <strong>{fmt(schools.reduce((s, r) => s + r.collectedThisYearFcfa, 0))}</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
