import { useQuery } from "@tanstack/react-query"
import { BookOpenCheck, FileText, GraduationCap, ReceiptText, UserRoundCheck } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { getStudentDossier, type StudentDossier, type StudentDossierEvent } from "@/modules/students/students.api"

const eventPresentation: Record<StudentDossierEvent["type"], { icon: typeof GraduationCap; className: string }> = {
  enrollment: { icon: UserRoundCheck, className: "bg-blue-50 text-blue-700" },
  payment: { icon: ReceiptText, className: "bg-green-50 text-green-700" },
  report_card: { icon: GraduationCap, className: "bg-violet-50 text-violet-700" },
  absence: { icon: BookOpenCheck, className: "bg-amber-50 text-amber-700" },
  document: { icon: FileText, className: "bg-slate-50 text-slate-700" },
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("fr-CI", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${value}T00:00:00Z`)
  )

export function useStudentDossier(studentId: string) {
  return useQuery({
    queryKey: ["students", "dossier", studentId],
    queryFn: () => getStudentDossier(studentId),
    enabled: studentId.trim().length > 0,
  })
}

export function DossierTimeline({ events }: { events: StudentDossierEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Aucun événement au dossier"
        description="Les inscriptions, absences, bulletins et documents apparaîtront ici au fil de l’année."
      />
    )
  }

  return (
    <ol className="divide-y rounded-lg border bg-card" aria-label="Chronologie du dossier élève">
      {events.map((event, index) => {
        const presentation = eventPresentation[event.type]
        const Icon = presentation.icon
        return (
          <li key={`${event.type}-${event.date}-${event.label}-${index}`} className="flex gap-3 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${presentation.className}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p className="font-medium">{event.label}</p>
                <time className="shrink-0 text-sm text-muted-foreground" dateTime={event.date}>{formatDate(event.date)}</time>
              </div>
              {event.detail ? <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function StudentDossierTimeline({ studentId }: { studentId: string }) {
  const dossierQuery = useStudentDossier(studentId)

  if (dossierQuery.isLoading) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4" aria-label="Chargement du dossier">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
      </div>
    )
  }

  if (dossierQuery.isError) {
    return <Alert variant="destructive"><AlertDescription>Impossible de charger le dossier de cet élève. Vérifiez votre connexion puis réessayez.</AlertDescription></Alert>
  }

  return <DossierTimeline events={dossierQuery.data?.events ?? []} />
}
