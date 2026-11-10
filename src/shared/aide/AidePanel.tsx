import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, PlayCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type { AidePage, AideTask, AideViewer } from "./aide.types"
import { isTaskAvailable, taskMatchesQuery } from "./aide-registry"

const SEARCH_THRESHOLD = 6

type AidePanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: AidePage | undefined
  viewer: AideViewer
  /** Visite guidée de la page, si la page en a une. */
  tourId: string | undefined
  hideBadges: boolean
  onHideBadgesChange: (hide: boolean) => void
  onStartTour: (tourId: string) => void
}

function TaskItem({ task }: { task: AideTask }) {
  return (
    <Collapsible className="rounded-lg border border-border">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-12 w-full justify-between whitespace-normal px-3 text-left font-medium [&[data-state=open]>svg]:rotate-180">
          <span>{task.titre}</span>
          <ChevronDown aria-hidden="true" className="transition-transform motion-reduce:transition-none" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
          {task.etapes.map((etape) => (
            <li key={etape}>{etape}</li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AidePanel({ open, onOpenChange, entry, viewer, tourId, hideBadges, onHideBadgesChange, onStartTour }: AidePanelProps) {
  const [query, setQuery] = useState("")
  const tasks = entry?.taches ?? []
  const showSearch = tasks.length > SEARCH_THRESHOLD

  const filtered = useMemo(() => tasks.filter((task) => taskMatchesQuery(task, query)), [tasks, query])
  const available = filtered.filter((task) => isTaskAvailable(task, viewer))
  const restricted = filtered.filter((task) => !isTaskAvailable(task, viewer))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" data-aide-panel className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4 pr-12 text-left">
          <SheetTitle>{entry ? `Aide : ${entry.titre}` : "Aide de la page"}</SheetTitle>
          <SheetDescription>Trouvez ici à quoi sert cette page et comment faire.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 p-4">
          {entry ? (
            <>
              <section aria-labelledby="aide-sert" className="space-y-2">
                <h3 id="aide-sert" className="text-sm font-semibold">À quoi sert cette page</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{entry.resume}</p>
              </section>

              {entry.prerequis && entry.prerequis.length > 0 ? (
                <section aria-labelledby="aide-prerequis" className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                  <h3 id="aide-prerequis" className="text-sm font-semibold">À activer ou configurer d'abord</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {entry.prerequis.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="aide-comment" className="space-y-3">
                <h3 id="aide-comment" className="text-sm font-semibold">Comment faire</h3>
                {showSearch ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="aide-recherche" className="sr-only">Rechercher dans l'aide</Label>
                    <Input id="aide-recherche" type="search" className="min-h-12" placeholder="Rechercher dans l'aide" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </div>
                ) : null}
                {available.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
                {restricted.map((task) => (
                  <p key={task.id} className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    {task.titre} <span className="block text-xs">{task.reserve ?? "Réservé à la direction"}</span>
                  </p>
                ))}
                {filtered.length === 0 ? <p className="text-sm text-muted-foreground">Aucune réponse ne correspond à « {query} ».</p> : null}
              </section>

              {entry.bonASavoir.length > 0 ? (
                <section aria-labelledby="aide-savoir" className="space-y-2">
                  <h3 id="aide-savoir" className="text-sm font-semibold">Bon à savoir</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {entry.bonASavoir.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              L'aide détaillée de cette page arrive bientôt. En attendant, la visite guidée vous montre les principaux éléments de l'écran.
            </p>
          )}

          {tourId ? (
            <div className="space-y-2">
              <Button type="button" variant="outline" className="min-h-12 w-full" onClick={() => onStartTour(tourId)}>
                <PlayCircle aria-hidden="true" />
                Visite guidée de la page
              </Button>
              <p className="text-center text-xs text-muted-foreground">Présente les zones de l'écran, une par une. Aucune action n'est réalisée.</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Label htmlFor="aide-masquer-pastille" className="text-sm">Ne plus afficher la pastille « nouveau »</Label>
            <Switch id="aide-masquer-pastille" checked={hideBadges} onCheckedChange={onHideBadgesChange} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {viewer.role === "parent" ? null : (
              <Button asChild variant="outline" className="min-h-12 flex-1">
                <Link to="/aide" onClick={() => onOpenChange(false)}>Toute l'aide</Link>
              </Button>
            )}
            <SheetClose asChild>
              <Button type="button" className="min-h-12 flex-1">Fermer</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
