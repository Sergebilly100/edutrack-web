import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, ReceiptText } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { listClasses } from "@/modules/academic/academic.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { useCanExportData } from "@/shared/hooks/useCanExportData"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { dateRangeIssue, updateDateRange } from "@/shared/lib/date-validation"
import { formatFcfa } from "@/shared/utils/formatting"
import { studentNoun } from "@/shared/utils/student-label"
import { dayLabel, formatCancelledAt, groupByDay, isoToFr, methodShare, pluralize, presetRange, PERIOD_PRESETS, type JournalEntry, type PeriodPreset } from "../cash-journal.helpers"
import { exportCashJournalExcel, exportCashJournalPdf, getCashJournal, requestPaymentReceipt, type CashJournalFilter, type PaymentMethod } from "../finance.api"
import { FINANCE_PATHS } from "../finance.routes"
import { RateBar } from "./RateBar"
import { StatCard } from "./StatCard"
import { StatusPill } from "./StatusPill"

const methods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Espèces" }, { value: "mobile_money", label: "Mobile Money" }, { value: "bank_transfer", label: "Virement" },
]
const methodLabel = (method: PaymentMethod) => methods.find((item) => item.value === method)?.label ?? method
const JOURNAL_PAGE_SIZE = 20
type StatusChoice = "all" | "confirmed" | "cancelled"

type RowProps = { entry: JournalEntry; canOpenStudent: boolean; schoolYearId: string; onReceipt: (id: string) => void; receiptRunning: boolean }

function CancellationNote({ entry }: { entry: JournalEntry }) {
  if (entry.status !== "cancelled") return null
  const by = entry.cancelledBy ?? "Utilisateur inconnu"
  return <span className="mt-1 block text-xs text-muted-foreground" title={entry.cancellationReason ?? undefined}>
    par {by}{entry.cancelledAt ? ` · ${formatCancelledAt(entry.cancelledAt)}` : ""}
    {entry.cancellationReason ? <span className="block">Motif : {entry.cancellationReason}</span> : null}
  </span>
}

function StudentCell({ entry, canOpenStudent, schoolYearId }: Pick<RowProps, "entry" | "canOpenStudent" | "schoolYearId">) {
  const name = entry.studentName
  return <>
    {canOpenStudent
      ? <Link to={`${FINANCE_PATHS.historyDetail(entry.studentId)}?schoolYearId=${encodeURIComponent(schoolYearId)}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{name}</Link>
      : <span className="font-medium">{name}</span>}
    <span className="block text-xs text-muted-foreground">{entry.studentMatricule ?? "Sans matricule"}</span>
  </>
}

function ReceiptCell({ entry, onReceipt, receiptRunning }: Pick<RowProps, "entry" | "onReceipt" | "receiptRunning">) {
  if (entry.status === "cancelled") return <span>{entry.receiptNumber}</span>
  return <button type="button" disabled={receiptRunning} onClick={() => onReceipt(entry.id)} aria-label={`Télécharger le reçu ${entry.receiptNumber}`} className="min-h-10 rounded-md font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">{entry.receiptNumber}</button>
}

const reference = (entry: JournalEntry) => entry.providerReference ?? entry.schoolReceiptReference
const StatusCell = ({ entry }: { entry: JournalEntry }) => entry.status === "cancelled"
  ? <><StatusPill tone="danger">Annulé</StatusPill><CancellationNote entry={entry} /></>
  : <StatusPill tone="success">Confirmé</StatusPill>
const Amount = ({ entry }: { entry: JournalEntry }) => <span className={cn("font-semibold tabular-nums", entry.status === "cancelled" && "line-through")}>{formatFcfa(entry.amount)}</span>
const tinted = (entry: JournalEntry) => entry.status === "cancelled" ? "bg-red-50/60 text-muted-foreground dark:bg-red-950/30" : ""

export function CashJournalPanel({ schoolYearId }: { schoolYearId: string }) {
  const labels = useStudentLabels()
  const { hasPermission } = usePermissions()
  const canSeeCancelled = hasPermission("payments.cancel")
  const canOpenStudent = hasPermission("payments.view")
  const canExport = useCanExportData()
  const [params, setParams] = useSearchParams()
  const setParam = (changes: Record<string, string>) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key) }
    return next
  }, { replace: true })

  const preset: PeriodPreset = PERIOD_PRESETS.some((item) => item.value === params.get("periode")) ? (params.get("periode") as PeriodPreset) : "month"
  const range = preset === "custom" ? { from: params.get("du") ?? "", to: params.get("au") ?? "" } : presetRange(preset)
  const { from, to } = range
  const rangeError = dateRangeIssue(from, to)
  const [dateMessage, setDateMessage] = useState<string | null>(null)
  const classId = params.get("classe") ?? "all"
  const method = (methods.some((item) => item.value === params.get("mode")) ? params.get("mode") : "all") as PaymentMethod | "all"
  const status: StatusChoice = canSeeCancelled && (params.get("statut") === "confirmed" || params.get("statut") === "cancelled") ? (params.get("statut") as StatusChoice) : "all"
  const [currentPage, setCurrentPage] = useState(1)
  const [isExcelRunning, setIsExcelRunning] = useState(false)

  const choosePreset = (next: PeriodPreset) => {
    if (next === "custom") { const base = presetRange("month"); setParam({ periode: "custom", du: from || base.from, au: to || base.to }) }
    else setParam({ periode: next === "month" ? "" : next, du: "", au: "" })
    setDateMessage(null)
  }
  const changeDate = (side: "from" | "to", value: string) => {
    const next = updateDateRange(from, to, side, value)
    setParam({ periode: "custom", du: next.from, au: next.to })
    setDateMessage(next.message)
  }

  const filter: CashJournalFilter = { schoolYearId, from, to, classId: classId === "all" ? undefined : classId, method: method === "all" ? undefined : method, status: status === "all" ? undefined : status }
  const journalQuery = useQuery({ queryKey: ["finance", "cash-journal", filter, currentPage], queryFn: () => getCashJournal({ ...filter, page: currentPage, limit: JOURNAL_PAGE_SIZE }), enabled: Boolean(schoolYearId && from && to && !rangeError) })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", schoolYearId], queryFn: () => listClasses(schoolYearId), enabled: Boolean(schoolYearId) })
  const pdf = usePdfExportJob({ fallbackFileName: "journal-caisse.pdf", startedMessage: "Le journal PDF est en préparation.", successMessage: "Journal PDF téléchargé" })
  const receipt = usePdfExportJob({ fallbackFileName: "recu-paiement.pdf", startedMessage: "Le reçu est en cours de préparation.", successMessage: "Reçu téléchargé", errorMessage: "Impossible de générer le reçu." })
  const journal = journalQuery.data
  const totalPages = journal?.pagination.totalPages ?? 1
  const confirmedCount = journal?.counts.confirmed ?? 0
  const cancelledCount = journal?.counts.cancelled ?? 0
  const className = classesQuery.data?.classes.find((item) => item.id === classId)?.name

  useEffect(() => { setCurrentPage(1) }, [schoolYearId, from, to, classId, method, status])
  useEffect(() => { if (journal && currentPage !== journal.pagination.page) setCurrentPage(journal.pagination.page) }, [currentPage, journal])

  const downloadExcel = async () => {
    setIsExcelRunning(true)
    try { await exportCashJournalExcel(filter) } finally { setIsExcelRunning(false) }
  }
  const exporting = isExcelRunning || pdf.isRunning
  const onReceipt = (id: string) => void receipt.launch(() => requestPaymentReceipt(id))
  const groups = journal ? groupByDay(journal.entries) : []
  const dayRowFormat = (group: (typeof groups)[number]) => `${group.confirmedCount} ${pluralize(group.confirmedCount, "confirmé")} · ${formatFcfa(group.confirmedTotal)}${group.cancelledCount > 0 ? ` · ${group.cancelledCount} ${pluralize(group.cancelledCount, "annulé")}` : ""}`
  const noun = studentNoun(labels, 1, { capitalized: true })

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Raccourcis de période" className="flex flex-wrap gap-2">
        {PERIOD_PRESETS.map((item) => <Button key={item.value} type="button" variant="outline" aria-pressed={preset === item.value} onClick={() => choosePreset(item.value)} className={cn("min-h-10 rounded-full", preset === item.value && "border-primary bg-primary/10 text-primary")}>{item.label}</Button>)}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" className="min-h-10" disabled={exporting || !canExport} title={canExport ? undefined : "L’export de données est désactivé pour cet établissement."}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Exporter<ChevronDown aria-hidden="true" className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void downloadExcel()}>Excel</DropdownMenuItem><DropdownMenuItem onSelect={() => void pdf.launch(() => exportCashJournalPdf(filter))}>PDF</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {preset === "custom" ? <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="journal-from">Du</Label><Input id="journal-from" type="date" className="min-h-12" value={from} max={to || undefined} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError || dateMessage ? "journal-date-message" : undefined} onChange={(event) => changeDate("from", event.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="journal-to">Au</Label><Input id="journal-to" type="date" className="min-h-12" value={to} min={from || undefined} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError || dateMessage ? "journal-date-message" : undefined} onChange={(event) => changeDate("to", event.target.value)} /></div>
      </div> : <div className="flex min-h-12 items-center rounded-md border bg-background px-3 text-sm" aria-label="Plage de dates">{isoToFr(from)} – {isoToFr(to)}</div>}
      <Select value={classId} onValueChange={(value) => setParam({ classe: value === "all" ? "" : value })}>
        <SelectTrigger className="min-h-12" aria-label="Classe"><SelectValue>Classe : {className ?? "Toutes les classes"}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="all">Toutes les classes</SelectItem>{classesQuery.data?.classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={method} onValueChange={(value) => setParam({ mode: value === "all" ? "" : value })}>
        <SelectTrigger className="min-h-12" aria-label="Mode de paiement"><SelectValue>Mode : {method === "all" ? "Tous les modes" : methodLabel(method)}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="all">Tous les modes</SelectItem>{methods.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
      {canSeeCancelled ? <Select value={status} onValueChange={(value) => setParam({ statut: value === "all" ? "" : value })}>
        <SelectTrigger className="min-h-12" aria-label="Statut"><SelectValue>Statut : {status === "all" ? "Tous" : status === "confirmed" ? "Confirmés" : "Annulés"}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="confirmed">Confirmés</SelectItem><SelectItem value="cancelled">Annulés</SelectItem></SelectContent>
      </Select> : null}
    </div>
    {rangeError || dateMessage ? <p id="journal-date-message" role="alert" className="text-sm text-destructive">{rangeError ?? dateMessage}</p> : null}

    {journal ? <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
      <StatCard title="Total confirmé" headerExtra={cancelledCount > 0 ? <StatusPill tone="danger">{`${cancelledCount} ${pluralize(cancelledCount, "annulé")} · ${pluralize(cancelledCount, "exclu", "exclus")} du total`}</StatusPill> : null}>
        <p className="text-3xl font-semibold tabular-nums">{formatFcfa(journal.totals.grandTotal)}</p>
        <p className="text-sm text-muted-foreground">{confirmedCount} {pluralize(confirmedCount, "paiement")} {pluralize(confirmedCount, "confirmé")}</p>
      </StatCard>
      <StatCard title="Répartition par mode" aria-label="Répartition par mode de paiement">
        <div className="grid gap-4 sm:grid-cols-3">{methods.map((item) => {
          const amount = journal.totals[item.value]
          const share = methodShare(amount, journal.totals.grandTotal)
          return <div key={item.value} className={cn("space-y-1", amount === 0 && "opacity-60")}>
            <div className="flex items-center justify-between text-sm"><span className="font-medium">{item.label}</span><span className="text-muted-foreground tabular-nums">{share} %</span></div>
            <p className="text-xl font-semibold tabular-nums">{formatFcfa(amount)}</p>
            <RateBar rate={share / 100} label={`Part ${item.label}`} />
          </div>
        })}</div>
      </StatCard>
    </div> : null}

    {journalQuery.isLoading ? <div aria-label="Chargement du journal" className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
    {journalQuery.isError ? <QueryErrorState message="Impossible de charger le journal de caisse." onRetry={() => void journalQuery.refetch()} /> : null}
    {journal && journal.entries.length === 0 ? <EmptyState icon={ReceiptText} title="Aucun paiement sur cette période" message="Modifiez les filtres ou élargissez la période." /> : null}

    {journal && journal.entries.length > 0 ? <div className="space-y-4 rounded-lg border bg-card">
      <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[900px]">
          <TableHeader><TableRow><TableHead>{noun}</TableHead><TableHead>Classe</TableHead><TableHead>Mode</TableHead><TableHead>Référence</TableHead><TableHead>Reçu</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
          <TableBody>{groups.map((group) => <GroupRows key={group.date} group={group} summary={dayRowFormat(group)} canOpenStudent={canOpenStudent} schoolYearId={schoolYearId} onReceipt={onReceipt} receiptRunning={receipt.isRunning} />)}</TableBody>
        </Table>
      </div>
      <div className="space-y-4 p-3 md:hidden">{groups.map((group) => <div key={group.date} className="space-y-2">
        <div className="flex flex-wrap justify-between gap-1 text-sm"><h3 className="font-semibold">{dayLabel(group.date)}</h3><span className="text-muted-foreground">{dayRowFormat(group)}</span></div>
        <ul className="space-y-2">{group.entries.map((entry) => <li key={entry.id} className={cn("space-y-2 rounded-lg border p-3 text-sm", tinted(entry))}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><StudentCell entry={entry} canOpenStudent={canOpenStudent} schoolYearId={schoolYearId} /></div><Amount entry={entry} /></div>
          <div className="flex flex-wrap items-center gap-2"><span>{entry.className}</span><StatusPill tone="neutral">{methodLabel(entry.method)}</StatusPill><StatusCell entry={entry} /></div>
          <div className="flex justify-between text-muted-foreground"><span>{reference(entry) ?? "—"}</span><ReceiptCell entry={entry} onReceipt={onReceipt} receiptRunning={receipt.isRunning} /></div>
        </li>)}</ul>
      </div>)}</div>
      <div className="flex flex-col gap-3 border-t p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">{confirmedCount} {pluralize(confirmedCount, "paiement")} {pluralize(confirmedCount, "confirmé")} · {cancelledCount} {pluralize(cancelledCount, "annulé")} · Total confirmé de la sélection : {formatFcfa(journal.totals.grandTotal)}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="min-h-10" disabled={currentPage === 1 || journalQuery.isFetching} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Précédent</Button>
          <span className="min-w-20 text-center tabular-nums" aria-live="polite">Page {journal.pagination.page} / {totalPages}</span>
          <Button type="button" variant="outline" className="min-h-10" disabled={journal.pagination.page === totalPages || journalQuery.isFetching} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Suivant<ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>
      {journal.pagination.total > 0 ? <p className="sr-only">{journal.pagination.total} {pluralize(journal.pagination.total, "paiement")} au total</p> : null}
    </div> : null}
  </section>
}

function GroupRows({ group, summary, canOpenStudent, schoolYearId, onReceipt, receiptRunning }: { group: ReturnType<typeof groupByDay>[number]; summary: string; canOpenStudent: boolean; schoolYearId: string; onReceipt: (id: string) => void; receiptRunning: boolean }) {
  return <>
    <TableRow className="bg-muted/40 hover:bg-muted/40"><TableCell colSpan={4} className="font-semibold">{dayLabel(group.date)}</TableCell><TableCell colSpan={3} className="text-right text-sm text-muted-foreground">{summary}</TableCell></TableRow>
    {group.entries.map((entry) => <TableRow key={entry.id} className={tinted(entry)}>
      <TableCell><StudentCell entry={entry} canOpenStudent={canOpenStudent} schoolYearId={schoolYearId} /></TableCell>
      <TableCell>{entry.className}</TableCell>
      <TableCell><StatusPill tone="neutral">{methodLabel(entry.method)}</StatusPill></TableCell>
      <TableCell>{reference(entry) ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell><ReceiptCell entry={entry} onReceipt={onReceipt} receiptRunning={receiptRunning} /></TableCell>
      <TableCell><StatusCell entry={entry} /></TableCell>
      <TableCell className="text-right"><Amount entry={entry} /></TableCell>
    </TableRow>)}
  </>
}
