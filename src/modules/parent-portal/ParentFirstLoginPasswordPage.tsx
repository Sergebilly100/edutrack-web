import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changeParentPassword } from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"

export default function ParentFirstLoginPasswordPage() {
  const navigate = useNavigate()
  const user = useParentAuthStore((state) => state.user)
  const setUser = useParentAuthStore((state) => state.setUser)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: changeParentPassword,
    onSuccess: () => {
      if (user) {
        setUser({ ...user, mustChangePassword: false })
      }
      navigate("/parent/dashboard", { replace: true })
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de modifier le mot de passe.")
    },
  })

  return (
    <div className="mx-auto mt-6 w-full max-w-md">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-b from-blue-50 to-background dark:from-blue-950/30">
          <CardTitle className="text-xl">Sécurisez votre compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <p className="text-base text-muted-foreground">
            Pour continuer, vous devez modifier le mot de passe temporaire qui vous a été remis.
          </p>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              setErrorMessage(null)

              if (newPassword.length < 6) {
                setErrorMessage("Le nouveau mot de passe doit contenir au moins 6 caractères.")
                return
              }
              if (newPassword !== confirmPassword) {
                setErrorMessage("Les deux mots de passe ne correspondent pas.")
                return
              }

              mutation.mutate({
                current_password: currentPassword,
                new_password: newPassword,
              })
            }}
          >
            <div className="space-y-1">
              <Label className="text-base" htmlFor="first-login-current-password">Mot de passe temporaire</Label>
              <Input
                id="first-login-current-password"
                className="h-12 text-base"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="first-login-new-password">Nouveau mot de passe</Label>
              <Input
                id="first-login-new-password"
                className="h-12 text-base"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="first-login-confirm-password">Confirmer le nouveau mot de passe</Label>
              <Input
                id="first-login-confirm-password"
                className="h-12 text-base"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription className="text-base">{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="h-12 w-full text-base" disabled={mutation.isPending}>
              {mutation.isPending ? "Enregistrement..." : "Mettre à jour"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
