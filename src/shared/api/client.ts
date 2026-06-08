import axios from "axios"
import type { AxiosError, InternalAxiosRequestConfig } from "axios"

import { queryClient } from "@/shared/api/query-client"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { useAuthStore } from "@/shared/store/auth.store"

// 15s : sur réseau instable, axios attendait jusqu'à 60-120s avant d'échouer,
// laissant l'utilisateur incertain sur l'état réel de sa requête (le bug du
// paiement salaire "succès apparent" en offline venait en partie de là).
const REQUEST_TIMEOUT_MS = 15_000

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
})

apiClient.interceptors.request.use((config) => {
  const staffToken = useAuthStore.getState().accessToken
  const parentToken = useParentAuthStore.getState().accessToken
  const requestUrl = config.url ?? ""
  const isParentRoute = requestUrl.includes("/parent/")
  const token = isParentRoute ? parentToken : (staffToken ?? parentToken)
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

let refreshPromise: Promise<string | null> | null = null

const requestTokenRefresh = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const authState = useAuthStore.getState()

      const response = await axios.post<{ accessToken: string }>(
        "/auth/refresh",
        {},
        {
          baseURL: import.meta.env.VITE_API_URL,
          withCredentials: true,
        }
      )

      const newAccessToken = response.data.accessToken
      if (window.location.pathname.startsWith("/parent")) {
        useParentAuthStore.getState().setAccessToken(newAccessToken)
      } else {
        authState.setAccessToken(newAccessToken)
      }
      return newAccessToken
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

const redirectToSessionExpired = (): void => {
  const isParentPortal = window.location.pathname.startsWith("/parent")
  const isAlreadyOnParentLogin = window.location.pathname.startsWith("/parent/login")
  const hasSessionExpiredReason = new URLSearchParams(window.location.search).get("reason") === "session_expired"
  if (isParentPortal) {
    useParentAuthStore.getState().logout()
  } else {
    const authState = useAuthStore.getState()
    // Garder la queue offline lors d'une session expirée (401) - les actions
    // mises en queue avant l'expiration (check-in, QR, pointage) doivent être
    // rejouées après reconnexion, sinon le prof perd tout son travail offline.
    authState.logout({ keepOfflineQueue: true })
  }
  queryClient.clear()
  if (isAlreadyOnParentLogin && hasSessionExpiredReason) {
    return
  }
  window.location.href = isParentPortal
    ? "/parent/login?reason=session_expired"
    : "/login?reason=session_expired"
}

const redirectToMaintenance = (message?: string): void => {
  const encoded = encodeURIComponent(message ?? "Mise à jour en cours")
  window.location.href = `/maintenance?message=${encoded}`
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isUnauthorized = error.response?.status === 401
    const isMaintenance = error.response?.status === 503
    const isForbidden = error.response?.status === 403
    const requestUrl = originalRequest.url ?? ""
    const isAuthEndpoint = requestUrl.includes("/auth/")
    const isPublicUnauthEndpoint =
      requestUrl.includes("/school/info") ||
      requestUrl.includes("/school/public-info") ||
      requestUrl.includes("/settings/public")

    if (isMaintenance) {
      const payload = error.response?.data as { error?: string; message?: string } | undefined
      redirectToMaintenance(payload?.error ?? payload?.message)
      return Promise.reject(error)
    }

    if (isForbidden) {
      const payload = error.response?.data as
        | { code?: string; error?: string; redirect?: string }
        | undefined
      if (payload?.code === "TENANT_SUSPENDED") {
        redirectToMaintenance(payload.error ?? "Abonnement suspendu - contactez l'administration")
        return Promise.reject(error)
      }
    }

    if (isUnauthorized && !originalRequest._retry && !isAuthEndpoint && !isPublicUnauthEndpoint) {
      originalRequest._retry = true

      try {
        const newAccessToken = await requestTokenRefresh()

        if (!newAccessToken) {
          redirectToSessionExpired()
          return Promise.reject(error)
        }

        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      } catch {
        redirectToSessionExpired()
      }
    }

    return Promise.reject(error)
  }
)
