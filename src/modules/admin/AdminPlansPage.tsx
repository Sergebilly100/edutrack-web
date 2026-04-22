import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import {
  getPlanCatalog,
  type PlanCatalogItem,
  type TenantPlan,
  updatePlanCatalog,
} from "@/modules/admin/admin.api"
import { useAuthStore } from "@/shared/store/auth.store"

type EditablePlan = {
  monthlyPriceFcfa: string
  annualPriceFcfa: string
  defaultBillingCycle: "monthly" | "annual"
  maxUsers: string
  maxAdminPositions: string
  maxSmsPerMonth: string
}

const toEditablePlan = (item: PlanCatalogItem): EditablePlan => ({
  monthlyPriceFcfa: String(item.monthlyPriceFcfa),
  annualPriceFcfa: String(item.annualPriceFcfa),
  defaultBillingCycle: item.defaultBillingCycle,
  maxUsers: String(item.maxUsers),
  maxAdminPositions: String(item.maxAdminPositions),
  maxSmsPerMonth: String(item.maxSmsPerMonth),
})

export default function AdminPlansPage() {
  const user = useAuthStore((state) => state.user)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [edits, setEdits] = useState<Record<TenantPlan, EditablePlan>>({
    essential: {
      monthlyPriceFcfa: "0",
      annualPriceFcfa: "0",
      defaultBillingCycle: "monthly",
      maxUsers: "5",
      maxAdminPositions: "5",
      maxSmsPerMonth: "2000",
    },
    pro: {
      monthlyPriceFcfa: "0",
      annualPriceFcfa: "0",
      defaultBillingCycle: "monthly",
      maxUsers: "20",
      maxAdminPositions: "15",
      maxSmsPerMonth: "6000",
    },
    establishment: {
      monthlyPriceFcfa: "0",
      annualPriceFcfa: "0",
      defaultBillingCycle: "monthly",
      maxUsers: "50",
      maxAdminPositions: "30",
      maxSmsPerMonth: "12000",
    },
  })

  const plansQuery = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: getPlanCatalog,
  })

  useEffect(() => {
    const items = plansQuery.data
    if (!items) {
      return
    }
    setEdits((prev) => {
      const next = { ...prev }
      items.forEach((item) => {
        next[item.plan] = toEditablePlan(item)
      })
      return next
    })
  }, [plansQuery.data])

  const updateMutation = useMutation({
    mutationFn: ({ plan, data }: { plan: TenantPlan; data: EditablePlan }) =>
      updatePlanCatalog(plan, {
        monthly_price_fcfa: Number(data.monthlyPriceFcfa),
        annual_price_fcfa: Number(data.annualPriceFcfa),
        default_billing_cycle: data.defaultBillingCycle,
        max_users: Number(data.maxUsers),
        max_admin_positions: Number(data.maxAdminPositions),
        max_sms_per_month: Number(data.maxSmsPerMonth),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "plans"] })
      toast({ title: "Plan mis à jour" })
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour ce plan", variant: "destructive" })
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
        <h1 className="text-2xl font-semibold tracking-tight">Plan & Tarifs</h1>
        <p className="text-sm text-muted-foreground">
          Configuration des prix, échéances et limites par plan.
        </p>
      </header>

      {plansQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {(plansQuery.data ?? []).map((planItem) => {
          const draft = edits[planItem.plan]
          return (
            <Card key={planItem.plan} className="shadow-sm">
              <CardHeader>
                <CardTitle className="capitalize">{planItem.plan}</CardTitle>
                <CardDescription>
                  Dernière mise à jour: {new Date(planItem.updatedAt).toLocaleString("fr-FR")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tarif mensuel (FCFA)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.monthlyPriceFcfa}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [planItem.plan]: { ...prev[planItem.plan], monthlyPriceFcfa: event.target.value },
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tarif annuel (FCFA)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.annualPriceFcfa}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [planItem.plan]: { ...prev[planItem.plan], annualPriceFcfa: event.target.value },
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Échéance par défaut</Label>
                  <Select
                    value={draft.defaultBillingCycle}
                    onValueChange={(value) =>
                      setEdits((prev) => ({
                        ...prev,
                        [planItem.plan]: { ...prev[planItem.plan], defaultBillingCycle: value as "monthly" | "annual" },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensuelle</SelectItem>
                      <SelectItem value="annual">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nombre max utilisateurs</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.maxUsers}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [planItem.plan]: { ...prev[planItem.plan], maxUsers: event.target.value },
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nombre max staff admin</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.maxAdminPositions}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [planItem.plan]: { ...prev[planItem.plan], maxAdminPositions: event.target.value },
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quota SMS mensuel</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.maxSmsPerMonth}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [planItem.plan]: { ...prev[planItem.plan], maxSmsPerMonth: event.target.value },
                      }))
                    }
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ plan: planItem.plan, data: draft })}
                >
                  Enregistrer ce plan
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {plansQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les plans tarifaires.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
