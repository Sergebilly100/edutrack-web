import { useMemo, useState } from "react"
import { CheckCircle2, Copy, Lock, TriangleAlert } from "lucide-react"

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

type PaymentMethod = "cash" | "momo_mtn" | "momo_orange"
type DurationMonths = 1 | 2 | 3

type StudentOption = {
  id: string
  fullName: string
  className: string
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
  students: StudentOption[]
  smsUnitPriceFcfa: number | null
  isSubmitting?: boolean
  existingPhones?: string[]
  onSubmit: (payload: CreateSubscriptionPayload) => Promise<CreateSubscriptionSuccess>
  onGoToSettings?: () => void
}

const PHONE_REGEX = /^225\d{10}$/

const formatFcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`

const durationLabels: Record<DurationMonths, string> = {
  1: "1 mois",
  2: "2 mois",
  3: "3 mois",
}

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
  students,
  smsUnitPriceFcfa,
  isSubmitting = false,
  existingPhones = [],
  onSubmit,
  onGoToSettings,
}: CreateSubscriptionModalProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
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

  const canGoStep2 = fullNameValid && phoneValid && emailValid && !phoneExists
  const canGoStep3 = studentsValid && priceConfigured

  const resetState = () => {
    setStep(1)
    setForm(emptyForm)
    setSubmitError(null)
    setSuccess(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  const progress = success ? 100 : (step / 3) * 100

  const handleStudentToggle = (studentId: string, checked: boolean) => {
    setForm((prev) => {
      if (checked) {
        return { ...prev, student_ids: [...prev.student_ids, studentId] }
      }
      return { ...prev, student_ids: prev.student_ids.filter((id) => id !== studentId) }
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
            Créez une souscription parent et rattachez les élèves en 3 étapes.
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
                <Badge variant={step === 2 ? "default" : "secondary"}>2. Élèves & durée</Badge>
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
                      <p className="text-xs text-amber-700">
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
                        <p>Tarif SMS non configuré. Configurez d'abord le tarif par élève/mois.</p>
                        {onGoToSettings ? (
                          <Button size="sm" variant="outline" onClick={onGoToSettings}>
                            Ouvrir les paramètres
                          </Button>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Élèves à rattacher</Label>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                      {students.map((student) => {
                        const checked = form.student_ids.includes(student.id)
                        return (
                          <label
                            key={student.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 p-2 transition hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => handleStudentToggle(student.id, value === true)}
                            />
                            <span className="flex-1 text-sm">
                              <span className="font-medium">{student.fullName}</span>
                              <span className="ml-2 text-muted-foreground">· {student.className}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    {!studentsValid ? <p className="text-xs text-red-600">Sélectionnez au moins un élève.</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Durée</Label>
                    <Select
                      value={String(form.duration_months)}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, duration_months: Number(value) as DurationMonths }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Durée" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 mois</SelectItem>
                        <SelectItem value="2">2 mois</SelectItem>
                        <SelectItem value="3">3 mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    {form.student_ids.length} élève(s) × {formatFcfa(smsUnitPriceFcfa ?? 0)} × {form.duration_months} mois ={" "}
                    <span className="font-semibold">{formatFcfa(computedTotal)}</span>
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
                    <p>Élèves: {form.student_ids.length}</p>
                    <p>Durée: {durationLabels[form.duration_months]}</p>
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
