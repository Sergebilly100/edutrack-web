import { useAuthStore } from "@/shared/store/auth.store"

type TenantInfo = {
  tenantId: string | null
  schemaName: string | null
  plan: string | null
  role: string | null
}

export function useTenant(): TenantInfo {
  const user = useAuthStore((state) => state.user)

  return {
    tenantId: user?.tenantId ?? null,
    schemaName: user?.schemaName ?? null,
    plan: user?.plan ?? null,
    role: user?.role ?? null,
  }
}
