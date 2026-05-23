import { useCallback, useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"

type UseQRScannerOptions = {
  onDetected?: (token: string) => void
  scheduleId: string
  scanType: "start" | "end"
}

type UseQRScannerResult = {
  startScan: () => Promise<void>
  stopScan: () => Promise<void>
  isScanning: boolean
  lastResult: string | null
  error: string | null
  hasPermission: boolean | null
}

const QR_READER_ELEMENT_ID = "qr-reader"
export const QR_SCAN_TIMEOUT_MS = 30000

const PERMISSION_ERROR_MESSAGE =
  "Autorisez l'accès à la caméra dans les paramètres de votre navigateur"
const CAMERA_UNAVAILABLE_ERROR_MESSAGE = "Aucune caméra disponible sur cet appareil"
export const QR_TIMEOUT_ERROR_MESSAGE = "QR code non reconnu après 30 secondes"

type Html5QrcodeCtor = typeof Html5Qrcode

type TestWindow = Window & {
  __EDUTRACK_HTML5_QRCODE__?: Html5QrcodeCtor
}

function toScannerError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Erreur inconnue lors du scan QR"
  }

  const normalizedMessage = error.message.toLowerCase()

  if (
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("notallowed") ||
    normalizedMessage.includes("denied")
  ) {
    return PERMISSION_ERROR_MESSAGE
  }

  if (
    normalizedMessage.includes("camera") ||
    normalizedMessage.includes("notfound") ||
    normalizedMessage.includes("not readable")
  ) {
    return CAMERA_UNAVAILABLE_ERROR_MESSAGE
  }

  return error.message
}

const getHtml5QrcodeCtor = (): Html5QrcodeCtor => {
  if (typeof window === "undefined") {
    return Html5Qrcode
  }

  const override = (window as TestWindow).__EDUTRACK_HTML5_QRCODE__
  return override ?? Html5Qrcode
}

export function useQRScanner(options: UseQRScannerOptions): UseQRScannerResult {
  const [isScanning, setIsScanning] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const isScanningRef = useRef(false)
  const onDetectedRef = useRef(options.onDetected)

  useEffect(() => {
    onDetectedRef.current = options.onDetected
  }, [options.onDetected])

  const clearScanTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stopScan = useCallback(async () => {
    clearScanTimeout()

    const scanner = scannerRef.current

    if (!scanner) {
      isScanningRef.current = false
      setIsScanning(false)
      return
    }

    try {
      if (isScanningRef.current) {
        await scanner.stop()
      }
    } catch {
      // Ignore stop errors when the scanner is already stopped.
    }

    try {
      await scanner.clear()
    } catch {
      // Ignore clear errors.
    }

    scannerRef.current = null
    isScanningRef.current = false
    setIsScanning(false)
  }, [clearScanTimeout])

  const startScan = useCallback(async () => {
    setError(null)
    setLastResult(null)

    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setError(CAMERA_UNAVAILABLE_ERROR_MESSAGE)
      setHasPermission(false)
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(CAMERA_UNAVAILABLE_ERROR_MESSAGE)
      setHasPermission(false)
      return
    }

    try {
      const Html5QrcodeImpl = getHtml5QrcodeCtor()
      const cameras = await Html5QrcodeImpl.getCameras()

      if (cameras.length === 0) {
        setError(CAMERA_UNAVAILABLE_ERROR_MESSAGE)
        setHasPermission(false)
        return
      }
    } catch (scanError) {
      setError(toScannerError(scanError))
      setHasPermission(false)
      return
    }

    await stopScan()

    const readerElement = document.getElementById(QR_READER_ELEMENT_ID)
    if (!readerElement) {
      setError("Zone de scan introuvable")
      return
    }

    const Html5QrcodeImpl = getHtml5QrcodeCtor()
    const scanner = new Html5QrcodeImpl(QR_READER_ELEMENT_ID)
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250,
          },
          aspectRatio: 1,
        },
        (decodedText) => {
          clearScanTimeout()
          setLastResult(decodedText)
          setError(null)
          onDetectedRef.current?.(decodedText)

          void stopScan()
        },
        () => {
          // Ignore scan frame errors and keep scanning.
        }
      )

      isScanningRef.current = true
      setIsScanning(true)
      setHasPermission(true)

      timeoutRef.current = window.setTimeout(() => {
        setError(QR_TIMEOUT_ERROR_MESSAGE)
        void stopScan()
      }, QR_SCAN_TIMEOUT_MS)
    } catch (scanError) {
      setError(toScannerError(scanError))
      setHasPermission(false)
      await stopScan()
    }
  }, [clearScanTimeout, stopScan])

  useEffect(() => {
    return () => {
      void stopScan()
    }
  }, [stopScan])

  return {
    startScan,
    stopScan,
    isScanning,
    lastResult,
    error,
    hasPermission,
  }
}
