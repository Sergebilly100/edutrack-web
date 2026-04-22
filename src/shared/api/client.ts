import axios from "axios"
import type { AxiosError, InternalAxiosRequestConfig } from "axios"

import { queryClient } from "@/shared/api/query-client"
import { useAuthStore } from "@/shared/store/auth.store"

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
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
      authState.setAccessToken(newAccessToken)
      return newAccessToken
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

const redirectToSessionExpired = (): void => {
  const authState = useAuthStore.getState()
  authState.logout()
  queryClient.clear()
  window.location.href = "/login?reason=session_expired"
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
    const requestUrl = originalRequest.url ?? ""
    const isAuthEndpoint = requestUrl.includes("/auth/")

    if (isMaintenance) {
      const payload = error.response?.data as { error?: string; message?: string } | undefined
      redirectToMaintenance(payload?.error ?? payload?.message)
      return Promise.reject(error)
    }

    if (isUnauthorized && !originalRequest._retry && !isAuthEndpoint) {
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
