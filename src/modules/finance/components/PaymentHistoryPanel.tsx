import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Ban, Download, Loader2, ReceiptText } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import type { StudentItem } from "@/modules/students/students.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { usePdfExportJob } from "@/shared/hooks/usePdfExportJob"
import { formatFcfa } from "@/shared/utils/formatting"
import { cancelPayment, getFinancialStatus, getStudentAccountStatement, requestPaymentReceipt, type Payment } from "../finance.api"
import { StudentSearch } from "./StudentSearch"

const methodLabels: Record<Payment["method"], string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
}

const sourceLabels: Record<Payment["source"], string> = {
  cashier_manual: "Saisie manuelle",
  in_app_button: "Paiement en ligne",
  bulk_import: "Import courant",
  migration_import: "Solde de départ",
}

const formatDate = (value: string): string =>
  value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date inconnue"

type PaymentHistoryPanelProps = {
  schoolYearId: string
  schoolYearLabel: string
  canCancel: boolean
}

export function PaymentHistoryPanel({ schoolYearId, schoolYearLabel, canCancel }: PaymentHistoryPanelProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [student, setStudent] = useState<StudentItem | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const statusQuery = useQuery({
    queryKey: ["finance", "financial-status", student?.id, schoolYearId],
    queryFn: () => getFinancialStatus(student!.id, schoolYearId),
    enabled: Boolean(student && schoolYearId),
  })
  const paymentsQuery = useQuery({
    queryKey: ["finance", "account-statement", student?.id, schoolYearId],
    queryFn: () => getStudentAccountStatement(student!.id, schoolYearId),
    enabled: Boolean(student && schoolYearId),
  })
  const receipt = usePdfExportJob({
    fallbackFileName: "recu-paiement.pdf",
    startedMessage: "Le reçu est en cours de préparation.",
    successMessage: "Reçu téléchargé",
    errorMessage: "Impossible de générer le reçu.",
  })
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason: cancellationReason }: { id: string; reason: string }) => cancelPayment(id, cancellationReason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "account-statement", student?.id, schoolYearId] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "financial-status", student?.id, schoolYearId] }),
      ])
      setCancelTarget(null)
      setReason("")
      toast({ title: "Paiement annulé", description: "La transaction reste visible dans l’historique." })
    },
    onError: (error) => toast({ title: "Annulation impossible", description: error instanceof Error ? error.message : "Réessayez.", variant: "destructive" }),
  })
  const payments = paymentsQuery.data?.movements ?? []

  return (
    <section className="space-y-5">
      <div className="max-w-2xl space-y-1">
        <h2 className="text-xl font-semibold">Historique élève</h2>
        <p className="text-sm text-muted-foreground">Consultez le cumul, téléchargez les reçus et annulez une erreur sans effacer sa trace.</p>
      </div>

      <div className="max-w-xl space-y-2">
        <Label>Élève</Label>
        <StudentSearch value={student} onChange={setStudent} placeholder="Rechercher par nom ou matricule" />
        <p className="text-xs text-muted-foreground">Année scolaire {schoolYearLabel}</p>
      </div>

      {!student ? <EmptyState icon={ReceiptText} title="Choisissez un élève" message="Sa situation financière et ses paiements apparaîtront ici." /> : null}

      {student && (statusQuery.isError || paymentsQuery.isError) ? (
        <QueryErrorState
          message="Impossible de charger le dossier financier de cet élève."
          onRetry={() => { void statusQuery.refetch(); void paymentsQuery.refetch() }}
          isRetrying={statusQuery.isFetching || paymentsQuery.isFetching}
        />
      ) : null}

      {student && statusQuery.data ? (
        <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
          <div className="bg-blue-700 p-4 text-blue-50"><p className="text-xs text-blue-100">Total dû</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatFcfa(statusQuery.data.totalDue)}</p></div>
          <div className="bg-card p-4"><p className="text-xs text-muted-foreground">Cumul versé</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatFcfa(statusQuery.data.confirmedPaid)}</p></div>
          <div className="bg-card p-4"><p className="text-xs text-muted-foreground">Reste à payer</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatFcfa(statusQuery.data.remainingDue)}</p></div>
          <div className="bg-card p-4"><p className="text-xs text-muted-foreground">Situation à date</p><Badge variant="outline" className={statusQuery.data.standing === "late" ? "mt-2 border-amber-200 bg-amber-50 text-amber-700" : "mt-2 border-green-200 bg-green-50 text-green-700"}>{statusQuery.data.standing === "late" ? "En retard" : "À jour"}</Badge></div>
        </div>
      ) : null}

      {student && !paymentsQuery.isLoading && payments.length === 0 && !paymentsQuery.isError ? (
        <EmptyState icon={ReceiptText} title="Aucun paiement" message="Aucun versement n’est enregistré pour cette année scolaire." />
      ) : null}

      {student && payments.length > 0 ? (
        <div className="space-y-3">
          {payments.map((payment) => (
            <Card key={payment.id} className={payment.status === "cancelled" ? "bg-muted/30" : ""}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tabular-nums">{formatFcfa(payment.amount)}</p>
                      <Badge variant="outline" className={payment.status === "cancelled" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}>{payment.status === "cancelled" ? "Annulé" : "Confirmé"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDate(`${payment.paymentDate}T00:00:00`)} · {methodLabels[payment.method]} · {sourceLabels[payment.source]}</p>
                    <p className="text-xs text-muted-foreground">Reçu {payment.receiptNumber}{payment.schoolReceiptReference ? ` · Réf. école ${payment.schoolReceiptReference}` : ""}</p>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Solde après mouvement : {formatFcfa(payment.balanceAfter)}</p>
                    {payment.cancellationReason ? <p className="mt-2 text-sm text-red-700">Motif d’annulation : {payment.cancellationReason}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {payment.status !== "cancelled" ? (
                      <Button type="button" variant="outline" className="min-h-12" disabled={receipt.isRunning} onClick={() => void receipt.launch(() => requestPaymentReceipt(payment.id))}>
                        {receipt.isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Reçu
                      </Button>
                    ) : null}
                    {canCancel && payment.status !== "cancelled" ? (
                      <Button type="button" variant="outline" className="min-h-12 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => { setCancelTarget(payment.id); setReason("") }}><Ban className="mr-2 h-4 w-4" />Annuler</Button>
                    ) : null}
                  </div>
                </div>
                {cancelTarget === payment.id ? (
                  <div className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
                    <div className="flex gap-2 text-sm text-red-800 dark:text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Cette action est définitive. Le paiement restera visible avec votre justification.</p></div>
                    <div className="space-y-1.5"><Label htmlFor={`cancel-${payment.id}`}>Justification obligatoire</Label><Textarea id={`cancel-${payment.id}`} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Ex. paiement attribué au mauvais élève" /></div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" className="min-h-12" onClick={() => setCancelTarget(null)}>Conserver le paiement</Button><Button type="button" variant="destructive" className="min-h-12" disabled={!reason.trim() || cancelMutation.isPending} onClick={() => cancelMutation.mutate({ id: payment.id, reason: reason.trim() })}>{cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirmer l’annulation</Button></div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {statusQuery.data?.standing === "late" ? <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Le cumul versé est inférieur au seuil attendu à ce jour ({formatFcfa(statusQuery.data.cumulativeExpectedAtDate)}).</AlertDescription></Alert> : null}
    </section>
  )
}
