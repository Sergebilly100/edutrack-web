import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDownRight, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  fetchClassStudentsStatus,
  fetchFinancialSummary,
  type ClassStudentStatusRow,
} from "../finance.api"

const fcfa = (value: string | number): string =>
  `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(value) || 0))} FCFA`

const pct = (rate: string | number): string => `${Math.round((Number(rate) || 0) * 100)}%`

export function FinancialDashboard() {
  const summaryQuery = useQuery({
    queryKey: ["finance", "financial-summary"],
    queryFn: fetchFinancialSummary,
  })
  const school = summaryQuery.data?.school ?? null

  if (summaryQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded-lg bg-muted lg:col-span-2" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted lg:col-span-3" />
      </div>
    )
  }
  if (summaryQuery.isError) {
    return <p className="text-sm text-red-600">Impossible de charger le résumé financier.</p>
  }

  const recoveryRate = Number(school?.recovery_rate ?? 0)
  const expectedToDate = Number(school?.total_expected_to_date ?? 0)
  const totalPaid = Number(school?.total_paid ?? 0)
  const previousPaid = Number(school?.previous_period_total_paid ?? 0)
  const trendDelta = totalPaid - previousPaid
  const upToDate = school?.students_up_to_date_count ?? 0
  const late = school?.students_late_count ?? 0

  return (
    <div className="space-y-6">
      {/* Carte d'emphase unique (DESIGN.md §10) : fond plein, sans dégradé */}
      <Card className="border-0 rounded-lg bg-blue-700 text-white shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-100">Taux de recouvrement</p>
            <p className="text-5xl font-semibold tracking-tight">{pct(recoveryRate)}</p>
            <p className="text-sm text-blue-100">
              {fcfa(totalPaid)} encaissés sur {fcfa(expectedToDate)} attendus à date
            </p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-blue-500/60">
              <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${Math.round(recoveryRate * 100)}%` }} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-blue-100">
              <ArrowDownRight className="h-3.5 w-3.5" />
              Mois précédent : {fcfa(previousPaid)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Attendu à date" value={fcfa(expectedToDate)} />
        <KpiTile label="Total encaissé" value={fcfa(totalPaid)} />
        <KpiTile label="Élèves à jour" value={String(upToDate)} tone="success" />
        <KpiTile label="Élèves en retard" value={String(late)} tone={late > 0 ? "warning" : "neutral"} />
      </div>

      <ClassRanking />

      {school?.last_computed_at ? (
        <p className="text-xs text-muted-foreground">
          Données recalculées toutes les 15 minutes · dernière mise à jour{" "}
          {new Date(school.last_computed_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      ) : null}
    </div>
  )
}

function KpiTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={
            tone === "success" ? "text-2xl font-semibold text-green-700"
            : tone === "warning" ? "text-2xl font-semibold text-amber-700"
            : "text-2xl font-semibold"
          }
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

/** Classement des classes les plus en retard : liste classée, pas des barres. */
function ClassRanking() {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const summaryQuery = useQuery({
    queryKey: ["finance", "financial-summary"],
    queryFn: fetchFinancialSummary,
  })

  const classes = useMemo(() => {
    const rows = summaryQuery.data?.classes ?? []
    return [...rows]
      .sort((a, b) => {
        const missingA = Math.max(0, Number(a.total_expected_to_date) - Number(a.total_paid))
        const missingB = Math.max(0, Number(b.total_expected_to_date) - Number(b.total_paid))
        return b.students_late_count - a.students_late_count || missingB - missingA
      })
      .slice(0, 8)
  }, [summaryQuery.data])

  if (summaryQuery.isLoading) return null
  if ((summaryQuery.data?.classes.length ?? 0) === 0) {
    return (
      <EmptyState
        title="Pas encore de données financières"
        description="Le classement apparaîtra dès que des paiements seront enregistrés."
      />
    )
  }

  const worst = classes[0] ? Math.max(1, classes[0].students_late_count) : 1

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>Classes les plus en retard</CardTitle>
        <CardDescription>Classement par nombre d&apos;élèves en retard, puis montant manquant.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {classes.map((row, index) => {
            const missing = Math.max(0, Number(row.total_expected_to_date) - Number(row.total_paid))
            // Quantité pure : dégradé de remplissage bleu-100 → blue-600 selon le retard.
            const fillClass =
              row.students_late_count === 0 ? "bg-blue-100"
              : index === 0 ? "bg-blue-600"
              : index === 1 ? "bg-blue-500"
              : index === 2 ? "bg-blue-400"
              : index % 2 === 0 ? "bg-blue-300"
              : "bg-blue-200"
            const widthPct = Math.max(4, Math.round((row.students_late_count / worst) * 100))
            const isOpen = selectedClassId === row.class_id
            return (
              <li key={row.class_id}>
                <button
                  type="button"
                  onClick={() => setSelectedClassId(isOpen ? null : row.class_id)}
                  aria-expanded={isOpen}
                  className="min-h-12 w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-3">
                    <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md ${fillClass} px-1.5 text-xs font-semibold text-blue-950`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.class_name}</span>
                    <span className="relative hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block">
                      <span className={`absolute inset-y-0 left-0 rounded-full ${fillClass}`} style={{ width: `${widthPct}%` }} />
                    </span>
                    {row.students_late_count > 0 ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                        {row.students_late_count} en retard
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                        À jour
                      </Badge>
                    )}
                  </span>
                </button>
                {isOpen ? <ClassStudentsDrillDown classId={row.class_id} /> : null}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ClassStudentsDrillDown({ classId }: { classId: string }) {
  const studentsQuery = useQuery({
    queryKey: ["finance", "class-students-status", classId],
    queryFn: () => fetchClassStudentsStatus(classId),
  })

  return (
    <div className="mt-2 animate-in fade-in duration-200">
      {studentsQuery.isLoading ? (
        <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des élèves…
        </p>
      ) : (studentsQuery.data?.length ?? 0) === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">Aucun élève avec un statut calculé.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Élève</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Reste dû (année)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(studentsQuery.data ?? []).map((student: ClassStudentStatusRow) => {
              const remaining = Math.max(0, Number(student.total_due_year) - Number(student.total_paid))
              return (
                <TableRow key={student.student_id}>
                  <TableCell>
                    <span className="block font-medium">{student.full_name}</span>
                    <span className="text-xs text-muted-foreground">{student.matricule}</span>
                  </TableCell>
                  <TableCell>
                    {student.status === "up_to_date" ? (
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">À jour</Badge>
                    ) : student.status === "waived" ? (
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">Toléré</Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                        En retard{student.days_late !== null ? ` (${student.days_late} j)` : ""}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{fcfa(student.total_paid)}</TableCell>
                  <TableCell className="text-right font-medium">{fcfa(remaining)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
