import { ArrowLeft } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PageLayout } from "@/shared/components/PageLayout"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { DocumentChecklist } from "./components/DocumentChecklist"

export default function EnrollmentDocumentsPage() {
  const { studentId } = useParams()
  const { hasPermission } = usePermissions()
  return <PageLayout title="Vérification du dossier" subtitle="Ajoutez les pièces reçues, marquez celles à renouveler puis validez la vérification." actions={<Button variant="outline" asChild><Link to="/enrollments"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link></Button>}><div className="mx-auto max-w-4xl">{studentId ? <DocumentChecklist studentId={studentId} canEdit={hasPermission("enrollments.edit")} /> : <Alert variant="destructive"><AlertDescription>Dossier élève introuvable.</AlertDescription></Alert>}</div></PageLayout>
}
