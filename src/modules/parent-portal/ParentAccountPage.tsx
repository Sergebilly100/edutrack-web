import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
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
      <h1 className="text-2xl font-semibold">Mon compte</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Nom complet:</strong> Parent</p>
          <p><strong>Numéro de téléphone:</strong> {parentUser?.phone ?? "Non renseigné"}</p>
          <p><strong>Email:</strong> Non renseigné</p>
          <div>
            <p><strong>Élèves suivis:</strong></p>
            <ul className="list-disc space-y-1 pl-6">
              {(studentsQuery.data ?? []).map((student) => (
                <li key={student.id}>{student.first_name} {student.last_name} · {student.class_name}</li>
              ))}
            </ul>
          </div>
          {subscriptionQuery.data ? (
            <p>
              <strong>Statut abonnement:</strong> {subscriptionQuery.data.status} · expire le {formatShortDate(subscriptionQuery.data.ends_at)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Changer mon mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
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
            <Button type="submit" className="h-12 text-base" disabled={changePasswordMutation.isPending}>
              Enregistrer
            </Button>
          </form>

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
