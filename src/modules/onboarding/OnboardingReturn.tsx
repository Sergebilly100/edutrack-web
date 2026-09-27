import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { fetchSchoolInfo } from "./onboarding.api"
import { onboardingReturn } from "./onboarding.progress"
import { useAuthStore } from "@/shared/store/auth.store"

export function useOnboardingContext() {
  const { search } = useLocation()
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const canConfigure = user?.role === "director" || permissions.includes("settings.school")
  const requested = new URLSearchParams(search).has("returnTo")
  const school = useQuery({
    queryKey: ["school-info", user?.schemaName, user?.tenantId], queryFn: fetchSchoolInfo,
    enabled: requested && canConfigure, staleTime: 0, refetchOnMount: "always",
    // Returning from the native file picker must not reset the import form.
    refetchOnWindowFocus: false,
  })
  return {
    target: canConfigure && school.isSuccess && !school.isFetching ? onboardingReturn(search, school.data.id) : null,
    checking: requested && canConfigure && (school.isPending || school.isFetching),
    error: requested && canConfigure && school.isError,
    retry: school.refetch,
  }
}

export function useOnboardingReturn() { return useOnboardingContext().target }

export function OnboardingReturn() {
  const target = useOnboardingReturn()
  if (!target) return null
  return <Button asChild variant="outline" className="min-h-[48px]"><Link to={target}>Retour à la configuration initiale</Link></Button>
}
