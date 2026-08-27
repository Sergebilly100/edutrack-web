import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Camera, CheckCircle2, FileWarning, Loader2, Upload } from "lucide-react"
import axios from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { compressEnrollmentImage, countMissingMandatoryDocuments } from "../enrollments.helpers"
import {
  listStudentDocuments,
  updateStudentDocument,
  uploadStudentDocument,
  verifyStudentDocuments,
  type StudentDocument,
} from "../enrollments.api"

function errorMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : error instanceof Error ? error.message : "L’opération a échoué."
}

export function DocumentChecklist({
  studentId,
  canEdit,
  onVerified,
}: {
  studentId: string
  canEdit: boolean
  onVerified?: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const queryKey = ["enrollments", "documents", studentId]
  const documentsQuery = useQuery({ queryKey, queryFn: () => listStudentDocuments(studentId) })

  const uploadMutation = useMutation({
    mutationFn: async ({ document, file }: { document: StudentDocument; file: File }) => {
      const compressed = await compressEnrollmentImage(file)
      return uploadStudentDocument(studentId, document.documentTypeId, compressed)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast({ title: "Document ajouté", description: "La pièce a été enregistrée dans le dossier." })
    },
    onError: (error) => toast({ title: "Upload impossible", description: errorMessage(error), variant: "destructive" }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "missing" | "to_renew" }) => updateStudentDocument(id, { status }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => toast({ title: "Mise à jour impossible", description: errorMessage(error), variant: "destructive" }),
  })

  const verifyMutation = useMutation({
    mutationFn: () => verifyStudentDocuments(studentId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey })
      toast({
        title: result.dossierComplete ? "Dossier complet" : "Vérification enregistrée",
        description: result.notificationQueued
          ? "Le parent a été notifié des pièces obligatoires manquantes."
          : result.dossierComplete ? "Toutes les pièces obligatoires sont fournies." : "Aucun numéro de parent n’est disponible pour le SMS.",
      })
      onVerified?.()
    },
    onError: (error) => toast({ title: "Vérification impossible", description: errorMessage(error), variant: "destructive" }),
  })

  if (documentsQuery.isLoading) {
    return <div className="space-y-3" aria-label="Chargement des documents">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>
  }
  if (documentsQuery.isError) return <Alert variant="destructive"><AlertDescription>Impossible de charger les documents du dossier.</AlertDescription></Alert>

  const documents = documentsQuery.data ?? []
  const missingCount = countMissingMandatoryDocuments(documents)
  if (documents.length === 0) {
    return <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>Aucune pièce n’est requise pour ce niveau.</AlertDescription></Alert>
  }

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-lg border bg-card">
        {documents.map((document) => {
          const pending = uploadMutation.isPending && uploadMutation.variables?.document.id === document.id
          return (
            <div key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{document.documentTypeName}</p>
                  {document.isActive === false ? <Badge variant="secondary">Archivée</Badge> : document.isMandatory ? <Badge variant="outline">Obligatoire</Badge> : <Badge variant="secondary">Facultatif</Badge>}
                  <Badge className={cn(
                    "border",
                    document.status === "provided" ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700",
                  )}>
                    {document.status === "provided" ? "Fournie" : document.status === "to_renew" ? "À renouveler" : "Manquante"}
                  </Badge>
                </div>
                {document.providedAt ? <p className="mt-1 text-xs text-muted-foreground">Ajoutée le {new Date(document.providedAt).toLocaleDateString("fr-FR")}</p> : null}
              </div>
              {canEdit && document.isActive !== false ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={(node) => { inputRefs.current[document.id] = node }}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    capture="environment"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) uploadMutation.mutate({ document, file })
                      event.target.value = ""
                    }}
                  />
                  <Button type="button" variant="outline" className="min-h-12" disabled={pending} onClick={() => inputRefs.current[document.id]?.click()}>
                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : document.status === "provided" ? <Upload className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
                    {pending ? "Envoi…" : document.status === "provided" ? "Remplacer" : "Photo ou fichier"}
                  </Button>
                  {document.status === "provided" ? (
                    <Button type="button" variant="ghost" className="min-h-12" onClick={() => statusMutation.mutate({ id: document.id, status: "to_renew" })}>À renouveler</Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {canEdit ? (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {missingCount > 0 ? <FileWarning className="mt-0.5 h-5 w-5 text-amber-700" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700" />}
            <div><p className="font-medium">{missingCount > 0 ? `${missingCount} pièce${missingCount > 1 ? "s" : ""} obligatoire${missingCount > 1 ? "s" : ""} manquante${missingCount > 1 ? "s" : ""}` : "Dossier documentaire complet"}</p><p className="text-sm text-muted-foreground">La validation ne bloque jamais le passage en caisse.</p></div>
          </div>
          <Button type="button" className="min-h-12 shrink-0" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
            {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Valider la vérification
          </Button>
        </div>
      ) : null}
    </div>
  )
}
