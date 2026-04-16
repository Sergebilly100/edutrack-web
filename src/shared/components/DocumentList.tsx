import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, FileText, Image as ImageIcon, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { deleteDocument, getDocumentDownloadUrl, listDocuments, type DocumentEntityType } from "@/shared/api/documents.api"
import { EmptyState } from "@/shared/components/EmptyState"

type DocumentListProps = {
  entityType: DocumentEntityType
  entityId: string
}

const formatDate = (value: string) => {
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

export function DocumentList({ entityType, entityId }: DocumentListProps) {
  const queryClient = useQueryClient()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)

  const documentsQuery = useQuery({
    queryKey: ["documents", entityType, entityId],
    queryFn: () => listDocuments(entityType, entityId),
    enabled: entityId.trim().length > 0,
  })

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      setSelectedDocumentId(null)
      queryClient.invalidateQueries({ queryKey: ["documents", entityType, entityId] })
    },
  })

  if (documentsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (documentsQuery.isError) {
    return (
      <p className="text-sm text-red-600">Impossible de charger les documents. Vérifiez la connexion puis réessayez.</p>
    )
  }

  const documents = documentsQuery.data ?? []

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
            <TableHead>Date upload</TableHead>
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
                  <Badge variant="outline" className="text-xs capitalize">
                    {document.type.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const signedUrl = await getDocumentDownloadUrl(document.id)
                        if (typeof window !== "undefined") {
                          const target = signedUrl || document.url
                          if (target) {
                            window.open(target, "_blank", "noopener,noreferrer")
                          }
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
