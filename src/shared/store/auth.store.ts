import { create } from "zustand"

export type AuthRole = "director" | "secretary" | "teacher" | "super_admin"

export type AuthUser = {
  id: string
  name: string
  role: AuthRole
  phone: string | null
  email: string | null
  tenantId: string
  schemaName: string
  plan: string
}

type AuthState = {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((setState) => ({
  user: null,
  setUser: (user) => setState({ user }),
}))
