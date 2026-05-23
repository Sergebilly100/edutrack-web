import { getMyPermissions } from "@/modules/auth/auth.api"
import type { PermissionKey } from "@/shared/store/auth.store"
import { useAuthStore } from "@/shared/store/auth.store"
import axios from "axios"

const isNetworkUnavailable = (error: unknown): boolean => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true
  }

  return axios.isAxiosError(error) && !error.response
}

export function usePermissions() {
  const setPermissions = useAuthStore((state) => state.setPermissions)
  const permissions = useAuthStore((state) => state.permissions)

  const hasPermission = (key: PermissionKey): boolean => permissions.includes(key)

  const refreshPermissions = async (): Promise<void> => {
    try {
      const permissions = await getMyPermissions()
      setPermissions(permissions)
    } catch (error) {
      if (!isNetworkUnavailable(error)) {
        setPermissions([])
      }
    }
  }

  return { hasPermission, refreshPermissions }
}
