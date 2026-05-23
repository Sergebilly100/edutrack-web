import { useEffect, useState } from "react"
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Coins, KeyRound, Send, TrendingUp, Users } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import {
  activateSchoolSmsFeature,
  addSchoolPayment,
  deactivateSchoolSmsFeature,
  getSchoolSmsFeatureStats,
  getSchoolCommissionPayments,
  getSchoolDetails,
  getSchoolPayments,
  getSchoolUsers,
  recordSchoolCommissionReceived,
  resetTenantSmsTemplate,
  sendSchoolPaymentReminder,
  syncSchoolSmsCommission,
  type SchoolDetailsResponse,
  type TenantPlan,
  type TenantStatus,
  type TeachingType,
  updateSchoolConfig,
  updateSchoolSmsFeatureConfig,
} from "@/modules/admin/admin.api"
import { StatCard } from "@/shared/components"
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
  const [activeTab, setActiveTab] = useState<string>(tabFromQuery === "sms-feature" ? "sms-feature" : "config")

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

  const [config, setConfig] = useState({
    plan: "essential" as TenantPlan,
    status: "trial" as TenantStatus,
    city: "",
    teachingType: "secondaire" as TeachingType,
    studentLabel: "Élève",
    directorTitle: "Directeur",
    canEditSmsTemplate: false,
    canExportData: true,
  })
  const [payment, setPayment] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    provider: "manual" as "manual" | "mtn_momo" | "orange_money",
    reference: "",
    periodFrom: "",
    periodTo: "",
  })
  const [smsConfigDraft, setSmsConfigDraft] = useState({
    commissionPct: "0",
    smsCapPerStudent: "60",
    monetizeParentAlerts: false,
    useRealHours: false,
    geoCheckEnabled: false,
  })
  const [smsFeatureToggleOpen, setSmsFeatureToggleOpen] = useState(false)
  const [smsFeatureToggleNextValue, setSmsFeatureToggleNextValue] = useState<boolean | null>(null)
  const [commissionPaymentOpen, setCommissionPaymentOpen] = useState(false)
  const [commissionPaymentPeriodMonth, setCommissionPaymentPeriodMonth] = useState("")
  const [commissionPaymentAmount, setCommissionPaymentAmount] = useState("")
  const [commissionPaymentMethod, setCommissionPaymentMethod] = useState<"cash" | "momo_mtn" | "momo_orange" | "bank_transfer">("cash")
  const [commissionPaymentNotes, setCommissionPaymentNotes] = useState("")
  const [commissionPaymentsMonth, setCommissionPaymentsMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const commissionPaymentsQuery = useQuery({
    queryKey: ["admin", "school-sms-feature-payments", tenantId, commissionPaymentsMonth],
    queryFn: () => getSchoolCommissionPayments(tenantId as string, commissionPaymentsMonth),
    enabled: Boolean(tenantId),
  })

  useEffect(() => {
    if (!schoolQuery.data) return
    const metadata = schoolQuery.data.metadata
    setConfig({
      plan: metadata.plan,
      status: metadata.status,
      city: metadata.city ?? "",
      teachingType: metadata.teachingType ?? "secondaire",
      studentLabel: metadata.studentLabel ?? (metadata.teachingType === "superieur" ? "Étudiant(e)" : "Élève"),
      directorTitle: metadata.directorTitle ?? "Directeur",
      canEditSmsTemplate: metadata.canEditSmsTemplate,
      canExportData: metadata.canExportData,
    })
  }, [schoolQuery.data])
  useEffect(() => {
    if (!smsFeatureStatsQuery.data) {
      return
    }
    setSmsConfigDraft({
      commissionPct: String(smsFeatureStatsQuery.data.config.commission_pct),
      smsCapPerStudent: String(smsFeatureStatsQuery.data.config.sms_cap_per_student),
      monetizeParentAlerts: smsFeatureStatsQuery.data.config.monetize_parent_alerts,
      useRealHours: smsFeatureStatsQuery.data.config.use_real_hours,
      geoCheckEnabled: smsFeatureStatsQuery.data.config.geo_check_enabled,
    })
  }, [smsFeatureStatsQuery.data])

  const updateMutation = useMutation({
    mutationFn: () =>
      updateSchoolConfig(tenantId as string, {
        plan: config.plan,
        status: config.status,
        city: config.city,
        teaching_type: config.teachingType,
        student_label: config.studentLabel,
        director_title: config.directorTitle,
        can_edit_sms_template: config.canEditSmsTemplate,
        can_export_data: config.canExportData,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "schools"] })
      toast({ title: "Configuration école mise à jour" })
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
        period_from: payment.periodFrom || undefined,
        period_to: payment.periodTo || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-payments", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "revenue", "summary"] })
      setPayment((prev) => ({ ...prev, amount: "", reference: "" }))
      toast({ title: "Paiement enregistré" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le paiement", variant: "destructive" })
    },
  })
  const toggleTemplateCustomizationMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateSchoolConfig(tenantId as string, {
        can_edit_sms_template: enabled,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      toast({ title: "Paramètre SMS mis à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour ce paramètre", variant: "destructive" })
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
      toast({
        title: "Templates resynchronisés",
        description: "Les templates de l'école utilisent de nouveau la version globale super admin.",
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de forcer la resynchronisation des templates.",
        variant: "destructive",
      })
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
    }) =>
      updateSchoolSmsFeatureConfig(tenantId as string, payload),
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
  const recordCommissionReceivedMutation = useMutation({
    mutationFn: (payload: { period_month: string; amount_fcfa: number; payment_method?: "cash" | "momo_mtn" | "momo_orange" | "bank_transfer"; notes?: string; idempotency_key: string }) =>
      recordSchoolCommissionReceived(tenantId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-stats", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-sms-feature-payments", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms-feature", "global-stats"] })
      setCommissionPaymentOpen(false)
      setCommissionPaymentPeriodMonth("")
      setCommissionPaymentAmount("")
      setCommissionPaymentMethod("cash")
      setCommissionPaymentNotes("")
      toast({ title: "Paiement commission enregistré" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer ce paiement.", variant: "destructive" })
    },
  })

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "super_admin") {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const school: SchoolDetailsResponse | undefined = schoolQuery.data
  const canSubmitPayment = Number(payment.amount) > 0 && payment.date.length > 0
  const dueDateMs = school?.usageStats.nextDueDate ? new Date(school.usageStats.nextDueDate).getTime() : Number.NaN
  const isPaymentOverdue =
    school !== undefined &&
    Number.isFinite(dueDateMs) &&
    dueDateMs < nowMs &&
    school.usageStats.remainingCurrentPeriodFcfa > 0
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
  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-2 px-0" onClick={() => navigate("/admin/schools")}>
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{school?.metadata.name ?? "Détail école"}</h1>
          <p className="text-sm text-muted-foreground">{school?.metadata.subdomain}.edutrack.ci</p>
        </div>
        {school ? <Badge>{school.metadata.status}</Badge> : null}
      </div>

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
            <TabsTrigger value="sms-feature">SMS & Abonnements</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="subscription">Abonnement & Paiements</TabsTrigger>
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Configuration école</CardTitle>
                <CardDescription>Vocabulaire, limites, statut et permissions de l&apos;établissement.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom de l&apos;établissement</Label>
                  <Input value={school.metadata.name} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input value={config.city} onChange={(event) => setConfig((prev) => ({ ...prev, city: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Type d&apos;établissement</Label>
                  <Select value={config.teachingType} onValueChange={(value) => setConfig((prev) => ({ ...prev, teachingType: value as TeachingType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TEACHING_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Terme apprenants</Label>
                  <Input value={config.studentLabel} onChange={(event) => setConfig((prev) => ({ ...prev, studentLabel: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Titre responsable</Label>
                  <Input value={config.directorTitle} onChange={(event) => setConfig((prev) => ({ ...prev, directorTitle: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={config.plan} onValueChange={(value) => setConfig((prev) => ({ ...prev, plan: value as TenantPlan }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLAN_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={config.status} onValueChange={(value) => setConfig((prev) => ({ ...prev, status: value as TenantStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="can-export-data" checked={config.canExportData} onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, canExportData: Boolean(checked) }))} />
                  <Label htmlFor="can-export-data">L&apos;école peut exporter ses données</Label>
                </div>
                <div className="md:col-span-2">
                  <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                    Enregistrer la configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                  <p className="font-medium text-foreground">Accès responsable</p>
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
                  Identifiant: {credentialLabel(schoolUsersQuery.data?.director?.phone ?? null, schoolUsersQuery.data?.director?.email ?? null)}
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
                <CardContent className="text-xs text-muted-foreground">Comptes enseignants et username</CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Responsable
                </CardTitle>
                <CardDescription>Informations du responsable école.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Nom: <strong>{schoolUsersQuery.data?.director?.name ?? "-"}</strong></p>
                <p>Téléphone: <strong>{schoolUsersQuery.data?.director?.phone ?? "-"}</strong></p>
                <p>Email: <strong>{schoolUsersQuery.data?.director?.email ?? "-"}</strong></p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Utilisateurs staff</CardTitle>
                <CardDescription>Liste des comptes staff avec identifiants de connexion (sans mot de passe).</CardDescription>
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
                  Professeurs de l&apos;école
                </CardTitle>
                <CardDescription>Liste des comptes professeurs et usernames.</CardDescription>
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

          <TabsContent value="sms-feature" className="space-y-4">
            <Card className="shadow-sm">
	              <CardHeader>
	                <CardTitle>Configuration</CardTitle>
	                <CardDescription>Mode des alertes parents et abonnements SMS.</CardDescription>
	              </CardHeader>
	              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Monétiser les alertes parents</p>
                    <p className="text-xs text-muted-foreground">
                      {smsConfigDraft.monetizeParentAlerts
                        ? "Seuls les parents avec abonnement actif reçoivent les alertes d'absence."
                        : "Tous les contacts parents reçoivent les alertes d'absence, sans abonnement requis."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="monetize-parent-alerts"
                      checked={smsConfigDraft.monetizeParentAlerts}
                      onCheckedChange={(checked) =>
                        setSmsConfigDraft((prev) => ({ ...prev, monetizeParentAlerts: Boolean(checked) }))
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
                  onClick={() =>
                    updateSmsFeatureConfigMutation.mutate({
                      monetizeParentAlerts: smsConfigDraft.monetizeParentAlerts,
                    })
                  }
                >
                  Sauvegarder mode alertes parents
                </Button>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Heures réelles</p>
                      <p className="text-xs text-muted-foreground">
                        Calculer les salaires sur les minutes réellement effectuées avec fallback planning.
                      </p>
                    </div>
                    <Checkbox
                      id="use-real-hours"
                      checked={smsConfigDraft.useRealHours}
                      onCheckedChange={(checked) =>
                        setSmsConfigDraft((prev) => ({ ...prev, useRealHours: Boolean(checked) }))
                      }
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Contrôle GPS</p>
                      <p className="text-xs text-muted-foreground">
                        Vérifier les pointages par rapport aux coordonnées configurées des salles.
                      </p>
                    </div>
                    <Checkbox
                      id="geo-check-enabled"
                      checked={smsConfigDraft.geoCheckEnabled}
                      onCheckedChange={(checked) =>
                        setSmsConfigDraft((prev) => ({ ...prev, geoCheckEnabled: Boolean(checked) }))
                      }
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={updateSmsFeatureConfigMutation.isPending}
                  onClick={() =>
                    updateSmsFeatureConfigMutation.mutate({
                      useRealHours: smsConfigDraft.useRealHours,
                      geoCheckEnabled: smsConfigDraft.geoCheckEnabled,
                    })
                  }
                >
                  Sauvegarder heures réelles et GPS
                </Button>

                {smsConfigDraft.monetizeParentAlerts ? (
                  <>
	                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Activer la feature SMS</p>
                    <p className="text-xs text-muted-foreground">
                      État actuel: {smsFeatureStatsQuery.data?.config.is_enabled ? "Activée" : "Désactivée"}
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
                    {smsFeatureStatsQuery.data?.config.is_enabled ? "Désactiver" : "Activer"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Commission %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={smsConfigDraft.commissionPct}
                      onChange={(event) => setSmsConfigDraft((prev) => ({ ...prev, commissionPct: event.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateSmsFeatureConfigMutation.mutate({
                          commission_pct: Number(smsConfigDraft.commissionPct),
                        })
                      }
                    >
                      Sauvegarder commission
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Plafond SMS/élève/mois</Label>
                    <Input
                      type="number"
                      min={0}
                      value={smsConfigDraft.smsCapPerStudent}
                      onChange={(event) => setSmsConfigDraft((prev) => ({ ...prev, smsCapPerStudent: event.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateSmsFeatureConfigMutation.mutate({
                          sms_cap_per_student: Number(smsConfigDraft.smsCapPerStudent),
                        })
                      }
                    >
                      Sauvegarder plafond
                    </Button>
	                  </div>
	                </div>
                  </>
                ) : (
                  <p className="rounded-md border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
                    La feature SMS abonnements et les reversements sont masqués tant que les alertes parents ne sont pas monétisées.
                  </p>
                )}
	              </CardContent>
	            </Card>
	
	            {smsConfigDraft.monetizeParentAlerts && smsFeatureStatsQuery.data?.config.is_enabled ? (
	              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  title="Souscriptions actives"
                  value={smsFeatureStatsQuery.data.current_month.subscriptions_active}
                  icon={<Users className="h-4 w-4" />}
                />
                <StatCard
                  title="Encaissé ce mois"
                  value={formatFcfa(smsFeatureStatsQuery.data.current_month.total_collected_fcfa)}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <StatCard
                  title="Commission due"
                  value={formatFcfa(smsFeatureStatsQuery.data.current_month.commission_due_fcfa)}
                  icon={<Coins className="h-4 w-4" />}
                  variant={smsFeatureStatsQuery.data.current_month.commission_due_fcfa > 0 ? "warning" : "default"}
                />
              </section>
            ) : null}

            {smsConfigDraft.monetizeParentAlerts ? (
              <>
  	            <div className="flex justify-end">
  	              <Button type="button" variant="outline" onClick={() => syncSmsCommissionMutation.mutate()}>
  	                Synchroniser les calculs
  	              </Button>
  	            </div>
	
  	            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Suivi des reversements</CardTitle>
                <CardDescription>Détail des reversements reçus sur le mois sélectionné.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-w-xs">
                  <Label>Mois à afficher</Label>
                  <Input
                    type="month"
                    value={commissionPaymentsMonth}
                    onChange={(event) => setCommissionPaymentsMonth(event.target.value)}
                  />
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date de versement</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Moyen</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(commissionPaymentsQuery.data ?? []).map((item) => {
                        return (
                          <TableRow key={item.id}>
                            <TableCell>{new Date(item.created_at).toLocaleString("fr-FR")}</TableCell>
                            <TableCell>{item.period_month}</TableCell>
                            <TableCell>{formatFcfa(item.amount_fcfa)}</TableCell>
                            <TableCell>{item.payment_method || "-"}</TableCell>
                            <TableCell>{item.notes || "-"}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCommissionPaymentPeriodMonth(item.period_month)
                                  setCommissionPaymentAmount("")
                                  setCommissionPaymentMethod("cash")
                                  setCommissionPaymentNotes("")
                                  setCommissionPaymentOpen(true)
                                }}
                              >
                                Enregistrer paiement reçu
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {!commissionPaymentsQuery.isLoading && (commissionPaymentsQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-sm text-muted-foreground">
                            Aucun reversement détaillé sur ce mois.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
  	            </Card>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="sms" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Accès SMS côté école</CardTitle>
                <CardDescription>
                  Ce paramètre autorise (ou non) le menu de personnalisation SMS dans le dashboard Directeur/Staff de l&apos;école.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="can-edit-template"
                    checked={config.canEditSmsTemplate}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, canEditSmsTemplate: Boolean(checked) }))}
                  />
                  <Label htmlFor="can-edit-template">Personnalisation templates école</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toggleTemplateCustomizationMutation.mutate(config.canEditSmsTemplate)}
                  disabled={toggleTemplateCustomizationMutation.isPending}
                >
                  Enregistrer ce paramètre
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => forceSmsTemplateResyncMutation.mutate()}
                  disabled={forceSmsTemplateResyncMutation.isPending}
                >
                  {forceSmsTemplateResyncMutation.isPending
                    ? "Resynchronisation..."
                    : "Forcer la resynchronisation"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Les contenus SMS sont définis globalement dans <strong>SMS &amp; Notifs</strong> (super admin):
                  template absence élève et template relance paiement. Ici, vous autorisez uniquement la personnalisation
                  du template absence côté école.
                </p>
                <Button type="button" variant="ghost" className="px-0" onClick={() => navigate("/admin/sms")}>
                  Ouvrir Revenus SMS
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-sm"><CardHeader><CardDescription>Plan</CardDescription><CardTitle>{school.metadata.plan}</CardTitle></CardHeader></Card>
              <Card className="shadow-sm"><CardHeader><CardDescription>Date d&apos;abonnement</CardDescription><CardTitle>{formatDate(school.usageStats.subscriptionStartedAt)}</CardTitle></CardHeader></Card>
              <Card className="shadow-sm"><CardHeader><CardDescription>Échéance</CardDescription><CardTitle>{school.usageStats.billingCycle === "annual" ? "Annuelle" : "Mensuelle"}</CardTitle></CardHeader></Card>
              <Card className="shadow-sm"><CardHeader><CardDescription>Reste à verser</CardDescription><CardTitle>{formatFcfa(school.usageStats.remainingCurrentPeriodFcfa)}</CardTitle></CardHeader></Card>
            </section>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Synthèse période en cours</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <p>Période: <strong>{formatDate(school.usageStats.currentPeriodStart)} {"->"} {formatDate(school.usageStats.currentPeriodEnd)}</strong></p>
                <p>Montant attendu: <strong>{formatFcfa(school.usageStats.mrrFcfa)}</strong></p>
                <p>Déjà payé: <strong>{formatFcfa(school.usageStats.paidCurrentPeriodFcfa)}</strong></p>
                <p>Prochaine échéance: <strong>{formatDate(school.usageStats.nextDueDate)}</strong></p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Relance paiement SMS</CardTitle>
                <CardDescription>
                  Envoie un SMS au responsable école uniquement si l&apos;échéance est dépassée et qu&apos;un reste est dû.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <p>État échéance: <strong>{isPaymentOverdue ? "Dépassée" : "À jour / non dépassée"}</strong></p>
                  <p>Dernière relance: <strong>{formatDateTime(school.usageStats.lastPaymentReminderAt)}</strong></p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => paymentReminderMutation.mutate()}
                  disabled={!isPaymentOverdue || paymentReminderMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                  Relance paiement SMS
                </Button>
                {!isPaymentOverdue ? (
                  <p className="text-xs text-muted-foreground">
                    Le bouton est actif uniquement quand la date d&apos;échéance est passée et qu&apos;un montant reste à verser.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Historique paiements</CardTitle>
                <CardDescription>Suivi des paiements validés pour cet abonnement.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Référence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(paymentsQuery.data ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.date).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell>{formatFcfa(item.amountFcfa)}</TableCell>
                          <TableCell>{item.provider}</TableCell>
                          <TableCell>{item.reference ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                      {!paymentsQuery.isLoading && (paymentsQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">Aucun paiement enregistré.</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Enregistrer un paiement manuel</CardTitle>
                <CardDescription>Saisie guidée pour régulariser l&apos;abonnement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date de paiement</Label>
                    <Input type="date" value={payment.date} onChange={(event) => setPayment((prev) => ({ ...prev, date: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Montant (FCFA)</Label>
                    <Input type="number" min={1} placeholder="Ex: 25000" value={payment.amount} onChange={(event) => setPayment((prev) => ({ ...prev, amount: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Moyen de paiement</Label>
                    <Select value={payment.provider} onValueChange={(value) => setPayment((prev) => ({ ...prev, provider: value as "manual" | "mtn_momo" | "orange_money" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manuel</SelectItem>
                        <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                        <SelectItem value="orange_money">Orange Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Référence transaction</Label>
                    <Input placeholder="Optionnel" value={payment.reference} onChange={(event) => setPayment((prev) => ({ ...prev, reference: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Période couverte - début</Label>
                    <Input type="date" value={payment.periodFrom} onChange={(event) => setPayment((prev) => ({ ...prev, periodFrom: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Période couverte - fin</Label>
                    <Input type="date" value={payment.periodTo} onChange={(event) => setPayment((prev) => ({ ...prev, periodTo: event.target.value }))} />
                  </div>
                </div>
                <Button onClick={() => addPaymentMutation.mutate()} disabled={addPaymentMutation.isPending || !canSubmitPayment}>
                  + Enregistrer le paiement
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

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
          <AlertDescription>Certaines données de configuration école n&apos;ont pas pu être chargées.</AlertDescription>
        </Alert>
      ) : null}

      <AlertDialog open={smsFeatureToggleOpen} onOpenChange={setSmsFeatureToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {smsFeatureToggleNextValue ? "Activer la feature SMS ?" : "Désactiver la feature SMS ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {smsFeatureToggleNextValue
                ? `Activer génère un accès au service SMS pour cette école. La commission sera de ${smsConfigDraft.commissionPct}%. Confirmer ?`
                : "Les souscriptions en cours restent actives jusqu'à expiration. Aucune nouvelle souscription ne sera possible. Confirmer ?"}
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

      <AlertDialog open={commissionPaymentOpen} onOpenChange={setCommissionPaymentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enregistrer paiement reçu</AlertDialogTitle>
            <AlertDialogDescription>Mois {commissionPaymentPeriodMonth || "-"}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Période</Label>
              <Input value={commissionPaymentPeriodMonth} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Montant FCFA</Label>
              <Input value={commissionPaymentAmount} onChange={(event) => setCommissionPaymentAmount(event.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-1">
              <Label>Moyen de versement</Label>
              <Select value={commissionPaymentMethod} onValueChange={(value) => setCommissionPaymentMethod(value as typeof commissionPaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="momo_mtn">MTN MoMo</SelectItem>
                  <SelectItem value="momo_orange">Orange Money</SelectItem>
                  <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={commissionPaymentNotes} onChange={(event) => setCommissionPaymentNotes(event.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const amount = Number(commissionPaymentAmount)
                if (!commissionPaymentPeriodMonth || !Number.isFinite(amount) || amount <= 0) {
                  return
                }
                recordCommissionReceivedMutation.mutate({
                  period_month: commissionPaymentPeriodMonth,
                  amount_fcfa: amount,
                  payment_method: commissionPaymentMethod,
                  notes: commissionPaymentNotes.trim() || undefined,
                  idempotency_key: crypto.randomUUID(),
                })
              }}
              disabled={recordCommissionReceivedMutation.isPending}
            >
              Enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
