import { useMemo } from "react"
import { Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, BarChart3, MessageSquare, Send, ShieldCheck, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSmsDashboard } from "@/modules/admin/admin.api"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export default function AdminSmsPage() {
  const user = useAuthStore((state) => state.user)

  const dashboardQuery = useQuery({ queryKey: ["admin", "sms", "dashboard"], queryFn: getSmsDashboard })
  const quotaAlerts = useMemo(
    () =>
      (dashboardQuery.data?.bySchool ?? [])
        .filter((row) => row.usedPct >= 80)
        .sort((a, b) => b.usedPct - a.usedPct),
    [dashboardQuery.data?.bySchool]
  )
  const failedHistory = useMemo(
    () =>
      (dashboardQuery.data?.history ?? [])
        .filter((row) => row.status.toLowerCase() === "failed")
        .slice(0, 20),
    [dashboardQuery.data?.history]
  )
  const byType = useMemo(() => {
    const entries = Object.entries(
      (dashboardQuery.data?.history ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.type] = (acc[row.type] ?? 0) + 1
        return acc
      }, {})
    )
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [dashboardQuery.data?.history])
  const byStatus = useMemo(() => {
    const entries = Object.entries(
      (dashboardQuery.data?.history ?? []).reduce<Record<string, number>>((acc, row) => {
        const normalized = row.status.toLowerCase()
        acc[normalized] = (acc[normalized] ?? 0) + 1
        return acc
      }, {})
    )
    return entries.sort((a, b) => b[1] - a[1])
  }, [dashboardQuery.data?.history])

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "super_admin") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">SMS & Notifs</h1>
        <p className="text-sm text-muted-foreground">Pilotage plateforme SMS (fourniture, qualité, conformité, consommation).</p>
      </header>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue globale</TabsTrigger>
          <TabsTrigger value="quality">Qualité & incidents</TabsTrigger>
          <TabsTrigger value="governance">Gouvernance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="SMS ce mois" value={dashboardQuery.data?.sentThisMonth ?? 0} icon={<Send className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
            <StatCard title="Taux livraison" value={`${dashboardQuery.data?.deliveryRate ?? 0}%`} icon={<BarChart3 className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
            <StatCard title="Écoles actives" value={dashboardQuery.data?.activeSchools ?? 0} icon={<MessageSquare className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
            <StatCard title="Coût estimé" value={formatFcfa(dashboardQuery.data?.estimatedCostFcfa ?? 0)} icon={<Wallet className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Usage SMS par école</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>École</TableHead>
                      <TableHead>SMS envoyés</TableHead>
                      <TableHead>Quota</TableHead>
                      <TableHead>% utilisé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dashboardQuery.data?.bySchool ?? []).map((row) => (
                      <TableRow key={row.tenantId}>
                        <TableCell>{row.school}</TableCell>
                        <TableCell>{row.sent}</TableCell>
                        <TableCell>{row.quota}</TableCell>
                        <TableCell>{row.usedPct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Écoles proches quota
                </CardTitle>
                <CardDescription>Établissements à 80%+ de leur quota mensuel.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>École</TableHead>
                        <TableHead>Envoyés</TableHead>
                        <TableHead>Quota</TableHead>
                        <TableHead>%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotaAlerts.map((row) => (
                        <TableRow key={row.tenantId}>
                          <TableCell>{row.school}</TableCell>
                          <TableCell>{row.sent}</TableCell>
                          <TableCell>{row.quota}</TableCell>
                          <TableCell>{row.usedPct}%</TableCell>
                        </TableRow>
                      ))}
                      {!dashboardQuery.isLoading && quotaAlerts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Aucun dépassement de seuil détecté.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Répartition par statut</CardTitle>
                <CardDescription>Derniers messages consolidés (global plateforme).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {byStatus.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {!dashboardQuery.isLoading && byStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée de statut SMS.</p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Incidents récents</CardTitle>
              <CardDescription>Derniers SMS en échec pour suivi opérationnel.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>École</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedHistory.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.date).toLocaleString("fr-FR")}</TableCell>
                        <TableCell>{row.school}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.recipientMasked}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{row.message}</TableCell>
                      </TableRow>
                    ))}
                    {!dashboardQuery.isLoading && failedHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">
                          Aucun incident SMS sur les dernières entrées.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Gouvernance plateforme
                </CardTitle>
                <CardDescription>Responsabilités du menu SMS & Notifs (niveau EduTrack).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. Pilotage fournisseur SMS, clés API et sécurité des secrets.</p>
                <p>2. Suivi qualité global (délivrabilité, incidents, files d&apos;attente).</p>
                <p>3. Contrôle des coûts et de la consommation multi-écoles.</p>
                <p>4. Journal d&apos;actions admin sur la couche SMS.</p>
                <p>5. Paramètres d&apos;alerting plateforme (seuils quota, incidents, indisponibilité).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top types de messages</CardTitle>
                <CardDescription>Distribution des types observés sur l&apos;historique consolidé.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {byType.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{type}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {!dashboardQuery.isLoading && byType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée de type SMS disponible.</p>
                ) : null}
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      {dashboardQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les données SMS.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
