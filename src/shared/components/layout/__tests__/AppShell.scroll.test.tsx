import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { role: "director", name: "Directeur" } }),
}))
vi.mock("@/shared/components/layout/Sidebar", () => ({ DesktopSidebar: () => null, MobileSidebar: () => null, MobileMenuButton: () => null }))
vi.mock("@/shared/components/layout/NotificationButton", () => ({ NotificationButton: () => null }))
vi.mock("@/shared/components/OfflineQueueBadge", () => ({ OfflineQueueBadge: () => null }))
vi.mock("@/shared/components/SubscriptionStatusBanner", () => ({ SubscriptionStatusBanner: () => null }))

import { AppShell } from "../AppShell"

describe("AppShell – un seul défilement", () => {
  it("la coque est positionnée, de hauteur fixe et rogne son contenu ; seul <main> défile", () => {
    const { container } = render(<MemoryRouter><AppShell><p>contenu</p></AppShell></MemoryRouter>)
    const shell = container.firstElementChild as HTMLElement
    // relative : contient les éléments absolus (sr-only) pour qu'ils n'allongent pas le document.
    expect(shell.className).toMatch(/\brelative\b/)
    expect(shell.className).toMatch(/\bh-screen\b/)
    expect(shell.className).toMatch(/\boverflow-hidden\b/)
    const scrollers = Array.from(container.querySelectorAll("*")).filter((el) => /\boverflow-y-(auto|scroll)\b/.test(el.className.toString()))
    expect(scrollers).toHaveLength(1)
    expect(scrollers[0].tagName).toBe("MAIN")
  })
})
