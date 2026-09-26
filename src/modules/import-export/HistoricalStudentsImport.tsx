import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { ColumnMappingFields } from '@/shared/components/ColumnMappingFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { Spinner } from '@/shared/components/Spinner'
import { HISTORICAL_TARGETS, analyzeHistoricalStudents, saveHistoricalMapping, confirmHistoricalStudents,
  downloadHistoricalTemplate, downloadHistoricalErrors, type HistoricalAnalysis, type HistoricalMappingField,
  type HistoricalResult } from './historical-students.api'

const labels = Object.fromEntries(HISTORICAL_TARGETS.map((target) => [target.key, target.label]))
const message = (error: unknown) => axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
  ? error.response.data.error : 'Vérifiez le fichier puis réessayez.'

export function HistoricalStudentsImport() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<HistoricalAnalysis | null>(null)
  const [fields, setFields] = useState<HistoricalMappingField[]>([])
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<HistoricalResult | null>(null)
  const showError = (error: unknown) => toast({ title: 'Import impossible', description: message(error), variant: 'destructive', duration: 6000 })
  const analyze = useMutation({
    mutationFn: () => analyzeHistoricalStudents(file!),
    onSuccess: (data) => {
      setAnalysis(data)
      setFields(HISTORICAL_TARGETS.map((target) => ({
        ...(data.profile?.fields.find((field) => field.targetField === target.key)
          ?? data.matchedFields.find((field) => field.targetField === target.key)
          ?? { sourceColumnLabel: '', translations: [] }),
        targetField: target.key, isRequired: target.required,
      })))
      setReady(Boolean(data.profile) && data.missingTargets.length === 0)
      toast({ title: 'Colonnes analysées', duration: 3000 })
    }, onError: showError,
  })
  const save = useMutation({
    mutationFn: async () => {
      await saveHistoricalMapping(fields.filter((field) => field.sourceColumnLabel))
      return analyzeHistoricalStudents(file!)
    },
    onSuccess: (data) => { setAnalysis(data); setReady(data.missingTargets.length === 0); toast({ title: 'Correspondances enregistrées', duration: 3000 }) },
    onError: showError,
  })
  const confirm = useMutation({
    mutationFn: () => confirmHistoricalStudents(file!),
    onSuccess: async (data) => {
      setResult(data)
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      await queryClient.invalidateQueries({ queryKey: ['import-history'] })
      toast({ title: `${data.createdCount} profil(s) créé(s)`, duration: 3000 })
    }, onError: showError,
  })
  const template = useMutation({ mutationFn: downloadHistoricalTemplate, onSuccess: () => toast({ title: 'Modèle téléchargé', duration: 3000 }), onError: showError })
  const busy = analyze.isPending || save.isPending || confirm.isPending
  const mappingComplete = HISTORICAL_TARGETS.filter((target) => target.required)
    .every((target) => fields.some((field) => field.targetField === target.key && field.sourceColumnLabel))
  const errors = result?.errors ?? analysis?.errors ?? []
  return <Card>
    <CardHeader>
      <CardTitle role="heading" aria-level={2}>Profils élèves historiques</CardTitle>
      <CardDescription>Préparez les élèves déjà connus. Ils seront inscrits plus tard, lors de l’ouverture des classes. Cet import crée uniquement leurs profils, sans inscription, paiement, dossier financier ni document.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <Button variant="outline" className="min-h-12" disabled={template.isPending} onClick={() => template.mutate()}>{template.isPending ? <Spinner size="sm" className="mr-2" /> : null}Télécharger le modèle historique</Button>
      <div className="space-y-2" data-tour="historical-students-file"><Label htmlFor="historical-file">Fichier Excel des élèves</Label><Input id="historical-file" className="min-h-12" type="file" accept=".xlsx" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setAnalysis(null); setResult(null); setReady(false) }} /></div>
      <Button className="min-h-12" disabled={!file || busy} onClick={() => analyze.mutate()}>{analyze.isPending ? <Spinner size="sm" className="mr-2" /> : null}{analyze.isPending ? 'Analyse en cours…' : 'Analyser les colonnes'}</Button>
      {analysis ? <section className="space-y-4" aria-label="Correspondance des colonnes">
        <h3 className="font-semibold">Correspondance des colonnes</h3>
        <p className="text-sm text-muted-foreground">Associez le matricule, le nom et le prénom. Le téléphone parent est facultatif. Les autres colonnes de votre fichier sont ignorées.</p>
        <ColumnMappingFields fields={fields} headers={analysis.headers} labels={labels} idPrefix="historical" disabled={busy} onChange={(target, source) => { setFields((current) => current.map((field) => field.targetField === target ? { ...field, sourceColumnLabel: source } : field)); setReady(false); setResult(null) }} />
        <Button variant="outline" className="min-h-12" disabled={!mappingComplete || busy} onClick={() => save.mutate()}>{save.isPending ? <Spinner size="sm" className="mr-2" /> : null}{save.isPending ? 'Enregistrement…' : 'Enregistrer les correspondances'}</Button>
        {ready ? <>
          <p className="text-sm">{analysis.validCount} ligne(s) valide(s) sur {analysis.rowCount}. Seules les lignes valides seront importées.</p>
          {analysis.sampleRows.length ? <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Ligne</TableHead>{HISTORICAL_TARGETS.map((target) => <TableHead key={target.key}>{target.label}</TableHead>)}</TableRow></TableHeader><TableBody>{analysis.sampleRows.map((row) => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell>{HISTORICAL_TARGETS.map((target) => <TableCell key={target.key}>{row.values[target.key] || '—'}</TableCell>)}</TableRow>)}</TableBody></Table></div> : <EmptyState title="Aucun profil à prévisualiser" description="Vérifiez les lignes de données de votre fichier." />}
          <Button className="min-h-12" disabled={busy || analysis.validCount === 0 || Boolean(result)} onClick={() => confirm.mutate()}>{confirm.isPending ? <Spinner size="sm" className="mr-2" /> : null}{confirm.isPending ? 'Import en cours…' : 'Importer les profils valides'}</Button>
        </> : null}
      </section> : null}
      {result ? <Alert><AlertDescription>{result.createdCount} profil(s) créé(s), {result.reusedCount} profil(s) déjà présent(s). Vous pourrez les inscrire depuis leur fiche élève quand les classes seront ouvertes.</AlertDescription></Alert> : null}
      {errors.length ? <section className="space-y-3" aria-label="Rapport d’erreurs"><h3 className="font-semibold">Lignes à corriger</h3><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Ligne</TableHead><TableHead>Champ</TableHead><TableHead>Erreur</TableHead></TableRow></TableHeader><TableBody>{errors.slice(0, 100).map((error, index) => <TableRow key={`${error.rowNumber}-${error.field}-${index}`}><TableCell>{error.rowNumber}</TableCell><TableCell>{labels[error.field] ?? error.field}</TableCell><TableCell>{error.reason}</TableCell></TableRow>)}</TableBody></Table></div><Button variant="outline" className="min-h-12" onClick={() => downloadHistoricalErrors(errors)}>Télécharger le rapport d’erreurs</Button></section> : null}
    </CardContent>
  </Card>
}
