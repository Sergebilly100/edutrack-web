import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, UploadCloud } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import {
  type DocumentEntityType,
  type DocumentItem,
  uploadDocument,
} from "@/shared/api/documents.api"

type DocumentUploadProps = {
  entityType: DocumentEntityType
  entityId: string
  onUploadSuccess: (document: DocumentItem) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"])

const getExtension = (filename: string) => filename.split(".").pop()?.toLowerCase() ?? ""

const toUserError = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as { code?: string; message?: string; response?: { data?: { code?: string } } }
    const code = maybeResponse.code ?? maybeResponse.response?.data?.code
    if (code === "INVALID_FILE_EXTENSION" || code === "INVALID_DOCUMENT_TYPE") {
      return "Type de fichier non supporté (PDF, JPG, JPEG, PNG uniquement)."
    }
    if (code === "DOCUMENT_INVALID_MIME" || code === "DOCUMENT_MIME_MISMATCH") {
      return "Le contenu du fichier ne correspond pas à son format. Choisissez un PDF ou une image valide."
    }
    if (code === "DOCUMENT_FILE_TOO_LARGE") {
      return "Taille dépassée. Maximum autorisé: 10 Mo."
    }
    if (code === "ENTITY_NOT_FOUND") {
      return "Ce dossier n'est plus disponible. Actualisez la page puis réessayez."
    }
    if (maybeResponse.message && maybeResponse.message !== "Network Error") {
      return maybeResponse.message
    }
  }

  return "Échec du téléversement. Réessayez."
}

export function DocumentUpload({ entityType, entityId, onUploadSuccess }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dragActive, setDragActive] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (file: File) => uploadDocument({ entityType, entityId, file }),
    onSuccess: (document) => {
      setUploadedFileName(document.name)
      setErrorMessage(null)
      queryClient.invalidateQueries({ queryKey: ["documents", entityType, entityId] })
      if (entityType === "student") {
        queryClient.invalidateQueries({ queryKey: ["students", "dossier", entityId] })
      }
      onUploadSuccess(document)
      toast({ title: "Document ajouté", description: "Le document a été enregistré dans le dossier." })
    },
    onError: (error) => {
      const message = toUserError(error)
      setErrorMessage(message)
      toast({ title: "Téléversement impossible", description: message, variant: "destructive" })
    },
  })

  const validateFile = (file: File) => {
    const extension = getExtension(file.name)
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return "Type de fichier non supporté (PDF, JPG, JPEG, PNG uniquement)."
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Taille dépassée. Maximum autorisé: 10 Mo."
    }
    return null
  }

  const handleFile = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      setUploadedFileName(null)
      return
    }

    setSelectedFileName(file.name)
    setUploadedFileName(null)
    setErrorMessage(null)
    mutation.mutate(file)
  }

  return (
    <div className="space-y-2 pb-5">
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-auto min-h-12 w-full rounded-lg border-dashed border-border/80 bg-background p-5 text-left transition",
          "hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragActive ? "border-primary bg-primary/5" : ""
        )}
        onClick={() => inputRef.current?.click()}
        data-testid="document-upload-dropzone"
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          const file = event.dataTransfer.files.item(0)
          if (file) {
            handleFile(file)
          }
        }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Déposer un fichier ou cliquer pour parcourir</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, JPG, JPEG, PNG • max 10 Mo</p>
          </div>
        </div>

        {mutation.isPending ? (
          <div className="mt-4 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="truncate">Téléversement: {selectedFileName ?? "fichier"}</span>
            </div>
          </div>
        ) : null}

        {!mutation.isPending && uploadedFileName ? (
          <div className="mt-4 flex items-center gap-2">
            <Badge className="bg-green-600 text-white hover:bg-green-600">Téléversé</Badge>
            <span className="truncate text-xs text-muted-foreground">{uploadedFileName}</span>
          </div>
        ) : null}
      </Button>

      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        data-testid="document-upload-input"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(event) => {
          const files = event.target.files
          const file = files?.item ? files.item(0) : files?.[0]
          if (file) {
            handleFile(file)
          }
          event.currentTarget.value = ""
        }}
      />
    </div>
  )
}
