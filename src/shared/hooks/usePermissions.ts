import { getMyPermissions } from "@/modules/auth/auth.api"
import type { PermissionKey } from "@/shared/store/auth.store"
import { useAuthStore } from "@/shared/store/auth.store"

export function usePermissions() {
  const setPermissions = useAuthStore((state) => state.setPermissions)
  const permissions = useAuthStore((state) => state.permissions)

  const hasPermission = (key: PermissionKey): boolean => permissions.includes(key)

  const refreshPermissions = async (): Promise<void> => {
    try {
      const permissions = await getMyPermissions()
      setPermissions(permissions)
    } catch {
      setPermissions([])
    }
  }

  return { hasPermission, refreshPermissions }
}
