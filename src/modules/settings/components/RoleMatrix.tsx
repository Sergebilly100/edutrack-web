import { useId, useMemo } from "react"
import axios from "axios"
import { ChevronDown, ShieldCheck } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { cn } from "@/lib/utils"
import { changePermissions, isPermissionRequired, usePermissionCatalogue } from "../permission-catalogue"
import type { CataloguePermission } from "../settings.api"

type RoleMatrixProps = {
  position: { permissions: string[] }
  onChange: (permissions: string[]) => void
  className?: string
}

export default function RoleMatrix({ position, onChange, className }: RoleMatrixProps) {
  const matrixId = useId()
  const catalogueQuery = usePermissionCatalogue()
  const catalogue = catalogueQuery.data?.permissions
  const groups = useMemo(() => {
    const domains = new Map<string, { label: string; permissions: CataloguePermission[] }>()
    for (const entry of catalogue ?? []) {
      const group = domains.get(entry.domain) ?? { label: entry.domainLabel, permissions: [] }
      group.permissions.push(entry)
      domains.set(entry.domain, group)
    }
    return [...domains.entries()]
  }, [catalogue])
  const selected = new Set(position.permissions)

  if (catalogueQuery.isPending) return (
    <div role="status" aria-label="Chargement du catalogue des permissions" className="space-y-3 p-4">
      <span className="text-sm text-muted-foreground">Chargement des permissions…</span>
      <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
    </div>
  )
  if (catalogueQuery.isError) {
    const error = catalogueQuery.error
    const forbidden = (axios.isAxiosError(error) && error.response?.status === 403) ||
      (error instanceof Error && "status" in error && error.status === 403)
    return <Alert variant="destructive"><AlertDescription className="space-y-3">
      <p>{forbidden ? "Votre poste ne permet pas de consulter ou gérer les permissions." : "Impossible de charger le catalogue des permissions."}</p>
      <Button type="button" variant="outline" className="min-h-12" onClick={() => void catalogueQuery.refetch()}>Réessayer</Button>
    </AlertDescription></Alert>
  }
  if (!catalogue?.length) return <EmptyState title="Aucune permission disponible" description="Le catalogue est vide. Les attributions ne peuvent pas être modifiées." />

  const activeCount = catalogue.filter((entry) => entry.available && selected.has(entry.key)).length
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Matrice de permissions</span></div>
        <span className="text-xs text-muted-foreground">{activeCount} droit{activeCount !== 1 ? "s" : ""} sélectionné{activeCount !== 1 ? "s" : ""}</span>
        <p className="w-full text-xs text-muted-foreground">Les modifications s’appliquent après l’enregistrement du poste.</p>
      </div>
      <div>
          {groups.map(([domain, group]) => {
            const available = group.permissions.filter((entry) => entry.available)
            const count = available.filter((entry) => selected.has(entry.key)).length
            const state = count === 0 ? false : count === available.length ? true : "indeterminate"
            const unavailableCount = group.permissions.length - available.length
            const groupCheckboxId = `${matrixId}-group-${domain}`
            const groupSummaryId = `${groupCheckboxId}-summary`
            return <Collapsible key={domain} className="border-b last:border-b-0" data-permission-domain={domain}>
              <div className="flex items-center bg-muted/20 px-2">
                <h3 className="min-w-0 flex-1">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" aria-label={`Permissions : ${group.label}`} aria-describedby={groupSummaryId}
                      className="group h-auto min-h-12 w-full justify-start gap-2 rounded-none px-2 py-3 text-left">
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
                      <span className="min-w-0 flex-1 whitespace-normal">
                        <span className="block text-sm font-semibold">{group.label}</span>
                        {unavailableCount ? <span className="block text-xs font-normal text-muted-foreground">
                          {unavailableCount} droit{unavailableCount !== 1 ? "s" : ""} indisponible{unavailableCount !== 1 ? "s" : ""}
                        </span> : null}
                      </span>
                      <span id={groupSummaryId} className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground" title="Droits disponibles sélectionnés">
                        <span className="sr-only">Droits disponibles sélectionnés : </span>
                        {count}/{available.length}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                </h3>
                <label htmlFor={groupCheckboxId} className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center" title={`Tout sélectionner ${group.label}`}>
                  <Checkbox id={groupCheckboxId} className="h-4 w-4" checked={state} disabled={!available.length}
                    aria-label={`Tout sélectionner ${group.label}`}
                    onCheckedChange={(checked) => onChange(changePermissions(position.permissions, group.permissions, checked === true, catalogue))} />
                </label>
              </div>
              <CollapsibleContent className="border-t" role="region" aria-label={`${group.label} : permissions`}>
              {group.permissions.map((entry) => {
                const locked = selected.has(entry.key) && isPermissionRequired(entry.key, position.permissions, catalogue)
                const checkboxId = `${matrixId}-permission-${entry.key}`
                const descriptionId = `${checkboxId}-description`
                const hasDescription = Boolean(entry.unavailableReason || entry.activationDependencies.length || locked || (!entry.available && selected.has(entry.key)))
                return <div key={entry.key} data-permission-key={entry.key} className="border-b px-4 last:border-b-0">
                    <label htmlFor={checkboxId} className={cn("flex min-h-12 cursor-pointer items-center gap-3 py-2 text-sm font-medium", (!entry.available || locked) && "cursor-not-allowed")}>
                      <Checkbox id={checkboxId} className="h-4 w-4"
                        checked={entry.available && selected.has(entry.key)} disabled={!entry.available || locked}
                        aria-label={entry.label} aria-describedby={hasDescription ? descriptionId : undefined}
                        onCheckedChange={(checked) => onChange(changePermissions(position.permissions, [entry], checked === true, catalogue))} />
                      <span>{entry.label}</span>
                    </label>
                    {hasDescription ? <div id={descriptionId} className="space-y-1 pb-3 pl-7 text-xs text-muted-foreground">
                      {entry.unavailableReason ? <p>Indisponible : {entry.unavailableReason}</p> : null}
                      {entry.activationDependencies.length ? <ul className="space-y-1">
                        {entry.activationDependencies.map((dependency) => <li key={dependency.feature}>
                          {dependency.label} : {dependency.enabled ? "oui" : "non"}
                        </li>)}
                      </ul> : null}
                      {locked && entry.available ? <p>Requis par une autre action sélectionnée.</p> : null}
                      {!entry.available && selected.has(entry.key) ? <div>
                        <p>Attribution enregistrée, service indisponible. Retirez ce droit pour enregistrer une modification des permissions.</p>
                        <Button type="button" variant="outline" className="mt-2 min-h-12" aria-label={`Retirer ${entry.label}`}
                          onClick={() => onChange(position.permissions.filter((key) => key !== entry.key))}>Retirer l’attribution inactive</Button>
                      </div> : null}
                    </div> : null}
                </div>
              })}
              </CollapsibleContent>
            </Collapsible>
          })}
      </div>
    </div>
  )
}
