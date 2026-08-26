import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Stamp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { uploadSchoolSeal } from "../settings.api"

type SealKind = "stamp" | "signature"

const SEALS: Array<{ kind: SealKind; label: string; hint: string }> = [
  { kind: "stamp", label: "Cachet de l'établissement", hint: "Tampon officiel, inséré en pied de bulletin." },
  { kind: "signature", label: "Signature du responsable", hint: "Paraphe manuel scanné, inséré à côté du cachet." },
]

/**
 * Cachet + signature de l'école : imprimés uniquement sur les bulletins PDF
 * téléchargeables (jamais sur les reçus, jamais à l'écran).
 */
export function SealsUploadCard() {
  const { toast } = useToast()
  const [urls, setUrls] = useState<Record<SealKind, string>>({ stamp: "", signature: "" })

  const uploadMutation = useMutation({
    mutationFn: (input: { kind: SealKind; file: File }) => uploadSchoolSeal(input.kind, input.file),
    onSuccess: (url, variables) => {
      setUrls((prev) => ({ ...prev, [variables.kind]: url }))
      toast({ title: `${variables.kind === "stamp" ? "Cachet" : "Signature"} enregistré(s)` })
    },
    onError: (error) => {
      const description =
        axiosErrorMessage(error) ?? "Impossible d'uploader l'image."
      toast({ title: "Erreur", description, variant: "destructive" })
    },
  })

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Stamp className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Cachet &amp; signature (bulletins)</p>
            <p className="text-xs text-muted-foreground">
              Insérés automatiquement sur les bulletins PDF téléchargeables.
            </p>
          </div>
        </div>

        {SEALS.map((seal) => (
          <div key={seal.kind} className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {seal.label}
            </Label>
            {urls[seal.kind] ? (
              <img src={urls[seal.kind]} alt={seal.label} className="h-10 rounded-md border border-border object-contain" />
            ) : null}
            <Input
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
            <p className="text-xs text-muted-foreground">{seal.hint} PNG, JPEG ou WEBP - max 500 KB.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const axiosErrorMessage = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null
  const response = (error as { response?: { data?: { error?: unknown } } }).response
  const message = response?.data?.error
  return typeof message === "string" && message.length > 0 ? message : null
}
