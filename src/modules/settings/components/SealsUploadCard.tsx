import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Stamp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { uploadSchoolSeal } from "../settings.api"

type SealKind = "stamp" | "signature"

const SEALS: Array<{ kind: SealKind; label: string; doneLabel: string; hint: string }> = [
  { kind: "stamp", label: "Cachet de l'établissement", doneLabel: "Cachet enregistré", hint: "Tampon officiel, inséré en pied de bulletin." },
  { kind: "signature", label: "Signature du responsable", doneLabel: "Signature enregistrée", hint: "Paraphe manuel scanné, inséré à côté du cachet." },
]

type SealsUploadCardProps = {
  /** URL déjà enregistrée : string = présent, null = absent, undefined = non fournie par l'API (aucun statut affiché). */
  stampUrl?: string | null
  signatureUrl?: string | null
}

/**
 * Cachet + signature de l'école : imprimés uniquement sur les bulletins PDF
 * téléchargeables (jamais sur les reçus, jamais à l'écran).
 * Chaque image est enregistrée dès son import (pas de bouton « Enregistrer »).
 */
export function SealsUploadCard({ stampUrl, signatureUrl }: SealsUploadCardProps) {
  const { toast } = useToast()
  const [urls, setUrls] = useState<Record<SealKind, string>>({ stamp: "", signature: "" })

  const uploadMutation = useMutation({
    mutationFn: (input: { kind: SealKind; file: File }) => uploadSchoolSeal(input.kind, input.file),
    onSuccess: (url, variables) => {
      setUrls((prev) => ({ ...prev, [variables.kind]: url }))
      toast({ title: SEALS.find((seal) => seal.kind === variables.kind)?.doneLabel ?? "Image enregistrée" })
    },
    onError: (error) => {
      const description =
        axiosErrorMessage(error) ?? "Impossible d'uploader l'image."
      toast({ title: "Erreur", description, variant: "destructive" })
    },
  })

  const saved: Record<SealKind, string | null | undefined> = {
    stamp: urls.stamp || stampUrl,
    signature: urls.signature || signatureUrl,
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm" aria-labelledby="seals-title">
      <div className="flex items-start gap-3">
        <Stamp className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <h2 id="seals-title" className="text-sm font-medium">Cachet &amp; signature (bulletins)</h2>
          <p className="text-xs text-muted-foreground">
            Insérés automatiquement sur les bulletins PDF téléchargeables. Chaque image est enregistrée dès son import.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {SEALS.map((seal) => {
          const current = saved[seal.kind]
          const inputId = `seal-file-${seal.kind}`
          const isUploading = uploadMutation.isPending && uploadMutation.variables?.kind === seal.kind
          return (
            <div key={seal.kind} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor={inputId} className="text-sm font-medium">{seal.label}</Label>
                {current ? (
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Importé</Badge>
                ) : current === null ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">À importer</Badge>
                ) : null}
              </div>
              {current ? (
                <img src={current} alt={seal.label} className="h-16 max-w-full rounded-md border border-border bg-background object-contain p-1" />
              ) : (
                <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Aperçu affiché après l&apos;import
                </div>
              )}
              <Input
                id={inputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadMutation.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (file.size > 500 * 1024) {
                    toast({ title: "Image trop lourde", description: "Maximum 500 KB.", variant: "destructive" })
                    event.target.value = ""
                    return
                  }
                  uploadMutation.mutate({ kind: seal.kind, file })
                  event.target.value = ""
                }}
              />
              <p className="text-xs text-muted-foreground" role={isUploading ? "status" : undefined}>
                {isUploading ? "Import en cours…" : `${seal.hint} PNG, JPEG ou WEBP - max 500 KB.`}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const axiosErrorMessage = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null
  const response = (error as { response?: { data?: { error?: unknown } } }).response
  const message = response?.data?.error
  return typeof message === "string" && message.length > 0 ? message : null
}
