import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { OfflineIndicator } from "../OfflineIndicator"

describe("OfflineIndicator", () => {
  it("warns that actions are unavailable when offline on a non-offline-capable page", () => {
    render(<OfflineIndicator forceState="offline" />)
    expect(
      screen.getByText(/Hors ligne - les actions sur cette page sont indisponibles/i)
    ).toBeInTheDocument()
  })

  it("reassures that actions are saved locally when offline on an offline-capable page", () => {
    render(<OfflineIndicator forceState="offline" offlineCapable />)
    expect(
      screen.getByText(/Hors ligne - vos actions sont sauvegardées localement/i)
    ).toBeInTheDocument()
  })

  it("renders a sync message when recovered on an offline-capable page", () => {
    render(<OfflineIndicator forceState="recovered" offlineCapable />)
    expect(
      screen.getByText(/Connexion rétablie - synchronisation en cours/i)
    ).toBeInTheDocument()
  })

  it("renders only 'connection restored' when recovered on a non-offline-capable page", () => {
    render(<OfflineIndicator forceState="recovered" />)
    expect(screen.getByText(/Connexion rétablie$/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/synchronisation en cours/i)
    ).not.toBeInTheDocument()
  })

  it("renders nothing visible when auto + currently online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    })
    render(<OfflineIndicator />)
    expect(
      screen.queryByText(/Hors ligne/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Connexion rétablie/i)
    ).not.toBeInTheDocument()
  })
})
