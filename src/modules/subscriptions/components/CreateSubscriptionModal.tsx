import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, Copy, Lock, Search, TriangleAlert } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  listSubscriptionClasses,
  listSubscriptionClassStudents,
} from "@/modules/subscriptions/subscriptions.api"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"

type PaymentMethod = "cash" | "momo_mtn" | "momo_orange"
type DurationMonths = number

type StudentOption = {
  id: string
  fullName: string
  className: string
  registrationNumber: string | null
}

type CreateSubscriptionPayload = {
  full_name: string
  phone: string
  email?: string
  student_ids: string[]
  duration_months: DurationMonths
  payment_method: PaymentMethod
  paid_now: boolean
}

type CreateSubscriptionSuccess = {
  parent: { id: string; full_name: string; phone: string }
  subscription: { id: string; total_amount_fcfa: number; starts_at: string; ends_at: string }
  credentials: { phone: string; temp_password: string }
}

type CreateSubscriptionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  smsUnitPriceFcfa: number | null
  isSubmitting?: boolean
  existingPhones?: string[]
  onSubmit: (payload: CreateSubscriptionPayload) => Promise<CreateSubscriptionSuccess>
  onGoToSettings?: () => void
}

const PHONE_REGEX = /^225\d{10}$/

const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Espèces",
  momo_mtn: "MTN MoMo",
  momo_orange: "Orange Money",
}

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  student_ids: [] as string[],
  duration_months: 1 as DurationMonths,
  payment_method: "cash" as PaymentMethod,
  paid_now: true,
}

export default function CreateSubscriptionModal({
  open,
  onOpenChange,
  smsUnitPriceFcfa,
  isSubmitting = false,
  existingPhones = [],
  onSubmit,
  onGoToSettings,
}: CreateSubscriptionModalProps) {
  const studentLabels = useStudentLabels()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [studentSearch, setStudentSearch] = useState("")
  const [studentPage, setStudentPage] = useState(1)
  const [selectedStudentMap, setSelectedStudentMap] = useState<Record<string, StudentOption>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<CreateSubscriptionSuccess | null>(null)

  const fullNameValid = form.full_name.trim().length >= 2
  const phoneValid = PHONE_REGEX.test(form.phone.trim())
  const emailValid = form.email.trim().length === 0 || /.+@.+\..+/.test(form.email.trim())
  const phoneExists = existingPhones.includes(form.phone.trim())
  const studentsValid = form.student_ids.length > 0
  const priceConfigured = typeof smsUnitPriceFcfa === "number" && smsUnitPriceFcfa > 0

  const computedTotal = useMemo(() => {
    if (!smsUnitPriceFcfa) {
      return 0
    }
    return smsUnitPriceFcfa * form.student_ids.length * form.duration_months
  }, [form.duration_months, form.student_ids.length, smsUnitPriceFcfa])

  const classesQuery = useQuery({
    queryKey: ["subscriptions", "classes", "modal"],
    queryFn: () => listSubscriptionClasses(),
    enabled: open,
  })

  const classStudentsQuery = useQuery({
    queryKey: ["subscriptions", "students", "modal", selectedClassId, studentPage, studentSearch],
    queryFn: () =>
      listSubscriptionClassStudents({
        class_id: selectedClassId,
        page: studentPage,
        limit: 25,
        search: studentSearch.trim() || undefined,
      }),
    enabled: open && step === 2 && selectedClassId.length > 0,
  })

  useEffect(() => {
    if (!open || step !== 2 || selectedClassId || !classesQuery.data?.length) {
      return
    }
    setSelectedClassId(classesQuery.data[0].id)
  }, [open, step, selectedClassId, classesQuery.data])

  const visibleStudents = useMemo(() => {
    return (classStudentsQuery.data?.data ?? []).map((item) => ({
      id: item.id,
      fullName: item.full_name,
      className: item.class_name,
      registrationNumber: item.registration_number,
    }))
  }, [classStudentsQuery.data?.data])
  const studentPagination = classStudentsQuery.data?.pagination
  const studentTotalPages = Math.max(1, studentPagination?.totalPages ?? 1)
  const studentTotal = studentPagination?.total ?? 0
  const studentPageStart =
    studentTotal === 0 ? 0 : ((studentPagination?.page ?? studentPage) - 1) * (studentPagination?.limit ?? 25) + 1
  const studentPageEnd = Math.min(
    (studentPagination?.page ?? studentPage) * (studentPagination?.limit ?? 25),
    studentTotal
  )

  const canGoStep2 = fullNameValid && phoneValid && emailValid && !phoneExists
  const canGoStep3 = studentsValid && priceConfigured

  const resetState = () => {
    setStep(1)
    setForm(emptyForm)
    setSubmitError(null)
    setSuccess(null)
    setSelectedClassId("")
    setStudentSearch("")
    setStudentPage(1)
    setSelectedStudentMap({})
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  const progress = success ? 100 : (step / 3) * 100

  const handleStudentToggle = (student: StudentOption, checked: boolean) => {
    setForm((prev) => {
      if (checked) {
        return { ...prev, student_ids: [...new Set([...prev.student_ids, student.id])] }
      }
      return { ...prev, student_ids: prev.student_ids.filter((id) => id !== student.id) }
    })
    setSelectedStudentMap((prev) => {
      if (checked) {
        return { ...prev, [student.id]: student }
      }
      const next = { ...prev }
      delete next[student.id]
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    try {
      const result = await onSubmit({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        ...(form.email.trim().length > 0 ? { email: form.email.trim() } : {}),
        student_ids: form.student_ids,
        duration_months: form.duration_months,
        payment_method: form.payment_method,
        paid_now: form.paid_now,
      })
      setSuccess(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de créer l'abonnement"
      setSubmitError(message)
    }
  }

  const copyCredentials = async () => {
    if (!success) {
      return
    }

    const text = `Téléphone : ${success.credentials.phone}\nMot de passe : ${success.credentials.temp_password}`
    await navigator.clipboard.writeText(text)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvel abonnement parent</DialogTitle>
          <DialogDescription>
            {`Créez une souscription parent et rattachez les ${studentLabels.pluralLower} en 3 étapes.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Étape {success ? 3 : step} / 3</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {!success ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant={step === 1 ? "default" : "secondary"}>1. Infos parent</Badge>
                <Badge variant={step === 2 ? "default" : "secondary"}>{`2. ${studentLabels.plural} & durée`}</Badge>
                <Badge variant={step === 3 ? "default" : "secondary"}>3. Paiement</Badge>
              </div>

              {step === 1 ? (
                <section className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="parent-full-name">Nom complet</Label>
                    <Input
                      id="parent-full-name"
                      value={form.full_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                      placeholder="Nom et prénom du parent"
                    />
                    {!fullNameValid ? <p className="text-xs text-red-600">Minimum 2 caractères requis.</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parent-phone">Téléphone</Label>
                    <Input
                      id="parent-phone"
                      value={form.phone}
                      onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value.replace(/\s+/g, "") }))}
                      placeholder="2250700000000"
                    />
                    {!phoneValid ? <p className="text-xs text-red-600">Format requis: 225 + 10 chiffres.</p> : null}
                    {phoneExists ? (
                      <p className="text-xs text-amber-900">
                        Ce numéro est déjà enregistré. Utiliser Renouveler à la place.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parent-email">Email (optionnel)</Label>
                    <Input
                      id="parent-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="parent@email.ci"
                    />
                    {!emailValid ? <p className="text-xs text-red-600">Email invalide.</p> : null}
                  </div>
                </section>
              ) : null}

              {step === 2 ? (
                <section className="space-y-4">
                  {!priceConfigured ? (
                    <Alert variant="destructive">
                      <Lock className="h-4 w-4" />
                      <AlertDescription className="space-y-2">
                        <p>{`Tarif SMS non configuré. Configurez d'abord le tarif par ${studentLabels.singularLower}/mois.`}</p>
                        {onGoToSettings ? (
                          <Button size="sm" variant="outline" onClick={onGoToSettings}>
                            Ouvrir les paramètres
                          </Button>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Classe (vous pouvez changer à tout moment)</Label>
                    <Select
                      value={selectedClassId}
                      onValueChange={(value) => {
                        setSelectedClassId(value)
                        setStudentPage(1)
                        setStudentSearch("")
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {(classesQuery.data ?? []).map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name} ({classItem.students_count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{`${studentLabels.plural} à rattacher`}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={studentSearch}
                        onChange={(event) => {
                          setStudentPage(1)
                          setStudentSearch(event.target.value)
                        }}
                        placeholder="Rechercher dans la classe"
                        disabled={!selectedClassId}
                      />
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                      {!selectedClassId ? (
                        <p className="text-sm text-muted-foreground">{`Sélectionnez une classe pour afficher ses ${studentLabels.pluralLower}.`}</p>
                      ) : null}
                      {visibleStudents.map((student) => {
                        const checked = form.student_ids.includes(student.id)
                        return (
                          <label
                            key={student.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 p-2 transition hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => handleStudentToggle(student, value === true)}
                            />
                            <span className="flex-1 text-sm">
                              <span className="font-medium">{student.fullName}</span>
                              <span className="ml-2 text-muted-foreground">
                                · {student.className} · Matricule: {student.registrationNumber ?? "-"}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                      {classStudentsQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
                    </div>
                    {selectedClassId && studentTotal > 0 ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Affichant {studentPageStart}-{studentPageEnd} sur {studentTotal} {studentLabels.pluralLower}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setStudentPage((prev) => Math.max(1, prev - 1))}
                            disabled={classStudentsQuery.isFetching || studentPage <= 1}
                          >
                            Précédent
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setStudentPage((prev) => Math.min(studentTotalPages, prev + 1))}
                            disabled={classStudentsQuery.isFetching || studentPage >= studentTotalPages}
                          >
                            Suivant
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {!studentsValid ? <p className="text-xs text-red-600">{`Sélectionnez au moins un ${studentLabels.singularLower}.`}</p> : null}
                  </div>

                  {form.student_ids.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">{`${studentLabels.plural} sélectionnés (${form.student_ids.length})`}</p>
                      <div className="flex flex-wrap gap-2">
                        {form.student_ids.map((studentId) => {
                          const student = selectedStudentMap[studentId]
                          return (
                            <Badge key={studentId} variant="secondary" className="gap-2">
                              {student?.fullName ?? `${studentLabels.singular} sélectionné`}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs"
                                onClick={() =>
                                  handleStudentToggle(
                                    student ?? { id: studentId, fullName: studentLabels.singular, className: "", registrationNumber: null },
                                    false
                                  )
                                }
                              >
                                ×
                              </Button>
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2 ">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Durée</Label>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={String(form.duration_months)}
                          onChange={(event) => {
                            const value = Number(event.target.value)
                            setForm((prev) => ({
                              ...prev,
                              duration_months: Number.isInteger(value) && value >= 1 ? value : 1,
                            }))
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Saisissez le nombre de mois (1 à 12).</p>
                      </div>
                      <div>
                        <Label >Tarif Total</Label>
                        <div className="p-3 text-sm">
                          {form.student_ids.length} × {formatFcfa(smsUnitPriceFcfa ?? 0)} × {form.duration_months} mois ={" "}
                          <span className="font-semibold">{formatFcfa(computedTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>


                </section>
              ) : null}

              {step === 3 ? (
                <section className="space-y-4">
                  <div className="space-y-2">
                    <Label>Méthode de paiement</Label>
                    <Select
                      value={form.payment_method}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, payment_method: value as PaymentMethod }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Espèces</SelectItem>
                        <SelectItem value="momo_mtn">MTN MoMo</SelectItem>
                        <SelectItem value="momo_orange">Orange Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="text-sm font-medium">Paiement reçu maintenant</span>
                    <Checkbox
                      checked={form.paid_now}
                      onCheckedChange={(value) => setForm((prev) => ({ ...prev, paid_now: value === true }))}
                    />
                  </label>

                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">Récapitulatif</p>
                    <Separator />
                    <p>Parent: {form.full_name || "-"}</p>
                    <p>{`${studentLabels.plural}: ${form.student_ids.length}`}</p>
                    <p>Durée: {form.duration_months} mois</p>
                    <p>Méthode: {paymentMethodLabels[form.payment_method]}</p>
                    <p className="font-semibold">Total: {formatFcfa(computedTotal)}</p>
                  </div>

                  {submitError ? (
                    <Alert variant="destructive">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  ) : null}
                </section>
              ) : null}

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (step === 1) {
                      handleOpenChange(false)
                      return
                    }
                    setStep((prev) => prev - 1)
                  }}
                >
                  {step === 1 ? "Annuler" : "Retour"}
                </Button>

                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={() => setStep((prev) => prev + 1)}
                    disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
                  >
                    Continuer
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !canGoStep3}>
                    {isSubmitting ? "Création..." : "Créer l'abonnement"}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <section className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-base font-semibold">Abonnement créé avec succès</p>
              </div>

              <div className="rounded-lg border border-green-300 bg-white p-3 text-sm text-slate-800 dark:border-green-900/40 dark:bg-slate-900 dark:text-slate-100">
                <p className="mb-2 font-medium">Accès parent</p>
                <p>Téléphone : {success.credentials.phone}</p>
                <p>Mot de passe : {success.credentials.temp_password}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={copyCredentials} className="gap-2">
                  <Copy className="h-4 w-4" /> Copier les accès
                </Button>
                <Button type="button" onClick={() => handleOpenChange(false)}>
                  Fermer
                </Button>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export type {
  CreateSubscriptionModalProps,
  CreateSubscriptionPayload,
  CreateSubscriptionSuccess,
  DurationMonths,
  PaymentMethod,
  StudentOption,
}
