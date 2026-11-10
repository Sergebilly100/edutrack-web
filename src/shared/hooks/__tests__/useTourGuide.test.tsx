import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useAideStore } from "@/shared/aide/aide.store"
import { useTourGuide } from "../useTourGuide"

async function openDialog(role = "dialog") {
  const dialog = document.createElement("div")
  dialog.setAttribute("role", role)
  dialog.dataset.state = "open"
  await act(async () => { document.body.append(dialog) })
  return dialog
}

beforeEach(() => {
  localStorage.clear()
  useAideStore.setState({ tours: [], tourRequest: null, panelOpen: false, revision: 0 })
  vi.useFakeTimers()
})
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.useRealTimers() })

describe("visite guidée : jamais automatique", () => {
  it("ne démarre pas au montage, même sans aucune mémorisation", () => {
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.run).toBe(false)
  })

  it("ne démarre pas non plus après une nouvelle « connexion » (remontage)", () => {
    const first = renderHook(() => useTourGuide("dashboard", true))
    first.unmount()
    const second = renderHook(() => useTourGuide("dashboard", true))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(second.result.current.run).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("s'annonce au bouton Aide tant que la page est montée, puis se retire", () => {
    const { unmount } = renderHook(() => useTourGuide("students", true))
    expect(useAideStore.getState().tours).toEqual(["students"])
    unmount()
    expect(useAideStore.getState().tours).toEqual([])
  })

  it("ne s'annonce pas quand la page la désactive", () => {
    renderHook(() => useTourGuide("students", false))
    expect(useAideStore.getState().tours).toEqual([])
  })
})

describe("démarrage à la demande", () => {
  it("démarre sur demande du panneau d'aide pour son identifiant seulement", () => {
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    act(() => { useAideStore.getState().requestTour("students") })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.run).toBe(false)
    act(() => { useAideStore.getState().requestTour("dashboard") })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.run).toBe(true)
    expect(useAideStore.getState().tourRequest).toBeNull()
  })

  it("démarre via start() et s'arrête sur markDone sans rien mémoriser", () => {
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.run).toBe(true)
    act(() => { result.current.markDone() })
    expect(result.current.run).toBe(false)
    expect(localStorage.length).toBe(0)
  })

  it("ne démarre pas quand la page désactive la visite", () => {
    const { result } = renderHook(() => useTourGuide("dashboard", false))
    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.run).toBe(false)
  })
})

describe("guide et dialogues", () => {
  it.each(["dialog", "alertdialog"])("n'ouvre pas la visite si un %s est déjà ouvert", async (role) => {
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    await openDialog(role)
    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.run).toBe(false)
  })

  it("ferme la visite en cours quand un dialogue s'ouvre", async () => {
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.run).toBe(true)
    await openDialog()
    expect(result.current.run).toBe(false)
  })

  it("annule un démarrage demandé juste avant l'ouverture d'un dialogue", async () => {
    const { result, unmount } = renderHook(() => useTourGuide("dashboard", true))
    act(() => { result.current.start() })
    const dialog = await openDialog()
    await act(async () => { dialog.remove() })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.run).toBe(false)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
