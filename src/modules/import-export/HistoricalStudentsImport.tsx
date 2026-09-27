import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { ArrowLeft, Check, Download, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { ColumnMappingFields } from "@/shared/components/ColumnMappingFields"
import { DropZone } from "@/shared/components/DropZone"
import { EmptyState } from "@/shared/components/EmptyState"
import { Spinner } from "@/shared/components/Spinner"
import {
  HISTORICAL_TARGETS, analyzeHistoricalStudents, saveHistoricalMapping, confirmHistoricalStudents,
  downloadHistoricalTemplate, downloadHistoricalErrors, type HistoricalAnalysis, type HistoricalMappingField,
  type HistoricalResult,
} from "./historical-students.api"

const labels = Object.fromEntries(HISTORICAL_TARGETS.map((target) => [target.key, target.label]))
const message = (error: unknown) => axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
  ? error.response.data.error : "Vérifiez le fichier puis réessayez."
const normalizeYear = (value: string) => value.trim().replace(/\s/g, "").replace("/", "-")
const isValidYear = (value: string) => /^\d{4}-\d{4}$/.test(value)
  && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(5)) === Number(value.slice(0, 4)) + 1

export function HistoricalStudentsImport() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [year, setYear] = useState("")
  const [analysis, setAnalysis] = useState<HistoricalAnalysis | null>(null)
  const [fields, setFields] = useState<HistoricalMappingField[]>([])
  const [mappingOpen, setMappingOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<HistoricalResult | null>(null)
  const schoolYearLabel = normalizeYear(year)
  const showError = (error: unknown) => toast({ title: "Import impossible", description: message(error), variant: "destructive", duration: 6000 })
  const analyze = useMutation({
    mutationFn: () => analyzeHistoricalStudents(file!, schoolYearLabel),
    onSuccess: (data) => {
      setAnalysis(data)
      setFields(HISTORICAL_TARGETS.map((target) => {
        const matched = data.matchedFields.find((field) => field.targetField === target.key)
        return { targetField: target.key, sourceColumnLabel: matched?.sourceColumnLabel ?? "", translations: matched?.translations ?? [], isRequired: target.required }
      }))
      setMappingOpen(data.missingTargets.length > 0)
      setReady(data.mappingSaved && data.missingTargets.length === 0)
      toast({ title: "Colonnes analysées", duration: 3000 })
    }, onError: showError,
  })
  const save = useMutation({
    mutationFn: async () => {
      await saveHistoricalMapping(fields.filter((field) => field.sourceColumnLabel))
      return analyzeHistoricalStudents(file!, schoolYearLabel)
    },
    onSuccess: (data) => {
      setAnalysis(data)
      setReady(data.missingTargets.length === 0)
      setMappingOpen(false)
      toast({ title: "Correspondances enregistrées", duration: 3000 })
    }, onError: showError,
  })
  const confirm = useMutation({
    mutationFn: () => confirmHistoricalStudents(file!, schoolYearLabel),
    onSuccess: async (data) => {
      setResult(data)
      await queryClient.invalidateQueries({ queryKey: ["students"] })
      await queryClient.invalidateQueries({ queryKey: ["import-history"] })
      toast({ title: `${data.createdCount} profil(s) créé(s)`, duration: 3000 })
    }, onError: showError,
  })
  const template = useMutation({ mutationFn: downloadHistoricalTemplate, onSuccess: () => toast({ title: "Modèle téléchargé", duration: 3000 }), onError: showError })
  const busy = analyze.isPending || save.isPending || confirm.isPending
  const mappingComplete = HISTORICAL_TARGETS.filter((target) => target.required)
    .every((target) => fields.some((field) => field.targetField === target.key && field.sourceColumnLabel))
  const errors = result?.errors ?? analysis?.errors ?? []
  const step = result ? 3 : analysis ? 2 : 1
  const reset = () => { setAnalysis(null); setResult(null); setReady(false); setFile(null) }

  return <Card className="min-w-0">
    <CardHeader className="space-y-4">
      <div className="space-y-2">
        <CardTitle role="heading" aria-level={2}>Profils élèves historiques</CardTitle>
        <CardDescription className="max-w-3xl">Ajoutez les élèves et leurs contacts parents pour préparer les réinscriptions. L’année et l’ancienne classe sont conservées comme références historiques, sans inscription, paiement, dossier financier ni document.</CardDescription>
      </div>
      <ol aria-label="Étapes de l’import" className="grid grid-cols-3 gap-3 border-t pt-4">
        {["Fichier", "Vérification", "Résultat"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className="flex flex-col items-center gap-2 text-center text-xs sm:flex-row sm:text-left sm:text-sm">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold", step >= index + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{step > index + 1 ? <Check className="h-4 w-4" /> : index + 1}</span>
          <span className={step === index + 1 ? "font-medium" : "text-muted-foreground"}>{label}</span>
        </li>)}
      </ol>
    </CardHeader>
    <CardContent className="space-y-6">
      {!analysis ? <>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="historical-year">Année scolaire de l’historique *</Label>
          <Input id="historical-year" className="min-h-12" placeholder="2024-2025" maxLength={15} value={year} disabled={busy}
            onChange={(event) => setYear(event.target.value)} aria-describedby="historical-year-help" aria-invalid={Boolean(year) && !isValidYear(schoolYearLabel)} />
          <p id="historical-year-help" className="text-xs text-muted-foreground">Année des élèves de ce fichier, même si elle n’a jamais été ouverte dans IvoirEdu. Exemple : 2024-2025.</p>
          {year && !isValidYear(schoolYearLabel) ? <p className="text-sm text-destructive">Renseignez deux années consécutives, par exemple 2024-2025.</p> : null}
        </div>
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1"><p className="text-sm font-medium">Le même modèle élèves que l’import habituel</p><p className="max-w-2xl text-sm text-muted-foreground">Identité, date de naissance et contacts des deux parents. Toutes les feuilles élèves sont lues. Supprimez les lignes d’exemple. La classe peut rester vide ; la colonne Classe ou le nom de feuille indique uniquement l’ancienne classe.</p></div>
          <Button variant="outline" className="min-h-12 shrink-0" disabled={template.isPending} onClick={() => template.mutate()}>{template.isPending ? <Spinner size="sm" className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}Télécharger le modèle élèves</Button>
        </div>
        <div data-tour="historical-students-file"><DropZone inputLabel="Fichier Excel des élèves" maxSizeMb={10} isLoading={busy} onFileSelected={setFile} onFileRejected={() => setFile(null)} /></div>
        <div className="flex justify-end"><Button className="min-h-12 w-full sm:w-auto" disabled={!file || !isValidYear(schoolYearLabel) || busy} onClick={() => analyze.mutate()}>{analyze.isPending ? <Spinner size="sm" className="mr-2" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}{analyze.isPending ? "Analyse en cours…" : "Analyser les colonnes"}</Button></div>
      </> : !result ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div><p className="text-sm font-medium">Historique {analysis.schoolYearLabel}</p><p className="break-all text-xs text-muted-foreground">{file?.name} · {analysis.rowCount} ligne(s)</p></div>
          <Button variant="outline" className="min-h-12" disabled={busy} onClick={() => { setAnalysis(null); setReady(false) }}><ArrowLeft className="mr-2 h-4 w-4" />Changer le fichier ou l’année</Button>
        </div>
        <section className="space-y-4" aria-label="Correspondance des colonnes">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Correspondance des colonnes</h3><Button variant="ghost" className="min-h-12" disabled={busy} aria-expanded={mappingOpen} onClick={() => setMappingOpen(!mappingOpen)}>{mappingOpen ? "Masquer les correspondances" : "Vérifier les correspondances"}</Button></div>
          <p className="text-sm text-muted-foreground">Nom et prénom requis. Le matricule est recommandé pour éviter les doublons et retrouver les élèves lors de leurs réinscriptions. Les classes historiques n’ont pas besoin d’exister dans l’école.</p>
          {mappingOpen ? <ColumnMappingFields fields={fields} headers={analysis.headers} labels={labels} idPrefix="historical" disabled={busy} onChange={(target, source) => { setFields((current) => current.map((field) => field.targetField === target ? { ...field, sourceColumnLabel: source } : field)); setReady(false) }} /> : null}
          {!ready || mappingOpen ? <Button variant="outline" className="min-h-12" disabled={!mappingComplete || busy} onClick={() => save.mutate()}>{save.isPending ? <Spinner size="sm" className="mr-2" /> : null}{save.isPending ? "Enregistrement…" : "Enregistrer les correspondances"}</Button> : null}
        </section>
        {ready ? <section className="space-y-4" aria-label="Aperçu des élèves et parents">
          <div><h3 className="font-semibold">Aperçu des élèves et parents</h3><p className="mt-1 text-sm text-muted-foreground">{analysis.validCount} ligne(s) valide(s) sur {analysis.rowCount}. Seules les lignes valides seront importées.</p></div>
          {analysis.sampleRows.length ? <div className="overflow-x-auto rounded-lg border"><Table>
            <TableHeader><TableRow><TableHead>Feuille · ligne</TableHead><TableHead>Élève</TableHead><TableHead>Ancienne classe</TableHead><TableHead>Parent principal</TableHead><TableHead>Second parent</TableHead></TableRow></TableHeader>
            <TableBody>{analysis.sampleRows.map((row) => <TableRow key={`${row.sheetName}-${row.rowNumber}`}>
              <TableCell className="text-xs">{row.sheetName || "Élèves"} · {row.rowNumber}</TableCell>
              <TableCell><p className="whitespace-nowrap font-medium">{row.values.nom} {row.values.prenom}</p><p className="text-xs text-muted-foreground">{row.values.matricule || "Sans matricule"}{row.values.birth_date ? ` · ${row.values.birth_date}` : ""}</p></TableCell>
              <TableCell>{row.values.historical_class || "Non renseignée"}</TableCell>
              <TableCell><p>{row.values.parent_name || "Non renseigné"}</p><p className="whitespace-nowrap text-xs text-muted-foreground">{row.values.parent_phone || "Sans téléphone"}</p><p className="text-xs text-muted-foreground">{row.values.parent_email}</p></TableCell>
              <TableCell><p>{row.values.parent_name_2 || "Non renseigné"}</p><p className="whitespace-nowrap text-xs text-muted-foreground">{row.values.parent_phone_2}</p></TableCell>
            </TableRow>)}</TableBody>
          </Table></div> : <EmptyState title="Aucun profil à prévisualiser" description="Vérifiez les lignes de données de votre fichier." />}
          <p className="text-xs text-muted-foreground">Les contacts sont enregistrés sur le profil élève. L’inscription et les accès parents seront préparés plus tard, depuis sa fiche.</p>
          <div className="flex justify-end"><Button className="min-h-12 w-full sm:w-auto" disabled={busy || analysis.validCount === 0} onClick={() => confirm.mutate()}>{confirm.isPending ? <Spinner size="sm" className="mr-2" /> : null}{confirm.isPending ? "Import en cours…" : "Importer les profils valides"}</Button></div>
        </section> : null}
      </> : <section className="space-y-4" aria-label="Résultat de l’import">
        <Alert><AlertDescription><p className="font-medium">Historique {result.schoolYearLabel} enregistré</p><p className="mt-1">{result.createdCount} profil(s) créé(s), {result.reusedCount} profil(s) déjà présent(s). Les années et anciennes classes sont conservées sur leurs fiches. Vous pourrez préparer leurs inscriptions quand les classes seront ouvertes.</p></AlertDescription></Alert>
        <Button className="min-h-12" variant="outline" onClick={reset}>Importer un autre lot</Button>
      </section>}
      {errors.length ? <section className="space-y-3" aria-label="Rapport d’erreurs">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Lignes à corriger ({errors.length})</h3><Button variant="outline" className="min-h-12" onClick={() => downloadHistoricalErrors(errors)}><Download className="mr-2 h-4 w-4" />Télécharger le rapport d’erreurs</Button></div>
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Feuille · ligne</TableHead><TableHead>Champ</TableHead><TableHead>Erreur</TableHead></TableRow></TableHeader><TableBody>{errors.slice(0, 100).map((error, index) => <TableRow key={`${error.sheetName}-${error.rowNumber}-${error.field}-${index}`}><TableCell className="text-xs">{error.sheetName || "Élèves"} · {error.rowNumber}</TableCell><TableCell>{labels[error.field] ?? error.field}</TableCell><TableCell>{error.reason}</TableCell></TableRow>)}</TableBody></Table></div>
      </section> : null}
    </CardContent>
  </Card>
}
