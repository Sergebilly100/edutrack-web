import { useMemo, useState, type ChangeEvent } from "react"
import { Navigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BarChart3, MessageSquare, Send, Wallet } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import {
  getGlobalSmsTemplates,
  getSmsDashboard,
  type SmsTemplateType,
  updateGlobalSmsTemplate,
} from "@/modules/admin/admin.api"
import { StatCard } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const TEMPLATE_OPTIONS: SmsTemplateType[] = ["teacher_absent_director", "student_absent_parent", "payment_reminder", "teacher_late_director"]

export default function AdminSmsPage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const dashboardQuery = useQuery({ queryKey: ["admin", "sms", "dashboard"], queryFn: getSmsDashboard })
  const templatesQuery = useQuery({ queryKey: ["admin", "sms", "templates"], queryFn: getGlobalSmsTemplates })

  const [selectedType, setSelectedType] = useState<SmsTemplateType>("teacher_absent_director")
  const currentTemplate = useMemo(
    () => templatesQuery.data?.find((item) => item.type === selectedType),
    [selectedType, templatesQuery.data]
  )
  const [templateText, setTemplateText] = useState("")

  const updateTemplateMutation = useMutation({
    mutationFn: (payload: { type: SmsTemplateType; message: string }) =>
      updateGlobalSmsTemplate(payload.type, { message_template: payload.message, variables: [] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "sms", "templates"] })
      toast({ title: "Template mis à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le template", variant: "destructive" })
    },
  })

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
        <p className="text-sm text-muted-foreground">Pilotage global des SMS et templates.</p>
      </header>

      <Tabs defaultValue="stats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stats">Statistiques SMS</TabsTrigger>
          <TabsTrigger value="templates">Templates SMS</TabsTrigger>
          <TabsTrigger value="history">Historique SMS</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
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

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates globaux</CardTitle>
              <CardDescription>Édition des messages par type.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_OPTIONS.map((type) => (
                  <Button key={type} type="button" variant={selectedType === type ? "default" : "outline"} onClick={() => {
                    setSelectedType(type)
                    setTemplateText(templatesQuery.data?.find((item) => item.type === type)?.messageTemplate ?? "")
                  }}>
                    {type}
                  </Button>
                ))}
              </div>

              <textarea
                value={templateText || currentTemplate?.messageTemplate || ""}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setTemplateText(event.target.value)}
                rows={6}
                placeholder="Message template"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{(templateText || currentTemplate?.messageTemplate || "").length} caractères</p>
                <Button
                  type="button"
                  onClick={() => updateTemplateMutation.mutate({ type: selectedType, message: templateText || currentTemplate?.messageTemplate || "" })}
                  disabled={updateTemplateMutation.isPending || !(templateText || currentTemplate?.messageTemplate)}
                >
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique global</CardTitle>
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
                    {(dashboardQuery.data?.history ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.date).toLocaleString("fr-FR")}</TableCell>
                        <TableCell>{row.school}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.recipientMasked}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{row.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {dashboardQuery.isError || templatesQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les données SMS.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
