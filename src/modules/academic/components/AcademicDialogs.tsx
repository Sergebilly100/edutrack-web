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
import { Label } from "@/components/ui/label"
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
  Subject,
  SubjectPayload,
  SubjectUpdatePayload,
} from "@/modules/academic/academic.api"
import type { TeacherListItem } from "@/modules/teachers/teachers.api"
import { Spinner } from "@/shared/components/Spinner"

type CommonDialogProps = {
  open: boolean
  isPending: boolean
  onOpenChange: (open: boolean) => void
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

const subjectSchema = z.object({
  levelId: z.string().min(1, "Le niveau est requis"),
  name: z.string().trim().min(1, "Le nom est requis").max(100),
  coefficient: z.string().trim().refine(
    (value) => Number.isFinite(Number(value)) && Number(value) > 0,
    "Le coefficient doit être un nombre positif"
  ),
})

type SubjectFormValues = z.infer<typeof subjectSchema>

export function SubjectDialog({
  open,
  isPending,
  subject,
  levels,
  onOpenChange,
  onSubmit,
}: CommonDialogProps & {
  subject: Subject | null
  levels: Level[]
  onSubmit: (payload: SubjectPayload | SubjectUpdatePayload) => Promise<void> | void
}) {
  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { levelId: "", name: "", coefficient: "1" },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      levelId: subject?.levelId ?? levels[0]?.id ?? "",
      name: subject?.name ?? "",
      coefficient: String(subject?.coefficient ?? 1),
    })
  }, [form, levels, open, subject])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subject ? "Modifier la matière" : "Ajouter une matière"}</DialogTitle>
          <DialogDescription>
            Le coefficient de la matière intervient dans le calcul de la moyenne générale.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              const shared = { name: values.name.trim(), coefficient: Number(values.coefficient) }
              void onSubmit(subject ? shared : { ...shared, levelId: values.levelId })
            })}
          >
            <FormField
              control={form.control}
              name="levelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Niveau</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(subject)}>
                    <FormControl><SelectTrigger className="min-h-12"><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {levels.map((level) => <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {subject ? <p className="text-xs text-muted-foreground">Le niveau ne peut pas être modifié après la création.</p> : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Matière</FormLabel>
                  <FormControl><Input placeholder="Mathématiques" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coefficient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coefficient de la matière</FormLabel>
                  <FormControl><Input type="number" min={0.01} step={0.01} inputMode="decimal" {...field} /></FormControl>
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
              <Label htmlFor="teacher-search">Rechercher un professeur principal</Label>
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
