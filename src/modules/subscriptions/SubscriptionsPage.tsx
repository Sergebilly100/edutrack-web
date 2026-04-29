import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"

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
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { listStudents } from "@/modules/students/students.api"
import {
  CreateSubscriptionModal,
  RenewSubscriptionModal,
  SubscriptionStatusBadge,
} from "@/modules/subscriptions/components"
import {
  cancelSubscription,
  createSubscriptionParent,
  getSmsFeatureSettings,
  listSubscriptionParents,
  renewSubscriptionParent,
  resetParentSubscriptionPassword,
  type SubscriptionListItem,
  type SubscriptionStatus,
} from "@/modules/subscriptions/subscriptions.api"
import { EmptyState, PageLayout } from "@/shared/components"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { todayInBusinessTimezone } from "@/shared/lib/business-date"

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`))

type FilterStatus = "all" | SubscriptionStatus

export default function SubscriptionsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()

  const [status, setStatus] = useState<FilterStatus>("all")
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [renewTarget, setRenewTarget] = useState<SubscriptionListItem | null>(null)
  const [cancelTarget, setCancelTarget] = useState<SubscriptionListItem | null>(null)
  const [newPassword, setNewPassword] = useState<string | null>(null)

  const canCreate = hasPermission("subscriptions.create")
  const canRenew = hasPermission("subscriptions.renew")
  const canCancel = hasPermission("subscriptions.cancel")

  const featureQuery = useQuery({
    queryKey: ["subscriptions", "feature-settings"],
    queryFn: getSmsFeatureSettings,
  })

  const parentsQuery = useQuery({
    queryKey: ["subscriptions", "parents", status, search],
    queryFn: () =>
      listSubscriptionParents({
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
      }),
    refetchInterval: 0,
    enabled: featureQuery.data?.is_enabled === true,
  })

  const studentsQuery = useQuery({
    queryKey: ["subscriptions", "students-catalog"],
    queryFn: async () => {
      const result = await listStudents({ page: 1, limit: 200 })
      return result.data.map((student) => ({
        id: student.id,
        fullName: `${student.lastName} ${student.firstName}`.trim(),
        className: student.className,
      }))
    },
    enabled: featureQuery.data?.is_enabled === true,
  })

  const createMutation = useMutation({
    mutationFn: createSubscriptionParent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"] })
    },
  })

  const renewMutation = useMutation({
    mutationFn: ({ parentId, payload }: { parentId: string; payload: { duration_months: 1 | 2 | 3; payment_method: "cash" | "momo_mtn" | "momo_orange"; paid_now: boolean } }) =>
      renewSubscriptionParent(parentId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"] })
      toast({ title: "Abonnement renouvelé" })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ parentId, subscriptionId }: { parentId: string; subscriptionId: string }) =>
      cancelSubscription(parentId, subscriptionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"] })
      toast({ title: "Abonnement annulé" })
      setCancelTarget(null)
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: resetParentSubscriptionPassword,
    onSuccess: (result) => {
      setNewPassword(result.new_temp_password)
    },
  })

  const items = parentsQuery.data?.data ?? []

  const activeCount = useMemo(
    () => items.filter((item) => item.latest_subscription?.status === "active").length,
    [items]
  )

  if (featureQuery.isLoading) {
    return <PageLayout title="Abonnements parents">Chargement…</PageLayout>
  }

  if (!featureQuery.data?.is_enabled) {
    return (
      <PageLayout title="Abonnements parents">
        <EmptyState
          title="Fonctionnalité non activée"
          message="Cette fonctionnalité n'est pas activée pour votre école."
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Abonnements parents"
      subtitle={`(${activeCount} actifs)`}
      actions={
        canCreate ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Nouvel abonnement
          </Button>
        ) : null
      }
    >
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as FilterStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="expired">Expiré</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Recherche</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom parent ou téléphone"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 md:hidden">
        {items.map((item) => {
          const latest = item.latest_subscription
          return (
            <Card key={item.parent_id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.full_name}</p>
                    <p className="text-xs text-muted-foreground">{item.phone}</p>
                  </div>
                  {latest ? <SubscriptionStatusBadge status={latest.status} ends_at={latest.ends_at} /> : <Badge variant="outline">Sans abonnement</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{item.students.length} élève(s)</p>
                <div className="flex flex-wrap gap-2">
                  {canRenew && latest ? (
                    <Button size="sm" variant="outline" onClick={() => setRenewTarget(item)}>
                      Renouveler
                    </Button>
                  ) : null}
                  {canCreate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetPasswordMutation.mutate(item.parent_id)}
                      disabled={resetPasswordMutation.isPending}
                    >
                      Réinitialiser mdp
                    </Button>
                  ) : null}
                  {canCancel && latest?.status === "active" ? (
                    <Button size="sm" variant="destructive" onClick={() => setCancelTarget(item)}>
                      Annuler
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {parentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des abonnements…</p>
      ) : null}
      {parentsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger la liste des abonnements.</AlertDescription>
        </Alert>
      ) : null}

      <section className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left">Parent</th>
              <th className="px-3 py-2 text-left">Élèves</th>
              <th className="px-3 py-2 text-left">Durée</th>
              <th className="px-3 py-2 text-left">Montant</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Expire le</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const latest = item.latest_subscription
              return (
                <tr key={item.parent_id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{item.full_name}</p>
                    <p className="text-xs text-muted-foreground">{item.phone}</p>
                  </td>
                  <td className="px-3 py-2">{item.students.length}</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">{latest?.monthly_amount_fcfa ? formatFcfa(latest.monthly_amount_fcfa) : "-"}</td>
                  <td className="px-3 py-2">{latest ? <SubscriptionStatusBadge status={latest.status} ends_at={latest.ends_at} /> : "-"}</td>
                  <td className="px-3 py-2">{latest?.ends_at ? formatDate(latest.ends_at) : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      {canRenew && latest ? (
                        <Button size="sm" variant="outline" onClick={() => setRenewTarget(item)}>
                          Renouveler
                        </Button>
                      ) : null}
                      {canCreate ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetPasswordMutation.mutate(item.parent_id)}
                          disabled={resetPasswordMutation.isPending}
                        >
                          Réinitialiser mdp
                        </Button>
                      ) : null}
                      {canCancel && latest?.status === "active" ? (
                        <Button size="sm" variant="destructive" onClick={() => setCancelTarget(item)}>
                          Annuler
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {items.length === 0 && !parentsQuery.isLoading ? (
        <EmptyState title="Aucun abonnement" message="Aucune souscription ne correspond aux filtres." />
      ) : null}

      {newPassword ? (
        <Alert>
          <AlertDescription>Nouveau mot de passe temporaire: <strong>{newPassword}</strong></AlertDescription>
        </Alert>
      ) : null}

      <CreateSubscriptionModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        students={studentsQuery.data ?? []}
        smsUnitPriceFcfa={featureQuery.data.sms_unit_price_fcfa}
        existingPhones={items.map((item) => item.phone)}
        onSubmit={async (payload) => createMutation.mutateAsync(payload)}
      />

      <RenewSubscriptionModal
        open={Boolean(renewTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRenewTarget(null)
          }
        }}
        parentFullName={renewTarget?.full_name ?? ""}
        studentsCount={renewTarget?.students.length ?? 0}
        currentEndsAt={renewTarget?.latest_subscription?.ends_at ?? todayInBusinessTimezone()}
        unitPriceFcfa={featureQuery.data.sms_unit_price_fcfa ?? 0}
        isSubmitting={renewMutation.isPending}
        onSubmit={async (payload) => {
          if (!renewTarget) {
            return
          }
          await renewMutation.mutateAsync({ parentId: renewTarget.parent_id, payload })
          setRenewTarget(null)
        }}
      />

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cet abonnement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action mettra immédiatement le statut à "annulé".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fermer</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const item = cancelTarget
                const subscription = item?.latest_subscription
                if (!item || !subscription) {
                  return
                }
                cancelMutation.mutate({ parentId: item.parent_id, subscriptionId: subscription.id })
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
