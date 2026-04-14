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
  accessToken: string | null
  setUser: (user: AuthUser | null) => void
  setAccessToken: (accessToken: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((setState) => ({
  user: null,
  accessToken: null,
  setUser: (user) => setState({ user }),
  setAccessToken: (accessToken) => setState({ accessToken }),
  clearAuth: () => setState({ user: null, accessToken: null }),
}))
