import { AlertCircle, ArrowLeft } from "lucide-react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AppShell } from "@/shared/components/layout/AppShell"
import { useAuthStore } from "@/shared/store/auth.store"
import { fetchSchoolInfo } from "./onboarding.api"
import { onboardingFocusStep, onboardingReturn, onboardingStepLabels } from "./onboarding.progress"
import { OnboardingContextProvider } from "./OnboardingReturn"

export default function OnboardingFocusLayout() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const canConfigure = user?.role === "director"
  const requested = new URLSearchParams(location.search).has("returnTo")
  const school = useQuery({
    queryKey: ["school-info", user?.schemaName, user?.tenantId],
    queryFn: fetchSchoolInfo,
    enabled: canConfigure && requested,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  const schoolId = school.data?.id
  const focusStep = canConfigure && requested && schoolId
    ? onboardingFocusStep(location.pathname, location.search, schoolId)
    : null
  const target = focusStep && schoolId ? onboardingReturn(location.search, schoolId) : null

  if (!canConfigure || !requested) {
    return <AppShell />
  }

  if (school.isPending) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <Skeleton className="mb-6 h-16 w-full" aria-label="Vérification du retour à la configuration" />
        <Skeleton className="mx-auto h-72 w-full max-w-6xl" />
      </div>
    )
  }

  if (school.isError && !school.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Impossible de vérifier l’école associée à ce retour.
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void school.refetch()}>
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!target || !focusStep) return <AppShell />

  return (
    <OnboardingContextProvider value={{ target, focusStep, schoolId: schoolId ?? null }}>
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-30 border-b border-border bg-primary/10 text-foreground dark:bg-primary/15">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6">
            <Button asChild type="button" variant="outline" className="min-h-12 bg-background">
              <Link to={target}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la configuration
              </Link>
            </Button>
            <p className="text-sm font-semibold" aria-label={`Étape ${focusStep} sur 5`}>
              Étape {focusStep} sur 5 · {onboardingStepLabels[focusStep - 1]}
            </p>
          </div>
        </header>

        {school.isError ? (
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                Impossible d’actualiser les informations de l’école. La page reste disponible avec les données déjà chargées.
                <Button type="button" variant="outline" className="min-h-12" onClick={() => void school.refetch()}>
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 py-3">
          <div className="mx-auto flex w-full max-w-7xl justify-end">
            <Button asChild className="min-h-12 w-full sm:w-auto">
              <Link to={target}>Terminer et revenir à l&apos;assistant</Link>
            </Button>
          </div>
        </footer>
      </div>
    </OnboardingContextProvider>
  )
}
