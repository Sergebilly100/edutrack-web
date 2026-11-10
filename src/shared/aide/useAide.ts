import { useCallback, useMemo } from "react"
import { useInRouterContext, useLocation } from "react-router-dom"

import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"
import type { AidePage, AideViewer } from "./aide.types"
import { canView, findAideByPath } from "./aide-registry"
import { markAideOpened, readHideBadges, wasAideOpened, writeHideBadges, type AideScope } from "./aide-storage"
import { useAideStore } from "./aide.store"

export function useAideViewer(): AideViewer {
  const staffRole = useAuthStore((state) => state.user?.role)
  const parentUser = useParentAuthStore((state) => state.user)
  const role = staffRole ?? (parentUser ? "parent" : undefined)
  const { hasPermission } = usePermissions()
  return useMemo(() => ({ role, hasPermission }), [role, hasPermission])
}

function useAideScope(): AideScope | null {
  const user = useAuthStore((state) => state.user)
  const parentUser = useParentAuthStore((state) => state.user)
  return useMemo(() => {
    if (user) return { tenantId: user.tenantId, userId: user.id }
    return parentUser ? { tenantId: "parent", userId: parentUser.id } : null
  }, [user, parentUser])
}

/** Aide de la page courante : contenu, visite disponible, pastille « nouveau ». À utiliser sous un Router. */
export function useAide() {
  const location = useLocation()
  const viewer = useAideViewer()
  const scope = useAideScope()
  const tours = useAideStore((state) => state.tours)
  const revision = useAideStore((state) => state.revision)
  const bumpRevision = useAideStore((state) => state.bumpRevision)

  const entry: AidePage | undefined = useMemo(() => {
    const found = findAideByPath(location.pathname, undefined, viewer)
    return found && canView(found, viewer) ? found : undefined
  }, [location.pathname, viewer])

  // Avec une aide de page, on ne propose que SA visite, et seulement si la page l'a enregistrée
  // (une visite réservée à la direction n'est pas proposée au personnel). Sans aide de page : la dernière visite enregistrée.
  const tourId = entry ? (entry.visite && tours.includes(entry.visite) ? entry.visite : undefined) : tours[tours.length - 1]
  const pageId = entry?.id ?? tourId
  const available = Boolean(entry || tourId)

  // `revision` force la relecture du stockage après markOpened / setHideBadges.
  const opened = useMemo(() => (scope && pageId ? wasAideOpened(scope, pageId) : true), [scope, pageId, revision])
  const hideBadges = useMemo(() => (scope ? readHideBadges(scope) : true), [scope, revision])

  const markOpened = useCallback(() => {
    if (!scope || !pageId) return
    markAideOpened(scope, pageId)
    bumpRevision()
  }, [scope, pageId, bumpRevision])

  const setHideBadges = useCallback(
    (hide: boolean) => {
      if (!scope) return
      writeHideBadges(scope, hide)
      bumpRevision()
    },
    [scope, bumpRevision]
  )

  return {
    entry,
    pageId,
    tourId,
    available,
    viewer,
    showBadge: available && !opened && !hideBadges,
    hideBadges,
    markOpened,
    setHideBadges,
  }
}

/** Vrai si le composant est monté sous un Router (PageLayout est parfois rendu sans Router dans les tests). */
export function useHasRouter(): boolean {
  return useInRouterContext()
}
