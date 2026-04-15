import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Copy } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { createSchool, type TeachingType } from "@/modules/admin/admin.api"
import { useAuthStore } from "@/shared/store/auth.store"

const PHONE_CI_REGEX = /^225\d{10}$/

const schoolFormSchema = z.object({
  schoolName: z.string().trim().min(2, "Le nom de l'école est requis"),
  subdomain: z
    .string()
    .trim()
    .min(3, "Le sous-domaine doit contenir au moins 3 caractères")
    .regex(/^[a-z0-9-]+$/, "Utilisez uniquement lettres minuscules, chiffres et tirets"),
  city: z.string().trim().min(2, "La ville est requise"),
  teachingType: z.enum(["primaire", "secondaire", "superieur", "mixte"]),
  directorName: z.string().trim().min(2, "Le nom du directeur est requis"),
  directorPhone: z.string().trim().regex(PHONE_CI_REGEX, "Format attendu : 225XXXXXXXXXX"),
  directorEmail: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Email invalide",
    }),
  plan: z.enum(["essential", "pro", "establishment"]),
  maxAdminPositions: z.number().int().min(1).max(50),
})

type SchoolFormValues = z.infer<typeof schoolFormSchema>

type CreatedCredentials = {
  directorName: string
  directorPhone: string
  temporaryPassword: string
}

type SchoolFormModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")

export default function SchoolFormModal({ open, onOpenChange }: SchoolFormModalProps) {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [subdomainEdited, setSubdomainEdited] = useState(false)
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)

  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolFormSchema),
    mode: "onChange",
    defaultValues: {
      schoolName: "",
      subdomain: "",
      city: "",
      teachingType: "secondaire",
      directorName: "",
      directorPhone: "",
      directorEmail: "",
      plan: "essential",
      maxAdminPositions: 5,
    },
  })

  const watchedSchoolName = useWatch({ control: form.control, name: "schoolName" })

  useEffect(() => {
    if (!subdomainEdited) {
      form.setValue("subdomain", slugify(watchedSchoolName), {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [form, subdomainEdited, watchedSchoolName])

  useEffect(() => {
    if (!open) {
      form.reset()
      setCredentials(null)
      setSubdomainEdited(false)
    }
  }, [form, open])

  const mutation = useMutation({
    mutationFn: createSchool,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "schools"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "revenue-metrics"] })

      setCredentials({
        directorName: response.directorCredentials.name,
        directorPhone: response.directorCredentials.phone,
        temporaryPassword: response.directorCredentials.password,
      })

      toast({ title: "École créée" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'école.",
        variant: "destructive",
      })
    },
  })

  const canSubmit = useMemo(
    () => form.formState.isValid && !mutation.isPending,
    [form.formState.isValid, mutation.isPending]
  )

  const onSubmit = (values: SchoolFormValues) => {
    mutation.mutate({
      name: values.schoolName,
      subdomain: values.subdomain,
      city: values.city,
      teaching_type: values.teachingType as TeachingType,
      plan: values.plan,
      max_admin_positions: values.maxAdminPositions,
      director_name: values.directorName,
      director_phone: values.directorPhone,
      director_email: values.directorEmail?.trim() ? values.directorEmail.trim() : undefined,
    })
  }

  const handleCopyCredentials = async () => {
    if (!credentials) {
      return
    }

    const payload = `Nom: ${credentials.directorName}\nTéléphone: ${credentials.directorPhone}\nMot de passe: ${credentials.temporaryPassword}`
    await navigator.clipboard.writeText(payload)
    toast({ title: "Identifiants copiés" })
  }

  const isSuperAdmin = user?.role === "super_admin"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle école</DialogTitle>
          <DialogDescription>Création d&apos;une école et du compte directeur.</DialogDescription>
        </DialogHeader>

        {!isSuperAdmin ? (
          <Alert variant="destructive">
            <AlertTitle>Accès refusé</AlertTitle>
            <AlertDescription>Seul un super admin peut créer une école.</AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <section className="space-y-4">
                <h3 className="text-sm font-medium">Informations école</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="schoolName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input placeholder="Collège Sainte Marie" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subdomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sous-domaine</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="college-sainte-marie"
                            {...field}
                            onChange={(event) => {
                              setSubdomainEdited(true)
                              field.onChange(event)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input placeholder="Abidjan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teachingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type d&apos;enseignement</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="primaire">Primaire</SelectItem>
                            <SelectItem value="secondaire">Secondaire</SelectItem>
                            <SelectItem value="superieur">Supérieur</SelectItem>
                            <SelectItem value="mixte">Mixte</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <h3 className="text-sm font-medium">Compte directeur</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="directorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom complet</FormLabel>
                        <FormControl>
                          <Input placeholder="Kouadio Yao" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="directorPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder="2250700000000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="directorEmail"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Email (optionnel)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="directeur@ecole.ci" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <h3 className="text-sm font-medium">Configuration</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="essential">Essential</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="establishment">Establishment</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxAdminPositions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max postes admin</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={field.value}
                            onChange={(event) => {
                              const parsed = Number(event.target.value)
                              field.onChange(Number.isFinite(parsed) ? parsed : 0)
                            }}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {credentials ? (
                <Alert>
                  <AlertTitle>Identifiants directeur</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-1">
                      <p>
                        Nom: <span className="font-medium">{credentials.directorName}</span>
                      </p>
                      <p>
                        Téléphone: <span className="font-medium">{credentials.directorPhone}</span>
                      </p>
                      <p>
                        Mot de passe: <span className="font-medium">{credentials.temporaryPassword}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => void handleCopyCredentials()}
                    >
                      <Copy className="h-4 w-4" />
                      Copier
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {mutation.isPending ? "Création..." : "Créer l'école"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
