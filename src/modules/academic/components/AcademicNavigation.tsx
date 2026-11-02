import { useLocation, useNavigate } from "react-router-dom"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useOnboardingContext } from "@/modules/onboarding/OnboardingReturn"
import { configurationLink } from "@/modules/onboarding/onboarding.progress"

const ACADEMIC_ROUTES = {
  schoolYears: "/academic/school-years",
  levels: "/academic/levels",
  classes: "/academic/classes",
  subjects: "/academic/subjects",
} as const

export function AcademicNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const onboardingContext = useOnboardingContext()
  const { hasPermission } = usePermissions()
  const canViewSchoolYears = hasPermission("school_years.view")
  const canViewClasses = hasPermission("classes.view")
  const isOnboardingFocus = Boolean(onboardingContext.target)
  const visibleTabCount = Number(canViewSchoolYears) + (canViewClasses ? (isOnboardingFocus ? 2 : 3) : 0)
  const navigateToAcademicPage = (path: string) => {
    const target = onboardingContext.target && onboardingContext.schoolId && onboardingContext.focusStep
      ? configurationLink(path, onboardingContext.schoolId, onboardingContext.focusStep)
      : path
    navigate(target)
  }
  const currentRoute = Object.values(ACADEMIC_ROUTES).includes(
    location.pathname as (typeof ACADEMIC_ROUTES)[keyof typeof ACADEMIC_ROUTES]
  )
    ? location.pathname
    : canViewSchoolYears
      ? ACADEMIC_ROUTES.schoolYears
      : ACADEMIC_ROUTES.classes

  return (
    <Tabs value={currentRoute} onValueChange={navigateToAcademicPage}>
      <TabsList className={`h-auto w-full justify-start overflow-x-auto grid h-auto w-full rounded-xl border border-border ${visibleTabCount === 2 ? "grid-cols-2" : visibleTabCount === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {canViewSchoolYears ? (
          <TabsTrigger value={ACADEMIC_ROUTES.schoolYears} className="min-h-12">
            Années scolaires
          </TabsTrigger>
        ) : null}
        {canViewClasses ? (
          <>
            <TabsTrigger value={ACADEMIC_ROUTES.levels} className="min-h-12">
              Niveaux
            </TabsTrigger>
            <TabsTrigger value={ACADEMIC_ROUTES.subjects} className="min-h-12">
              Matières
            </TabsTrigger>
            {!isOnboardingFocus ? (
              <TabsTrigger value={ACADEMIC_ROUTES.classes} className="min-h-12">
                Classes
              </TabsTrigger>
            ) : null}
          </>
        ) : null}
      </TabsList>
    </Tabs>
  )
}
