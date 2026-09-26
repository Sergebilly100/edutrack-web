import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTourGuide } from "../useTourGuide"

const key = "ivoiredu-tour-done-dashboard"
async function openDialog(role = "dialog") {
  const dialog = document.createElement("div")
  dialog.setAttribute("role", role)
  dialog.dataset.state = "open"
  await act(async () => { document.body.append(dialog) })
  return dialog
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.useRealTimers() })

describe("guide et dialogues", () => {
  it.each(["dialog", "alertdialog"])("annule le démarrage automatique à l’ouverture de %s", async (role) => {
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    const dialog = await openDialog(role)
    await act(async () => { dialog.remove() })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.run).toBe(false)
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("ferme le guide en cours sans le marquer terminé", async () => {
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    act(() => { vi.advanceTimersByTime(800) })
    expect(result.current.run).toBe(true)
    await openDialog()
    expect(result.current.run).toBe(false)
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("ne démarre pas après fermeture d’un dialogue déjà ouvert au montage", async () => {
    const dialog = await openDialog()
    const { result } = renderHook(() => useTourGuide("dashboard", true))
    await act(async () => { dialog.remove() })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.run).toBe(false)
  })

  it("annule aussi un redémarrage demandé avant un dialogue", async () => {
    localStorage.setItem(key, "1")
    const { result, unmount } = renderHook(() => useTourGuide("dashboard", true))
    act(() => { result.current.restart() })
    const dialog = await openDialog()
    await act(async () => { dialog.remove() })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.run).toBe(false)
    act(() => { result.current.restart() })
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
