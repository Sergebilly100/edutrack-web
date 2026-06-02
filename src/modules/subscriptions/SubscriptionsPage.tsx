import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, MoreHorizontal, Search } from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  CreateSubscriptionModal,
  RenewSubscriptionModal,
  SubscriptionStatusBadge,
} from "@/modules/subscriptions/components"
import {
  cancelSubscription,
  createSubscriptionParent,
  formatPaymentMethod,
  getParentSubscriptionDetails,
  getSmsFeatureSettings,
  listSubscriptionCreators,
  listSubscriptionParents,
  renewSubscriptionParent,
  resetParentSubscriptionPassword,
  updateParentSubscriptionContact,
  type SubscriptionListItem,
  type SubscriptionStatus,
} from "@/modules/subscriptions/subscriptions.api"
import { ContextualHelp, EmptyState, OfflineGuard, PageLayout } from "@/shared/components"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { todayInBusinessTimezone } from "@/shared/lib/business-date"

const formatFcfa = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`))

type FilterStatus = "all" | SubscriptionStatus
const toMonth = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
const monthLabel = (month: string) => {
  const [year, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, (m ?? 1) - 1, 1))
  )
}

type SubscriptionActionsProps = {
  item: SubscriptionListItem
  canCreate: boolean
  canRenew: boolean
  canCancel: boolean
  resetPasswordPending: boolean
  onDetails: (item: SubscriptionListItem) => void
  onRenew: (item: SubscriptionListItem) => void
  onEditContact: (item: SubscriptionListItem) => void
  onResetPassword: (item: SubscriptionListItem) => void
  onCancel: (item: SubscriptionListItem) => void
  compact?: boolean
}

function SubscriptionActions({
  item,
  canCreate,
  canRenew,
  canCancel,
  resetPasswordPending,
  onDetails,
  onRenew,
  onEditContact,
  onResetPassword,
  onCancel,
  compact = false,
}: SubscriptionActionsProps) {
  const latest = item.latest_subscription
  const canShowRenew = canRenew && Boolean(latest)
  const canShowCancel = canCancel && latest?.status === "active"
  const canEditContact = canCreate && latest?.status === "active"
  const hasMenuActions = canCreate || canShowCancel || (compact && canShowRenew)

  return (
    <div className={compact ? "grid grid-cols-[1fr_auto] gap-2" : "inline-flex items-center gap-2"}>

      <Button size="sm" variant="outline" onClick={() => onDetails(item)}>
        Voir dossier
      </Button>

      {!compact && canShowRenew ? (
        <OfflineGuard>
          <Button size="sm" variant="outline" onClick={() => onRenew(item)}>
            Renouveler l'accès
          </Button>
        </OfflineGuard>
      ) : null}

      {hasMenuActions && latest?.status !== "cancelled" && latest?.status !== "expired" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={compact ? "w-10 px-0" : "px-2"}
              aria-label={`Actions pour ${item.full_name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {compact && canShowRenew ? (
              <OfflineGuard>
                <DropdownMenuItem onClick={() => onRenew(item)}>
                  Renouveler l'accès
                </DropdownMenuItem>
              </OfflineGuard>
            ) : null}
            {canCreate ? (
              <OfflineGuard>
                <DropdownMenuItem
                  onClick={() => onResetPassword(item)}
                  disabled={resetPasswordPending}
                >
                  Réinitialiser le mot de passe
                </DropdownMenuItem>
              </OfflineGuard>
            ) : null}
            {canEditContact ? (
              <OfflineGuard>
                <DropdownMenuItem onClick={() => onEditContact(item)}>
                  Modifier téléphone/email
                </DropdownMenuItem>
              </OfflineGuard>
            ) : null}
            {canShowCancel ? (
              <>
                {(compact && canShowRenew) || canCreate || canEditContact ? <DropdownMenuSeparator /> : null}
                <OfflineGuard>
                  <DropdownMenuItem
                    onClick={() => onCancel(item)}
                    className="text-destructive focus:text-destructive"
                  >
                    Annuler l'abonnement
                  </DropdownMenuItem>
                </OfflineGuard>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

export default function SubscriptionsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const studentLabels = useStudentLabels()

  const [status, setStatus] = useState<FilterStatus>("all")
  const [search, setSearch] = useState("")
  const [month, setMonth] = useState(toMonth(new Date()))
  const [createdBy, setCreatedBy] = useState<string>("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [renewTarget, setRenewTarget] = useState<SubscriptionListItem | null>(null)
  const [contactTarget, setContactTarget] = useState<SubscriptionListItem | null>(null)
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [cancelTarget, setCancelTarget] = useState<SubscriptionListItem | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<SubscriptionListItem | null>(null)
  const [resetCredentials, setResetCredentials] = useState<{ phone: string; password: string } | null>(null)
  const [passwordResetTarget, setPasswordResetTarget] = useState<SubscriptionListItem | null>(null)
  const [credentialsCopied, setCredentialsCopied] = useState(false)

  const canCreate = hasPermission("subscriptions.create")
  const canRenew = hasPermission("subscriptions.renew")
  const canCancel = hasPermission("subscriptions.cancel")

  const featureQuery = useQuery({
    queryKey: ["subscriptions", "feature-settings"],
    queryFn: getSmsFeatureSettings,
  })

  const creatorsQuery = useQuery({
    queryKey: ["subscriptions", "creators"],
    queryFn: listSubscriptionCreators,
    enabled: featureQuery.data?.is_enabled === true,
  })

  const parentsQuery = useQuery({
    queryKey: ["subscriptions", "parents", status, search, month, createdBy],
    queryFn: () =>
      listSubscriptionParents({
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
        month,
        created_by: createdBy === "all" ? undefined : createdBy,
      }),
    refetchInterval: 0,
    enabled: featureQuery.data?.is_enabled === true,
  })
  const detailsQuery = useQuery({
    queryKey: ["subscriptions", "details", detailsTarget?.parent_id],
    queryFn: () => getParentSubscriptionDetails(detailsTarget!.parent_id),
    enabled: Boolean(detailsTarget?.parent_id),
  })

  const createMutation = useMutation({
    mutationFn: createSubscriptionParent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"] })
      toast({
        title: "Abonnement créé",
        description: "Le parent peut maintenant se connecter au portail avec ses identifiants.",
      })
    },
  })

  const renewMutation = useMutation({
    mutationFn: ({ parentId, payload }: { parentId: string; payload: { duration_months: number; payment_method: "cash" | "momo_mtn" | "momo_orange"; paid_now: boolean } }) =>
      renewSubscriptionParent(parentId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"] })
      toast({
        title: "Abonnement prolongé",
        description: "L'accès parent reste actif pour la nouvelle période.",
      })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ parentId, subscriptionId }: { parentId: string; subscriptionId: string }) =>
      cancelSubscription(parentId, subscriptionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"] })
      toast({
        title: "Abonnement annulé",
        description: "L'accès parent est maintenant désactivé pour cette souscription.",
      })
      setCancelTarget(null)
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: resetParentSubscriptionPassword,
    onSuccess: (result) => {
      setResetCredentials({ phone: result.phone, password: result.new_temp_password })
      setCredentialsCopied(false)
    },
  })

  const updateContactMutation = useMutation({
    mutationFn: ({ parentId, phone, email }: { parentId: string; phone: string; email: string | null }) =>
      updateParentSubscriptionContact(parentId, { phone, email }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"] })
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "details"] })
      toast({
        title: "Contact parent modifié",
        description: "Le nouveau téléphone et l'email sont utilisés pour l'abonnement actif.",
      })
      setContactTarget(null)
    },
  })

  const openContactEditor = (item: SubscriptionListItem) => {
    setContactTarget(item)
    setContactPhone(item.phone)
    setContactEmail(item.email ?? "")
  }

  const items = parentsQuery.data?.data ?? []

  const activeCount = parentsQuery.data?.data.filter((item) => item.latest_subscription?.status === "active").length ?? 0
  const monthSubscriptionsCount = useMemo(
    () => items.filter((item) => item.latest_subscription?.created_at?.startsWith(month)).length,
    [items, month]
  )

  if (featureQuery.isLoading) {
    return <PageLayout title="Abonnements parents">Chargement…</PageLayout>
  }

  if (!featureQuery.data?.is_enabled) {
    return (
      <PageLayout title="Abonnements parents">
        <EmptyState
          title="Fonctionnalité non activée"
          message="Le suivi des abonnements parents dépend du service SMS Parents. Demandez l'activation à EduTrack, puis définissez le tarif dans Paramètres école."
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
          <OfflineGuard>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
              Nouvel abonnement
            </Button>
          </OfflineGuard>
        ) : null
      }
    >
      <section className="rounded-lg border bg-card p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="space-y-2">
            <Label>État de l'accès</Label>
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

          <div className="space-y-2">
            <Label>Mois de souscription</Label>
            <Input
              type="month"
              value={month}
              max={toMonth(new Date())}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Créé par</Label>
            <Select value={createdBy} onValueChange={setCreatedBy}>
              <SelectTrigger>
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(creatorsQuery.data ?? []).map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>
                    {creator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label>Retrouver un parent</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom du parent ou téléphone"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Card className="rounded-lg shadow-sm">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Abonnements actifs</p>
            <p className="text-xl font-semibold tabular-nums sm:text-2xl">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Parents inscrits</p>
            <p className="text-xl font-semibold tabular-nums sm:text-2xl">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Période affichée</p>
            <p className="text-sm font-medium capitalize">{monthLabel(month)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">Souscriptions du mois</p>
            <p className="text-xl font-semibold tabular-nums sm:text-2xl">{monthSubscriptionsCount}</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3 md:hidden">
        {items.map((item) => {
          const latest = item.latest_subscription
          return (
            <Card key={item.parent_id} className="rounded-lg shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.full_name}</p>
                    <p className="text-xs text-muted-foreground">{item.phone}</p>
                  </div>
                  {latest ? <SubscriptionStatusBadge status={latest.status} ends_at={latest.ends_at} /> : <Badge variant="outline">Sans abonnement</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{`${item.students.length} ${studentLabels.pluralLower}`}</p>
                <SubscriptionActions
                  item={item}
                  canCreate={canCreate}
                  canRenew={canRenew}
                  canCancel={canCancel}
                  resetPasswordPending={resetPasswordMutation.isPending}
                  onDetails={setDetailsTarget}
                  onRenew={setRenewTarget}
                  onEditContact={openContactEditor}
                  onResetPassword={setPasswordResetTarget}
                  onCancel={setCancelTarget}
                  compact
                />
              </CardContent>
            </Card>
          )
        })}
      </section>

      {parentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Recherche des abonnements parents…</p>
      ) : null}
      {parentsQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Impossible de charger les abonnements parents. Vérifiez la connexion, puis réessayez.</AlertDescription>
        </Alert>
      ) : null}

      <section className="hidden overflow-x-auto rounded-lg border bg-card shadow-sm md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Parent</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Date abonnement</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">{studentLabels.plural}</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Durée</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Montant</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Statut</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Expire le</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Jours restants</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const latest = item.latest_subscription
              return (
                <tr key={item.parent_id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{item.full_name}</p>
                    <p className="text-xs text-muted-foreground">{item.phone}</p>
                  </td>
                  <td className="px-3 py-2.5">{latest?.created_at ? formatDate(latest.created_at.slice(0, 10)) : "-"}</td>
                  <td className="px-3 py-2.5">{item.students.length}</td>
                  <td className="px-3 py-2.5">{latest?.duration_months ? `${latest.duration_months} mois` : "-"}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums">{latest?.total_amount_fcfa ? formatFcfa(latest.total_amount_fcfa) : "-"}</td>
                  <td className="px-3 py-2.5">{latest ? <SubscriptionStatusBadge status={latest.status} ends_at={latest.ends_at} /> : "-"}</td>
                  <td className="px-3 py-2.5">{latest?.ends_at ? formatDate(latest.ends_at) : "-"}</td>
                  <td className="px-3 py-2.5">
                    {latest?.days_remaining !== null && latest?.days_remaining !== undefined && latest.status !== "cancelled" && latest.status !== "expired"
                      ? `${latest.days_remaining} jour(s)`
                      : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <SubscriptionActions
                      item={item}
                      canCreate={canCreate}
                      canRenew={canRenew}
                      canCancel={canCancel}
                      resetPasswordPending={resetPasswordMutation.isPending}
                      onDetails={setDetailsTarget}
                      onRenew={setRenewTarget}
                      onEditContact={openContactEditor}
                      onResetPassword={setPasswordResetTarget}
                      onCancel={setCancelTarget}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {items.length === 0 && !parentsQuery.isLoading ? (
        <div className="space-y-3">
          <EmptyState
            title="Aucun parent trouvé"
            message="Aucune souscription ne correspond à cette recherche. Essayez un autre mois, un autre statut, ou créez un abonnement parent."
            action={canCreate ? { label: "Créer un abonnement", onClick: () => setCreateOpen(true) } : undefined}
          />
          <ContextualHelp title="À vérifier">
            Changez le mois ou l'état de l'accès, puis relancez la recherche. Si la liste reste vide, créez un abonnement parent depuis le bouton en haut de page.
          </ContextualHelp>
        </div>
      ) : null}

      {resetCredentials ? (
        <Alert>
          <AlertDescription className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Identifiants parent prêts à envoyer
            </p>
            <div className="rounded-md border bg-background p-3 text-sm">
              <p>
                Téléphone: <strong>{resetCredentials.phone}</strong>
              </p>
              <p>
                Mot de passe temporaire: <strong>{resetCredentials.password}</strong>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Le parent devra utiliser ce mot de passe temporaire sur le portail parent.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `Téléphone: ${resetCredentials.phone}\nMot de passe: ${resetCredentials.password}`
                  )
                  setCredentialsCopied(true)
                  toast({ title: "Identifiants copiés", description: "Vous pouvez les transmettre au parent." })
                }}
              >
                {credentialsCopied ? "Copié" : "Copier les identifiants"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setResetCredentials(null)}>
                Fermer
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <CreateSubscriptionModal
        open={createOpen}
        onOpenChange={setCreateOpen}
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
            <AlertDialogTitle>Annuler l'abonnement de {cancelTarget?.full_name ?? "ce parent"} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le parent perdra l'accès au suivi de ses enfants pour cette souscription. Vous pourrez créer ou renouveler un abonnement plus tard si besoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder l'abonnement actif</AlertDialogCancel>
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
              Annuler l'abonnement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(contactTarget)} onOpenChange={(open) => !open && setContactTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le contact parent</DialogTitle>
            <DialogDescription>
              Action disponible uniquement sur un abonnement actif.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent-contact-phone">Téléphone</Label>
              <Input
                id="parent-contact-phone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="2250700000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent-contact-email">Email</Label>
              <Input
                id="parent-contact-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="parent@example.com"
              />
            </div>
            {updateContactMutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {updateContactMutation.error instanceof Error
                    ? updateContactMutation.error.message
                    : "Impossible de modifier le contact parent."}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setContactTarget(null)}>
                Annuler
              </Button>
              <Button
                type="button"
                disabled={
                  updateContactMutation.isPending ||
                  !/^225\d{10}$/.test(contactPhone.trim()) ||
                  (contactEmail.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))
                }
                onClick={() => {
                  if (!contactTarget) return
                  updateContactMutation.mutate({
                    parentId: contactTarget.parent_id,
                    phone: contactPhone.trim(),
                    email: contactEmail.trim() || null,
                  })
                }}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(passwordResetTarget)} onOpenChange={(open) => !open && setPasswordResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer un nouveau mot de passe pour {passwordResetTarget?.full_name ?? "ce parent"} ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'ancien mot de passe ne fonctionnera plus. Copiez le nouveau mot de passe après confirmation pour le transmettre au parent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien changer</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!passwordResetTarget) return
                resetPasswordMutation.mutate(passwordResetTarget.parent_id)
                setPasswordResetTarget(null)
              }}
            >
              Créer le mot de passe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(detailsTarget)} onOpenChange={(open) => !open && setDetailsTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dossier abonnement parent</DialogTitle>
            <DialogDescription>
              {detailsTarget?.full_name} · {detailsTarget?.phone}
            </DialogDescription>
          </DialogHeader>
          {detailsQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement du dossier parent…</p> : null}
          {detailsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger ce dossier parent. Fermez la fenêtre, puis réessayez.</AlertDescription>
            </Alert>
          ) : null}
          {detailsQuery.data ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">Résumé</p>
                  <p>
                    Abonnements actifs:{" "}
                    <span className="font-semibold">
                      {
                        detailsQuery.data.subscriptions.filter((subscription) => subscription.status === "active")
                          .length
                      }
                    </span>
                  </p>
                  <p>
                    Total souscriptions:{" "}
                    <span className="font-semibold">{detailsQuery.data.subscriptions.length}</span>
                  </p>
                  <p>
                    Montant cumulé:{" "}
                    <span className="font-semibold">
                      {formatFcfa(
                        detailsQuery.data.subscriptions.reduce((acc, subscription) => acc + subscription.total_amount_fcfa, 0)
                      )}
                    </span>
                  </p>
                </CardContent>
              </Card>
              {detailsQuery.data.subscriptions.map((subscription) => (
                <Card key={subscription.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SubscriptionStatusBadge status={subscription.status} ends_at={subscription.ends_at} />
                      <p className="text-xs text-muted-foreground">
                        Du {formatDate(subscription.starts_at)} au {formatDate(subscription.ends_at)}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <p>Durée: <span className="font-medium">{subscription.duration_months} mois</span></p>
                      <p>Montant total: <span className="font-medium">{formatFcfa(subscription.total_amount_fcfa)}</span></p>
                      <p>Date de souscription: <span className="font-medium">{formatDate(subscription.created_at.slice(0, 10))}</span></p>
                      <p>Créé par: <span className="font-medium">{subscription.created_by_name ?? "—"}</span></p>
                      <p>Paiements enregistrés: <span className="font-medium">{subscription.payments.length}</span></p>
                    </div>
                    {subscription.status === "cancelled" ? (
                      <Alert>
                        <AlertDescription>
                          Annulé le {subscription.cancelled_at ? new Date(subscription.cancelled_at).toLocaleString("fr-FR") : "-"} par {subscription.cancelled_by_name ?? "Inconnu"}.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div>
                      <p className="mb-2 text-sm font-medium">{`${studentLabels.plural} rattachés`}</p>
                      <div className="space-y-2">
                        {subscription.students.map((student) => (
                          <div key={student.id} className="rounded-md border p-2 text-xs">
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-muted-foreground">
                              Classe: {student.class_name ?? "-"} · Matricule: {student.registration_number ?? "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {subscription.payments.length > 0 ? (
                      <div>
                        <p className="mb-2 text-sm font-medium">Historique paiements</p>
                        <div className="space-y-2">
                          {subscription.payments.map((payment) => (
                            <div key={payment.id} className="rounded-md border border-border p-2 text-xs">
                              <p className="font-medium">{formatFcfa(payment.amount_fcfa)}</p>
                              <p className="text-muted-foreground">
                                {formatPaymentMethod(payment.payment_method)} · {new Date(payment.paid_at).toLocaleString("fr-FR")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
