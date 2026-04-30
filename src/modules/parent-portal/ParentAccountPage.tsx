import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import {
  changeParentPassword,
  getParentSubscriptionStatus,
  listParentStudents,
} from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { formatShortDate } from "@/modules/parent-portal/parent.utils"

export default function ParentAccountPage() {
  const { toast } = useToast()
  const parentUser = useParentAuthStore((state) => state.user)

  const studentsQuery = useQuery({
    queryKey: ["parent", "students", "account"],
    queryFn: listParentStudents,
  })

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {studentsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {parentUser?.phone?.slice(-2) ?? "PA"}
            </div>
            <div>
              <p className="text-sm font-semibold">Parent</p>
              <p className="text-xs text-muted-foreground">{parentUser?.phone ?? "Non renseigné"}</p>
            </div>
          </div>

          {(studentsQuery.data ?? []).length > 0 && (
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Élèves suivis</p>
              <div className="space-y-2">
                {(studentsQuery.data ?? []).map((student) => (
                  <div key={student.id} className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {student.first_name[0]}{student.last_name[0]}
                    </div>
                    <span className="text-sm">{student.first_name} {student.last_name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{student.class_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subscriptionQuery.data && (
            <div
              className={cn(
                "rounded-xl border p-3",
                subscriptionQuery.data.days_remaining <= 7
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  : subscriptionQuery.data.days_remaining <= 30
                    ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                    : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              )}
            >
              <p className="text-xs font-medium">Abonnement</p>
              <p className="text-sm font-semibold capitalize">{subscriptionQuery.data.status}</p>
              <p className="text-xs text-muted-foreground">
                Expire le {formatShortDate(subscriptionQuery.data.ends_at)} · {subscriptionQuery.data.days_remaining}j restants
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Changer mon mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Input id="current-password" className="h-12 text-base" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="new-password">Nouveau mot de passe</Label>
              <Input id="new-password" className="h-12 text-base" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input id="confirm-password" className="h-12 text-base" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
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
