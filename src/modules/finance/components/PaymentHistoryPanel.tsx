import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Ban, ChevronLeft, ChevronRight, Download, Loader2, ReceiptText } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { listClasses, listLevels } from "@/modules/academic/academic.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { formatFcfa } from "@/shared/utils/formatting"
import { FINANCE_PATHS } from "../finance.routes"
import { cancelPayment, getFinancialStatus, getPaymentHistory, getStudentAccountStatement, requestPaymentReceipt, type FinancialCacheStatus, type Payment } from "../finance.api"

const HISTORY_PAGE_SIZE = 20
const isoToday = () => new Date().toISOString().slice(0, 10)
const firstDayOfMonth = () => `${isoToday().slice(0, 8)}01`
const methodLabels: Record<Payment["method"], string> = { cash: "Espèces", mobile_money: "Mobile Money", bank_transfer: "Virement" }
const sourceLabels: Record<Payment["source"], string> = { cashier_manual: "Saisie manuelle", in_app_button: "Paiement en ligne", bulk_import: "Import courant", migration_import: "Solde de départ" }
const statusLabels: Record<FinancialCacheStatus, string> = { up_to_date: "À jour", late: "En retard", waived: "Remise" }
const statusClassNames: Record<FinancialCacheStatus, string> = { up_to_date: "border-green-200 bg-green-50 text-green-700", late: "border-amber-200 bg-amber-50 text-amber-700", waived: "border-blue-200 bg-blue-50 text-blue-700" }
const formatDate = (value: string): string => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date inconnue"

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
  const [levelId, setLevelId] = useState("all")
  const [classId, setClassId] = useState("all")
  const [status, setStatus] = useState<FinancialCacheStatus | "all">("all")
  const [page, setPage] = useState(1)
  const filter = { schoolYearId, from, to, levelId: levelId === "all" ? undefined : levelId, classId: classId === "all" ? undefined : classId, status: status === "all" ? undefined : status }
  const historyQuery = useQuery({ queryKey: ["finance", "payment-history", filter, page], queryFn: () => getPaymentHistory({ ...filter, page, limit: HISTORY_PAGE_SIZE }), enabled: Boolean(schoolYearId && from && to) })
  const levelsQuery = useQuery({ queryKey: ["academic", "levels"], queryFn: listLevels })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", schoolYearId], queryFn: () => listClasses(schoolYearId), enabled: Boolean(schoolYearId) })
  const classes = (classesQuery.data?.classes ?? []).filter((schoolClass) => levelId === "all" || schoolClass.level.id === levelId)
  const pagination = historyQuery.data?.pagination
  const total = pagination?.total ?? 0
  const pageStart = total === 0 ? 0 : ((pagination?.page ?? page) - 1) * (pagination?.limit ?? HISTORY_PAGE_SIZE) + 1
  const pageEnd = Math.min((pagination?.page ?? page) * (pagination?.limit ?? HISTORY_PAGE_SIZE), total)

  useEffect(() => { setPage(1) }, [schoolYearId, from, to, levelId, classId, status])
  useEffect(() => { if (classId !== "all" && !classes.some((schoolClass) => schoolClass.id === classId)) setClassId("all") }, [classId, classes])

  return <section className="space-y-5">
    <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <FilterDate label="Du" id="history-from" value={from} max={to} onChange={setFrom} />
      <FilterDate label="Au" id="history-to" value={to} min={from} onChange={setTo} />
      <FilterSelect label="Niveau" value={levelId} onValueChange={setLevelId} allLabel="Tous les niveaux" items={(levelsQuery.data ?? []).map((level) => ({ value: level.id, label: level.name }))} />
      <FilterSelect label="Classe" value={classId} onValueChange={setClassId} allLabel="Toutes les classes" items={classes.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name }))} />
      <FilterSelect label="Statut" value={status} onValueChange={(value) => setStatus(value as FinancialCacheStatus | "all")} allLabel="Tous les statuts" items={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
    </div>
    {historyQuery.isLoading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div> : null}
    {historyQuery.isError ? <QueryErrorState message="Impossible de charger l’historique des paiements." onRetry={() => void historyQuery.refetch()} /> : null}
    {historyQuery.data?.entries.length === 0 ? <EmptyState icon={ReceiptText} title="Aucun paiement sur cette période" message="Modifiez les filtres ou élargissez la période." /> : null}
    {historyQuery.data && historyQuery.data.entries.length > 0 ? <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Niveau</TableHead><TableHead>Classe</TableHead><TableHead>Reçu</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Montant</TableHead><TableHead><span className="sr-only">Détails</span></TableHead></TableRow></TableHeader><TableBody>{historyQuery.data.entries.map((entry) => <TableRow key={entry.id}><TableCell>{new Intl.DateTimeFormat("fr-FR").format(new Date(`${entry.paymentDate}T00:00:00`))}</TableCell><TableCell><p className="font-medium">{entry.studentName}</p><p className="text-xs text-muted-foreground">{entry.studentMatricule ?? "Sans matricule"}</p></TableCell><TableCell>{entry.levelName}</TableCell><TableCell>{entry.className}</TableCell><TableCell>{entry.receiptNumber}</TableCell><TableCell>{entry.financialStatus ? <Badge variant="outline" className={statusClassNames[entry.financialStatus]}>{statusLabels[entry.financialStatus]}</Badge> : <span className="text-sm text-muted-foreground">À calculer</span>}</TableCell><TableCell className="text-right font-semibold tabular-nums">{formatFcfa(entry.amount)}</TableCell><TableCell><Button type="button" variant="outline" size="sm" className="min-h-12" onClick={() => navigate(`${FINANCE_PATHS.historyDetail(entry.studentId)}?schoolYearId=${schoolYearId}`)}>Détails</Button></TableCell></TableRow>)}</TableBody></Table></div>
      <Pagination page={pagination?.page ?? page} totalPages={pagination?.totalPages ?? 1} total={total} pageStart={pageStart} pageEnd={pageEnd} isFetching={historyQuery.isFetching} onPrevious={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => Math.min(pagination?.totalPages ?? 1, current + 1))} />
    </div> : null}
  </section>
}

function FilterDate({ label, id, value, min, max, onChange }: { label: string; id: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="date" className="min-h-12" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} /></div>
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
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const statusQuery = useQuery({ queryKey: ["finance", "financial-status", studentId, schoolYearId], queryFn: () => getFinancialStatus(studentId, schoolYearId) })
  const paymentsQuery = useQuery({ queryKey: ["finance", "account-statement", studentId, schoolYearId], queryFn: () => getStudentAccountStatement(studentId, schoolYearId) })
  const receipt = usePdfExportJob({ fallbackFileName: "recu-paiement.pdf", startedMessage: "Le reçu est en cours de préparation.", successMessage: "Reçu téléchargé", errorMessage: "Impossible de générer le reçu." })
  const cancelMutation = useMutation({ mutationFn: ({ id, reason: cancellationReason }: { id: string; reason: string }) => cancelPayment(id, cancellationReason), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["finance", "account-statement", studentId, schoolYearId] }), queryClient.invalidateQueries({ queryKey: ["finance", "financial-status", studentId, schoolYearId] }), queryClient.invalidateQueries({ queryKey: ["finance", "payment-history"] })]); setCancelTarget(null); setReason(""); toast({ title: "Paiement annulé", description: "La transaction reste visible dans l’historique." }) }, onError: (error) => toast({ title: "Annulation impossible", description: error instanceof Error ? error.message : "Réessayez.", variant: "destructive" }) })
  const payments = paymentsQuery.data?.movements ?? []

  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-medium">Détail financier</h2><p className="text-sm text-muted-foreground">Année scolaire {schoolYearLabel}</p></div><Button type="button" variant="outline" className="min-h-12" onClick={() => navigate(`${FINANCE_PATHS.history}?schoolYearId=${schoolYearId}`)}>Retour à l’historique</Button></div>
    {statusQuery.isError || paymentsQuery.isError ? <QueryErrorState message="Impossible de charger le dossier financier de cet élève." onRetry={() => { void statusQuery.refetch(); void paymentsQuery.refetch() }} isRetrying={statusQuery.isFetching || paymentsQuery.isFetching} /> : null}
    {statusQuery.data ? <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4"><Metric title="Total dû" value={formatFcfa(statusQuery.data.totalDue)} prominent /><Metric title="Cumul versé" value={formatFcfa(statusQuery.data.confirmedPaid)} /><Metric title="Reste à payer" value={formatFcfa(statusQuery.data.remainingDue)} /><div className="bg-card p-4"><p className="text-xs text-muted-foreground">Situation à date</p><Badge variant="outline" className={statusQuery.data.standing === "late" ? "mt-2 border-amber-200 bg-amber-50 text-amber-700" : "mt-2 border-green-200 bg-green-50 text-green-700"}>{statusQuery.data.standing === "late" ? "En retard" : "À jour"}</Badge></div></div> : null}
    {paymentsQuery.isLoading ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}</div> : null}
    {!paymentsQuery.isLoading && payments.length === 0 && !paymentsQuery.isError ? <EmptyState icon={ReceiptText} title="Aucun paiement" message="Aucun versement n’est enregistré pour cette année scolaire." /> : null}
    {payments.length > 0 ? <div className="space-y-3">{payments.map((payment) => <PaymentCard key={payment.id} payment={payment} canCancel={canCancel} isReceiptRunning={receipt.isRunning} isCancelPending={cancelMutation.isPending} cancelTarget={cancelTarget} reason={reason} onRequestReceipt={() => void receipt.launch(() => requestPaymentReceipt(payment.id))} onStartCancel={() => { setCancelTarget(payment.id); setReason("") }} onCancel={() => setCancelTarget(null)} onReasonChange={setReason} onConfirmCancel={() => cancelMutation.mutate({ id: payment.id, reason: reason.trim() })} />)}</div> : null}
    {statusQuery.data?.standing === "late" ? <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Le cumul versé est inférieur au seuil attendu à ce jour ({formatFcfa(statusQuery.data.cumulativeExpectedAtDate)}).</AlertDescription></Alert> : null}
  </section>
}

function Metric({ title, value, prominent = false }: { title: string; value: string; prominent?: boolean }) { return <div className={prominent ? "bg-blue-700 p-4 text-blue-50" : "bg-card p-4"}><p className={prominent ? "text-xs text-blue-100" : "text-xs text-muted-foreground"}>{title}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div> }

function PaymentCard({ payment, canCancel, isReceiptRunning, isCancelPending, cancelTarget, reason, onRequestReceipt, onStartCancel, onCancel, onReasonChange, onConfirmCancel }: { payment: Payment & { balanceAfter: number }; canCancel: boolean; isReceiptRunning: boolean; isCancelPending: boolean; cancelTarget: string | null; reason: string; onRequestReceipt: () => void; onStartCancel: () => void; onCancel: () => void; onReasonChange: (value: string) => void; onConfirmCancel: () => void }) {
  return <Card className={payment.status === "cancelled" ? "bg-muted/30" : ""}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-semibold tabular-nums">{formatFcfa(payment.amount)}</p><Badge variant="outline" className={payment.status === "cancelled" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}>{payment.status === "cancelled" ? "Annulé" : "Confirmé"}</Badge></div><p className="text-sm text-muted-foreground">{formatDate(`${payment.paymentDate}T00:00:00`)} · {methodLabels[payment.method]} · {sourceLabels[payment.source]}</p><p className="text-xs text-muted-foreground">Reçu {payment.receiptNumber}{payment.schoolReceiptReference ? ` · Réf. école ${payment.schoolReceiptReference}` : ""}</p><p className="text-sm font-medium text-blue-800 dark:text-blue-200">Solde après mouvement : {formatFcfa(payment.balanceAfter)}</p>{payment.cancellationReason ? <p className="mt-2 text-sm text-red-700">Motif d’annulation : {payment.cancellationReason}</p> : null}</div><div className="flex shrink-0 flex-wrap gap-2">{payment.status !== "cancelled" ? <Button type="button" variant="outline" className="min-h-12" disabled={isReceiptRunning} onClick={onRequestReceipt}>{isReceiptRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Reçu</Button> : null}{canCancel && payment.status !== "cancelled" ? <Button type="button" variant="outline" className="min-h-12 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={onStartCancel}><Ban className="mr-2 h-4 w-4" />Annuler</Button> : null}</div></div>{cancelTarget === payment.id ? <div className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20"><div className="flex gap-2 text-sm text-red-800 dark:text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Cette action est définitive. Le paiement restera visible avec votre justification.</p></div><div className="space-y-1.5"><Label htmlFor={`cancel-${payment.id}`}>Justification obligatoire</Label><Textarea id={`cancel-${payment.id}`} value={reason} maxLength={1000} onChange={(event) => onReasonChange(event.target.value)} placeholder="Ex. paiement attribué au mauvais élève" /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" className="min-h-12" onClick={onCancel}>Conserver le paiement</Button><Button type="button" variant="destructive" className="min-h-12" disabled={!reason.trim() || isCancelPending} onClick={onConfirmCancel}>{isCancelPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirmer l’annulation</Button></div></div> : null}</CardContent></Card>
}
