import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, FileText, Image as ImageIcon, RefreshCw, RotateCcw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteDocument, downloadDocumentFile, listDocuments, replaceDocument, type DocumentEntityType } from "@/shared/api/documents.api"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  getStudentDocumentDownloadUrl,
  listStudentDocuments,
  updateStudentDocument,
  uploadStudentDocument,
} from "@/modules/enrollments/enrollments.api"
import { compressEnrollmentImage } from "@/modules/enrollments/enrollments.helpers"

type DocumentListProps = {
  entityType: DocumentEntityType
  entityId: string
  includeSharedDocuments?: boolean
  includeEnrollmentDocuments?: boolean
  canManageEnrollmentDocuments?: boolean
  readOnly?: boolean
  schoolYear?: { startDate: string; endDate: string } | null
}

type DossierDocument = {
  id: string
  source: "shared" | "enrollment"
  name: string
  createdAt: string | null
  type: string
  url: string
  documentTypeId?: string
  status?: "provided" | "to_renew"
}

const formatDate = (value: string | null) => {
  if (!value) {
    return "--"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "--"
  }
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function DocumentList({
  entityType,
  entityId,
  includeSharedDocuments = true,
  includeEnrollmentDocuments = false,
  canManageEnrollmentDocuments = false,
  readOnly = false,
  schoolYear = null,
}: DocumentListProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const replacementInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const documentsQuery = useQuery({
    queryKey: ["documents", entityType, entityId],
    queryFn: () => listDocuments(entityType, entityId),
    enabled: includeSharedDocuments && entityId.trim().length > 0,
  })

  const enrollmentDocumentsQuery = useQuery({
    queryKey: ["enrollments", "documents", entityId],
    queryFn: () => listStudentDocuments(entityId),
    enabled: entityType === "student" && includeEnrollmentDocuments && entityId.trim().length > 0,
  })

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      setSelectedDocumentId(null)
      queryClient.invalidateQueries({ queryKey: ["documents", entityType, entityId] })
      if (entityType === "student") {
        queryClient.invalidateQueries({ queryKey: ["students", "dossier", entityId] })
      }
      toast({ title: "Document supprimé" })
    },
    onError: () => toast({ title: "Suppression impossible", description: "Réessayez dans quelques instants.", variant: "destructive" }),
  })

  const replaceMutation = useMutation({
    mutationFn: async ({ document, file }: { document: DossierDocument; file: File }) => {
      if (document.source === "enrollment") {
        if (!document.documentTypeId) {
          throw new Error("Type de document introuvable.")
        }
        return uploadStudentDocument(entityId, document.documentTypeId, await compressEnrollmentImage(file))
      }
      return replaceDocument(document.id, file)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", entityType, entityId] })
      if (entityType === "student") {
        await queryClient.invalidateQueries({ queryKey: ["enrollments", "documents", entityId] })
        await queryClient.invalidateQueries({ queryKey: ["students", "dossier", entityId] })
      }
      toast({ title: "Document remplacé" })
    },
    onError: () => toast({ title: "Remplacement impossible", description: "Le document d'origine est conservé.", variant: "destructive" }),
  })

  const renewalMutation = useMutation({
    mutationFn: (documentId: string) => updateStudentDocument(documentId, { status: "to_renew" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "documents", entityId] })
      await queryClient.invalidateQueries({ queryKey: ["students", "dossier", entityId] })
      toast({ title: "Document à renouveler" })
    },
    onError: () => toast({ title: "Mise à jour impossible", description: "Réessayez dans quelques instants.", variant: "destructive" }),
  })

  if (documentsQuery.isLoading || enrollmentDocumentsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (documentsQuery.isError || enrollmentDocumentsQuery.isError) {
    return (
      <p className="text-sm text-red-600">Impossible de charger les documents. Vérifiez la connexion puis réessayez.</p>
    )
  }

  const documents: DossierDocument[] = [
    ...(documentsQuery.data ?? []).map((document) => ({
      id: document.id,
      source: "shared" as const,
      name: document.name,
      createdAt: document.createdAt,
      type: document.type,
      url: document.url,
    })),
    ...(enrollmentDocumentsQuery.data ?? [])
      .filter((document) => document.status !== "missing" && Boolean(document.fileUrl || document.r2Key))
      .map((document) => ({
        id: document.id,
        source: "enrollment" as const,
        name: document.documentTypeName,
        createdAt: document.providedAt,
        type: document.documentTypeName,
        url: document.fileUrl ?? "",
        documentTypeId: document.documentTypeId,
        status: document.status === "to_renew" ? "to_renew" as const : "provided" as const,
      })),
  ].filter((document) => !schoolYear || Boolean(document.createdAt &&
    document.createdAt.slice(0, 10) >= schoolYear.startDate && document.createdAt.slice(0, 10) <= schoolYear.endDate))
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucun document"
        description="Ajoutez un premier document pour cette entité."
      />
    )
  }

  const selectedDocument = documents.find((item) => item.id === selectedDocumentId) ?? null

  return (
    <>
      <Table data-testid="document-list-table">
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Date d'ajout</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => {
            const isImage = document.type === "photo" || document.url.includes(".jpg") || document.url.includes(".png")

            return (
              <TableRow key={document.id}>
                <TableCell className="min-w-[220px]">
                  <div className="flex items-center gap-2">
                    {isImage ? (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium">{document.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(document.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {document.source === "enrollment" ? "Document d'inscription" : document.type.replace("_", " ")}
                    </Badge>
                    {document.status === "to_renew" ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-700">À renouveler</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-12"
                      onClick={async () => {
                        try {
                          if (typeof window !== "undefined") {
                          if (document.source === "enrollment") {
                            const openedWindow = window.open("", "_blank")
                            const url = await getStudentDocumentDownloadUrl(document.id)
                            if (openedWindow) {
                              openedWindow.opener = null
                              openedWindow.location.href = url
                            } else {
                              window.location.assign(url)
                            }
                            return
                          }
                          const payload = await downloadDocumentFile(document.id)
                          const url = window.URL.createObjectURL(payload.blob)
                          const link = window.document.createElement("a")
                          link.href = url
                          link.download = payload.fileName ?? document.name
                          window.document.body.appendChild(link)
                          link.click()
                          link.remove()
                          window.URL.revokeObjectURL(url)
                        }
                        } catch {
                          toast({ title: "Consultation impossible", description: "Réessayez dans quelques instants.", variant: "destructive" })
                        }
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />Consulter
                    </Button>
                    {!readOnly && (document.source === "shared" || canManageEnrollmentDocuments) ? (
                      <>
                        <input
                          ref={(node) => { replacementInputRefs.current[document.id] = node }}
                          className="sr-only"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) {
                              replaceMutation.mutate({ document, file })
                            }
                            event.target.value = ""
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-12"
                          disabled={replaceMutation.isPending}
                          onClick={() => replacementInputRefs.current[document.id]?.click()}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${replaceMutation.isPending ? "animate-spin" : ""}`} />Remplacer
                        </Button>
                      </>
                    ) : null}
                    {!readOnly && document.source === "enrollment" && canManageEnrollmentDocuments ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-12"
                        disabled={renewalMutation.isPending || document.status === "to_renew"}
                        onClick={() => renewalMutation.mutate(document.id)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />À renouveler
                      </Button>
                    ) : null}
                    {!readOnly && document.source === "shared" ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="min-h-12"
                        onClick={() => setSelectedDocumentId(document.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />Supprimer
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog
        open={Boolean(selectedDocument)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDocumentId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le document ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le document sera supprimé du stockage et de la base.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedDocumentId(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!selectedDocumentId) {
                  return
                }
                deleteMutation.mutate(selectedDocumentId)
              }}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
