import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ParentAuthUser = {
  id: string
  role: "parent"
  phone: string
  studentIds: string[]
  mustChangePassword: boolean
}

type ParentAuthState = {
  user: ParentAuthUser | null
  accessToken: string | null
  refreshToken: string | null
  setUser: (user: ParentAuthUser | null) => void
  setAccessToken: (accessToken: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  logout: () => void
}

export const useParentAuthStore = create<ParentAuthState>()(
  persist(
    (setState) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setUser: (user) => setState({ user }),
      setAccessToken: (accessToken) => setState({ accessToken }),
      setRefreshToken: (refreshToken) => setState({ refreshToken }),
      logout: () => setState({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: "parent-auth",
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
)
