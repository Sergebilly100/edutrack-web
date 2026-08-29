import { Link, useLocation } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DossierTimeline, useStudentDossier } from "@/modules/students/components/StudentDossierTimeline"
import { PageLayout } from "@/shared/components"

export default function StudentDossierPage({ studentId }: { studentId: string }) {
  const location = useLocation()
  const dossierQuery = useStudentDossier(studentId)
  const returnTo = typeof location.state === "object" && location.state !== null && "from" in location.state && typeof location.state.from === "string"
    ? location.state.from
    : "/academic/notes"

  if (dossierQuery.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-72 w-full" /></div>
  }

  if (dossierQuery.isError || !dossierQuery.data) {
    return <Alert variant="destructive"><AlertDescription>Ce dossier n’est pas accessible depuis vos classes actuelles.</AlertDescription></Alert>
  }

  const { student, events } = dossierQuery.data
  return (
    <PageLayout
      title={`Dossier de ${student.lastName} ${student.firstName}`}
      subtitle={`${student.className}${student.matricule ? ` · Matricule : ${student.matricule}` : ""}`}
      actions={<Button variant="outline" className="min-h-12" asChild><Link to={returnTo}>Retour à la saisie</Link></Button>}
    >
      <DossierTimeline events={events} />
    </PageLayout>
  )
}
