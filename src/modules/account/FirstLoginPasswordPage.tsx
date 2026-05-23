import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { isAxiosError } from "axios"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changePassword } from "@/modules/settings/settings.api"
import { useAuthStore } from "@/shared/store/auth.store"
import { usePermissions } from "@/shared/hooks/usePermissions"

const resolveHomeForRole = (role: string | undefined): string => {
  if (role === "teacher") return "/attendance"
  if (role === "super_admin") return "/admin"
  return "/dashboard"
}

export default function FirstLoginPasswordPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const { refreshPermissions } = usePermissions()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      if (user) {
        setUser({ ...user, mustChangePassword: false })
      }
      await refreshPermissions()
      navigate(resolveHomeForRole(user?.role), { replace: true })
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const backendMessage =
          (error.response?.data as { error?: string } | undefined)?.error ??
          error.message
        setErrorMessage(backendMessage)
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : "Impossible de modifier le mot de passe."
        )
      }
    },
  })

  return (
    <div className="mx-auto mt-6 w-full max-w-md px-4">
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
              if (newPassword === currentPassword) {
                setErrorMessage("Le nouveau mot de passe doit être différent du temporaire.")
                return
              }
              if (newPassword !== confirmPassword) {
                setErrorMessage("Les deux mots de passe ne correspondent pas.")
                return
              }

              mutation.mutate()
            }}
          >
            <div className="space-y-1">
              <Label className="text-base" htmlFor="first-login-current-password">
                Mot de passe temporaire
              </Label>
              <Input
                id="first-login-current-password"
                className="h-12 text-base"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="first-login-new-password">
                Nouveau mot de passe
              </Label>
              <Input
                id="first-login-new-password"
                className="h-12 text-base"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-base" htmlFor="first-login-confirm-password">
                Confirmer le nouveau mot de passe
              </Label>
              <Input
                id="first-login-confirm-password"
                className="h-12 text-base"
                type="password"
                autoComplete="new-password"
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

            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Enregistrement..." : "Mettre à jour"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
