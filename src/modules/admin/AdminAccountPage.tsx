import { useState } from "react"
import { Navigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { isAxiosError } from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { apiClient } from "@/shared/api/client"
import { OfflineDisabledFieldset, OfflineIndicator } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

export default function AdminAccountPage() {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      apiClient.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setFeedback({ type: "success", message: "Mot de passe mis à jour" })
      toast({ title: "Mot de passe mis à jour" })
    },
    onError: (error) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible de modifier le mot de passe"
      setFeedback({ type: "error", message })
      toast({ title: "Erreur", description: message, variant: "destructive" })
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
      <OfflineIndicator />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground">Paramètres personnels super admin.</p>
      </header>
      <OfflineDisabledFieldset>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>Profil du super admin connecté.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Nom:</span> {user.name}</p>
          <p><span className="text-muted-foreground">Rôle:</span> Super admin</p>
          <p><span className="text-muted-foreground">ID:</span> {user.id}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer le mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback ? (
            <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <Button
            type="button"
            onClick={() => {
              setFeedback(null)
              changePasswordMutation.mutate()
            }}
            disabled={changePasswordMutation.isPending}
          >
            Mettre à jour
          </Button>
        </CardContent>
      </Card>
      </OfflineDisabledFieldset>
    </div>
  )
}
