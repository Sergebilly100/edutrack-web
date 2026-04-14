import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const useQRScannerMock = vi.fn()

vi.mock("@/shared/hooks/useQRScanner", () => {
  return {
    useQRScanner: (options: unknown) => useQRScannerMock(options),
  }
})

vi.mock("@/shared/hooks/use-toast", () => {
  return {
    toast: vi.fn(),
    useToast: vi.fn(),
  }
})

import QRScanner from "@/modules/attendance/QRScanner"

describe("QRScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useQRScannerMock.mockReturnValue({
      startScan: vi.fn(async () => undefined),
      stopScan: vi.fn(async () => undefined),
      isScanning: false,
      lastResult: null,
      error: "Aucune caméra disponible sur cet appareil",
      hasPermission: false,
    })
  })

  it("shows manual error and does not call onTokenDetected when manual token is empty", () => {
    const onTokenDetected = vi.fn()

    render(
      <QRScanner
        scheduleId="schedule-1"
        scanType="start"
        onTokenDetected={onTokenDetected}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Valider" }))

    expect(screen.getByText("Veuillez saisir un code QR valide")).toBeInTheDocument()
    expect(onTokenDetected).not.toHaveBeenCalled()
  })
})
