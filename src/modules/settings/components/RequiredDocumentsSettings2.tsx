import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, ChevronDown, FileText, Loader2, Pencil, Plus } from "lucide-react"
import { z } from "zod"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import {
  archiveRequiredDocumentType, createRequiredDocumentTypes, listRequiredDocumentLevels,
  listRequiredDocumentTypes, syncRequiredDocumentTypes, type RequiredDocumentType,
} from "@/modules/enrollments/enrollments.api"

const documentSchema = z.object({
  name: z.string().trim().min(2, "Saisissez au moins 2 caractères.").max(150),
  levelIds: z.array(z.string()).min(1, "Choisissez au moins un niveau."),
  isMandatory: z.boolean(),
})
type DocumentFormValues = z.infer<typeof documentSchema>

type DocumentGroup = {
  key: string
  name: string
  documents: RequiredDocumentType[]
  levelIds: string[]
  levelNames: string[]
  isMandatory: boolean
  hasMixedRequirement: boolean
}

const errorDescription = (error: unknown): string =>
  error instanceof Error ? error.message : "L’opération n’a pas pu être effectuée."

export function RequiredDocumentsSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState<DocumentGroup | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<DocumentGroup | null>(null)
  const levelsQuery = useQuery({ queryKey: ["enrollments", "required-document-levels"], queryFn: listRequiredDocumentLevels })
  const documentsQueryKey = ["enrollments", "required-document-types"] as const
  const documentsQuery = useQuery({ queryKey: documentsQueryKey, queryFn: () => listRequiredDocumentTypes() })
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: { name: "", levelIds: [], isMandatory: true },
  })

  const groups = useMemo(() => {
    const grouped = new Map<string, RequiredDocumentType[]>()
    for (const document of documentsQuery.data ?? []) {
      const key = document.name.trim().toLocaleLowerCase("fr")
      grouped.set(key, [...(grouped.get(key) ?? []), document])
    }
    return [...grouped.entries()].map(([key, documents]): DocumentGroup => ({
      key,
      name: documents[0]!.name,
      documents,
      levelIds: documents.map((document) => document.levelId),
      levelNames: documents.map((document) => document.levelName),
      isMandatory: documents[0]!.isMandatory,
      hasMixedRequirement: documents.some((document) => document.isMandatory !== documents[0]!.isMandatory),
    }))
  }, [documentsQuery.data])

  useEffect(() => {
    form.reset(editing
      ? { name: editing.name, levelIds: editing.levelIds, isMandatory: editing.isMandatory }
      : { name: "", levelIds: [], isMandatory: true })
  }, [editing, form])

  const saveMutation = useMutation({
    mutationFn: (values: DocumentFormValues) => editing
      ? syncRequiredDocumentTypes({ documentTypeIds: editing.documents.map((document) => document.id), ...values })
      : createRequiredDocumentTypes(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey })
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "list"] })
      toast({
        title: editing ? "Document mis à jour" : "Document ajouté",
        description: editing
          ? "Le nom, l’exigence et les niveaux associés ont été mis à jour."
          : "La pièce a été associée aux niveaux sélectionnés et ajoutée aux dossiers ouverts.",
      })
      setEditing(null)
      form.reset({ name: "", levelIds: [], isMandatory: true })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: errorDescription(error), variant: "destructive" }),
  })

  const archiveMutation = useMutation({
    mutationFn: (documents: RequiredDocumentType[]) => Promise.all(documents.map((document) => archiveRequiredDocumentType(document.id))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey })
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "list"] })
      toast({ title: "Document archivé", description: "Il ne sera plus demandé pour les niveaux associés. Les pièces fournies restent conservées." })
      setArchiveTarget(null)
    },
    onError: (error) => toast({ title: "Archivage impossible", description: errorDescription(error), variant: "destructive" }),
  })

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-labelledby="required-documents-title">
      <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-6">
        <h2 id="required-documents-title" className="text-lg font-semibold">Documents requis par niveau</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Créez une pièce une seule fois, puis choisissez tous les niveaux concernés.</p>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {levelsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les niveaux scolaires.</AlertDescription></Alert> : null}
        {canEdit ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-5 rounded-lg border border-border bg-background p-4">
              <div><p className="font-medium">{editing ? `Modifier « ${editing.name} »` : "Ajouter un document"}</p><p className="text-sm text-muted-foreground">Le sélecteur permet d’ajouter ou de retirer plusieurs niveaux en une seule modification.</p></div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="space-y-2"><Label htmlFor="document-name">Nom du document</Label><FormControl><Input id="document-name" placeholder="Ex. Extrait de naissance" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="isMandatory" render={({ field }) => (
                  <FormItem><Label className="mb-2 block">Exigence</Label><label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 text-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} /></FormControl>Obligatoire</label></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="levelIds" render={({ field }) => {
                const selectedLevels = (levelsQuery.data ?? []).filter((level) => field.value.includes(level.id))
                return (
                  <FormItem className="space-y-2">
                    <Label>Niveaux concernés</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild disabled={levelsQuery.isLoading}>
                        <Button type="button" variant="outline" className="min-h-12 w-full justify-between font-normal" aria-label="Niveaux concernés">
                          <span className={field.value.length === 0 ? "text-muted-foreground" : ""}>
                            {levelsQuery.isLoading
                              ? "Chargement des niveaux…"
                              : field.value.length === 0
                                ? "Sélectionner un ou plusieurs niveaux"
                                : field.value.length === 1
                                  ? selectedLevels[0]?.name
                                  : `${field.value.length} niveaux sélectionnés`}
                          </span>
                          <ChevronDown className="ml-3 h-4 w-4 shrink-0 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                        <DropdownMenuLabel>Choisir les niveaux</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(levelsQuery.data ?? []).map((level) => (
                          <DropdownMenuCheckboxItem
                            key={level.id}
                            checked={field.value.includes(level.id)}
                            onSelect={(event) => event.preventDefault()}
                            onCheckedChange={(checked) => field.onChange(checked ? [...field.value, level.id] : field.value.filter((id) => id !== level.id))}
                          >
                            {level.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {selectedLevels.length > 0 ? <div className="flex flex-wrap gap-2 pt-1">{selectedLevels.map((level) => <Badge key={level.id} variant="secondary">{level.name}</Badge>)}</div> : null}
                    <FormMessage />
                  </FormItem>
                )
              }} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {editing ? <Button type="button" variant="outline" className="min-h-12" onClick={() => setEditing(null)}>Annuler</Button> : null}
                <Button type="submit" className="min-h-12" disabled={saveMutation.isPending || levelsQuery.isLoading}>{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{saveMutation.isPending ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Ajouter aux niveaux sélectionnés"}</Button>
              </div>
            </form>
          </Form>
        ) : null}

        <div className="space-y-3">
          <div><h3 className="font-semibold">Récapitulatif</h3><p className="text-sm text-muted-foreground">Une ligne par document, avec tous ses niveaux associés.</p></div>
          {documentsQuery.isLoading ? <div className="space-y-3" aria-label="Chargement des documents">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div> : null}
          {documentsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les documents requis.</AlertDescription></Alert> : null}
          {!documentsQuery.isLoading && !documentsQuery.isError && groups.length === 0 ? <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Aucun document configuré</p><p className="mt-1 text-sm text-muted-foreground">Ajoutez une pièce et sélectionnez les niveaux concernés.</p></div> : null}
          {groups.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Niveaux</TableHead><TableHead>Exigence</TableHead>{canEdit ? <TableHead className="text-right">Actions</TableHead> : null}</TableRow></TableHeader>
                <TableBody>{groups.map((group) => <TableRow key={group.key}><TableCell className="font-medium">{group.name}</TableCell><TableCell><div className="flex flex-wrap gap-1.5">{group.levelNames.map((levelName, index) => <Badge key={`${group.levelIds[index]}-${levelName}`} variant="outline">{levelName}</Badge>)}</div></TableCell><TableCell><Badge variant={group.hasMixedRequirement ? "outline" : group.isMandatory ? "default" : "secondary"}>{group.hasMixedRequirement ? "Variable" : group.isMandatory ? "Obligatoire" : "Facultatif"}</Badge></TableCell>{canEdit ? <TableCell><div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" className="min-h-12" onClick={() => setEditing(group)}><Pencil className="mr-2 h-4 w-4" />Modifier</Button><Button type="button" variant="ghost" size="sm" className="min-h-12 text-destructive" onClick={() => setArchiveTarget(group)}><Archive className="mr-2 h-4 w-4" />Archiver</Button></div></TableCell> : null}</TableRow>)}</TableBody>
              </Table>
            </div>
          ) : null}
        </div>
        {!canEdit ? <Alert><AlertDescription>Vous pouvez consulter cette configuration, mais votre poste ne permet pas de la modifier.</AlertDescription></Alert> : null}
      </div>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archiver ce document ?</AlertDialogTitle><AlertDialogDescription>« {archiveTarget?.name} » ne sera plus demandé pour {archiveTarget?.levelNames.join(", ")}. Les fichiers déjà fournis restent conservés dans l’historique des élèves.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={archiveMutation.isPending}>Annuler</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={archiveMutation.isPending} onClick={(event) => { event.preventDefault(); if (archiveTarget) archiveMutation.mutate(archiveTarget.documents) }}>{archiveMutation.isPending ? "Archivage…" : "Archiver"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
