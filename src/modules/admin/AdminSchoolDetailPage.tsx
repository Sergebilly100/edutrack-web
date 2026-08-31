import { useEffect, useState } from "react"
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coins,
  KeyRound,
  Pencil,
  Plus,
  Save,
  Send,
  TrendingUp,
  Users,
  X,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import {
  activateSchoolSmsFeature,
  setMidYearFlag,
  addSchoolPayment,
  deactivateSchoolSmsFeature,
  getSchoolSmsFeatureStats,
  getSchoolCommissionPayments,
  getSchoolDetails,
  getSchoolPayments,
  getSchoolUsers,
  getSchoolYearStatus,
  openSchoolYear,
  recordSchoolCommissionReceived,
  resetTenantSmsTemplate,
  sendSchoolPaymentReminder,
  syncSchoolSmsCommission,
  updateSchoolDirector,
  updateSchoolSubscription,
  type SchoolDetailsResponse,
  type TenantPlan,
  type TenantStatus,
  type TeachingType,
  updateSchoolConfig,
  updateSchoolSmsFeatureConfig,
} from "@/modules/admin/admin.api"
import { OfflineDisabledFieldset, OfflineIndicator, StatCard } from "@/shared/components"
import { MidyearImportPanel } from "./components/MidyearImportPanel"
import { useAuthStore } from "@/shared/store/auth.store"

import {
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  TEACHING_OPTIONS,
  credentialLabel,
  formatDate,
  formatDateTime,
  formatFcfa,
  toBarWidthClass,
  type AdminSchoolDetailLocationState,
  type CreatedDirectorCredentials,
} from "./admin-school-detail.helpers"

const SCHOOL_YEAR_REGEX = /^\d{2}\/\d{4} - \d{2}\/\d{4}$/
const PHONE_CI_REGEX = /^225\d{10}$/

const clampInt = (raw: string, min: number, max: number, fallback: number): number => {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

// Retourne le mois précédent au format YYYY-MM
const prevMonth = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, "0")}`
}

// Retourne le mois suivant au format YYYY-MM
const nextMonth = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, "0")}`
}

const monthStartIso = (ym: string): string => `${ym}-01`

const monthEndIso = (ym: string): string => {
  const [year, month] = ym.split("-").map(Number)
  if (!year || !month) return ""
  return new Date(year, month, 0).toISOString().slice(0, 10)
}

const dateToMonthKey = (value: string | null): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`
}

const monthLabel = (ym: string): string => {
  const [year, month] = ym.split("-").map(Number)
  if (!year || !month) return ym
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Espèces" },
  { value: "momo_mtn", label: "MTN MoMo" },
  { value: "momo_orange", label: "Orange Money" },
  { value: "bank_transfer", label: "Virement bancaire" },
] as const

const PAYMENT_PROVIDERS = [
  { value: "manual", label: "Manuel" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "orange_money", label: "Orange Money" },
] as const

export default function AdminSchoolDetailPage() {
  const user = useAuthStore((state) => state.user)
  const [nowMs] = useState(() => Date.now())
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const locationState = (location.state as AdminSchoolDetailLocationState | null) ?? null
  const createdDirectorCredentials = locationState?.createdDirectorCredentials
  const tabFromQuery = new URLSearchParams(location.search).get("tab")
  const [activeTab, setActiveTab] = useState<string>(
    tabFromQuery === "sms-revenus" ? "sms-revenus" : "config"
  )

  // ── Queries ──────────────────────────────────────────────────────────────
  const schoolQuery = useQuery({
    queryKey: ["admin", "school-detail", tenantId],
    queryFn: () => getSchoolDetails(tenantId as string),
    enabled: Boolean(tenantId),
  })
  const schoolUsersQuery = useQuery({
    queryKey: ["admin", "school-users", tenantId],
    queryFn: () => getSchoolUsers(tenantId as string),
    enabled: Boolean(tenantId),
  })
  const paymentsQuery = useQuery({
    queryKey: ["admin", "school-payments", tenantId],
    queryFn: () => getSchoolPayments(tenantId as string),
    enabled: Boolean(tenantId),
  })
  const smsFeatureStatsQuery = useQuery({
    queryKey: ["admin", "school-sms-feature-stats", tenantId],
    queryFn: () => getSchoolSmsFeatureStats(tenantId as string),
    enabled: Boolean(tenantId),
  })
  const schoolYearQuery = useQuery({
    queryKey: ["admin", "school-year-status", tenantId],
    queryFn: () => getSchoolYearStatus(tenantId as string),
    enabled: Boolean(tenantId),
  })

  // ── États locaux ─────────────────────────────────────────────────────────
  const [config, setConfig] = useState({
    name: "",
    plan: "essential" as TenantPlan,
    status: "trial" as TenantStatus,
    city: "",
    teachingType: "secondaire" as TeachingType,
    studentLabel: "Élève",
    directorTitle: "Directeur",
    activeSchoolYear: "",
    maxUsers: 50,
    maxAdminPositions: 1,
    maxSmsPerMonth: 0,
    canEditSmsTemplate: false,
    canExportData: true,
    midYearOnboarding: false,
  })

  const [payment, setPayment] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    provider: "manual" as "manual" | "mtn_momo" | "orange_money",
    reference: "",
    periodFrom: "",
    periodTo: "",
  })

  const midYearMutation = useMutation({
    mutationFn: (enabled: boolean) => setMidYearFlag(tenantId as string, enabled),
    onSuccess: async (_response, enabled) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      setConfig((current) => ({ ...current, midYearOnboarding: enabled }))
      if (enabled) setActiveTab("import-midyear")
      toast({
        title: enabled ? "Import prise en main activé" : "Import prise en main désactivé",
      })
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de modifier le flag.", variant: "destructive" }),
  })

  const [mrrDraft, setMrrDraft] = useState({ mrr: "", cycle: "monthly" as "monthly" | "annual" })
  const [isDirectorEditing, setIsDirectorEditing] = useState(false)
  const [directorDraft, setDirectorDraft] = useState({
    name: "",
    phone: "",
    email: "",
  })

  const [smsConfigDraft, setSmsConfigDraft] = useState({
    commissionPct: "0",
    smsCapPerStudent: "60",
    monetizeParentAlerts: false,
    useRealHours: false,
    geoCheckEnabled: false,
  })

  // Navigation mois pour les revenus SMS
  const [revenueMonth, setRevenueMonth] = useState(() => new Date().toISOString().slice(0, 7))
  // Mois déplié dans la liste des reversements (vide = aucun déplié)
  const [reversementMonth, setReversementMonth] = useState("")

  // Dialogs
  const [smsFeatureToggleOpen, setSmsFeatureToggleOpen] = useState(false)
  const [smsFeatureToggleNextValue, setSmsFeatureToggleNextValue] = useState<boolean | null>(null)
  const [reversementOpen, setReversementOpen] = useState(false)

  // Ouverture d'une nouvelle année scolaire (super admin)
  const [openYearForm, setOpenYearForm] = useState({
    label: "",
    startDate: "",
    endDate: "",
    reviewDate: "",
    periodType: "trimester" as "trimester" | "semester",
  })
  const [confirmOpenYearOpen, setConfirmOpenYearOpen] = useState(false)
  const [reversementPeriodMonth, setReversementPeriodMonth] = useState("")
  const [reversementAmount, setReversementAmount] = useState("")
  const [reversementMethod, setReversementMethod] = useState<"cash" | "momo_mtn" | "momo_orange" | "bank_transfer">("cash")
  const [reversementNotes, setReversementNotes] = useState("")

  // Détail des opérations pour le mois déplié (audit_financial_events)
  const commissionPaymentsQuery = useQuery({
    queryKey: ["admin", "school-sms-feature-payments", tenantId, reversementMonth],
    queryFn: () => getSchoolCommissionPayments(tenantId as string, reversementMonth),
    enabled: Boolean(tenantId) && reversementMonth !== "",
  })

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolQuery.data) return
    const metadata = schoolQuery.data.metadata
    setConfig({
      name: metadata.name,
      plan: metadata.plan,
      status: metadata.status,
      city: metadata.city ?? "",
      teachingType: metadata.teachingType ?? "secondaire",
      studentLabel: metadata.studentLabel ?? (metadata.teachingType === "superieur" ? "Étudiant(e)" : "Élève"),
      directorTitle: metadata.directorTitle ?? "Directeur",
      activeSchoolYear: metadata.activeSchoolYear ?? "",
      maxUsers: metadata.maxUsers,
      maxAdminPositions: metadata.maxAdminPositions,
      maxSmsPerMonth: metadata.maxSmsPerMonth,
      canEditSmsTemplate: metadata.canEditSmsTemplate,
      canExportData: metadata.canExportData,
      midYearOnboarding: metadata.midYearOnboarding ?? false,
    })
  }, [schoolQuery.data])

  useEffect(() => {
    if (!smsFeatureStatsQuery.data) return
    setSmsConfigDraft({
      commissionPct: String(smsFeatureStatsQuery.data.config.commission_pct),
      smsCapPerStudent: String(smsFeatureStatsQuery.data.config.sms_cap_per_student),
      monetizeParentAlerts: smsFeatureStatsQuery.data.config.monetize_parent_alerts,
      useRealHours: smsFeatureStatsQuery.data.config.use_real_hours,
      geoCheckEnabled: smsFeatureStatsQuery.data.config.geo_check_enabled,
    })
  }, [smsFeatureStatsQuery.data])

  useEffect(() => {
    const director = schoolUsersQuery.data?.director
    if (!director || isDirectorEditing) return
    setDirectorDraft({
      name: director.name,
      phone: director.phone ?? "",
      email: director.email ?? "",
    })
  }, [isDirectorEditing, schoolUsersQuery.data?.director])

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: () =>
      updateSchoolConfig(tenantId as string, {
        name: config.name.trim() || undefined,
        plan: config.plan,
        status: config.status,
        city: config.city,
        teaching_type: config.teachingType,
        student_label: config.studentLabel,
        director_title: config.directorTitle,
        active_school_year: config.activeSchoolYear.trim() || undefined,
        max_users: config.maxUsers,
        max_admin_positions: config.maxAdminPositions,
        max_sms_per_month: config.maxSmsPerMonth,
        can_edit_sms_template: config.canEditSmsTemplate,
        can_export_data: config.canExportData,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "schools"] })
      toast({ title: "Configuration mise à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la configuration", variant: "destructive" })
    },
  })

  const addPaymentMutation = useMutation({
    mutationFn: () =>
      addSchoolPayment(tenantId as string, {
        date: payment.date,
        amount_fcfa: Number(payment.amount),
        provider: payment.provider,
        reference: payment.reference || undefined,
        period_from: monthStartIso(payment.periodFrom),
        period_to: monthEndIso(payment.periodTo),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-payments", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "revenue", "summary"] })
      setPayment((prev) => ({ ...prev, amount: "", reference: "", periodFrom: "", periodTo: "" }))
      toast({ title: "Paiement enregistré" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le paiement", variant: "destructive" })
    },
  })

  const updateSubscriptionMutation = useMutation({
    mutationFn: (payload: { mrr_fcfa?: number; billing_cycle?: "monthly" | "annual" }) =>
      updateSchoolSubscription(tenantId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      toast({ title: "Souscription mise à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la souscription", variant: "destructive" })
    },
  })

  const updateDirectorMutation = useMutation({
    mutationFn: () => {
      const director = schoolUsersQuery.data?.director
      if (!director) {
        throw new Error("Aucun responsable école à modifier.")
      }

      return updateSchoolDirector(tenantId as string, director.id, {
        name: directorDraft.name.trim(),
        phone: directorDraft.phone.trim() || null,
        email: directorDraft.email.trim() || null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-users", tenantId] })
      setIsDirectorEditing(false)
      toast({ title: "Responsable école mis à jour" })
    },
    onError: (error) => {
      const description =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Impossible de mettre à jour le responsable école."
      toast({ title: "Erreur", description, variant: "destructive" })
    },
  })

  const paymentReminderMutation = useMutation({
    mutationFn: () => sendSchoolPaymentReminder(tenantId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      toast({ title: "Relance paiement SMS envoyée" })
    },
    onError: (error) => {
      const description =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Impossible d'envoyer la relance paiement."
      toast({ title: "Erreur", description, variant: "destructive" })
    },
  })

  const forceSmsTemplateResyncMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        resetTenantSmsTemplate(tenantId as string, "student_absent_parent"),
        resetTenantSmsTemplate(tenantId as string, "payment_reminder"),
      ])
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms", "templates"] })
      toast({ title: "Templates resynchronisés", description: "L'école utilise de nouveau la version globale." })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de forcer la resynchronisation.", variant: "destructive" })
    },
  })

  const activateSmsFeatureMutation = useMutation({
    mutationFn: (commissionPct: number) => activateSchoolSmsFeature(tenantId as string, { commission_pct: commissionPct }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-stats", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms-feature", "global-stats"] })
      toast({ title: "Feature SMS activée" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'activer la feature SMS.", variant: "destructive" })
    },
  })

  const deactivateSmsFeatureMutation = useMutation({
    mutationFn: () => deactivateSchoolSmsFeature(tenantId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-stats", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms-feature", "global-stats"] })
      toast({ title: "Feature SMS désactivée" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de désactiver la feature SMS.", variant: "destructive" })
    },
  })

  const updateSmsFeatureConfigMutation = useMutation({
    mutationFn: (payload: {
      commission_pct?: number
      sms_cap_per_student?: number
      monetizeParentAlerts?: boolean
      useRealHours?: boolean
      geoCheckEnabled?: boolean
    }) => updateSchoolSmsFeatureConfig(tenantId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-stats", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms-feature", "global-stats"] })
      toast({ title: "Configuration SMS mise à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la configuration SMS.", variant: "destructive" })
    },
  })

  const syncSmsCommissionMutation = useMutation({
    mutationFn: () => syncSchoolSmsCommission(tenantId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-stats", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms-feature", "global-stats"] })
      toast({ title: "Calculs commission synchronisés" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de synchroniser les calculs.", variant: "destructive" })
    },
  })

  const recordReversementMutation = useMutation({
    mutationFn: (payload: {
      period_month: string
      amount_fcfa: number
      payment_method?: "cash" | "momo_mtn" | "momo_orange" | "bank_transfer"
      notes?: string
      idempotency_key: string
    }) => recordSchoolCommissionReceived(tenantId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-stats", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-payments", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms-feature", "global-stats"] })
      closeReversementDialog()
      toast({ title: "Reversement enregistré" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer ce reversement.", variant: "destructive" })
    },
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isYearFormValid =
    openYearForm.label.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(openYearForm.startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(openYearForm.endDate) &&
    (openYearForm.reviewDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(openYearForm.reviewDate)) &&
    openYearForm.startDate < openYearForm.endDate &&
    (openYearForm.reviewDate === "" || openYearForm.reviewDate < openYearForm.endDate)

  const openYearMutation = useMutation({
    mutationFn: () =>
      openSchoolYear(tenantId as string, {
        label: openYearForm.label.trim(),
        start_date: openYearForm.startDate,
        end_date: openYearForm.endDate,
        period_type: openYearForm.periodType,
        ...(openYearForm.reviewDate ? { end_of_year_review_start_date: openYearForm.reviewDate } : {}),
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-year-status", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      setConfirmOpenYearOpen(false)
      setOpenYearForm({ label: "", startDate: "", endDate: "", reviewDate: "", periodType: "trimester" })
      toast({
        title: `Année ${result.label} ouverte`,
        description:
          result.closedPreviousLabel
            ? `L'année ${result.closedPreviousLabel} est passée à "closed".`
            : "Aucune année active précédente.",
      })
    },
    onError: (error) => {
      setConfirmOpenYearOpen(false)
      const description =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Impossible d'ouvrir la nouvelle année scolaire."
      toast({ title: "Erreur", description, variant: "destructive" })
    },
  })

  const openReversementDialog = (prefillMonth?: string) => {
    setReversementPeriodMonth(prefillMonth ?? reversementMonth)
    setReversementAmount("")
    setReversementMethod("cash")
    setReversementNotes("")
    setReversementOpen(true)
  }

  const closeReversementDialog = () => {
    setReversementOpen(false)
    setReversementPeriodMonth("")
    setReversementAmount("")
    setReversementMethod("cash")
    setReversementNotes("")
  }

  const submitReversement = () => {
    const amount = Number(reversementAmount)
    if (!reversementPeriodMonth || !Number.isFinite(amount) || amount <= 0) return
    recordReversementMutation.mutate({
      period_month: reversementPeriodMonth,
      amount_fcfa: amount,
      payment_method: reversementMethod,
      notes: reversementNotes.trim() || undefined,
      idempotency_key: crypto.randomUUID(),
    })
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!user) return <Navigate to="/" replace />

  if (user.role !== "super_admin") {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
        </Alert>
      </div>
    )
  }

  // ── Données dérivées ──────────────────────────────────────────────────────
  const school: SchoolDetailsResponse | undefined = schoolQuery.data
  const trimmedSchoolYear = config.activeSchoolYear.trim()
  const isConfigValid =
    config.name.trim().length >= 2 &&
    (trimmedSchoolYear === "" || SCHOOL_YEAR_REGEX.test(trimmedSchoolYear))

  const canSubmitPayment =
    Number(payment.amount) > 0 &&
    payment.date.length > 0 &&
    payment.periodFrom.length > 0 &&
    payment.periodTo.length > 0 &&
    payment.periodFrom <= payment.periodTo

  const directorPhone = directorDraft.phone.trim()
  const directorEmail = directorDraft.email.trim()
  const isDirectorFormValid =
    directorDraft.name.trim().length >= 2 &&
    (directorPhone.length === 0 || PHONE_CI_REGEX.test(directorPhone)) &&
    (directorEmail.length > 0 || directorPhone.length > 0)

  // ── Calendrier de paiement année scolaire ────────────────────────────────
  // Calcul global (utilisé dans le header, les badges, et le tab abonnement)
  const billingCalendar = (() => {
    if (!school) return { months: [], overdueCount: 0, totalUnpaidFcfa: 0, effectiveMrr: 0, syParsed: null, rawSY: null }
    const rawSY = school.metadata.activeSchoolYear
    const syParsed = rawSY && /^\d{2}\/\d{4} - \d{2}\/\d{4}$/.test(rawSY)
      ? (() => {
          const [startPart, endPart] = rawSY.split(" - ")
          const [sm, sy] = startPart!.split("/").map(Number)
          const [em, ey] = endPart!.split("/").map(Number)
          return { start: new Date(sy!, sm! - 1, 1), end: new Date(ey!, em!, 0), totalMonths: (ey! - sy!) * 12 + (em! - sm!) + 1 }
        })()
      : (() => {
          const n = new Date()
          const start = n.getMonth() >= 8 ? new Date(n.getFullYear(), 8, 1) : new Date(n.getFullYear() - 1, 8, 1)
          return { start, end: new Date(start.getFullYear() + 1, 6, 0), totalMonths: 10 }
        })()

    const effectiveMrr = school.usageStats.mrrFcfa > 0 ? school.usageStats.mrrFcfa : school.usageStats.planMonthlyPriceFcfa
    const payments = paymentsQuery.data ?? []
    const now = new Date()

    const months: Array<{
      ym: string
      monthStart: Date
      monthEnd: Date
      isPast: boolean
      isCurrent: boolean
      isFuture: boolean
      due: number
      covered: number
      remaining: number
      status: "paid" | "partial" | "unpaid" | "future" | "no-mrr"
    }> = Array.from({ length: syParsed.totalMonths }, (_, i) => {
      const monthStart = new Date(syParsed.start.getFullYear(), syParsed.start.getMonth() + i, 1)
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
      const ym = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`
      const isPast = monthEnd < now
      const isCurrent = monthStart <= now && now <= monthEnd
      const isFuture = monthStart > now

      const due = effectiveMrr
      const covered = 0
      const remaining = due
      let status: "paid" | "partial" | "unpaid" | "future" | "no-mrr"
      if (effectiveMrr === 0) status = "no-mrr"
      else if (isFuture) status = "future"
      else status = "unpaid"

      return { ym, monthStart, monthEnd, isPast, isCurrent, isFuture, due, covered, remaining, status }
    })

    const monthByKey = new Map(months.map((month) => [month.ym, month]))
    payments
      .filter((paymentItem) => paymentItem.status === "success" && paymentItem.periodFrom && paymentItem.periodTo)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((paymentItem) => {
        const startMonth = dateToMonthKey(paymentItem.periodFrom)
        const endMonth = dateToMonthKey(paymentItem.periodTo)
        if (!startMonth || !endMonth || startMonth > endMonth) return

        let amountLeft = paymentItem.amountFcfa
        let cursor = startMonth
        while (cursor <= endMonth && amountLeft > 0) {
          const month = monthByKey.get(cursor)
          if (month && month.due > 0) {
            const missing = Math.max(0, month.due - month.covered)
            const allocated = Math.min(missing, amountLeft)
            month.covered += allocated
            month.remaining = Math.max(0, month.due - month.covered)
            amountLeft -= allocated

            if (month.isFuture) {
              month.status = "future"
            } else if (month.covered >= month.due) {
              month.status = "paid"
            } else if (month.covered > 0) {
              month.status = "partial"
            } else {
              month.status = "unpaid"
            }
          }
          cursor = nextMonth(cursor)
        }
      })

    const overdueMonthsCalc = months.filter((m) => (m.isPast || m.isCurrent) && (m.status === "unpaid" || m.status === "partial"))
    const totalUnpaidFcfa = overdueMonthsCalc.reduce((s, m) => s + m.remaining, 0)

    return { months, overdueCount: overdueMonthsCalc.length, totalUnpaidFcfa, syParsed, effectiveMrr, rawSY }
  })()

  const isPaymentOverdue = billingCalendar.overdueCount > 0

  const remainingMonthsToSettle = billingCalendar.months.filter(
    (m) => !m.isFuture && m.status !== "paid" && m.status !== "no-mrr"
  )
  const remainingMonthOptions = remainingMonthsToSettle.map((m) => m.ym)
  const paymentEndOptions = payment.periodFrom
    ? remainingMonthOptions.filter((ym) => ym >= payment.periodFrom)
    : remainingMonthOptions

  const activeUsersRatePct =
    school && school.usageStats.nbUsers > 0
      ? Math.min(100, Math.max(0, Math.round((school.usageStats.activeUsers7d / school.usageStats.nbUsers) * 100)))
      : 0
  const studentsPerTeacher =
    school && school.usageStats.teachersCount > 0
      ? Number((school.usageStats.studentsCount / school.usageStats.teachersCount).toFixed(1))
      : 0
  const dataQualityAlerts = school
    ? [
        school.usageStats.activeUsers7d > school.usageStats.nbUsers
          ? "Incohérence: actifs 7j > utilisateurs totaux."
          : null,
        school.usageStats.remainingCurrentPeriodFcfa > school.usageStats.mrrFcfa
          ? "Incohérence: reste à verser > montant attendu."
          : null,
      ].filter((item): item is string => item !== null)
    : []

  // Historique SMS - données dérivées
  const currentMonthData = smsFeatureStatsQuery.data?.current_month
  const historyData = smsFeatureStatsQuery.data?.history ?? []
  const currentYM = new Date().toISOString().slice(0, 7)

  // Mois en retard = mois passés avec commission_remaining_fcfa > 0
  const overdueMonths = historyData.filter(
    (row) => row.month < currentYM && row.commission_remaining_fcfa > 0
  )
  // Historique filtré : ne montrer que les mois avec activité réelle (évite le bruit des mois à 0)
  const historyWithActivity = historyData.filter(
    (row) => row.total_collected_fcfa > 0 || row.commission_paid_fcfa > 0 || row.commission_remaining_fcfa > 0
  )

  const isCurrentMonthInHeader = revenueMonth === currentYM
  const revenueRowForMonth = historyData.find((row) => row.month === revenueMonth)
  const revenueDisplayData = isCurrentMonthInHeader ? currentMonthData : revenueRowForMonth

  const isNextMonthDisabled = revenueMonth >= currentYM

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <OfflineIndicator />

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-2 px-0" onClick={() => navigate("/admin/schools")}>
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{school?.metadata.name ?? "Détail école"}</h1>
          <p className="text-sm text-muted-foreground">{school?.metadata.subdomain}.edutrack.ci</p>
        </div>
        {school ? (
          <div className="flex items-center gap-2">
            {isPaymentOverdue && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {billingCalendar.overdueCount} mois non soldé{billingCalendar.overdueCount > 1 ? "s" : ""}
              </Badge>
            )}
            {overdueMonths.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueMonths.length} reversement{overdueMonths.length > 1 ? "s" : ""} en retard
              </Badge>
            )}
            <Badge>{school.metadata.status}</Badge>
          </div>
        ) : null}
      </div>

      <OfflineDisabledFieldset>
        {schoolQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>Impossible de charger cette école.</AlertDescription>
          </Alert>
        ) : null}

        {school ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="flex h-auto flex-wrap">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="users">Utilisateurs</TabsTrigger>
              <TabsTrigger value="school-year">Cycle scolaire</TabsTrigger>
              {config.midYearOnboarding ? (
                <TabsTrigger value="import-midyear">Reprise de données</TabsTrigger>
              ) : null}
              <TabsTrigger value="abonnement">Facturation</TabsTrigger>
              <TabsTrigger value="sms-revenus">
                SMS
                {overdueMonths.length > 0 && (
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                    {overdueMonths.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="stats">Statistiques</TabsTrigger>
            </TabsList>

            {/* ══════════════════════════════════════════════════
                ONGLET 1 - CONFIGURATION
            ══════════════════════════════════════════════════ */}
            <TabsContent value="config" className="space-y-5">

              {/* Identité & statut commercial */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Identité & statut</CardTitle>
                  <CardDescription>Informations de l&apos;établissement, plan et statut commercial.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nom de l&apos;établissement</Label>
                    <Input value={config.name} onChange={(e) => setConfig((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ville</Label>
                    <Input value={config.city} onChange={(e) => setConfig((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Année scolaire active</Label>
                    <Input
                      placeholder="09/2025 - 06/2026"
                      value={config.activeSchoolYear}
                      onChange={(e) => setConfig((p) => ({ ...p, activeSchoolYear: e.target.value }))}
                    />
                    {config.activeSchoolYear.trim() && !SCHOOL_YEAR_REGEX.test(config.activeSchoolYear.trim()) ? (
                      <p className="text-xs text-destructive">Format attendu : MM/YYYY - MM/YYYY</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Type d&apos;établissement</Label>
                    <Select value={config.teachingType} onValueChange={(v) => setConfig((p) => ({ ...p, teachingType: v as TeachingType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TEACHING_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Terme apprenants</Label>
                    <Input value={config.studentLabel} onChange={(e) => setConfig((p) => ({ ...p, studentLabel: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Titre responsable</Label>
                    <Input value={config.directorTitle} onChange={(e) => setConfig((p) => ({ ...p, directorTitle: e.target.value }))} />
                  </div>

                  <div className="md:col-span-2">
                    <Separator className="my-1" />
                  </div>

                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={config.plan} onValueChange={(v) => setConfig((p) => ({ ...p, plan: v as TenantPlan }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PLAN_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select value={config.status} onValueChange={(v) => setConfig((p) => ({ ...p, status: v as TenantStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Reprise de données</CardTitle>
                  <CardDescription>
                    Activez ce flux lorsqu&apos;une école créée en cours d&apos;année doit reprendre ses données existantes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-3">
                  <Checkbox
                    id="midyear-onboarding"
                    checked={config.midYearOnboarding}
                    disabled={midYearMutation.isPending}
                    onCheckedChange={(checked) => midYearMutation.mutate(Boolean(checked))}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="midyear-onboarding">Activer l&apos;import prise en main</Label>
                    <p className="text-xs text-muted-foreground">
                      Rend l&apos;onglet d&apos;import disponible pour les niveaux, matières, salles, classes, élèves et situation financière initiale.
                    </p>
                    {midYearMutation.isPending ? <p className="text-xs text-muted-foreground">Mise à jour en cours...</p> : null}
                  </div>
                </CardContent>
              </Card>

              {/* Limites & quotas */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Limites & quotas</CardTitle>
                  <CardDescription>
                    Plafonds appliqués à cet établissement. Initialisés depuis le plan à la création -
                    modifiables ici individuellement sans changer le plan. C&apos;est ce quota
                    qui bloque réellement la création d&apos;utilisateurs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Jauges : professeurs vs quota profs, staff vs quota admin */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      {
                        label: "Professeurs",
                        hint: "Quota : max_users",
                        current: schoolUsersQuery.data?.teachers.length ?? school.usageStats.teachersCount,
                        max: config.maxUsers,
                      },
                      {
                        label: "Staff admin",
                        hint: "Quota : max_admin_positions",
                        current: schoolUsersQuery.data?.staff.length ?? 0,
                        max: config.maxAdminPositions,
                      },
                    ] as const).map(({ label, hint, current, max }) => {
                      const pct = max > 0 ? Math.round((current / max) * 100) : 0
                      const isAtLimit = current >= max
                      const isNearLimit = pct >= 80 && !isAtLimit
                      return (
                        <div
                          key={label}
                          className={`rounded-lg border p-3 text-sm ${isAtLimit ? "border-destructive bg-destructive/5" : isNearLimit ? "border-amber-300 bg-amber-50" : "bg-muted/30"}`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground/60">{hint}</p>
                          </div>
                          <p className={`font-semibold ${isAtLimit ? "text-destructive" : ""}`}>
                            {current} / {max}
                            {isAtLimit && <span className="ml-2 text-xs font-normal">⚠ Limite atteinte</span>}
                            {isNearLimit && <span className="ml-2 text-xs font-normal text-amber-900">Proche de la limite</span>}
                          </p>
                          <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                            <div
                              className={`h-1.5 rounded-full transition-all ${isAtLimit ? "bg-destructive" : isNearLimit ? "bg-amber-400" : "bg-primary"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Champs d'édition alignés sur les jauges */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Profs max</Label>
                      <Input
                        type="number" min={1} max={500}
                        value={config.maxUsers}
                        onChange={(e) => setConfig((p) => ({ ...p, maxUsers: clampInt(e.target.value, 1, 500, p.maxUsers) }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Bloque la création de nouveaux professeurs quand atteint.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Staff admin max</Label>
                      <Input
                        type="number" min={1} max={50}
                        value={config.maxAdminPositions}
                        onChange={(e) => setConfig((p) => ({ ...p, maxAdminPositions: clampInt(e.target.value, 1, 50, p.maxAdminPositions) }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Bloque la création de comptes secrétariat / staff quand atteint.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>SMS / mois max</Label>
                      <Input
                        type="number" min={0} max={200000}
                        value={config.maxSmsPerMonth}
                        onChange={(e) => setConfig((p) => ({ ...p, maxSmsPerMonth: clampInt(e.target.value, 0, 200000, p.maxSmsPerMonth) }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        0 = illimité. Limite l&apos;envoi de SMS par mois.
                      </p>
                    </div>
                    <div className="flex items-start gap-3 pt-6">
                      <Checkbox
                        id="can-export-data"
                        checked={config.canExportData}
                        onCheckedChange={(checked) => setConfig((p) => ({ ...p, canExportData: Boolean(checked) }))}
                      />
                      <div>
                        <Label htmlFor="can-export-data">Export des données autorisé</Label>
                        <p className="text-xs text-muted-foreground">
                          L&apos;école peut exporter élèves, profs, notes, etc.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Ces quotas sont indépendants du plan - changer de plan ne les met pas à jour automatiquement.
                  </p>
                </CardContent>
              </Card>

              {/* Permissions SMS templates */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Permissions SMS</CardTitle>
                  <CardDescription>
                    Contrôle de la personnalisation des templates SMS côté établissement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="can-edit-template"
                      checked={config.canEditSmsTemplate}
                      onCheckedChange={(checked) => setConfig((p) => ({ ...p, canEditSmsTemplate: Boolean(checked) }))}
                    />
                    <Label htmlFor="can-edit-template">Autoriser la personnalisation des templates SMS</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Les templates globaux (absence élève, relance paiement) sont définis dans{" "}
                    <strong>SMS &amp; Notifs</strong>. Cette option autorise uniquement la personnalisation locale de
                    l&apos;école.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => forceSmsTemplateResyncMutation.mutate()}
                      disabled={forceSmsTemplateResyncMutation.isPending}
                    >
                      {forceSmsTemplateResyncMutation.isPending ? "Resynchronisation..." : "Forcer resynchronisation templates"}
                    </Button>
                    <Button type="button" variant="ghost" className="px-0" onClick={() => navigate("/admin/sms")}>
                      Ouvrir Revenus SMS →
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Bouton global de sauvegarde config */}
              <div className="flex justify-end">
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !isConfigValid}
                  className="min-w-40"
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer la configuration"}
                </Button>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════════════════
                ONGLET 2 - UTILISATEURS
            ══════════════════════════════════════════════════ */}
            <TabsContent value="users" className="space-y-4">
              {schoolUsersQuery.isLoading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <Skeleton className="h-24 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                </div>
              ) : null}

              {createdDirectorCredentials ? (
                <Alert>
                  <AlertDescription className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">Accès responsable créé</p>
                    <p>Nom: <strong>{createdDirectorCredentials.name}</strong></p>
                    <p>Téléphone: <strong>{createdDirectorCredentials.phone}</strong></p>
                    <p>Email: <strong>{createdDirectorCredentials.email ?? "-"}</strong></p>
                    <p>Mot de passe: <strong>{createdDirectorCredentials.password}</strong></p>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Responsable école</CardDescription>
                    <CardTitle>{schoolUsersQuery.data?.director?.name ?? "-"}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {credentialLabel(schoolUsersQuery.data?.director?.phone ?? null, schoolUsersQuery.data?.director?.email ?? null)}
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Staff admin</CardDescription>
                    <CardTitle>{schoolUsersQuery.data?.staff.length ?? 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">Comptes secrétariat / administratif</CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Professeurs</CardDescription>
                    <CardTitle>{schoolUsersQuery.data?.teachers.length ?? 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">Comptes enseignants</CardContent>
                </Card>
              </div>

              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      Responsable école
                    </CardTitle>
                    {schoolUsersQuery.data?.director && !isDirectorEditing ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setIsDirectorEditing(true)}
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!schoolUsersQuery.data?.director ? (
                    <p className="text-muted-foreground">Aucun responsable école trouvé.</p>
                  ) : isDirectorEditing ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="director-name">Nom complet</Label>
                          <Input
                            id="director-name"
                            value={directorDraft.name}
                            onChange={(event) => setDirectorDraft((prev) => ({ ...prev, name: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="director-phone">Téléphone</Label>
                          <Input
                            id="director-phone"
                            value={directorDraft.phone}
                            onChange={(event) =>
                              setDirectorDraft((prev) => ({
                                ...prev,
                                phone: event.target.value.replace(/\D/g, "").slice(0, 13),
                              }))
                            }
                            inputMode="tel"
                            maxLength={13}
                            placeholder="2250700000000"
                          />
                          {directorPhone.length > 0 && !PHONE_CI_REGEX.test(directorPhone) ? (
                            <p className="text-xs text-destructive">Format attendu: 225XXXXXXXXXX.</p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="director-email">Email</Label>
                          <Input
                            id="director-email"
                            type="email"
                            value={directorDraft.email}
                            onChange={(event) => setDirectorDraft((prev) => ({ ...prev, email: event.target.value }))}
                            placeholder="responsable@ecole.ci"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          className="gap-2"
                          disabled={updateDirectorMutation.isPending || !isDirectorFormValid}
                          onClick={() => updateDirectorMutation.mutate()}
                        >
                          <Save className="h-4 w-4" />
                          {updateDirectorMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          disabled={updateDirectorMutation.isPending}
                          onClick={() => {
                            const director = schoolUsersQuery.data?.director
                            setDirectorDraft({
                              name: director?.name ?? "",
                              phone: director?.phone ?? "",
                              email: director?.email ?? "",
                            })
                            setIsDirectorEditing(false)
                          }}
                        >
                          <X className="h-4 w-4" />
                          Annuler
                        </Button>
                        {!isDirectorFormValid ? (
                          <p className="text-xs text-muted-foreground">Nom et au moins un contact valide sont requis.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>Nom: <strong>{schoolUsersQuery.data.director.name}</strong></p>
                      <p>Téléphone: <strong>{schoolUsersQuery.data.director.phone ?? "-"}</strong></p>
                      <p>Email: <strong>{schoolUsersQuery.data.director.email ?? "-"}</strong></p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Staff administratif</CardTitle>
                  <CardDescription>Comptes secrétariat avec identifiants de connexion.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Postes</TableHead>
                          <TableHead>Identifiant</TableHead>
                          <TableHead>Dernière connexion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(schoolUsersQuery.data?.staff ?? []).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.role}</TableCell>
                            <TableCell>{item.positions.length > 0 ? item.positions.join(", ") : "-"}</TableCell>
                            <TableCell>{credentialLabel(item.phone, item.email)}</TableCell>
                            <TableCell>{formatDateTime(item.lastLoginAt)}</TableCell>
                          </TableRow>
                        ))}
                        {!schoolUsersQuery.isLoading && (schoolUsersQuery.data?.staff ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-sm text-muted-foreground">Aucun utilisateur staff.</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Professeurs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Dernière connexion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(schoolUsersQuery.data?.teachers ?? []).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.username ?? "-"}</TableCell>
                            <TableCell>{item.phone ?? "-"}</TableCell>
                            <TableCell>{formatDateTime(item.lastLoginAt)}</TableCell>
                          </TableRow>
                        ))}
                        {!schoolUsersQuery.isLoading && (schoolUsersQuery.data?.teachers ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-sm text-muted-foreground">Aucun professeur.</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ══════════════════════════════════════════════════
                ONGLET 3bis - ANNÉE SCOLAIRE (action super admin)
            ══════════════════════════════════════════════════ */}
            <TabsContent value="school-year" className="space-y-5">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Année scolaire active
                  </CardTitle>
                  <CardDescription>
                    Seul IvoirEdu peut basculer l&apos;école sur une nouvelle année. Le responsable école
                    configure la revue de fin d&apos;année et les décisions de passage, mais ne peut pas ouvrir
                    une nouvelle année.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {schoolYearQuery.isLoading ? (
                    <Skeleton className="h-16 w-full rounded-lg" />
                  ) : schoolYearQuery.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>Impossible de charger l&apos;année scolaire.</AlertDescription>
                    </Alert>
                  ) : schoolYearQuery.data?.hasActiveYear ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-40 space-y-1">
                        <p className="text-xs text-muted-foreground">Libellé</p>
                        <p className="font-semibold">{schoolYearQuery.data.activeYear?.label}</p>
                      </div>
                      <div className="min-w-40 space-y-1">
                        <p className="text-xs text-muted-foreground">Période</p>
                        <p className="text-sm">
                          {formatDate(schoolYearQuery.data.activeYear?.startDate ?? "")} →{" "}
                          {formatDate(schoolYearQuery.data.activeYear?.endDate ?? "")}
                        </p>
                      </div>
                      {schoolYearQuery.data.activeYear?.endOfYearReviewStartDate ? (
                        <div className="min-w-40 space-y-1">
                          <p className="text-xs text-muted-foreground">Revue de fin d&apos;année</p>
                          <p className="text-sm">{formatDate(schoolYearQuery.data.activeYear.endOfYearReviewStartDate)}</p>
                        </div>
                      ) : null}
                      <div className="min-w-40 space-y-1">
                        <p className="text-xs text-muted-foreground">Cycle d&apos;évaluation</p>
                        <p className="text-sm">{schoolYearQuery.data.activeYear?.gradingPeriodType === "semester" ? "2 semestres" : "3 trimestres"}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          schoolYearQuery.data.isEndOfYearWindowOpen
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }
                      >
                        {schoolYearQuery.data.isEndOfYearWindowOpen
                          ? "Fenêtre de fin d'année ouverte"
                          : "Fenêtre de fin d'année fermée"}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune année scolaire active pour cette école.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Ouvrir la nouvelle année scolaire</CardTitle>
                  <CardDescription>
                    Action à fort impact : la nouvelle année devient active et l&apos;année active actuelle passe
                    définitivement au statut &laquo;&nbsp;closé&nbsp;&raquo;.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="open-year-label">Libellé</Label>
                      <Input
                        id="open-year-label"
                        placeholder="2026-2027"
                        maxLength={25}
                        value={openYearForm.label}
                        onChange={(e) => setOpenYearForm((p) => ({ ...p, label: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open-year-start">Date de début</Label>
                      <Input
                        id="open-year-start"
                        type="date"
                        value={openYearForm.startDate}
                        onChange={(e) => setOpenYearForm((p) => ({ ...p, startDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open-year-end">Date de fin</Label>
                      <Input
                        id="open-year-end"
                        type="date"
                        value={openYearForm.endDate}
                        onChange={(e) => setOpenYearForm((p) => ({ ...p, endDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open-year-period-type">Cycle d&apos;évaluation</Label>
                      <Select value={openYearForm.periodType} onValueChange={(value: "trimester" | "semester") => setOpenYearForm((p) => ({ ...p, periodType: value }))}>
                        <SelectTrigger id="open-year-period-type" className="min-h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trimester">Trimestres (3 périodes)</SelectItem>
                          <SelectItem value="semester">Semestres (2 périodes)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Les périodes sont créées automatiquement. Le passage à la suivante dépend de la génération complète des bulletins, pas d&apos;une date.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open-year-review">Début revue de fin d&apos;année</Label>
                      <Input
                        id="open-year-review"
                        type="date"
                        value={openYearForm.reviewDate}
                        onChange={(e) => setOpenYearForm((p) => ({ ...p, reviewDate: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Vide = 30 jours avant la date de fin.</p>
                    </div>
                  </div>
                  {!isYearFormValid ? (
                    <p className="text-xs text-muted-foreground">
                      Libellé requis, début strictement antérieure à la fin, revue avant la fin si renseignée.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    disabled={!isYearFormValid || openYearMutation.isPending}
                    onClick={() => setConfirmOpenYearOpen(true)}
                  >
                    {openYearMutation.isPending ? "Ouverture..." : "Ouvrir la nouvelle année scolaire"}
                  </Button>
                </CardContent>
              </Card>

              <AlertDialog open={confirmOpenYearOpen} onOpenChange={setConfirmOpenYearOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer l&apos;ouverture de l&apos;année ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      L&apos;année {openYearForm.label || "saisie"} deviendra active immédiatement.
                      {schoolYearQuery.data?.activeYear
                        ? ` L'année ${schoolYearQuery.data.activeYear.label} passera à "closed" et ne pourra plus être utilisée pour les pointages.`
                        : ""}{" "}
                      Cette opération est difficilement réversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => openYearMutation.mutate()}
                      disabled={openYearMutation.isPending}
                    >
                      {openYearMutation.isPending ? "Ouverture..." : "Confirmer l'ouverture"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>

            {/* ══════════════════════════════════════════════════
                ONGLET - IMPORT PRISE EN MAIN (8a, conditionnel)
            ══════════════════════════════════════════════════ */}
            {config.midYearOnboarding ? (
              <TabsContent value="import-midyear" className="space-y-5">
                <MidyearImportPanel tenantId={tenantId as string} />
              </TabsContent>
            ) : null}

            {/* ══════════════════════════════════════════════════
                ONGLET 3 - ABONNEMENT & FACTURATION
            ══════════════════════════════════════════════════ */}
            <TabsContent value="abonnement" className="space-y-5">
              {(() => {
                const stats = school.usageStats
                const payments = paymentsQuery.data ?? []
                const { months, overdueCount, totalUnpaidFcfa, syParsed, effectiveMrr, rawSY } = billingCalendar
                const mrrConfigured = stats.mrrFcfa > 0
                const mrrIsFromPlan = stats.mrrFcfa === 0 && stats.planMonthlyPriceFcfa > 0
                const syLabel = rawSY ?? (syParsed ? `09/${syParsed.start.getFullYear()} - 06/${syParsed.end.getFullYear()}` : "")
                const syFullYear = effectiveMrr > 0 ? effectiveMrr * (syParsed?.totalMonths ?? 10) : 0
                const syPaid = months.reduce((s, m) => s + m.covered, 0)
                const elapsed = months.filter((m) => m.isPast || m.isCurrent).length
                const syExpected = effectiveMrr * elapsed
                const syPct = syExpected > 0 ? Math.min(100, Math.round((syPaid / syExpected) * 100)) : 0

                const statusBadge = (s: string) => {
                  if (s === "paid")    return <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium">Payé</span>
                  if (s === "partial") return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 text-xs px-2 py-0.5 font-medium">Non soldé</span>
                  if (s === "unpaid")  return <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium">Impayé</span>
                  if (s === "future")  return <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5 font-medium">À venir</span>
                  return <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5 font-medium">-</span>
                }

                const providerLabel = (p: string) => {
                  if (p === "mtn_momo") return "MTN MoMo"
                  if (p === "orange_money") return "Orange Money"
                  if (p === "manual") return "Manuel"
                  return p
                }

                return (
                  <>
                    {/* Alerte retard */}
                    {overdueCount > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{overdueCount} mois non soldé{overdueCount > 1 ? "s" : ""}</strong> - {formatFcfa(totalUnpaidFcfa)} restent dus
                          sur les mensualités passées. Voir le calendrier ci-dessous.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* A - Souscription + config MRR */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Souscription</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <p className="text-xs text-muted-foreground">Plan actif</p>
                            <p className="font-semibold capitalize">{school.metadata.plan}</p>
                            {stats.planMonthlyPriceFcfa > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Tarif plan : {formatFcfa(stats.planMonthlyPriceFcfa)}/mois
                              </p>
                            )}
                          </div>
                          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <p className="text-xs text-muted-foreground">Cycle</p>
                            <p className="font-semibold">
                              {stats.billingCycle === "annual" ? "Annuel" : stats.billingCycle === "monthly" ? "Mensuel" : "Non défini"}
                            </p>
                          </div>
                          <div className={`rounded-lg border p-3 text-sm ${!mrrConfigured ? "border-amber-300 bg-amber-50" : "bg-muted/30"}`}>
                            <p className="text-xs text-muted-foreground">Mensualité facturée (MRR)</p>
                            {mrrConfigured ? (
                              <p className="font-semibold">{formatFcfa(stats.mrrFcfa)}</p>
                            ) : mrrIsFromPlan ? (
                              <>
                                <p className="font-semibold text-amber-900">{formatFcfa(stats.planMonthlyPriceFcfa)}</p>
                                <p className="text-xs text-amber-600 mt-0.5">Estimé depuis le plan - à confirmer</p>
                              </>
                            ) : (
                              <p className="font-semibold text-muted-foreground">Non configuré</p>
                            )}
                          </div>
                          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <p className="text-xs text-muted-foreground">Souscription débutée</p>
                            <p className="font-semibold">{formatDate(stats.subscriptionStartedAt)}</p>
                          </div>
                        </div>

                        {/* Formulaire inline config MRR */}
                        <div className="rounded-lg border border-dashed p-4 space-y-3">
                          <p className="text-sm font-medium">
                            {mrrConfigured ? "Modifier la mensualité facturée" : "Configurer la mensualité facturée"}
                          </p>
                          {!mrrConfigured && (
                            <p className="text-xs text-muted-foreground">
                              Le MRR peut différer du tarif catalogue si un tarif négocié a été appliqué.
                              Il sert au calcul de chaque mensualité dans le calendrier ci-dessous.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 items-end">
                            <div className="space-y-1 flex-1 min-w-[140px]">
                              <Label className="text-xs">Mensualité (FCFA)</Label>
                              <Input
                                type="number" min={0}
                                placeholder={stats.planMonthlyPriceFcfa > 0 ? String(stats.planMonthlyPriceFcfa) : "Ex: 50 000"}
                                value={mrrDraft.mrr}
                                onChange={(e) => setMrrDraft((d) => ({ ...d, mrr: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cycle</Label>
                              <Select value={mrrDraft.cycle} onValueChange={(v) => setMrrDraft((d) => ({ ...d, cycle: v as "monthly" | "annual" }))}>
                                <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Mensuel</SelectItem>
                                  <SelectItem value="annual">Annuel</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {!mrrConfigured && stats.planMonthlyPriceFcfa > 0 && (
                              <Button variant="outline" size="sm" className="h-8 text-xs"
                                onClick={() => setMrrDraft((d) => ({ ...d, mrr: String(stats.planMonthlyPriceFcfa) }))}>
                                Utiliser tarif plan
                              </Button>
                            )}
                            <Button size="sm" className="h-8 text-sm"
                              disabled={updateSubscriptionMutation.isPending || mrrDraft.mrr === ""}
                              onClick={() => updateSubscriptionMutation.mutate({ mrr_fcfa: Number(mrrDraft.mrr), billing_cycle: mrrDraft.cycle })}>
                              {updateSubscriptionMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* B - Résumé année + calendrier mois par mois */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Calendrier de paiement - {syLabel}</CardTitle>
                        <CardDescription>
                          {syParsed?.totalMonths ?? 10} mensualités × {effectiveMrr > 0 ? formatFcfa(effectiveMrr) : "-"} ={" "}
                          <strong>{effectiveMrr > 0 ? formatFcfa(syFullYear) : "-"} sur l&apos;année.</strong>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Un mois n&apos;est marqué comme « Payé » que si son montant attendu est entièrement couvert. Les paiements partiels restent non soldés.
                          </p>
                          {mrrIsFromPlan && <span className="text-amber-600"> (estimé depuis le plan)</span>}
                          {!rawSY && (
                            <span className="block mt-1 text-amber-600 text-xs">
                              Année scolaire non renseignée - bornes estimées. Renseignez-la dans l&apos;onglet Configuration.
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* KPIs synthèse */}
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <p className="text-xs text-muted-foreground">Attendu à ce jour</p>
                            <p className="font-semibold">{effectiveMrr > 0 ? formatFcfa(syExpected) : "-"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{elapsed} mois × {effectiveMrr > 0 ? formatFcfa(effectiveMrr) : "-"}</p>
                          </div>
                          <div className="rounded-lg border bg-green-50 border-green-200 p-3 text-sm">
                            <p className="text-xs text-muted-foreground">Imputé (via périodes)</p>
                            <p className="font-semibold text-green-700">{formatFcfa(syPaid)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{syPct}% réglé</p>
                          </div>
                          <div className={`rounded-lg border p-3 text-sm ${totalUnpaidFcfa > 0 ? "border-red-300 bg-red-50" : "bg-muted/30"}`}>
                            <p className="text-xs text-muted-foreground">Restant dû (mois passés)</p>
                            <p className={`font-semibold ${totalUnpaidFcfa > 0 ? "text-red-700" : "text-green-700"}`}>
                              {effectiveMrr > 0 ? (totalUnpaidFcfa === 0 ? "À jour ✓" : formatFcfa(totalUnpaidFcfa)) : "-"}
                            </p>
                            {overdueCount > 0 && (
                              <p className="text-xs text-red-600 mt-0.5">{overdueCount} mois impayé{overdueCount > 1 ? "s" : ""}</p>
                            )}
                          </div>
                        </div>

                        {effectiveMrr > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progression</span><span>{syPct}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div className={`h-2 rounded-full transition-all ${syPct >= 100 ? "bg-green-500" : syPct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                                style={{ width: `${syPct}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Tableau mois par mois */}
                        {months.length > 0 && (
                          <div className="overflow-x-auto rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Mois</TableHead>
                                  <TableHead className="text-right">Attendu</TableHead>
                                  <TableHead className="text-right">Imputé</TableHead>
                                  <TableHead className="text-right">Reste</TableHead>
                                  <TableHead>Statut</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {months.map((m) => (
                                  <TableRow key={m.ym} className={m.isCurrent ? "bg-blue-50/50" : ""}>
                                    <TableCell className="whitespace-nowrap text-sm font-medium">
                                      {m.monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                                      {m.isCurrent && <span className="ml-1.5 text-xs text-blue-600 font-normal">(en cours)</span>}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {effectiveMrr > 0 ? formatFcfa(m.due) : "-"}
                                    </TableCell>
                                    <TableCell className={`text-right text-sm font-medium ${m.covered > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                                      {m.covered > 0 ? formatFcfa(m.covered) : m.isFuture ? "-" : "0 FCFA"}
                                    </TableCell>
                                    <TableCell className={`text-right text-sm ${m.remaining > 0 && !m.isFuture ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                      {m.isFuture ? "-" : m.remaining > 0 ? formatFcfa(m.remaining) : "-"}
                                    </TableCell>
                                    <TableCell>{statusBadge(m.status)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* C - Enregistrer un paiement */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Enregistrer un paiement</CardTitle>
                        <CardDescription>
                          La période couverte est obligatoire et se saisit en mois. Le montant couvre les mois
                          entiers dans l'ordre ; un mois partiellement couvert reste non soldé.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Date de paiement</Label>
                            <Input type="date" value={payment.date}
                              onChange={(e) => setPayment((p) => ({ ...p, date: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>
                              Montant (FCFA)
                              {effectiveMrr > 0 && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  {mrrIsFromPlan ? "Tarif plan" : "MRR"} : {formatFcfa(effectiveMrr)}
                                </span>
                              )}
                            </Label>
                            <Input type="number" min={1}
                              placeholder={effectiveMrr > 0 ? String(effectiveMrr) : "Ex: 50 000"}
                              value={payment.amount}
                              onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Moyen de paiement</Label>
                            <Select value={payment.provider}
                              onValueChange={(v) => setPayment((p) => ({ ...p, provider: v as typeof payment.provider }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PAYMENT_PROVIDERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Référence transaction</Label>
                            <Input placeholder="Optionnel" value={payment.reference}
                              onChange={(e) => setPayment((p) => ({ ...p, reference: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Mois couvert - début <span className="text-destructive">*</span></Label>
                            {remainingMonthOptions.length > 0 ? (
                              <Select value={payment.periodFrom}
                                onValueChange={(value) => setPayment((p) => ({
                                  ...p,
                                  periodFrom: value,
                                  periodTo: value > p.periodTo ? "" : p.periodTo,
                                }))}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {remainingMonthOptions.map((ym) => (
                                    <SelectItem key={ym} value={ym}>{monthLabel(ym)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="rounded-md border border-muted/50 bg-muted/10 p-3 text-sm text-muted-foreground">
                                Aucun mois restant à solder.
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Mois couvert - fin <span className="text-destructive">*</span></Label>
                            {payment.periodFrom && paymentEndOptions.length > 0 ? (
                              <Select value={payment.periodTo}
                                onValueChange={(value) => setPayment((p) => ({ ...p, periodTo: value }))}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {paymentEndOptions.map((ym) => (
                                    <SelectItem key={ym} value={ym}>{monthLabel(ym)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="rounded-md border border-muted/50 bg-muted/10 p-3 text-sm text-muted-foreground">
                                Sélectionnez d'abord un mois de début valide.
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button onClick={() => addPaymentMutation.mutate()}
                            disabled={addPaymentMutation.isPending || !canSubmitPayment}>
                            {addPaymentMutation.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
                          </Button>
                          {!canSubmitPayment && Number(payment.amount) > 0 && payment.date.length > 0 && (
                            <p className="text-xs text-muted-foreground">Renseignez la période couverte pour valider.</p>
                          )}
                          {effectiveMrr > 0 && Number(payment.amount) > 0 && Number(payment.amount) < effectiveMrr ? (
                            <p className="text-xs text-amber-700">
                              Montant inférieur à une mensualité : le mois restera partiellement couvert, donc non soldé.
                            </p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>

                    {/* D - Historique brut des versements */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Historique des versements</CardTitle>
                        <CardDescription>Tous les versements reçus, avec leur période de couverture.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date versement</TableHead>
                                <TableHead>Période couverte</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>Référence</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payments.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {new Date(item.date).toLocaleDateString("fr-FR")}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-sm">
                                    {item.periodFrom && item.periodTo ? (
                                      <span>
                                        {monthLabel(dateToMonthKey(item.periodFrom) ?? item.periodFrom)}
                                        {" → "}
                                        {monthLabel(dateToMonthKey(item.periodTo) ?? item.periodTo)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs italic">Non rattaché</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">{formatFcfa(item.amountFcfa)}</TableCell>
                                  <TableCell>{providerLabel(item.provider)}</TableCell>
                                  <TableCell className="text-muted-foreground">{item.reference ?? "-"}</TableCell>
                                </TableRow>
                              ))}
                              {!paymentsQuery.isLoading && payments.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-sm text-center text-muted-foreground py-6">
                                    Aucun versement enregistré.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        {payments.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground text-right">
                            Total encaissé : <strong>{formatFcfa(payments.reduce((s, p) => s + p.amountFcfa, 0))}</strong>
                            {" - "}{payments.length} versement(s)
                            {payments.some((p) => !p.periodFrom) && (
                              <span className="ml-2 text-amber-600">
                                · {payments.filter((p) => !p.periodFrom).length} sans période (non comptabilisé dans le calendrier)
                              </span>
                            )}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* E - Relance SMS */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Relance paiement par SMS</CardTitle>
                        <CardDescription>
                          Envoie un SMS au responsable école. Disponible dès qu&apos;au moins un mois est impayé.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-2 text-sm md:grid-cols-2">
                          <p>
                            État:{" "}
                            <strong className={overdueCount > 0 ? "text-destructive" : "text-green-700"}>
                              {overdueCount > 0
                                ? `${overdueCount} mois impayé${overdueCount > 1 ? "s" : ""} - ${formatFcfa(totalUnpaidFcfa)}`
                                : "À jour"}
                            </strong>
                          </p>
                          <p>Dernière relance: <strong>{formatDateTime(stats.lastPaymentReminderAt)}</strong></p>
                        </div>
                        <Button
                          type="button"
                          variant={overdueCount > 0 ? "destructive" : "outline"}
                          className="gap-2"
                          onClick={() => paymentReminderMutation.mutate()}
                          disabled={overdueCount === 0 || paymentReminderMutation.isPending}
                        >
                          <Send className="h-4 w-4" />
                          {paymentReminderMutation.isPending ? "Envoi..." : "Envoyer relance SMS"}
                        </Button>
                        {overdueCount === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Le bouton se déverrouille dès qu&apos;un mois passé est non couvert.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )
              })()}
            </TabsContent>

            {/* ══════════════════════════════════════════════════
                ONGLET 4 - SMS & REVENUS
            ══════════════════════════════════════════════════ */}
            <TabsContent value="sms-revenus" className="space-y-6">

              {/* ── Section A : Paramètres SMS ── */}
              <div>
                <h2 className="mb-1 text-base font-semibold">Paramètres SMS</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Ces paramètres contrôlent le comportement du module SMS pour cet établissement.
                </p>
                <div className="space-y-4">

                  {/* Étape 1 : Alertes parents payantes ou gratuites */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        Étape 1 - Mode des alertes parents
                      </CardTitle>
                      <CardDescription>
                        Détermine si le menu &quot;Abonnements parents&quot; apparaît dans le dashboard de l&apos;école.
                        En mode gratuit, tous les parents reçoivent les alertes d&apos;absence sans rien payer.
                        En mode payant, seuls les parents ayant souscrit reçoivent les alertes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {smsConfigDraft.monetizeParentAlerts ? "Mode payant (abonnements actifs)" : "Mode gratuit (toutes alertes envoyées)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {smsConfigDraft.monetizeParentAlerts
                              ? "Le menu Abonnements est visible côté école. Seuls les parents ayant souscrit reçoivent les SMS d'absence."
                              : "Aucun abonnement requis. Le menu Abonnements est masqué dans le dashboard école."}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Checkbox
                            id="monetize-parent-alerts"
                            checked={smsConfigDraft.monetizeParentAlerts}
                            onCheckedChange={(checked) =>
                              setSmsConfigDraft((p) => ({ ...p, monetizeParentAlerts: Boolean(checked) }))
                            }
                          />
                          <Label htmlFor="monetize-parent-alerts">
                            {smsConfigDraft.monetizeParentAlerts ? "Payant" : "Gratuit"}
                          </Label>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updateSmsFeatureConfigMutation.isPending}
                        onClick={() => updateSmsFeatureConfigMutation.mutate({ monetizeParentAlerts: smsConfigDraft.monetizeParentAlerts })}
                      >
                        Sauvegarder le mode
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Étape 2 : Activation opérationnelle + paramètres financiers (seulement si mode payant) */}
                  {smsConfigDraft.monetizeParentAlerts ? (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          Étape 2 - Activation opérationnelle des abonnements
                        </CardTitle>
                        <CardDescription>
                          Une fois le mode payant activé (étape 1), cette étape ouvre réellement la création
                          de nouvelles souscriptions côté école. Sans cette activation, le menu est visible
                          mais les souscriptions ne peuvent pas être créées. Définissez aussi la commission
                          et le plafond SMS avant d&apos;activer.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="text-sm font-medium">Création de souscriptions</p>
                            <p className="text-xs text-muted-foreground">
                              État actuel :{" "}
                              {smsFeatureStatsQuery.data?.config.is_enabled
                                ? <span className="text-green-600 font-medium">Ouverte - les souscriptions peuvent être créées</span>
                                : <span className="text-amber-600 font-medium">Fermée - menu visible mais souscriptions bloquées</span>}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={smsFeatureStatsQuery.data?.config.is_enabled ? "destructive" : "default"}
                            onClick={() => {
                              setSmsFeatureToggleNextValue(!(smsFeatureStatsQuery.data?.config.is_enabled ?? false))
                              setSmsFeatureToggleOpen(true)
                            }}
                          >
                            {smsFeatureStatsQuery.data?.config.is_enabled ? "Fermer les souscriptions" : "Ouvrir les souscriptions"}
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>
                              Commission IvoirEdu (%)
                              <span className="ml-1 text-xs text-muted-foreground">- part reversée sur les abonnements collectés</span>
                            </Label>
                            <Input
                              type="number" min={0} max={100}
                              value={smsConfigDraft.commissionPct}
                              onChange={(e) => setSmsConfigDraft((p) => ({ ...p, commissionPct: e.target.value }))}
                            />
                            <Button
                              type="button" size="sm" variant="outline"
                              disabled={updateSmsFeatureConfigMutation.isPending}
                              onClick={() => updateSmsFeatureConfigMutation.mutate({ commission_pct: Number(smsConfigDraft.commissionPct) })}
                            >
                              Sauvegarder
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label>
                              Plafond SMS / élève / mois
                              <span className="ml-1 text-xs text-muted-foreground">- nombre max d&apos;alertes par enfant</span>
                            </Label>
                            <Input
                              type="number" min={0}
                              value={smsConfigDraft.smsCapPerStudent}
                              onChange={(e) => setSmsConfigDraft((p) => ({ ...p, smsCapPerStudent: e.target.value }))}
                            />
                            <Button
                              type="button" size="sm" variant="outline"
                              disabled={updateSmsFeatureConfigMutation.isPending}
                              onClick={() => updateSmsFeatureConfigMutation.mutate({ sms_cap_per_student: Number(smsConfigDraft.smsCapPerStudent) })}
                            >
                              Sauvegarder
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="rounded-md border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
                      Passez en mode payant (étape 1) pour accéder aux paramètres d&apos;activation et de commission.
                    </div>
                  )}

                  {/* Options pointage : heures réelles / GPS */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Paramètres de pointage</CardTitle>
                      <CardDescription>Options avancées de calcul des présences et des salaires.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Calcul sur heures réelles</p>
                            <p className="text-xs text-muted-foreground">
                              Salaires calculés sur les minutes réellement effectuées (fallback planning si données absentes).
                            </p>
                          </div>
                          <Checkbox
                            id="use-real-hours"
                            checked={smsConfigDraft.useRealHours}
                            onCheckedChange={(checked) => setSmsConfigDraft((p) => ({ ...p, useRealHours: Boolean(checked) }))}
                          />
                        </div>
                        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Vérification GPS des pointages</p>
                            <p className="text-xs text-muted-foreground">
                              Contrôle que le pointage a lieu dans le périmètre des coordonnées de la salle.
                            </p>
                          </div>
                          <Checkbox
                            id="geo-check-enabled"
                            checked={smsConfigDraft.geoCheckEnabled}
                            onCheckedChange={(checked) => setSmsConfigDraft((p) => ({ ...p, geoCheckEnabled: Boolean(checked) }))}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updateSmsFeatureConfigMutation.isPending}
                        onClick={() => updateSmsFeatureConfigMutation.mutate({
                          useRealHours: smsConfigDraft.useRealHours,
                          geoCheckEnabled: smsConfigDraft.geoCheckEnabled,
                        })}
                      >
                        Sauvegarder
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {smsConfigDraft.monetizeParentAlerts && smsFeatureStatsQuery.data?.config.is_enabled ? (
                <>
                  <Separator />

                  {/* ── Section B : Revenus par mois ── */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-base font-semibold">Revenus abonnements SMS</h2>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Mois précédent"
                          onClick={() => setRevenueMonth(prevMonth(revenueMonth))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-24 text-center text-sm font-medium">{revenueMonth}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Mois suivant"
                          onClick={() => setRevenueMonth(nextMonth(revenueMonth))}
                          disabled={isNextMonthDisabled}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <StatCard
                        title="Souscriptions actives"
                        value={revenueDisplayData?.subscriptions_active ?? 0}
                        icon={<Users className="h-4 w-4" />}
                      />
                      <StatCard
                        title="Encaissé"
                        value={formatFcfa(revenueDisplayData?.total_collected_fcfa ?? 0)}
                        icon={<TrendingUp className="h-4 w-4" />}
                      />
                      {/* Reste à reverser : seule valeur actionnable. Commission due = info secondaire. */}
                      <div className={`rounded-lg border p-4 shadow-sm ${
                        (revenueDisplayData?.commission_remaining_fcfa ?? 0) > 0
                          ? "border-amber-300 bg-amber-50"
                          : (revenueDisplayData?.commission_due_fcfa ?? 0) > 0
                            ? "border-green-200 bg-green-50"
                            : ""
                      }`}>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Coins className="h-4 w-4 shrink-0" />
                          <span>Commission</span>
                        </div>
                        <p className={`mt-1 text-xl font-bold ${
                          (revenueDisplayData?.commission_remaining_fcfa ?? 0) > 0
                            ? "text-amber-900"
                            : "text-green-700"
                        }`}>
                          {(revenueDisplayData?.commission_remaining_fcfa ?? 0) > 0
                            ? formatFcfa(revenueDisplayData!.commission_remaining_fcfa)
                            : (revenueDisplayData?.commission_due_fcfa ?? 0) > 0
                              ? "Soldée ✓"
                              : "–"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {(revenueDisplayData?.commission_remaining_fcfa ?? 0) > 0
                            ? `Reste à reverser sur ${formatFcfa(revenueDisplayData!.commission_due_fcfa)} dus`
                            : (revenueDisplayData?.commission_due_fcfa ?? 0) > 0
                              ? `${formatFcfa(revenueDisplayData!.commission_due_fcfa)} dus - intégralement reversés`
                              : "Aucune commission ce mois"}
                        </p>
                      </div>
                    </div>

                    {/* Historique par mois - seulement les mois avec activité */}
                    {historyWithActivity.length > 0 ? (
                      <div className="mt-4 overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Mois</TableHead>
                              <TableHead>Souscriptions</TableHead>
                              <TableHead>Encaissé école</TableHead>
                              <TableHead>Commission due</TableHead>
                              <TableHead>Commission reversée</TableHead>
                              <TableHead>Reste à reverser</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historyWithActivity.map((row) => {
                              const isOverdue = row.month < currentYM && row.commission_remaining_fcfa > 0
                              return (
                                <TableRow key={row.month} className={isOverdue ? "bg-destructive/5" : ""}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {row.month}
                                      {isOverdue && (
                                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                          En retard
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>{row.subscriptions_active}</TableCell>
                                  <TableCell>{formatFcfa(row.total_collected_fcfa)}</TableCell>
                                  <TableCell>{formatFcfa(row.commission_due_fcfa)}</TableCell>
                                  <TableCell>{formatFcfa(row.commission_paid_fcfa)}</TableCell>
                                  <TableCell className={isOverdue ? "font-semibold text-destructive" : ""}>
                                    {formatFcfa(row.commission_remaining_fcfa)}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">Aucun mois avec activité d&apos;abonnements.</p>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => syncSmsCommissionMutation.mutate()}
                        disabled={syncSmsCommissionMutation.isPending}
                      >
                        {syncSmsCommissionMutation.isPending ? "Synchronisation..." : "Synchroniser les calculs"}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* ── Section C : Reversements ── */}
                  <div>
                    <div className="mb-1">
                      <h2 className="text-base font-semibold">Reversements de commission</h2>
                      <p className="text-xs text-muted-foreground">
                        Montants reversés par l&apos;école à IvoirEdu, mois par mois.
                        Seuls les mois avec activité (collecte ou reversement non-nul) apparaissent.
                      </p>
                    </div>

                    {/* Alertes mois en retard */}
                    {overdueMonths.length > 0 && (
                      <Alert variant="destructive" className="mb-3 mt-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{overdueMonths.length} mois en retard :</strong>{" "}
                          {overdueMonths.map((m) => (
                            <button
                              key={m.month}
                              type="button"
                              className="mx-1 underline"
                              onClick={() => setReversementMonth(m.month)}
                            >
                              {m.month} ({formatFcfa(m.commission_remaining_fcfa)} restants)
                            </button>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Vue consolidée par mois avec détail opérations */}
                    <div className="mt-3 space-y-3">
                      {historyWithActivity.length === 0 && !smsFeatureStatsQuery.isLoading && (
                        <p className="text-sm text-muted-foreground">Aucune activité SMS enregistrée.</p>
                      )}
                      {historyWithActivity.map((row) => {
                        const isOverdue = row.month < currentYM && row.commission_remaining_fcfa > 0
                        const isPaid = row.commission_remaining_fcfa === 0 && row.commission_paid_fcfa > 0
                        const auditItems = reversementMonth === row.month ? (commissionPaymentsQuery.data ?? []) : null

                        return (
                          <div
                            key={row.month}
                            className={`rounded-lg border ${isOverdue ? "border-destructive/40 bg-destructive/5" : "bg-muted/20"}`}
                          >
                            {/* Ligne récapitulative du mois */}
                            <div
                              className="flex cursor-pointer flex-wrap items-center gap-4 p-3"
                              onClick={() => setReversementMonth(reversementMonth === row.month ? "" : row.month)}
                            >
                              <span className="min-w-16 font-medium">{row.month}</span>
                              <span className="text-sm text-muted-foreground">
                                Collecté : <span className="font-medium text-foreground">{formatFcfa(row.total_collected_fcfa)}</span>
                              </span>
                              <span className="text-sm text-muted-foreground">
                                Commission due : <span className="font-medium text-foreground">{formatFcfa(row.commission_due_fcfa)}</span>
                              </span>
                              <span className="text-sm text-muted-foreground">
                                Reversé : <span className="font-medium text-foreground">{formatFcfa(row.commission_paid_fcfa)}</span>
                              </span>
                              {isOverdue && (
                                <Badge variant="destructive" className="ml-auto">
                                  Retard - {formatFcfa(row.commission_remaining_fcfa)} restant
                                </Badge>
                              )}
                              {isPaid && (
                                <Badge variant="outline" className="ml-auto border-green-300 text-green-700">
                                  Soldé
                                </Badge>
                              )}
                              {!isOverdue && !isPaid && row.commission_remaining_fcfa > 0 && (
                                <Badge variant="secondary" className="ml-auto">
                                  {formatFcfa(row.commission_remaining_fcfa)} restant
                                </Badge>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={(e) => { e.stopPropagation(); openReversementDialog(row.month) }}
                              >
                                <Plus className="h-3 w-3" />
                                Enregistrer
                              </Button>
                            </div>

                            {/* Détail des opérations (dépliable) */}
                            {reversementMonth === row.month && (
                              <div className="border-t px-3 pb-3 pt-2">
                                {commissionPaymentsQuery.isLoading ? (
                                  <p className="text-xs text-muted-foreground">Chargement…</p>
                                ) : (auditItems ?? []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    Aucune opération trouvée pour ce mois - utilisez le bouton
                                    &quot;Enregistrer&quot; pour en saisir une.
                                  </p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground">
                                        <th className="pb-1 text-left font-normal">Date saisie</th>
                                        <th className="pb-1 text-left font-normal">Montant</th>
                                        <th className="pb-1 text-left font-normal">Moyen</th>
                                        <th className="pb-1 text-left font-normal">Notes</th>
                                        <th className="w-8" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(auditItems ?? []).map((item) => (
                                        <tr key={item.id} className="border-t">
                                          <td className="py-1">{new Date(item.created_at).toLocaleString("fr-FR")}</td>
                                          <td className="py-1 font-medium">{formatFcfa(item.amount_fcfa)}</td>
                                          <td className="py-1">{item.payment_method ?? "-"}</td>
                                          <td className="py-1">{item.notes ?? "-"}</td>
                                          <td className="py-1">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className="h-6 w-6 p-0"
                                              title="Ajouter un versement complémentaire"
                                              onClick={() => openReversementDialog(item.period_month)}
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Bouton global si aucune activité ou pour un mois non-listé */}
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => openReversementDialog(currentYM)}
                      >
                        <Plus className="h-4 w-4" />
                        Saisir un reversement hors-liste
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </TabsContent>

            {/* ══════════════════════════════════════════════════
                ONGLET 5 - STATISTIQUES
            ══════════════════════════════════════════════════ */}
            <TabsContent value="stats" className="space-y-4">
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Utilisateurs actifs 7j</CardDescription><CardTitle>{school.usageStats.activeUsers7d}</CardTitle></CardHeader></Card>
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Professeurs</CardDescription><CardTitle>{school.usageStats.teachersCount}</CardTitle></CardHeader></Card>
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Élèves</CardDescription><CardTitle>{school.usageStats.studentsCount}</CardTitle></CardHeader></Card>
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Pointages 30j</CardDescription><CardTitle>{school.usageStats.attendanceRecords30d}</CardTitle></CardHeader></Card>
              </section>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Taux d&apos;activation 7j</CardDescription>
                    <CardTitle>{activeUsersRatePct}%</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {school.usageStats.activeUsers7d} actifs / {school.usageStats.nbUsers} utilisateurs
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Élèves / professeur</CardDescription>
                    <CardTitle>{studentsPerTeacher}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Ratio calculé sur les effectifs actuels.
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Total utilisateurs</CardDescription>
                    <CardTitle>{school.usageStats.nbUsers}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Dernière connexion: {formatDateTime(school.usageStats.lastConnection)}
                  </CardContent>
                </Card>
              </section>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Activité 30 jours (connexions)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(school.connectionHistory30d ?? []).length > 0 ? (
                    school.connectionHistory30d.map((row) => {
                      const max = Math.max(...school.connectionHistory30d.map((item) => item.uniqueUsers), 1)
                      const widthPct = Math.round((row.uniqueUsers / max) * 100)
                      return (
                        <div key={row.date} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{row.date}</span>
                            <span className="font-medium">{row.uniqueUsers}</span>
                          </div>
                          <div className="h-2 rounded bg-muted">
                            <div className={`h-2 rounded bg-primary ${toBarWidthClass(widthPct)}`} />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune connexion enregistrée sur 30 jours.</p>
                  )}
                </CardContent>
              </Card>
              {dataQualityAlerts.length > 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>{dataQualityAlerts.join(" ")}</AlertDescription>
                </Alert>
              ) : null}
            </TabsContent>
          </Tabs>
        ) : null}

        {schoolUsersQuery.isError || paymentsQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>Certaines données n&apos;ont pas pu être chargées.</AlertDescription>
          </Alert>
        ) : null}
      </OfflineDisabledFieldset>

      {/* ── Dialog activation/désactivation feature SMS ── */}
      <AlertDialog open={smsFeatureToggleOpen} onOpenChange={setSmsFeatureToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {smsFeatureToggleNextValue ? "Activer la feature SMS ?" : "Désactiver la feature SMS ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {smsFeatureToggleNextValue
                ? `Activer génère un accès au service SMS pour cette école. Commission : ${smsConfigDraft.commissionPct}%.`
                : "Les souscriptions en cours restent actives jusqu'à expiration. Aucune nouvelle souscription ne sera possible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (smsFeatureToggleNextValue) {
                  activateSmsFeatureMutation.mutate(Number(smsConfigDraft.commissionPct))
                } else {
                  deactivateSmsFeatureMutation.mutate()
                }
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog enregistrement reversement ── */}
      <AlertDialog open={reversementOpen} onOpenChange={(open) => { if (!open) closeReversementDialog() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enregistrer un reversement</AlertDialogTitle>
            <AlertDialogDescription>
              Commission reçue de l&apos;école pour la période <strong>{reversementPeriodMonth || "-"}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Période (YYYY-MM)</Label>
              <Input
                value={reversementPeriodMonth}
                onChange={(e) => setReversementPeriodMonth(e.target.value)}
                placeholder="2026-05"
              />
            </div>
            <div className="space-y-1">
              <Label>Montant (FCFA)</Label>
              <Input
                value={reversementAmount}
                onChange={(e) => setReversementAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 12 500"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label>Moyen de versement</Label>
              <Select value={reversementMethod} onValueChange={(v) => setReversementMethod(v as typeof reversementMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optionnel)</Label>
              <Input value={reversementNotes} onChange={(e) => setReversementNotes(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeReversementDialog}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitReversement}
              disabled={
                recordReversementMutation.isPending ||
                !reversementPeriodMonth ||
                !reversementAmount ||
                Number(reversementAmount) <= 0
              }
            >
              {recordReversementMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
