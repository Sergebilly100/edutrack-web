import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, KeyRound, Users } from "lucide-react"

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
  getSmsDashboard,
  getTenantSmsTemplates,
  resetTenantSmsTemplate,
  type SchoolDetailsResponse,
  type SmsTemplateType,
  type TenantPlan,
  type TenantStatus,
  type TeachingType,
  updateSchoolConfig,
  updateTenantSmsTemplate,
} from "@/modules/admin/admin.api"
import { useAuthStore } from "@/shared/store/auth.store"

const PLAN_OPTIONS: TenantPlan[] = ["essential", "pro", "establishment"]
const TEACHING_OPTIONS: TeachingType[] = ["primaire", "secondaire", "superieur", "mixte"]
const STATUS_OPTIONS: TenantStatus[] = ["trial", "active", "suspended", "cancelled"]
const SMS_TEMPLATE_OPTIONS: Array<{ type: SmsTemplateType; label: string }> = [
  { type: "student_absent_parent", label: "Absence élève -> parent" },
  { type: "teacher_absent_director", label: "Prof absent -> direction" },
  { type: "teacher_late_director", label: "Prof en retard -> direction" },
  { type: "payment_reminder", label: "Relance paiement" },
  { type: "custom", label: "Template libre" },
]
const DEFAULT_SMS_TEMPLATES: Record<SmsTemplateType, string> = {
  student_absent_parent:
    "Bonjour, votre enfant {studentName} est absent(e) au cours de {subject} ce {date}. Merci de contacter l'école.",
  teacher_absent_director:
    "Alerte EduTrack: le professeur {teacherName} est absent pour le créneau {slotLabel} ({subject}, {className}).",
  teacher_late_director:
    "Alerte EduTrack: le professeur {teacherName} a {lateMinutes} min de retard pour {subject} ({className}).",
  payment_reminder:
    "Rappel EduTrack: merci de régulariser le paiement de la période {period}. Contact: {schoolPhone}.",
  custom: "Message EduTrack: {message}",
}

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
  const smsDashboardQuery = useQuery({
    queryKey: ["admin", "sms", "dashboard"],
    queryFn: getSmsDashboard,
    enabled: Boolean(tenantId),
  })
  const tenantTemplatesQuery = useQuery({
    queryKey: ["admin", "sms", "templates", tenantId],
    queryFn: () => getTenantSmsTemplates(tenantId as string),
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
  const [selectedTemplateType, setSelectedTemplateType] = useState<SmsTemplateType>("student_absent_parent")
  const [templateText, setTemplateText] = useState("")
  const currentTemplate = useMemo(
    () => tenantTemplatesQuery.data?.find((item) => item.type === selectedTemplateType),
    [selectedTemplateType, tenantTemplatesQuery.data]
  )
  const effectiveTemplateText = templateText || currentTemplate?.messageTemplate || DEFAULT_SMS_TEMPLATES[selectedTemplateType]
  const schoolSmsHistory = useMemo(
    () => (smsDashboardQuery.data?.history ?? []).filter((item) => item.tenantId === tenantId),
    [smsDashboardQuery.data?.history, tenantId]
  )

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

  useEffect(() => {
    setTemplateText(currentTemplate?.messageTemplate ?? "")
  }, [currentTemplate?.messageTemplate])

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
  const updateTemplateMutation = useMutation({
    mutationFn: () =>
      updateTenantSmsTemplate(tenantId as string, selectedTemplateType, {
        message_template: effectiveTemplateText,
        variables: currentTemplate?.variables ?? [],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms", "templates", tenantId] })
      toast({ title: "Template SMS mis à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le template SMS", variant: "destructive" })
    },
  })
  const resetTemplateMutation = useMutation({
    mutationFn: () => resetTenantSmsTemplate(tenantId as string, selectedTemplateType),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms", "templates", tenantId] })
      setTemplateText(DEFAULT_SMS_TEMPLATES[selectedTemplateType])
      toast({ title: "Template SMS remis par défaut" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de réinitialiser le template", variant: "destructive" })
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
                <CardTitle>Configuration SMS école</CardTitle>
                <CardDescription>Activer ou désactiver la personnalisation des templates pour cette école.</CardDescription>
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
                <p className="text-xs text-muted-foreground">
                  Usage actuel: les SMS opérationnels actifs concernent principalement l&apos;absence élève vers parent.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Templates SMS</CardTitle>
                <CardDescription>Templates par défaut fournis, personnalisables si la fonction est activée.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {SMS_TEMPLATE_OPTIONS.map((item) => (
                    <Button key={item.type} type="button" variant={selectedTemplateType === item.type ? "default" : "outline"} onClick={() => setSelectedTemplateType(item.type)}>
                      {item.label}
                    </Button>
                  ))}
                </div>

                <textarea
                  value={effectiveTemplateText}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setTemplateText(event.target.value)}
                  rows={6}
                  placeholder="Template SMS"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  disabled={!config.canEditSmsTemplate}
                />

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{effectiveTemplateText.length} caractères</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => resetTemplateMutation.mutate()} disabled={resetTemplateMutation.isPending || !config.canEditSmsTemplate}>
                      Restaurer défaut
                    </Button>
                    <Button type="button" onClick={() => updateTemplateMutation.mutate()} disabled={updateTemplateMutation.isPending || !config.canEditSmsTemplate || effectiveTemplateText.trim().length < 5}>
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Historique SMS école</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schoolSmsHistory.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{new Date(row.date).toLocaleString("fr-FR")}</TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell>{row.recipientMasked}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell className="max-w-[360px] truncate">{row.message}</TableCell>
                        </TableRow>
                      ))}
                      {!smsDashboardQuery.isLoading && schoolSmsHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-sm text-muted-foreground">Aucun SMS enregistré pour cette école.</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
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
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Activité récente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Dernière connexion: <strong>{formatDateTime(school.usageStats.lastConnection)}</strong></p>
                <p>Utilisateurs totaux: <strong>{school.usageStats.nbUsers}</strong></p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}

      {schoolUsersQuery.isError || paymentsQuery.isError || tenantTemplatesQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Certaines données de configuration école n&apos;ont pas pu être chargées.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
