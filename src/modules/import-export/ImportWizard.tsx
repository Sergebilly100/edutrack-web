import { useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Download,
  GraduationCap,
  type LucideIcon,
  UserSquare,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useConfirmImport, useDryRun } from "@/modules/import/import.hooks"
import { downloadTemplate, type ImportIssue, type ImportMode, type ImportType } from "./import-export.api"
import { DropZone } from "@/shared/components/DropZone"
import { Spinner } from "@/shared/components/Spinner"

type WizardStep = 1 | 2 | 3

type StepStatus = "completed" | "active" | "pending"

type Step = {
  id: number
  label: string
  status: StepStatus
}

type ImportWizardProps = {
  selectedImportType?: ImportType
  onImportTypeChange?: (type: ImportType) => void
}

const touchFeedbackClass = "active:scale-95 transition-transform duration-100"

const tabConfig: Record<ImportType, { label: string; icon: LucideIcon; description: string }> = {
  students: {
    label: "Élèves",
    icon: GraduationCap,
    description: "Importer les élèves avec classe et contacts parent",
  },
  teachers: {
    label: "Professeurs",
    icon: UserSquare,
    description: "Importer les enseignants, matières et type de contrat",
  },
  schedule: {
    label: "Emploi du temps",
    icon: CalendarDays,
    description: "Importer les créneaux, classes, salles et matières",
  },
}

const importTypeValues: ImportType[] = ["students", "teachers", "schedule"]

const isImportType = (value: string): value is ImportType =>
  importTypeValues.includes(value as ImportType)

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
            <p className="break-words font-medium">
              {issue.sheet ? `Feuille ${issue.sheet} · ` : ""}Ligne {issue.row} · {issue.column}
            </p>
            <p className="break-words">{issue.message}</p>
          </div>
        )
      })}
    </div>
  )
}

function ImportStepper({ step }: { step: WizardStep }) {
  const steps: Step[] = [
    {
      id: 1,
      label: "Upload",
      status: step === 1 ? "active" : "completed",
    },
    {
      id: 2,
      label: "Validation",
      status: step === 2 ? "active" : step > 2 ? "completed" : "pending",
    },
    {
      id: 3,
      label: "Confirmation",
      status: step === 3 ? "active" : "pending",
    },
  ]

  return (
    <div className="flex items-center">
      {steps.map((item, index) => (
        <div key={item.id} className="flex min-w-0 flex-1 items-center">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                item.status === "completed" && "bg-primary text-primary-foreground",
                item.status === "active" && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                item.status === "pending" && "bg-muted text-muted-foreground"
              )}
            >
              {item.status === "completed" ? <Check className="h-4 w-4" /> : item.id}
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">{item.label}</p>
          </div>

          {index < steps.length - 1 ? (
            <div
              className={cn(
                "mx-2 h-0.5 flex-1 rounded-full",
                item.status === "completed" ? "bg-primary" : "bg-border"
              )}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

type ImportTypeTabsProps = {
  importType: ImportType
  isDownloadingTemplate: boolean
  isFileLoading: boolean
  onImportTypeChange: (type: ImportType) => void
  onTemplateDownload: (type: ImportType) => Promise<void>
  onFileSelected: (file: File) => void
}

function ImportTypeTabs({
  importType,
  isDownloadingTemplate,
  isFileLoading,
  onImportTypeChange,
  onTemplateDownload,
  onFileSelected,
}: ImportTypeTabsProps) {
  return (
    <Tabs
      value={importType}
      onValueChange={(value) => {
        if (isImportType(value)) {
          onImportTypeChange(value)
        }
      }}
      className="space-y-4"
    >
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3 md:gap-0 md:rounded-lg md:bg-muted md:p-1">
        {importTypeValues.map((type) => {
          const Icon = tabConfig[type].icon

          return (
            <TabsTrigger
              key={type}
              value={type}
              className={cn(
                "min-h-[48px] w-full whitespace-normal px-3 py-3",
                "justify-start text-left md:justify-center",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              )}
            >
              <div className="flex w-full items-start gap-2 md:items-center md:justify-center">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 md:mt-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-tight">{tabConfig[type].label}</p>
                  <p className="text-xs leading-tight data-[state=active]:text-primary-foreground/90">
                    {tabConfig[type].description}
                  </p>
                </div>
              </div>
            </TabsTrigger>
          )
        })}
      </TabsList>

      {importTypeValues.map((type) => (
        <TabsContent key={type} value={type} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              Téléchargez le modèle {tabConfig[type].label.toLowerCase()} conforme au format EduTrack puis importez votre fichier.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[48px]"
              onClick={() => void onTemplateDownload(type)}
              disabled={isDownloadingTemplate}
            >
              {isDownloadingTemplate ? <Spinner size="sm" className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}
              Télécharger le modèle
            </Button>
          </div>

          <DropZone onFileSelected={onFileSelected} isLoading={isFileLoading} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export default function ImportWizard({ selectedImportType, onImportTypeChange }: ImportWizardProps) {
  const { toast } = useToast()

  const [step, setStep] = useState<WizardStep>(1)
  const [importType, setImportType] = useState<ImportType>(selectedImportType ?? "students")
  const [file, setFile] = useState<File | null>(null)

  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
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
  const blockingRowsCount = useMemo(() => new Set(blockingIssues.map((item) => item.row)).size, [blockingIssues])

  const blockingIssuesByRow = useMemo(() => {
    const byRow = new Map<number, ImportIssue[]>()

    for (const issue of blockingIssues) {
      const existing = byRow.get(issue.row) ?? []
      byRow.set(issue.row, [...existing, issue])
    }

    return byRow
  }, [blockingIssues])

  const validationError = dryRunMutation.isError
    ? getRequestErrorMessage(dryRunMutation.error, "Validation impossible. Vérifiez votre fichier puis réessayez.")
    : null

  const importError = confirmMutation.isError
    ? getRequestErrorMessage(confirmMutation.error, "Échec de l'import. Corrigez le fichier puis relancez.")
    : null

  useEffect(() => {
    if (selectedImportType) {
      setImportType(selectedImportType)
    }
  }, [selectedImportType])

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

  const handleImportTypeValueChange = (nextType: ImportType) => {
    setImportType(nextType)
    onImportTypeChange?.(nextType)
    setFile(null)
    setWeekStart("")
    setWeekEnd("")
    setPeriodError(null)
    setConflictAcknowledged(false)
    resetAfterUploadChange()
  }

  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile)
    resetAfterUploadChange()
  }

  const handleTemplateDownload = async (type: ImportType) => {
    try {
      setTemplateError(null)
      setIsDownloadingTemplate(true)
      await downloadTemplate(type)
    } catch (error) {
      const message = getRequestErrorMessage(error, "Impossible de télécharger le modèle Excel.")
      setTemplateError(message)
      toast({
        variant: "destructive",
        title: "Téléchargement impossible",
        description: message,
      })
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const handleGoToValidation = () => {
    if (!file) return
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
        onSuccess: () => setStep(2),
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Validation impossible",
            description: getRequestErrorMessage(error, "Le fichier n'a pas pu être validé."),
          })
        },
      }
    )
  }

  const handleConfirmImport = () => {
    if (!file) return
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
            duration: 3000,
          })
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Import impossible",
            description: getRequestErrorMessage(error, "L'import a échoué."),
          })
        },
      }
    )
  }

  const handleFinish = () => {
    setStep(1)
    setImportType(selectedImportType ?? "students")
    onImportTypeChange?.(selectedImportType ?? "students")
    setFile(null)
    setTemplateError(null)
    setPeriodError(null)
    setImportMode("merge")
    setWeekStart("")
    setWeekEnd("")
    setConflictAcknowledged(false)
    dryRunMutation.reset()
    confirmMutation.reset()
  }

  const getIssuesForPreviewRow = (rowIndex: number) => {
    return blockingIssuesByRow.get(rowIndex + 2) ?? blockingIssuesByRow.get(rowIndex + 1) ?? []
  }

  const totalImported = (confirmReport?.imported ?? 0) + (confirmReport?.updated ?? 0)
  const hasPartialErrors = (confirmReport?.errors.length ?? 0) > 0

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <CardTitle>Assistant d'import Excel</CardTitle>
        <CardDescription>Upload → Validation → Confirmation</CardDescription>
        <ImportStepper step={step} />
      </CardHeader>

      <CardContent className="space-y-6">
        {templateError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Action impossible</AlertTitle>
            <AlertDescription>{templateError}</AlertDescription>
          </Alert>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <ImportTypeTabs
              importType={importType}
              isDownloadingTemplate={isDownloadingTemplate}
              isFileLoading={dryRunMutation.isPending}
              onImportTypeChange={handleImportTypeValueChange}
              onTemplateDownload={handleTemplateDownload}
              onFileSelected={handleFileSelected}
            />

            {(importType === "students" || importType === "teachers") ? (
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-medium">Mode de mise à jour</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={importMode === "merge" ? "default" : "outline"}
                    onClick={() => setImportMode("merge")}
                    className="min-h-[48px]"
                  >
                    Fusion
                  </Button>
                  <Button
                    type="button"
                    variant={importMode === "replace" ? "default" : "outline"}
                    onClick={() => setImportMode("replace")}
                    className="min-h-[48px]"
                  >
                    Remplacement
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {importMode === "merge"
                    ? "Fusion: ajoute et met à jour, sans désactiver les absents du fichier."
                    : "Remplacement: ajoute, met à jour, puis désactive les absents du fichier."}
                </p>
                {importMode === "replace" ? (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Mode sensible: remplacement</AlertTitle>
                    <AlertDescription className="text-sm">
                      Les enregistrements actifs absents du fichier seront désactivés pendant l&apos;import.
                      Vérifiez le fichier, le périmètre et la sauvegarde avant confirmation.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {importType === "schedule" ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Période de validité de l&apos;emploi du temps</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="week-start">Semaine de début (lundi)</Label>
                    <Input
                      id="week-start"
                      type="date"
                      value={weekStart}
                      onChange={(event) => setWeekStart(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="week-end">Semaine de fin (lundi)</Label>
                    <Input
                      id="week-end"
                      type="date"
                      value={weekEnd}
                      onChange={(event) => setWeekEnd(event.target.value)}
                    />
                  </div>
                </div>
                {weekStart && weekEnd ? (
                  <p className="text-xs text-muted-foreground">
                    Cet EDT sera appliqué du {weekStart} au {weekEnd}.
                  </p>
                ) : null}
                {periodError ? (
                  <p className="break-words text-sm text-destructive">{periodError}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleGoToValidation}
                disabled={!file || dryRunMutation.isPending}
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
            {dryRunMutation.isPending ? (
              <div className="flex min-h-[72px] items-center gap-2 rounded-md border p-4 text-sm">
                <Spinner size="sm" />
                <span>Analyse du fichier...</span>
              </div>
            ) : null}

            {validationError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="break-words">{validationError}</AlertDescription>
              </Alert>
            ) : null}

            {dryRunReport && !dryRunMutation.isPending ? (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-md border p-4 text-sm">
                  <p className="font-medium text-green-700">{dryRunReport.valid} lignes valides</p>
                  <p className="font-medium text-destructive">{blockingRowsCount} erreurs</p>
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
                      <AlertTriangle className="h-4 w-4" />
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
                      <Label htmlFor="conflict-ack" className="leading-tight">
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
                    <p className="text-sm font-medium">Aperçu des 5 premières lignes</p>

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
                              <TableHead className="whitespace-nowrap">Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dryRunReport.preview.slice(0, 5).map((row, rowIndex) => {
                              const rowIssues = getIssuesForPreviewRow(rowIndex)
                              const hasRowError = rowIssues.length > 0

                              return (
                                <TableRow key={rowIndex}>
                                  {Object.entries(row).map(([column, value]) => {
                                    const matchingIssue = rowIssues.find(
                                      (issue) =>
                                        issue.column.trim().toLowerCase() === column.trim().toLowerCase()
                                    )

                                    return (
                                      <TableCell
                                        key={`${rowIndex}-${column}`}
                                        className="max-w-[260px] min-w-[140px] align-top"
                                      >
                                        <p className="break-words text-sm">{String(value)}</p>
                                        {matchingIssue ? (
                                          <p className="text-xs text-muted-foreground">{matchingIssue.message}</p>
                                        ) : null}
                                      </TableCell>
                                    )
                                  })}
                                  <TableCell className="align-top">
                                    {hasRowError ? (
                                      <Badge variant="destructive">Erreur</Badge>
                                    ) : (
                                      <Badge
                                        variant="default"
                                        className="bg-green-600 text-white hover:bg-green-600"
                                      >
                                        Valide
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
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
                {confirmMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Import en cours...
                  </>
                ) : (
                  "Importer →"
                )}
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
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="break-words">{importError}</AlertDescription>
              </Alert>
            ) : null}

            {!confirmMutation.isPending && confirmReport ? (
              <>
                {!hasPartialErrors ? (
                  <div className="animate-in fade-in rounded-md border border-green-200 bg-green-50 p-4 text-green-700 duration-300">
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
