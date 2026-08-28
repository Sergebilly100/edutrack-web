import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, Loader2, ReceiptText } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { PageLayout } from "@/shared/components/PageLayout"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { formatFcfa } from "@/shared/utils/formatting"
import { confirmEnrollmentPayment, getEnrollmentPaymentSummary } from "./enrollments.api"
import { enrollmentStatusLabel } from "./enrollments.helpers"

type PaymentMethod = "cash" | "mobile_money" | "bank_transfer"

export default function EnrollmentPaymentPage() {
  const { enrollmentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [amount, setAmount] = useState("")
  const [providerReference, setProviderReference] = useState("")
  const [schoolReceiptReference, setSchoolReceiptReference] = useState("")
  const summaryQuery = useQuery({
    queryKey: ["enrollments", "payment-summary", enrollmentId],
    queryFn: () => getEnrollmentPaymentSummary(enrollmentId!),
    enabled: Boolean(enrollmentId),
  })
  const mutation = useMutation({
    mutationFn: () => confirmEnrollmentPayment(enrollmentId!, {
      amount: Number(amount),
      method,
      ...(providerReference.trim() ? { providerReference: providerReference.trim() } : {}),
      schoolReceiptReference: schoolReceiptReference.trim(),
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] })
      toast({ title: "Paiement confirmé", description: result.documentWarning ?? "Le paiement et l’inscription sont confirmés." })
      navigate("/enrollments")
    },
    onError: (error) => toast({ title: "Confirmation impossible", description: error instanceof Error ? error.message : "Le paiement n’a pas été confirmé.", variant: "destructive" }),
  })
  const summary = summaryQuery.data
  const enrollment = summary?.enrollment
  const paymentAmount = Number(amount)
  const amountIsValid = Number.isFinite(paymentAmount) && paymentAmount > 0 && Boolean(summary) && paymentAmount <= summary!.amountDue
  const receiptReferenceIsValid = schoolReceiptReference.trim().length > 0

  return (
    <PageLayout
      title="Confirmation caisse"
      subtitle="Enregistrez le paiement déjà effectué par le parent à partir du reçu présenté."
      actions={<Button variant="outline" asChild className="min-h-12"><Link to="/enrollments"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link></Button>}
    >
      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><ReceiptText className="h-5 w-5 text-primary" />Paiement d’inscription</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {summaryQuery.isError ? <QueryErrorState message="Impossible de calculer le montant dû. Vérifiez qu’un plan de frais existe pour ce niveau et cette année scolaire." onRetry={() => void summaryQuery.refetch()} isRetrying={summaryQuery.isFetching} /> : null}
          {summary ? (
            <>
              <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
                <div className="bg-card p-4"><p className="text-sm text-muted-foreground">Classe</p><p className="font-medium">{enrollment?.className}</p></div>
                <div className="bg-card p-4"><p className="text-sm text-muted-foreground">Année scolaire</p><p className="font-medium">{enrollment?.schoolYearLabel}</p></div>
                <div className="bg-card p-4"><p className="text-sm text-muted-foreground">Statut</p><Badge variant="outline" className="mt-1">{enrollment ? enrollmentStatusLabel[enrollment.status] : ""}</Badge></div>
                <div className="bg-blue-700 p-4 text-blue-50"><p className="text-sm text-blue-100">Reste de scolarité</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatFcfa(summary.amountDue)}</p>{summary.confirmedPaid > 0 ? <p className="mt-1 text-xs text-blue-100">{formatFcfa(summary.confirmedPaid)} déjà versés</p> : <p className="mt-1 text-xs text-blue-100">Scolarité totale : {formatFcfa(summary.totalDue)}</p>}</div>
              </div>

              {enrollment?.status === "blocked_unpaid" ? (
                <Alert variant="destructive"><AlertDescription>Cette réinscription est bloquée par un impayé antérieur. Le solde concerné doit d’abord être régularisé.</AlertDescription></Alert>
              ) : enrollment?.status === "confirmed" ? (
                <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>Le paiement de cette inscription est déjà confirmé.</AlertDescription></Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="enrollment-payment-amount">Montant reçu *</Label>
                    <div className="relative"><Input id="enrollment-payment-amount" inputMode="numeric" className="min-h-12 pr-16 text-lg font-semibold tabular-nums" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} placeholder="Ex. 25000" aria-describedby="enrollment-payment-amount-help" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">FCFA</span></div>
                    <p id="enrollment-payment-amount-help" className="text-sm text-muted-foreground">Tout montant positif jusqu’à {formatFcfa(summary.amountDue)} est accepté.</p>
                    {paymentAmount > summary.amountDue ? <p className="text-sm text-destructive" role="alert">Le montant saisi dépasse le reste de scolarité.</p> : null}
                  </div>
                  <div className="space-y-2"><Label htmlFor="enrollment-payment-method">Mode de paiement</Label><Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}><SelectTrigger id="enrollment-payment-method" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Espèces</SelectItem><SelectItem value="mobile_money">Mobile Money vérifié en caisse</SelectItem><SelectItem value="bank_transfer">Virement bancaire</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor="school-receipt-reference">Référence du reçu de caisse *</Label><Input id="school-receipt-reference" className="min-h-12" value={schoolReceiptReference} onChange={(event) => setSchoolReceiptReference(event.target.value)} placeholder="Ex. RC-2026-0042" autoComplete="off" /><p className="text-sm text-muted-foreground">Recopiez la référence du reçu présenté par le parent.</p></div>
                  <div className="space-y-2"><Label htmlFor="provider-reference">Référence du versement (facultative)</Label><Input id="provider-reference" className="min-h-12" value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder={method === "mobile_money" ? "Référence de transaction Mobile Money" : method === "bank_transfer" ? "Référence du virement bancaire" : "Référence complémentaire, si disponible"} /></div>
                  <Button className="min-h-12 w-full" disabled={mutation.isPending || !amountIsValid || !receiptReferenceIsValid} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{mutation.isPending ? "Enregistrement…" : amountIsValid ? `Enregistrer ${formatFcfa(paymentAmount)}` : "Saisir le montant reçu"}</Button>
                </>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
