import { Download } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SalaryExportSection({
  exportJobId,
  exportFileName,
  exportJobState,
  downloadUrl,
  failedReason,
  isDownloading,
  onDownload,
}: {
  exportJobId: string | null
  exportFileName: string | null
  exportJobState: string | undefined
  downloadUrl: string | null | undefined
  failedReason: string | null | undefined
  isDownloading: boolean
  onDownload: () => void
}) {
  if (!exportJobId) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm" data-testid="salaries-export-job-panel">
      <Badge variant="outline">
        {exportFileName ? `Fichier: ${exportFileName}` : "Fichier d'export en préparation"}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          exportJobState === "failed" ? "border-red-200 bg-red-50 text-red-700" : "",
          exportJobState === "done" ? "border-green-200 bg-green-50 text-green-700" : ""
        )}
      >
        {exportJobState === "done"
          ? "Terminé"
          : exportJobState === "failed"
            ? "Échec"
            : "Génération en cours"}
      </Badge>

      {downloadUrl ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={onDownload}
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          <span data-testid="salaries-export-download-link">
            {isDownloading ? "Téléchargement..." : "Télécharger"}
          </span>
        </Button>
      ) : null}

      {exportJobState === "running" || exportJobState === "queued" ? (
        <span className="text-xs text-muted-foreground">
          Merci de patienter, le fichier sera téléchargeable automatiquement dès qu&apos;il est prêt.
        </span>
      ) : null}

      {!downloadUrl && exportJobState === "done" ? (
        <span className="text-xs text-muted-foreground">PDF généré, URL non fournie par l&apos;API.</span>
      ) : null}

      {exportJobState === "failed" ? (
        <span className="text-xs text-red-700">{failedReason ?? "Erreur inconnue"}</span>
      ) : null}
    </div>
  )
}
