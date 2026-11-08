import { useId, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { ACCEPT_ATTRIBUTE } from "./school-image.utils"

type ImageDropzoneProps = {
  title: string
  hint: string
  isLoading?: boolean
  disabled?: boolean
  errorMessage?: string | null
  onFile: (file: File) => void
}

/**
 * Zone de dépôt (glisser-déposer, clic, clavier via le bouton « Parcourir »).
 * Le bouton est le seul arrêt de tabulation : il évite un contrôle interactif imbriqué.
 */
export function ImageDropzone({ title, hint, isLoading = false, disabled = false, errorMessage, onFile }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const hintId = useId()
  const errorId = useId()
  const inactive = disabled || isLoading

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          if (inactive) return
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (!inactive) pick(event.dataTransfer.files)
        }}
        onClick={() => !inactive && inputRef.current?.click()}
        aria-busy={isLoading}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center transition-colors motion-reduce:transition-none",
          errorMessage ? "border-destructive" : "border-border",
          isDragging && "border-primary bg-primary/5",
          inactive ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/40"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm font-medium text-foreground">{isLoading ? "Analyse de l'image…" : title}</p>
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          disabled={inactive}
          aria-describedby={`${hintId} ${errorMessage ? errorId : ""}`.trim()}
          onClick={(event) => {
            event.stopPropagation()
            inputRef.current?.click()
          }}
        >
          Parcourir
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          disabled={inactive}
          onChange={(event) => pick(event.target.files)}
        />
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </p>
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
