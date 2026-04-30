import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { parentLogin, fetchParentSchoolInfo } from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { useMutation, useQuery } from "@tanstack/react-query"

export default function ParentLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setUser = useParentAuthStore((state) => state.setUser)
  const setAccessToken = useParentAuthStore((state) => state.setAccessToken)
  const setRefreshToken = useParentAuthStore((state) => state.setRefreshToken)

  const schoolInfoQuery = useQuery({
    queryKey: ["parent", "school-info", "login"],
    queryFn: fetchParentSchoolInfo,
  })

  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: parentLogin,
    onSuccess: (result) => {
      sessionStorage.removeItem("parent_subscription_alert_seen")
      setAccessToken(result.accessToken)
      setRefreshToken(result.refreshToken ?? null)
      setUser({
        id: result.user.id,
        role: "parent",
        phone: result.user.phone,
        studentIds: result.user.studentIds,
        mustChangePassword: result.user.mustChangePassword,
      })
      navigate(
        result.user.mustChangePassword ? "/parent/first-login-password" : "/parent/dashboard",
        { replace: true }
      )
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Vérifiez votre connexion internet et réessayez."
      )
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm overflow-hidden border">
        <CardHeader className="space-y-3 pb-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            E
          </div>
          <div>
            <p className="text-xl font-bold">EduTrack</p>
            <p className="text-sm text-muted-foreground">{schoolInfoQuery.data?.name ?? "Votre école"}</p>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              setErrorMessage(null)
              loginMutation.mutate({ phone: phone.replace(/\s+/g, ""), password })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="parent-phone" className="text-base">Votre numéro de téléphone</Label>
              <div className="flex overflow-hidden rounded-lg border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring">
                <input
                  id="parent-phone"
                  type="tel"
                  autoComplete="tel"
                  className="h-12 flex-1 bg-transparent px-3 text-base outline-none"
                  placeholder="07 00 00 00 00"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent-password" className="text-base">Mot de passe</Label>
              <div className="relative">
                <input
                  id="parent-password"
                  type={showPassword ? "text" : "password"}
                  className="h-12 w-full rounded-md border border-input bg-background px-3 pr-14 text-base"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-0 top-0 h-12 px-3 text-sm"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Mot de passe oublié ? Contactez le secrétariat de l'école.
              </p>
            </div>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription className="text-base">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            ) : null}
            {searchParams.get("reason") === "session_expired" ? (
              <Alert>
                <AlertDescription className="text-base">
                  Votre session a expiré. Veuillez vous reconnecter.
                </AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="h-12 w-full text-base" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
