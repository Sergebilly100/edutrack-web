import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"
import { ColumnMappingFields } from "@/shared/components/ColumnMappingFields"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  analyzeMidyearImport, confirmMidyearImport, getSchoolYearStatus,
  previewMidyearImport, saveMidyearMappingProfile,
  type MidyearImportAnalysis, type MidyearImportType, type MidyearMappingField,
  type MidyearRecoveryPreview, type MidyearRecoveryResult,
} from "@/modules/admin/admin.api"

const IMPORT_ORDER: MidyearImportType[] = ["levels", "subjects", "rooms", "classes", "students", "teacher_assignments", "payments"]
const IMPORT_LABELS: Record<MidyearImportType, string> = {
  levels: "1 · Niveaux", subjects: "2 · Matières", rooms: "3 · Salles",
  classes: "4 · Classes", students: "5 · Élèves et inscriptions", teacher_assignments: "6 · Professeurs : affectations", payments: "7 · Paiements déjà reçus",
}
const TARGETS: Record<MidyearImportType, Array<{ key: string; label: string; required: boolean }>> = {
  levels: [{ key: "nom", label: "Nom du niveau", required: true }, { key: "ordre", label: "Ordre", required: false }],
  subjects: [{ key: "niveau", label: "Niveau", required: true }, { key: "matiere", label: "Matière", required: true }, { key: "coefficient", label: "Coefficient", required: true }],
  rooms: [{ key: "nom", label: "Nom de la salle", required: true }, { key: "capacite", label: "Capacité", required: false }],
  classes: [{ key: "nom", label: "Nom de la classe", required: true }, { key: "niveau", label: "Niveau", required: true }],
  students: [{ key: "matricule", label: "Matricule", required: true }, { key: "nom", label: "Nom", required: true }, { key: "prenom", label: "Prénom", required: true }, { key: "niveau", label: "Niveau", required: true }, { key: "classe", label: "Classe", required: true }, { key: "parent_phone", label: "Téléphone parent", required: false }, { key: "birth_date", label: "Date de naissance", required: false }, { key: "sex", label: "Sexe", required: false }, { key: "nationality", label: "Nationalité", required: false }, { key: "birth_place", label: "Lieu de naissance", required: false }, { key: "repeating", label: "Redoublant", required: false }],
  teacher_assignments: [{ key: "matricule", label: "Matricule professeur", required: true }, { key: "matiere", label: "Matière", required: true }, { key: "classes", label: "Classes (séparées par des virgules)", required: true }],
  payments: [{ key: "matricule", label: "Matricule", required: true }, { key: "montant", label: "Montant", required: true }, { key: "date", label: "Date effective", required: true }, { key: "reference", label: "Référence", required: true }, { key: "method", label: "Moyen de paiement", required: true }],
}
const METHODS: Record<string, string> = { cash: "Espèces", mobile_money: "Mobile Money", bank_transfer: "Virement bancaire" }
const fieldsFor = (type: MidyearImportType, fields: MidyearMappingField[] | undefined): MidyearMappingField[] =>
  TARGETS[type].map((target) => fields?.find((item) => item.targetField === target.key) ?? {
    sourceColumnLabel: "", targetField: target.key, isRequired: target.required, translations: [],
  })

export function MidyearImportPanel({ tenantId, schoolName, teachersOnly = false }: { tenantId: string; schoolName: string; teachersOnly?: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [yearId, setYearId] = useState("")
  const [selectedType, setSelectedType] = useState<MidyearImportType>(teachersOnly ? "teacher_assignments" : "levels")
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<MidyearImportAnalysis | null>(null)
  const [fields, setFields] = useState<MidyearMappingField[]>([])
  const [mappingSaved, setMappingSaved] = useState(false)
  const [preview, setPreview] = useState<MidyearRecoveryPreview | null>(null)
  const [impactAccepted, setImpactAccepted] = useState(false)
  const [result, setResult] = useState<MidyearRecoveryResult | null>(null)
  const yearQuery = useQuery({ queryKey: ["admin", "school-year-status", tenantId], queryFn: () => getSchoolYearStatus(tenantId) })
  const invalidatePreview = () => { setPreview(null); setImpactAccepted(false); setResult(null) }
  const resetFile = () => { setFile(null); setAnalysis(null); setFields([]); setMappingSaved(false); invalidatePreview() }
  const onError = (title: string, error: unknown, retry: () => void) => toast({ title, description: error instanceof Error ? error.message : "Vérifiez le fichier puis réessayez.", variant: "destructive", duration: 6000, action: <ToastAction className="min-h-12" altText="Réessayer" onClick={retry}>Réessayer</ToastAction> })

  const analyzeMutation = useMutation({ mutationFn: () => analyzeMidyearImport(tenantId, selectedType, file!, yearId), onSuccess: (data) => {
    setAnalysis(data); setFields(fieldsFor(selectedType, data.matchedFields));
    setMappingSaved(Boolean(data.profile) && data.missingTargets.length === 0); invalidatePreview()
    toast({ title: "Colonnes analysées", duration: 3000 })
  }, onError: (error) => onError("Analyse impossible", error, () => analyzeMutation.mutate()) })
  const saveMutation = useMutation({ mutationFn: () => saveMidyearMappingProfile(tenantId, selectedType, { label: file?.name, fields: fields.filter((f) => f.sourceColumnLabel) }), onSuccess: async () => {
    setMappingSaved(true); invalidatePreview()
    await queryClient.invalidateQueries({ queryKey: ["admin", "midyear-import", tenantId, selectedType, "profile"] })
    toast({ title: "Correspondances enregistrées", duration: 3000 })
  }, onError: (error) => onError("Correspondances incomplètes", error, () => saveMutation.mutate()) })
  const previewMutation = useMutation({ mutationFn: () => previewMidyearImport(tenantId, selectedType, file!, yearId), onSuccess: (data) => {
    setPreview(data); setImpactAccepted(false); setResult(null)
    toast({ title: "Aperçu disponible", description: `${data.validRows.length} ligne(s) valide(s), ${data.errors.length} erreur(s).`, duration: 3000 })
  }, onError: (error) => onError("Aperçu impossible", error, () => previewMutation.mutate()) })
  const confirmMutation = useMutation({ mutationFn: () => confirmMidyearImport(tenantId, selectedType, file!, yearId, preview!.previewToken), onSuccess: async (data) => {
    setResult(data); setPreview(null); setImpactAccepted(false)
    await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
    toast({ title: `${data.createdCount} ligne(s) créée(s), ${data.reusedCount} réutilisée(s)`, duration: 3000 })
  }, onError: (error) => { setPreview(null); setImpactAccepted(false); onError("Import impossible", error, () => previewMutation.mutate()) } })
  const busy = analyzeMutation.isPending || saveMutation.isPending || previewMutation.isPending || confirmMutation.isPending
  const ready = TARGETS[selectedType].filter((t) => t.required).every((t) => fields.some((f) => f.targetField === t.key && f.sourceColumnLabel))
  const updateField = (targetField: string, sourceColumnLabel: string) => {
    setFields((current) => current.map((field) => field.targetField === targetField ? { ...field, sourceColumnLabel } : field))
    setMappingSaved(false); invalidatePreview()
  }
  const methodField = fields.find((f) => f.targetField === "method")
  const methodValues = methodField && analysis ? analysis.distinctValuesByColumn[methodField.sourceColumnLabel] ?? [] : []
  const errors = preview?.errors ?? result?.errors
  const excludedRows = new Set(errors?.map((error) => error.rowNumber)).size

  return <section className="space-y-6" aria-label="Imports de l’école">
    <div className="space-y-2">
      <h2 className="text-2xl font-medium">{teachersOnly ? "Importer les affectations des professeurs" : "Importer les données de l’école"}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">Opération réservée au super administrateur. Chaque fichier est contrôlé avant l’écriture. Les lignes en erreur seront exclues.</p>
      <p className="font-medium">École sélectionnée : {schoolName}</p>
    </div>
    {yearQuery.isLoading ? <Skeleton className="h-12 w-full" /> : yearQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger l’année scolaire.<Button variant="outline" className="ml-2 min-h-12" onClick={() => yearQuery.refetch()}>Réessayer</Button></AlertDescription></Alert> : !yearQuery.data?.activeYear ? <EmptyState title="Aucune année scolaire active" description="Ouvrez l’année concernée dans l’onglet Cycle scolaire avant de reprendre les données." /> : <div className="max-w-md space-y-2">
      <Label htmlFor="recovery-year">Année scolaire concernée</Label>
      <Select value={yearId} disabled={busy} onValueChange={(value) => { setYearId(value); resetFile() }}><SelectTrigger id="recovery-year" className="min-h-12"><SelectValue placeholder="Sélectionner explicitement l’année active" /></SelectTrigger><SelectContent><SelectItem className="min-h-12" value={yearQuery.data.activeYear.id}>{yearQuery.data.activeYear.label}</SelectItem></SelectContent></Select>
    </div>}
    <div className="flex flex-wrap gap-2" aria-label="Types de données à importer">
      {(teachersOnly ? ["teacher_assignments" as const] : IMPORT_ORDER).map((type) => <Button key={type} type="button" variant={selectedType === type ? "default" : "outline"} className="min-h-12 whitespace-normal" disabled={busy} onClick={() => { setSelectedType(type); resetFile() }}>{IMPORT_LABELS[type]}</Button>)}
    </div>
    {selectedType === "teacher_assignments" ? <Alert><AlertDescription>Import de données professeurs réservé au super administrateur, après la création des classes. Format : Matricule | Matière | Classes. Exemple : P-001 | Mathématiques | 4e A, 2nde C. Une ligne par groupe ; toutes les classes d’une ligne doivent être valides. Les dépendances manquantes et les associations déjà présentes sont refusées.</AlertDescription></Alert> : null}
    {selectedType === "students" ? <p className="text-sm text-muted-foreground">Les classes manquantes du niveau indiqué seront annoncées dans l’aperçu et créées à la confirmation. Les profils déjà présents seront réutilisés si leur identité correspond.</p> : null}
    {selectedType === "payments" ? <Alert><AlertDescription>Les paiements doivent correspondre à des inscriptions confirmées. Montant, date effective, référence et moyen de paiement sont conservés. Ces données de migration alimentent les dossiers financiers sans apparaître dans le journal de caisse.</AlertDescription></Alert> : null}
    <div className="space-y-2"><Label htmlFor="midyear-file">Fichier Excel ({IMPORT_LABELS[selectedType]})</Label><Input key={`${yearId}-${selectedType}`} id="midyear-file" className="min-h-12" type="file" accept=".xlsx" disabled={!yearId || busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setAnalysis(null); setMappingSaved(false); invalidatePreview() }} /></div>
    <Button className="min-h-12" disabled={!yearId || !file || busy} onClick={() => analyzeMutation.mutate()}>{analyzeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{analyzeMutation.isPending ? "Analyse en cours..." : "Analyser les colonnes"}</Button>
    {analysis ? <div className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Correspondance des colonnes</h3><Badge variant="outline">{analysis.rowCount} lignes</Badge></div>
      <ColumnMappingFields fields={fields} headers={analysis.headers} idPrefix={`midyear-${selectedType}`} labels={Object.fromEntries(TARGETS[selectedType].map((t) => [t.key, t.label]))} onChange={updateField} disabled={busy} />
      {selectedType === "payments" && methodValues.length ? <div className="space-y-3"><h4 className="font-medium">Traductions explicites des moyens de paiement</h4>{methodValues.map((value, index) => <div key={value} className="grid items-center gap-2 sm:grid-cols-2"><Label htmlFor={`method-${index}`}>{value}</Label><Select disabled={busy} value={methodField?.translations.find((t) => t.sourceValue === value)?.targetValue || (METHODS[value] ? value : "unmapped")} onValueChange={(targetValue) => {
        setFields((current) => current.map((f) => f.targetField === "method" ? { ...f, translations: [...f.translations.filter((t) => t.sourceValue !== value), ...(targetValue === "unmapped" ? [] : [{ sourceValue: value, targetValue }])] } : f)); setMappingSaved(false); invalidatePreview()
      }}><SelectTrigger id={`method-${index}`} className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem className="min-h-12" value="unmapped">Choisir une correspondance</SelectItem>{Object.entries(METHODS).map(([id, label]) => <SelectItem className="min-h-12" key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>)}</div> : null}
      <div className="flex flex-wrap gap-2"><Button className="min-h-12" disabled={!ready || busy} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{saveMutation.isPending ? "Enregistrement..." : "Enregistrer les correspondances"}</Button><Button variant="secondary" className="min-h-12" disabled={!mappingSaved || busy} onClick={() => previewMutation.mutate()}>{previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{previewMutation.isPending ? "Contrôle en cours..." : "Prévisualiser la reprise"}</Button></div>
    </div> : null}
    {preview ? <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Impact avant confirmation</h3><p>{schoolName} · {yearQuery.data?.activeYear?.label} · {preview.validRows.length} ligne(s) valide(s)</p>
      {selectedType === "teacher_assignments" ? <p>{preview.impact.assignmentsCreated ?? 0} association(s) à créer.</p> : null}
      {selectedType !== "teacher_assignments" ? <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt>Profils</dt><dd>{preview.impact.profilesCreated} à créer, {preview.impact.profilesReused} à réutiliser</dd></div>
        <div><dt>Classes</dt><dd>{preview.impact.classesCreated} à créer, {preview.impact.classesReused} à réutiliser</dd></div>
        <div><dt>Inscriptions actives</dt><dd>{preview.impact.enrollmentsCreated} à créer, {preview.impact.enrollmentsReused} à réutiliser</dd></div>
        <div><dt>Paiements</dt><dd>{preview.impact.paymentsCreated} à créer, {preview.impact.paymentsReused} déjà repris</dd></div>
      </dl> : null}
      {preview.classesWithoutTeacherAssignments ? <Alert><AlertDescription>{preview.classesWithoutTeacherAssignments} classe(s) sans affectation professeur. Les profils et affectations professeurs constituent une étape distincte à terminer avant l’import de l’emploi du temps.</AlertDescription></Alert> : null}
      {preview.validRows.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Ligne</TableHead>{TARGETS[selectedType].map((t) => <TableHead key={t.key}>{t.label}</TableHead>)}</TableRow></TableHeader><TableBody>{preview.validRows.map((row) => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell>{TARGETS[selectedType].map((t) => <TableCell key={t.key}>{row.values[t.key]}</TableCell>)}</TableRow>)}</TableBody></Table></div> : <EmptyState title="Aucune ligne valide" description="Corrigez les erreurs signalées avant de relancer l’aperçu." />}
      <div className="flex min-h-12 items-center gap-3"><Checkbox id="recovery-impact" disabled={busy || !preview.validRows.length} checked={impactAccepted} onCheckedChange={(checked) => setImpactAccepted(checked === true)} /><Label className="flex min-h-12 items-center" htmlFor="recovery-impact">Je confirme cet impact pour l’école et l’année sélectionnées. Les {excludedRows} ligne(s) en erreur seront exclues.</Label></div>
    </div> : null}
    {analysis ? <Button className="min-h-12" disabled={!preview?.validRows.length || !impactAccepted || busy} onClick={() => confirmMutation.mutate()}>{confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{confirmMutation.isPending ? "Import en cours..." : "Lancer l’import définitif"}</Button> : null}
    {(preview?.classesWithoutHomeroomTeacher ?? result?.classesWithoutHomeroomTeacher)?.length ? <Alert><AlertDescription>Rappel : classes sans professeur principal : {(preview?.classesWithoutHomeroomTeacher ?? result?.classesWithoutHomeroomTeacher)?.map((item) => item.name).join(", ")}. Ce rappel ne bloque pas l’import.</AlertDescription></Alert> : null}
    {errors ? <div className="space-y-3"><h3 className="font-semibold">Rapport d’erreurs ({errors.length})</h3>{errors.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Ligne</TableHead><TableHead>Colonne</TableHead><TableHead>Valeur</TableHead><TableHead>Cause</TableHead></TableRow></TableHeader><TableBody>{errors.map((error, index) => <TableRow key={`${error.rowNumber}-${index}`}><TableCell>{error.rowNumber}</TableCell><TableCell>{error.column ?? ""}</TableCell><TableCell>{error.value ?? ""}</TableCell><TableCell className="text-destructive">{error.reason}</TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState title="Aucune erreur" description="Toutes les lignes du fichier sont valides." />}</div> : null}
    {result ? <Alert><AlertDescription>Reprise terminée : {result.createdCount} ligne(s) créée(s), {result.reusedCount} réutilisée(s), {excludedRows} exclue(s).</AlertDescription></Alert> : null}
  </section>
}
