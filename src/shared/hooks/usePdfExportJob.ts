import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { useToast } from "@/components/ui/use-toast"
import {
  downloadPdfExportFile,
  getPdfExportJobStatus,
  triggerBlobDownload,
} from "@/shared/api/pdfExport.api"

type LaunchResult = { jobId: string }

type UsePdfExportJobOptions = {
  /** Nom de fichier de repli si le serveur n'en fournit pas. */
  fallbackFileName?: string
  /** Libellés des toasts. */
  startedMessage?: string
  successMessage?: string
  errorMessage?: string
}

/**
 * Pipeline d'export PDF asynchrone réutilisable (lance le job → poll
 * /jobs/:id/status → télécharge le PDF dès qu'il est prêt).
 *
 * Modelé sur le flux des bilans de salaire (SalariesPage), centralisé pour les
 * bilans heures profs / absences élèves / présences profs / reversements.
 *
 * Usage :
 *   const { launch, isRunning } = usePdfExportJob({ fallbackFileName: "bilan.pdf" })
 *   <Button onClick={() => launch(() => exportTeacherHours(...))} disabled={isRunning} />
 */
export function usePdfExportJob(options: UsePdfExportJobOptions = {}) {
  const { toast } = useToast()
  const [jobId, setJobId] = useState<string | null>(null)
  // Garde anti double-téléchargement : une fois le PDF récupéré pour un jobId,
  // on ne relance pas le download si le polling renvoie encore l'état "done".
  const downloadedJobRef = useRef<string | null>(null)

  const jobQuery = useQuery({
    queryKey: ["pdf-export-job", jobId],
    queryFn: () => getPdfExportJobStatus(jobId ?? ""),
    enabled: Boolean(jobId),
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) {
        return 2000
      }
      return status === "done" || status === "failed" ? false : 2000
    },
  })

  useEffect(() => {
    const data = jobQuery.data
    if (!data || !jobId) {
      return
    }

    if (data.status === "failed") {
      toast({
        title: "Échec de l'export",
        description: data.failedReason ?? options.errorMessage ?? "La génération du PDF a échoué.",
        variant: "destructive",
      })
      setJobId(null)
      return
    }

    if (data.status === "done" && data.downloadUrl && downloadedJobRef.current !== jobId) {
      downloadedJobRef.current = jobId
      void (async () => {
        try {
          const { blob, fileName } = await downloadPdfExportFile(data.downloadUrl as string)
          triggerBlobDownload(blob, fileName ?? options.fallbackFileName ?? "bilan.pdf")
          toast({ title: options.successMessage ?? "Bilan PDF téléchargé" })
        } catch {
          toast({
            title: "Échec du téléchargement",
            description: options.errorMessage ?? "Impossible de télécharger le PDF.",
            variant: "destructive",
          })
        } finally {
          setJobId(null)
        }
      })()
    }
  }, [jobQuery.data, jobId, options.errorMessage, options.fallbackFileName, options.successMessage, toast])

  /**
   * Déclenche un export : `launcher` lance le job côté API et renvoie `{ jobId }`.
   */
  const launch = async (launcher: () => Promise<LaunchResult>): Promise<void> => {
    try {
      const { jobId: newJobId } = await launcher()
      downloadedJobRef.current = null
      setJobId(newJobId)
      toast({
        title: "Export lancé",
        description: options.startedMessage ?? "Le bilan PDF est en cours de génération.",
      })
    } catch {
      toast({
        title: "Erreur",
        description: options.errorMessage ?? "Impossible de lancer l'export.",
        variant: "destructive",
      })
    }
  }

  const isRunning =
    Boolean(jobId) && jobQuery.data?.status !== "done" && jobQuery.data?.status !== "failed"

  return { launch, isRunning }
}
