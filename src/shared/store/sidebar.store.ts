import { create } from "zustand"
import { persist } from "zustand/middleware"

type SidebarStore = {
  collapsed: boolean
  pinned: boolean
  mobileOpen: boolean
  /** Dernier groupe ouvert à la main (le groupe de la page active reste toujours ouvert). */
  expandedGroup: string | null
  toggleCollapsed: () => void
  togglePinned: () => void
  setMobileOpen: (open: boolean) => void
  setExpandedGroup: (group: string | null) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      pinned: true,
      mobileOpen: false,
      expandedGroup: null,
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      togglePinned: () => set((state) => ({ pinned: !state.pinned })),
      setMobileOpen: (open) => set({ mobileOpen: open }),
      setExpandedGroup: (group) => set({ expandedGroup: group }),
    }),
    {
      name: "edutrack_sidebar",
      partialize: (state) => ({ collapsed: state.collapsed, pinned: state.pinned, expandedGroup: state.expandedGroup }),
    }
  )
)
