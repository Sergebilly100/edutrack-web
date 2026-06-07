import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/shared/hooks/use-toast"
import { useQRScanner } from "@/shared/hooks/useQRScanner"

type QRScannerProps = {
  onTokenDetected?: (token: string) => void
  scheduleId: string
  scanType: "start" | "end"
  /** Affiche l'option saisie manuelle même si la caméra fonctionne */
  showManualFallback?: boolean
}

export default function QRScanner({ onTokenDetected, scheduleId, scanType, showManualFallback }: QRScannerProps) {
  const [manualCode, setManualCode] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const { startScan, stopScan, isScanning, lastResult, error, hasPermission } = useQRScanner({
    scheduleId,
    scanType,
    onDetected: (token) => {
      onTokenDetected?.(token)
      toast({
        title: "QR code validé",
        description: "Token détecté avec succès.",
        variant: "default",
      })
    },
  })

  const shouldShowManualFallback =
    showManualFallback ||
    manualOpen ||
    hasPermission === false ||
    error === "Aucune caméra disponible sur cet appareil" ||
    error === "Autorisez l'accès à la caméra dans les paramètres de votre navigateur"

  const statusLabel = useMemo(() => {
    if (isScanning) {
      return "Recherche d'un QR code..."
    }

    if (lastResult) {
      return "QR détecté"
    }

    if (error) {
      return "Erreur de scan"
    }

    return "Scanner inactif"
  }, [error, isScanning, lastResult])

  const handleManualSubmit = () => {
    const token = manualCode.trim()

    if (!token) {
      setManualError("Veuillez saisir un code QR valide")
      return
    }

    setManualError(null)
    onTokenDetected?.(token)

    setManualCode("")
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Badge
          variant="outline"
          className="border-slate-300 bg-slate-100 text-slate-700"
        >
          {statusLabel}
        </Badge>

        {isScanning ? (
          <Button variant="ghost" className="min-h-[48px]" data-testid="teacher-qr-close-camera" onClick={() => void stopScan()}>
            Annuler
          </Button>
        ) : (
          <Button className="min-h-[40px] p-2" data-testid="teacher-qr-open-camera" onClick={() => void startScan()}>
            Ouvrir la caméra
          </Button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
        <div
          id="qr-reader"
          data-testid="teacher-qr-reader"
          className="mx-auto aspect-square w-full max-w-sm rounded-lg bg-black/80"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>

        {lastResult ? (
          <div className="pointer-events-none absolute inset-0 bg-green-500/20" />
        ) : null}

        {error ? (
          <div className="pointer-events-none absolute inset-0 bg-red-500/20" />
        ) : null}
      </div>

      {error ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}

      {lastResult ? (
        <p className="break-all text-sm text-green-700">QR lu: {lastResult}</p>
      ) : null}

      {!shouldShowManualFallback ? (
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
          onClick={() => setManualOpen(true)}
        >
          QR illisible ? Saisir le code manuellement
        </button>
      ) : null}

      {shouldShowManualFallback ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">Saisir le code manuellement</p>
          <div className="flex gap-2">
            <Input
              data-testid="teacher-qr-manual-input"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleManualSubmit() }}
              placeholder="Code QR de la salle..."
              autoFocus={manualOpen}
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-[40px] p-0"
              data-testid="teacher-qr-manual-submit"
              onClick={handleManualSubmit}
            >
              Valider
            </Button>
          </div>
          {manualError ? <p className="text-xs text-red-600">{manualError}</p> : null}
          {manualOpen && !showManualFallback ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => { setManualOpen(false); setManualCode(""); setManualError(null) }}
            >
              ← Revenir au scan caméra
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
