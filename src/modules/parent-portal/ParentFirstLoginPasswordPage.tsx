import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, KeyRound } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changeParentPassword } from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"

const PASSWORD_MIN_LENGTH = 8

const validateNewPassword = (value: string): string | null => {
  if (value.length < PASSWORD_MIN_LENGTH)
    return `Le nouveau mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`
  if (!/[A-Z]/.test(value))
    return "Le mot de passe doit contenir au moins une lettre majuscule."
  if (!/[0-9]/.test(value))
    return "Le mot de passe doit contenir au moins un chiffre."
  return null
}

export default function ParentFirstLoginPasswordPage() {
  const navigate = useNavigate()
  const user = useParentAuthStore((state) => state.user)
  const setUser = useParentAuthStore((state) => state.setUser)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: changeParentPassword,
    onSuccess: () => {
      if (user) setUser({ ...user, mustChangePassword: false })
      navigate("/parent/dashboard", { replace: true })
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de modifier le mot de passe."
      )
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const validationError = validateNewPassword(newPassword)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Les deux mots de passe ne correspondent pas.")
      return
    }

    mutation.mutate({ current_password: currentPassword, new_password: newPassword })
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-start justify-center px-4 pt-10 pb-24 lg:items-center lg:pt-0 lg:pb-0">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-sm">
            <KeyRound className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Sécurisez votre compte</h1>
            <p className="text-sm text-muted-foreground">
              Choisissez un mot de passe personnel pour continuer.
            </p>
          </div>
        </div>

        {/* Règles visibles */}
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          <p className="mb-1 font-medium">Exigences du mot de passe :</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Au moins {PASSWORD_MIN_LENGTH} caractères</li>
            <li>Au moins une lettre majuscule (A–Z)</li>
            <li>Au moins un chiffre (0–9)</li>
          </ul>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Mot de passe temporaire */}
          <div className="space-y-1.5">
            <Label htmlFor="first-login-current-password" className="text-sm font-medium">
              Mot de passe temporaire
            </Label>
            <div className="relative">
              <Input
                id="first-login-current-password"
                type={showCurrent ? "text" : "password"}
                className="h-12 pr-11 text-base"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                aria-label={showCurrent ? "Masquer" : "Afficher"}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div className="space-y-1.5">
            <Label htmlFor="first-login-new-password" className="text-sm font-medium">
              Nouveau mot de passe
            </Label>
            <div className="relative">
              <Input
                id="first-login-new-password"
                type={showNew ? "text" : "password"}
                className="h-12 pr-11 text-base"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                aria-label={showNew ? "Masquer" : "Afficher"}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirmation */}
          <div className="space-y-1.5">
            <Label htmlFor="first-login-confirm-password" className="text-sm font-medium">
              Confirmer le nouveau mot de passe
            </Label>
            <div className="relative">
              <Input
                id="first-login-confirm-password"
                type={showConfirm ? "text" : "password"}
                className="h-12 pr-11 text-base"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                aria-label={showConfirm ? "Masquer" : "Afficher"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Enregistrement…
              </span>
            ) : (
              "Mettre à jour le mot de passe"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
