import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { updateMyProfile } from "@/modules/auth/auth.api"
import { changePassword } from "@/modules/settings/settings.api"
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

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "ET"
}

export default function AccountPage() {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhotoUrl ?? "")
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

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
    onSuccess: () => {
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

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground">Gérez votre profil et vos accès personnels.</p>
      </header>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={photoPreview || undefined} alt={user.name} />
              <AvatarFallback className="text-sm font-semibold">{avatarInitials}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Input
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
              <p className="text-xs text-muted-foreground">Photo de profil (sinon initiales générées automatiquement).</p>
            </div>
          </div>

          <Form {...profileForm}>
            <form className="space-y-4" onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}>
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

              <div className="space-y-2">
                <p className="text-sm font-medium">Email</p>
                <Input type="email" value={user.email ?? ""} disabled readOnly />
                <p className="text-xs text-muted-foreground">L&apos;email n&apos;est pas modifiable.</p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={profileMutation.isPending}>
                  {profileMutation.isPending ? "Mise à jour..." : "Enregistrer le profil"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Changer le mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          {passwordFeedback ? (
            <Alert variant={passwordFeedback.type === "error" ? "destructive" : "default"} className="mb-4">
              <AlertDescription>{passwordFeedback.message}</AlertDescription>
            </Alert>
          ) : null}
          <Form {...passwordForm}>
            <form
              className="space-y-4"
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

              <div className="flex justify-end">
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? "Mise à jour..." : "Changer le mot de passe"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
