import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, Pencil, Plus, Settings2, Smartphone } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { formatFcfa } from "@/shared/utils/formatting"
import {
  listProviderSettings,
  listSubscriptionPlans,
  saveProviderSetting,
  saveSubscriptionPlan,
  type PaymentProvider,
  type SubscriptionPeriod,
  type SubscriptionPlan,
} from "../finance.api"

const providerLabels: Record<PaymentProvider, string> = {
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  moov_money: "Moov Money",
  wave: "Wave",
}

const periodLabels: Record<SubscriptionPeriod, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  semester: "Semestriel",
  annual: "Annuel",
}

const emptyPlan = (): Omit<SubscriptionPlan, "id"> => ({
  amount: 0,
  period: "monthly",
  label: "",
  isMandatoryAtEnrollment: false,
  imposedDuration: null,
  showOnReceiptAsSeparateLine: false,
})

export function FinanceSettings({ canManageProviders, canViewPlans, canEditPlans }: { canManageProviders: boolean; canViewPlans: boolean; canEditPlans: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const providersQuery = useQuery({ queryKey: ["finance", "provider-settings"], queryFn: listProviderSettings, enabled: canManageProviders })
  const plansQuery = useQuery({ queryKey: ["finance", "subscription-plans"], queryFn: listSubscriptionPlans, enabled: canViewPlans })
  const [provider, setProvider] = useState<PaymentProvider>("orange_money")
  const [merchantNumber, setMerchantNumber] = useState("")
  const [credentials, setCredentials] = useState("{}")
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planDraft, setPlanDraft] = useState<Omit<SubscriptionPlan, "id">>(emptyPlan())

  const selectedSetting = providersQuery.data?.find((setting) => setting.provider === provider)
  useEffect(() => {
    setMerchantNumber(selectedSetting?.merchantNumber ?? "")
    setCredentials("{}")
    setCredentialsError(null)
  }, [provider, selectedSetting])

  const providerMutation = useMutation({
    mutationFn: async () => {
      let apiCredentials: Record<string, unknown>
      try {
        const parsed = JSON.parse(credentials) as unknown
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error()
        apiCredentials = parsed as Record<string, unknown>
      } catch {
        setCredentialsError("Saisissez un objet JSON valide, par exemple {}.")
        throw new Error("Identifiants API invalides")
      }
      setCredentialsError(null)
      await saveProviderSetting({ provider, merchantNumber: merchantNumber.trim(), apiCredentials })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance", "provider-settings"] })
      toast({ title: "Coordonnées enregistrées", description: "Le numéro peut être affiché dans les consignes de versement manuel." })
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Identifiants API invalides") return
      toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : "Réessayez.", variant: "destructive" })
    },
  })

  const planMutation = useMutation({
    mutationFn: () => saveSubscriptionPlan(planDraft, editingPlanId ?? undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance", "subscription-plans"] })
      setEditingPlanId(null)
      setPlanDraft(emptyPlan())
      toast({ title: "Plan d’abonnement enregistré" })
    },
    onError: (error) => toast({ title: "Enregistrement impossible", description: error instanceof Error ? error.message : "Vérifiez les informations.", variant: "destructive" }),
  })

  const editPlan = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan.id)
    setPlanDraft({
      amount: plan.amount,
      period: plan.period,
      label: plan.label,
      isMandatoryAtEnrollment: plan.isMandatoryAtEnrollment,
      imposedDuration: plan.imposedDuration,
      showOnReceiptAsSeparateLine: plan.showOnReceiptAsSeparateLine,
    })
  }

  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-1"><h2 className="text-xl font-semibold">Paramètres financiers</h2><p className="text-sm text-muted-foreground">Gérez les coordonnées de versement et les abonnements ajoutés aux frais d’inscription.</p></div>

      {canManageProviders ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="h-5 w-5 text-primary" />Mobile Money</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert><Settings2 className="h-4 w-4" /><AlertTitle>Paiement direct temporairement désactivé</AlertTitle><AlertDescription>Le bouton « Payer » n’est pas affiché aux parents. Le numéro enregistré sert uniquement aux consignes de versement manuel.</AlertDescription></Alert>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="provider">Opérateur</Label><Select value={provider} onValueChange={(value) => setProvider(value as PaymentProvider)}><SelectTrigger id="provider" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(providerLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="merchant-number">Numéro marchand ou de versement</Label><Input id="merchant-number" className="min-h-12" value={merchantNumber} onChange={(event) => setMerchantNumber(event.target.value)} placeholder="Ex. 07 00 00 00 00" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="api-credentials">Identifiants API (JSON, conservés côté serveur)</Label><Textarea id="api-credentials" className="min-h-28 font-mono text-sm" value={credentials} onChange={(event) => { setCredentials(event.target.value); setCredentialsError(null) }} aria-invalid={Boolean(credentialsError)} /><p className="text-xs text-muted-foreground">Laissez {} tant qu’aucune intégration fournisseur n’est activée. Les identifiants existants ne sont jamais renvoyés par l’API.</p>{credentialsError ? <p className="text-sm text-red-600">{credentialsError}</p> : null}</div>
            <div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">Canal parent inactif</Badge><Button type="button" className="min-h-12" disabled={!merchantNumber.trim() || providerMutation.isPending} onClick={() => providerMutation.mutate()}>{providerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Enregistrer</Button></div>
          </CardContent>
        </Card>
      ) : null}

      {canViewPlans ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-primary" />Plans d’abonnement</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {(plansQuery.data ?? []).length > 0 ? (
              <div className="divide-y rounded-lg border">
                {plansQuery.data?.map((plan) => (
                  <div key={plan.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{plan.label}</p>{plan.isMandatoryAtEnrollment ? <Badge variant="secondary">Imposé à l’inscription</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{formatFcfa(plan.amount)} · {periodLabels[plan.period]}{plan.imposedDuration ? ` · durée ${periodLabels[plan.imposedDuration].toLowerCase()}` : ""}</p></div>
                    {canEditPlans ? <Button type="button" variant="outline" className="min-h-12" onClick={() => editPlan(plan)}><Pencil className="mr-2 h-4 w-4" />Modifier</Button> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {canEditPlans ? <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between"><h3 className="font-medium">{editingPlanId ? "Modifier le plan" : "Nouveau plan"}</h3>{editingPlanId ? <Button type="button" variant="ghost" onClick={() => { setEditingPlanId(null); setPlanDraft(emptyPlan()) }}>Annuler</Button> : null}</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1"><Label htmlFor="plan-label">Libellé</Label><Input id="plan-label" className="min-h-12" value={planDraft.label} onChange={(event) => setPlanDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Ex. Accès parent" /></div>
                <div className="space-y-2"><Label htmlFor="plan-amount">Montant</Label><Input id="plan-amount" className="min-h-12" inputMode="numeric" value={planDraft.amount || ""} onChange={(event) => setPlanDraft((current) => ({ ...current, amount: Number(event.target.value.replace(/\D/g, "")) }))} /></div>
                <div className="space-y-2"><Label htmlFor="plan-period">Périodicité</Label><Select value={planDraft.period} onValueChange={(value) => setPlanDraft((current) => ({ ...current, period: value as SubscriptionPeriod }))}><SelectTrigger id="plan-period" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(periodLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm"><Checkbox checked={planDraft.isMandatoryAtEnrollment} onCheckedChange={(checked) => setPlanDraft((current) => ({ ...current, isMandatoryAtEnrollment: checked === true, imposedDuration: checked === true ? (current.imposedDuration ?? current.period) : null }))} /><span>Ajouter automatiquement ce plan au montant dû à l’inscription</span></label>
              {planDraft.isMandatoryAtEnrollment ? <div className="max-w-sm space-y-2"><Label htmlFor="imposed-duration">Durée imposée</Label><Select value={planDraft.imposedDuration ?? planDraft.period} onValueChange={(value) => setPlanDraft((current) => ({ ...current, imposedDuration: value as SubscriptionPeriod }))}><SelectTrigger id="imposed-duration" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(periodLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div> : null}
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm"><Checkbox checked={planDraft.showOnReceiptAsSeparateLine} onCheckedChange={(checked) => setPlanDraft((current) => ({ ...current, showOnReceiptAsSeparateLine: checked === true }))} /><span>Afficher séparément sur le reçu</span></label>
              <div className="flex justify-end"><Button type="button" className="min-h-12" disabled={!planDraft.label.trim() || planDraft.amount < 0 || planMutation.isPending} onClick={() => planMutation.mutate()}>{planMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingPlanId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{editingPlanId ? "Enregistrer les modifications" : "Créer le plan"}</Button></div>
            </div> : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
