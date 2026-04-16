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
  refreshToken: string | null
  setUser: (user: AuthUser | null) => void
  setAccessToken: (accessToken: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((setState) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  setUser: (user) => setState({ user }),
  setAccessToken: (accessToken) => setState({ accessToken }),
  setRefreshToken: (refreshToken) => setState({ refreshToken }),
  logout: () => setState({ user: null, accessToken: null, refreshToken: null }),
}))
