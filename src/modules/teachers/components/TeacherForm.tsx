import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { ChevronDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { listClasses, listSubjects } from "@/modules/academic/academic.api"
import type { TeacherType, TeacherUpsertPayload } from "@/modules/teachers/teachers.api"

const PHONE_CI_REGEX = /^225\d{10}$/

const teacherFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
    lastName: z.string().trim().min(1, "Le nom est requis").max(100),
    matricule: z.string().trim().max(50, "Le matricule ne doit pas dépasser 50 caractères"),
    phone: z.string().trim().refine((value) => !value || PHONE_CI_REGEX.test(value), {
        message: "Le téléphone doit respecter le format 225XXXXXXXXXX",
      }),
    email: z.string().trim().max(255).refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      { message: "Email invalide" }
    ),
    type: z.enum(["vacataire", "permanent"]),
    subjectNames: z.array(z.string()).min(1, "Sélectionnez au moins une matière"),
    classIds: z.array(z.string()).min(1, "Sélectionnez au moins une classe"),
    hourlyRate: z.string().trim(),
    monthlySalary: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    const parsedRate = Number(value.hourlyRate)
    const hasRate = value.hourlyRate.length > 0
    const parsedSalary = Number(value.monthlySalary)
    const hasSalary = value.monthlySalary.length > 0

    if (!value.phone && !value.email) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Renseignez au moins un téléphone ou un email",
      })
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Renseignez au moins un téléphone ou un email",
      })
    } 

    if (value.type === "vacataire" && !hasRate) {
      ctx.addIssue({
        code: "custom",
        path: ["hourlyRate"],
        message: "Le taux horaire est requis pour un vacataire",
      })
      return
    }

    if (value.type === "vacataire" && (!Number.isInteger(parsedRate) || parsedRate <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["hourlyRate"],
        message: "Le taux horaire doit être un entier positif",
      })
    }

    if (value.type === "permanent" && !hasSalary) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlySalary"],
        message: "Le salaire fixe est requis pour un permanent",
      })
      return
    }

    if (value.type === "permanent" && (!Number.isInteger(parsedSalary) || parsedSalary <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlySalary"],
        message: "Le salaire fixe doit être un entier positif",
      })
    }
  })

type TeacherFormValues = z.infer<typeof teacherFormSchema>

type MultiSelectOption = {
  value: string
  label: string
  description?: string
}

function MultiSelectCombobox({
  title,
  description,
  selectedValues,
  options,
  disabled = false,
  onChange,
}: {
  title: string
  description: string
  selectedValues: string[]
  options: MultiSelectOption[]
  disabled?: boolean
  onChange: (values: string[]) => void
}) {
  const [search, setSearch] = useState("")
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value))
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))
  )
  const toggle = (value: string) => onChange(
    selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value]
  )

  return (
    <div className="space-y-2">
      <DropdownMenu modal={false} onOpenChange={(open) => { if (!open) setSearch("") }}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="min-h-12 w-full justify-between font-normal" disabled={disabled} aria-label={`Modifier les ${title.toLocaleLowerCase("fr")}`}>
            <span className="truncate">{selectedValues.length > 0 ? `${selectedValues.length} sélection${selectedValues.length > 1 ? "s" : ""}` : `Sélectionner des ${title.toLocaleLowerCase("fr")}`}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[18rem] p-0">
          <div className="space-y-1 p-3">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <DropdownMenuSeparator className="mx-0" />
          <div className="relative p-2" onKeyDown={(event) => event.stopPropagation()}>
            <Search className="pointer-events-none absolute left-5 top-5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              placeholder={`Rechercher une ${title.toLocaleLowerCase("fr").replace(/s$/, "")}`}
              className="pl-9"
              aria-label={`Rechercher dans ${title.toLocaleLowerCase("fr")}`}
            />
          </div>
          <DropdownMenuSeparator className="mx-0" />
          <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable="true" aria-label={title}>
            {filteredOptions.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Aucun résultat.</p> : filteredOptions.map((option) => {
              const selected = selectedValues.includes(option.value)
              return <DropdownMenuCheckboxItem
                key={option.value}
                checked={selected}
                onCheckedChange={() => toggle(option.value)}
                onSelect={(event) => event.preventDefault()}
                className={cn("min-h-12 items-start py-2.5", selected && "bg-primary/5")}
              >
                <span className="min-w-0"><span className="block font-medium">{option.label}</span>{option.description ? <span className="block text-xs text-muted-foreground">{option.description}</span> : null}</span>
              </DropdownMenuCheckboxItem>
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {selectedOptions.length > 0 ? <div className="flex flex-wrap gap-2" aria-label={`${title} sélectionnées`}>
        {selectedOptions.map((option) => <Button key={option.value} type="button" variant="secondary" size="sm" className="h-8 gap-1.5 px-2 font-normal" onClick={() => toggle(option.value)} disabled={disabled}>
          <span>{option.label}</span><X className="h-3.5 w-3.5" /><span className="sr-only">Retirer</span>
        </Button>)}
      </div> : null}
    </div>
  )
}

export type TeacherFormInitialValues = {
  firstName: string
  lastName: string
  matricule: string | null
  phone: string | null
  email: string | null
  type: TeacherType
  subjects: string[]
  teachingAssignments?: Array<{ subjectId: string; classId: string }>
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
      matricule: initialValues?.matricule ?? "",
      phone: initialValues?.phone ?? "",
      email: initialValues?.email ?? "",
      type: initialValues?.type ?? "vacataire",
      subjectNames: initialValues?.subjects ?? [],
      classIds: [...new Set(initialValues?.teachingAssignments?.map((assignment) => assignment.classId) ?? [])],
      hourlyRate: initialValues?.hourlyRate ? String(initialValues.hourlyRate) : "",
      monthlySalary: initialValues?.monthlySalary ? String(initialValues.monthlySalary) : "",
    },
  })

  const type = useWatch({ control: form.control, name: "type" })
  const subjectNames = useWatch({ control: form.control, name: "subjectNames" })
  const classIds = useWatch({ control: form.control, name: "classIds" })
  const subjectsQuery = useQuery({ queryKey: ["academic", "subjects", "teacher-form"], queryFn: () => listSubjects() })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", "teacher-form"], queryFn: () => listClasses() })
  const selectedSubjects = useMemo(
    () => (subjectsQuery.data ?? []).filter((subject) => subjectNames.includes(subject.name)),
    [subjectNames, subjectsQuery.data]
  )
  const subjectOptions = useMemo(
    () => [...new Set((subjectsQuery.data ?? []).map((subject) => subject.name))].sort((a, b) => a.localeCompare(b, "fr")),
    [subjectsQuery.data]
  )

  useEffect(() => {
    if (type === "permanent") {
      form.setValue("hourlyRate", "", { shouldDirty: true, shouldValidate: true })
      return
    }
    form.setValue("monthlySalary", "", { shouldDirty: true, shouldValidate: true })
  }, [form, type])

  const handleSubmit = async (values: TeacherFormValues) => {
    const teachingAssignments = selectedSubjects.flatMap((subject) =>
      (classesQuery.data?.classes ?? [])
        .filter((schoolClass) => classIds.includes(schoolClass.id) && schoolClass.level.id === subject.levelId)
        .map((schoolClass) => ({ subjectId: subject.id, classId: schoolClass.id }))
    )

    if (teachingAssignments.length === 0) {
      form.setError("classIds", {
        type: "validate",
        message: "Sélectionnez au moins une classe du même niveau que les matières choisies",
      })
      return
    }

    await onSubmit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      matricule: values.matricule.trim() || null,
      phone: values.phone || null,
      email: values.email ? values.email.trim() : null,
      type: values.type,
      subjects: [...new Set(selectedSubjects
        .filter((subject) => teachingAssignments.some((assignment) => assignment.subjectId === subject.id))
        .map((subject) => subject.name))],
      teachingAssignments,
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
          name="matricule"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matricule (optionnel)</FormLabel>
              <FormControl>
                <Input placeholder="MAT-2026-001" {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Identifiant interne pour distinguer les professeurs homonymes.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <FormField control={form.control} name="subjectNames" render={() => (
          <FormItem>
            <FormLabel>Matières enseignées</FormLabel>
            <MultiSelectCombobox
              title="Matières"
              description="Choisissez les matières enseignées. Une matière n’apparaît qu’une fois, quel que soit son coefficient ou son niveau."
              selectedValues={subjectNames}
              options={subjectOptions.map((name) => ({ value: name, label: name }))}
              disabled={lockSubjects || subjectsQuery.isLoading}
              onChange={(values) => form.setValue("subjectNames", values, { shouldValidate: true })}
            />
            <p className="text-xs text-muted-foreground">Les matières seront automatiquement associées aux classes du même niveau.</p>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="classIds" render={() => (
          <FormItem>
            <FormLabel>Classes enseignées</FormLabel>
            <MultiSelectCombobox
              title="Classes"
              description="Choisissez une ou plusieurs classes. L’effectif confirmé est affiché pour aider à répartir les charges."
              selectedValues={classIds}
              options={(classesQuery.data?.classes ?? []).map((schoolClass) => ({
                value: schoolClass.id,
                label: schoolClass.name,
                description: `${schoolClass.level.name} · ${schoolClass.studentCount} élèves`,
              }))}
              disabled={classesQuery.isLoading}
              onChange={(values) => form.setValue("classIds", values, { shouldValidate: true })}
            />
            <p className="text-xs text-muted-foreground">Les associations sont créées uniquement pour les niveaux correspondants.</p>
            <FormMessage />
          </FormItem>
        )} />

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
