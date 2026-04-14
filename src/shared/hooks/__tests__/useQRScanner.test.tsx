import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type ScannerInstanceMock = {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
}

const { scannerInstances, getCamerasMock } = vi.hoisted(() => ({
  scannerInstances: [] as ScannerInstanceMock[],
  getCamerasMock: vi.fn(async () => [{ id: "cam-1", label: "Back camera" }]),
}))

vi.mock("idb-keyval", () => {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
  }
})

vi.mock("@/shared/hooks/useNetworkStatus", () => {
  return {
    useNetworkStatus: () => ({ isOnline: true, wasOffline: false }),
  }
})

vi.mock("html5-qrcode", () => {
  const Html5QrcodeMock = vi.fn().mockImplementation(() => {
    const instance: ScannerInstanceMock = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    }

    scannerInstances.push(instance)
    return instance
  })

  Object.assign(Html5QrcodeMock, { getCameras: getCamerasMock })

  return {
    Html5Qrcode: Html5QrcodeMock,
  }
})

import { QR_TIMEOUT_ERROR_MESSAGE, useQRScanner } from "@/shared/hooks/useQRScanner"

describe("useQRScanner", () => {
  beforeEach(() => {
    scannerInstances.length = 0
    getCamerasMock.mockReset()
    getCamerasMock.mockResolvedValue([{ id: "cam-1", label: "Back camera" }])
    document.body.innerHTML = ""
    vi.clearAllMocks()
    vi.useRealTimers()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => undefined),
      },
    })
  })

  it("startScan called twice does not keep two active instances", async () => {
    document.body.innerHTML = '<div id="qr-reader"></div>'

    const { result } = renderHook(() =>
      useQRScanner({
        scheduleId: "schedule-1",
        scanType: "start",
      })
    )

    await act(async () => {
      await result.current.startScan()
    })

    await act(async () => {
      await result.current.startScan()
    })

    expect(scannerInstances).toHaveLength(2)
    expect(scannerInstances[0].stop).toHaveBeenCalledTimes(1)
    expect(scannerInstances[0].clear).toHaveBeenCalledTimes(1)
    expect(scannerInstances[1].start).toHaveBeenCalledTimes(1)
    expect(result.current.isScanning).toBe(true)
  })

  it("sets timeout error after 30 seconds and stops scanning", async () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div id="qr-reader"></div>'

    const { result } = renderHook(() =>
      useQRScanner({
        scheduleId: "schedule-1",
        scanType: "end",
      })
    )

    await act(async () => {
      await result.current.startScan()
    })

    expect(result.current.isScanning).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30001)
    })

    expect(result.current.error).toBe(QR_TIMEOUT_ERROR_MESSAGE)
    expect(result.current.isScanning).toBe(false)

    vi.useRealTimers()
  }, 10000)
})
