import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Plus, Trash2, Upload } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { ColumnMappingFields } from "@/shared/components/ColumnMappingFields"
import { formatFcfa } from "@/shared/utils/formatting"
import { analyzePaymentImport, confirmPaymentImport, getPaymentMappingProfile, previewPaymentImport, savePaymentMappingProfile, type PaymentImportAnalysis, type PaymentImportPreview, type PaymentMappingField, type PaymentMethod } from "../finance.api"

const targets = ["matricule", "montant", "date", "reference", "method"] as const
const targetLabels: Record<typeof targets[number], string> = { matricule: "Matricule", montant: "Montant", date: "Date du paiement", reference: "Référence", method: "Mode de paiement" }
const methodLabels: Record<PaymentMethod, string> = { cash: "Espèces", mobile_money: "Mobile Money", bank_transfer: "Virement" }
type DraftMappingField = Omit<PaymentMappingField, "translations"> & { translations: Array<{ sourceValue: string; targetValue: PaymentMethod | "" }> }

const profileFields = (profile: Awaited<ReturnType<typeof getPaymentMappingProfile>>): DraftMappingField[] =>
  targets.map((target) => profile?.fields.find((field) => field.targetField === target) ?? { sourceColumnLabel: "", targetField: target, isRequired: true, translations: [] })

export function PaymentImportPanel() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ["finance", "payment-import", "profile"], queryFn: getPaymentMappingProfile })
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<PaymentImportAnalysis | null>(null)
  const [preview, setPreview] = useState<PaymentImportPreview | null>(null)
  const [fields, setFields] = useState<DraftMappingField[]>([])
  const [editingProfile, setEditingProfile] = useState(false)
  useEffect(() => { if (profileQuery.data !== undefined) setFields(profileFields(profileQuery.data)) }, [profileQuery.data])

  const analyzeMutation = useMutation({ mutationFn: analyzePaymentImport, onSuccess: (data) => {
    setAnalysis(data); setPreview(null)
    setFields(targets.map((target) => {
      const matched = data.matchedFields.find((field) => field.targetField === target)
      return matched ?? { sourceColumnLabel: "", targetField: target, isRequired: true, translations: [] }
    }))
  }, onError: () => toast({ title: "Fichier illisible", description: "Vérifiez qu’il s’agit d’un fichier Excel contenant une ligne d’en-têtes.", variant: "destructive" }) })
  const finalizedFields = (): PaymentMappingField[] => fields.map((field) => ({ ...field, translations: field.translations.map((item) => ({ ...item, targetValue: item.targetValue as PaymentMethod })) }))
  const saveMutation = useMutation({ mutationFn: () => savePaymentMappingProfile({ label: file?.name ?? profileQuery.data?.label ?? undefined, fields: finalizedFields() }), onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["finance", "payment-import", "profile"] }); setEditingProfile(false)
    toast({ title: "Profil de mapping enregistré" })
  }, onError: (error) => toast({ title: "Profil incomplet", description: error instanceof Error ? error.message : "Vérifiez toutes les correspondances.", variant: "destructive" }) })
  const previewMutation = useMutation({ mutationFn: async () => { await savePaymentMappingProfile({ label: file?.name, fields: finalizedFields() }); return previewPaymentImport(file!) }, onSuccess: setPreview, onError: (error) => toast({ title: "Aperçu impossible", description: error instanceof Error ? error.message : "Vérifiez le mapping.", variant: "destructive" }) })
  const confirmMutation = useMutation({ mutationFn: () => confirmPaymentImport(file!), onSuccess: async (result) => {
    toast({ title: `${result.createdCount} paiement${result.createdCount > 1 ? "s" : ""} importé${result.createdCount > 1 ? "s" : ""}`, description: result.errors.length ? `${result.errors.length} ligne(s) ignorée(s).` : "Toutes les lignes ont été traitées." })
    await queryClient.invalidateQueries({ queryKey: ["finance"] }); setFile(null); setAnalysis(null); setPreview(null)
  }, onError: () => toast({ title: "Import impossible", description: "Le fichier a été revalidé sans pouvoir être importé.", variant: "destructive" }) })

  const methodField = fields.find((field) => field.targetField === "method")
  const distinctMethods = analysis && methodField?.sourceColumnLabel ? analysis.distinctValuesByColumn[methodField.sourceColumnLabel] ?? [] : []
  const ready = fields.every((field) => field.sourceColumnLabel) && Boolean(methodField?.translations.length) && methodField?.translations.every((item) => item.targetValue)

  const updateField = (targetField: PaymentMappingField["targetField"], sourceColumnLabel: string) => setFields((current) => current.map((field) => {
    if (field.targetField !== targetField) return field
    if (targetField !== "method") return { ...field, sourceColumnLabel }
    const sourceValues = analysis?.distinctValuesByColumn[sourceColumnLabel] ?? []
    return {
      ...field,
      sourceColumnLabel,
      translations: sourceValues.map((sourceValue) =>
        field.translations.find((item) => item.sourceValue === sourceValue) ?? { sourceValue, targetValue: "" }
      ),
    }
  }))

  return (
    <section className="space-y-6">

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="bg-[var(--surface-chrome)] px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-1">
            <h2 className="text-lg font-semibold">Import des paiements</h2>
            <p className="text-xs text-muted-foreground">
              Utilisez le fichier de votre caisse. Les correspondances enregistrées
              seront reprises automatiquement au prochain import.
            </p>
          </div>
        </div>
      </div>

      {profileQuery.data ? (
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Profil actif</p>
              <p className="text-sm text-muted-foreground">
                {profileQuery.data.label ?? "Profil paiements"} ·{" "}
                {profileQuery.data.fields.length} champs mappés
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-12"
              onClick={() => setEditingProfile((value) => !value)}
            >
              {editingProfile ? "Fermer" : "Modifier le profil"}
            </Button>
          </div>
          {editingProfile ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.targetField} className="space-y-2">
                    <Label htmlFor={`profile-${field.targetField}`}>
                      {targetLabels[field.targetField]}
                    </Label>
                    <Input
                      id={`profile-${field.targetField}`}
                      value={field.sourceColumnLabel}
                      onChange={(event) =>
                        updateField(field.targetField, event.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Traductions du mode</Label>
                {methodField?.translations.map((translation, index) => (
                  <div
                    key={`${translation.sourceValue}-${index}`}
                    className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <Input
                      aria-label="Valeur source"
                      value={translation.sourceValue}
                      onChange={(event) =>
                        setFields((current) =>
                          current.map((field) =>
                            field.targetField === "method"
                              ? {
                                  ...field,
                                  translations: field.translations.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            sourceValue: event.target.value,
                                          }
                                        : item,
                                  ),
                                }
                              : field,
                          ),
                        )
                      }
                    />
                    <Select
                      value={translation.targetValue}
                      onValueChange={(value) =>
                        setFields((current) =>
                          current.map((field) =>
                            field.targetField === "method"
                              ? {
                                  ...field,
                                  translations: field.translations.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            targetValue: value as PaymentMethod,
                                          }
                                        : item,
                                  ),
                                }
                              : field,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="min-h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(methodLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-12 min-w-12"
                      aria-label="Supprimer la traduction"
                      onClick={() =>
                        setFields((current) =>
                          current.map((field) =>
                            field.targetField === "method"
                              ? {
                                  ...field,
                                  translations: field.translations.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                }
                              : field,
                          ),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="min-h-12"
                  onClick={() =>
                    setFields((current) =>
                      current.map((field) =>
                        field.targetField === "method"
                          ? {
                              ...field,
                              translations: [
                                ...field.translations,
                                { sourceValue: "", targetValue: "cash" },
                              ],
                            }
                          : field,
                      ),
                    )
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une valeur
                </Button>
              </div>
              <Button
                disabled={!ready || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Enregistrer le profil
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-lg border border-dashed p-5">
        <Label
          htmlFor="payment-import-file"
          className="flex cursor-pointer flex-col items-center gap-3 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <Upload className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-medium">
              Choisir le fichier Excel de la caisse
            </span>
            <span className="mt-1 block text-sm font-normal text-muted-foreground">
              Format .xlsx, avec une ligne d’en-têtes
            </span>
          </span>
        </Label>
        <Input
          id="payment-import-file"
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setAnalysis(null);
            setPreview(null);
            if (selected) analyzeMutation.mutate(selected);
          }}
        />
        {file ? (
          <p className="mt-3 text-center text-sm font-medium">
            <FileSpreadsheet className="mr-2 inline h-4 w-4" />
            {file.name}
          </p>
        ) : null}
      </div>
      {analyzeMutation.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyse des colonnes…
        </div>
      ) : null}
      {analysis ? (
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold">Correspondance des colonnes</h3>
            <p className="text-sm text-muted-foreground">
              Les cinq champs sont obligatoires. L’ordre des colonnes n’a aucune
              importance.
            </p>
          </div>
          <ColumnMappingFields
            fields={fields}
            headers={analysis.headers}
            idPrefix="payment-mapping"
            labels={targetLabels}
            onChange={updateField}
          />
          {distinctMethods.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold">
                Traduction des modes de paiement
              </h3>
              {methodField?.translations.map((translation, index) => (
                <div
                  key={translation.sourceValue}
                  className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-2"
                >
                  <p className="font-medium">{translation.sourceValue}</p>
                  <Select
                    value={translation.targetValue}
                    onValueChange={(value) =>
                      setFields((current) =>
                        current.map((field) =>
                          field.targetField === "method"
                            ? {
                                ...field,
                                translations: field.translations.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          targetValue: value as PaymentMethod,
                                        }
                                      : item,
                                ),
                              }
                            : field,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="min-h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(methodLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : null}
          <Button
            className="min-h-12"
            disabled={!ready || previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Enregistrer et générer l’aperçu
          </Button>
        </div>
      ) : null}
      {preview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="border-green-200 bg-green-50 text-green-700"
            >
              {preview.validRows.length} valides
            </Badge>
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-red-700"
            >
              {preview.errors.length} en erreur
            </Badge>
          </div>
          {preview.errors.length > 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="space-y-1">
                  {preview.errors.map((error) => (
                    <li key={`${error.rowNumber}-${error.reason}`}>
                      Ligne {error.rowNumber} : {error.reason}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {preview.validRows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ligne</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.validRows.slice(0, 50).map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>
                        {row.studentName}
                        <span className="block text-xs text-muted-foreground">
                          {row.matricule} · {row.className}
                        </span>
                      </TableCell>
                      <TableCell>{row.paymentDate}</TableCell>
                      <TableCell>{row.reference}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatFcfa(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          <Button
            className="min-h-12"
            disabled={
              preview.validRows.length === 0 || confirmMutation.isPending
            }
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Importer {preview.validRows.length} paiement
            {preview.validRows.length > 1 ? "s" : ""}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
