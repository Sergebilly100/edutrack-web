import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { useNavigate } from "react-router-dom"
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
import { createSchool, type CreateSchoolResponse, type TeachingType } from "@/modules/admin/admin.api"
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
  trialDays: z.number().int().min(0).max(365),
  activeSchoolYear: z.string().trim().regex(/^\d{2}\/\d{4} - \d{2}\/\d{4}$/, "Format : MM/YYYY - MM/YYYY"),
})

type SchoolFormValues = z.infer<typeof schoolFormSchema>

type SchoolFormModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (response: CreateSchoolResponse) => void
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")

export default function SchoolFormModal({ open, onOpenChange, onCreated }: SchoolFormModalProps) {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [subdomainEdited, setSubdomainEdited] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<CreateSchoolResponse | null>(null)
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
      trialDays: 0,
      activeSchoolYear: "",
    },
  })

  const watchedSchoolName = useWatch({ control: form.control, name: "schoolName" })

  useEffect(() => {
    if (!subdomainEdited) {
      const nextSubdomain = slugify(watchedSchoolName)
      form.setValue("subdomain", nextSubdomain, {
        shouldDirty: nextSubdomain.length > 0,
        shouldValidate: nextSubdomain.length > 0,
      })
    }
  }, [form, subdomainEdited, watchedSchoolName])

  useEffect(() => {
    if (!open) {
      form.reset()
      setSubdomainEdited(false)
      setCreatedCredentials(null)
    }
  }, [form, open])

  const mutation = useMutation({
    mutationFn: createSchool,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "schools"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "revenue-metrics"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "schools", 1, 25] })

      toast({ title: "École créée avec succès" })
      onCreated?.(response)
      setCreatedCredentials(response)
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
      trial_days: values.trialDays,
      active_school_year: values.activeSchoolYear,
      director_name: values.directorName,
      director_phone: values.directorPhone,
      director_email: values.directorEmail?.trim() ? values.directorEmail.trim() : undefined,
    })
  }

  const isSuperAdmin = user?.role === "super_admin"
  const copyCreatedCredentials = async () => {
    if (!createdCredentials) {
      return
    }

    const credentials = createdCredentials.directorCredentials
    await navigator.clipboard.writeText(
      [
        `École: ${createdCredentials.schoolSchemaName}`,
        `Directeur: ${credentials.name}`,
        `Téléphone: ${credentials.phone}`,
        `Mot de passe: ${credentials.password}`,
      ].join("\n")
    )
    toast({ title: "Identifiants copiés" })
  }

  const goToCreatedSchool = () => {
    if (!createdCredentials) {
      return
    }
    onOpenChange(false)
    navigate(`/admin/schools/${createdCredentials.tenantId}`, {
      state: {
        createdDirectorCredentials: createdCredentials.directorCredentials,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle école</DialogTitle>
          <DialogDescription>Création d&apos;une école et du compte directeur.</DialogDescription>
        </DialogHeader>

        {createdCredentials ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Identifiants directeur</AlertTitle>
              <AlertDescription>Ce mot de passe ne sera plus affiché.</AlertDescription>
            </Alert>
            <div className="rounded-lg border border-border p-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Directeur</dt>
                  <dd className="font-medium">{createdCredentials.directorCredentials.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Téléphone</dt>
                  <dd className="font-medium">{createdCredentials.directorCredentials.phone}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Mot de passe généré</dt>
                  <dd className="break-all font-mono text-sm">{createdCredentials.directorCredentials.password}</dd>
                </div>
              </dl>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={copyCreatedCredentials}>
                Copier tout
              </Button>
              <Button type="button" onClick={goToCreatedSchool}>
                Accéder à la config école
              </Button>
            </DialogFooter>
          </div>
        ) : !isSuperAdmin ? (
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
                  <FormField
                    control={form.control}
                    name="activeSchoolYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Année scolaire active</FormLabel>
                        <FormControl>
                          <Input placeholder="09/2025 - 06/2026" {...field} />
                        </FormControl>
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
                    name="trialDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Période d&apos;essai (jours)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            step={1}
                            placeholder="0 = pas d'essai"
                            value={field.value}
                            onChange={(event) => {
                              const parsed = Number(event.target.value)
                              field.onChange(Number.isFinite(parsed) ? parsed : 0)
                            }}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">0 = activation immédiate</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

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
