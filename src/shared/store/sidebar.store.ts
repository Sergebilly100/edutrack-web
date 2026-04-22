import { create } from "zustand"
import { persist } from "zustand/middleware"

type SidebarStore = {
  collapsed: boolean
  pinned: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  togglePinned: () => void
  setMobileOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      pinned: true,
      mobileOpen: false,
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      togglePinned: () => set((state) => ({ pinned: !state.pinned })),
      setMobileOpen: (open) => set({ mobileOpen: open }),
    }),
    {
      name: "edutrack_sidebar",
      partialize: (state) => ({ collapsed: state.collapsed, pinned: state.pinned }),
    }
  )
)
