import { useEffect, useRef } from "react"
import axios from "axios"

import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"
import type { AuthTenant, AuthUser } from "@/shared/store/auth.store"

type RefreshResponse = {
  accessToken: string
  tokenType: "Bearer"
  expiresIn: string
}

type MeResponse = {
  user: {
    id: string
    role: AuthUser["role"]
    name: string
    phone: string | null
    email: string | null
    profilePhotoUrl: string | null
    mustChangePassword?: boolean
    positionNames?: string[]
    primaryPosition?: string | null
    username?: string
  }
  tenant?: AuthTenant | null
}

type JwtPayloadPartial = {
  sub?: string
  schemaName?: string
  role?: string
  studentIds?: string[]
  mustChangePassword?: boolean
  phone?: string
  fullName?: string
  email?: string
}

/**
 * Décode la partie payload d'un JWT sans vérification de signature.
 * Utilisé uniquement pour lire schemaName côté client (donnée non-sensible).
 * La vérification de signature reste exclusivement côté backend.
 */
const decodeJwtPayload = (token: string): JwtPayloadPartial => {
  try {
    const parts = token.split(".")
    if (parts.length !== 3 || !parts[1]) {
      return {}
    }
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const json = atob(padded)
    return JSON.parse(json) as JwtPayloadPartial
  } catch {
    return {}
  }
}

/**
 * Tente de restaurer la session au démarrage de l'app via le cookie HttpOnly
 * refresh_token posé par le backend.
 *
 * Séquence :
 *   1. POST /auth/refresh  — withCredentials envoie le cookie automatiquement
 *   2. Décoder le JWT pour extraire schemaName (lecture client-side, sans vérif signature)
 *   3. GET  /auth/me       — récupérer le profil utilisateur avec le nouveau token
 *   4. Hydrater user + accessToken dans le store
 *   5. Dans tous les cas → marquer isSessionRestored = true
 *
 * Ce hook doit être appelé une seule fois, à la racine de l'app (App.tsx),
 * avant tout rendu de route protégée.
 */
export function useRestoreSession(): void {
  const setParentAccessToken = useParentAuthStore((state) => state.setAccessToken)
  const setParentUser = useParentAuthStore((state) => state.setUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setUser = useAuthStore((state) => state.setUser)
  const setTenant = useAuthStore((state) => state.setTenant)
  const setSessionRestored = useAuthStore((state) => state.setSessionRestored)
  const setPermissions = useAuthStore((state) => state.setPermissions)
  const isSessionRestored = useAuthStore((state) => state.isSessionRestored)
  const { refreshPermissions } = usePermissions()
  const hasAttemptedRestore = useRef(false)

  useEffect(() => {
    if (isSessionRestored || hasAttemptedRestore.current) {
      return
    }
    hasAttemptedRestore.current = true

    const restoreSession = async (): Promise<void> => {
      try {
        // Étape 1 — Obtenir un nouveau accessToken via le cookie refresh HttpOnly
        const refreshResponse = await axios.post<RefreshResponse>(
          "/auth/refresh",
          {},
          {
            baseURL: import.meta.env.VITE_API_URL,
            withCredentials: true,
          }
        )

        const newAccessToken = refreshResponse.data.accessToken

        // Étape 2 — Extraire claims du JWT (non-sensible, public dans le payload)
        const jwtClaims = decodeJwtPayload(newAccessToken)
        const schemaName = jwtClaims.schemaName ?? "unknown"
        const role = jwtClaims.role

        if (role === "parent") {
          setParentAccessToken(newAccessToken)
          setParentUser({
            id: jwtClaims.sub ?? "",
            role: "parent",
            phone: jwtClaims.phone ?? "",
            fullName: jwtClaims.fullName,
            email: jwtClaims.email,
            studentIds: Array.isArray(jwtClaims.studentIds) ? jwtClaims.studentIds : [],
            mustChangePassword: Boolean(jwtClaims.mustChangePassword),
          })
          return
        }

        setAccessToken(newAccessToken)

        // Étape 3 — Récupérer le profil complet
        const meResponse = await axios.get<MeResponse>("/auth/me", {
          baseURL: import.meta.env.VITE_API_URL,
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${newAccessToken}`,
          },
        })

        const { user, tenant } = meResponse.data

        // Étape 4 — Hydrater le store
        setUser({
          id: user.id,
          name: user.name,
          role: user.role,
          phone: user.phone,
          email: user.email,
          profilePhotoUrl: user.profilePhotoUrl,
          mustChangePassword: Boolean(user.mustChangePassword ?? jwtClaims.mustChangePassword),
          positionNames: Array.isArray(user.positionNames) ? user.positionNames : [],
          primaryPosition: user.primaryPosition ?? null,
          tenantId: schemaName,
          schemaName,
          plan: "standard",
        })
        setTenant(tenant ?? null)
        await refreshPermissions()
      } catch {
        // Cookie absent, expiré ou révoqué → session invalide, comportement normal.
        // La redirection vers /login est gérée par App.tsx (RoleRedirect)
        // une fois isSessionRestored = true.
        setPermissions([])
        setParentUser(null)
      } finally {
        setSessionRestored()
      }
    }

    void restoreSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
