import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"

import { deleteSchoolLogo, importSchoolLogoFromUrl, uploadSchoolLogo, type SchoolIdentity } from "../settings.api"
import { ConfirmDeleteButton } from "./ConfirmDeleteButton"
import { ImageDropzone } from "./ImageDropzone"
import { extractApiErrorMessage, formatDimensions, formatFileSize, formatImportDate, imageTypeLabel } from "./school-image.utils"
import { useImageDraft } from "./useImageDraft"

type LogoCardProps = {
  identity: SchoolIdentity
  canManage: boolean
  onIdentityChange: (identity: SchoolIdentity) => void
}

export function LogoCard({ identity, canManage, onIdentityChange }: LogoCardProps) {
  const { toast } = useToast()
  const { draft, error, setError, isPreviewing, selectFile, cancel } = useImageDraft("logo")
  const [replacing, setReplacing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [announcement, setAnnouncement] = useState("")
  const [addressDraft, setAddressDraft] = useState("")
  const [addressError, setAddressError] = useState<string | null>(null)

  const logo = identity.logo

  const finish = (next: SchoolIdentity, message: string) => {
    onIdentityChange(next)
    setAnnouncement(message)
    toast({ title: message })
  }

  const saveMutation = useMutation({
    mutationFn: (file: File) => uploadSchoolLogo(file, setProgress),
    onSuccess: (next) => {
      cancel()
      setReplacing(false)
      finish(next, "Logo enregistré")
    },
    onError: async (caught) => {
      const message = await extractApiErrorMessage(caught)
      setError(message)
      setAnnouncement(message)
    },
    onSettled: () => setProgress(0),
  })

  const addressMutation = useMutation({
    mutationFn: importSchoolLogoFromUrl,
    onSuccess: (next) => {
      setAddressDraft("")
      setAddressError(null)
      setReplacing(false)
      finish(next, "Logo importé depuis l'adresse")
    },
    onError: async (caught) => {
      const message = await extractApiErrorMessage(caught)
      setAddressError(message)
      setAnnouncement(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSchoolLogo,
    onSuccess: (next) => finish(next, "Logo supprimé"),
    onError: async (caught) => toast({ title: "Erreur", description: await extractApiErrorMessage(caught), variant: "destructive" }),
  })

  const savedMeta = logo
    ? [
        imageTypeLabel(logo.mime),
        logo.sizeBytes ? formatFileSize(logo.sizeBytes) : null,
        logo.width && logo.height ? formatDimensions(logo.width, logo.height) : null,
        logo.updatedAt ? `importé le ${formatImportDate(logo.updatedAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : ""

  const badge = draft ? (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      Non enregistré
    </Badge>
  ) : logo ? (
    <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
      Enregistré
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-muted text-muted-foreground">
      Non défini
    </Badge>
  )

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm" aria-labelledby="logo-card-title" data-tour="settings-logo">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 id="logo-card-title" className="text-base font-semibold">
          Logo de l&apos;établissement
        </h3>
        {badge}
      </header>

      <div className="space-y-4 p-5">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {draft ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-checkerboard">
                {draft.previewUrl ? <img src={draft.previewUrl} alt="Aperçu du logo de l'établissement" className="h-full w-full object-contain" /> : null}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="break-words text-sm font-semibold">{draft.file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[formatFileSize(draft.file.size), draft.dimensions ? formatDimensions(draft.dimensions.width, draft.dimensions.height) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
            {saveMutation.isPending ? (
              <Progress value={progress} aria-label="Envoi du logo" />
            ) : (
              <p className="text-sm text-muted-foreground">Rien n&apos;est enregistré avant confirmation.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="button" className="min-h-12" disabled={saveMutation.isPending || isPreviewing} onClick={() => saveMutation.mutate(draft.file)}>
                {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button type="button" variant="outline" className="min-h-12" disabled={saveMutation.isPending} onClick={cancel}>
                Annuler
              </Button>
            </div>
          </div>
        ) : logo && !replacing ? (
          <div className="flex flex-wrap items-start gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-checkerboard">
              <img src={logo.url} alt="Logo de l'établissement" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="break-words text-sm font-semibold">{logo.fileName ?? "Logo enregistré"}</p>
                {savedMeta ? <p className="text-sm text-muted-foreground">{savedMeta}</p> : null}
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => setReplacing(true)}>
                    Remplacer
                  </Button>
                  <ConfirmDeleteButton
                    label="Supprimer"
                    title="Supprimer le logo ?"
                    description="Les documents PDF afficheront les initiales de l'école à la place du logo."
                    isPending={deleteMutation.isPending}
                    onConfirm={() => deleteMutation.mutate()}
                  />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP · 2 Mo max</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {canManage ? (
              <ImageDropzone
                title="Glissez-déposez votre logo ici"
                hint="PNG, JPEG ou WebP · 2 Mo max"
                isLoading={isPreviewing}
                errorMessage={error}
                onFile={(file) => void selectFile(file)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Non défini</p>
            )}
            {replacing ? (
              <Button type="button" variant="ghost" className="min-h-12" onClick={() => setReplacing(false)}>
                Annuler le remplacement
              </Button>
            ) : null}
          </div>
        )}

        {canManage && !draft ? (
          <Collapsible className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="group min-h-12 w-full justify-between px-2 text-sm font-medium text-primary">
                Options avancées : utiliser une adresse d&apos;image
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 px-2">
              <Label htmlFor="logo-address" className="text-sm font-medium">
                Adresse de l&apos;image (HTTPS)
              </Label>
              <Input
                id="logo-address"
                value={addressDraft}
                inputMode="url"
                placeholder="https://…"
                aria-describedby="logo-address-help"
                onChange={(event) => {
                  setAddressDraft(event.target.value)
                  setAddressError(null)
                }}
              />
              <p id="logo-address-help" className="text-xs text-muted-foreground">
                L&apos;image est téléchargée une seule fois puis copiée dans IvoirEdu : l&apos;adresse n&apos;est plus appelée ensuite. HTTPS uniquement.
              </p>
              {addressError ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {addressError}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full"
                disabled={addressMutation.isPending || addressDraft.trim().length < 8}
                onClick={() => addressMutation.mutate(addressDraft.trim())}
              >
                {addressMutation.isPending ? "Téléchargement…" : "Importer depuis cette adresse"}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </section>
  )
}

export function LogoCardSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5" aria-busy="true" aria-label="Chargement du logo">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-24 w-24" />
    </div>
  )
}
