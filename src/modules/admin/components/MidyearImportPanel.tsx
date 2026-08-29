import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { ColumnMappingFields, type ColumnMappingField } from "@/shared/components/ColumnMappingFields"
import {
  analyzeMidyearImport,
  confirmMidyearImport,
  getMidyearMappingProfile,
  saveMidyearMappingProfile,
  type MidyearImportAnalysis,
  type MidyearImportType,
  type MidyearMappingField,
} from "@/modules/admin/admin.api"

const IMPORT_ORDER: MidyearImportType[] = ["levels", "subjects", "rooms", "classes", "students", "payments"]

const IMPORT_LABELS: Record<MidyearImportType, string> = {
  levels: "1 · Niveaux", subjects: "2 · Matières (coef.)", rooms: "3 · Salles",
  classes: "4 · Classes (→ niveau)", students: "5 · Élèves + parents (matricule école)", payments: "6 · Situation financière de départ",
}

const DEPENDENCY_HINT: Record<MidyearImportType, string> = {
  levels: "", subjects: "Nécessite les niveaux.", rooms: "", classes: "Nécessite les niveaux.", students: "Nécessite les classes.", payments: "Nécessite les élèves.",
}

const TARGETS: Record<MidyearImportType, Array<{ key: string; label: string; required: boolean }>> = {
  levels: [{ key: "nom", label: "Nom du niveau", required: true }, { key: "ordre", label: "Ordre", required: false }],
  subjects: [{ key: "niveau", label: "Niveau", required: true }, { key: "matiere", label: "Matière", required: true }, { key: "coefficient", label: "Coefficient", required: true }],
  rooms: [{ key: "nom", label: "Nom de la salle", required: true }, { key: "capacite", label: "Capacité", required: false }],
  classes: [{ key: "nom", label: "Nom de la classe", required: true }, { key: "niveau", label: "Niveau", required: true }],
  students: [{ key: "matricule", label: "Matricule", required: true }, { key: "nom", label: "Nom", required: true }, { key: "prenom", label: "Prénom", required: true }, { key: "classe", label: "Classe", required: true }, { key: "parent_phone", label: "Téléphone parent", required: false }],
  payments: [{ key: "matricule", label: "Matricule", required: true }, { key: "montant", label: "Montant", required: true }],
}

const fieldsFor = (importType: MidyearImportType, fields: MidyearMappingField[] | undefined): MidyearMappingField[] =>
  TARGETS[importType].map((target) => fields?.find((item) => item.targetField === target.key) ?? {
    sourceColumnLabel: "", targetField: target.key, isRequired: target.required, translations: [],
  })

const labelsFor = (importType: MidyearImportType): Record<string, string> =>
  Object.fromEntries(TARGETS[importType].map((target) => [target.key, target.label]))

export function MidyearImportPanel({ tenantId }: { tenantId: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedType, setSelectedType] = useState<MidyearImportType>("levels")
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<MidyearImportAnalysis | null>(null)
  const [fields, setFields] = useState<MidyearMappingField[]>([])
  const [mappingSavedForFile, setMappingSavedForFile] = useState(false)
  const [result, setResult] = useState<{ createdCount: number; errors: Array<{ rowNumber: number; reason: string }> } | null>(null)

  const profileQuery = useQuery({
    queryKey: ["admin", "midyear-import", tenantId, selectedType, "profile"],
    queryFn: () => getMidyearMappingProfile(tenantId, selectedType),
  })

  useEffect(() => {
    if (profileQuery.data !== undefined && !analysis) setFields(fieldsFor(selectedType, profileQuery.data?.fields))
  }, [analysis, profileQuery.data, selectedType])

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeMidyearImport(tenantId, selectedType, file!),
    onSuccess: (data) => {
      setAnalysis(data)
      setFields(fieldsFor(selectedType, data.profile?.fields ?? data.matchedFields))
      setMappingSavedForFile(Boolean(data.profile) && data.missingTargets.length === 0)
    },
    onError: (error) => toast({ title: "Analyse impossible", description: error instanceof Error ? error.message : "Vérifiez le fichier et les prérequis de cet import.", variant: "destructive", duration: 6000 }),
  })

  const mappingReady = TARGETS[selectedType].filter((target) => target.required)
    .every((target) => fields.some((field) => field.targetField === target.key && field.sourceColumnLabel))

  const saveMappingMutation = useMutation({
    mutationFn: () => saveMidyearMappingProfile(tenantId, selectedType, { label: file?.name, fields }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "midyear-import", tenantId, selectedType, "profile"] })
      setMappingSavedForFile(true)
      setAnalysis((current) => current ? { ...current, missingTargets: [] } : current)
      toast({ title: "Correspondances enregistrées" })
    },
    onError: (error) => toast({ title: "Correspondances incomplètes", description: error instanceof Error ? error.message : "Renseignez chaque colonne obligatoire.", variant: "destructive", duration: 6000 }),
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmMidyearImport(tenantId, selectedType, file!),
    onSuccess: (data) => { setResult(data); toast({ title: `${data.createdCount} ligne(s) importée(s)`, duration: 3000 }) },
    onError: (error) => toast({ title: "Import impossible", description: error instanceof Error ? error.message : "Vérifiez les correspondances enregistrées puis réessayez.", variant: "destructive", duration: 6000 }),
  })

  const resetForType = (nextType: MidyearImportType) => {
    setSelectedType(nextType); setFile(null); setAnalysis(null); setResult(null); setMappingSavedForFile(false)
  }
  const updateField = (targetField: string, sourceColumnLabel: string) => {
    setFields((current) => current.map((field) => field.targetField === targetField ? { ...field, sourceColumnLabel } : field))
    setMappingSavedForFile(false)
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Import « prise en main » — ordre strict</CardTitle>
          <CardDescription>Configurez les correspondances pour chaque fichier. Elles sont mémorisées et peuvent être modifiées avant un prochain import.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {IMPORT_ORDER.map((type) => <Button key={type} type="button" variant={selectedType === type ? "default" : "outline"} className="min-h-12 justify-start whitespace-normal text-left" onClick={() => resetForType(type)}><span>{IMPORT_LABELS[type]}{DEPENDENCY_HINT[type] ? <span className="block text-xs font-normal opacity-80">{DEPENDENCY_HINT[type]}</span> : null}</span></Button>)}
          </div>

          <div className="space-y-2">
            <Label htmlFor="midyear-file">Fichier Excel ({IMPORT_LABELS[selectedType]})</Label>
            <Input id="midyear-file" type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setAnalysis(null); setResult(null); setMappingSavedForFile(false) }} />
          </div>
          <Button type="button" className="min-h-12" disabled={!file || analyzeMutation.isPending} onClick={() => analyzeMutation.mutate()}>
            {analyzeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {analyzeMutation.isPending ? "Analyse en cours..." : "Analyser les colonnes"}
          </Button>

          {analysis ? <div className="space-y-5 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{analysis.rowCount} lignes</Badge><Badge variant="outline">{analysis.headers.length} colonnes détectées</Badge>{profileQuery.data ? <Badge variant="outline">Profil mémorisé</Badge> : null}</div>
            <div><h3 className="font-semibold">Correspondance des colonnes</h3><p className="text-sm text-muted-foreground">Les champs marqués d&apos;un astérisque sont requis. L&apos;ordre des colonnes n&apos;a pas d&apos;importance.</p></div>
            <ColumnMappingFields fields={fields as Array<ColumnMappingField<string>>} headers={analysis.headers} idPrefix={`midyear-${selectedType}`} labels={labelsFor(selectedType)} onChange={updateField} />
            {analysis.missingTargets.length > 0 ? <Alert><AlertDescription>Configurez les champs requis avant l&apos;import : {analysis.missingTargets.join(", ")}.</AlertDescription></Alert> : null}
            <Button type="button" className="min-h-12" disabled={!mappingReady || saveMappingMutation.isPending} onClick={() => saveMappingMutation.mutate()}>{saveMappingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{saveMappingMutation.isPending ? "Enregistrement..." : "Enregistrer les correspondances"}</Button>
            <Button type="button" variant="secondary" className="min-h-12" disabled={!mappingSavedForFile || confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>{confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{confirmMutation.isPending ? "Import en cours..." : "Lancer l’import définitif"}</Button>
          </div> : null}

          {result ? <div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead>Résultat</TableHead><TableHead className="text-right">Valeur</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Lignes importées</TableCell><TableCell className="text-right font-medium">{result.createdCount}</TableCell></TableRow><TableRow><TableCell>Lignes en erreur</TableCell><TableCell className="text-right font-medium">{result.errors.length}</TableCell></TableRow>{result.errors.slice(0, 10).map((error) => <TableRow key={`${error.rowNumber}-${error.reason}`}><TableCell>Ligne {error.rowNumber}</TableCell><TableCell className="text-right text-destructive">{error.reason}</TableCell></TableRow>)}</TableBody></Table></div> : null}
        </CardContent>
      </Card>
    </div>
  )
}
