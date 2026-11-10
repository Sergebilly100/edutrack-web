import { useEffect, useId, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { listSchoolYears } from "@/modules/academic/academic.api"
import { ExportIcon } from "@/shared/components/icons"
import { EXPORT_DISABLED_MESSAGE, EXPORT_FAILED_MESSAGE } from "@/shared/api/excelExport.api"
import { useCanExportData } from "@/shared/hooks/useCanExportData"

export type ExportListRequest = {
  schoolYearId: string
  schoolYearLabel: string
  /** true : applique les filtres de la liste ; false : tout exporter. */
  filtered: boolean
  /** Les filtres de classe n'existent que pour l'année active. */
  isActiveYear: boolean
}

type ExportListDialogProps = {
  /** Texte du bouton d'ouverture et titre : « Exporter ». */
  noun: string
  filtersActive: boolean
  /** Précision affichée sous le sélecteur d'année. */
  yearHint: string
  onExport: (request: ExportListRequest) => Promise<void>
}

/** Bouton « Exporter » + fenêtre centrée : année scolaire (active par défaut) et « sélection filtrée » / « tout ». */
export function ExportListDialog({ noun, filtersActive, yearHint, onExport }: ExportListDialogProps) {
  const canExport = useCanExportData()
  const [open, setOpen] = useState(false)
  const [yearId, setYearId] = useState("")
  const [scope, setScope] = useState<"filtered" | "all">("all")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const yearFieldId = useId()
  const hintId = useId()

  const yearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears, enabled: open })
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data])
  const activeYear = years.find((year) => year.status === "active")
  const selectedYear = years.find((year) => year.id === yearId)

  useEffect(() => {
    if (!open) return
    setScope(filtersActive ? "filtered" : "all")
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réinitialiser qu'à l'ouverture
  }, [open])

  useEffect(() => {
    if (open && !yearId && years.length > 0) setYearId((activeYear ?? years[0]!).id)
  }, [open, yearId, years, activeYear])

  const launch = async () => {
    if (!selectedYear) return
    setRunning(true)
    setError(null)
    try {
      await onExport({
        schoolYearId: selectedYear.id,
        schoolYearLabel: selectedYear.label,
        filtered: scope === "filtered" && filtersActive,
        isActiveYear: selectedYear.id === activeYear?.id,
      })
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : EXPORT_FAILED_MESSAGE)
    } finally {
      setRunning(false)
    }
  }

  return <>
    <Button
      type="button"
      variant="outline"
      className="min-h-12"
      disabled={!canExport}
      title={canExport ? undefined : EXPORT_DISABLED_MESSAGE}
      onClick={() => setOpen(true)}
    >
      <ExportIcon aria-hidden="true" className="mr-2 h-4 w-4" />
      Exporter
    </Button>
    <Dialog open={open} onOpenChange={(next) => { if (!running) setOpen(next) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`Exporter les ${noun}`}</DialogTitle>
          <DialogDescription>Un fichier Excel (.xlsx) est généré. Les salaires et les données financières ne sont jamais exportés.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor={yearFieldId}>Année scolaire</Label>
            {yearsQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les années scolaires.</AlertDescription></Alert> : (
              <Select value={yearId} onValueChange={setYearId} disabled={yearsQuery.isLoading}>
                <SelectTrigger id={yearFieldId} className="min-h-12" aria-describedby={hintId}>
                  <SelectValue placeholder={yearsQuery.isLoading ? "Chargement…" : "Choisir une année"} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => <SelectItem key={year.id} value={year.id}>{year.label}{year.status === "active" ? " (active)" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <p id={hintId} className="text-xs text-muted-foreground">{yearHint}</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Quoi exporter ?</legend>
            <RadioGroup value={scope} onValueChange={(value) => setScope(value as "filtered" | "all")}>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem id={`${yearFieldId}-filtered`} value="filtered" disabled={!filtersActive} className="mt-0.5" />
                <Label htmlFor={`${yearFieldId}-filtered`} className="space-y-0.5 font-normal">
                  <span className="block font-medium">Exporter la sélection filtrée</span>
                  <span className="block text-xs text-muted-foreground">{filtersActive ? "Reprend les filtres actuellement appliqués à la liste." : "Aucun filtre n’est appliqué à la liste."}</span>
                </Label>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem id={`${yearFieldId}-all`} value="all" className="mt-0.5" />
                <Label htmlFor={`${yearFieldId}-all`} className="space-y-0.5 font-normal">
                  <span className="block font-medium">Tout exporter</span>
                  <span className="block text-xs text-muted-foreground">Ignore les filtres de la liste.</span>
                </Label>
              </div>
            </RadioGroup>
          </fieldset>
          {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="min-h-12" onClick={() => setOpen(false)} disabled={running}>Annuler</Button>
          <Button type="button" className="min-h-12" onClick={() => void launch()} disabled={running || !selectedYear}>
            {running ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}
            {running ? "Génération…" : "Exporter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
