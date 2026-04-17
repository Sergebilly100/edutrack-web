import { useEffect, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
  addSchoolPayment,
  getSchoolDetails,
  getSchoolPayments,
  updateSchoolConfig,
  type SchoolDetailsResponse,
  type TenantPlan,
  type TenantStatus,
  type TeachingType,
} from "@/modules/admin/admin.api"
import { useAuthStore } from "@/shared/store/auth.store"

const PLAN_OPTIONS: TenantPlan[] = ["essential", "pro", "establishment"]
const TEACHING_OPTIONS: TeachingType[] = ["primaire", "secondaire", "superieur", "mixte"]
const STATUS_OPTIONS: TenantStatus[] = ["trial", "active", "suspended", "cancelled"]

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

export default function AdminSchoolDetailPage() {
  const user = useAuthStore((state) => state.user)
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const schoolQuery = useQuery({
    queryKey: ["admin", "school-detail", tenantId],
    queryFn: () => getSchoolDetails(tenantId as string),
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
      await queryClient.invalidateQueries({ queryKey: ["admin", "revenue", "summary"] })
      setPayment((prev) => ({ ...prev, amount: "", reference: "", periodFrom: "", periodTo: "" }))
      toast({ title: "Paiement enregistré" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le paiement", variant: "destructive" })
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

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center justify-between">
        <div>
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
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="subscription">Abonnement & Paiements</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuration école</CardTitle>
                <CardDescription>Vocabulaire, limites et permissions de l&apos;établissement.</CardDescription>
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
                    <SelectContent>
                      {TEACHING_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
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
                    <SelectContent>
                      {PLAN_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={config.status} onValueChange={(value) => setConfig((prev) => ({ ...prev, status: value as TenantStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
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
                  <Checkbox
                    id="can-edit-template"
                    checked={config.canEditSmsTemplate}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, canEditSmsTemplate: Boolean(checked) }))}
                  />
                  <Label htmlFor="can-edit-template">L&apos;école peut modifier ses templates SMS</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="can-export-data"
                    checked={config.canExportData}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, canExportData: Boolean(checked) }))}
                  />
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

          <TabsContent value="subscription" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card><CardHeader><CardDescription>Plan actuel</CardDescription><CardTitle>{school.metadata.plan}</CardTitle></CardHeader></Card>
              <Card><CardHeader><CardDescription>Statut</CardDescription><CardTitle>{school.metadata.status}</CardTitle></CardHeader></Card>
              <Card><CardHeader><CardDescription>Prochaine échéance</CardDescription><CardTitle>{school.usageStats.lastConnection ? new Date(school.usageStats.lastConnection).toLocaleDateString("fr-FR") : "-"}</CardTitle></CardHeader></Card>
              <Card><CardHeader><CardDescription>MRR</CardDescription><CardTitle>{formatFcfa(school.usageStats.mrrFcfa)}</CardTitle></CardHeader></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historique paiements</CardTitle>
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
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(paymentsQuery.data ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.date).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell>{formatFcfa(item.amountFcfa)}</TableCell>
                          <TableCell>{item.provider}</TableCell>
                          <TableCell>{item.reference ?? "-"}</TableCell>
                          <TableCell>{item.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Enregistrer un paiement manuel</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Input type="date" value={payment.date} onChange={(event) => setPayment((prev) => ({ ...prev, date: event.target.value }))} />
                <Input type="number" placeholder="Montant FCFA" value={payment.amount} onChange={(event) => setPayment((prev) => ({ ...prev, amount: event.target.value }))} />
                <Select value={payment.provider} onValueChange={(value) => setPayment((prev) => ({ ...prev, provider: value as "manual" | "mtn_momo" | "orange_money" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">manual</SelectItem>
                    <SelectItem value="mtn_momo">mtn_momo</SelectItem>
                    <SelectItem value="orange_money">orange_money</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Référence" value={payment.reference} onChange={(event) => setPayment((prev) => ({ ...prev, reference: event.target.value }))} />
                <Input type="date" placeholder="Période de" value={payment.periodFrom} onChange={(event) => setPayment((prev) => ({ ...prev, periodFrom: event.target.value }))} />
                <Input type="date" placeholder="Période à" value={payment.periodTo} onChange={(event) => setPayment((prev) => ({ ...prev, periodTo: event.target.value }))} />
                <div className="md:col-span-3">
                  <Button onClick={() => addPaymentMutation.mutate()} disabled={addPaymentMutation.isPending || !payment.amount}>+ Enregistrer un paiement</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SMS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Quota mensuel: <strong>{config.maxSmsPerMonth}</strong></p>
                <p>Personnalisation templates école: <strong>{config.canEditSmsTemplate ? "Autorisée" : "Désactivée"}</strong></p>
                <p>Termes en vigueur: <strong>{config.studentLabel}</strong> / <strong>{config.directorTitle}</strong></p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Utilisateurs</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{school.usageStats.nbUsers} utilisateurs actifs.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Statistiques</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Utilisateurs actifs 7j: <strong>{school.usageStats.activeUsers7d}</strong></p>
                <p>Professeurs: <strong>{school.usageStats.teachersCount}</strong></p>
                <p>Élèves: <strong>{school.usageStats.studentsCount}</strong></p>
                <p>Pointages 30j: <strong>{school.usageStats.attendanceRecords30d}</strong></p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
