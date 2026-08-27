import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, FileText, Loader2, Pencil, Plus } from "lucide-react"
import { z } from "zod"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  archiveRequiredDocumentType,
  createRequiredDocumentType,
  listRequiredDocumentLevels,
  listRequiredDocumentTypes,
  updateRequiredDocumentType,
  type RequiredDocumentType,
} from "@/modules/enrollments/enrollments.api"

const documentSchema = z.object({
  name: z.string().trim().min(2, "Saisissez au moins 2 caractères.").max(150),
  isMandatory: z.boolean(),
})
type DocumentFormValues = z.infer<typeof documentSchema>

const errorDescription = (error: unknown): string =>
  error instanceof Error ? error.message : "L’opération n’a pas pu être effectuée."

export function RequiredDocumentsSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [levelId, setLevelId] = useState("")
  const [editing, setEditing] = useState<RequiredDocumentType | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<RequiredDocumentType | null>(null)

  const levelsQuery = useQuery({ queryKey: ["enrollments", "required-document-levels"], queryFn: listRequiredDocumentLevels })
  const documentsQueryKey = ["enrollments", "required-document-types", levelId] as const
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey,
    queryFn: () => listRequiredDocumentTypes(levelId),
    enabled: Boolean(levelId),
  })

  useEffect(() => {
    if (!levelId && levelsQuery.data?.[0]?.id) setLevelId(levelsQuery.data[0].id)
  }, [levelId, levelsQuery.data])

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: { name: "", isMandatory: true },
  })

  useEffect(() => {
    form.reset(editing
      ? { name: editing.name, isMandatory: editing.isMandatory }
      : { name: "", isMandatory: true })
  }, [editing, form])

  const saveMutation = useMutation({
    mutationFn: (values: DocumentFormValues) => editing
      ? updateRequiredDocumentType(editing.id, values)
      : createRequiredDocumentType({ levelId, ...values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey })
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] })
      toast({
        title: editing ? "Document mis à jour" : "Document ajouté",
        description: editing
          ? "La nouvelle règle est appliquée aux dossiers ouverts."
          : "La pièce apparaît maintenant dans les dossiers ouverts de ce niveau.",
      })
      setEditing(null)
      form.reset({ name: "", isMandatory: true })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: errorDescription(error), variant: "destructive" }),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveRequiredDocumentType(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey })
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] })
      toast({ title: "Document archivé", description: "Il ne sera plus demandé. Les pièces déjà fournies restent conservées." })
      setArchiveTarget(null)
    },
    onError: (error) => toast({ title: "Archivage impossible", description: errorDescription(error), variant: "destructive" }),
  })

  const documents = documentsQuery.data ?? []

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-labelledby="required-documents-title">
      <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 id="required-documents-title" className="text-lg font-semibold">Documents requis par niveau</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Définissez les pièces qui seront proposées automatiquement lors d’une inscription ou d’une réinscription.
            </p>
          </div>
          <div className="w-full space-y-2 sm:w-64">
            <Label htmlFor="document-level">Niveau scolaire</Label>
            <Select value={levelId} onValueChange={(value) => { setLevelId(value); setEditing(null) }} disabled={levelsQuery.isLoading}>
              <SelectTrigger id="document-level" className="min-h-12"><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
              <SelectContent>{(levelsQuery.data ?? []).map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {levelsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les niveaux scolaires.</AlertDescription></Alert> : null}

        {canEdit && levelId ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4 rounded-lg border border-border bg-background p-4">
              <div>
                <p className="font-medium">{editing ? `Modifier « ${editing.name} »` : "Ajouter une pièce"}</p>
                <p className="text-sm text-muted-foreground">Le libellé doit être compréhensible par le secrétariat et les parents.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label htmlFor="document-name">Nom du document</Label>
                    <FormControl><Input id="document-name" placeholder="Ex. Extrait de naissance" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isMandatory" render={({ field }) => (
                  <FormItem>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} /></FormControl>
                      Obligatoire
                    </label>
                  </FormItem>
                )} />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {editing ? <Button type="button" variant="outline" className="min-h-12" onClick={() => setEditing(null)}>Annuler</Button> : null}
                <Button type="submit" className="min-h-12" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {saveMutation.isPending ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Ajouter le document"}
                </Button>
              </div>
            </form>
          </Form>
        ) : null}

        {documentsQuery.isLoading ? <div className="space-y-3" aria-label="Chargement des documents">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div> : null}
        {documentsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les documents requis pour ce niveau.</AlertDescription></Alert> : null}
        {!documentsQuery.isLoading && !documentsQuery.isError && levelId && documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Aucun document configuré</p>
            <p className="mt-1 text-sm text-muted-foreground">Ajoutez la première pièce demandée pour ce niveau.</p>
          </div>
        ) : null}
        {documents.length > 0 ? (
          <div className="divide-y rounded-lg border border-border" aria-label="Documents requis configurés">
            {documents.map((document) => (
              <div key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{document.name}</p>
                  <p className="text-sm text-muted-foreground">{document.levelName}</p>
                </div>
                <Badge variant={document.isMandatory ? "default" : "secondary"} className="w-fit">
                  {document.isMandatory ? "Obligatoire" : "Facultatif"}
                </Badge>
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="min-h-12" onClick={() => setEditing(document)}><Pencil className="mr-2 h-4 w-4" />Modifier</Button>
                    <Button type="button" variant="ghost" className="min-h-12 text-destructive" onClick={() => setArchiveTarget(document)}><Archive className="mr-2 h-4 w-4" />Archiver</Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {!canEdit && levelId ? <Alert><AlertDescription>Vous pouvez consulter cette configuration, mais votre poste ne permet pas de la modifier.</AlertDescription></Alert> : null}
      </div>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {archiveTarget?.name} » ne sera plus demandé dans les dossiers ouverts ou futurs. Les fichiers déjà fournis restent conservés dans l’historique des élèves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={archiveMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (archiveTarget) archiveMutation.mutate(archiveTarget.id)
              }}
            >
              {archiveMutation.isPending ? "Archivage…" : "Archiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
