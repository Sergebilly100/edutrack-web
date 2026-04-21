import { useRef, useState, type DragEvent } from "react"
import { CheckCircle2, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Spinner } from "@/shared/components/Spinner"

type DropZoneProps = {
  onFileSelected: (file: File) => void
  accept?: string
  maxSizeMb?: number
  isLoading?: boolean
}

export function DropZone({
  onFileSelected,
  accept = ".xlsx",
  maxSizeMb = 5,
  isLoading = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const validateAndSelect = (file: File) => {
    const maxBytes = maxSizeMb * 1024 * 1024
    const hasValidExtension = file.name.toLowerCase().endsWith(".xlsx")

    if (!hasValidExtension) {
      setSelectedFileName(null)
      setError("Format invalide: seuls les fichiers .xlsx sont acceptés.")
      return
    }

    if (file.size > maxBytes) {
      setSelectedFileName(null)
      setError(`Fichier trop volumineux: taille maximale autorisée ${maxSizeMb}Mo.`)
      return
    }

    setError(null)
    setSelectedFileName(file.name)
    onFileSelected(file)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) validateAndSelect(file)
  }

  const stateClasses = isLoading
    ? "border-2 border-dashed border-border bg-muted/30"
    : error
      ? "border-2 border-dashed border-destructive bg-destructive/5"
      : selectedFileName
        ? "border-2 border-dashed border-green-500 bg-green-50"
        : isDragOver
          ? "border-2 border-dashed border-primary bg-primary/5 scale-[1.01]"
          : "border-2 border-dashed border-border bg-muted/30"

  return (
    <div
      className={cn(
        "flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl p-6 text-center transition-all duration-150",
        stateClasses
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <p className="text-sm font-medium text-muted-foreground">Traitement en cours...</p>
        </div>
      ) : (
        <>
          <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Glissez-déposez votre fichier .xlsx ici</p>
          <p className="mb-4 text-xs text-muted-foreground">Taille maximale: {maxSizeMb}Mo</p>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) validateAndSelect(file)
            }}
          />

          <Button
            type="button"
            variant="outline"
            className="min-h-[48px]"
            onClick={() => inputRef.current?.click()}
          >
            Parcourir le fichier
          </Button>

          {selectedFileName ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="break-all">{selectedFileName}</span>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </>
      )}
    </div>
  )
}
