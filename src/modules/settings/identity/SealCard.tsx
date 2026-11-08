import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

import {
  deleteLegacySeal,
  deleteSchoolSeal,
  fetchLegacySealImage,
  fetchSealImage,
  saveSchoolSeal,
  setSealRemoveWhite,
  type LegacySealKind,
  type SchoolIdentity,
} from "../settings.api"
import { AuthImage } from "./AuthImage"
import { ConfirmDeleteButton } from "./ConfirmDeleteButton"
import { ImageDropzone } from "./ImageDropzone"
import {
  extractApiErrorMessage,
  formatDimensions,
  formatFileSize,
  formatImportDate,
  imageTypeLabel,
} from "./school-image.utils"
import { useImageDraft } from "./useImageDraft"

const CHIEF_LABEL = "Le chef de l'établissement"
const PREVIEW_ALT = "Aperçu du cachet et de la signature du chef de l'établissement"
const LEGACY_LABELS: Record<LegacySealKind, string> = {
  stamp: "Ancien cachet de l'établissement",
  signature: "Ancienne signature du responsable",
}

type SealCardProps = {
  identity: SchoolIdentity
  canManage: boolean
  onIdentityChange: (identity: SchoolIdentity) => void
}

/** Cadre identique à celui du bulletin : bord fin, libellé en haut, damier pour la transparence. */
function SealFrame({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative aspect-[2/1] w-full overflow-hidden rounded-lg border border-border bg-checkerboard", className)}>
      <div className="absolute inset-2 rounded-md border border-border bg-background/80">
        <p className="px-2 pt-1 text-[10px] font-medium leading-tight text-muted-foreground">{CHIEF_LABEL}</p>
        <div className="absolute inset-x-2 bottom-2 top-6 flex items-center justify-center">{children}</div>
      </div>
    </div>
  )
}

export function SealCard({ identity, canManage, onIdentityChange }: SealCardProps) {
  const { toast } = useToast()
  const { draft, error, setError, isPreviewing, selectFile, setRemoveWhite, cancel } = useImageDraft("seal")
  const [replacing, setReplacing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [announcement, setAnnouncement] = useState("")

  const seal = identity.seal
  const legacyKinds = (["stamp", "signature"] as const).filter((kind) => identity.legacy[kind])
  const imageVersion = seal?.updatedAt ?? "none"

  const finish = (next: SchoolIdentity, message: string) => {
    onIdentityChange(next)
    setAnnouncement(message)
    toast({ title: message })
  }

  const saveMutation = useMutation({
    mutationFn: (input: { file: File; removeWhite: boolean }) => saveSchoolSeal(input.file, input.removeWhite, setProgress),
    onSuccess: (next) => {
      cancel()
      setReplacing(false)
      finish(next, "Image enregistrée")
    },
    onError: async (caught) => {
      const message = await extractApiErrorMessage(caught)
      setError(message)
      setAnnouncement(message)
    },
    onSettled: () => setProgress(0),
  })

  const backgroundMutation = useMutation({
    mutationFn: setSealRemoveWhite,
    onSuccess: (next) => finish(next, "Fond mis à jour"),
    onError: async (caught) => toast({ title: "Erreur", description: await extractApiErrorMessage(caught), variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSchoolSeal,
    onSuccess: (next) => finish(next, "Image supprimée"),
    onError: async (caught) => toast({ title: "Erreur", description: await extractApiErrorMessage(caught), variant: "destructive" }),
  })

  const legacyDeleteMutation = useMutation({
    mutationFn: deleteLegacySeal,
    onSuccess: (next) => finish(next, "Ancien fichier supprimé"),
    onError: async (caught) => toast({ title: "Erreur", description: await extractApiErrorMessage(caught), variant: "destructive" }),
  })

  const badge = draft ? (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      Non enregistrée
    </Badge>
  ) : seal ? (
    <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
      Enregistré
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-muted text-muted-foreground">
      Non défini
    </Badge>
  )

  const savedMeta = seal
    ? [
        imageTypeLabel(seal.mime),
        seal.sizeBytes ? formatFileSize(seal.sizeBytes) : null,
        seal.width && seal.height ? formatDimensions(seal.width, seal.height) : null,
        seal.updatedAt ? `importé le ${formatImportDate(seal.updatedAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : ""

  const dropzone = (
    <ImageDropzone
      title="Glissez-déposez votre image ici"
      hint="PNG à fond transparent recommandé · PNG, JPEG ou WebP · 2 Mo max"
      isLoading={isPreviewing}
      disabled={!canManage}
      errorMessage={error}
      onFile={(file) => void selectFile(file)}
    />
  )

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm" aria-labelledby="seal-card-title" data-tour="settings-seal">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-1">
          <h3 id="seal-card-title" className="text-base font-semibold">
            Cachet et signature du chef de l&apos;établissement
          </h3>
          <p className="text-sm text-muted-foreground">
            Utilisés sur les bulletins PDF, dans le cadre « {CHIEF_LABEL} ».
          </p>
        </div>
        <div className="shrink-0">{badge}</div>
      </header>

      <div className="space-y-5 p-5">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {draft ? (
          <div className="space-y-4">
            <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <SealFrame>
                {draft.previewUrl ? <img src={draft.previewUrl} alt={PREVIEW_ALT} className="h-full w-full object-contain" /> : null}
              </SealFrame>
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="break-words text-sm font-semibold">{draft.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[formatFileSize(draft.file.size), draft.dimensions ? formatDimensions(draft.dimensions.width, draft.dimensions.height) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex min-h-12 items-center gap-3">
                  <Switch
                    id="seal-draft-remove-white"
                    checked={draft.removeWhite}
                    disabled={isPreviewing || saveMutation.isPending}
                    onCheckedChange={(value) => void setRemoveWhite(value)}
                  />
                  <Label htmlFor="seal-draft-remove-white" className="text-sm font-medium">
                    Retirer le fond blanc
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">Le fond blanc devient transparent pour ne pas masquer le texte du bulletin.</p>
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
            {saveMutation.isPending ? (
              <Progress value={progress} aria-label="Envoi de l'image" />
            ) : (
              <p className="text-sm text-muted-foreground">Rien n&apos;est enregistré avant confirmation.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="min-h-12"
                disabled={saveMutation.isPending || isPreviewing}
                onClick={() => saveMutation.mutate({ file: draft.file, removeWhite: draft.removeWhite })}
              >
                {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button type="button" variant="outline" className="min-h-12" disabled={saveMutation.isPending} onClick={cancel}>
                Annuler
              </Button>
            </div>
          </div>
        ) : seal && !replacing ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <SealFrame>
                <AuthImage
                  queryKey={["settings", "seal-image", imageVersion]}
                  fetchBlob={() => fetchSealImage("processed")}
                  alt={PREVIEW_ALT}
                />
              </SealFrame>
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="break-words text-sm font-semibold">{seal.fileName ?? "Image enregistrée"}</p>
                  <p className="text-sm text-muted-foreground">{savedMeta}</p>
                </div>
                {canManage ? (
                  <div className="flex min-h-12 items-center gap-3">
                    <Switch
                      id="seal-saved-remove-white"
                      checked={seal.removeWhite}
                      disabled={backgroundMutation.isPending}
                      onCheckedChange={(value) => backgroundMutation.mutate(value)}
                    />
                    <Label htmlFor="seal-saved-remove-white" className="text-sm font-medium">
                      Retirer le fond blanc
                    </Label>
                  </div>
                ) : null}
              </div>
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="min-h-12" onClick={() => setReplacing(true)}>
                  Remplacer
                </Button>
                <ConfirmDeleteButton
                  label="Supprimer"
                  title="Supprimer le cachet et la signature ?"
                  description="L'image ne figurera plus sur les bulletins PDF. Vous pourrez en importer une autre à tout moment."
                  isPending={deleteMutation.isPending}
                  onConfirm={() => deleteMutation.mutate()}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            {canManage ? dropzone : null}
            {replacing ? (
              <Button type="button" variant="ghost" className="min-h-12" onClick={() => setReplacing(false)}>
                Annuler le remplacement
              </Button>
            ) : null}
            {!seal ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Aperçu sur le bulletin</p>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <SealFrame>
                    <span className="text-sm text-muted-foreground">Aucune image</span>
                  </SealFrame>
                  {legacyKinds.length > 0 ? (
                    <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                      Vous utilisez encore {legacyKinds.length === 2 ? "deux images séparées" : "une ancienne image séparée"}. Importez une image unique pour {legacyKinds.length === 2 ? "les" : "la"} remplacer.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {legacyKinds.length > 0 ? (
          <Collapsible className="rounded-lg border border-border">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="group min-h-12 w-full justify-between px-4 text-sm font-medium">
                Anciens fichiers (cachet et signature séparés) · {legacyKinds.length}
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 border-t border-border p-4">
              <p className="text-sm text-muted-foreground">
                {seal
                  ? "Ces anciennes images ne sont plus utilisées sur les bulletins. Vous pouvez les supprimer."
                  : "Importez une image unique pour remplacer ces deux fichiers. En attendant, ils restent utilisés sur les bulletins."}
              </p>
              <ul className="space-y-3">
                {legacyKinds.map((kind) => (
                  <li key={kind} className="flex items-center gap-3">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-checkerboard">
                      <AuthImage queryKey={["settings", "legacy-seal", kind]} fetchBlob={() => fetchLegacySealImage(kind)} alt={LEGACY_LABELS[kind]} />
                    </div>
                    <p className="min-w-0 flex-1 text-sm font-medium">{LEGACY_LABELS[kind]}</p>
                    {canManage ? (
                      <ConfirmDeleteButton
                        label="Supprimer"
                        title={`Supprimer ${LEGACY_LABELS[kind].toLowerCase()} ?`}
                        description="Ce fichier sera supprimé définitivement. Cette action est irréversible."
                        isPending={legacyDeleteMutation.isPending}
                        onConfirm={() => legacyDeleteMutation.mutate(kind)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </section>
  )
}

export function SealCardSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5" aria-busy="true" aria-label="Chargement du cachet et de la signature">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
