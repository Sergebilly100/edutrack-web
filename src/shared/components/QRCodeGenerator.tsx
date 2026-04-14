import { useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type QRCodeGeneratorProps = {
  roomToken: string
  roomName: string
  building?: string
  size?: number
}

function sanitizeFilename(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

export function QRCodeGenerator({
  roomToken,
  roomName,
  building,
  size = 200,
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    const canvas = canvasRef.current

    if (!canvas) return

    canvas.toBlob((blob) => {
      if (!blob) return

      const link = document.createElement("a")
      const safeRoomName = sanitizeFilename(roomName) || "salle"
      const fileName = `edutrack-salle-${safeRoomName}.png`
      const objectUrl = URL.createObjectURL(blob)

      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    }, "image/png")
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomToken)
      setCopied(true)
    } catch {
      // No success feedback when clipboard permission is denied.
    }
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-col items-center space-y-3 print:space-y-2">
        <QRCodeSVG value={roomToken} size={size} level="M" includeMargin />

        <div className="w-full space-y-1 text-center">
          <p className="text-sm font-semibold text-foreground">{roomName}</p>
          {building ? (
            <p className="text-xs text-muted-foreground">{building}</p>
          ) : null}
          <p className="text-[10px] font-mono text-muted-foreground">
            {roomToken.slice(0, 8)}…
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 print:hidden">
        <Button
          onClick={handleDownload}
          type="button"
          variant="secondary"
          size="lg"
          className="min-h-[48px] active:scale-95 transition-transform"
        >
          📥 Télécharger (PNG)
        </Button>
        <Button
          onClick={handleCopy}
          type="button"
          variant="ghost"
          size="lg"
          className="min-h-[48px] active:scale-95 transition-transform"
        >
          🔗 Copier le token
        </Button>
        {copied ? (
          <Badge
            className="animate-in fade-in border-green-200 bg-green-50 text-green-700 duration-200"
            onAnimationEnd={() => setCopied(false)}
          >
            Copié !
          </Badge>
        ) : null}
      </div>

      <div className="sr-only" aria-hidden>
        <QRCodeCanvas
          value={roomToken}
          size={size}
          level="M"
          includeMargin
          ref={canvasRef}
        />
      </div>
    </div>
  )
}
