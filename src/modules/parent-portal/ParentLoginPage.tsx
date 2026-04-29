import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parentLogin, fetchParentSchoolInfo } from "@/modules/parent-portal/parent.api"
import { useParentAuthStore } from "@/modules/parent-portal/parent-auth.store"
import { useQuery } from "@tanstack/react-query"

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
  const [isPending, setIsPending] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="text-3xl font-bold">EduTrack</div>
          <p className="text-base text-muted-foreground">{schoolInfoQuery.data?.name ?? "Votre école"}</p>
          <CardTitle className="text-2xl">Portail parent</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault()
              setIsPending(true)
              setErrorMessage(null)

              try {
                const result = await parentLogin({
                  phone: phone.replace(/\s+/g, ""),
                  password,
                })
                setAccessToken(result.accessToken)
                setRefreshToken(result.refreshToken ?? null)
                setUser({
                  id: result.user.id,
                  role: "parent",
                  phone: result.user.phone,
                  studentIds: result.user.studentIds,
                })
                navigate("/parent/dashboard", { replace: true })
              } catch (error) {
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "Vérifiez votre connexion internet et réessayez."
                )
              } finally {
                setIsPending(false)
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="parent-phone" className="text-base">Votre numéro de téléphone</Label>
              <Input
                id="parent-phone"
                type="tel"
                autoComplete="tel"
                className="h-12 text-base"
                placeholder="225 07 XX XX XX XX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent-password" className="text-base">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="parent-password"
                  type={showPassword ? "text" : "password"}
                  className="h-12 pr-14 text-base"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-1 top-1 h-10 px-3 text-base"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                  {showPassword ? "Masquer" : "Afficher"}
                </Button>
              </div>
              <p className="text-base text-muted-foreground">
                Mot de passe oublié ? Contactez le secrétariat de l'école.
              </p>
            </div>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription className="text-base">{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            {searchParams.get("reason") === "session_expired" ? (
              <Alert>
                <AlertDescription className="text-base">
                  Votre session a expiré. Veuillez vous reconnecter.
                </AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="h-12 w-full text-base" disabled={isPending}>
              {isPending ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
