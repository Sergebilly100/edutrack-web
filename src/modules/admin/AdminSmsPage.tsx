import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { AlertTriangle, BarChart3, MessageSquare, Send, ShieldCheck, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import {
  getGlobalSmsTemplates,
  getSmsDashboard,
  getSmsPlatformAudit,
  getSmsPlatformConfig,
  type SmsTemplateType,
  type SmsProvider,
  updateGlobalSmsTemplate,
  updateSmsPlatformConfig,
} from "@/modules/admin/admin.api"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`
const PROVIDER_OPTIONS: Array<{ value: SmsProvider; label: string }> = [
  { value: "mock", label: "Mock (démo/test)" },
  { value: "infobip", label: "Infobip" },
  { value: "twilio", label: "Twilio" },
  { value: "orange_api", label: "Orange API" },
  { value: "custom", label: "Autre fournisseur" },
]
const GLOBAL_TEMPLATE_OPTIONS: Array<{ type: SmsTemplateType; label: string }> = [
  { type: "student_absent_parent", label: "Absence élève -> parent" },
  { type: "payment_reminder", label: "Relance paiement -> responsable école" },
]

export default function AdminSmsPage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const dashboardQuery = useQuery({ queryKey: ["admin", "sms", "dashboard"], queryFn: getSmsDashboard })
  const globalTemplatesQuery = useQuery({ queryKey: ["admin", "sms", "templates"], queryFn: getGlobalSmsTemplates })
  const platformConfigQuery = useQuery({ queryKey: ["admin", "sms", "platform-config"], queryFn: getSmsPlatformConfig })
  const platformAuditQuery = useQuery({ queryKey: ["admin", "sms", "platform-audit"], queryFn: () => getSmsPlatformAudit(40) })
  const [provider, setProvider] = useState<SmsProvider>("mock")
  const [apiBaseUrl, setApiBaseUrl] = useState("")
  const [senderId, setSenderId] = useState("EduTrack")
  const [fallbackSenderId, setFallbackSenderId] = useState("")
  const [defaultCountryCode, setDefaultCountryCode] = useState("+225")
  const [alertQuotaThresholdPct, setAlertQuotaThresholdPct] = useState("80")
  const [alertFailureThresholdCount, setAlertFailureThresholdCount] = useState("5")
  const [alertEmail, setAlertEmail] = useState("")
  const [smsMaintenanceMode, setSmsMaintenanceMode] = useState(false)
  const [smsMaintenanceMessage, setSmsMaintenanceMessage] = useState("Service SMS en maintenance")
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [selectedTemplateType, setSelectedTemplateType] = useState<SmsTemplateType>("student_absent_parent")
  const [selectedTemplateText, setSelectedTemplateText] = useState("")

  useEffect(() => {
    if (!platformConfigQuery.data) {
      return
    }
    setProvider(platformConfigQuery.data.provider)
    setApiBaseUrl(platformConfigQuery.data.apiBaseUrl ?? "")
    setSenderId(platformConfigQuery.data.senderId)
    setFallbackSenderId(platformConfigQuery.data.fallbackSenderId ?? "")
    setDefaultCountryCode(platformConfigQuery.data.defaultCountryCode)
    setAlertQuotaThresholdPct(String(platformConfigQuery.data.alertQuotaThresholdPct))
    setAlertFailureThresholdCount(String(platformConfigQuery.data.alertFailureThresholdCount))
    setAlertEmail(platformConfigQuery.data.alertEmail ?? "")
    setSmsMaintenanceMode(platformConfigQuery.data.smsMaintenanceMode)
    setSmsMaintenanceMessage(platformConfigQuery.data.smsMaintenanceMessage)
    setApiKeyInput("")
  }, [platformConfigQuery.data])

  useEffect(() => {
    const template = globalTemplatesQuery.data?.find((item) => item.type === selectedTemplateType)
    setSelectedTemplateText(template?.messageTemplate ?? "")
  }, [globalTemplatesQuery.data, selectedTemplateType])
  const selectedTemplate = useMemo(
    () => globalTemplatesQuery.data?.find((item) => item.type === selectedTemplateType) ?? null,
    [globalTemplatesQuery.data, selectedTemplateType]
  )

  const updatePlatformMutation = useMutation({
    mutationFn: () =>
      updateSmsPlatformConfig({
        provider,
        api_base_url: apiBaseUrl.trim() || undefined,
        sender_id: senderId.trim(),
        fallback_sender_id: fallbackSenderId.trim() ? fallbackSenderId.trim() : null,
        default_country_code: defaultCountryCode.trim(),
        alert_quota_threshold_pct: Number(alertQuotaThresholdPct),
        alert_failure_threshold_count: Number(alertFailureThresholdCount),
        alert_email: alertEmail.trim() ? alertEmail.trim() : null,
        sms_maintenance_mode: smsMaintenanceMode,
        sms_maintenance_message: smsMaintenanceMessage.trim(),
        ...(apiKeyInput.trim() ? { api_key: apiKeyInput.trim() } : {}),
      }),
    onSuccess: async () => {
      setApiKeyInput("")
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms", "platform-config"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms", "platform-audit"] })
      toast({ title: "Configuration SMS plateforme enregistrée" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la configuration SMS", variant: "destructive" })
    },
  })
  const updateGlobalTemplateMutation = useMutation({
    mutationFn: () =>
      updateGlobalSmsTemplate(selectedTemplateType, {
        message_template: selectedTemplateText.trim(),
        variables:
          globalTemplatesQuery.data?.find((item) => item.type === selectedTemplateType)?.variables ?? [],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms", "templates"] })
      toast({ title: "Template global SMS enregistré" })
    },
    onError: (error) => {
      const description =
        axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible d'enregistrer le template global."
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })
  const quotaAlerts = useMemo(
    () =>
      (dashboardQuery.data?.bySchool ?? [])
        .filter((row) => row.usedPct >= 80)
        .sort((a, b) => b.usedPct - a.usedPct),
    [dashboardQuery.data?.bySchool]
  )
  const failedHistory = useMemo(
    () =>
      (dashboardQuery.data?.history ?? [])
        .filter((row) => row.status.toLowerCase() === "failed")
        .slice(0, 20),
    [dashboardQuery.data?.history]
  )
  const byType = useMemo(() => {
    const entries = Object.entries(
      (dashboardQuery.data?.history ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.type] = (acc[row.type] ?? 0) + 1
        return acc
      }, {})
    )
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [dashboardQuery.data?.history])
  const byStatus = useMemo(() => {
    const entries = Object.entries(
      (dashboardQuery.data?.history ?? []).reduce<Record<string, number>>((acc, row) => {
        const normalized = row.status.toLowerCase()
        acc[normalized] = (acc[normalized] ?? 0) + 1
        return acc
      }, {})
    )
    return entries.sort((a, b) => b[1] - a[1])
  }, [dashboardQuery.data?.history])

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "super_admin") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Cette page est réservée au super admin.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">SMS & Notifs</h1>
        <p className="text-sm text-muted-foreground">Pilotage plateforme SMS (fourniture, qualité, conformité, consommation).</p>
      </header>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue globale</TabsTrigger>
          <TabsTrigger value="quality">Qualité & incidents</TabsTrigger>
          <TabsTrigger value="governance">Gouvernance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="SMS ce mois" value={dashboardQuery.data?.sentThisMonth ?? 0} icon={<Send className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
            <StatCard title="Taux livraison" value={`${dashboardQuery.data?.deliveryRate ?? 0}%`} icon={<BarChart3 className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
            <StatCard title="Écoles actives" value={dashboardQuery.data?.activeSchools ?? 0} icon={<MessageSquare className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
            <StatCard title="Coût estimé" value={formatFcfa(dashboardQuery.data?.estimatedCostFcfa ?? 0)} icon={<Wallet className="h-4 w-4" />} loading={dashboardQuery.isLoading} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Usage SMS par école</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>École</TableHead>
                      <TableHead>SMS envoyés</TableHead>
                      <TableHead>Quota</TableHead>
                      <TableHead>% utilisé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dashboardQuery.data?.bySchool ?? []).map((row) => (
                      <TableRow key={row.tenantId}>
                        <TableCell>{row.school}</TableCell>
                        <TableCell>{row.sent}</TableCell>
                        <TableCell>{row.quota}</TableCell>
                        <TableCell>{row.usedPct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Écoles proches quota
                </CardTitle>
                <CardDescription>Établissements à 80%+ de leur quota mensuel.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>École</TableHead>
                        <TableHead>Envoyés</TableHead>
                        <TableHead>Quota</TableHead>
                        <TableHead>%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotaAlerts.map((row) => (
                        <TableRow key={row.tenantId}>
                          <TableCell>{row.school}</TableCell>
                          <TableCell>{row.sent}</TableCell>
                          <TableCell>{row.quota}</TableCell>
                          <TableCell>{row.usedPct}%</TableCell>
                        </TableRow>
                      ))}
                      {!dashboardQuery.isLoading && quotaAlerts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Aucun dépassement de seuil détecté.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Répartition par statut</CardTitle>
                <CardDescription>Derniers messages consolidés (global plateforme).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {byStatus.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {!dashboardQuery.isLoading && byStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée de statut SMS.</p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Incidents récents</CardTitle>
              <CardDescription>Derniers SMS en échec pour suivi opérationnel.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>École</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedHistory.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.date).toLocaleString("fr-FR")}</TableCell>
                        <TableCell>{row.school}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.recipientMasked}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{row.message}</TableCell>
                      </TableRow>
                    ))}
                    {!dashboardQuery.isLoading && failedHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">
                          Aucun incident SMS sur les dernières entrées.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates globaux SMS</CardTitle>
              <CardDescription>
                Modèles maintenus par le super admin. Seuls les templates absence élève et relance paiement sont actifs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {GLOBAL_TEMPLATE_OPTIONS.map((item) => (
                  <Button
                    key={item.type}
                    type="button"
                    variant={selectedTemplateType === item.type ? "default" : "outline"}
                    onClick={() => setSelectedTemplateType(item.type)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <textarea
                value={selectedTemplateText}
                onChange={(event) => setSelectedTemplateText(event.target.value)}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={globalTemplatesQuery.isLoading || globalTemplatesQuery.isError}
              />
              {globalTemplatesQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Chargement des templates globaux…</p>
              ) : null}
              {globalTemplatesQuery.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>Impossible de charger les templates globaux SMS.</AlertDescription>
                </Alert>
              ) : null}
              {!globalTemplatesQuery.isLoading && !globalTemplatesQuery.isError && selectedTemplate === null ? (
                <Alert>
                  <AlertDescription>
                    Aucun template global trouvé pour ce type. Saisissez un contenu puis enregistrez pour l&apos;initialiser.
                  </AlertDescription>
                </Alert>
              ) : null}
              {selectedTemplate ? (
                <p className="text-xs text-muted-foreground">
                  Dernière mise à jour: {new Date(selectedTemplate.updatedAt).toLocaleString("fr-FR")}
                </p>
              ) : null}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {selectedTemplateText.trim().length} caractères
                </p>
                <Button
                  type="button"
                  onClick={() => updateGlobalTemplateMutation.mutate()}
                  disabled={
                    globalTemplatesQuery.isLoading ||
                    globalTemplatesQuery.isError ||
                    updateGlobalTemplateMutation.isPending ||
                    selectedTemplateText.trim().length < 5
                  }
                >
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Configuration SMS plateforme
                </CardTitle>
                <CardDescription>Paramètres globaux EduTrack: fournisseur, clé API, sender, alertes, maintenance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Fournisseur</p>
                  <div className="space-y-2">
                    <Label>Fournisseur SMS</Label>
                    <Select value={provider} onValueChange={(value) => setProvider(value as SmsProvider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>API base URL</Label>
                    <Input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} placeholder="https://xxxx.api.infobip.com" />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Sécurité</p>
                  <div className="space-y-2">
                    <Label>SMS API key</Label>
                    <Input
                      type="password"
                      value={apiKeyInput}
                      onChange={(event) => setApiKeyInput(event.target.value)}
                      placeholder={platformConfigQuery.data?.hasApiKey ? "Laisser vide pour conserver la clé actuelle" : "Entrer la clé API"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Clé actuelle: {platformConfigQuery.data?.hasApiKey ? `***${platformConfigQuery.data.apiKeyLast4}` : "non configurée"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Expéditeur</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sender ID principal</Label>
                      <Input value={senderId} onChange={(event) => setSenderId(event.target.value)} placeholder="EduTrack" />
                    </div>
                    <div className="space-y-2">
                      <Label>Sender ID secondaire</Label>
                      <Input value={fallbackSenderId} onChange={(event) => setFallbackSenderId(event.target.value)} placeholder="Facultatif" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Indicatif par défaut</Label>
                    <Input value={defaultCountryCode} onChange={(event) => setDefaultCountryCode(event.target.value)} placeholder="+225" />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Alerting</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Seuil quota (%)</Label>
                      <Input
                        type="number"
                        value={alertQuotaThresholdPct}
                        onChange={(event) => setAlertQuotaThresholdPct(event.target.value)}
                        min={1}
                        max={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Seuil incidents (nb)</Label>
                      <Input
                        type="number"
                        value={alertFailureThresholdCount}
                        onChange={(event) => setAlertFailureThresholdCount(event.target.value)}
                        min={1}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email alertes</Label>
                    <Input value={alertEmail} onChange={(event) => setAlertEmail(event.target.value)} placeholder="ops@edutrack.ci" />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Maintenance</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sms-maintenance"
                      checked={smsMaintenanceMode}
                      onCheckedChange={(checked) => setSmsMaintenanceMode(Boolean(checked))}
                    />
                    <Label htmlFor="sms-maintenance">Activer la maintenance SMS globale</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Message maintenance SMS</Label>
                    <Input
                      value={smsMaintenanceMessage}
                      onChange={(event) => setSmsMaintenanceMessage(event.target.value)}
                      placeholder="Service SMS en maintenance"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => updatePlatformMutation.mutate()}
                  disabled={updatePlatformMutation.isPending || platformConfigQuery.isLoading}
                >
                  Enregistrer la gouvernance SMS
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit admin SMS</CardTitle>
                <CardDescription>Traçabilité des changements de configuration plateforme.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Détails</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(platformAuditQuery.data ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.createdAt).toLocaleString("fr-FR")}</TableCell>
                          <TableCell>{item.action}</TableCell>
                          <TableCell>{item.adminId ?? "-"}</TableCell>
                          <TableCell className="max-w-[320px] truncate">{JSON.stringify(item.details)}</TableCell>
                        </TableRow>
                      ))}
                      {!platformAuditQuery.isLoading && (platformAuditQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Aucun événement d&apos;audit SMS.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
                {platformAuditQuery.isError ? (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>Impossible de charger l&apos;audit SMS.</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Top types de messages</CardTitle>
              <CardDescription>Distribution des types observés sur l&apos;historique consolidé.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {byType.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{type}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {!dashboardQuery.isLoading && byType.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée de type SMS disponible.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {dashboardQuery.isError || platformConfigQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les données SMS.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
