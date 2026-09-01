import { useId, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { Camera, ChevronDown, KeyRound, UserRound } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/shared/utils/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/components/ui/use-toast"
import { updateMyProfile } from "@/modules/auth/auth.api"
import { changePassword } from "@/modules/settings/settings.api"
import { OfflineGuard, OfflineIndicator } from "@/shared/components"
import { useAuthStore } from "@/shared/store/auth.store"

const profileSchema = z.object({
  name: z.string().trim().min(2, "Nom requis"),
  phone: z.string().trim().min(6, "Numéro invalide"),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z
      .string()
      .min(8, "Minimum 8 caractères")
      .regex(/[A-Z]/, "Ajoutez au moins une majuscule")
      .regex(/[0-9]/, "Ajoutez au moins un chiffre"),
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "La confirmation ne correspond pas",
  })

type ProfileValues = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>


export default function AccountPage() {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhotoUrl ?? "")
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(user?.role !== "teacher")
  const photoInputId = useId()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
    },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      updateMyProfile({
        name: values.name,
        phone: values.phone,
        profilePhotoUrl: photoPreview || null,
      }),
    onSuccess: (updatedUser) => {
      if (!user) {
        return
      }

      setUser({
        ...user,
        name: updatedUser.name,
        phone: updatedUser.phone,
        profilePhotoUrl: updatedUser.profilePhotoUrl,
      })
      toast({ title: "Profil mis à jour" })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Impossible de mettre à jour le profil."
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      })
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: ({ accessToken }) => {
      // Le backend a révoqué l'ancien token : on adopte le nouveau pour que la
      // session courante reste valide après le changement de mot de passe.
      if (accessToken) setAccessToken(accessToken)
      passwordForm.reset()
      setPasswordFeedback({ type: "success", message: "Mot de passe mis à jour" })
      toast({ title: "Mot de passe modifié" })
    },
    onError: (error) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible de modifier le mot de passe."
      setPasswordFeedback({ type: "error", message })
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      })
    },
  })

  const watchedName = useWatch({ control: profileForm.control, name: "name" })
  const avatarInitials = getInitials(watchedName || user?.name || "")
  const isTeacher = user?.role === "teacher"

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4 animate-fade-in py-1 md:py-2">
      <OfflineIndicator />
      <header className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Espace personnel</p>
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground">{isTeacher ? "Vos coordonnées et vos accès personnels." : "Gérez votre profil et vos accès personnels."}</p>
      </header>

      <Card className="min-w-0 overflow-hidden border border-border shadow-sm">
        {!isTeacher ? <CardHeader className="border-b pb-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></span><div><CardTitle className="text-lg font-semibold">Profil</CardTitle><CardDescription className="mt-1">Ces informations sont visibles dans votre espace de travail.</CardDescription></div></div></CardHeader> : null}
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarImage src={photoPreview || undefined} alt={user.name} />
              <AvatarFallback className="text-sm font-semibold">{avatarInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate font-medium">{watchedName || user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email ?? "Adresse e-mail non renseignée"}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-12 shrink-0"
              aria-label="Modifier la photo de profil"
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera className="mr-1.5 h-4 w-4" />
              Photo
            </Button>
              <Input
                id={photoInputId}
                ref={photoInputRef}
                className="!absolute !h-px !w-px overflow-hidden !p-0 opacity-0"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) {
                    return
                  }

                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : ""
                    setPhotoPreview(result)
                  }
                  reader.readAsDataURL(file)
                }}
              />
          </div>

          <Form {...profileForm}>
            <form id="teacher-profile-form" className="space-y-5 border-t pt-5" onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}>
              <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Email</p>
                <Input type="email" value={user.email ?? ""} disabled readOnly />
                <p className="text-xs text-muted-foreground">L&apos;email n&apos;est pas modifiable.</p>
              </div>

              <div className="flex justify-end border-t pt-4">
                <OfflineGuard>
                  <Button type="submit" className="min-h-12 w-full sm:w-auto" disabled={profileMutation.isPending}>
                    {profileMutation.isPending ? "Mise à jour..." : "Enregistrer le profil"}
                  </Button>
                </OfflineGuard>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Collapsible open={passwordOpen} onOpenChange={setPasswordOpen}>
      <Card className="border border-border shadow-sm">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="h-auto min-h-16 w-full justify-between rounded-lg px-4 py-3 text-left hover:translate-y-0 active:scale-100">
            <span className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"><KeyRound className="h-5 w-5" /></span><span className="min-w-0"><CardTitle className="truncate text-lg font-semibold">Sécurité</CardTitle><CardDescription className="mt-0.5 truncate">Modifier votre mot de passe</CardDescription></span></span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${passwordOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
        <CardContent className="border-t pt-5">
          {passwordFeedback ? (
            <Alert variant={passwordFeedback.type === "error" ? "destructive" : "default"} className="mb-4">
              <AlertDescription>{passwordFeedback.message}</AlertDescription>
            </Alert>
          ) : null}
          <Form {...passwordForm}>
            <form
              className="space-y-5"
              onSubmit={passwordForm.handleSubmit((values) => {
                setPasswordFeedback(null)
                passwordMutation.mutate(values)
              })}
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe actuel</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end border-t pt-4">
                <OfflineGuard>
                  <Button type="submit" className="min-h-12 w-full sm:w-auto" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending ? "Mise à jour..." : "Changer le mot de passe"}
                  </Button>
                </OfflineGuard>
              </div>
            </form>
          </Form>
        </CardContent>
        </CollapsibleContent>
      </Card>
      </Collapsible>

    </div>
  )
}
