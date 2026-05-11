import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, Download, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import {
  computeSalaries,
  downloadSalaryExportFile,
  formatMonthLabel,
  getCurrentMonth,
  getExportJobStatus,
  getNextMonth,
  getPreviousMonth,
  getRecentMonthOptions,
  getSalarySummary,
  getSalaryUnpaidAlerts,
  getTeacherPaymentHistory,
  getTeacherSalaryDetails,
  isFutureMonth,
  queueBulkSalaryExport,
  updateSalaryStatus,
  type SalaryTeacherDetails,
  type SalarySummaryItem,
} from "@/modules/salaries/salaries.api"
import { usePendingValidationCount } from "@/shared/hooks/usePendingValidationCount"
import { SalarySummaryCards } from "@/modules/salaries/components/SalarySummaryCards"
import { SalariesStatsCards } from "@/modules/salaries/components/SalariesStatsCards"
import { SalaryExportSection } from "@/modules/salaries/components/SalaryExportSection"
import { ContextualHelp, EmptyState, OfflineIndicator, SalaryRow, emptyStateIcons } from "@/shared/components"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { formatFcfa } from "@/shared/utils/formatting"

const STALE_TIME = 60_000


const resolveDownloadFileName = (downloadUrl: string | null): string | null => {
  if (!downloadUrl) {
    return null
  }

  try {
    const url = new URL(downloadUrl, window.location.origin)
    const segments = url.pathname.split("/").filter(Boolean)
    const lastSegment = segments.length > 0 ? segments[segments.length - 1] : null
    if (!lastSegment) {
      return null
    }
    return decodeURIComponent(lastSegment)
  } catch {
    return null
  }
}

const toSalaryRowStatus = (
  value: SalarySummaryItem["status"]
): "pending" | "paid" | "disputed" | "nothing_to_pay" | null => {
  if (
    value === "pending" ||
    value === "paid" ||
    value === "disputed" ||
    value === "nothing_to_pay"
  ) {
    return value
  }

  return null
}

function SalaryTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}

const formatHours = (value: number): string => `${Math.round(value * 100) / 100}h`
const parseHoursInput = (value: string): number | null => {
  const normalized = value.replace(",", ".").trim()
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.round(parsed * 100) / 100
}
const getSchoolYearBounds = (referenceMonth: string): { start: string; end: string; label: string } => {
  const [yearRaw, monthRaw] = referenceMonth.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const startYear = month >= 9 ? year : year - 1
  const endYear = startYear + 1
  return {
    start: `${startYear}-09`,
    end: `${endYear}-08`,
    label: `${startYear}-${endYear}`,
  }
}
const formatSalaryDescriptor = (row: SalarySummaryItem | null, details: SalaryTeacherDetails | null): string => {
  if (!row) {
    return ""
  }

  const hourlyRate = details?.teacher.hourlyRate ?? row.hourlyRate
  if (hourlyRate !== null) {
    return `${formatFcfa(hourlyRate)} / heure`
  }

  const monthlyFixedAmount = details?.summary.totalFcfa ?? row.totalFcfa
  if (monthlyFixedAmount !== null) {
    return `${formatFcfa(monthlyFixedAmount)} / mois`
  }

  return "Salaire fixe (mensuel)"
}

const toDisplayedStatus = (row: SalarySummaryItem, details: SalaryTeacherDetails | null): string => {
  if (row.status === "disputed") {
    return "Litige"
  }
  if (row.status === "nothing_to_pay") {
    return "Rien à payer"
  }
  if (details?.summary.isPartiallyPaid || row.isPartiallyPaid) {
    return "Payé partiellement"
  }
  if (row.status === "paid") {
    return "Payé"
  }
  return "En attente"
}

const getStatusBadgeClass = (status: SalarySummaryItem["status"], isPartiallyPaid: boolean): string => {
  if (isPartiallyPaid) {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }
  if (status === "disputed") {
    return "border-red-200 bg-red-50 text-red-700"
  }
  if (status === "nothing_to_pay") {
    return "border-slate-200 bg-slate-50 text-slate-700"
  }
  if (status === "paid") {
    return "border-green-200 bg-green-50 text-green-700"
  }
  return "border-slate-200 bg-slate-50 text-slate-700"
}

const attendanceStatusMeta: Record<
  SalaryTeacherDetails["rows"][number]["attendanceStatus"],
  { label: string; className: string }
> = {
  present: {
    label: "Présent",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  late: {
    label: "En retard",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  absent: {
    label: "Absent",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  excused: {
    label: "Absence justifiée",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  not_marked: {
    label: "Non pointé",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
}

export default function SalariesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canComputeSalaries = hasPermission("salary.compute")
  const canMarkSalaryAsPaid = hasPermission("salary.mark_paid")

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)
  const [computeDialogOpen, setComputeDialogOpen] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [selectedSalaryRow, setSelectedSalaryRow] = useState<SalarySummaryItem | null>(null)
  const [payDialogDetails, setPayDialogDetails] = useState<SalaryTeacherDetails | null>(null)
  const [payDialogDetailsLoading, setPayDialogDetailsLoading] = useState(false)
  const [payTargetMonth, setPayTargetMonth] = useState(getCurrentMonth)
  const [hoursToPayInput, setHoursToPayInput] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [exportJobId, setExportJobId] = useState<string | null>(null)
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false)
  const [bulkExportTarget, setBulkExportTarget] = useState<string>("all")
  const [bulkPeriodFrom, setBulkPeriodFrom] = useState(getCurrentMonth)
  const [bulkPeriodTo, setBulkPeriodTo] = useState(getCurrentMonth)
  const [isDownloadingExport, setIsDownloadingExport] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [detailsRow, setDetailsRow] = useState<SalarySummaryItem | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyTeacherRow, setHistoryTeacherRow] = useState<SalarySummaryItem | null>(null)
  const [historySelectedMonth, setHistorySelectedMonth] = useState(getCurrentMonth)
  const [historyExporting, setHistoryExporting] = useState(false)
  const [vacatairePage, setVacatairePage] = useState(1)
  const [fixedPage, setFixedPage] = useState(1)
  const lastNotifiedExportJobIdRef = useRef<string | null>(null)
  const pageSize = 10

  const monthOptions = useMemo(() => getRecentMonthOptions(getCurrentMonth(), 18), [])
  const payMonthOptions = useMemo(() => {
    const current = getCurrentMonth()
    const minus1 = getPreviousMonth(current)
    const minus2 = getPreviousMonth(minus1)
    const plus1 = getNextMonth(current)
    return [minus2, minus1, current, plus1]
  }, [])

  const salarySummaryQuery = useQuery({
    queryKey: ["salaries", "summary", selectedMonth],
    queryFn: () => getSalarySummary(selectedMonth),
    staleTime: STALE_TIME,
  })

  const unpaidAlertsQuery = useQuery({
    queryKey: ["salaries", "unpaid-alerts", getCurrentMonth()],
    queryFn: () => getSalaryUnpaidAlerts(getCurrentMonth()),
    staleTime: STALE_TIME,
  })

  const validationCountQuery = usePendingValidationCount()

  const exportJobQuery = useQuery({
    queryKey: ["salaries", "export-job", exportJobId],
    queryFn: () => getExportJobStatus(exportJobId ?? ""),
    enabled: Boolean(exportJobId),
    staleTime: 0,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      if (!state) {
        return 2000
      }

      return state === "done" || state === "failed" ? false : 2000
    },
  })

  const computeMutation = useMutation({
    mutationFn: () => computeSalaries(selectedMonth),
    onSuccess: async (result) => {
      setComputeDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["salaries", "summary", selectedMonth] })
      await queryClient.invalidateQueries({ queryKey: ["salaries-stats", selectedMonth] })
      toast({
        title: "Calcul terminé",
        description: `${result.updatedCount} fiche(s) salaire recalculée(s).`,
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de recalculer les salaires.",
        variant: "destructive",
      })
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: (input: { recordId: string; notes?: string; hoursToPay?: number }) =>
      updateSalaryStatus({
        recordId: input.recordId,
        status: "paid",
        notes: input.notes,
        hoursToPay: input.hoursToPay,
      }),
    onSuccess: async () => {
      setPayDialogOpen(false)
      setSelectedSalaryRow(null)
      setPayDialogDetails(null)
      setPayDialogDetailsLoading(false)
      setHoursToPayInput("")
      setPaymentNotes("")
      await queryClient.invalidateQueries({ queryKey: ["salaries", "summary", selectedMonth] })
      await queryClient.invalidateQueries({ queryKey: ["salaries", "summary", payTargetMonth] })
      await queryClient.invalidateQueries({ queryKey: ["salaries-stats", selectedMonth] })
      await queryClient.invalidateQueries({ queryKey: ["salaries-stats", payTargetMonth] })
      toast({ title: "Salaire marqué comme payé" })
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { code?: string } } }).response?.data?.code === "string" &&
        (error as { response?: { data?: { code?: string } } }).response?.data?.code === "SALARY_ALREADY_PAID_FOR_MONTH"
          ? "Ce mois est déjà payé pour ce professeur."
          : "Impossible de mettre à jour le statut du salaire."
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      })
    },
  })

  const computeAndMarkPaidMutation = useMutation({
    mutationFn: async (input: { teacherId: string; month: string; notes?: string }) => {
      // Étape 1 : recalcul de la fiche pour ce mois
      await computeSalaries(input.month)
      // Étape 2 : récupération du salaryRecordId fraîchement calculé
      const summary = await getSalarySummary(input.month)
      const teacherMonth = summary.items.find((item) => item.teacherId === input.teacherId)

      if (!teacherMonth?.salaryRecordId) {
        // Pas de fiche → le prof n'a pas de données ce mois (congé, etc.)
        throw new Error("SALARY_RECORD_NOT_READY")
      }
      if (teacherMonth.status === "paid" && !teacherMonth.isPartiallyPaid) {
        // Doublon : déjà payé ce mois
        throw new Error("SALARY_ALREADY_PAID_FOR_MONTH")
      }

      // Étape 3 : marquer comme payé
      await updateSalaryStatus({
        recordId: teacherMonth.salaryRecordId,
        status: "paid",
        notes: input.notes,
      })
    },
    onSuccess: async () => {
      setPayDialogOpen(false)
      setSelectedSalaryRow(null)
      setPayDialogDetails(null)
      setHoursToPayInput("")
      setPaymentNotes("")
      // Invalider les deux mois potentiellement touchés
      await queryClient.invalidateQueries({ queryKey: ["salaries", "summary", selectedMonth] })
      await queryClient.invalidateQueries({ queryKey: ["salaries", "summary", payTargetMonth] })
      await queryClient.invalidateQueries({ queryKey: ["salaries-stats", selectedMonth] })
      await queryClient.invalidateQueries({ queryKey: ["salaries-stats", payTargetMonth] })
      toast({ title: "Salaire marqué comme payé" })
    },
    onError: (error: unknown) => {
      const code =
        error instanceof Error ? error.message : ""
      const description =
        code === "SALARY_RECORD_NOT_READY"
          ? "Le salaire de ce mois n'est pas prêt pour le paiement."
          : code === "SALARY_ALREADY_PAID_FOR_MONTH"
            ? "Ce mois est déjà payé pour ce professeur."
            : "Impossible de finaliser le paiement pour le mois sélectionné."
      toast({ title: "Erreur", description, variant: "destructive" })
    },
  })

  const exportBulkMutation = useMutation({
    mutationFn: (input: { periodFrom: string; periodTo: string; teacherId?: string }) =>
      queueBulkSalaryExport(input),
    onSuccess: ({ jobId }) => {
      setExportJobId(jobId)
      setBulkExportDialogOpen(false)
      toast({
        title: "Export lancé",
        description: "Le bilan multi-période est en cours de génération.",
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de lancer l'export du bilan.",
        variant: "destructive",
      })
    },
  })

  const detailsMutation = useMutation({
    mutationFn: (teacherId: string) => getTeacherSalaryDetails(teacherId, selectedMonth),
  })

  const paymentHistoryMutation = useMutation({
    mutationFn: (teacherId: string) => getTeacherPaymentHistory(teacherId, 2000),
  })

  const items = salarySummaryQuery.data?.items ?? []

  const vacataireRows = useMemo(
    () => items.filter((item) => item.teacherType === "vacataire"),
    [items]
  )

  const permanentRows = useMemo(
    () => items.filter((item) => item.teacherType === "permanent"),
    [items]
  )
  const vacataireTotalPages = Math.max(1, Math.ceil(vacataireRows.length / pageSize))
  const fixedTotalPages = Math.max(1, Math.ceil(permanentRows.length / pageSize))
  const vacataireCurrentPage = Math.min(vacatairePage, vacataireTotalPages)
  const fixedCurrentPage = Math.min(fixedPage, fixedTotalPages)
  const pagedVacataireRows = useMemo(() => {
    const start = (vacataireCurrentPage - 1) * pageSize
    return vacataireRows.slice(start, start + pageSize)
  }, [vacataireCurrentPage, vacataireRows])
  const pagedPermanentRows = useMemo(() => {
    const start = (fixedCurrentPage - 1) * pageSize
    return permanentRows.slice(start, start + pageSize)
  }, [fixedCurrentPage, permanentRows])

  // montant restant à payer = totalFcfa - amountAlreadyPaid,
  // ce qui gère correctement les paiements partiels
  const totalPending = useMemo(
    () =>
      vacataireRows.reduce((acc, row) => {
        // Exclure les lignes déjà entièrement payées ou sans montant dû
        if (row.status === "paid" || row.status === "nothing_to_pay") {
          return acc
        }
        // Pour un partiellement payé : seule la portion restante est "en attente"
        const remaining = Math.max(0, (row.totalFcfa ?? 0) - row.amountAlreadyPaid)
        return acc + remaining
      }, 0),
    [vacataireRows]
  )

  // on somme amountAlreadyPaid pour tous les vacataires ayant reçu un paiement,
  // quel que soit leur status (paid OU isPartiallyPaid avec pending).
  // amountAlreadyPaid est maintenant disponible.
  const totalPaid = useMemo(
    () =>
      vacataireRows.reduce((acc, row) => {
        // amountAlreadyPaid = ce qui a été effectivement versé.
        // On l'inclut si > 0, indépendamment du status (gère les partiels).
        const paid = row.amountAlreadyPaid
        if (paid <= 0) {
          return acc
        }
        return acc + paid
      }, 0),
    [vacataireRows]
  )
  const unpaidAlert = unpaidAlertsQuery.data

  const isSelectedMonthFuture = isFutureMonth(selectedMonth)
  const teacherOptions = useMemo(
    () => items.map((item) => ({ id: item.teacherId, label: item.teacherName })),
    [items]
  )

  const loadPayDialogDetails = async (teacherId: string, month: string) => {
    setPayDialogDetailsLoading(true)
    try {
      const details = await getTeacherSalaryDetails(teacherId, month)
      setPayDialogDetails(details)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les informations de paiement détaillées.",
        variant: "destructive",
      })
    } finally {
      setPayDialogDetailsLoading(false)
    }
  }

  // logique claire :
  // 1. Si vacataire sans salaryRecordId → on tente le compute automatique
  // 2. Si toujours pas de salaryRecordId après compute → toast + sortie
  // 3. Si OK → ouvrir le dialog
  // Note : on n'utilise plus de mutation de paramètre (let + réassignation propre)
  const openMarkPaidDialog = async (initialRow: SalarySummaryItem) => {
    // On travaille sur une copie locale pour éviter la mutation du paramètre
    let row: SalarySummaryItem = initialRow

    // Un vacataire sans salaryRecordId n'a pas encore de fiche calculée.
    // On tente un compute automatique pour créer la fiche avant d'ouvrir le dialog.
    if (row.teacherType !== "permanent" && !row.salaryRecordId) {
      try {
        // computeSalaries crée ou met à jour salary_records pour ce mois
        await computeSalaries(selectedMonth)
        // On recharge le résumé pour récupérer le salaryRecordId fraîchement créé
        const freshSummary = await getSalarySummary(selectedMonth)
        const freshRow = freshSummary.items.find((item) => item.teacherId === initialRow.teacherId)

        if (!freshRow?.salaryRecordId) {
          // Aucune heure enregistrée ce mois : impossible de créer une fiche
          toast({
            title: "Action indisponible",
            description: "Aucune heure enregistrée ce mois pour ce vacataire.",
            variant: "destructive",
          })
          return
        }

        // On continue avec la ligne fraîche qui contient le salaryRecordId
        row = freshRow
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de préparer la fiche de salaire pour le paiement.",
          variant: "destructive",
        })
        return
      }
    }

    // Ici row.salaryRecordId est garanti non-null pour les vacataires
    setSelectedSalaryRow(row)
    setPayDialogDetails(null)
    setHoursToPayInput("")
    setPaymentNotes("")

    const initialMonth =
      row.teacherType === "permanent"
        ? payMonthOptions.includes(selectedMonth)
          ? selectedMonth
          : getCurrentMonth()
        : selectedMonth

    setPayTargetMonth(initialMonth)
    setPayDialogOpen(true)
    await loadPayDialogDetails(row.teacherId, initialMonth)
  }

  const openDetailsDialog = async (row: SalarySummaryItem) => {
    setDetailsRow(row)
    setDetailsDialogOpen(true)
    try {
      await detailsMutation.mutateAsync(row.teacherId)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails du salaire.",
        variant: "destructive",
      })
    }
  }

  const openHistoryDialog = async (row: SalarySummaryItem) => {
    setHistoryTeacherRow(row)
    setHistorySelectedMonth(selectedMonth)
    paymentHistoryMutation.reset()
    setHistoryDialogOpen(true)
    try {
      await paymentHistoryMutation.mutateAsync(row.teacherId)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des paiements.",
        variant: "destructive",
      })
    }
  }

  const exportFileName = useMemo(
    () => resolveDownloadFileName(exportJobQuery.data?.downloadUrl ?? null),
    [exportJobQuery.data?.downloadUrl]
  )
  const payHoursAlreadyPaid = useMemo(() => {
    if (!payDialogDetails) {
      return 0
    }
    if (
      payDialogDetails.teacher.type === "vacataire" &&
      payDialogDetails.teacher.hourlyRate !== null &&
      payDialogDetails.summary.amountAlreadyPaid !== null
    ) {
      return Math.round((payDialogDetails.summary.amountAlreadyPaid / payDialogDetails.teacher.hourlyRate) * 100) / 100
    }
    return payDialogDetails.payments.reduce((sum, item) => sum + (item.hoursPaid ?? 0), 0)
  }, [payDialogDetails])

  const payHoursRemaining = useMemo(() => {
    if (!payDialogDetails) {
      return 0
    }
    return Math.max(0, Math.round((payDialogDetails.summary.hoursDone - payHoursAlreadyPaid) * 100) / 100)
  }, [payDialogDetails, payHoursAlreadyPaid])

  const payHoursSinceLastPayment = useMemo(() => {
    if (!payDialogDetails || !payDialogDetails.payment.paidAt) {
      return 0
    }
    return Math.max(0, Math.round(payDialogDetails.summary.hoursDoneSinceLastPayment * 100) / 100)
  }, [payDialogDetails])
  const payHoursRemainingFromAlreadyDone = useMemo(
    () => Math.max(0, Math.round((payHoursRemaining - payHoursSinceLastPayment) * 100) / 100),
    [payHoursRemaining, payHoursSinceLastPayment]
  )
  const payHoursRemainingFromNew = useMemo(
    () => Math.max(0, Math.round(Math.min(payHoursRemaining, payHoursSinceLastPayment) * 100) / 100),
    [payHoursRemaining, payHoursSinceLastPayment]
  )
  const parsedHoursToPay = useMemo(() => parseHoursInput(hoursToPayInput), [hoursToPayInput])
  const payAmountRemainingFromAlreadyDone = useMemo(() => {
    if (!payDialogDetails || payDialogDetails.teacher.hourlyRate === null) {
      return 0
    }
    return Math.round(payHoursRemainingFromAlreadyDone * payDialogDetails.teacher.hourlyRate)
  }, [payDialogDetails, payHoursRemainingFromAlreadyDone])
  const payAmountRemainingFromNew = useMemo(() => {
    if (!payDialogDetails || payDialogDetails.teacher.hourlyRate === null) {
      return 0
    }
    return Math.round(payHoursRemainingFromNew * payDialogDetails.teacher.hourlyRate)
  }, [payDialogDetails, payHoursRemainingFromNew])
  const historyMonthOptions = useMemo(() => {
    const fromHistory = paymentHistoryMutation.data?.items.map((item) => item.month) ?? []
    return Array.from(new Set([selectedMonth, ...fromHistory])).sort((a, b) => b.localeCompare(a))
  }, [paymentHistoryMutation.data?.items, selectedMonth])
  const displayedHistoryItems = useMemo(() => {
    const items = paymentHistoryMutation.data?.items ?? []
    if (historyTeacherRow?.teacherType !== "vacataire") {
      return items
    }
    return items.filter((item) => item.month === historySelectedMonth)
  }, [historySelectedMonth, historyTeacherRow?.teacherType, paymentHistoryMutation.data?.items])
  const payAmountForInput = useMemo(() => {
    if (!payDialogDetails || payDialogDetails.teacher.hourlyRate === null || parsedHoursToPay === null) {
      return 0
    }
    return Math.round(parsedHoursToPay * payDialogDetails.teacher.hourlyRate)
  }, [payDialogDetails, parsedHoursToPay])

  const handleDownloadExport = async () => {
    const downloadUrl = exportJobQuery.data?.downloadUrl
    if (!downloadUrl) {
      return
    }

    setIsDownloadingExport(true)
    try {
      const { blob, fileName } = await downloadSalaryExportFile(downloadUrl)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = fileName || exportFileName || "export-salaires.pdf"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le fichier d'export.",
        variant: "destructive",
      })
    } finally {
      setIsDownloadingExport(false)
    }
  }

  useEffect(() => {
    const exportState = exportJobQuery.data?.state
    const exportDownloadUrl = exportJobQuery.data?.downloadUrl
    if (exportState !== "done" || !exportDownloadUrl || !exportJobId) {
      return
    }

    if (lastNotifiedExportJobIdRef.current === exportJobId) {
      return
    }

    lastNotifiedExportJobIdRef.current = exportJobId
    toast({
      title: "Export prêt",
      description: "Le fichier est prêt. Vous pouvez lancer le téléchargement.",
    })
  }, [exportJobId, exportJobQuery.data?.downloadUrl, exportJobQuery.data?.state, toast])

  return (
    <>
      <OfflineIndicator />

      <div className="space-y-6 animate-fade-in" data-testid="salaries-page">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 md:py-2">
              <h1 className="text-2xl font-semibold tracking-tight">Gestion des salaires</h1>
              <p className="text-sm text-muted-foreground">Pilotage mensuel des paies vacataires</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth((current) => getPreviousMonth(current))}
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[210px]" data-testid="salaries-month-select-trigger">
                    <SelectValue placeholder="Sélectionner un mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatMonthLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth((current) => getNextMonth(current))}
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {canComputeSalaries ? (
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    onClick={() => setComputeDialogOpen(true)}
                    disabled={isSelectedMonthFuture || computeMutation.isPending}
                    data-testid="salaries-compute-button"
                  >
                    Calculer les salaires
                  </Button>
                  {salarySummaryQuery.data?.lastComputedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Dernier calcul : {new Date(salarySummaryQuery.data.lastComputedAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBulkExportTarget("all")
                  setBulkPeriodFrom(selectedMonth)
                  setBulkPeriodTo(selectedMonth)
                  setBulkExportDialogOpen(true)
                }}
                disabled={exportBulkMutation.isPending}
                data-testid="salaries-export-school-button"
              >
                Export bilan PDF
              </Button>
            </div>
          </div>

          {isSelectedMonthFuture ? (
            <p className="text-sm text-amber-700">Le calcul est désactivé pour un mois futur.</p>
          ) : null}

          <SalaryExportSection
            exportJobId={exportJobId}
            exportFileName={exportFileName}
            exportJobState={exportJobQuery.data?.state}
            downloadUrl={exportJobQuery.data?.downloadUrl}
            failedReason={exportJobQuery.data?.failedReason}
            isDownloading={isDownloadingExport}
            onDownload={handleDownloadExport}
          />
        </header>

        <SalariesStatsCards month={selectedMonth} />

        {(validationCountQuery.data?.total ?? 0) > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">
                    {validationCountQuery.data?.total ?? 0} présence(s) en attente de validation
                  </p>
                  <p className="text-sm">Les heures concernées ne sont pas encore comptabilisées.</p>
                </div>
              </div>
              <Button asChild variant="outline" className="min-h-[48px] border-amber-300 bg-white">
                <Link to="/validations">Valider maintenant</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {unpaidAlert && unpaidAlert.count > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">Salaires des mois passés à régler</p>
                  <p className="text-sm">
                    {unpaidAlert.count} fiche(s) non soldée(s), pour {formatFcfa(unpaidAlert.totalRemainingFcfa)}.
                  </p>
                  <p className="text-xs">
                    Mois concernés: {unpaidAlert.months.map((item) => formatMonthLabel(item.month)).join(", ")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

        {(!canComputeSalaries || !canMarkSalaryAsPaid) ? (
          <ContextualHelp title="Droits disponibles sur votre poste">
            {!canComputeSalaries && !canMarkSalaryAsPaid
              ? "Vous pouvez consulter les salaires, mais le recalcul et la validation de paiement nécessitent des droits supplémentaires."
              : !canComputeSalaries
                ? "Le recalcul des fiches n'est pas disponible pour votre poste. Les montants affichés restent ceux déjà calculés."
                : "La validation de paiement n'est pas disponible pour votre poste. Les boutons de paiement restent masqués."}
          </ContextualHelp>
        ) : null}

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6" data-testid="salaries-vacataire-section">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Salaires vacataires • {formatMonthLabel(selectedMonth)}</h2>
            <Badge variant="outline">{vacataireRows.length} vacataire(s)</Badge>
          </div>

          {salarySummaryQuery.isLoading ? (
            <SalaryTableSkeleton />
          ) : vacataireRows.length === 0 ? (
            <EmptyState
              icon={emptyStateIcons.noTeachers}
              title="Aucun salaire vacataire"
              message="Aucune heure pointée ou fiche calculée n'est disponible pour ce mois. Vérifiez le mois sélectionné ou recalculez les salaires si vous avez le droit."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="salaries-vacataire-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Professeur</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedVacataireRows.map((row) => {
                    const status = toSalaryRowStatus(row.status)
                    if (!status) {
                      return null
                    }

                    return (
                      <SalaryRow
                        key={row.teacherId}
                        dataTestIdPrefix="salary-vacataire"
                        teacher={{
                          id: row.teacherId,
                          name: row.teacherName,
                          type: row.teacherType,
                        }}
                        periodSummary={{
                          hoursDone: row.hoursDone,
                          hoursPlanned: row.hoursPlanned,
                          amountFcfa: row.totalFcfa ?? 0,
                          status,
                          isPartiallyPaid: row.isPartiallyPaid,
                          statusLabel: row.isPartiallyPaid ? "Payé partiellement" : undefined,
                          statusClassName: row.isPartiallyPaid ? "border-amber-200 bg-amber-50 text-amber-700" : undefined,
                          canMarkPaid:
                            canMarkSalaryAsPaid &&
                            Boolean(row.salaryRecordId) &&
                            row.hoursDone > 0 &&
                            (row.totalFcfa ?? 0) > 0,
                        }}
                        onMarkPaid={() => openMarkPaidDialog(row)}
                        onDetails={() => void openDetailsDialog(row)}
                        onHistory={() => void openHistoryDialog(row)}
                      />
                    )
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Page {vacataireCurrentPage}/{vacataireTotalPages} • {vacataireRows.length} ligne(s)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setVacatairePage((value) => Math.max(1, value - 1))}
                    disabled={vacataireCurrentPage <= 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setVacatairePage((value) => Math.min(vacataireTotalPages, value + 1))}
                    disabled={vacataireCurrentPage >= vacataireTotalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Salaires fixes • {formatMonthLabel(selectedMonth)}</h2>
            <Badge variant="outline">{permanentRows.length} permanent(s)</Badge>
          </div>

          {permanentRows.length === 0 ? (
            <ContextualHelp title="Aucun salaire fixe">
              Aucun professeur permanent n&apos;est rattaché à ce mois. Si ce résultat est inattendu, vérifiez les profils professeurs et le mois sélectionné.
            </ContextualHelp>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="salaries-fixed-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Professeur</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead>Montant mensuel</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedPermanentRows.map((row) => (
                    <TableRow key={row.teacherId}>
                      <TableCell className="font-medium">{row.teacherName}</TableCell>
                      <TableCell className="font-normal">
                        {formatHours(row.hoursDone)} / {formatHours(row.hoursPlanned)}
                      </TableCell>
                      <TableCell className="font-semibold">{formatFcfa(row.totalFcfa ?? 0)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-xs font-medium", getStatusBadgeClass(row.status, row.isPartiallyPaid))}
                        >
                          {toDisplayedStatus(row, null)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canMarkSalaryAsPaid &&
                        (row.status === "pending" ||
                        (row.status === "paid" && row.isPartiallyPaid)) ? (
                          <Button type="button" size="sm" className="mr-2" onClick={() => void openMarkPaidDialog(row)}>
                            Marquer payé
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="outline" onClick={() => void openDetailsDialog(row)}>
                          Détails
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void openHistoryDialog(row)}>
                          Historique
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Page {fixedCurrentPage}/{fixedTotalPages} • {permanentRows.length} ligne(s)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setFixedPage((value) => Math.max(1, value - 1))}
                    disabled={fixedCurrentPage <= 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setFixedPage((value) => Math.min(fixedTotalPages, value + 1))}
                    disabled={fixedCurrentPage >= fixedTotalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails salaire professeur</DialogTitle>
            <DialogDescription>
              {detailsRow
                ? `${detailsRow.teacherName} • ${formatMonthLabel(selectedMonth)} - ${formatSalaryDescriptor(
                    detailsRow,
                    detailsMutation.data ?? null
                  )}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detailsMutation.isPending ? (
            <SalaryTableSkeleton />
          ) : detailsMutation.data && detailsRow ? (
            <div className="space-y-4">
              {detailsMutation.data.teacher.type === "permanent" ? (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs text-blue-700">Heures prévues (mois)</p>
                      <p className="text-lg font-semibold text-blue-900">
                        {formatHours(detailsMutation.data.summary.hoursPlanned)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-xs text-green-700">Heures effectuées</p>
                      <p className="text-lg font-semibold text-green-900">
                        {formatHours(detailsMutation.data.summary.hoursDone)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700">Heures manquées</p>
                      <p className="text-lg font-semibold text-red-900">
                        {formatHours(detailsMutation.data.summary.absenceHours)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                      <p className="text-xs text-violet-700">Statut paie</p>
                      <p className="text-base font-semibold text-violet-900">{toDisplayedStatus(detailsRow, detailsMutation.data)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-700">Paiement déjà effectué</p>
                      <p className="text-base font-semibold text-slate-900">
                        {detailsMutation.data.payment.paidAt ? "Oui" : "Non"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs text-amber-700">Montant fixe mensuel</p>
                      <p className="text-base font-semibold text-amber-900">
                        {detailsMutation.data.teacher.monthlySalary !== null
                          ? formatFcfa(detailsMutation.data.teacher.monthlySalary)
                          : "Non renseigné"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3 text-sm">
                    <p>
                      Heures restantes prévues:{" "}
                      <span className="font-semibold">
                        {formatHours(detailsMutation.data.summary.remainingPlannedHours)}
                      </span>
                    </p>
                    <p>
                      Taux de présence du mois:{" "}
                      <span className="font-semibold">
                        {detailsMutation.data.summary.hoursPlanned > 0
                          ? `${Math.round(
                              (detailsMutation.data.summary.hoursDone / detailsMutation.data.summary.hoursPlanned) * 100
                            )}%`
                          : "0%"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dernier paiement:{" "}
                      {detailsMutation.data.payment.paidAt
                        ? new Date(detailsMutation.data.payment.paidAt).toLocaleString("fr-FR")
                        : "Aucun paiement enregistré sur la période."}
                      {detailsMutation.data.payment.paidAt && detailsMutation.data.payment.paidByName
                        ? ` • par ${detailsMutation.data.payment.paidByName}`
                        : ""}
                      {detailsMutation.data.payment.paidAt && detailsMutation.data.payment.notes
                        ? ` • note: ${detailsMutation.data.payment.notes}`
                        : ""}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs text-blue-700">Heures totales prévues (mois)</p>
                      <p className="text-lg font-semibold text-blue-900">
                        {formatHours(detailsMutation.data.summary.hoursPlanned)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-xs text-green-700">Heures effectuées (hors absences)</p>
                      <p className="text-lg font-semibold text-green-900">
                        {formatHours(detailsMutation.data.summary.hoursDone)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700">Absences constatées</p>
                      <p className="text-lg font-semibold text-red-900">
                        {formatHours(detailsMutation.data.summary.absenceHours)}
                      </p>
                    </div>
                    {/* <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Montant / heure</p>
                      <p className="text-lg font-semibold text-foreground">
                        {detailsMutation.data.teacher.hourlyRate === null
                          ? "Salaire fixe"
                          : formatFcfa(detailsMutation.data.teacher.hourlyRate)}
                      </p>
                    </div> */}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-violet-200 bg-blue-50 p-3">
                      <p className="text-xs text-blue-700">Statut paie</p>
                      <p className="text-base font-semibold text-violet-900">{toDisplayedStatus(detailsRow, detailsMutation.data)}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs text-emerald-700">Salaire actuel (heures réellement faites)</p>
                      <p className="text-base font-semibold text-emerald-900">
                        {formatFcfa(detailsMutation.data.summary.currentEarnedAmount ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700">Montant retranché (absences)</p>
                      <p className="text-base font-semibold text-red-900">
                        {formatFcfa(detailsMutation.data.summary.absenceAmount ?? 0)}
                      </p>
                    </div>
                  </div>

                <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3 text-sm">
                  <p>
                    Salaire déjà payé: <span className="font-semibold">{formatFcfa(detailsMutation.data.summary.amountAlreadyPaid ?? 0)}</span>
                  </p>
                  <p>
                    Salaire restant à payer (depuis le dernier paiement):{" "}
                    <span className="font-semibold text-red-700">
                      {formatFcfa(detailsMutation.data.summary.amountRemainingToPayNow ?? 0)}
                    </span>
                  </p>
                  <p>
                    Salaire à obtenir sur les heures restantes prévues:{" "}
                    <span className="font-semibold text-blue-700">
                      {formatFcfa(detailsMutation.data.summary.remainingPotentialAmount ?? 0)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Heures restantes prévues (hors absences):{" "}
                    {formatHours(detailsMutation.data.summary.remainingPlannedHours)}
                  </p>
                  {detailsMutation.data.payment.paidAt ? (
                    <p className="text-xs text-muted-foreground">
                      Dernier paiement:{" "}
                      {new Date(detailsMutation.data.payment.paidAt).toLocaleString("fr-FR")}{" "}
                      {detailsMutation.data.payment.paidByName ? `• par ${detailsMutation.data.payment.paidByName}` : ""}
                      {detailsMutation.data.payment.notes ? ` • note: ${detailsMutation.data.payment.notes}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucun paiement enregistré pour cette période.</p>
                  )}
                </div>
                </>
              )}

              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 z-10 bg-background">Date</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background">Cours</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-background">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailsMutation.data.rows.map((row, index) => (
                      <TableRow key={`${row.date}-${index}`}>
                        <TableCell className="font-normal">{row.date}</TableCell>
                        <TableCell className="font-normal">
                          {row.subject} • {row.className} ({row.startTime}-{row.endTime})
                        </TableCell>
                        <TableCell className="font-normal">
                          <Badge
                            variant="outline"
                            className={cn("text-xs font-medium", attendanceStatusMeta[row.attendanceStatus].className)}
                          >
                            {attendanceStatusMeta[row.attendanceStatus].label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun détail disponible.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historique des paiements</DialogTitle>
            <DialogDescription>
              {historyTeacherRow ? `${historyTeacherRow.teacherName}` : ""}
            </DialogDescription>
          </DialogHeader>

          {historyTeacherRow?.teacherType === "vacataire" ? (
            <div className="space-y-2">
              <label htmlFor="history-month" className="text-sm font-medium">
                Mois affiché
              </label>
              <Select value={historySelectedMonth} onValueChange={setHistorySelectedMonth}>
                <SelectTrigger id="history-month">
                  <SelectValue placeholder="Sélectionner un mois" />
                </SelectTrigger>
                <SelectContent>
                  {historyMonthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthLabel(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {paymentHistoryMutation.isPending ? (
            <SalaryTableSkeleton />
          ) : paymentHistoryMutation.data ? (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedHistoryItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        Aucun historique de paiement trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedHistoryItems.map((item) => (
                      <TableRow key={item.paymentId}>
                        <TableCell>{formatMonthLabel(item.month)}</TableCell>
                        <TableCell className="font-semibold">{formatFcfa(item.amountFcfa)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-medium",
                              item.status === "paid"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : item.status === "disputed"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                            )}
                          >
                            {item.status === "paid"
                              ? "Payé"
                              : item.status === "disputed"
                                ? "Litige"
                                : item.status === "nothing_to_pay"
                                    ? "Rien à payer"
                                    : "En attente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.paidAt ? new Date(item.paidAt).toLocaleString("fr-FR") : "Non payé"}
                          {item.paidByName ? ` • ${item.paidByName}` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(item.hoursPaid !== null ? `${formatHours(item.hoursPaid)} • ` : "") + (item.notes ?? "-")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
          )}
          {paymentHistoryMutation.data ? (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!historyTeacherRow) {
                    return
                  }
                  setHistoryExporting(true)
                  const schoolYear = getSchoolYearBounds(selectedMonth)
                  try {
                    const history = await getTeacherPaymentHistory(historyTeacherRow.teacherId, 2000)
                    const filtered = history.items.filter(
                      (item) => item.month >= schoolYear.start && item.month <= schoolYear.end
                    )
                    const csvLines = [
                      ["Mois", "Montant", "Heures payées", "Statut", "Date paiement", "Payé par", "Note"].join(","),
                      ...filtered.map((item) =>
                        [
                          `"${formatMonthLabel(item.month)}"`,
                          item.amountFcfa,
                          item.hoursPaid ?? "",
                          item.status,
                          item.paidAt ? `"${new Date(item.paidAt).toLocaleString("fr-FR")}"` : "",
                          `"${item.paidByName ?? ""}"`,
                          `"${(item.notes ?? "").replace(/"/g, '""')}"`,
                        ].join(",")
                      ),
                    ]
                    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" })
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement("a")
                    link.href = url
                    link.download = `historique-paiements-${historyTeacherRow.teacherName}-${schoolYear.label}.csv`
                    document.body.appendChild(link)
                    link.click()
                    link.remove()
                    URL.revokeObjectURL(url)
                  } catch {
                    toast({
                      title: "Erreur",
                      description: "Impossible d'exporter l'historique des paiements.",
                      variant: "destructive",
                    })
                  } finally {
                    setHistoryExporting(false)
                  }
                }}
                disabled={historyExporting}
              >
                {historyExporting ? "Export en cours..." : "Exporter l'historique (année scolaire)"}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={computeDialogOpen} onOpenChange={setComputeDialogOpen} key={`compute-${selectedMonth}`}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le calcul</DialogTitle>
            <DialogDescription>
              Cette action va recalculer tous les salaires du mois sélectionné ({formatMonthLabel(selectedMonth)}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setComputeDialogOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => computeMutation.mutate()} disabled={computeMutation.isPending} data-testid="salaries-compute-confirm-button">
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={payDialogOpen}
        onOpenChange={(open) => {
          setPayDialogOpen(open)
          if (!open) {
            setPayDialogDetails(null)
            setPayDialogDetailsLoading(false)
            setHoursToPayInput("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme payé</DialogTitle>
            <DialogDescription>
              {selectedSalaryRow
                ? `Confirmer le paiement de ${selectedSalaryRow.teacherName} pour ${formatMonthLabel(payTargetMonth)} (${formatFcfa(payDialogDetails?.summary.amountRemainingToPayNow ?? selectedSalaryRow.totalFcfa ?? 0)}).`
                : "Confirmer le paiement de ce salaire."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {selectedSalaryRow?.teacherType === "permanent" ? (
              <div className="space-y-2">
                <label htmlFor="pay-target-month" className="text-sm font-medium">
                  Mois à payer
                </label>
                <Select
                  value={payTargetMonth}
                  onValueChange={(value) => {
                    setPayTargetMonth(value)
                    if (selectedSalaryRow) {
                      void loadPayDialogDetails(selectedSalaryRow.teacherId, value)
                    }
                  }}
                >
                  <SelectTrigger id="pay-target-month">
                    <SelectValue placeholder="Sélectionner un mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {payMonthOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatMonthLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="rounded-lg border border-border bg-muted/10 p-3 text-sm">
              {payDialogDetailsLoading ? (
                <p className="text-xs text-muted-foreground">Chargement des informations de paiement...</p>
              ) : payDialogDetails?.payment.paidAt ? (
                <div className="space-y-1">
                  <p>
                    Montant TOTAL :{" "}
                    <span className="font-semibold">{formatFcfa(payDialogDetails.summary.currentEarnedAmount ?? 0)}</span>
                  </p>
                  <p>
                    Montant payé:{" "}
                    <span className="font-semibold">
                      {formatFcfa(payDialogDetails.summary.amountAlreadyPaid ?? 0)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Date dernier paiment: {new Date(payDialogDetails.payment.paidAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucun paiement précédent enregistré sur cette période.</p>
              )}
            </div>
            {selectedSalaryRow?.teacherType === "vacataire" && payDialogDetails ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3 text-sm">
                <p>
                  Nombre d'heure prévue ce mois :{" "}
                  <span className="font-semibold">{formatHours(payDialogDetails.summary.hoursPlanned)}</span>
                </p>
                <p>
                  Nombre d'heure effectué :{" "}
                  <span className="font-semibold">{formatHours(payDialogDetails.summary.hoursDone)}</span>
                </p>
                <p>
                  Nombre d'heure déjà payé : <span className="font-semibold">{formatHours(payHoursAlreadyPaid)}</span>
                </p>
                <p>
                  Nombre d'heure restant à payer :{" "}
                  <span className="font-semibold text-red-700">{formatHours(payHoursRemaining)}</span>
                </p>
                {/* <p>
                  Reste sur heures déjà effectuées :{" "}
                  <span className="font-semibold">
                    {formatHours(payHoursRemainingFromAlreadyDone)} ({formatFcfa(payAmountRemainingFromAlreadyDone)})
                  </span>
                </p>
                <p>
                  Nouvelles heures depuis dernier paiement :{" "}
                  <span className="font-semibold">
                    {formatHours(payHoursRemainingFromNew)} ({formatFcfa(payAmountRemainingFromNew)})
                  </span>
                </p> */}
                <p>
                  Reste à payer :{" "}
                  <span className="font-semibold">{formatFcfa(payDialogDetails?.summary.amountRemainingToPayNow ?? selectedSalaryRow.totalFcfa ?? 0)}</span>
                </p>
              </div>
            ) : null}
            {selectedSalaryRow?.teacherType === "vacataire" ? (
              <div className="space-y-2">
                <label htmlFor="hours-to-pay" className="text-sm font-medium">
                  Saisissez le nombre d'heure que vous souhaitez payer
                </label>
                <Input
                  id="hours-to-pay"
                  inputMode="decimal"
                  placeholder="Ex: 5"
                  value={hoursToPayInput}
                  onChange={(event) => setHoursToPayInput(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Montant : <span className="font-semibold">{formatFcfa(payAmountForInput)}</span>
                </p>
              </div>
            ) : null}
            {selectedSalaryRow?.teacherType === "permanent" && payDialogDetails?.summary.status === "paid" ? (
              <p className="text-xs text-red-700">
                Ce mois est déjà payé. Le système bloque les doublons de paiement mensuel.
              </p>
            ) : null}

            <label htmlFor="salary-notes" className="text-sm font-medium">
              Notes (optionnel)
            </label>
            <Input
              id="salary-notes"
              placeholder="Ex: Virement effectué le 5 du mois"
              value={paymentNotes}
              onChange={(event) => setPaymentNotes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!selectedSalaryRow) return

                if (selectedSalaryRow.teacherType === "permanent") {
                  // Déclenche la mutation qui encapsule compute → getSummary → markPaid
                  computeAndMarkPaidMutation.mutate({
                    teacherId: selectedSalaryRow.teacherId,
                    month: payTargetMonth,
                    notes: paymentNotes,
                  })
                  return
                }

                // Vacataire : salaryRecordId est garanti non-null ici
                // (openMarkPaidDialog l'assure via le fallback compute)
                if (!selectedSalaryRow.salaryRecordId) return

                if (parsedHoursToPay === null) {
                  toast({
                    title: "Saisie invalide",
                    description: "Veuillez saisir un nombre d'heures valide.",
                    variant: "destructive",
                  })
                  return
                }

                if (parsedHoursToPay - payHoursRemaining > 0.0001) {
                  toast({
                    title: "Saisie invalide",
                    description: "Le nombre d'heures dépasse le restant à payer.",
                    variant: "destructive",
                  })
                  return
                }

                markPaidMutation.mutate({
                  recordId: selectedSalaryRow.salaryRecordId,
                  notes: paymentNotes,
                  hoursToPay: parsedHoursToPay,
                })
              }}
              disabled={
                // On désactive si l'une ou l'autre mutation est en cours
                markPaidMutation.isPending ||
                computeAndMarkPaidMutation.isPending ||
                !selectedSalaryRow ||
                (selectedSalaryRow.teacherType !== "permanent" && !selectedSalaryRow.salaryRecordId) ||
                (selectedSalaryRow.teacherType === "vacataire" && parsedHoursToPay === null) ||
                (selectedSalaryRow.teacherType === "permanent" &&
                  payDialogDetails?.summary.status === "paid" &&
                  !payDialogDetails?.summary.isPartiallyPaid)
              }
            >
              {(markPaidMutation.isPending || computeAndMarkPaidMutation.isPending)
                ? "En cours…"
                : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkExportDialogOpen} onOpenChange={setBulkExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exporter le bilan</DialogTitle>
            <DialogDescription>
              Choisissez un professeur (ou tous) et la période à exporter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="bulk-export-target" className="text-sm font-medium">
                Pour
              </label>
              <Select value={bulkExportTarget} onValueChange={setBulkExportTarget}>
                <SelectTrigger id="bulk-export-target">
                  <SelectValue placeholder="Tous les professeurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les professeurs</SelectItem>
                  {teacherOptions.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="bulk-period-from" className="text-sm font-medium">
                  Période de
                </label>
                <Input
                  id="bulk-period-from"
                  type="month"
                  value={bulkPeriodFrom}
                  onChange={(event) => setBulkPeriodFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="bulk-period-to" className="text-sm font-medium">
                  à
                </label>
                <Input
                  id="bulk-period-to"
                  type="month"
                  value={bulkPeriodTo}
                  onChange={(event) => setBulkPeriodTo(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkExportDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (bulkPeriodFrom.length !== 7 || bulkPeriodTo.length !== 7 || bulkPeriodFrom > bulkPeriodTo) {
                  toast({
                    title: "Période invalide",
                    description: "Sélectionnez une période valide avant de générer le bilan.",
                    variant: "destructive",
                  })
                  return
                }

                const teacherId = bulkExportTarget === "all" ? undefined : bulkExportTarget
                exportBulkMutation.mutate({
                  periodFrom: bulkPeriodFrom,
                  periodTo: bulkPeriodTo,
                  teacherId,
                })
              }}
              disabled={
                exportBulkMutation.isPending ||
                bulkPeriodFrom.length !== 7 ||
                bulkPeriodTo.length !== 7 ||
                bulkPeriodFrom > bulkPeriodTo
              }
            >
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
