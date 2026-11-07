import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Link } from "react-router-dom"
import { CalendarDays, ChevronDown, ChevronRight, WalletCards } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { businessToday, daysUntil, formatAcademicDate } from "@/shared/lib/academic-calendar"
import { formatFcfa, formatFcfaBalance, formatMillionsFcfa } from "@/shared/utils/formatting"
import {
  calculateFinancialBalances,
  calculateToDateBalance,
  PAYMENT_METHOD_COLORS,
  recoveryProgressValue,
  recoveryRatePercent,
  recoveryTone,
  type RecoveryTone,
} from "../financial-dashboard.helpers"
import {
  fetchClassStudentsStatus,
  fetchFinancialSummary,
  type ClassFinancialSummaryRow,
  type ClassStudentStatusRow,
  type FinancialCollectionPoint,
  type FinancialAgingBucket,
  type FinancialRecentPayment,
  type FinancialPaymentMethodSummary,
  type FinancialUpcomingInstallment,
  type LevelFinancialSummaryRow,
  type PaymentMethod,
} from "../finance.api"
import { FINANCE_PATHS } from "../finance.routes"

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
}

const methodDotClasses: Record<PaymentMethod, string> = {
  cash: "bg-primary",
  mobile_money: "bg-[var(--stat-success-fg)]",
  bank_transfer: "bg-[var(--stat-warning-fg)]",
}

const recoveryToneClasses: Record<RecoveryTone, { text: string; badge: string; progress: string }> = {
  success: {
    text: "text-green-700",
    badge: "border-green-200 bg-green-50 text-green-800",
    progress: "[&>div]:bg-green-700",
  },
  warning: {
    text: "text-amber-800",
    badge: "border-amber-200 bg-amber-50 text-amber-900",
    progress: "[&>div]:bg-amber-700",
  },
  danger: {
    text: "text-red-700",
    badge: "border-red-200 bg-red-50 text-red-800",
    progress: "[&>div]:bg-red-700",
  },
}

const formatMonth = (monthKey: string): string =>
  new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" })
    .format(new Date(`${monthKey}-01T00:00:00Z`))

export function FinancialDashboard({ schoolYearId }: { schoolYearId: string }) {
  const summaryQuery = useQuery({
    queryKey: ["finance", "financial-summary", schoolYearId],
    queryFn: () => fetchFinancialSummary(schoolYearId),
  })
  const school = summaryQuery.data?.school ?? null

  if (summaryQuery.isLoading) return <FinancialDashboardSkeleton />
  if (summaryQuery.isError) {
    return (
      <QueryErrorState
        message="Impossible de charger la vue financière."
        onRetry={() => void summaryQuery.refetch()}
        isRetrying={summaryQuery.isFetching}
      />
    )
  }

  const expectedToDate = Number(school?.total_expected_to_date ?? 0)
  const totalPaid = Number(school?.total_paid ?? 0)
  const annualTotalDue = Number(school?.annual_total_due ?? 0)
  const balances = calculateFinancialBalances({
    expectedToDate,
    collected: totalPaid,
    annualTotalDue,
  })
  const dateRate = recoveryRatePercent(expectedToDate, totalPaid)
  const annualRate = recoveryRatePercent(annualTotalDue, totalPaid)
  const levels = summaryQuery.data?.levels ?? []

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="border-b-0 px-3 pb-0 pt-3 sm:px-3 sm:pt-3">
            <CardTitle className="text-lg">Synthèse des encaissements</CardTitle>
            <CardDescription>Situation des échéances et de la trésorerie sur l’année scolaire</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-3 xl:grid-cols-2 sm:p-3">
            <section aria-labelledby="to-date-heading" className="space-y-4 rounded-lg bg-muted/40 p-4 sm:p-5">
              <div>
                <h2 id="to-date-heading" className="font-semibold">À ce jour · retards</h2>
                <p className="text-sm text-muted-foreground">Échéances échues, aujourd’hui inclus</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-semibold tabular-nums">{dateRate} %</p>
                <span className="text-sm font-medium text-muted-foreground">à date</span>
                <Progress
                  value={recoveryProgressValue(dateRate)}
                  aria-label={`Taux de recouvrement à date : ${dateRate} %`}
                  className="h-3 flex-1 bg-muted [&>div]:bg-primary"
                />
              </div>
              <div className="space-y-2">
                <AmountLine label="Attendu à date" value={formatFcfa(expectedToDate)} />
                <AmountLine label="Encaissé" value={formatFcfa(totalPaid)} signe="-" />
                <AmountLine
                  label="Impayé à date"
                  value={formatFcfaBalance(balances.overdueToDate)}
                  emphasis
                  emphasisColor="text-red-700"
                  signe="="
                />
              </div>
            </section>

            <section aria-labelledby="annual-heading" className="space-y-4 rounded-lg bg-muted/40 p-4 sm:p-5">
              <div>
                <h2 id="annual-heading" className="font-semibold">Sur l’année · trésorerie</h2>
                <p className="text-sm text-muted-foreground">Total annuel après remises</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-semibold tabular-nums">{annualRate} %</p>
                <span className="text-sm font-medium text-muted-foreground">annuel</span>
                <Progress
                  value={recoveryProgressValue(annualRate)}
                  aria-label={`Taux de recouvrement annuel : ${annualRate} %`}
                  className="h-3 flex-1 bg-muted [&>div]:bg-primary"
                />
              </div>
              <div className="space-y-2">
                <AmountLine label="Total annuel à encaisser" value={formatFcfa(annualTotalDue)} />
                <AmountLine label="Encaissé" value={formatFcfa(totalPaid)} signe="-" />
                <AmountLine
                  label="Solde annuel restant"
                  value={formatFcfaBalance(balances.annualRemaining)}
                  emphasis
                  signe="="
                />
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                  Dont impayé à date {formatFcfaBalance(balances.overdueToDate)} + à venir{" "}
                  {formatFcfaBalance(balances.upcomingDue)}
                </p>
              </div>
            </section>
          </CardContent>
        </Card>

        <UpcomingInstallments
          rows={summaryQuery.data?.upcomingInstallments ?? []}
          scheduleComplete={summaryQuery.data?.installmentScheduleComplete ?? false}
        />
      </section>

      <FinancialVisuals
        collections={summaryQuery.data?.collections ?? []}
        paymentMethods={summaryQuery.data?.paymentMethods ?? []}
      />
      <AgreementMetrics metrics={summaryQuery.data?.agreementMetrics ?? null} />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <LevelRecovery levels={levels} classes={summaryQuery.data?.classes ?? []} />
        <InstallmentAging buckets={summaryQuery.data?.aging ?? null} />
      </section>
      <RecentPayments rows={summaryQuery.data?.recentPayments ?? []} schoolYearId={schoolYearId} />
    </div>
  )
}

function AgreementMetrics({ metrics }: { metrics: { activeOverrides: number; activeDiscounts: number; activeSchedules: number; lateSchedules: number; lateScheduleRemaining: number } | null }) {
  if (!metrics) return null
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Suivi des accords individuels"><Link to={`${FINANCE_PATHS.agreements}?kind=overrides&status=active`} className="rounded-lg border p-4 transition-colors hover:bg-muted/50"><p className="text-sm text-muted-foreground">Ajustements/Remises actifs</p><p className="mt-1 text-2xl font-semibold tabular-nums">{metrics.activeOverrides}</p><p className="mt-1 text-xs text-muted-foreground">Remises : {formatFcfa(metrics.activeDiscounts)}</p></Link><Link to={`${FINANCE_PATHS.agreements}?kind=schedules&status=active`} className="rounded-lg border p-4 transition-colors hover:bg-muted/50"><p className="text-sm text-muted-foreground">Échéanciers actifs</p><p className="mt-1 text-2xl font-semibold tabular-nums">{metrics.activeSchedules}</p><p className="mt-1 text-xs text-muted-foreground">Calendriers suivis à date</p></Link><Link to={`${FINANCE_PATHS.agreements}?kind=schedules&status=active`} className="rounded-lg border p-4 transition-colors hover:bg-muted/50"><p className="text-sm text-muted-foreground">Échéanciers négociés en retard</p><p className="mt-1 text-2xl font-semibold tabular-nums">{metrics.lateSchedules}</p><p className="mt-1 text-xs text-muted-foreground">Selon le moteur financier</p></Link><Link to={`${FINANCE_PATHS.agreements}?kind=schedules&status=active`} className="rounded-lg border p-4 transition-colors hover:bg-muted/50"><p className="text-sm text-muted-foreground">Solde des échéanciers en retard</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatFcfa(metrics.lateScheduleRemaining)}</p><p className="mt-1 text-xs text-muted-foreground">Montant restant à recouvrer</p></Link></section>
}

function AmountLine({
  label,
  value,
  emphasis = false,
  emphasisColor,
  signe,
}: {
  label: string
  value: string
  emphasis?: boolean
  emphasisColor?: string
  signe?: " " | "-" | "=" 
}) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-border/70 py-2 last:border-0 ${emphasis ? "font-semibold" : ""}`}> 
      <span className={emphasis ? (emphasisColor || "text-foreground text-sm") : "text-muted-foreground text-sm"}>{signe ? <span className="mr-1">{signe}</span> : <span className="m-[0.4rem]"></span>}{label}</span>
      <span className={`text-right tabular-nums text-sm ${emphasis ? (emphasisColor || "text-foreground") : "text-muted-foreground"}`}>{value}</span>
    </div>
  )
}

function FinancialVisuals({
  collections,
  paymentMethods,
}: {
  collections: FinancialCollectionPoint[]
  paymentMethods: FinancialPaymentMethodSummary[]
}) {
  const collectionData = collections.map((item) => ({
    ...item,
    month: formatMonth(item.month_key),
    amount: Number(item.total_paid),
  }))
  const methodData = paymentMethods
    .filter((item) => Number(item.total_paid) > 0)
    .map((item) => ({ ...item, amount: Number(item.total_paid), label: methodLabels[item.method] }))
  const methodsTotal = methodData.reduce((total, item) => total + item.amount, 0)

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <Card className="rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Montants encaissés</CardTitle>
          <CardDescription>Encaissements confirmés, mois par mois sur l’année scolaire</CardDescription>
        </CardHeader>
        <CardContent>
          {collectionData.some((item) => item.amount > 0) ? (
            <>
              <div className="mt-3 h-72" role="img" aria-label="Barres des encaissements confirmés par mois">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={1}
                  minHeight={1}
                  initialDimension={{ width: 1, height: 1 }}
                >
                  <BarChart data={collectionData} margin={{ top: 12, right: 16, left: 8, bottom: 12 }} accessibilityLayer>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={52}
                      tickMargin={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(value) => formatMillionsFcfa(Number(value))}
                      tickLine={false}
                      axisLine={false}
                      width={82}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => formatFcfa(Number(value))}
                      labelFormatter={(label) => `Mois de ${label}`}
                    />
                    <Bar dataKey="amount" name="Encaissé" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only" aria-label="Tableau des encaissements mensuels">
                <caption>Montant encaissé par mois, en FCFA</caption>
                <thead><tr><th scope="col">Mois</th><th scope="col">Encaissé</th></tr></thead>
                <tbody>
                  {collectionData.map((item) => (
                    <tr key={item.month_key}><th scope="row">{item.month}</th><td>{formatFcfa(item.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <EmptyState
              icon={WalletCards}
              title="Aucun encaissement sur la période"
              message="Les paiements confirmés apparaîtront ici au fil des mois."
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Répartition des encaissements</CardTitle>
          <CardDescription> Par mode de paiement</CardDescription>
        </CardHeader>
        <CardContent>
          {methodData.length > 0 ? (
            <div className="space-y-4">
              <div className="relative h-52" role="img" aria-label={`Répartition des paiements, total ${formatFcfa(methodsTotal)}`}>
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={1}
                  minHeight={1}
                  initialDimension={{ width: 1, height: 1 }}
                >
                  <PieChart>
                    <Tooltip formatter={(value) => formatFcfa(Number(value))} />
                    <Pie
                      data={methodData}
                      dataKey="amount"
                      nameKey="label"
                      innerRadius={54}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {methodData.map((item) => (
                        <Cell key={item.method} fill={PAYMENT_METHOD_COLORS[item.method]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-xs font-semibold tabular-nums">{formatFcfa(methodsTotal)}</span>
                </div>
              </div>
              <ul className="space-y-2">
                {methodData.map((item) => {
                  const share = methodsTotal > 0 ? Math.round((item.amount / methodsTotal) * 100) : 0
                  return (
                    <li key={item.method} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${methodDotClasses[item.method]}`} aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="font-medium tabular-nums">{share} %</span>
                      <span className="text-right tabular-nums">{formatFcfa(item.amount)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon={WalletCards}
              title="Aucun mode de paiement renseigné"
              message="La répartition apparaîtra dès le premier paiement confirmé."
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function UpcomingInstallments({
  rows,
  scheduleComplete,
}: {
  rows: FinancialUpcomingInstallment[]
  scheduleComplete: boolean
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-none">
        <div>
          <CardTitle className="text-lg">Prochaines échéances</CardTitle>
          <CardDescription>Versements attendus à venir</CardDescription>
        </div>
        <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {!scheduleComplete ? (
          <p role="status" className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Certains échéanciers sont absents ou incomplets. Les montants affichés sont partiels.
          </p>
        ) : null}
        {rows.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {rows.map((row) => {
              const dayCount = daysUntil(row.due_date, businessToday())
              const isOverdue = dayCount !== null && dayCount < 0
              const isSoon = dayCount !== null && dayCount <= 7
              const countdown = dayCount === null
                ? "Date indisponible"
                : isOverdue
                  ? `Dépassée depuis ${Math.abs(dayCount)} jour${Math.abs(dayCount) > 1 ? "s" : ""}`
                  : dayCount === 0
                    ? "Aujourd’hui"
                    : `Dans ${dayCount} jour${dayCount > 1 ? "s" : ""}`
              const tone = isOverdue
                ? "border-red-200 bg-red-50 text-red-800"
                : isSoon
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-border bg-muted/50 text-muted-foreground"

              return (
                <div key={row.due_date} className="grid grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)] items-center gap-3 px-3 py-3 sm:grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)_auto]">
                  <span className="rounded-md bg-muted px-2 py-2 text-center text-xs font-semibold">
                    {formatAcademicDate(row.due_date)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{formatFcfa(Number(row.expected_amount))}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.student_count} élève{row.student_count > 1 ? "s" : ""} concerné{row.student_count > 1 ? "s" : ""}
                    </span>
                  </span>
                  <Badge variant="outline" className={`col-span-2 w-fit sm:col-span-1 ${tone}`}>
                    {countdown}
                  </Badge>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="pt-2 text-sm text-muted-foreground">
            {scheduleComplete
              ? "Aucune autre échéance enregistrée."
              : "Aucune échéance exploitable pour les dossiers incomplets."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function InstallmentAging({ buckets }: { buckets: FinancialAgingBucket[] | null }) {
  const labels: Record<FinancialAgingBucket["bucket"], string> = {
    "0-30": "0–30 jours",
    "31-60": "31–60 jours",
    ">60": "Plus de 60 jours",
  }
  const colors: Record<FinancialAgingBucket["bucket"], string> = {
    "0-30": "[&>div]:bg-amber-600",
    "31-60": "[&>div]:bg-orange-700",
    ">60": "[&>div]:bg-red-700",
  }
  const bucketByKey = new Map((buckets ?? []).map((bucket) => [bucket.bucket, bucket]))
  const completeBuckets = (["0-30", "31-60", ">60"] as const)
    .map((key) => bucketByKey.get(key))
    .filter((bucket): bucket is FinancialAgingBucket => bucket !== undefined)
  const totalOverdue = completeBuckets.reduce((sum, bucket) => sum + Number(bucket.total_amount), 0)

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Ancienneté des impayés</CardTitle>
        <CardDescription>Soldes échus, paiements affectés du plus ancien au plus récent</CardDescription>
      </CardHeader>
      <CardContent>
        {buckets !== null && completeBuckets.length === 3 ? (
          <div className="space-y-5 p-3">
            {completeBuckets.map((bucket) => {
              const amount = Number(bucket.total_amount)
              const share = totalOverdue > 0 ? (amount / totalOverdue) * 100 : 0
              return (
                <div key={bucket.bucket} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-sm">{labels[bucket.bucket]}</span>
                    <span className="text-right text-sm font-semibold tabular-nums">{formatFcfa(amount)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={share}
                      aria-label={`${labels[bucket.bucket]} : ${formatFcfa(amount)}`}
                      className={`h-2 flex-1 bg-muted ${colors[bucket.bucket]}`}
                    />
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      {bucket.student_count} élève{bucket.student_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Calcul indisponible : certains dossiers n’ont pas d’échéancier complet pour cette année.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RecentPayments({
  rows,
  schoolYearId,
}: {
  rows: FinancialRecentPayment[]
  schoolYearId: string
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-none">
        <div>
          <CardTitle className="text-lg">Derniers encaissements</CardTitle>
          <CardDescription>Paiements confirmés récemment</CardDescription>
        </div>
        <Button asChild type="button" variant="ghost" size="sm" className="min-h-12 text-primary">
          <Link to={FINANCE_PATHS.history}>Voir tout</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table aria-label="Derniers encaissements">
              <TableHeader>
                <TableRow>
                  <TableHead>Date de paiement</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Classe · mode</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead><span className="sr-only">Détail financier</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.payment_id}>
                    <TableCell className="whitespace-nowrap">{formatAcademicDate(row.payment_date)}</TableCell>
                    <TableCell>
                      <span className="block font-medium">{row.student_name}</span>
                      <span className="text-xs text-muted-foreground">{row.student_matricule ?? "Sans matricule"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block">{row.class_name ?? "Classe non renseignée"}</span>
                      <span className="text-xs text-muted-foreground">{methodLabels[row.method]}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.receipt_number ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                        Confirmé
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{formatFcfa(Number(row.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild type="button" variant="outline" size="sm" className="min-h-10 whitespace-nowrap">
                        <Link to={`${FINANCE_PATHS.historyDetail(row.student_id)}?schoolYearId=${schoolYearId}`}>
                          Détail financier
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun encaissement confirmé pour cette année.</p>
        )}
      </CardContent>
    </Card>
  )
}

function LevelRecovery({
  levels,
  classes,
}: {
  levels: LevelFinancialSummaryRow[]
  classes: ClassFinancialSummaryRow[]
}) {
  const [openLevelId, setOpenLevelId] = useState<string | null>(null)
  const rankedLevels = useMemo(
    () => [...levels].sort((a, b) => {
      const balanceA = calculateToDateBalance(a.total_expected_to_date, a.total_paid)
      const balanceB = calculateToDateBalance(b.total_expected_to_date, b.total_paid)
      return b.students_late_count - a.students_late_count || balanceB - balanceA
    }),
    [levels],
  )

  if (rankedLevels.length === 0) {
    return (
      <EmptyState
        icon={WalletCards}
        title="Pas encore de données financières"
        message="La répartition par niveau apparaîtra dès que les paiements seront enregistrés et le cache recalculé."
      />
    )
  }

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between border-none">
        <div>
          <CardTitle>Recouvrement par niveau</CardTitle>
          <CardDescription>Taux à date par niveau, puis détail par classe à l’ouverture.</CardDescription>
        </div>
        <Button asChild type="button" variant="ghost" size="sm" className="min-h-12 text-primary">
          <Link to={FINANCE_PATHS.recovery}>Voir le recouvrement détaillé</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rankedLevels.map((level) => {
          const isOpen = openLevelId === level.level_id
          const rate = recoveryRatePercent(level.total_expected_to_date, level.total_paid)
          const balance = calculateToDateBalance(level.total_expected_to_date, level.total_paid)
          const tone = recoveryToneClasses[recoveryTone(rate)]
          const levelClasses = classes.filter((item) => item.level_id === level.level_id)

          return (
            <div key={level.level_id} className="rounded-lg border border-border">
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-16 w-full justify-start rounded-lg p-4 text-left hover:bg-muted/50"
                aria-expanded={isOpen}
                onClick={() => setOpenLevelId((current) => current === level.level_id ? null : level.level_id)}
              >
                <span className="grid w-full gap-3 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{level.level_name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {levelClasses.length} classe{levelClasses.length > 1 ? "s" : ""} · {level.students_late_count} élève{level.students_late_count > 1 ? "s" : ""} en retard
                    </span>
                  </span>
                  <span className="space-y-1.5">
                    <span className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{formatFcfa(Number(level.total_paid))} encaissés</span>
                      <span className="font-medium">{rate} % à date</span>
                    </span>
                    <Progress
                      value={recoveryProgressValue(rate)}
                      aria-label={`Taux de recouvrement à date ${level.level_name} : ${rate} %`}
                      className={`h-2 bg-muted ${tone.progress}`}
                    />
                  </span>
                  <span className="flex items-center justify-between gap-3 sm:justify-end">
                    <Badge variant="outline" className={tone.badge}>
                      {formatFcfaBalance(balance)} impayés à date
                    </Badge>
                    {isOpen
                      ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </span>
                </span>
              </Button>
              {isOpen ? <LevelClasses classes={levelClasses} /> : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function LevelClasses({ classes }: { classes: ClassFinancialSummaryRow[] }) {
  const [openClassId, setOpenClassId] = useState<string | null>(null)
  if (classes.length === 0) {
    return <div className="border-t px-4 py-3 text-sm text-muted-foreground">Aucune classe active pour ce niveau.</div>
  }

  return (
    <div className="space-y-2 border-t bg-muted/20 p-3">
      {classes.map((item) => {
        const isOpen = openClassId === item.class_id
        const rate = recoveryRatePercent(item.total_expected_to_date, item.total_paid)
        const balance = calculateToDateBalance(item.total_expected_to_date, item.total_paid)
        const tone = recoveryToneClasses[recoveryTone(rate)]

        return (
          <div key={item.class_id} className="rounded-lg border bg-card">
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-12 w-full justify-start rounded-lg px-3 py-2 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpenClassId((current) => current === item.class_id ? null : item.class_id)}
            >
              <span className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <span className="min-w-0 truncate font-medium">{item.class_name}</span>
                <span className="text-xs font-medium">{rate} % à date</span>
                <span className={`text-xs font-medium tabular-nums ${tone.text}`}>
                  · {formatFcfaBalance(balance)} impayés
                </span>
              </span>
              {isOpen
                ? <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="ml-2 h-4 w-4 text-muted-foreground" />}
            </Button>
            {isOpen ? <ClassStudentsDrillDown classId={item.class_id} /> : null}
          </div>
        )
      })}
    </div>
  )
}

function ClassStudentsDrillDown({ classId }: { classId: string }) {
  const studentsQuery = useQuery({
    queryKey: ["finance", "class-students-status", classId],
    queryFn: () => fetchClassStudentsStatus(classId),
  })

  if (studentsQuery.isLoading) {
    return <div className="flex items-center gap-2 border-t px-3 py-4 text-sm text-muted-foreground">Chargement des élèves…</div>
  }
  if (studentsQuery.isError) {
    return (
      <div className="border-t p-3">
        <QueryErrorState
          message="Impossible de charger les élèves de cette classe."
          onRetry={() => void studentsQuery.refetch()}
          isRetrying={studentsQuery.isFetching}
        />
      </div>
    )
  }
  if ((studentsQuery.data?.length ?? 0) === 0) {
    return <div className="border-t px-3 py-4 text-sm text-muted-foreground">Aucun élève avec un statut financier calculé.</div>
  }

  return (
    <div className="overflow-x-auto border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Élève</TableHead>
            <TableHead>Statut à l’échéance</TableHead>
            <TableHead className="text-right">Impayé à date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(studentsQuery.data ?? []).map((student: ClassStudentStatusRow) => {
            const overdue = Number(student.total_expected_to_date) - Number(student.total_paid)
            return (
              <TableRow key={student.student_id}>
                <TableCell>
                  <span className="block font-medium">{student.full_name}</span>
                  <span className="text-xs text-muted-foreground">{student.matricule ?? "Sans matricule"}</span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={student.status === "up_to_date"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"}
                  >
                    {student.status === "up_to_date"
                      ? "À jour"
                      : `Retard${student.days_late !== null ? ` · ${student.days_late} jour(s)` : ""}`}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatFcfaBalance(overdue)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function FinancialDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
