import { useEffect, useState } from "react"
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, KeyRound, Send, Users } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
  addSchoolPayment,
  getSchoolDetails,
  getSchoolPayments,
  getSchoolUsers,
  resetTenantSmsTemplate,
  sendSchoolPaymentReminder,
  type SchoolDetailsResponse,
  type TenantPlan,
  type TenantStatus,
  type TeachingType,
  updateSchoolConfig,
} from "@/modules/admin/admin.api"
import { useAuthStore } from "@/shared/store/auth.store"

const PLAN_OPTIONS: TenantPlan[] = ["essential", "pro", "establishment"]
const TEACHING_OPTIONS: TeachingType[] = ["primaire", "secondaire", "superieur", "mixte"]
const STATUS_OPTIONS: TenantStatus[] = ["trial", "active", "suspended", "cancelled"]
type CreatedDirectorCredentials = {
  userId: string
  name: string
  phone: string
  email: string | null
  password: string
}

type AdminSchoolDetailLocationState = {
  createdDirectorCredentials?: CreatedDirectorCredentials
}

const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("fr-FR") : "-")
const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString("fr-FR") : "-")
const credentialLabel = (phone: string | null, email: string | null) => email ?? phone ?? "-"
const toBarWidthClass = (pct: number) => {
  if (pct >= 100) return "w-full"
  if (pct >= 90) return "w-11/12"
  if (pct >= 80) return "w-5/6"
  if (pct >= 70) return "w-4/5"
  if (pct >= 60) return "w-3/5"
  if (pct >= 50) return "w-1/2"
  if (pct >= 40) return "w-2/5"
  if (pct >= 30) return "w-1/3"
  if (pct >= 20) return "w-1/4"
  if (pct >= 10) return "w-1/6"
  return "w-1/12"
}

export default function AdminSchoolDetailPage() {
  const user = useAuthStore((state) => state.user)
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const locationState = (location.state as AdminSchoolDetailLocationState | null) ?? null
  const createdDirectorCredentials = locationState?.createdDirectorCredentials

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

  const [config, setConfig] = useState({
    plan: "essential" as TenantPlan,
    status: "trial" as TenantStatus,
    city: "",
    teachingType: "secondaire" as TeachingType,
    studentLabel: "Élève",
    directorTitle: "Directeur",
    maxUsers: "10",
    maxSmsPerMonth: "2000",
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
      maxUsers: String(metadata.maxUsers),
      maxSmsPerMonth: String(metadata.maxSmsPerMonth),
      canEditSmsTemplate: metadata.canEditSmsTemplate,
      canExportData: metadata.canExportData,
    })
  }, [schoolQuery.data])

  const updateMutation = useMutation({
    mutationFn: () =>
      updateSchoolConfig(tenantId as string, {
        plan: config.plan,
        status: config.status,
        city: config.city,
        teaching_type: config.teachingType,
        student_label: config.studentLabel,
        director_title: config.directorTitle,
        max_users: Number(config.maxUsers),
        max_sms_per_month: Number(config.maxSmsPerMonth),
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
    dueDateMs < Date.now() &&
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
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
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
                <div className="space-y-2">
                  <Label>Nombre max d&apos;utilisateurs</Label>
                  <Input type="number" value={config.maxUsers} onChange={(event) => setConfig((prev) => ({ ...prev, maxUsers: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>SMS autorisés / mois</Label>
                  <Input type="number" value={config.maxSmsPerMonth} onChange={(event) => setConfig((prev) => ({ ...prev, maxSmsPerMonth: event.target.value }))} />
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
                  Accès responsable
                </CardTitle>
                <CardDescription>Identifiants de connexion du responsable école.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Nom: <strong>{schoolUsersQuery.data?.director?.name ?? "-"}</strong></p>
                <p>Téléphone: <strong>{schoolUsersQuery.data?.director?.phone ?? "-"}</strong></p>
                <p>Email: <strong>{schoolUsersQuery.data?.director?.email ?? "-"}</strong></p>
                <p>Mot de passe: <strong>{createdDirectorCredentials?.password ?? "Non affiché (réinitialisation nécessaire)"}</strong></p>
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
                  Ouvrir SMS &amp; Notifs
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
    </div>
  )
}
