import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import axios from "axios"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { PageLayout } from "@/shared/components/PageLayout"
import { confirmEnrollmentPayment, getEnrollment } from "./enrollments.api"
import { enrollmentStatusLabel } from "./enrollments.helpers"

export default function EnrollmentPaymentPage() {
  const { enrollmentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const enrollmentQuery = useQuery({ queryKey: ["enrollments", "detail", enrollmentId], queryFn: () => getEnrollment(enrollmentId!), enabled: Boolean(enrollmentId) })
  const mutation = useMutation({ mutationFn: () => confirmEnrollmentPayment(enrollmentId!), onSuccess: async (result) => { await queryClient.invalidateQueries({ queryKey: ["enrollments"] }); toast({ title: "Paiement confirmé", description: result.documentWarning ?? "L’inscription est confirmée." }); navigate("/enrollments") }, onError: (error) => toast({ title: "Confirmation impossible", description: axios.isAxiosError(error) && typeof error.response?.data?.error === "string" ? error.response.data.error : "Le paiement n’a pas été confirmé.", variant: "destructive" }) })
  const enrollment = enrollmentQuery.data
  return <PageLayout title="Confirmation caisse" subtitle="Contrôlez le dossier avant de confirmer le passage en caisse." actions={<Button variant="outline" asChild><Link to="/enrollments"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link></Button>}><Card className="mx-auto max-w-2xl"><CardHeader><CardTitle className="text-xl">Paiement d’inscription</CardTitle></CardHeader><CardContent className="space-y-5">{enrollmentQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger cette inscription.</AlertDescription></Alert> : null}{enrollment ? <><div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">Classe</p><p className="font-medium">{enrollment.className}</p></div><div><p className="text-sm text-muted-foreground">Année scolaire</p><p className="font-medium">{enrollment.schoolYearLabel}</p></div><div><p className="text-sm text-muted-foreground">Statut</p><Badge variant="outline">{enrollmentStatusLabel[enrollment.status]}</Badge></div><div><p className="text-sm text-muted-foreground">Montant attendu</p><p className="font-semibold">À calculer lors de la Vague 4</p></div></div>{enrollment.status === "blocked_unpaid" ? <Alert variant="destructive"><AlertDescription>Cette réinscription est bloquée. Le parent doit se présenter dans l’établissement.</AlertDescription></Alert> : enrollment.status === "confirmed" ? <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>Le paiement de cette inscription est déjà confirmé.</AlertDescription></Alert> : <Button className="min-h-12 w-full" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{mutation.isPending ? "Confirmation…" : "Confirmer le paiement"}</Button>}</> : null}</CardContent></Card></PageLayout>
}
