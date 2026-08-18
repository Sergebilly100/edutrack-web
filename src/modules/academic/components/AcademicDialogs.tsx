import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import type {
  ClassPayload,
  Level,
  LevelPayload,
  SchoolClass,
  SchoolYear,
  SchoolYearPayload,
} from "@/modules/academic/academic.api"
import type { TeacherListItem } from "@/modules/teachers/teachers.api"
import { Spinner } from "@/shared/components/Spinner"

const SCHOOL_YEAR_LABEL = /^(0[1-9]|1[0-2])\/\d{4} - (0[1-9]|1[0-2])\/\d{4}$/

const schoolYearSchema = z
  .object({
    label: z.string().trim().regex(SCHOOL_YEAR_LABEL, "Format attendu : MM/AAAA - MM/AAAA"),
    startDate: z.string().min(1, "La date de début est requise"),
    endDate: z.string().min(1, "La date de fin est requise"),
    status: z.enum(["draft", "active", "closed"]),
  })
  .superRefine((value, context) => {
    if (value.startDate >= value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La date de fin doit être postérieure à la date de début",
      })
      return
    }

    const expected = `${value.startDate.slice(5, 7)}/${value.startDate.slice(0, 4)} - ${value.endDate.slice(5, 7)}/${value.endDate.slice(0, 4)}`
    if (value.label !== expected) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["label"],
        message: `Le libellé doit correspondre aux dates : ${expected}`,
      })
    }
  })

type SchoolYearFormValues = z.infer<typeof schoolYearSchema>

type CommonDialogProps = {
  open: boolean
  isPending: boolean
  onOpenChange: (open: boolean) => void
}

export function SchoolYearDialog({
  open,
  isPending,
  schoolYear,
  onOpenChange,
  onSubmit,
}: CommonDialogProps & {
  schoolYear: SchoolYear | null
  onSubmit: (payload: SchoolYearPayload) => Promise<void> | void
}) {
  const form = useForm<SchoolYearFormValues>({
    resolver: zodResolver(schoolYearSchema),
    defaultValues: { label: "", startDate: "", endDate: "", status: "draft" },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      label: schoolYear?.label ?? "",
      startDate: schoolYear?.startDate ?? "",
      endDate: schoolYear?.endDate ?? "",
      status: schoolYear?.status ?? "draft",
    })
  }, [form, open, schoolYear])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{schoolYear ? "Modifier l’année scolaire" : "Ajouter une année scolaire"}</DialogTitle>
          <DialogDescription>
            Le libellé doit reprendre les mois et années des dates saisies.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => void onSubmit(values))}
          >
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Libellé</FormLabel>
                  <FormControl><Input placeholder="09/2026 - 06/2027" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Clôturée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner size="sm" className="mr-2" /> : null}
                {isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

const levelSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(100),
  orderIndex: z.string().trim().refine(
    (value) => Number.isInteger(Number(value)) && Number(value) >= 0,
    "L’ordre doit être un entier positif ou nul"
  ),
  isExamClass: z.boolean(),
})

type LevelFormValues = z.infer<typeof levelSchema>

export function LevelDialog({
  open,
  isPending,
  level,
  onOpenChange,
  onSubmit,
}: CommonDialogProps & {
  level: Level | null
  onSubmit: (payload: LevelPayload) => Promise<void> | void
}) {
  const form = useForm<LevelFormValues>({
    resolver: zodResolver(levelSchema),
    defaultValues: { name: "", orderIndex: "0", isExamClass: false },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: level?.name ?? "",
      orderIndex: String(level?.orderIndex ?? 0),
      isExamClass: level?.isExamClass ?? false,
    })
  }, [form, level, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{level ? "Modifier le niveau" : "Ajouter un niveau"}</DialogTitle>
          <DialogDescription>L’ordre détermine l’affichage des niveaux dans les listes.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => void onSubmit({
              name: values.name.trim(),
              orderIndex: Number(values.orderIndex),
              isExamClass: values.isExamClass,
            }))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du niveau</FormLabel>
                  <FormControl><Input placeholder="6ème" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orderIndex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordre d’affichage</FormLabel>
                  <FormControl><Input type="number" min={0} inputMode="numeric" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isExamClass"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  </FormControl>
                  <FormLabel className="m-0 cursor-pointer">Classe d’examen</FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner size="sm" className="mr-2" /> : null}
                {isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

const classSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(100),
  levelId: z.string().min(1, "Le niveau est requis"),
  homeroomTeacherId: z.string(),
})

type ClassFormValues = z.infer<typeof classSchema>
const NO_TEACHER = "none"

export function ClassDialog({
  open,
  isPending,
  schoolClass,
  levels,
  teachers,
  teachersLoading,
  onOpenChange,
  onSubmit,
}: CommonDialogProps & {
  schoolClass: SchoolClass | null
  levels: Level[]
  teachers: TeacherListItem[]
  teachersLoading: boolean
  onSubmit: (payload: ClassPayload) => Promise<void> | void
}) {
  const [teacherSearch, setTeacherSearch] = useState("")
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: "", levelId: "", homeroomTeacherId: NO_TEACHER },
  })

  useEffect(() => {
    if (!open) return
    setTeacherSearch("")
    form.reset({
      name: schoolClass?.name ?? "",
      levelId: schoolClass?.level.id ?? levels[0]?.id ?? "",
      homeroomTeacherId: schoolClass?.homeroomTeacher?.id ?? NO_TEACHER,
    })
  }, [form, levels, open, schoolClass])

  const filteredTeachers = useMemo(() => {
    const search = teacherSearch.trim().toLocaleLowerCase("fr")
    if (!search) return teachers
    return teachers.filter((teacher) =>
      `${teacher.fullName} ${teacher.matricule ?? ""}`.toLocaleLowerCase("fr").includes(search)
    )
  }, [teacherSearch, teachers])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{schoolClass ? "Modifier la classe" : "Ajouter une classe"}</DialogTitle>
          <DialogDescription>La classe sera rattachée à l’année scolaire active.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => void onSubmit({
              name: values.name.trim(),
              levelId: values.levelId,
              homeroomTeacherId: values.homeroomTeacherId === NO_TEACHER
                ? null
                : values.homeroomTeacherId,
            }))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la classe</FormLabel>
                  <FormControl><Input placeholder="6ème A" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="levelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Niveau</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {levels.map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel htmlFor="teacher-search">Rechercher un professeur principal</FormLabel>
              <Input
                id="teacher-search"
                value={teacherSearch}
                onChange={(event) => setTeacherSearch(event.target.value)}
                placeholder="Nom ou matricule"
              />
            </div>
            <FormField
              control={form.control}
              name="homeroomTeacherId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professeur principal</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={teachersLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={teachersLoading ? "Chargement…" : "Aucun professeur"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_TEACHER}>Aucun professeur principal</SelectItem>
                      {filteredTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.fullName}{teacher.matricule ? ` (${teacher.matricule})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || levels.length === 0}>
                {isPending ? <Spinner size="sm" className="mr-2" /> : null}
                {isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
