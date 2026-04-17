import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, ChevronLeft, ChevronRight, Download, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import {
  computeSalaries,
  formatMonthLabel,
  getCurrentMonth,
  getExportJobStatus,
  getNextMonth,
  getPreviousMonth,
  getRecentMonthOptions,
  getSalarySummary,
  isFutureMonth,
  queueBulkSalaryExport,
  queueTeacherSalaryExport,
  updateSalaryStatus,
  type SalarySummaryItem,
} from "@/modules/salaries/salaries.api"
import { EmptyState, OfflineIndicator, SalaryRow, StatCard, emptyStateIcons } from "@/shared/components"

const STALE_TIME = 60_000

const formatFcfa = (value: number): string => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`

const toSalaryRowStatus = (value: SalarySummaryItem["status"]): "pending" | "paid" | "disputed" | null => {
  if (value === "pending" || value === "paid" || value === "disputed") {
    return value
  }

  return null
}

function SalaryTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}

export default function SalariesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)
  const [computeDialogOpen, setComputeDialogOpen] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [selectedSalaryRow, setSelectedSalaryRow] = useState<SalarySummaryItem | null>(null)
  const [paymentNotes, setPaymentNotes] = useState("")
  const [exportJobId, setExportJobId] = useState<string | null>(null)
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false)
  const [bulkExportTarget, setBulkExportTarget] = useState<string>("all")
  const [bulkPeriodFrom, setBulkPeriodFrom] = useState(getCurrentMonth)
  const [bulkPeriodTo, setBulkPeriodTo] = useState(getCurrentMonth)

  const monthOptions = useMemo(() => getRecentMonthOptions(getCurrentMonth(), 18), [])

  const salarySummaryQuery = useQuery({
    queryKey: ["salaries", "summary", selectedMonth],
    queryFn: () => getSalarySummary(selectedMonth),
    staleTime: STALE_TIME,
  })

  const exportJobQuery = useQuery({
    queryKey: ["salaries", "export-job", exportJobId],
    queryFn: () => getExportJobStatus(exportJobId ?? ""),
    enabled: Boolean(exportJobId),
    staleTime: 0,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      if (!state) {
        return 2000
      }

      return state === "done" || state === "failed" ? false : 2000
    },
  })

  const computeMutation = useMutation({
    mutationFn: () => computeSalaries(selectedMonth),
    onSuccess: async (result) => {
      setComputeDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["salaries", "summary", selectedMonth] })
      toast({
        title: "Calcul terminé",
        description: `${result.updatedCount} fiche(s) salaire recalculée(s).`,
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de recalculer les salaires.",
        variant: "destructive",
      })
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: (input: { recordId: string; notes?: string }) =>
      updateSalaryStatus({
        recordId: input.recordId,
        status: "paid",
        notes: input.notes,
      }),
    onSuccess: async () => {
      setPayDialogOpen(false)
      setSelectedSalaryRow(null)
      setPaymentNotes("")
      await queryClient.invalidateQueries({ queryKey: ["salaries", "summary", selectedMonth] })
      toast({ title: "Salaire marqué comme payé" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut du salaire.",
        variant: "destructive",
      })
    },
  })

  const exportBulkMutation = useMutation({
    mutationFn: (input: { periodFrom: string; periodTo: string; teacherId?: string }) =>
      queueBulkSalaryExport(input),
    onSuccess: ({ jobId }) => {
      setExportJobId(jobId)
      setBulkExportDialogOpen(false)
      toast({
        title: "Export lancé",
        description: "Le bilan multi-période est en cours de génération.",
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de lancer l'export du bilan.",
        variant: "destructive",
      })
    },
  })

  const exportTeacherMutation = useMutation({
    mutationFn: (teacherId: string) => queueTeacherSalaryExport(teacherId, selectedMonth),
    onSuccess: ({ jobId }) => {
      setExportJobId(jobId)
      toast({ title: "Export professeur lancé" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de lancer l'export du professeur.",
        variant: "destructive",
      })
    },
  })

  const items = salarySummaryQuery.data?.items ?? []

  const vacataireRows = useMemo(
    () => items.filter((item) => item.teacherType === "vacataire"),
    [items]
  )

  const permanentRows = useMemo(
    () => items.filter((item) => item.teacherType === "permanent" || item.status === "Salaire fixe"),
    [items]
  )

  const totalPending = useMemo(
    () =>
      vacataireRows.reduce((acc, row) => {
        if (row.status !== "pending") {
          return acc
        }

        return acc + (row.totalFcfa ?? 0)
      }, 0),
    [vacataireRows]
  )

  const totalPaid = useMemo(
    () =>
      vacataireRows.reduce((acc, row) => {
        if (row.status !== "paid") {
          return acc
        }

        return acc + (row.totalFcfa ?? 0)
      }, 0),
    [vacataireRows]
  )

  const isSelectedMonthFuture = isFutureMonth(selectedMonth)
  const teacherOptions = useMemo(
    () => items.map((item) => ({ id: item.teacherId, label: item.teacherName })),
    [items]
  )

  const openMarkPaidDialog = (row: SalarySummaryItem) => {
    if (!row.salaryRecordId) {
      toast({
        title: "Action indisponible",
        description: "Ce salaire doit être calculé avant d'être marqué payé.",
        variant: "destructive",
      })
      return
    }

    setSelectedSalaryRow(row)
    setPaymentNotes("")
    setPayDialogOpen(true)
  }

  useEffect(() => {
    const state = exportJobQuery.data?.state
    if (!exportJobId || !state) {
      return
    }

    if (state !== "done" && state !== "failed") {
      return
    }

    const timer = window.setTimeout(() => {
      setExportJobId(null)
    }, 8000)

    return () => window.clearTimeout(timer)
  }, [exportJobId, exportJobQuery.data?.state])

  return (
    <>
      <OfflineIndicator />

      <div className="space-y-6 animate-fade-in" data-testid="salaries-page">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Gestion des salaires</h1>
              <p className="text-sm text-muted-foreground">Pilotage mensuel des paies vacataires</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth((current) => getPreviousMonth(current))}
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[210px]" data-testid="salaries-month-select-trigger">
                    <SelectValue placeholder="Sélectionner un mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatMonthLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth((current) => getNextMonth(current))}
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button
                type="button"
                onClick={() => setComputeDialogOpen(true)}
                disabled={isSelectedMonthFuture || computeMutation.isPending}
                data-testid="salaries-compute-button"
              >
                Calculer les salaires
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  exportBulkMutation.mutate({
                    periodFrom: selectedMonth,
                    periodTo: selectedMonth,
                    teacherId: undefined,
                  })
                }
                disabled={exportBulkMutation.isPending}
                data-testid="salaries-export-school-button"
              >
                Export bilan PDF
              </Button>
            </div>
          </div>

          {isSelectedMonthFuture ? (
            <p className="text-sm text-amber-700">Le calcul est désactivé pour un mois futur.</p>
          ) : null}

          {exportJobId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm" data-testid="salaries-export-job-panel">
              <Badge variant="outline">Job export: {exportJobId}</Badge>
              <Badge
                variant="outline"
                className={cn(
                  exportJobQuery.data?.state === "failed" ? "border-red-200 bg-red-50 text-red-700" : "",
                  exportJobQuery.data?.state === "done" ? "border-green-200 bg-green-50 text-green-700" : ""
                )}
              >
                {exportJobQuery.data?.state === "done"
                  ? "Terminé"
                  : exportJobQuery.data?.state === "failed"
                    ? "Échec"
                    : "Génération en cours"}
              </Badge>

              {exportJobQuery.data?.downloadUrl ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    window.open(exportJobQuery.data?.downloadUrl ?? "", "_blank", "noopener,noreferrer")
                    setExportJobId(null)
                  }}
                >
                    <Download className="mr-2 h-4 w-4" />
                    <span data-testid="salaries-export-download-link">Télécharger</span>
                </Button>
              ) : null}

              {exportJobQuery.data?.state === "running" || exportJobQuery.data?.state === "queued" ? (
                <span className="text-xs text-muted-foreground">
                  Merci de patienter, le fichier sera téléchargeable automatiquement dès qu&apos;il est prêt.
                </span>
              ) : null}

              {!exportJobQuery.data?.downloadUrl && exportJobQuery.data?.state === "done" ? (
                <span className="text-xs text-muted-foreground">PDF généré, URL non fournie par l'API.</span>
              ) : null}

              {exportJobQuery.data?.state === "failed" ? (
                <span className="text-xs text-red-700">{exportJobQuery.data.failedReason ?? "Erreur inconnue"}</span>
              ) : null}
            </div>
          ) : null}
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            title="Total à payer"
            value={formatFcfa(totalPending)}
            subtitle="Somme des salaires pending"
            icon={<Wallet className="h-4 w-4" />}
            variant="warning"
            loading={salarySummaryQuery.isLoading}
          />
          <StatCard
            title="Total payé"
            value={formatFcfa(totalPaid)}
            subtitle="Somme des salaires paid"
            icon={<Download className="h-4 w-4" />}
            variant="success"
            loading={salarySummaryQuery.isLoading}
          />
          <StatCard
            title="Profs vacataires"
            value={vacataireRows.length}
            subtitle="Population variable du mois"
            icon={<CalendarDays className="h-4 w-4" />}
            variant="default"
            loading={salarySummaryQuery.isLoading}
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6" data-testid="salaries-vacataire-section">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Salaires vacataires</h2>
            <Badge variant="outline">{vacataireRows.length} ligne(s)</Badge>
          </div>

          {salarySummaryQuery.isLoading ? (
            <SalaryTableSkeleton />
          ) : vacataireRows.length === 0 ? (
            <EmptyState
              icon={emptyStateIcons.noTeachers}
              title="Aucun salaire vacataire"
              message="Aucune donnée vacataire disponible pour ce mois."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="salaries-vacataire-table">
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
                  {vacataireRows.map((row) => {
                    const status = toSalaryRowStatus(row.status)
                    if (!status) {
                      return null
                    }

                    return (
                      <SalaryRow
                        key={row.teacherId}
                        dataTestIdPrefix="salary-vacataire"
                        teacher={{
                          id: row.teacherId,
                          name: row.teacherName,
                          type: row.teacherType,
                        }}
                        periodSummary={{
                          hoursDone: row.hoursDone,
                          hoursPlanned: row.hoursPlanned,
                          amountFcfa: row.totalFcfa ?? 0,
                          status,
                          canMarkPaid: Boolean(row.salaryRecordId),
                        }}
                        onMarkPaid={() => openMarkPaidDialog(row)}
                        onExportPDF={() => exportTeacherMutation.mutate(row.teacherId)}
                      />
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Salaires fixes</h2>
            <Badge variant="outline">{permanentRows.length} permanent(s)</Badge>
          </div>

          {permanentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun professeur permanent pour ce mois.</p>
          ) : (
            <div className="space-y-2">
              {permanentRows.map((row) => (
                <div
                  key={row.teacherId}
                  className="animate-fade-in flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{row.teacherName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.hoursDone}h réalisées / {row.hoursPlanned}h prévues
                    </p>
                  </div>
                  <Badge variant="outline">Salaire fixe</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={computeDialogOpen} onOpenChange={setComputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le calcul</DialogTitle>
            <DialogDescription>
              Cette action va recalculer tous les salaires du mois sélectionné ({formatMonthLabel(selectedMonth)}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setComputeDialogOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => computeMutation.mutate()} disabled={computeMutation.isPending} data-testid="salaries-compute-confirm-button">
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme payé</DialogTitle>
            <DialogDescription>
              {selectedSalaryRow
                ? `Confirmer le paiement de ${selectedSalaryRow.teacherName} (${formatFcfa(selectedSalaryRow.totalFcfa ?? 0)}).`
                : "Confirmer le paiement de ce salaire."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="salary-notes" className="text-sm font-medium">
              Notes (optionnel)
            </label>
            <Input
              id="salary-notes"
              placeholder="Ex: Virement effectué le 5 du mois"
              value={paymentNotes}
              onChange={(event) => setPaymentNotes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!selectedSalaryRow?.salaryRecordId) {
                  return
                }

                markPaidMutation.mutate({
                  recordId: selectedSalaryRow.salaryRecordId,
                  notes: paymentNotes,
                })
              }}
              disabled={markPaidMutation.isPending || !selectedSalaryRow?.salaryRecordId}
            >
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkExportDialogOpen} onOpenChange={setBulkExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exporter le bilan</DialogTitle>
            <DialogDescription>
              Choisissez un professeur (ou tous) et la période à exporter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="bulk-export-target" className="text-sm font-medium">
                Pour
              </label>
              <Select value={bulkExportTarget} onValueChange={setBulkExportTarget}>
                <SelectTrigger id="bulk-export-target">
                  <SelectValue placeholder="Tous les professeurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les professeurs</SelectItem>
                  {teacherOptions.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="bulk-period-from" className="text-sm font-medium">
                  Période de
                </label>
                <Input
                  id="bulk-period-from"
                  type="month"
                  value={bulkPeriodFrom}
                  onChange={(event) => setBulkPeriodFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="bulk-period-to" className="text-sm font-medium">
                  à
                </label>
                <Input
                  id="bulk-period-to"
                  type="month"
                  value={bulkPeriodTo}
                  onChange={(event) => setBulkPeriodTo(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkExportDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                const teacherId = bulkExportTarget === "all" ? undefined : bulkExportTarget
                exportBulkMutation.mutate({
                  periodFrom: bulkPeriodFrom,
                  periodTo: bulkPeriodTo,
                  teacherId,
                })
              }}
              disabled={
                exportBulkMutation.isPending ||
                bulkPeriodFrom.length !== 7 ||
                bulkPeriodTo.length !== 7 ||
                bulkPeriodFrom > bulkPeriodTo
              }
            >
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
