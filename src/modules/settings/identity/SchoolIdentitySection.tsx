import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { fetchSchoolIdentity, type SchoolIdentity } from "../settings.api"
import { LogoCard, LogoCardSkeleton } from "./LogoCard"
import { SealCard, SealCardSkeleton } from "./SealCard"

export const schoolIdentityQueryKey = ["settings", "school-identity"] as const

type SchoolIdentitySectionProps = {
  /** Importer, remplacer, supprimer : permission `settings.school` (appliquée aussi côté API). */
  canManage: boolean
}

/** Bloc « Identité visuelle des documents » : logo puis cachet et signature du chef de l'établissement. */
export function SchoolIdentitySection({ canManage }: SchoolIdentitySectionProps) {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: schoolIdentityQueryKey,
    queryFn: fetchSchoolIdentity,
  })

  const handleChange = (next: SchoolIdentity) => queryClient.setQueryData(schoolIdentityQueryKey, next)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Identité visuelle des documents</h2>
        <p className="text-sm text-muted-foreground">Logo et cachet utilisés sur les bulletins PDF et les autres documents de l&apos;école.</p>
      </div>

      {isPending ? (
        <>
          <LogoCardSkeleton />
          <SealCardSkeleton />
        </>
      ) : isError || !data ? (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-card p-5">
          <p className="text-sm font-medium">Impossible de charger le logo et le cachet.</p>
          <Button type="button" variant="outline" className="min-h-12" disabled={isFetching} onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      ) : (
        <>
          <LogoCard identity={data} canManage={canManage} onIdentityChange={handleChange} />
          <SealCard identity={data} canManage={canManage} onIdentityChange={handleChange} />
        </>
      )}
    </div>
  )
}
