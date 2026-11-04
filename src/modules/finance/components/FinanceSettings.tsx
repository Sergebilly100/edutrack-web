import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, Settings2, Smartphone } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { formatFcfa } from "@/shared/utils/formatting"
import {
  listProviderSettings,
  saveProviderSetting,
  type PaymentProvider,
} from "../finance.api"

const providerLabels: Record<PaymentProvider, string> = {
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  moov_money: "Moov Money",
  wave: "Wave",
}

export function FinanceSettings({ canManageProviders }: { canManageProviders: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const providersQuery = useQuery({ queryKey: ["finance", "provider-settings"], queryFn: listProviderSettings, enabled: canManageProviders })
  const [provider, setProvider] = useState<PaymentProvider>("orange_money")
  const [merchantNumber, setMerchantNumber] = useState("")
  const [credentials, setCredentials] = useState("{}")
  const [credentialsError, setCredentialsError] = useState<string | null>(null)

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

  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-1"><h2 className="text-xl font-semibold">Paramètres financiers</h2><p className="text-sm text-muted-foreground">Gérez les coordonnées utilisées pour les versements manuels.</p></div>

      {canManageProviders ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="h-5 w-5 text-primary" />Mobile Money</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert><Settings2 className="h-4 w-4" /><AlertTitle>Paiement direct temporairement désactivé</AlertTitle><AlertDescription>Le bouton « Payer » n’est pas affiché aux parents. Le numéro enregistré sert uniquement aux consignes de versement manuel.</AlertDescription></Alert>
            {/* <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="provider">Opérateur</Label><Select value={provider} onValueChange={(value) => setProvider(value as PaymentProvider)}><SelectTrigger id="provider" className="min-h-12"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(providerLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="merchant-number">Numéro marchand ou de versement</Label><Input id="merchant-number" className="min-h-12" value={merchantNumber} onChange={(event) => setMerchantNumber(event.target.value)} placeholder="Ex. 07 00 00 00 00" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="api-credentials">Identifiants API (JSON, conservés côté serveur)</Label><Textarea id="api-credentials" className="min-h-28 font-mono text-sm" value={credentials} onChange={(event) => { setCredentials(event.target.value); setCredentialsError(null) }} aria-invalid={Boolean(credentialsError)} /><p className="text-xs text-muted-foreground">Laissez {} tant qu’aucune intégration fournisseur n’est activée. Les identifiants existants ne sont jamais renvoyés par l’API.</p>{credentialsError ? <p className="text-sm text-red-600">{credentialsError}</p> : null}</div> */}
            <div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">Canal parent inactif</Badge><Button type="button" className="min-h-12" disabled={!merchantNumber.trim() || providerMutation.isPending} onClick={() => providerMutation.mutate()}>{providerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Enregistrer</Button></div>
          </CardContent>
        </Card>
      ) : null}

    </section>
  )
}
