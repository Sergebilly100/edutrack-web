import { dateRangeIssue, updateDateRange } from "@/shared/lib/date-validation"
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Download, Loader2, MoreHorizontal, ReceiptText } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { listClasses, listLevels } from "@/modules/academic/academic.api"
import { ConfirmActionDialog } from "@/shared/components/ConfirmActionDialog"
import { EmptyState } from "@/shared/components/EmptyState"
import { KeyFigure } from "@/shared/components/KeyFigure"
import { ProgressMeter } from "@/shared/components/ProgressMeter"
import { StatusPill } from "@/shared/components/StatusPill"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { getInitials } from "@/shared/utils/avatar"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { formatFcfa } from "@/shared/utils/formatting"
import { FINANCE_PATHS } from "../finance.routes"
import { buildFinancialGap, formatPaymentDate, hasActiveDiscount, paymentPlural, sortPaymentsMostRecentFirst, summarizeConfirmedPayments } from "../payment-detail.helpers"
import { cancelPayment, getFinancialStatus, getPaymentHistory, getStudentAccountStatement, requestPaymentReceipt, type FinancialCacheStatus, type Payment } from "../finance.api"

const HISTORY_PAGE_SIZE = 20
const isoToday = () => new Date().toISOString().slice(0, 10)
const firstDayOfMonth = () => `${isoToday().slice(0, 8)}01`
const methodLabels: Record<Payment["method"], string> = { cash: "Espèces", mobile_money: "Mobile Money", bank_transfer: "Virement" }
const sourceLabels: Record<Payment["source"], string> = { cashier_manual: "Saisie manuelle", in_app_button: "Paiement en ligne", bulk_import: "Import courant", migration_import: "Solde de départ" }
const statusLabels: Record<FinancialCacheStatus, string> = { up_to_date: "À jour", late: "En retard" }
const statusClassNames: Record<FinancialCacheStatus, string> = { up_to_date: "border-green-200 bg-green-50 text-green-700", late: "border-amber-200 bg-amber-50 text-amber-700"}
const paymentStatusLabels: Record<Payment["status"], string> = { confirmed: "Confirmé", cancelled: "Annulé" }
const paymentStatusClassNames: Record<Payment["status"], string> = { confirmed: "border-green-200 bg-green-50 text-green-700", cancelled: "border-red-200 bg-red-50 text-red-700" }
const paymentStatusTones: Record<Payment["status"], "success" | "danger"> = { confirmed: "success", cancelled: "danger" }

type PaymentHistoryPanelProps = { schoolYearId: string; schoolYearLabel: string; canCancel: boolean; studentId?: string }

export function PaymentHistoryPanel({ schoolYearId, schoolYearLabel, canCancel, studentId }: PaymentHistoryPanelProps) {
  return studentId
    ? <StudentPaymentDetails schoolYearId={schoolYearId} schoolYearLabel={schoolYearLabel} canCancel={canCancel} studentId={studentId} />
    : <PaymentHistoryTable schoolYearId={schoolYearId} />
}

function PaymentHistoryTable({ schoolYearId }: { schoolYearId: string }) {
  const navigate = useNavigate()
  const [from, setFrom] = useState(firstDayOfMonth())
  const [to, setTo] = useState(isoToday())
  const [dateMessage, setDateMessage] = useState<string | null>(null)
  const rangeError = dateRangeIssue(from, to)
  const changeDate = (side: "from" | "to", value: string) => {
    const next = updateDateRange(from, to, side, value)
    setFrom(next.from)
    setTo(next.to)
    setDateMessage(next.message)
  }
  const [levelId, setLevelId] = useState("all")
  const [classId, setClassId] = useState("all")
  const [status, setStatus] = useState<FinancialCacheStatus | "all">("all")
  const [page, setPage] = useState(1)
  const filter = { schoolYearId, from, to, levelId: levelId === "all" ? undefined : levelId, classId: classId === "all" ? undefined : classId, status: status === "all" ? undefined : status }
  const historyQuery = useQuery({ queryKey: ["finance", "payment-history", filter, page], queryFn: () => getPaymentHistory({ ...filter, page, limit: HISTORY_PAGE_SIZE }), enabled: Boolean(schoolYearId && from && to && !rangeError) })
  const levelsQuery = useQuery({ queryKey: ["academic", "levels"], queryFn: listLevels })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", schoolYearId], queryFn: () => listClasses(schoolYearId), enabled: Boolean(schoolYearId) })
  const classes = (classesQuery.data?.classes ?? []).filter((schoolClass) => levelId === "all" || schoolClass.level.id === levelId)
  const pagination = historyQuery.data?.pagination
  const total = pagination?.total ?? 0
  const pageStart = total === 0 ? 0 : ((pagination?.page ?? page) - 1) * (pagination?.limit ?? HISTORY_PAGE_SIZE) + 1
  const pageEnd = Math.min((pagination?.page ?? page) * (pagination?.limit ?? HISTORY_PAGE_SIZE), total)

  useEffect(() => { setPage(1) }, [schoolYearId, from, to, levelId, classId, status])
  useEffect(() => { if (classId !== "all" && !classes.some((schoolClass) => schoolClass.id === classId)) setClassId("all") }, [classId, classes])

  return (
    <section className="space-y-5">
      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <FilterDate
          label="Du"
          id="history-from"
          value={from}
          max={to}
          invalid={Boolean(rangeError)}
          describedBy={
            rangeError || dateMessage ? "history-date-message" : undefined
          }
          onChange={(value) => changeDate("from", value)}
        />
        <FilterDate
          label="Au"
          id="history-to"
          value={to}
          min={from}
          invalid={Boolean(rangeError)}
          describedBy={
            rangeError || dateMessage ? "history-date-message" : undefined
          }
          onChange={(value) => changeDate("to", value)}
        />
        {rangeError || dateMessage ? (
          <p
            id="history-date-message"
            role="alert"
            className="text-sm text-destructive sm:col-span-2"
          >
            {rangeError ?? dateMessage}
          </p>
        ) : null}
        <FilterSelect
          label="Niveau"
          value={levelId}
          onValueChange={setLevelId}
          allLabel="Tous les niveaux"
          items={(levelsQuery.data ?? []).map((level) => ({
            value: level.id,
            label: level.name,
          }))}
        />
        <FilterSelect
          label="Classe"
          value={classId}
          onValueChange={setClassId}
          allLabel="Toutes les classes"
          items={classes.map((schoolClass) => ({
            value: schoolClass.id,
            label: schoolClass.name,
          }))}
        />
        <FilterSelect
          label="Situation actuelle"
          value={status}
          onValueChange={(value) =>
            setStatus(value as FinancialCacheStatus | "all")
          }
          allLabel="Toutes les situations"
          items={Object.entries(statusLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>
      {historyQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : null}
      {historyQuery.isError ? (
        <QueryErrorState
          message="Impossible de charger l’historique des paiements."
          onRetry={() => void historyQuery.refetch()}
        />
      ) : null}
      {historyQuery.data?.entries.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Aucun paiement sur cette période"
          message="Modifiez les filtres ou élargissez la période."
        />
      ) : null}
      {historyQuery.data && historyQuery.data.entries.length > 0 ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Situation actuelle</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>
                    <span className="sr-only">Détails</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyQuery.data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Intl.DateTimeFormat("fr-FR").format(
                        new Date(`${entry.paymentDate}T00:00:00`),
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{entry.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.studentMatricule ?? "Sans matricule"}
                      </p>
                    </TableCell>
                    <TableCell>{entry.levelName}</TableCell>
                    <TableCell>{entry.className}</TableCell>
                    <TableCell>{entry.receiptNumber}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={paymentStatusClassNames[entry.status]}
                      >
                        {paymentStatusLabels[entry.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.financialStatus ? (
                        <Badge
                          variant="outline"
                          className={statusClassNames[entry.financialStatus]}
                          title="Situation financière actuelle de l’élève"
                        >
                          {statusLabels[entry.financialStatus]}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          À calculer
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatFcfa(entry.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10"
                        onClick={() =>
                          navigate(
                            `${FINANCE_PATHS.historyDetail(entry.studentId)}?schoolYearId=${schoolYearId}`,
                          )
                        }
                      >
                        Détails
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 1}
            total={total}
            pageStart={pageStart}
            pageEnd={pageEnd}
            isFetching={historyQuery.isFetching}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() =>
              setPage((current) =>
                Math.min(pagination?.totalPages ?? 1, current + 1),
              )
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function FilterDate({ label, id, value, min, max, invalid, describedBy, onChange }: { label: string; id: string; value: string; min?: string; max?: string; invalid?: boolean; describedBy?: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="date" className="min-h-12" value={value} min={min} max={max} aria-invalid={invalid} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} /></div>
}

function FilterSelect({ label, value, onValueChange, allLabel, items }: { label: string; value: string; onValueChange: (value: string) => void; allLabel: string; items: Array<{ value: string; label: string }> }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{allLabel}</SelectItem>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
}

function Pagination({ page, totalPages, total, pageStart, pageEnd, isFetching, onPrevious, onNext }: { page: number; totalPages: number; total: number; pageStart: number; pageEnd: number; isFetching: boolean; onPrevious: () => void; onNext: () => void }) {
  return <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">{pageStart}–{pageEnd} sur {total} paiement{total > 1 ? "s" : ""}</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="min-h-12" disabled={page === 1 || isFetching} onClick={onPrevious}><ChevronLeft className="mr-1 h-4 w-4" />Précédent</Button><span className="min-w-20 text-center tabular-nums" aria-live="polite">Page {page} / {totalPages}</span><Button type="button" variant="outline" size="sm" className="min-h-12" disabled={page === totalPages || isFetching} onClick={onNext}>Suivant<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
}

function StudentPaymentDetails({ schoolYearId, schoolYearLabel, canCancel, studentId }: Required<PaymentHistoryPanelProps>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  // Mêmes codes que les routes API : POST /payments (payments.record), POST /payments/:id/receipt (payments.view), POST /payments/:id/cancel (payments.cancel).
  const canRecord = hasPermission("payments.record")
  const canDownloadReceipt = hasPermission("payments.view")
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const statusQuery = useQuery({ queryKey: ["finance", "financial-status", studentId, schoolYearId], queryFn: () => getFinancialStatus(studentId, schoolYearId) })
  const paymentsQuery = useQuery({ queryKey: ["finance", "account-statement", studentId, schoolYearId], queryFn: () => getStudentAccountStatement(studentId, schoolYearId) })
  const receipt = usePdfExportJob({ fallbackFileName: "recu-paiement.pdf", startedMessage: "Le reçu est en cours de préparation.", successMessage: "Reçu téléchargé", errorMessage: "Impossible de générer le reçu." })
  const cancelMutation = useMutation({ mutationFn: ({ id, reason: cancellationReason }: { id: string; reason: string }) => cancelPayment(id, cancellationReason), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["finance", "account-statement", studentId, schoolYearId] }), queryClient.invalidateQueries({ queryKey: ["finance", "financial-status", studentId, schoolYearId] }), queryClient.invalidateQueries({ queryKey: ["finance", "payment-history"] })]); setCancelTarget(null); setReason(""); toast({ title: "Paiement annulé", description: "La transaction reste visible dans l’historique." }) }, onError: (error) => toast({ title: "Annulation impossible", description: error instanceof Error ? error.message : "Réessayez.", variant: "destructive" }) })
  const payments = sortPaymentsMostRecentFirst(paymentsQuery.data?.movements ?? [])
  const summary = summarizeConfirmedPayments(payments)
  const student = paymentsQuery.data?.student
  const status = statusQuery.data
  const gap = status ? buildFinancialGap(status) : null
  const startPayment = () => navigate(`${FINANCE_PATHS.entry}?schoolYearId=${schoolYearId}`, { state: { payFor: { studentId, search: student?.matricule ?? student?.name ?? "" } } })
  const closeCancel = (open: boolean) => { if (!open) { setCancelTarget(null); setReason("") } }

  return <section className="space-y-5">
    {statusQuery.isError || paymentsQuery.isError ? <QueryErrorState message="Impossible de charger le dossier financier de cet élève." onRetry={() => { void statusQuery.refetch(); void paymentsQuery.refetch() }} isRetrying={statusQuery.isFetching || paymentsQuery.isFetching} /> : null}

    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground">{student ? getInitials(student.name) : "…"}</span>
        <div className="min-w-0">
          {student ? <><h2 className="truncate text-xl font-semibold">{student.name}</h2><p className="text-sm text-muted-foreground">Matricule {student.matricule ?? "non renseigné"} · Année {schoolYearLabel}</p></> : <div className="space-y-2" aria-busy="true"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div>}
        </div>
      </div>
      {canRecord ? <Button type="button" className="min-h-12" onClick={startPayment}>Enregistrer un paiement</Button> : null}
    </div>

    {statusQuery.isLoading ? <Skeleton className="h-44 w-full rounded-xl" /> : null}
    {status && gap ? <div className="rounded-xl border bg-card p-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KeyFigure variant="plain" size="lg" label="Total dû" value={formatFcfa(status.totalDue)} hint={hasActiveDiscount(status) ? `Remise : ${formatFcfa(status.discountAmount)}` : undefined} />
        <KeyFigure variant="plain" size="lg" label="Cumul versé" value={formatFcfa(status.confirmedPaid)} />
        <KeyFigure variant="plain" size="lg" label="Reste à payer" value={formatFcfa(status.remainingDue)} />
        <div><p className="text-xs font-medium text-muted-foreground">Situation à date</p><div className="mt-2"><StatusPill tone={gap.isLate ? "warning" : "success"} className="px-4 py-1.5 text-sm">{gap.isLate ? "En retard" : "À jour"}</StatusPill></div></div>
      </div>
      <ProgressMeter className="mt-5" percent={gap.percentPaid} label="Part du total dû réglée" caption={`${gap.percentPaid} % réglé`} aside={gap.isLate ? <span className="font-medium text-amber-800 dark:text-amber-300">{`Seuil attendu à ce jour : ${formatFcfa(gap.threshold)} · il manque ${formatFcfa(gap.missing)}`}</span> : null} />
    </div> : null}

    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xl font-semibold">Paiements</h3>{paymentsQuery.data ? <p className="text-sm text-muted-foreground">{paymentPlural(summary.count)} · {formatFcfa(summary.total)}</p> : null}</div>
    {paymentsQuery.isLoading ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
    {!paymentsQuery.isLoading && payments.length === 0 && !paymentsQuery.isError ? <EmptyState icon={ReceiptText} title="Aucun paiement" message="Aucun versement n’est enregistré pour cette année scolaire." /> : null}
    {payments.length > 0 ? <>
      <div className="hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader><TableRow><TableHead className="px-4">Date</TableHead><TableHead>Mode</TableHead><TableHead>Reçu</TableHead><TableHead>Réf. école</TableHead><TableHead className="text-right">Montant</TableHead><TableHead className="text-right">Reste après</TableHead><TableHead>Statut</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>{payments.map((payment) => <TableRow key={payment.id} className={payment.status === "cancelled" ? "bg-muted/30" : undefined}>
            <TableCell className="px-4 py-4"><PaymentDate value={payment.paymentDate} /></TableCell>
            <TableCell className="py-4"><p>{methodLabels[payment.method]}</p><p className="text-sm text-muted-foreground">{sourceLabels[payment.source]}</p></TableCell>
            <TableCell className="py-4 tabular-nums">{payment.receiptNumber}</TableCell>
            <TableCell className="py-4">{payment.schoolReceiptReference ?? "—"}</TableCell>
            <TableCell className="py-4 text-right font-semibold tabular-nums">{formatFcfa(payment.amount)}</TableCell>
            <TableCell className="py-4 text-right tabular-nums text-muted-foreground">{formatFcfa(payment.balanceAfter)}</TableCell>
            <TableCell className="py-4"><StatusPill tone={paymentStatusTones[payment.status]}>{paymentStatusLabels[payment.status]}</StatusPill>{payment.cancellationReason ? <p className="mt-1 max-w-48 text-xs text-muted-foreground">Motif : {payment.cancellationReason}</p> : null}</TableCell>
            <TableCell className="py-4"><PaymentActions payment={payment} canDownloadReceipt={canDownloadReceipt} canCancel={canCancel} isReceiptRunning={receipt.isRunning} onReceipt={() => void receipt.launch(() => requestPaymentReceipt(payment.id))} onCancel={() => { setCancelTarget(payment.id); setReason("") }} /></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <ul className="space-y-3 md:hidden">{payments.map((payment) => <li key={payment.id} className={`rounded-xl border bg-card p-4 ${payment.status === "cancelled" ? "bg-muted/30" : ""}`}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold tabular-nums">{formatFcfa(payment.amount)}</p><PaymentDate value={payment.paymentDate} /></div><StatusPill tone={paymentStatusTones[payment.status]}>{paymentStatusLabels[payment.status]}</StatusPill></div>
        <p className="mt-2 text-sm">{methodLabels[payment.method]} · <span className="text-muted-foreground">{sourceLabels[payment.source]}</span></p>
        <p className="text-xs text-muted-foreground">Reçu {payment.receiptNumber}{payment.schoolReceiptReference ? ` · Réf. école ${payment.schoolReceiptReference}` : ""}</p>
        <p className="mt-1 text-sm text-muted-foreground">Reste après : {formatFcfa(payment.balanceAfter)}</p>
        {payment.cancellationReason ? <p className="mt-1 text-xs text-muted-foreground">Motif : {payment.cancellationReason}</p> : null}
        <div className="mt-3 flex justify-end"><PaymentActions payment={payment} canDownloadReceipt={canDownloadReceipt} canCancel={canCancel} isReceiptRunning={receipt.isRunning} onReceipt={() => void receipt.launch(() => requestPaymentReceipt(payment.id))} onCancel={() => { setCancelTarget(payment.id); setReason("") }} /></div>
      </li>)}</ul>
    </> : null}

    <ConfirmActionDialog open={cancelTarget !== null} onOpenChange={closeCancel} variant="destructive" title="Annuler le paiement" description="Cette action est définitive. Le paiement restera visible avec votre justification." confirmLabel="Confirmer l’annulation" pendingLabel="Annulation…" isPending={cancelMutation.isPending} disabled={!reason.trim()} onConfirm={() => { if (cancelTarget) cancelMutation.mutate({ id: cancelTarget, reason: reason.trim() }) }}>
      <div className="space-y-1.5"><Label htmlFor="cancel-reason">Justification obligatoire</Label><Textarea id="cancel-reason" value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Ex. paiement attribué au mauvais élève" /></div>
    </ConfirmActionDialog>
  </section>
}

function PaymentDate({ value }: { value: string }) {
  const { date, time } = formatPaymentDate(value)
  return <><p className="font-semibold">{date}</p>{time ? <p className="text-sm text-muted-foreground">{time}</p> : null}</>
}

function PaymentActions({ payment, canDownloadReceipt, canCancel, isReceiptRunning, onReceipt, onCancel }: { payment: Payment; canDownloadReceipt: boolean; canCancel: boolean; isReceiptRunning: boolean; onReceipt: () => void; onCancel: () => void }) {
  const confirmed = payment.status !== "cancelled"
  return <div className="flex items-center justify-end gap-2">
    {confirmed && canDownloadReceipt ? <Button type="button" variant="outline" className="min-h-10" disabled={isReceiptRunning} onClick={onReceipt}>{isReceiptRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}Reçu</Button> : null}
    {confirmed && canCancel ? <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className="min-h-10 w-10" aria-label={`Autres actions pour le reçu ${payment.receiptNumber}`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="min-h-10 font-medium text-red-700 focus:bg-red-50 focus:text-red-800 dark:text-red-300 dark:focus:bg-red-950" onSelect={onCancel}>Annuler le paiement</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}
  </div>
}
