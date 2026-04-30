import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ParentAuthUser = {
  id: string
  role: "parent"
  phone: string
  fullName?: string
  email?: string
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
      logout: () => {
        setState({ user: null, accessToken: null, refreshToken: null })
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("parent-auth")
          window.sessionStorage.removeItem("parent_selected_student_id")
        }
      },
    }),
    {
      name: "parent-auth",
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
)
