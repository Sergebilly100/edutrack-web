import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { OfflineIndicator } from "../OfflineIndicator"

describe("OfflineIndicator", () => {
  it("renders the offline banner when forced offline", () => {
    render(<OfflineIndicator forceState="offline" />)
    expect(
      screen.getByText(/Hors ligne - vos actions sont sauvegardées localement/i)
    ).toBeInTheDocument()
  })

  it("renders the recovered banner when forced recovered", () => {
    render(<OfflineIndicator forceState="recovered" />)
    expect(
      screen.getByText(/Connexion rétablie - synchronisation en cours/i)
    ).toBeInTheDocument()
  })

  it("renders nothing visible when auto + currently online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    })
    render(<OfflineIndicator />)
    expect(
      screen.queryByText(/Hors ligne - vos actions sont sauvegardées localement/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Connexion rétablie - synchronisation en cours/i)
    ).not.toBeInTheDocument()
  })
})
