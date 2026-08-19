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
  const [providerReference, setProviderReference] = useState("")
  const [schoolReceiptReference, setSchoolReceiptReference] = useState("")
  const summaryQuery = useQuery({
    queryKey: ["enrollments", "payment-summary", enrollmentId],
    queryFn: () => getEnrollmentPaymentSummary(enrollmentId!),
    enabled: Boolean(enrollmentId),
  })
  const mutation = useMutation({
    mutationFn: () => confirmEnrollmentPayment(enrollmentId!, {
      method,
      ...(providerReference.trim() ? { providerReference: providerReference.trim() } : {}),
      ...(schoolReceiptReference.trim() ? { schoolReceiptReference: schoolReceiptReference.trim() } : {}),
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

  return (
    <PageLayout
      title="Confirmation caisse"
      subtitle="Contrôlez le montant réellement dû et le mode de règlement avant validation."
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
                <div className="bg-blue-700 p-4 text-blue-50"><p className="text-sm text-blue-100">Montant à encaisser</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatFcfa(summary.amountDue)}</p>{summary.confirmedPaid > 0 ? <p className="mt-1 text-xs text-blue-100">{formatFcfa(summary.confirmedPaid)} déjà versés</p> : null}</div>
              </div>

              {enrollment?.status === "blocked_unpaid" ? (
                <Alert variant="destructive"><AlertDescription>Cette réinscription est bloquée par un impayé antérieur. Le solde concerné doit d’abord être régularisé.</AlertDescription></Alert>
              ) : enrollment?.status === "confirmed" ? (
                <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>Le paiement de cette inscription est déjà confirmé.</AlertDescription></Alert>
              ) : (
                <>
                  <div className="space-y-2"><Label htmlFor="enrollment-payment-method">Mode de paiement</Label><Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}><SelectTrigger id="enrollment-payment-method" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Espèces</SelectItem><SelectItem value="mobile_money">Mobile Money vérifié en caisse</SelectItem><SelectItem value="bank_transfer">Virement bancaire</SelectItem></SelectContent></Select></div>
                  {method !== "cash" ? <div className="space-y-2"><Label htmlFor="provider-reference">Référence du versement</Label><Input id="provider-reference" className="min-h-12" value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Référence opérateur ou bancaire" /></div> : null}
                  <div className="space-y-2"><Label htmlFor="school-receipt-reference">Référence du carnet de caisse (facultatif)</Label><Input id="school-receipt-reference" className="min-h-12" value={schoolReceiptReference} onChange={(event) => setSchoolReceiptReference(event.target.value)} placeholder="Ex. CARNET-042" /></div>
                  <Button className="min-h-12 w-full" disabled={mutation.isPending || summary.amountDue <= 0 || (method !== "cash" && !providerReference.trim())} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{mutation.isPending ? "Confirmation…" : `Confirmer ${formatFcfa(summary.amountDue)}`}</Button>
                </>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
