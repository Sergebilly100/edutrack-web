import { create } from "zustand"
import { persist } from "zustand/middleware"

import { useOfflineStore } from "@/shared/store/offline.store"

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
  setUser: (user: ParentAuthUser | null) => void
  setAccessToken: (accessToken: string | null) => void
  logout: () => void
}

export const useParentAuthStore = create<ParentAuthState>()(
  persist(
    (setState) => ({
      user: null,
      accessToken: null,
      setUser: (user) => setState({ user }),
      setAccessToken: (accessToken) => setState({ accessToken }),
      logout: () => {
        setState({ user: null, accessToken: null })
        // Idem que pour le staff : purger la queue offline pour ne pas
        // rejouer une action dans le contexte d'une autre session.
        useOfflineStore.getState().clearQueue()
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("parent-auth")
          window.sessionStorage.removeItem("parent_selected_student_id")
        }
      },
    }),
    {
      name: "parent-auth",
      partialize: (state) => ({ user: state.user }),
    }
  )
)
