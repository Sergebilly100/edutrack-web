import { z } from "zod"

import type { ClassesResponse, Level, SchoolYear } from "@/modules/academic/academic.api"
import { useAuthStore } from "@/shared/store/auth.store"

export type EnrollmentIdentityDraft = {
  firstName: string; lastName: string; birthDate: string; matricule: string
  parentName: string; parentPhone: string; parentEmail: string
  parentName2: string; parentPhone2: string
  /** Identité facultative : "" = non renseigné. */
  sex: "" | "M" | "F"; nationality: string; birthPlace: string
  /** "true" | "false" | "" (non renseigné). Nouvelle inscription : "false" présélectionné. */
  isRepeating: "true" | "false" | ""
}

const contextSchema = z.object({
  origin: z.literal("enrollment"),
  draftId: z.string().uuid(),
  returnTo: z.string(),
  schoolYearId: z.string().uuid(),
  levelId: z.string().uuid(),
  createdClassId: z.string().uuid().optional(),
}).strict()

export type EnrollmentClassContext = z.infer<typeof contextSchema>
export type EnrollmentClassDraft = {
  context: EnrollmentClassContext
  form: EnrollmentIdentityDraft
  classId: string
}

const MAX_AGE_MS = 30 * 60 * 1000
const drafts = new Map<string, EnrollmentClassDraft & { owner: string; expiresAt: number }>()
const owner = () => {
  const user = useAuthStore.getState().user
  return user ? `${user.tenantId}:${user.schemaName}:${user.id}` : null
}

// A logout, a tenant switch or a different user invalidates every temporary draft.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || state.user?.tenantId !== previous.user?.tenantId
    || state.user?.schemaName !== previous.user?.schemaName) drafts.clear()
})

export function isEnrollmentReturnUrl(value: string): boolean {
  if (value === "/enrollments/new") return true
  const id = z.string().uuid()
  const edit = /^\/enrollments\/([^/?#]+)\/edit$/.exec(value)
  if (edit) return id.safeParse(edit[1]).success
  return false
}

export function saveEnrollmentClassDraft(input: Omit<EnrollmentClassDraft, "context"> & {
  returnTo: string; schoolYearId: string; levelId: string
}): EnrollmentClassContext {
  const currentOwner = owner()
  if (!currentOwner || !isEnrollmentReturnUrl(input.returnTo)) throw new Error("Contexte d’inscription indisponible. Rouvrez le dossier depuis les inscriptions.")
  const context = contextSchema.parse({
    origin: "enrollment", draftId: crypto.randomUUID(), returnTo: input.returnTo,
    schoolYearId: input.schoolYearId, levelId: input.levelId,
  })
  for (const [id, draft] of drafts) if (draft.expiresAt <= Date.now()) drafts.delete(id)
  drafts.set(context.draftId, { context, form: { ...input.form }, classId: input.classId, owner: currentOwner, expiresAt: Date.now() + MAX_AGE_MS })
  // Expiry releases personal data even when the user abandons the detour.
  window.setTimeout(() => drafts.delete(context.draftId), MAX_AGE_MS)
  return context
}

export function readEnrollmentClassDraft(state: unknown, returnTo?: string): EnrollmentClassDraft | null {
  const parsed = contextSchema.safeParse(state)
  if (!parsed.success || !isEnrollmentReturnUrl(parsed.data.returnTo)) return null
  const context = parsed.data
  const draft = drafts.get(context.draftId)
  if (!draft || draft.owner !== owner() || draft.expiresAt <= Date.now()) return null
  if (returnTo && context.returnTo !== returnTo) return null
  if (context.returnTo !== draft.context.returnTo || context.schoolYearId !== draft.context.schoolYearId
    || context.levelId !== draft.context.levelId) return null
  return { context, form: { ...draft.form }, classId: draft.classId }
}

export function discardEnrollmentClassDraft(draftId: string): void {
  drafts.delete(draftId)
}

export function resolveEnrollmentClassReturn(draft: EnrollmentClassDraft, years: SchoolYear[], levels: Level[], response: ClassesResponse): { classId: string; message: string | null } {
  const { context } = draft
  if (!years.some((year) => year.id === context.schoolYearId && year.status === "active")
    || response.activeSchoolYear?.id !== context.schoolYearId) {
    return { classId: "", message: "L’année scolaire active a changé. Vérifiez l’année et choisissez une classe avant de continuer." }
  }
  if (!levels.some((level) => level.id === context.levelId)) {
    return { classId: "", message: "Le niveau sélectionné n’est plus disponible. Choisissez un niveau et une classe." }
  }
  const classId = context.createdClassId ?? draft.classId
  if (!classId) return { classId: "", message: "Création de classe annulée. Votre brouillon a été conservé." }
  const schoolClass = response.classes.find((item) => item.id === classId && item.isActive)
  if (!schoolClass) return { classId: "", message: "La classe n’est plus disponible ou a été archivée. Choisissez une autre classe." }
  if (schoolClass.schoolYear.id !== context.schoolYearId || schoolClass.level.id !== context.levelId) {
    return { classId: "", message: "La classe créée ne correspond plus à l’année ou au niveau de ce dossier. Choisissez une classe adaptée." }
  }
  return { classId, message: context.createdClassId ? "Classe créée et sélectionnée. Vérifiez le dossier puis poursuivez l’inscription." : "Votre brouillon a été conservé." }
}
