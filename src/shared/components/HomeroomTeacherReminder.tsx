import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listClasses } from "@/modules/academic/academic.api"
import { usePermissions } from "@/shared/hooks/usePermissions"

export function HomeroomTeacherReminder() {
  const { hasPermission } = usePermissions()
  const canViewClasses = hasPermission("classes.view")
  const classesQuery = useQuery({
    queryKey: ["academic", "classes", "homeroom-reminder"],
    queryFn: () => listClasses(),
    enabled: canViewClasses,
    staleTime: 30_000,
    retry: false,
  })

  if (!canViewClasses) return null
  if (classesQuery.isLoading) return <Skeleton className="h-16 w-full" role="status" aria-label="Vérification des professeurs principaux" />
  if (classesQuery.isError) return (
    <Alert>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>Impossible de vérifier les professeurs principaux.</span>
        <Button type="button" variant="outline" className="min-h-12" onClick={() => void classesQuery.refetch()}>Réessayer</Button>
      </AlertDescription>
    </Alert>
  )

  const activeYearId = classesQuery.data?.activeSchoolYear?.id
  const missing = (classesQuery.data?.classes ?? [])
    .filter((schoolClass) => activeYearId && schoolClass.isActive && schoolClass.schoolYear.id === activeYearId && !schoolClass.homeroomTeacher)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
  if (!missing.length) return null

  const names = missing.slice(0, 3).map((schoolClass) => schoolClass.name).join(", ")
  return (
    <Alert>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <AlertTitle>Rappel : classes sans professeur principal</AlertTitle>
          <AlertDescription>
            {missing.length === 1 ? "1 classe de l’année active est concernée" : `${missing.length} classes de l’année active sont concernées`} : {names}{missing.length > 3 ? ` et ${missing.length - 3} ${missing.length === 4 ? "autre" : "autres"}` : ""}.
          </AlertDescription>
        </div>
        <Button asChild variant="outline" className="min-h-12 shrink-0">
          <Link to="/academic/classes">Ouvrir l’onglet Classes</Link>
        </Button>
      </div>
    </Alert>
  )
}
