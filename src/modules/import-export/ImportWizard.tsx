import { useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Download,
  GraduationCap,
  Send,
  type LucideIcon,
  UserSquare,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useConfirmImport, useDryRun } from "@/modules/import/import.hooks"
import { downloadTemplate, type DryRunResponse, type ImportIssue, type ImportMode, type ImportType } from "./import-export.api"
import { sendPendingParentAccess } from "@/modules/subscriptions/subscriptions.api"
import { DateInput } from "@/shared/components/DateInput"
import { DropZone } from "@/shared/components/DropZone"
import { Spinner } from "@/shared/components/Spinner"
import { useStudentLabels, type StudentLabels } from "@/shared/hooks/useStudentLabel"
import { ImportLoadingOverlay } from "./ImportLoadingOverlay"
import { useImportDraft } from "./hooks/useImportDraft"

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
  allowedImportTypes?: ImportType[]
}

const touchFeedbackClass = "active:scale-95 transition-transform duration-100"

const buildTabConfig = (
  labels: StudentLabels,
): Record<ImportType, { label: string; icon: LucideIcon; description: string }> => ({
  students: {
    label: labels.plural,
    icon: GraduationCap,
    description: `Importer les ${labels.pluralLower} avec classe et contacts parent`,
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
})

const importTypeValues: ImportType[] = ["students", "teachers", "schedule"]

const isImportType = (value: string): value is ImportType =>
  importTypeValues.includes(value as ImportType)

const isPastScheduleWarning = (issue: ImportIssue) =>
  issue.severity === "warning" && issue.message.toLowerCase().includes("date/heure passée")

const toStringRecord = (row: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")]))

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
  availableTypes: ImportType[]
  isDownloadingTemplate: boolean
  isFileLoading: boolean
  dropZoneResetKey: number
  onImportTypeChange: (type: ImportType) => void
  onTemplateDownload: (type: ImportType) => Promise<void>
  onFileSelected: (file: File) => void
}

function ImportTypeTabs({
  importType,
  availableTypes,
  isDownloadingTemplate,
  isFileLoading,
  dropZoneResetKey,
  onImportTypeChange,
  onTemplateDownload,
  onFileSelected,
}: ImportTypeTabsProps) {
  const studentLabels = useStudentLabels()
  const tabConfig = useMemo(() => buildTabConfig(studentLabels), [studentLabels])
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
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3 md:gap-0 md:rounded-lg md:bg-muted md:p-1" data-tour="import-wizard-tab">
        {availableTypes.map((type) => {
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

      {availableTypes.map((type) => (
        <TabsContent key={type} value={type} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              Téléchargez le modèle {tabConfig[type].label.toLowerCase()} conforme au format IvoirEdu puis importez votre fichier. <br /> 
              {type === "schedule" ? <span className="text-xs font-bold">NB : Les professeurs et les classes de votre fichier doivent être ajoutés au préalable dans le système</span> : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[48px]"
              onClick={() => void onTemplateDownload(type)}
              disabled={isDownloadingTemplate}
               data-tour="import-wizard-file"
            >
              {isDownloadingTemplate ? <Spinner size="sm" className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}
              Télécharger le modèle
            </Button>
          </div>

          <DropZone key={`${type}-${dropZoneResetKey}`} onFileSelected={onFileSelected} isLoading={isFileLoading} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export default function ImportWizard({
  selectedImportType,
  onImportTypeChange,
  allowedImportTypes,
}: ImportWizardProps) {
  const { toast } = useToast()
  const studentLabels = useStudentLabels()
  const tabConfig = useMemo(() => buildTabConfig(studentLabels), [studentLabels])
  const availableTypes = useMemo<ImportType[]>(
    () =>
      (allowedImportTypes?.length ? allowedImportTypes : importTypeValues).filter((type, index, array) => {
        return array.indexOf(type) === index
      }),
    [allowedImportTypes]
  )

  const [step, setStep] = useState<WizardStep>(1)
  const [importType, setImportType] = useState<ImportType>(
    selectedImportType && availableTypes.includes(selectedImportType)
      ? selectedImportType
      : (availableTypes[0] ?? "students")
  )
  const [file, setFile] = useState<File | null>(null)

  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>("merge")
  const [weekStart, setWeekStart] = useState("")
  const [weekEnd, setWeekEnd] = useState("")
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false)
  const [pastScheduleAcknowledged, setPastScheduleAcknowledged] = useState(false)
  const [restoredDryRunReport, setRestoredDryRunReport] = useState<DryRunResponse | null>(null)
  const [dropZoneResetKey, setDropZoneResetKey] = useState(0)
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([])
  const [parentAccessStatuses, setParentAccessStatuses] = useState<Record<string, "queued" | "failed">>({})
  const [isSendingParentAccess, setIsSendingParentAccess] = useState(false)
  const [parentAccessError, setParentAccessError] = useState<string | null>(null)

  const dryRunMutation = useDryRun()
  const confirmMutation = useConfirmImport()

  // Draft recovery
  const {
    draft,
    isLoading: isDraftLoading,
    hasDraft,
    saveDraft,
    deleteDraft,
  } = useImportDraft(importType)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showPastScheduleModal, setShowPastScheduleModal] = useState(false)

  const dryRunReport = dryRunMutation.data ?? restoredDryRunReport
  const confirmReport = confirmMutation.data
  const hasConflicts = (dryRunReport?.conflicts?.length ?? 0) > 0

  useEffect(() => {
    const parentIds = confirmReport?.pendingParentAccess.map((parent) => parent.parentId) ?? []
    setSelectedParentIds(parentIds)
    setParentAccessStatuses({})
    setParentAccessError(null)
  }, [confirmReport])

  const issues = dryRunReport?.errors ?? []
  const blockingIssues = useMemo(() => issues.filter((item) => item.severity === "error"), [issues])
  const warningIssues = useMemo(() => issues.filter((item) => item.severity === "warning"), [issues])
  const pastScheduleWarnings = useMemo(
    () => (importType === "schedule" ? warningIssues.filter(isPastScheduleWarning) : []),
    [importType, warningIssues]
  )
  const blockingRowsCount = useMemo(() => new Set(blockingIssues.map((item) => item.row)).size, [blockingIssues])
  const warningRowsCount = useMemo(() => new Set(warningIssues.map((item) => item.row)).size, [warningIssues])

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
    if (selectedImportType && availableTypes.includes(selectedImportType)) {
      setImportType(selectedImportType)
    }
  }, [availableTypes, selectedImportType])

  useEffect(() => {
    if (!availableTypes.length) {
      return
    }

    if (!availableTypes.includes(importType)) {
      const fallbackType = availableTypes[0]
      setImportType(fallbackType)
      onImportTypeChange?.(fallbackType)
    }
  }, [availableTypes, importType, onImportTypeChange])

  // Afficher modal de reprise si un draft existe
  useEffect(() => {
    if (hasDraft && !isDraftLoading && !file) {
      setShowRestoreModal(true)
    }
  }, [hasDraft, isDraftLoading, file])

  const resetAfterUploadChange = () => {
    setTemplateError(null)
    setPeriodError(null)
    setConflictAcknowledged(false)
    setPastScheduleAcknowledged(false)
    setRestoredDryRunReport(null)
    dryRunMutation.reset()
    confirmMutation.reset()
    setSelectedParentIds([])
    setParentAccessStatuses({})
    setParentAccessError(null)
  }

  const getRestorableDryRunReport = (): DryRunResponse | null => {
    if (!draft) return null
    if (draft.dryRunResponse) {
      return draft.dryRunResponse
    }
    if (!draft.dryRunReport) {
      return null
    }

    return {
      valid: draft.dryRunReport.summary.validRows,
      errors: draft.dryRunReport.issues,
      preview: draft.dryRunReport.previewData.map(toStringRecord),
      toAdd: [],
      toUpdate: [],
      toDelete: [],
      unchanged: Math.max(0, draft.dryRunReport.summary.validRows),
      importMode: draft.mode ?? "merge",
      conflicts: [],
    }
  }

  const resetWizardToStart = async () => {
    await deleteDraft()
    setStep(1)
    setFile(null)
    setTemplateError(null)
    setPeriodError(null)
    setImportMode("merge")
    setWeekStart("")
    setWeekEnd("")
    setConflictAcknowledged(false)
    setPastScheduleAcknowledged(false)
    setRestoredDryRunReport(null)
    dryRunMutation.reset()
    confirmMutation.reset()
    setDropZoneResetKey((value) => value + 1)
  }

  const restoreDraftState = async () => {
    if (!draft) return

    try {
      // Restaurer fichier
      const restoredFile = new File([draft.fileData], draft.fileName, {
        type: draft.fileMime,
      })
      setFile(restoredFile)

      // Restaurer step
      const restoredReport = getRestorableDryRunReport()
      setRestoredDryRunReport(restoredReport)
      setStep(draft.step >= 2 && !restoredReport ? 1 : draft.step)

      dryRunMutation.reset()
      confirmMutation.reset()

      // Restaurer mode si défini
      if (draft.mode) {
        setImportMode(draft.mode)
      }
      if (draft.schedulePeriod) {
        setWeekStart(draft.schedulePeriod.weekStart)
        setWeekEnd(draft.schedulePeriod.weekEnd)
      }

      toast({
        title: "Import repris",
        description:
          draft.step >= 2 && !restoredReport
            ? `Fichier restauré : ${draft.fileName}. Relancez la validation.`
            : `Vous êtes à l'étape ${draft.step}/3. Fichier : ${draft.fileName}`,
      })
    } catch (error) {
      console.error("Failed to restore draft:", error)
      toast({
        title: "Erreur",
        description: "Impossible de restaurer le brouillon. Recommencez l'import.",
        variant: "destructive",
      })
      await deleteDraft()
    }
  }

  const isMonday = (value: string) => {
    if (!value) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1
  }

  const isSunday = (value: string) => {
    if (!value) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.getUTCDay() === 0
  }

  const validateSchedulePeriod = () => {
    if (importType !== "schedule") {
      return true
    }

    if (!weekStart || !weekEnd) {
      setPeriodError("Sélectionnez la période de validité de l'EDT.")
      return false
    }

    if (!isMonday(weekStart) || !isSunday(weekEnd) || weekStart > weekEnd) {
      setPeriodError(`Impossible ! Les emplois du temps doivent couvrir des semaines complètes du lundi au dimanche entre ${weekStart} et ${weekEnd}`)
      return false
    }

    const start = new Date(`${weekStart}T00:00:00.000Z`)
    const end = new Date(`${weekEnd}T00:00:00.000Z`)
    const diffMs = end.getTime() - start.getTime()
    // La période couvre des semaines du lundi au dimanche inclus :
    // on ajoute 1 jour (inclusif sur weekEnd) avant de vérifier le multiple de 7 jours
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const MS_PER_WEEK = 7 * MS_PER_DAY;
    const inclusiveMs = diffMs + MS_PER_DAY;
    if (inclusiveMs % MS_PER_WEEK !== 0) {
      setPeriodError(`Impossible ! Les emplois du temps doivent couvrir des semaines complètes du lundi au dimanche entre ${weekStart} et ${weekEnd}`)
      return false
    }

    setPeriodError(null)
    return true
  }

  const getCurrentSchedulePeriod = () =>
    importType === "schedule" && weekStart && weekEnd ? { weekStart, weekEnd } : null

  const persistDraftOptions = async (options?: { mode?: ImportMode; schedulePeriod?: { weekStart: string; weekEnd: string } | null }) => {
    if (!file || !draft) return
    try {
      await saveDraft({
        mode: options?.mode ?? importMode,
        schedulePeriod: options?.schedulePeriod ?? getCurrentSchedulePeriod(),
      })
    } catch (error) {
      console.error("Failed to save draft options:", error)
    }
  }

  const handleImportTypeValueChange = (nextType: ImportType) => {
    setImportType(nextType)
    onImportTypeChange?.(nextType)
    setFile(null)
    setWeekStart("")
    setWeekEnd("")
    setPeriodError(null)
    setConflictAcknowledged(false)
    setPastScheduleAcknowledged(false)
    resetAfterUploadChange()
    setDropZoneResetKey((value) => value + 1)
  }

  const handleImportModeChange = (nextMode: ImportMode) => {
    setImportMode(nextMode)
    void persistDraftOptions({ mode: nextMode })
  }

  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile)
    resetAfterUploadChange()

    // Sauvegarder draft
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      await saveDraft({
        step: 1,
        fileName: selectedFile.name,
        fileData: arrayBuffer,
        fileSize: selectedFile.size,
        fileMime: selectedFile.type,
        mode: importMode,
        schedulePeriod: getCurrentSchedulePeriod(),
      })
    } catch (error) {
      console.error("Failed to save draft:", error)
      // Non-bloquant, continuer l'import
    }
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

    const schedulePeriod = getCurrentSchedulePeriod() ?? undefined
    setRestoredDryRunReport(null)
    setStep(2)
    dryRunMutation.mutate(
      {
        type: importType,
        file,
        importMode,
        schedulePeriod,
      },
      {
        onSuccess: async (data) => {
          setStep(2)
          setRestoredDryRunReport(data)

          // Sauvegarder draft avec rapport dry-run
          try {
            await saveDraft({
              step: 2,
              mode: importMode,
              schedulePeriod: schedulePeriod ?? null,
              dryRunResponse: data,
              dryRunReport: {
                previewData: data.preview ?? [],
                issues: data.errors ?? [],
                summary: {
                  totalRows: data.preview?.length ?? 0,
                  validRows: (data.preview?.length ?? 0) - (data.errors?.filter((e) => e.severity === "error").length ?? 0),
                  errorRows: data.errors?.filter((e) => e.severity === "error").length ?? 0,
                  warningRows: data.errors?.filter((e) => e.severity === "warning").length ?? 0,
                },
              },
            })
          } catch (error) {
            console.error("Failed to save draft after dry-run:", error)
          }
        },
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

  const runConfirmImport = () => {
    if (!file) return

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
        onSuccess: async (data) => {
          toast({
            title: data.errors.length
              ? `Import partiel : ${data.imported + data.updated} importés`
              : `✓ ${data.imported + data.updated} enregistrements importés`,
            duration: 3000,
          })

          // Supprimer draft après import réussi
          try {
            await deleteDraft()
          } catch (error) {
            console.error("Failed to delete draft after import:", error)
          }
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

  const handleConfirmImport = () => {
    if (!file) return
    if (importType === "schedule" && hasConflicts && !conflictAcknowledged) return
    if (importType === "schedule" && pastScheduleWarnings.length > 0 && !pastScheduleAcknowledged) {
      setShowPastScheduleModal(true)
      return
    }

    runConfirmImport()
  }

  const handleSendParentAccess = async (parentIds: string[]) => {
    if (parentIds.length === 0) return

    setIsSendingParentAccess(true)
    setParentAccessError(null)
    try {
      const result = await sendPendingParentAccess(parentIds)
      const nextStatuses = result.items.reduce<Record<string, "queued" | "failed">>((acc, item) => {
        if (item.status === "queued" || item.status === "already_sent") {
          acc[item.parentId] = "queued"
        } else {
          acc[item.parentId] = "failed"
        }
        return acc
      }, {})
      setParentAccessStatuses((current) => ({ ...current, ...nextStatuses }))
      setSelectedParentIds((current) => current.filter((id) => nextStatuses[id] !== "queued"))
      const failedCount = result.items.filter((item) => item.status === "failed" || item.status === "not_found").length
      toast({
        title: result.queued > 0 ? `${result.queued} envoi(s) programmé(s)` : "Aucun nouvel envoi programmé",
        description: failedCount > 0 ? `${failedCount} accès n'ont pas pu être programmés.` : undefined,
        variant: failedCount > 0 ? "destructive" : "default",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'envoyer les accès parents."
      setParentAccessError(message)
      toast({ title: "Envoi impossible", description: message, variant: "destructive" })
    } finally {
      setIsSendingParentAccess(false)
    }
  }

  const handleFinish = () => {
    setStep(1)
    const fallbackType =
      selectedImportType && availableTypes.includes(selectedImportType)
        ? selectedImportType
        : (availableTypes[0] ?? "students")
    setImportType(fallbackType)
    onImportTypeChange?.(fallbackType)
    setFile(null)
    setTemplateError(null)
    setPeriodError(null)
    setImportMode("merge")
    setWeekStart("")
    setWeekEnd("")
    setConflictAcknowledged(false)
    setPastScheduleAcknowledged(false)
    dryRunMutation.reset()
    confirmMutation.reset()
    setSelectedParentIds([])
    setParentAccessStatuses({})
    setParentAccessError(null)
  }

  const getIssuesForPreviewRow = (rowIndex: number) => {
    return blockingIssuesByRow.get(rowIndex + 2) ?? blockingIssuesByRow.get(rowIndex + 1) ?? []
  }

  const totalImported = (confirmReport?.imported ?? 0) + (confirmReport?.updated ?? 0)
  const hasPartialErrors = (confirmReport?.errors.length ?? 0) > 0

  return (
    <>
      {/* Modal reprendre import */}
      <AlertDialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import en cours trouvé</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez un import de <strong>{tabConfig[importType].label}</strong> commencé le{" "}
              <strong>{new Date(draft?.createdAt ?? 0).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong>{" "}
              (étape {draft?.step}/3).
              <br />
              <br />
              Voulez-vous le reprendre ou recommencer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={async () => {
                await deleteDraft()
                setShowRestoreModal(false)
                toast({
                  title: "Brouillon supprimé",
                  description: "Vous pouvez commencer un nouvel import.",
                })
              }}
            >
              Recommencer
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await restoreDraftState()
                setShowRestoreModal(false)
              }}
            >
              Reprendre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal d'annulation d'import (remplace confirm()) */}
      <AlertDialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler l'import ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le brouillon sera supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await resetWizardToStart()
                setShowCancelModal(false)
                toast({
                  title: "Import annulé",
                  description: "Vous pouvez recommencer.",
                })
              }}
              disabled={dryRunMutation.isPending || confirmMutation.isPending}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPastScheduleModal} onOpenChange={setShowPastScheduleModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continuer sans les créneaux passés ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le fichier contient {pastScheduleWarnings.length} ligne(s) avec des dates ou heures passées.
              Ces occurrences ne seront pas prises en compte lors de l&apos;import. Les créneaux concernés seront appliqués uniquement à partir de leur prochaine occurrence future.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPastScheduleAcknowledged(true)
                setShowPastScheduleModal(false)
                runConfirmImport()
              }}
            >
              Continuer l&apos;import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              availableTypes={availableTypes}
              isDownloadingTemplate={isDownloadingTemplate}
              isFileLoading={dryRunMutation.isPending}
              dropZoneResetKey={dropZoneResetKey}
              onImportTypeChange={handleImportTypeValueChange}
              onTemplateDownload={handleTemplateDownload}
              onFileSelected={handleFileSelected}
            />

            {(importType === "students" || importType === "teachers") ? (
              <div className="space-y-2 rounded-lg border p-4" data-tour="import-mode">
                <p className="text-sm font-medium">Mode de mise à jour</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={importMode === "merge" ? "default" : "outline"}
                    onClick={() => handleImportModeChange("merge")}
                    className="min-h-[48px]"
                  >
                    Fusion
                  </Button>
                  <Button
                    type="button"
                    variant={importMode === "replace" ? "default" : "outline"}
                    onClick={() => handleImportModeChange("replace")}
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
              <div className="space-y-3 rounded-lg border p-4" data-tour="import-periode-edt">
                <p className="text-sm font-medium">Période de validité de l&apos;emploi du temps</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="week-start">Semaine (début - lundi)</Label>
                    <DateInput
                      aria-label="Semaine (début - lundi)"
                      value={weekStart}
                      onChange={(newStart) => {
                        setWeekStart(newStart)
                        const nextPeriod =
                          newStart && weekEnd && weekEnd > newStart
                            ? { weekStart: newStart, weekEnd }
                            : null
                        if (weekEnd && weekEnd <= newStart) {
                          setWeekEnd("")
                        }
                        setPeriodError(null)
                        void persistDraftOptions({ schedulePeriod: nextPeriod })
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="week-end" className={!weekStart ? "text-muted-foreground" : undefined}>
                      Semaine (fin - Dimanche)
                    </Label>
                    <DateInput
                      aria-label="Semaine (fin - Dimanche)"
                      value={weekEnd}
                      min={weekStart || undefined}
                      disabled={!weekStart}
                      onChange={(value) => {
                        setWeekEnd(value)
                        setPeriodError(null)
                        void persistDraftOptions({
                          schedulePeriod: weekStart && value ? { weekStart, weekEnd: value } : null,
                        })
                      }}
                    />
                    {!weekStart ? (
                      <p className="text-xs text-muted-foreground">Sélectionnez d&apos;abord la semaine de début.</p>
                    ) : null}
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

            <div className="flex justify-between">
              {file ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCancelModal(true)
                  }}
                  disabled={dryRunMutation.isPending}
                  className={cn(touchFeedbackClass, "min-h-[48px]")}
                >
                  Annuler
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                onClick={handleGoToValidation}
                disabled={!file || dryRunMutation.isPending}
                className={cn(touchFeedbackClass, "min-h-[48px]")}
                data-tour="import-validation"
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
              <ImportLoadingOverlay importType={importType} phase="analysis" />
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
                  {warningRowsCount > 0 ? (
                    <p className="font-medium text-amber-700">{warningRowsCount} avertissements</p>
                  ) : null}
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

                {pastScheduleWarnings.length ? (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Créneaux passés ignorés</AlertTitle>
                      <AlertDescription>
                        Les dates et heures passées détectées dans le fichier ne seront pas prises en compte lors de l&apos;import.
                      </AlertDescription>
                    </Alert>
                    <p className="text-sm text-amber-900">
                      Une confirmation sera demandée au moment de lancer l&apos;import.
                    </p>
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
                        <p className="text-sm font-medium text-amber-900">Avertissements</p>
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
              <div className="flex gap-2">
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
                  variant="outline"
                  onClick={() => {
                    setShowCancelModal(true)
                  }}
                  disabled={confirmMutation.isPending}
                  className={cn(touchFeedbackClass, "min-h-[48px]")}
                >
                  Annuler
                </Button>
              </div>

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
              <ImportLoadingOverlay importType={importType} phase="import" />
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

                {importType === "students" && confirmReport.pendingParentAccess.length > 0 ? (
                  <section className="space-y-4 rounded-lg border border-border p-4" aria-labelledby="parent-access-title">
                    <div className="space-y-1">
                      <h3 id="parent-access-title" className="text-base font-semibold">
                        Envoyer les accès parents
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ces comptes ont été créés pendant cet import. Aucun SMS n&apos;a encore été envoyé.
                      </p>
                    </div>

                    <label className="flex min-h-[48px] items-center gap-3 rounded-lg border border-border px-3 py-2">
                      <Checkbox
                        aria-label="Sélectionner tous les parents en attente"
                        checked={
                          confirmReport.pendingParentAccess.every(
                            (parent) =>
                              parentAccessStatuses[parent.parentId] === "queued" ||
                              selectedParentIds.includes(parent.parentId)
                          )
                        }
                        onCheckedChange={(checked) =>
                          setSelectedParentIds(
                            checked
                              ? confirmReport.pendingParentAccess
                                  .filter((parent) => parentAccessStatuses[parent.parentId] !== "queued")
                                  .map((parent) => parent.parentId)
                              : []
                          )
                        }
                      />
                      <span className="text-sm font-medium">Sélectionner tous les accès en attente</span>
                    </label>

                    <div className="divide-y rounded-lg border border-border">
                      {confirmReport.pendingParentAccess.map((parent) => {
                        const status = parentAccessStatuses[parent.parentId]
                        const isQueued = status === "queued"
                        return (
                          <div key={parent.parentId} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                            <label className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3">
                              <Checkbox
                                aria-label={`Sélectionner ${parent.fullName}`}
                                checked={selectedParentIds.includes(parent.parentId)}
                                disabled={isQueued || isSendingParentAccess}
                                onCheckedChange={(checked) =>
                                  setSelectedParentIds((current) =>
                                    checked
                                      ? [...new Set([...current, parent.parentId])]
                                      : current.filter((id) => id !== parent.parentId)
                                  )
                                }
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{parent.fullName}</span>
                                <span className="block text-xs text-muted-foreground">{parent.phone}</span>
                              </span>
                            </label>
                            {isQueued ? (
                              <Badge variant="outline" className="w-fit border-green-200 bg-green-50 text-green-700">
                                Envoi programmé
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-[48px] gap-2"
                                disabled={isSendingParentAccess}
                                onClick={() => void handleSendParentAccess([parent.parentId])}
                              >
                                <Send className="h-4 w-4" /> Envoyer
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {parentAccessError ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{parentAccessError}</AlertDescription>
                      </Alert>
                    ) : null}

                    <Button
                      type="button"
                      className="min-h-[48px] w-full gap-2 sm:w-auto"
                      disabled={isSendingParentAccess || selectedParentIds.length === 0}
                      onClick={() => void handleSendParentAccess(selectedParentIds)}
                    >
                      {isSendingParentAccess ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                      Envoyer la sélection ({selectedParentIds.length})
                    </Button>
                  </section>
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
    </>
  )
}
