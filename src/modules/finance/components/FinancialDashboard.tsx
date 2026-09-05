import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw, WalletCards } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import {
  fetchClassStudentsStatus,
  fetchFinancialSummary,
  type ClassFinancialSummaryRow,
  type ClassStudentStatusRow,
  type FinancialCollectionPoint,
  type FinancialRecentPayment,
  type FinancialPaymentMethodSummary,
  type FinancialUpcomingInstallment,
  type LevelFinancialSummaryRow,
  type PaymentMethod,
} from "../finance.api"

const fcfa = (value: string | number): string => `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(value) || 0))} FCFA`
const percent = (value: string | number): number => Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)))
const recoveryRate = (expected: string | number, paid: string | number): number => {
  const totalExpected = Number(expected) || 0
  return totalExpected <= 0 ? 100 : Math.max(0, Math.min(100, Math.round(((Number(paid) || 0) / totalExpected) * 100)))
}

export function FinancialDashboard({ schoolYearId }: { schoolYearId: string }) {
  const summaryQuery = useQuery({
    queryKey: ["finance", "financial-summary", schoolYearId],
    queryFn: () => fetchFinancialSummary(schoolYearId),
  })
  const school = summaryQuery.data?.school ?? null

  if (summaryQuery.isLoading) return <FinancialDashboardSkeleton />
  if (summaryQuery.isError) return <QueryErrorState message="Impossible de charger la vue financière." onRetry={() => void summaryQuery.refetch()} isRetrying={summaryQuery.isFetching} />

  const expectedToDate = Number(school?.total_expected_to_date ?? 0)
  const totalPaid = Number(school?.total_paid ?? 0)
  const remainingToCollect = Math.max(0, expectedToDate - totalPaid)
  const levels = summaryQuery.data?.levels ?? []

  return <div className="space-y-6">
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
      <Card className="rounded-lg border-0 bg-blue-700 text-blue-50 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-100">Recouvrement de la période</p>
              <p className="text-4xl font-semibold tracking-tight sm:text-5xl">{percent(school?.recovery_rate ?? 0)}%</p>
              <p className="max-w-xl text-sm text-blue-100">{fcfa(totalPaid)} encaissés sur {fcfa(expectedToDate)} attendus.</p>
              <Progress value={percent(school?.recovery_rate ?? 0)} className="mt-4 h-2 bg-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:min-w-80">
              <div className="border-l border-blue-400 pl-4"><p className="text-xs text-blue-100">Attendu</p><p className="mt-1 font-semibold tabular-nums">{fcfa(expectedToDate)}</p></div>
              <div className="border-l border-blue-400 pl-4"><p className="text-xs text-blue-100">Reste à recouvrer</p><p className="mt-1 font-semibold tabular-nums">{fcfa(remainingToCollect)}</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <UpcomingInstallments rows={summaryQuery.data?.upcomingInstallments ?? []} />
    </section>

    <FinancialVisuals collections={summaryQuery.data?.collections ?? []} paymentMethods={summaryQuery.data?.paymentMethods ?? []} />

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"><LevelRecovery levels={levels} classes={summaryQuery.data?.classes ?? []} /><RecentPayments rows={summaryQuery.data?.recentPayments ?? []} /></section>

  </div>
}

const methodLabels: Record<PaymentMethod, string> = { cash: "Espèces", mobile_money: "Mobile Money", bank_transfer: "Virement" }
const methodColors: Record<PaymentMethod, string> = { cash: "hsl(var(--primary))", mobile_money: "hsl(142 71% 45%)", bank_transfer: "hsl(38 92% 50%)" }
const methodDotClasses: Record<PaymentMethod, string> = { cash: "bg-blue-500", mobile_money: "bg-green-500", bank_transfer: "bg-amber-500" }

function FinancialVisuals({ collections, paymentMethods }: { collections: FinancialCollectionPoint[]; paymentMethods: FinancialPaymentMethodSummary[] }) {
  const collectionData = collections.map((item) => ({ ...item, month: new Date(`${item.month_key}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "short" }), amount: Number(item.total_paid) || 0 }))
  const methodData = paymentMethods.filter((item) => Number(item.total_paid) > 0).map((item) => ({ ...item, amount: Number(item.total_paid) || 0, label: methodLabels[item.method] }))
  return <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
    <Card className="rounded-lg shadow-sm"><CardHeader className="pb-3"><CardDescription>Encaissements confirmés</CardDescription><CardTitle>Évolution sur 6 mois</CardTitle></CardHeader><CardContent>{collectionData.some((item) => item.amount > 0) ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={collectionData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} width={42} tick={{ fontSize: 12 }} /><Tooltip formatter={(value) => fcfa(Number(value))} labelFormatter={(label) => `Mois de ${label}`} /><Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="hsl(var(--primary) / 0.16)" /></AreaChart></ResponsiveContainer></div> : <EmptyState icon={WalletCards} title="Aucun encaissement sur la période" message="Les paiements confirmés apparaîtront ici au fil des mois." />}</CardContent></Card>
    <Card className="rounded-lg shadow-sm"><CardHeader className="pb-3"><CardDescription>Répartition des encaissements</CardDescription><CardTitle>Par mode de paiement</CardTitle></CardHeader><CardContent>{methodData.length > 0 ? <div className="space-y-4"><div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip formatter={(value) => fcfa(Number(value))} /><Pie data={methodData} dataKey="amount" nameKey="label" innerRadius={46} outerRadius={70} paddingAngle={3}>{methodData.map((item) => <Cell key={item.method} fill={methodColors[item.method]} />)}</Pie></PieChart></ResponsiveContainer></div><div className="space-y-2">{methodData.map((item) => <div key={item.method} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${methodDotClasses[item.method]}`} />{item.label}</span><span className="font-medium tabular-nums">{fcfa(item.amount)}</span></div>)}</div></div> : <EmptyState icon={WalletCards} title="Aucun mode de paiement renseigné" message="La répartition apparaîtra dès le premier paiement confirmé." />}</CardContent></Card>
  </section>
}

function UpcomingInstallments({ rows }: { rows: FinancialUpcomingInstallment[] }) { return <Card className="rounded-lg shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3 pb-3"><div><CardTitle className="text-lg">Prochaines échéances</CardTitle><CardDescription>Versements attendus à venir</CardDescription></div><CalendarDays className="h-5 w-5 text-blue-700" /></CardHeader><CardContent>{rows.length ? <div className="divide-y rounded-lg border">{rows.map((row) => <div key={row.due_date} className="grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"><span className="rounded-md bg-muted px-2 py-1 text-center text-xs font-semibold">{new Date(`${row.due_date}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{fcfa(row.expected_amount)}</span><span className="block text-xs text-muted-foreground">{row.student_count} élève{row.student_count > 1 ? "s" : ""} concerné{row.student_count > 1 ? "s" : ""}</span></span><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">À venir</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Aucune échéance future n’est configurée.</p>}</CardContent></Card> }

function RecentPayments({ rows }: { rows: FinancialRecentPayment[] }) { return <Card className="rounded-lg shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3 pb-3"><div><CardTitle className="text-lg">Derniers encaissements</CardTitle><CardDescription>Paiements confirmés récemment</CardDescription></div><Button asChild type="button" variant="ghost" size="sm" className="min-h-10 text-blue-700"><Link to="/finance/history">Voir tout</Link></Button></CardHeader><CardContent>{rows.length ? <div className="divide-y rounded-lg border">{rows.map((row) => <div key={`${row.receipt_number ?? row.student_name}-${row.payment_date}`} className="flex items-center gap-3 px-3 py-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700"><CheckCircle2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.student_name}</span><span className="block truncate text-xs text-muted-foreground">{row.class_name ?? "Classe non renseignée"} · {methodLabels[row.method]}</span></span><span className="text-right"><span className="block text-sm font-semibold tabular-nums text-green-700">{fcfa(row.amount)}</span><span className="block text-xs text-muted-foreground">{row.receipt_number ?? "Reçu confirmé"}</span></span></div>)}</div> : <p className="text-sm text-muted-foreground">Aucun encaissement confirmé pour cette année.</p>}</CardContent></Card> }

function LevelRecovery({ levels, classes }: { levels: LevelFinancialSummaryRow[]; classes: ClassFinancialSummaryRow[] }) {
  const [openLevelId, setOpenLevelId] = useState<string | null>(null)
  const rankedLevels = useMemo(() => [...levels].sort((a, b) => {
    const missingA = Math.max(0, Number(a.total_expected_to_date) - Number(a.total_paid))
    const missingB = Math.max(0, Number(b.total_expected_to_date) - Number(b.total_paid))
    return b.students_late_count - a.students_late_count || missingB - missingA
  }), [levels])

  if (rankedLevels.length === 0) return <EmptyState icon={WalletCards} title="Pas encore de données financières" message="La répartition par niveau apparaîtra dès que les paiements seront enregistrés et le cache recalculé." />

  return <Card className="rounded-lg shadow-sm">
    <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Recouvrement par niveau</CardTitle><CardDescription>Une lecture par niveau, puis par classe seulement lorsque vous ouvrez le détail.</CardDescription></div><Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-800">{rankedLevels.length} niveau{rankedLevels.length > 1 ? "x" : ""}</Badge></CardHeader>
    <CardContent className="space-y-2">
      {rankedLevels.map((level) => {
        const isOpen = openLevelId === level.level_id
        const rate = recoveryRate(level.total_expected_to_date, level.total_paid)
        const missing = Math.max(0, Number(level.total_expected_to_date) - Number(level.total_paid))
        const levelClasses = classes.filter((item) => item.level_id === level.level_id)
        return <div key={level.level_id} className="rounded-lg border border-border">
          <Button type="button" variant="ghost" className="h-auto min-h-16 w-full justify-start rounded-lg p-4 text-left hover:bg-muted/50" aria-expanded={isOpen} onClick={() => setOpenLevelId((current) => current === level.level_id ? null : level.level_id)}>
            <span className="grid w-full gap-3 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1fr)_auto] sm:items-center"><span className="min-w-0"><span className="block truncate font-semibold">{level.level_name}</span><span className="mt-1 block text-xs text-muted-foreground">{levelClasses.length} classe{levelClasses.length > 1 ? "s" : ""} · {level.students_late_count} élève{level.students_late_count > 1 ? "s" : ""} en retard</span></span><span className="space-y-1.5"><span className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">{fcfa(level.total_paid)} encaissés</span><span className="font-medium">{rate}%</span></span><Progress value={rate} aria-label={`Recouvrement ${level.level_name}, ${rate}%`} /></span><span className="flex items-center justify-between gap-3 sm:justify-end"><Badge variant="outline" className={level.students_late_count > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-700"}>{missing > 0 ? `${fcfa(missing)} restant` : "À jour"}</Badge>{isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}</span></span>
          </Button>
          {isOpen ? <LevelClasses classes={levelClasses} /> : null}
        </div>
      })}
    </CardContent>
  </Card>
}

function LevelClasses({ classes }: { classes: ClassFinancialSummaryRow[] }) {
  const [openClassId, setOpenClassId] = useState<string | null>(null)
  if (classes.length === 0) return <div className="border-t px-4 py-3 text-sm text-muted-foreground">Aucune classe active pour ce niveau.</div>
  return <div className="space-y-2 border-t bg-muted/20 p-3">{classes.map((item) => {
    const isOpen = openClassId === item.class_id
    const rate = recoveryRate(item.total_expected_to_date, item.total_paid)
    return <div key={item.class_id} className="rounded-lg border bg-card"><Button type="button" variant="ghost" className="h-auto min-h-12 w-full justify-start rounded-lg px-3 py-2 text-left" aria-expanded={isOpen} onClick={() => setOpenClassId((current) => current === item.class_id ? null : item.class_id)}><span className="flex w-full items-center gap-3"><span className="min-w-0 flex-1 truncate font-medium">{item.class_name}</span><span className="text-xs text-muted-foreground">{rate}%</span>{isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</span></Button>{isOpen ? <ClassStudentsDrillDown classId={item.class_id} /> : null}</div>
  })}</div>
}

function ClassStudentsDrillDown({ classId }: { classId: string }) {
  const studentsQuery = useQuery({ queryKey: ["finance", "class-students-status", classId], queryFn: () => fetchClassStudentsStatus(classId) })
  if (studentsQuery.isLoading) return <div className="flex items-center gap-2 border-t px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des élèves…</div>
  if (studentsQuery.isError) return <div className="border-t p-3"><QueryErrorState message="Impossible de charger les élèves de cette classe." onRetry={() => void studentsQuery.refetch()} isRetrying={studentsQuery.isFetching} /></div>
  if ((studentsQuery.data?.length ?? 0) === 0) return <div className="border-t px-3 py-4 text-sm text-muted-foreground">Aucun élève avec un statut financier calculé.</div>
  return <div className="overflow-x-auto border-t"><Table><TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Reste dû</TableHead></TableRow></TableHeader><TableBody>{(studentsQuery.data ?? []).map((student: ClassStudentStatusRow) => {
    const remaining = Math.max(0, Number(student.total_due_year) - Number(student.total_paid))
    return <TableRow key={student.student_id}><TableCell><span className="block font-medium">{student.full_name}</span><span className="text-xs text-muted-foreground">{student.matricule ?? "Sans matricule"}</span></TableCell><TableCell><Badge variant="outline" className={student.status === "up_to_date" ? "border-green-200 bg-green-50 text-green-700" : student.status === "waived" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{student.status === "up_to_date" ? "À jour" : student.status === "waived" ? "Toléré" : `Retard${student.days_late !== null ? ` · ${student.days_late} j` : ""}`}</Badge></TableCell><TableCell className="text-right font-medium tabular-nums">{fcfa(remaining)}</TableCell></TableRow>
  })}</TableBody></Table></div>
}

function FinancialDashboardSkeleton() {
  return <div className="space-y-6"><div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]"><Skeleton className="h-56 rounded-lg" /><Skeleton className="h-56 rounded-lg" /></div><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32 rounded-lg" /><Skeleton className="h-32 rounded-lg" /><Skeleton className="h-32 rounded-lg" /></div><Skeleton className="h-96 rounded-lg" /></div>
}
