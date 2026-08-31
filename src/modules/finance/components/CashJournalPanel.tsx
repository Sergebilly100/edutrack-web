import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Loader2, ReceiptText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listClasses } from "@/modules/academic/academic.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { formatFcfa } from "@/shared/utils/formatting"
import { exportCashJournalExcel, exportCashJournalPdf, getCashJournal, type CashJournalFilter, type PaymentMethod } from "../finance.api"

const isoToday = () => new Date().toISOString().slice(0, 10)
const firstDayOfMonth = () => `${isoToday().slice(0, 8)}01`
const methods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Espèces" }, { value: "mobile_money", label: "Mobile Money" }, { value: "bank_transfer", label: "Virement" },
]
const JOURNAL_PAGE_SIZE = 20

export function CashJournalPanel({ schoolYearId }: { schoolYearId: string }) {
  const [from, setFrom] = useState(firstDayOfMonth())
  const [to, setTo] = useState(isoToday())
  const [classId, setClassId] = useState("all")
  const [method, setMethod] = useState<PaymentMethod | "all">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isExcelRunning, setIsExcelRunning] = useState(false)
  const filter: CashJournalFilter = { schoolYearId, from, to, classId: classId === "all" ? undefined : classId, method: method === "all" ? undefined : method }
  const journalQuery = useQuery({ queryKey: ["finance", "cash-journal", filter, currentPage], queryFn: () => getCashJournal({ ...filter, page: currentPage, limit: JOURNAL_PAGE_SIZE }), enabled: Boolean(schoolYearId && from && to) })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", schoolYearId], queryFn: () => listClasses(schoolYearId), enabled: Boolean(schoolYearId) })
  const pdf = usePdfExportJob({ fallbackFileName: "journal-caisse.pdf", startedMessage: "Le journal PDF est en préparation.", successMessage: "Journal PDF téléchargé" })
  const journal = journalQuery.data
  const totalEntries = journal?.pagination.total ?? 0
  const totalPages = journal?.pagination.totalPages ?? 1
  const currentLimit = journal?.pagination.limit ?? JOURNAL_PAGE_SIZE
  const pageStart = totalEntries === 0 ? 0 : ((journal?.pagination.page ?? currentPage) - 1) * currentLimit + 1
  const pageEnd = Math.min((journal?.pagination.page ?? currentPage) * currentLimit, totalEntries)

  useEffect(() => {
    setCurrentPage(1)
  }, [schoolYearId, from, to, classId, method])

  useEffect(() => {
    if (journal && currentPage !== journal.pagination.page) setCurrentPage(journal.pagination.page)
  }, [currentPage, journal])

  const downloadExcel = async () => {
    setIsExcelRunning(true)
    try { await exportCashJournalExcel(filter) } finally { setIsExcelRunning(false) }
  }

  return <section className="space-y-5">
    <div className="max-w-2xl space-y-1"><h2 className="text-xl font-semibold">Journal de caisse</h2><p className="text-sm text-muted-foreground">Paiements de scolarité, rapprochés par période, classe et mode.</p></div>
    <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="journal-from">Du</Label><Input id="journal-from" type="date" className="min-h-12" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="journal-to">Au</Label><Input id="journal-to" type="date" className="min-h-12" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></div>
      <div className="space-y-2"><Label>Classe</Label><Select value={classId} onValueChange={setClassId}><SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les classes</SelectItem>{classesQuery.data?.classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Mode</Label><Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod | "all")}><SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les modes</SelectItem>{methods.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {journal ? <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
      <div className="bg-blue-700 p-4 text-blue-50"><p className="text-xs text-blue-100">Total confirmé</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatFcfa(journal.totals.grandTotal)}</p></div>
      {methods.map((item) => <div key={item.value} className="bg-card p-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatFcfa(journal.totals[item.value])}</p></div>)}
    </div> : null}
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" className="min-h-12" disabled={isExcelRunning} onClick={() => void downloadExcel()}>{isExcelRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}Excel</Button><Button className="min-h-12" disabled={pdf.isRunning} onClick={() => void pdf.launch(() => exportCashJournalPdf(filter))}>{pdf.isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}PDF</Button></div>
    {journalQuery.isLoading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div> : null}
    {journalQuery.isError ? <QueryErrorState message="Impossible de charger le journal de caisse." onRetry={() => void journalQuery.refetch()} /> : null}
    {journal && journal.entries.length === 0 ? <EmptyState icon={ReceiptText} title="Aucun paiement sur cette période" message="Modifiez les filtres ou élargissez la période." /> : null}
    {journal && journal.entries.length > 0 ? <div className="space-y-4"><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Classe</TableHead><TableHead>Mode</TableHead><TableHead>Référence</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader><TableBody>{journal.entries.map((entry) => <TableRow key={entry.id}><TableCell>{new Intl.DateTimeFormat("fr-FR").format(new Date(`${entry.paymentDate}T00:00:00`))}</TableCell><TableCell><p className="font-medium">{entry.studentName}</p><p className="text-xs text-muted-foreground">{entry.studentMatricule ?? "Sans matricule"}</p></TableCell><TableCell>{entry.className}</TableCell><TableCell>{methods.find((item) => item.value === entry.method)?.label}</TableCell><TableCell>{entry.providerReference ?? entry.schoolReceiptReference ?? "—"}</TableCell><TableCell className="text-right font-semibold tabular-nums">{formatFcfa(entry.amount)}{entry.status === "cancelled" ? <Badge variant="outline" className="ml-2 border-red-200 bg-red-50 text-red-700">Annulé</Badge> : null}</TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">{pageStart}–{pageEnd} sur {totalEntries} écriture{totalEntries > 1 ? "s" : ""}</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="min-h-12" disabled={currentPage === 1 || journalQuery.isFetching} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Précédent</Button><span className="min-w-20 text-center tabular-nums" aria-live="polite">Page {journal.pagination.page} / {totalPages}</span><Button type="button" variant="outline" size="sm" className="min-h-12" disabled={journal.pagination.page === totalPages || journalQuery.isFetching} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Suivant<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div></div> : null}
  </section>
}
