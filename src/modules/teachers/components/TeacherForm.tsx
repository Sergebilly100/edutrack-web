import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import type { TeacherType, TeacherUpsertPayload } from "@/modules/teachers/teachers.api"

const PHONE_CI_REGEX = /^225\d{10}$/

const teacherFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
    lastName: z.string().trim().min(1, "Le nom est requis").max(100),
    phone: z.string().trim().refine((value) => !value || PHONE_CI_REGEX.test(value), {
        message: "Le téléphone doit respecter le format 225XXXXXXXXXX",
      }),
    email: z.string().trim().max(255).refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      { message: "Email invalide" }
    ),
    type: z.enum(["vacataire", "permanent"]),
    subjectsRaw: z.string().trim().min(1, "Au moins une matière est requise"),
    hourlyRate: z.string().trim(),
    monthlySalary: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    const parsedRate = Number(value.hourlyRate)
    const hasRate = value.hourlyRate.length > 0
    const parsedSalary = Number(value.monthlySalary)
    const hasSalary = value.monthlySalary.length > 0

    if (value.type === "vacataire" && !hasRate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hourlyRate"],
        message: "Le taux horaire est requis pour un vacataire",
      })
      return
    }

    if (value.type === "vacataire" && (!Number.isInteger(parsedRate) || parsedRate <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hourlyRate"],
        message: "Le taux horaire doit être un entier positif",
      })
    }

    if (value.type === "permanent" && !hasSalary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlySalary"],
        message: "Le salaire fixe est requis pour un permanent",
      })
      return
    }

    if (value.type === "permanent" && (!Number.isInteger(parsedSalary) || parsedSalary <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlySalary"],
        message: "Le salaire fixe doit être un entier positif",
      })
    }
  })

type TeacherFormValues = z.infer<typeof teacherFormSchema>

export type TeacherFormInitialValues = {
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  type: TeacherType
  subjects: string[]
  hourlyRate: number | null
  monthlySalary: number | null
}

type TeacherFormProps = {
  initialValues?: TeacherFormInitialValues
  isPending?: boolean
  submitLabel?: string
  lockSubjects?: boolean
  onSubmit: (payload: TeacherUpsertPayload) => Promise<void> | void
}

const parseSubjects = (raw: string): string[] =>
  raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

export default function TeacherForm({
  initialValues,
  isPending = false,
  submitLabel = "Enregistrer",
  lockSubjects = false,
  onSubmit,
}: TeacherFormProps) {
  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      firstName: initialValues?.firstName ?? "",
      lastName: initialValues?.lastName ?? "",
      phone: initialValues?.phone ?? "",
      email: initialValues?.email ?? "",
      type: initialValues?.type ?? "vacataire",
      subjectsRaw: initialValues?.subjects.join(", ") ?? "",
      hourlyRate: initialValues?.hourlyRate ? String(initialValues.hourlyRate) : "",
      monthlySalary: initialValues?.monthlySalary ? String(initialValues.monthlySalary) : "",
    },
  })

  const type = useWatch({ control: form.control, name: "type" })

  useEffect(() => {
    if (type === "permanent") {
      form.setValue("hourlyRate", "", { shouldDirty: true, shouldValidate: true })
      return
    }
    form.setValue("monthlySalary", "", { shouldDirty: true, shouldValidate: true })
  }, [form, type])

  const handleSubmit = async (values: TeacherFormValues) => {
    await onSubmit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone || null,
      email: values.email ? values.email.trim() : null,
      type: values.type,
      subjects: parseSubjects(values.subjectsRaw),
      hourlyRate: values.type === "vacataire" ? Number(values.hourlyRate) : null,
      monthlySalary: values.type === "permanent" ? Number(values.monthlySalary) : null,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => void handleSubmit(values))} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prénom</FormLabel>
                <FormControl>
                  <Input placeholder="Ibrahim" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input placeholder="Diallo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone</FormLabel>
              <FormControl>
                <Input
                  placeholder="2250701234567"
                  inputMode="tel"
                  maxLength={13}
                  autoComplete="tel"
                  {...field}
                  onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 13))}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">Format attendu: 225XXXXXXXXXX.</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="prof@ecole.ci"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Utilisé pour l'envoi des identifiants et la réinitialisation du mot de passe.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="vacataire">Vacataire</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subjectsRaw"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matières</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  rows={3}
                  placeholder="Mathématiques, Physique, SVT"
                  readOnly={lockSubjects}
                  className={cn(
                    "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "resize-none overflow-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    lockSubjects ? "bg-muted cursor-not-allowed" : ""
                  )}
                />
              </FormControl>
              {lockSubjects ? (
                <p className="text-xs text-muted-foreground">
                  Les matières enseignées sont gérées depuis l'emploi du temps/import.
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        {type === "vacataire" ? (
          <FormField
            control={form.control}
            name="hourlyRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Taux horaire (FCFA)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    placeholder="5000"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="monthlySalary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salaire fixe (FCFA)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    placeholder="350000"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Enregistrement..." : submitLabel}
        </Button>
      </form>
    </Form>
  )
}
