import { getMyPermissions } from "@/modules/auth/auth.api"
import { useAuthStore } from "@/shared/store/auth.store"

export function usePermissions() {
  const setPermissions = useAuthStore((state) => state.setPermissions)

  const refreshPermissions = async (): Promise<void> => {
    try {
      const permissions = await getMyPermissions()
      setPermissions(permissions)
    } catch {
      setPermissions([])
    }
  }

  return { refreshPermissions }
}
