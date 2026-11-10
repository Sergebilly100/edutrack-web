import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertTriangle, CreditCard, Mail, Phone, ShieldCheck, User } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { OfflineGuard, OfflineIndicator } from "@/shared/components"
import { cn } from "@/lib/utils"
import {
  changeParentPassword,
  getParentSubscriptionStatus,
} from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { formatShortDate } from "@/modules/parent-portal/parent.utils"

const formatFcfa = (amount: number) => new Intl.NumberFormat("fr-FR").format(amount)

const subscriptionStatusLabel = {
  active: "Actif",
  expired: "Expiré",
  cancelled: "Annulé",
}

export default function ParentAccountPage() {
  const { toast } = useToast()
  const parentUser = useParentAuthStore((state) => state.user)

  const subscriptionQuery = useQuery({
    queryKey: ["parent", "subscription-status", "account"],
    queryFn: getParentSubscriptionStatus,
  })

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const changePasswordMutation = useMutation({
    mutationFn: changeParentPassword,
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast({ title: "Mot de passe mis à jour" })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de modifier le mot de passe.",
        variant: "destructive",
      })
    },
  })

  return (
    <div className="space-y-4 text-base">
      <OfflineIndicator />
      <Card data-tour="parent-account-info">
        <CardHeader className="pb-3 p-3">
          <CardTitle className="text-xl">Mon compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              <User />
            </div>
            <div>
              <p className="text-sm font-semibold">{parentUser?.fullName ?? "Parent"}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg bg-muted/60 px-3 py-1">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Email</p>
                <p className="truncate text-sm">{parentUser?.email ?? "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/60 px-3 py-1">
              <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Téléphone</p>
                <p className="truncate text-sm">{parentUser?.phone ?? "Non renseigné"}</p>
              </div>
            </div>
          </div>

          {subscriptionQuery.isPending ? (
            <div role="status" aria-label="Chargement de l'abonnement…">
              <Skeleton className="h-20 w-full rounded-lg" />
              <span className="sr-only">Chargement de l'abonnement…</span>
            </div>
          ) : null}
          {subscriptionQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger l'abonnement.</AlertDescription>
            </Alert>
          ) : null}
          {!subscriptionQuery.isError && subscriptionQuery.data?.subscription && (
            <div
              className={cn(
                "rounded-lg border p-3",
                subscriptionQuery.data.subscription.days_remaining <= 7
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  : subscriptionQuery.data.subscription.days_remaining <= 30
                    ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground" data-tour="parent-account-subscription">Abonnement</p>
                  <p className="mt-1 text-sm font-semibold">
                    {subscriptionStatusLabel[subscriptionQuery.data.subscription.status]} jusqu'au {formatShortDate(subscriptionQuery.data.subscription.ends_at)}
                  </p>
                </div>
                <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>{subscriptionQuery.data.subscription.days_remaining} jour(s) restant(s) - {formatFcfa(subscriptionQuery.data.subscription.monthly_amount_fcfa)} FCFA / mois</p>
              </div>
              {subscriptionQuery.data.subscription.days_remaining <= 30 ? (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-background/70 p-2 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>rendez vous à l'administration de l'école pour renouveler votre abonnement.</p>
                </div>
              ) : null}
            </div>
          )}
          {!subscriptionQuery.isError && subscriptionQuery.data?.subscription === null && subscriptionQuery.data.offer.available && subscriptionQuery.data.offer.unit_price_fcfa ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-semibold">Alertes d&apos;absence en temps réel</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Sans abonnement, vous ne recevrez pas les alertes d&apos;absence de votre enfant. Pour {formatFcfa(subscriptionQuery.data.offer.unit_price_fcfa)} FCFA par enfant et par mois, elles sont envoyées en temps réel. Rendez-vous à l&apos;administration de l&apos;école.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card data-tour="parent-account-password">
        <CardHeader className="pb-3 p-3">
          <CardTitle className="text-xl">Changer mon mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (newPassword.length < 6) {
                toast({
                  title: "Mot de passe invalide",
                  description: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
                  variant: "destructive",
                })
                return
              }
              if (newPassword !== confirmPassword) {
                toast({
                  title: "Confirmation invalide",
                  description: "Les deux mots de passe ne correspondent pas.",
                  variant: "destructive",
                })
                return
              }
              changePasswordMutation.mutate({
                current_password: currentPassword,
                new_password: newPassword,
              })
            }}
          >
            <div className="space-y-1">
              <Label className="text-base" htmlFor="current-password">Mot de passe actuel</Label>
              <Input id="current-password" className="h-10 text-base" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="new-password">Nouveau mot de passe</Label>
              <Input id="new-password" className="h-10 text-base" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input id="confirm-password" className="h-10 text-base" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>
            <OfflineGuard>
              <Button type="submit" className="h-12 w-full text-base" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </OfflineGuard>
          </form>

          {changePasswordMutation.isSuccess ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-sm font-medium">Mot de passe mis à jour.</p>
            </div>
          ) : null}

          {changePasswordMutation.isError ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription className="text-base">Impossible de modifier le mot de passe.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
