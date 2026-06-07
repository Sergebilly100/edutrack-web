import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { UseQueryResult } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, emptyStateIcons } from "@/shared/components/EmptyState"
import { SalaryRow } from "@/shared/components/SalaryRow"
import type { DashboardSalarySummary } from "@/modules/dashboard/dashboard.api"

type SalariesTabProps = {
  salarySummaryQuery: UseQueryResult<DashboardSalarySummary, Error>
}

export function SalariesTab({ salarySummaryQuery }: SalariesTabProps) {
  const navigate = useNavigate()

  const salaryRows = useMemo(() => {
    const summaryData = salarySummaryQuery.data
    if (!summaryData) return []

    const items = summaryData.items ?? []
    return items.map((item) => {
      const isPaid = item.status === "paid" && !item.isPartiallyPaid
      const isPartial = item.status === "paid" && item.isPartiallyPaid

      return {
        ...item,
        salaryStatusLabel: isPaid ? "Payé" : isPartial ? "Partiel" : "En attente",
        salaryStatusClassName: isPaid
          ? "border-green-200 bg-green-50 text-green-700"
          : isPartial
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-slate-200 bg-slate-50 text-slate-700",
      }
    })
  }, [salarySummaryQuery.data])

  return (
    <div className="space-y-6">
      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg font-semibold">Résumé salaires du mois</CardTitle>
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <Link to="/salaries">Voir tous les salaires</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {salarySummaryQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Chargement...</p>
              </div>
            ) : salarySummaryQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  Erreur de chargement : {salarySummaryQuery.error?.message ?? "Erreur inconnue"}
                </p>
              </div>
            ) : salaryRows.length === 0 ? (
              <EmptyState
                icon={emptyStateIcons.noTeachers}
                title="Aucune fiche salaire"
                message="Aucune ligne de salaire n'est disponible pour ce mois. Les fiches apparaîtront ici dès que des heures seront enregistrées."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Professeur</TableHead>
                      <TableHead>Progression</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryRows.map((row) => (
                      <SalaryRow
                        key={row.teacherId}
                        teacher={{
                          id: row.teacherId,
                          name: row.teacherName,
                          type: row.teacherType,
                        }}
                        periodSummary={{
                          hoursDone: row.hoursDone,
                          hoursPlanned: row.hoursPlanned,
                          amountFcfa: row.totalFcfa ?? 0,
                          status: row.status === "Salaire fixe" ? "paid" : row.status,
                          statusLabel: row.salaryStatusLabel,
                          statusClassName: row.salaryStatusClassName,
                          canMarkPaid:
                            Boolean(row.salaryRecordId) &&
                            row.hoursDone > 0 &&
                            (row.totalFcfa ?? 0) > 0 &&
                            (row.status === "pending" || (row.status === "paid" && row.isPartiallyPaid)),
                        }}
                        onMarkPaid={() => navigate("/salaries")}
                        onDetails={() => navigate("/salaries")}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
