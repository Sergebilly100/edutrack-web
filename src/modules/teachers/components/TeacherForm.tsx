import { useEffect, useMemo, useState, useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
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
import { Check, ChevronDown, Search, X, Plus, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/shared/components/Spinner"
import { BirthPlaceField, IdentityFields } from "@/shared/components/IdentityFields"
import { birthDateIssue, yesterdayInBusinessTimezone } from "@/shared/lib/date-validation"
import { birthPlaceError, cleanBirthPlace } from "@/shared/lib/identity"
import { groupTeachingAssignments, resolveAssignmentBlocks } from "../teaching-assignments"
import { cn } from "@/lib/utils"
import { listClasses, listSubjects } from "@/modules/academic/academic.api"
import type { TeacherType, TeacherUpsertPayload } from "@/modules/teachers/teachers.api"

const PHONE_CI_REGEX = /^225\d{10}$/

const teacherFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
    lastName: z.string().trim().min(1, "Le nom est requis").max(100),
    matricule: z.string().trim().max(50, "Le matricule ne doit pas dépasser 50 caractères"),
    birthDate: z.string().refine((value) => !value || !birthDateIssue(value), { message: "Date de naissance invalide : indiquez une date réelle antérieure à aujourd’hui." }),
    sex: z.enum(["", "M", "F"]),
    nationality: z.string(),
    birthPlace: z.string().refine((value) => !birthPlaceError(value), { message: "Le lieu de naissance doit contenir entre 2 et 120 caractères." }),
    phone: z.string().trim().refine((value) => !value || PHONE_CI_REGEX.test(value), {
        message: "Le téléphone doit respecter le format 225XXXXXXXXXX",
      }),
    email: z.string().trim().max(255).refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      { message: "Email invalide" }
    ),
    type: z.enum(["vacataire", "permanent"]),
    assignmentBlocks: z.array(z.object({
      subjectName: z.string().min(1, "Choisissez une matière"),
      classIds: z.array(z.string()).min(1, "Sélectionnez au moins une classe"),
    })),
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
            <span className="truncate">{selectedValues.length > 0 ? `${selectedValues.length} classe${selectedValues.length > 1 ? "s" : ""}` : "Choisir des classes"}</span>
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
              placeholder="Rechercher une classe"
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
        {selectedOptions.map((option) => <Button key={option.value} type="button" variant="secondary" size="sm" className="min-h-12 gap-1.5 px-2 font-normal" onClick={() => toggle(option.value)} disabled={disabled}>
          <span>{option.label}</span><X className="h-3.5 w-3.5" /><span className="sr-only">Retirer</span>
        </Button>)}
      </div> : null}
    </div>
  )
}

const TEACHER_STEPS = [
  { title: "Informations du professeur"},
  { title: "Affectations pédagogiques"},
] as const

function TeacherFormStepper({ step }: { step: 1 | 2 }) {
  return (
    <nav aria-label="Progression du formulaire" className="mb-4">
      <p className="sr-only" aria-live="polite">Étape {step} sur 2 · {TEACHER_STEPS[step - 1].title}</p>
      <ol className="flex items-start gap-3">
        {TEACHER_STEPS.map((item, index) => {
          const number = index + 1
          const done = step > number
          const current = step === number
          return (
            <li key={item.title} className="flex min-w-0 flex-1 flex-col gap-2" aria-current={current ? "step" : undefined}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-primary/10 text-primary",
                  !done && !current && "border-border bg-background text-muted-foreground"
                )}>
                  {done ? <Check className="h-4 w-4" aria-hidden="true" /> : number}
                </span>
                <span className={cn("h-1 flex-1 rounded-full", number <= step ? "bg-primary" : "bg-border")} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium  tracking-wide text-muted-foreground">Étape {number} · <span className={cn("truncate text-xs font-semibold", !current && "text-muted-foreground")}>{item.title}</span></p>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export type TeacherFormInitialValues = {
  firstName: string
  lastName: string
  matricule: string | null
  birthDate?: string | null
  sex?: "M" | "F" | null
  nationality?: string | null
  birthPlace?: string | null
  phone: string | null
  email: string | null
  type: TeacherType
  subjects: string[]
  teachingAssignments?: Array<{ subjectId: string; subjectName?: string; classId: string }>
  isBlocked?: boolean
  isActive?: boolean
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
      birthDate: initialValues?.birthDate?.slice(0, 10) ?? "",
      sex: initialValues?.sex ?? "",
      nationality: initialValues?.nationality ?? "",
      birthPlace: initialValues?.birthPlace ?? "",
      phone: initialValues?.phone ?? "",
      email: initialValues?.email ?? "",
      type: initialValues?.type ?? "vacataire",
      assignmentBlocks: groupTeachingAssignments(initialValues?.teachingAssignments ?? []),
      hourlyRate: initialValues?.hourlyRate ? String(initialValues.hourlyRate) : "",
      monthlySalary: initialValues?.monthlySalary ? String(initialValues.monthlySalary) : "",
    },
  })

  // Création : 2 étapes (informations, puis affectations). Modification : formulaire unique.
  const twoSteps = !initialValues
  const [step, setStep] = useState<1 | 2>(1)
  const showInfo = !twoSteps || step === 1
  const showAssignments = !twoSteps || step === 2
  const goToAssignments = async () => {
    const valid = await form.trigger(["firstName", "lastName", "matricule", "birthDate", "sex", "nationality", "birthPlace", "phone", "email", "type", "hourlyRate", "monthlySalary"])
    if (valid) setStep(2)
  }
  const type = useWatch({ control: form.control, name: "type" })
  const [watchedSex, watchedNationality, watchedBirthPlace] = useWatch({ control: form.control, name: ["sex", "nationality", "birthPlace"] })
  const identity = { sex: watchedSex, nationality: watchedNationality, birthPlace: watchedBirthPlace }
  const onIdentityChange = (next: typeof identity) => {
    form.setValue("sex", next.sex, { shouldDirty: true })
    form.setValue("nationality", next.nationality, { shouldDirty: true })
    form.setValue("birthPlace", next.birthPlace, { shouldDirty: true, shouldValidate: true })
  }
  const { fields: blocks, append, remove } = useFieldArray({ control: form.control, name: "assignmentBlocks" })
  const assignmentBlocks = useWatch({ control: form.control, name: "assignmentBlocks" })
  const subjectsQuery = useQuery({ queryKey: ["academic", "subjects", "teacher-form"], queryFn: () => listSubjects() })
  const classesQuery = useQuery({ queryKey: ["academic", "classes", "teacher-form"], queryFn: () => listClasses() })
  const assignmentsLocked = lockSubjects || initialValues?.isBlocked === true || initialValues?.isActive === false
  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current && subjectsQuery.data) {
      form.setValue("assignmentBlocks", groupTeachingAssignments(initialValues?.teachingAssignments ?? [], subjectsQuery.data))
      initialized.current = true
    }
  }, [form, subjectsQuery.data, initialValues?.teachingAssignments])
  const activeYearId = classesQuery.data?.activeSchoolYear?.id
  const activeClasses = (classesQuery.data?.classes ?? []).filter((item) => item.isActive && item.schoolYear.id === activeYearId)
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
    const resolved = assignmentsLocked ? { pairs: [], errors: [] } : resolveAssignmentBlocks(values.assignmentBlocks, subjectsQuery.data ?? [], classesQuery.data?.classes ?? [], activeYearId)
    if (resolved.errors.length) {
      for (const error of resolved.errors) form.setError(`assignmentBlocks.${error.blockIndex}.classIds`, { type: "validate", message: error.message })
      return
    }
    const teachingAssignments = resolved.pairs
    await onSubmit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      matricule: values.matricule.trim() || null,
      birthDate: values.birthDate || null,
      sex: values.sex || null,
      nationality: values.nationality || null,
      birthPlace: cleanBirthPlace(values.birthPlace) || null,
      phone: values.phone || null,
      email: values.email ? values.email.trim() : null,
      type: values.type,
      subjects: assignmentsLocked ? initialValues?.subjects ?? [] : [...new Set(values.assignmentBlocks.map((block) => block.subjectName))],
      ...(assignmentsLocked ? {} : { teachingAssignments }),
      hourlyRate: values.type === "vacataire" ? Number(values.hourlyRate) : null,
      monthlySalary: values.type === "permanent" ? Number(values.monthlySalary) : null,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => void handleSubmit(values))} className="space-y-4">
        {twoSteps ? <TeacherFormStepper step={step} /> : null}
        <div className={showInfo ? "space-y-4" : "hidden"}>
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

        <fieldset className="space-y-4 rounded-lg border p-4 ">
          <legend className="px-1 text-sm font-medium">Identité (facultatif)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem className="!mt-0">
                  <FormLabel>Date de naissance</FormLabel>
                  <FormControl>
                    <Input type="date" max={yesterdayInBusinessTimezone()} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <BirthPlaceField idPrefix="teacher" value={identity} onChange={onIdentityChange} />
          </div>
          <IdentityFields idPrefix="teacher" value={identity} onChange={onIdentityChange} />
        </fieldset>

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
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de contrat</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-12">
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="vacataire" className="min-h-12">Vacataire</SelectItem>
                    <SelectItem value="permanent" className="min-h-12">Permanent</SelectItem>
                  </SelectContent>
                </Select>
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
                      className="min-h-12"
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
                      className="min-h-12"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        </div>

        <section className={showAssignments ? "space-y-3 border-t pt-4 pb-4" : "hidden"} aria-label="Affectations pédagogiques">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 space-y-1">
              <h2 className="font-medium">Affectations pédagogiques <span className="text-xs font-normal text-muted-foreground">Facultatif</span></h2>
              <p className="text-xs text-muted-foreground">{blocks.length ? "Une matière par bloc, plusieurs classes possibles." : "À compléter après l'ouverture des classes."}</p>
            </div>
            <Button type="button" variant="outline" className="min-h-12 shrink-0" disabled={assignmentsLocked || isPending || subjectsQuery.isLoading || classesQuery.isLoading || subjectsQuery.isError || classesQuery.isError || !activeClasses.length || !subjectOptions.length} onClick={() => append({ subjectName: "", classIds: [] })}><Plus className="mr-2 h-4 w-4" />Ajouter un bloc</Button>
          </div>
          {assignmentsLocked ? <Alert><AlertDescription>Les affectations sont verrouillées pour ce professeur. Un professeur bloqué ou inactif ne peut recevoir d’affectation.</AlertDescription></Alert> : null}
          {subjectsQuery.isLoading || classesQuery.isLoading ? <Skeleton className="h-12 w-full" /> : subjectsQuery.isError || classesQuery.isError ? <Alert variant="destructive"><AlertDescription>Impossible de charger les matières et classes.<Button type="button" variant="outline" className="ml-2 min-h-12" onClick={() => { void subjectsQuery.refetch(); void classesQuery.refetch() }}>Réessayer</Button></AlertDescription></Alert> : <>
            {blocks.map((block, index) => <fieldset key={block.id} className="min-w-0" disabled={assignmentsLocked || isPending}>
              <legend className="sr-only">Bloc {index + 1}</legend>
              <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem]">
                <FormField control={form.control} name={`assignmentBlocks.${index}.subjectName`} render={({ field }) => <FormItem className="col-span-2 min-w-0 sm:col-span-1">
                  <FormLabel>Matière<span className="sr-only"> du bloc {index + 1}</span></FormLabel>
                  <Select value={field.value} disabled={assignmentsLocked || isPending} onValueChange={field.onChange}><FormControl><SelectTrigger className="min-h-12"><SelectValue placeholder="Choisir une matière" /></SelectTrigger></FormControl><SelectContent>{subjectOptions.map((name) => <SelectItem key={name} value={name} className="min-h-12">{name}</SelectItem>)}</SelectContent></Select>
                  <FormMessage />
                </FormItem>} />
                <FormField control={form.control} name={`assignmentBlocks.${index}.classIds`} render={({ field }) => <FormItem className="min-w-0">
                  <FormLabel>Classes<span className="sr-only"> du bloc {index + 1}</span></FormLabel>
                  <MultiSelectCombobox title={`Classes du bloc ${index + 1}`} description="Classes de l’année active. La matière doit être configurée pour leur niveau." selectedValues={field.value} options={activeClasses.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name, description: `${schoolClass.level.name} · ${schoolClass.studentCount} élèves` }))} disabled={assignmentsLocked || isPending} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>} />
                <Button type="button" variant="ghost" size="icon" className="mt-[calc(1rem+1rem)] h-12 w-12 self-start text-muted-foreground hover:text-destructive" disabled={assignmentsLocked || isPending} onClick={() => remove(index)} aria-label={`Supprimer le bloc ${index + 1}`} title={`Supprimer le bloc ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            </fieldset>)}
            {!activeYearId ? <p className="text-sm text-muted-foreground">Ouvrez une année scolaire active avant de définir les affectations.</p> : null}
          </>}
        </section>

        {twoSteps && step === 1 ? (
          <Button type="button" className="min-h-12 w-full" onClick={() => void goToAssignments()}>Suivant : affectations pédagogiques</Button>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {twoSteps ? <Button type="button" variant="outline" className="min-h-12 sm:w-1/3" disabled={isPending} onClick={() => setStep(1)}>Retour</Button> : null}
        <Button type="submit" className="min-h-12 w-full" disabled={isPending || (!assignmentsLocked && (subjectsQuery.isLoading || classesQuery.isLoading || subjectsQuery.isError || classesQuery.isError))}>
            {isPending ? <><Spinner size="sm" className="mr-2" />Enregistrement...</> : submitLabel}
          </Button>
            </div>
        )}
      </form>
    </Form>
  )
}
