import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Download, Loader2, ReceiptText, Smartphone } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { formatFcfa } from "@/shared/utils/formatting"
import { fetchParentSchoolConfig, listParentStudents } from "./parent.api"
import {
  getParentFinancialStatus,
  getParentPaymentOptions,
  listParentPayments,
  requestParentPaymentReceipt,
  type Payment,
  type PaymentProvider,
} from "@/modules/finance/finance.api"

const providerLabels: Record<PaymentProvider, string> = {
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  moov_money: "Moov Money",
  wave: "Wave",
}

const methodLabels: Record<Payment["method"], string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
}

const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value))

export default function ParentPaymentsPage() {
  const studentsQuery = useQuery({ queryKey: ["parent", "students"], queryFn: listParentStudents })
  const schoolConfigQuery = useQuery({ queryKey: ["parent", "school-config"], queryFn: fetchParentSchoolConfig })
  const optionsQuery = useQuery({ queryKey: ["parent", "payment-options"], queryFn: getParentPaymentOptions })
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const students = studentsQuery.data ?? []
  const studentId = selectedStudentId || students[0]?.id || ""
  const schoolYearId = schoolConfigQuery.data?.activeSchoolYear ?? ""
  const statusQuery = useQuery({
    queryKey: ["parent", "financial-status", studentId, schoolYearId],
    queryFn: () => getParentFinancialStatus(studentId, schoolYearId),
    enabled: Boolean(studentId && schoolYearId),
  })
  const paymentsQuery = useQuery({
    queryKey: ["parent", "payments", studentId, schoolYearId],
    queryFn: () => listParentPayments(studentId, schoolYearId),
    enabled: Boolean(studentId && schoolYearId),
  })
  const receipt = usePdfExportJob({ fallbackFileName: "recu-paiement.pdf", startedMessage: "Votre reçu est en cours de préparation.", successMessage: "Reçu téléchargé" })
  const payments = paymentsQuery.data ?? []

  return (
    <div className="animate-fade-in space-y-5 py-5 sm:py-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">Frais et paiements</h1><p className="mt-1 text-sm text-muted-foreground">Consultez les versements reconnus par l’établissement et téléchargez vos reçus.</p></div>
        {students.length > 1 ? <Select value={studentId} onValueChange={setSelectedStudentId}><SelectTrigger className="min-h-12 w-full sm:w-64" aria-label="Enfant"><SelectValue /></SelectTrigger><SelectContent>{students.map((student) => <SelectItem key={student.id} value={student.id}>{student.last_name} {student.first_name}</SelectItem>)}</SelectContent></Select> : null}
      </div>

      {studentsQuery.isError || schoolConfigQuery.isError ? <QueryErrorState message="Impossible de charger le dossier financier." onRetry={() => { void studentsQuery.refetch(); void schoolConfigQuery.refetch() }} /> : null}

      {statusQuery.data ? (
        <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3" aria-label="Situation financière">
          <div className="bg-blue-700 p-4 text-blue-50"><p className="text-xs text-blue-100">Total des frais</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatFcfa(statusQuery.data.totalDue)}</p></div>
          <div className="bg-card p-4"><p className="text-xs text-muted-foreground">Déjà versé</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatFcfa(statusQuery.data.confirmedPaid)}</p></div>
          <div className="bg-card p-4"><p className="text-xs text-muted-foreground">Reste à payer</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatFcfa(statusQuery.data.remainingDue)}</p><Badge variant="outline" className={statusQuery.data.standing === "late" ? "mt-2 border-amber-200 bg-amber-50 text-amber-700" : "mt-2 border-green-200 bg-green-50 text-green-700"}>{statusQuery.data.standing === "late" ? "Cumul en retard" : "Cumul à jour"}</Badge></div>
        </section>
      ) : null}

      {statusQuery.isError ? <QueryErrorState message="La situation financière n’est pas disponible. Contactez l’établissement si le problème persiste." onRetry={() => void statusQuery.refetch()} /> : null}

      <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Smartphone className="h-5 w-5" /></div><div><h2 className="font-semibold">Comment effectuer un versement ?</h2><p className="mt-1 text-sm text-muted-foreground">Le paiement direct dans IvoirEdu est temporairement indisponible. Utilisez l’un des numéros ci-dessous ou passez à la caisse. Le staff enregistrera ensuite le versement.</p></div></div>
        {(optionsQuery.data?.manualPaymentChannels ?? []).length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{optionsQuery.data?.manualPaymentChannels.map((channel) => <div key={`${channel.provider}-${channel.merchantNumber}`} className="rounded-lg border bg-muted/20 px-4 py-3"><p className="text-xs text-muted-foreground">{providerLabels[channel.provider]}</p><p className="mt-1 font-semibold tracking-wide">{channel.merchantNumber}</p></div>)}</div> : <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Aucun numéro de versement n’est publié. Contactez directement l’établissement ou présentez-vous à la caisse.</AlertDescription></Alert>}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">Historique des paiements</h2><p className="text-sm text-muted-foreground">Les paiements annulés restent visibles pour garantir la traçabilité.</p></div>
        {paymentsQuery.isError ? <QueryErrorState message="Impossible de charger les paiements." onRetry={() => void paymentsQuery.refetch()} /> : null}
        {!paymentsQuery.isLoading && payments.length === 0 && !paymentsQuery.isError ? <EmptyState icon={ReceiptText} title="Aucun paiement enregistré" message="Les versements reconnus par l’établissement apparaîtront ici." /> : null}
        {payments.map((payment) => (
          <div key={payment.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-semibold tabular-nums">{formatFcfa(payment.amount)}</p>{payment.status === "cancelled" ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Annulé</Badge> : <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />Confirmé</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{formatDate(payment.createdAt)} · {methodLabels[payment.method]}</p><p className="mt-1 text-xs text-muted-foreground">Reçu {payment.receiptNumber}</p>{payment.cancellationReason ? <p className="mt-2 text-sm text-red-700">Motif : {payment.cancellationReason}</p> : null}</div>
            {payment.status !== "cancelled" ? <Button type="button" variant="outline" className="min-h-12 shrink-0" disabled={receipt.isRunning} onClick={() => void receipt.launch(() => requestParentPaymentReceipt(studentId, payment.id))}>{receipt.isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Télécharger le reçu</Button> : null}
          </div>
        ))}
      </section>
    </div>
  )
}
