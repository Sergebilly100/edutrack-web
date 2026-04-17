import { useMemo, useRef, useState } from "react"
import { isAxiosError } from "axios"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useConfirmImport, useDryRun } from "@/modules/import/import.hooks"
import { downloadTemplate, type ImportIssue, type ImportMode, type ImportType } from "./import-export.api"
import {
  DownloadIcon,
  ScheduleIcon,
  SpreadsheetIcon,
  StudentsIcon,
  TeacherIdentityIcon,
  UploadCloudIcon,
  WarningIcon,
} from "@/shared/components/icons"
import { Spinner } from "@/shared/components"

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const VALID_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const touchFeedbackClass = "active:scale-95 transition-transform duration-100"

type WizardStep = 1 | 2 | 3

type ImportTypeOption = {
  type: ImportType
  label: string
  description: string
  icon: typeof StudentsIcon
}

const importTypeOptions: ImportTypeOption[] = [
  {
    type: "students",
    label: "Élèves",
    description: "Importer les élèves avec classe et contact parent.",
    icon: StudentsIcon
  },
  {
    type: "teachers",
    label: "Professeurs",
    description: "Importer les enseignants, matières et type de contrat.",
    icon: TeacherIdentityIcon
  },
  {
    type: "schedule",
    label: "Emploi du temps",
    description: "Importer les créneaux, classes, salles et matières.",
    icon: ScheduleIcon
  }
]

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message =
      (error.response?.data as { error?: string } | undefined)?.error ?? error.message

    return message || fallback
  }

  return error instanceof Error ? error.message : fallback
}

function ErrorList({ issues }: { issues: ImportIssue[] }) {
  if (!issues.length) {
    return null
  }

  return (
    <div className="space-y-2">
      {issues.map((issue, index) => {
        const isWarning = issue.severity === "warning"

        return (
          <div
            key={`${issue.row}-${issue.column}-${issue.message}-${index}`}
            className={cn(
              "overflow-hidden rounded-md border p-3 text-sm",
              isWarning
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            <p className="font-medium break-words">
              {issue.sheet ? `Feuille ${issue.sheet} · ` : ""}Ligne {issue.row} · {issue.column}
            </p>
            <p className="break-words">{issue.message}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function ImportWizard() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [step, setStep] = useState<WizardStep>(1)
  const [importType, setImportType] = useState<ImportType | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>("merge")
  const [weekStart, setWeekStart] = useState("")
  const [weekEnd, setWeekEnd] = useState("")
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false)

  const dryRunMutation = useDryRun()
  const confirmMutation = useConfirmImport()

  const dryRunReport = dryRunMutation.data
  const confirmReport = confirmMutation.data
  const hasConflicts = (dryRunReport?.conflicts?.length ?? 0) > 0

  const issues = dryRunReport?.errors ?? []
  const blockingIssues = useMemo(() => issues.filter((item) => item.severity === "error"), [issues])
  const warningIssues = useMemo(() => issues.filter((item) => item.severity === "warning"), [issues])

  const validationError = dryRunMutation.isError
    ? getRequestErrorMessage(dryRunMutation.error, "Validation impossible. Vérifiez votre fichier puis réessayez.")
    : null

  const importError = confirmMutation.isError
    ? getRequestErrorMessage(confirmMutation.error, "Échec de l'import. Corrigez le fichier puis relancez.")
    : null

  const resetAfterUploadChange = () => {
    setTemplateError(null)
    setPeriodError(null)
    setConflictAcknowledged(false)
    dryRunMutation.reset()
    confirmMutation.reset()
  }

  const isMonday = (value: string) => {
    if (!value) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1
  }

  const validateSchedulePeriod = () => {
    if (importType !== "schedule") {
      return true
    }

    if (!weekStart || !weekEnd) {
      setPeriodError("Sélectionnez la période de validité de l'EDT.")
      return false
    }

    if (!isMonday(weekStart) || !isMonday(weekEnd) || weekStart > weekEnd) {
      setPeriodError(`Impossible de laisser une semaine sans EDT entre ${weekStart} et ${weekEnd}`)
      return false
    }

    const start = new Date(`${weekStart}T00:00:00.000Z`)
    const end = new Date(`${weekEnd}T00:00:00.000Z`)
    const diffMs = end.getTime() - start.getTime()
    if (diffMs % (7 * 24 * 60 * 60 * 1000) !== 0) {
      setPeriodError(`Impossible de laisser une semaine sans EDT entre ${weekStart} et ${weekEnd}`)
      return false
    }

    setPeriodError(null)
    return true
  }

  const validateFile = (candidate: File): string | null => {
    if (candidate.type && candidate.type !== VALID_MIME) {
      return "Format invalide: seuls les fichiers .xlsx sont acceptés."
    }

    if (!candidate.name.toLowerCase().endsWith(".xlsx")) {
      return "Format invalide: seuls les fichiers .xlsx sont acceptés."
    }

    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      return "Fichier trop volumineux: taille maximale autorisée 5Mo."
    }

    return null
  }

  const applySelectedFile = (candidate: File | null) => {
    if (!candidate) {
      setFile(null)
      setFileError(null)
      resetAfterUploadChange()
      return
    }

    const error = validateFile(candidate)
    if (error) {
      setFile(null)
      setFileError(error)
      resetAfterUploadChange()
      return
    }

    setFile(candidate)
    setFileError(null)
    resetAfterUploadChange()
  }

  const handleTemplateDownload = async () => {
    if (!importType) {
      setTemplateError("Choisissez d'abord un type d'import avant de télécharger le modèle.")
      return
    }

    try {
      setTemplateError(null)
      setIsDownloadingTemplate(true)
      await downloadTemplate(importType)
    } catch (error) {
      setTemplateError(getRequestErrorMessage(error, "Impossible de télécharger le modèle Excel."))
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const handleGoToValidation = () => {
    if (!file || !importType) return
    if (!validateSchedulePeriod()) return

    setStep(2)
    dryRunMutation.mutate(
      {
        type: importType,
        file,
        importMode,
        schedulePeriod:
          importType === "schedule" && weekStart && weekEnd
            ? { weekStart, weekEnd }
            : undefined,
      },
      {
        onSuccess: () => setStep(2)
      }
    )
  }

  const handleConfirmImport = () => {
    if (!file || !importType) return
    if (importType === "schedule" && hasConflicts && !conflictAcknowledged) return

    setStep(3)
    confirmMutation.mutate(
      {
        type: importType,
        file,
        importMode,
        schedulePeriod:
          importType === "schedule" && weekStart && weekEnd
            ? { weekStart, weekEnd }
            : undefined,
        conflictAcknowledged,
      },
      {
        onSuccess: (data) => {
          toast({
            title: data.errors.length
              ? `Import partiel : ${data.imported + data.updated} importés`
              : `✓ ${data.imported + data.updated} enregistrements importés`,
            duration: 3000
          })
        }
      }
    )
  }

  const handleFinish = () => {
    setStep(1)
    setImportType(null)
    setFile(null)
    setFileError(null)
    setTemplateError(null)
    setPeriodError(null)
    setImportMode("merge")
    setWeekStart("")
    setWeekEnd("")
    setConflictAcknowledged(false)
    dryRunMutation.reset()
    confirmMutation.reset()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const totalImported = (confirmReport?.imported ?? 0) + (confirmReport?.updated ?? 0)
  const hasPartialErrors = (confirmReport?.errors.length ?? 0) > 0

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Assistant d'import Excel</CardTitle>
        <CardDescription>Upload → Validation → Confirmation</CardDescription>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge
            variant={step === 1 ? "default" : "outline"}
            aria-current={step === 1 ? "step" : undefined}
          >
            1. Upload
          </Badge>
          <Badge
            variant={step === 2 ? "default" : "outline"}
            aria-current={step === 2 ? "step" : undefined}
          >
            2. Validation
          </Badge>
          <Badge
            variant={step === 3 ? "default" : "outline"}
            aria-current={step === 3 ? "step" : undefined}
          >
            3. Confirmation
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {templateError ? (
          <Alert variant="destructive">
            <WarningIcon className="h-4 w-4" />
            <AlertTitle>Action impossible</AlertTitle>
            <AlertDescription>{templateError}</AlertDescription>
          </Alert>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {importTypeOptions.map((option) => {
                const Icon = option.icon
                const selected = importType === option.type

                return (
                  <Button
                    key={option.type}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setImportType(option.type)
                      setTemplateError(null)
                    }}
                    className={cn(
                      "h-auto rounded-lg border p-4 text-left transition-colors",
                      "hover:border-primary/60",
                      selected ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <p className="font-medium">{option.label}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </Button>
                )
              })}
            </div>

            {(importType === "students" || importType === "teachers") ? (
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-medium">Mode de mise à jour</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={importMode === "merge" ? "default" : "outline"}
                    onClick={() => setImportMode("merge")}
                  >
                    Fusion
                  </Button>
                  <Button
                    type="button"
                    variant={importMode === "replace" ? "default" : "outline"}
                    onClick={() => setImportMode("replace")}
                  >
                    Remplacement
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {importMode === "merge"
                    ? "Fusion: ajoute et met à jour, sans désactiver les absents du fichier."
                    : "Remplacement: ajoute, met à jour, puis désactive les absents du fichier."}
                </p>
              </div>
            ) : null}

            {importType === "schedule" ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Période de validité de l&apos;emploi du temps</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="week-start">Semaine de début (lundi)</Label>
                    <Input id="week-start" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="week-end">Semaine de fin (lundi)</Label>
                    <Input id="week-end" type="date" value={weekEnd} onChange={(event) => setWeekEnd(event.target.value)} />
                  </div>
                </div>
                {weekStart && weekEnd ? (
                  <p className="text-xs text-muted-foreground">Cet EDT sera appliqué du {weekStart} au {weekEnd}.</p>
                ) : null}
                {periodError ? (
                  <p className="text-sm text-destructive break-words overflow-hidden">{periodError}</p>
                ) : null}
              </div>
            ) : null}

            <Button
              type="button"
              variant="link"
              onClick={() => void handleTemplateDownload()}
              disabled={isDownloadingTemplate}
              className={cn("px-0", touchFeedbackClass)}
            >
              {isDownloadingTemplate ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              📥 Télécharger le modèle Excel
            </Button>

            <div
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                const droppedFile = event.dataTransfer.files?.[0] ?? null
                applySelectedFile(droppedFile)
              }}
              className={cn(
                "flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <UploadCloudIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Glissez-déposez votre fichier .xlsx ici</p>
              <p className="mb-4 text-xs text-muted-foreground">Taille maximale: 5Mo</p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) => applySelectedFile(event.target.files?.[0] ?? null)}
              />

              <Button
                type="button"
                variant="outline"
                className={cn(touchFeedbackClass, "min-h-[48px]")}
                onClick={() => fileInputRef.current?.click()}
              >
                Parcourir
              </Button>

              {file ? (
                <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  <p className="font-medium">Fichier sélectionné</p>
                  <p className="break-all">{file.name}</p>
                </div>
              ) : null}

              {fileError ? <p className="mt-3 overflow-hidden break-words text-sm font-medium text-red-600">{fileError}</p> : null}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleGoToValidation}
                disabled={!file || !importType || dryRunMutation.isPending}
                className={cn(touchFeedbackClass, "min-h-[48px]")}
              >
                {dryRunMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Analyse du fichier...
                  </>
                ) : (
                  "Suivant →"
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            {step === 2 && dryRunMutation.isPending ? (
              <div className="flex items-center gap-2 rounded-md border p-4 text-sm">
                <Spinner size="sm" />
                <span>Analyse du fichier...</span>
              </div>
            ) : null}

            {validationError ? (
              <Alert variant="destructive">
                <WarningIcon className="h-4 w-4" />
                <AlertDescription className="break-words overflow-hidden">{validationError}</AlertDescription>
              </Alert>
            ) : null}

            {dryRunReport && !dryRunMutation.isPending ? (
              <>
                <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">
                  <p className="font-medium">✓ {dryRunReport.valid} lignes valides</p>
                </div>

                {(importType === "students" || importType === "teachers") ? (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-md border border-green-200 bg-green-50 p-3">
                      <p className="text-xs text-green-700">Nouveaux</p>
                      <p className="text-lg font-semibold text-green-800">+{dryRunReport.toAdd.length}</p>
                    </div>
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs text-blue-700">Mis à jour</p>
                      <p className="text-lg font-semibold text-blue-800">~{dryRunReport.toUpdate.length}</p>
                    </div>
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700">À désactiver</p>
                      <p className="text-lg font-semibold text-red-800">
                        {importMode === "replace" ? `-${dryRunReport.toDelete.length}` : "0"}
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Inchangés</p>
                      <p className="text-lg font-semibold">{dryRunReport.unchanged}</p>
                    </div>
                  </div>
                ) : null}

                {hasConflicts ? (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <Alert>
                      <WarningIcon className="h-4 w-4" />
                      <AlertTitle>Modification d&apos;un EDT existant</AlertTitle>
                      <AlertDescription>
                        Les semaines suivantes ont déjà un emploi du temps défini :
                      </AlertDescription>
                    </Alert>
                    <ul className="list-disc pl-6 text-sm text-amber-900">
                      {dryRunReport.conflicts.map((conflict) => (
                        <li key={`${conflict.periodName}-${conflict.weekStart}`}>{conflict.message}</li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="conflict-ack"
                        checked={conflictAcknowledged}
                        onCheckedChange={(checked) => setConflictAcknowledged(Boolean(checked))}
                      />
                      <Label htmlFor="conflict-ack">
                        Je confirme vouloir remplacer l&apos;EDT existant pour ces semaines
                      </Label>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    {blockingIssues.length ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-700">Erreurs bloquantes</p>
                        <ErrorList issues={blockingIssues} />
                      </div>
                    ) : null}

                    {warningIssues.length ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-amber-700">Avertissements</p>
                        <ErrorList issues={warningIssues} />
                      </div>
                    ) : null}

                    {!blockingIssues.length && !warningIssues.length ? (
                      <p className="text-sm text-muted-foreground">Aucune erreur détectée sur ce dry-run.</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <SpreadsheetIcon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Aperçu des 5 premières lignes</p>
                    </div>

                    {dryRunReport.preview.length ? (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(dryRunReport.preview[0]).map((column) => (
                                <TableHead key={column} className="whitespace-nowrap">
                                  {column}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dryRunReport.preview.slice(0, 5).map((row, rowIndex) => (
                              <TableRow key={rowIndex}>
                                {Object.entries(row).map(([column, value]) => (
                                  <TableCell key={`${rowIndex}-${column}`} className="max-w-[280px] min-w-0 break-words align-top">
                                    {String(value)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucune donnée à afficher.</p>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className={cn(touchFeedbackClass, "min-h-[48px]")}
              >
                ← Corriger le fichier
              </Button>

              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={
                  confirmMutation.isPending ||
                  !dryRunReport ||
                  blockingIssues.length > 0 ||
                  (importType === "schedule" && hasConflicts && !conflictAcknowledged)
                }
                className={cn(touchFeedbackClass, "min-h-[48px]")}
              >
                Importer →
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            {confirmMutation.isPending ? (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">Import en cours...</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
                </div>
              </div>
            ) : null}

            {importError ? (
              <Alert variant="destructive">
                <WarningIcon className="h-4 w-4" />
                <AlertDescription className="break-words overflow-hidden">{importError}</AlertDescription>
              </Alert>
            ) : null}

            {!confirmMutation.isPending && confirmReport ? (
              <>
                {!hasPartialErrors ? (
                  <div className="animate-in fade-in duration-300 rounded-md border border-green-200 bg-green-50 p-4 text-green-700">
                    <p className="font-medium">✓ {totalImported} enregistrements importés avec succès</p>
                    {confirmReport.updated > 0 ? (
                      <p className="text-sm">
                        {confirmReport.updated} enregistrements existants ont été mis à jour.
                      </p>
                    ) : null}
                    {confirmReport.deactivated > 0 ? (
                      <p className="text-sm">
                        {confirmReport.deactivated} enregistrements absents du fichier ont été désactivés.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    <p className="font-medium">
                      {totalImported} importés, {confirmReport.errors.length} en erreur
                    </p>
                    <p className="text-sm">Consultez le détail ci-dessous pour corriger les lignes invalides.</p>
                  </div>
                )}

                {confirmReport.errors.length ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Détail des erreurs</p>
                    <ErrorList issues={confirmReport.errors} />
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleFinish}
                disabled={confirmMutation.isPending}
                className={cn(touchFeedbackClass, "min-h-[48px]")}
              >
                Terminer
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
