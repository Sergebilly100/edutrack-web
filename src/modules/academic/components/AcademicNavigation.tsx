import { useLocation, useNavigate } from "react-router-dom"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermissions } from "@/shared/hooks/usePermissions"

const ACADEMIC_ROUTES = {
  schoolYears: "/academic/school-years",
  levels: "/academic/levels",
  classes: "/academic/classes",
  subjects: "/academic/subjects",
} as const

export function AcademicNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canViewSchoolYears = hasPermission("school_years.view")
  const canViewClasses = hasPermission("classes.view")
  const currentRoute = Object.values(ACADEMIC_ROUTES).includes(
    location.pathname as (typeof ACADEMIC_ROUTES)[keyof typeof ACADEMIC_ROUTES]
  )
    ? location.pathname
    : canViewSchoolYears
      ? ACADEMIC_ROUTES.schoolYears
      : ACADEMIC_ROUTES.classes

  return (
    <Tabs value={currentRoute} onValueChange={(value) => navigate(value)}>
      <TabsList className="h-auto w-full justify-start overflow-x-auto">
        {canViewSchoolYears ? (
          <TabsTrigger value={ACADEMIC_ROUTES.schoolYears} className="min-h-10">
            Années scolaires
          </TabsTrigger>
        ) : null}
        {canViewClasses ? (
          <>
            <TabsTrigger value={ACADEMIC_ROUTES.levels} className="min-h-10">
              Niveaux
            </TabsTrigger>
            <TabsTrigger value={ACADEMIC_ROUTES.classes} className="min-h-10">
              Classes
            </TabsTrigger>
            <TabsTrigger value={ACADEMIC_ROUTES.subjects} className="min-h-10">
              Matières
            </TabsTrigger>
          </>
        ) : null}
      </TabsList>
    </Tabs>
  )
}
