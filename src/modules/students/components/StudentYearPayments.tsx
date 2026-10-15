import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listPayments } from "@/modules/finance/finance.api"
import { EmptyState } from "@/shared/components/EmptyState"
import { QueryErrorState } from "@/shared/components/QueryErrorState"
import { formatFcfa } from "@/shared/utils/formatting"

const statusLabel = { confirmed: "Paiement confirmé", cancelled: "Mouvement annulé" } as const

export function StudentYearPayments({ studentId, schoolYearId, schoolYearLabel }: { studentId: string; schoolYearId: string; schoolYearLabel: string }) {
  const query = useQuery({
    queryKey: ["students", studentId, "year-payments", schoolYearId],
    queryFn: () => listPayments(studentId, schoolYearId),
  })

  if (query.isLoading) return <Skeleton className="h-36 w-full" aria-label="Chargement des paiements" />
  if (query.isError) return <QueryErrorState title="Mouvements indisponibles" message={`Impossible de charger les paiements de ${schoolYearLabel}.`} onRetry={() => void query.refetch()} />
  if (!query.data?.length) return <EmptyState title="Aucun mouvement financier" description={`Aucun paiement ni remise enregistré pour ${schoolYearLabel}.`} />

  return <Card>
    <CardHeader><CardTitle className="text-base">Paiements · {schoolYearLabel}</CardTitle></CardHeader>
    <CardContent className="space-y-2">
      {query.data.map((payment) => <div key={payment.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
        <div><p className="font-medium">{statusLabel[payment.status]}</p><p className="text-muted-foreground">{payment.paymentDate} · {payment.receiptNumber || "Sans numéro de reçu"}</p></div>
        <strong className="tabular-nums">{formatFcfa(payment.amount)}</strong>
      </div>)}
    </CardContent>
  </Card>
}
