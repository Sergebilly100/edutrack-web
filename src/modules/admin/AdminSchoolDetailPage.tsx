import { useEffect } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Save } from "lucide-react"
import { useForm } from "react-hook-form"
import { isAxiosError } from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import {
  getSchoolDetails,
  updateSchoolConfig,
  type SchoolDetailsResponse,
  type TenantPlan,
  type TenantStatus,
  type UpdateSchoolConfigPayload,
} from "@/modules/admin/admin.api"
import { useAuthStore } from "@/shared/store/auth.store"

const PLAN_OPTIONS: TenantPlan[] = ["essential", "pro", "establishment"]

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const statusLabel: Record<TenantStatus, string> = {
  active: "active",
  cancelled: "cancelled",
  suspended: "suspended",
  trial: "trial",
}

type SchoolConfigFormValues = {
  plan: TenantPlan
  maxAdminPositions: string
}

const getErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    return (error.response?.data as { error?: string } | undefined)?.error ?? "Erreur API"
  }
  return error instanceof Error ? error.message : "Erreur inconnue"
}

function SchoolUsageCards({ school }: { school: SchoolDetailsResponse }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Connexions / 7j</CardDescription>
          <CardTitle className="text-2xl">{school.usageStats.activeUsers7d}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Nombre de profs</CardDescription>
          <CardTitle className="text-2xl">{school.usageStats.teachersCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Nombre d&apos;élèves</CardDescription>
          <CardTitle className="text-2xl">{school.usageStats.studentsCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Pointages / 30j</CardDescription>
          <CardTitle className="text-2xl">{school.usageStats.attendanceRecords30d}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}

export default function AdminSchoolDetailPage() {
  const user = useAuthStore((state) => state.user)
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const schoolQuery = useQuery({
    queryKey: ["admin", "school-detail", tenantId],
    queryFn: () => getSchoolDetails(tenantId as string),
    enabled: Boolean(tenantId),
  })

  const form = useForm<SchoolConfigFormValues>({
    defaultValues: {
      plan: "essential",
      maxAdminPositions: "5",
    },
  })

  const school = schoolQuery.data
  const canSuspend = school?.metadata.status !== "suspended"
  const canActivate = school?.metadata.status === "suspended"

  useEffect(() => {
    if (!school) {
      return
    }

    form.reset({
      plan: school.metadata.plan,
      maxAdminPositions: String(school.metadata.maxAdminPositions),
    })
  }, [form, school])

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateSchoolConfigPayload) =>
      updateSchoolConfig(tenantId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "school-detail", tenantId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "schools"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] })
      toast({ title: "Configuration mise à jour" })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: getErrorMessage(error),
        variant: "destructive",
      })
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

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-2 px-0" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{school?.metadata.name ?? "Détail école"}</h1>
          <p className="text-sm text-muted-foreground">
            {school?.metadata.subdomain ? `${school.metadata.subdomain}.edutrack.ci` : "Chargement..."}
          </p>
        </div>
        {school ? (
          <Badge variant={school.metadata.status === "active" ? "default" : "secondary"}>
            {statusLabel[school.metadata.status]}
          </Badge>
        ) : null}
      </div>

      {schoolQuery.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : null}

      {schoolQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les informations de cette école.</AlertDescription>
        </Alert>
      ) : null}

      {school ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Informations école</CardTitle>
                <CardDescription>Configuration globale du tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Ville:</span> {school.metadata.city ?? "Non renseignée"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {school.metadata.teachingType ?? "Non renseigné"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Créée le:</span>{" "}
                    {new Date(school.metadata.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Dernière mise à jour:</span>{" "}
                    {new Date(school.metadata.updatedAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select
                      value={form.watch("plan")}
                      onValueChange={(value) => form.setValue("plan", value as TenantPlan)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLAN_OPTIONS.map((plan) => (
                          <SelectItem key={plan} value={plan}>
                            {plan}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAdminPositions">max_admin_positions</Label>
                    <Input
                      id="maxAdminPositions"
                      type="number"
                      min={1}
                      max={50}
                      value={form.watch("maxAdminPositions")}
                      onChange={(event) => form.setValue("maxAdminPositions", event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-2"
                    onClick={() => {
                      const parsedMax = Number(form.getValues("maxAdminPositions"))
                      updateMutation.mutate({
                        plan: form.getValues("plan"),
                        max_admin_positions: Number.isFinite(parsedMax) ? parsedMax : undefined,
                      })
                    }}
                    disabled={updateMutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateMutation.mutate({ status: canSuspend ? "suspended" : "active" })}
                    disabled={updateMutation.isPending || (!canSuspend && !canActivate)}
                  >
                    {canSuspend ? "Suspendre" : "Activer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <SchoolUsageCards school={school} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">MRR école</CardTitle>
                <CardDescription>Revenu mensuel récurrent tenant</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatFcfa(school.usageStats.mrrFcfa)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
