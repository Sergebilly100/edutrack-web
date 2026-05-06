import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import SchoolConfigPanel from "@/modules/settings/components/SchoolConfigPanel"
import SmsTemplatePanel from "@/modules/settings/components/SmsTemplatePanel"
import {
  fetchSchoolConfig,
  getSchoolSmsFeatureSettings,
  updateSchoolSmsUnitPrice,
} from "@/modules/settings/settings.api"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { ContextualHelp } from "@/shared/components/ContextualHelp"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const [smsPriceDraft, setSmsPriceDraft] = useState("")
  const canManagePositions = user?.role === "director" || hasPermission("settings.positions")
  const canManageSchoolSettings = user?.role === "director" || hasPermission("settings.school")
  const canAccessSmsTemplate = user?.role === "director" || hasPermission("settings.sms_templates")
  const schoolConfigQuery = useQuery({
    queryKey: ["settings", "school-config", "access-gate"],
    queryFn: fetchSchoolConfig,
    enabled: canManagePositions,
  })
  const smsFeatureQuery = useQuery({
    queryKey: ["settings", "sms-feature"],
    queryFn: getSchoolSmsFeatureSettings,
  })

  useEffect(() => {
    const value = smsFeatureQuery.data?.sms_unit_price_fcfa
    setSmsPriceDraft(value && value > 0 ? String(value) : "")
  }, [smsFeatureQuery.data?.sms_unit_price_fcfa])

  const saveSmsPriceMutation = useMutation({
    mutationFn: () => {
      const parsed = Number(smsPriceDraft)
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 50000) {
        throw new Error("Le tarif doit être un entier entre 1 et 50000.")
      }
      return updateSchoolSmsUnitPrice(parsed)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "sms-feature"] })
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "feature-settings"] })
      toast({ title: "Tarif SMS sauvegardé" })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder le tarif.",
        variant: "destructive",
      })
    },
  })

  const smsPriceValue = Number(smsPriceDraft)
  const currentSmsPrice = smsFeatureQuery.data?.sms_unit_price_fcfa
  const normalizedCurrentSmsPrice = currentSmsPrice && currentSmsPrice > 0 ? String(currentSmsPrice) : ""
  const isSmsPriceDirty = smsPriceDraft !== normalizedCurrentSmsPrice
  const isSmsPriceValid =
    smsPriceDraft.length > 0 &&
    Number.isInteger(smsPriceValue) &&
    smsPriceValue > 0 &&
    smsPriceValue <= 50000
  const schoolConfigState = schoolConfigQuery.isLoading
    ? "Chargement"
    : schoolConfigQuery.isError
      ? "Erreur"
      : canManagePositions
        ? "Accessible"
        : "Restreint"
  const smsFeatureState = smsFeatureQuery.isLoading
    ? "Chargement"
    : smsFeatureQuery.isError
      ? "Erreur"
      : smsFeatureQuery.data?.is_enabled
        ? "Activé"
        : "Non activé"

  return (
    <div className="animate-fade-in space-y-6">
      <OfflineIndicator />
      <div className="flex items-start justify-between border-b border-border pb-5">
        <div className="space-y-0.5">
          <h1 className="text-xl font-medium tracking-tight">Paramètres école</h1>
          <p className="text-sm text-muted-foreground">
            Configuration de l&apos;école et gestion des postes administratifs.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 bg-muted/30 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Centre de configuration</p>
            <p className="text-xs text-muted-foreground">
              Les accès, le service SMS Parents et les templates sont visibles au même endroit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={schoolConfigQuery.isError ? "destructive" : "secondary"} className="rounded-md px-2.5 py-1">
              École: {schoolConfigState}
            </Badge>
            <Badge variant={smsFeatureQuery.data?.is_enabled ? "default" : "outline"} className="rounded-md px-2.5 py-1">
              SMS: {smsFeatureState}
            </Badge>
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">École</p>
            <p className="mt-1 truncate text-sm font-medium">
              {schoolConfigQuery.data?.school.name ?? "Configuration école"}
            </p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Tarif SMS</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {smsFeatureQuery.data?.sms_unit_price_fcfa ? `${smsFeatureQuery.data.sms_unit_price_fcfa} FCFA` : "-"}
            </p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Templates</p>
            <p className="mt-1 truncate text-sm font-medium">
              {canAccessSmsTemplate ? "Modifiables" : "Lecture restreinte"}
            </p>
          </div>
        </div>
      </div>

      {canManagePositions && schoolConfigQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Impossible de charger la configuration école. Vérifiez la connexion puis réessayez.
          </AlertDescription>
        </Alert>
      ) : null}

      {canManageSchoolSettings && smsFeatureQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Impossible de charger les paramètres SMS Parents. Le tarif ne peut pas être modifié pour le moment.
          </AlertDescription>
        </Alert>
      ) : null}

      {canManagePositions ? <SchoolConfigPanel /> : null}
      {canAccessSmsTemplate ? <SmsTemplatePanel /> : null}
      {canManageSchoolSettings ? (
        <section
          className={
            smsFeatureQuery.data?.is_enabled
              ? "space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20"
              : "space-y-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 opacity-90"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Service SMS Parents</h2>
              <p className="text-xs text-muted-foreground">
                Paramétrage de la souscription parent pour les notifications SMS.
              </p>
            </div>
            <Badge variant={smsFeatureQuery.data?.is_enabled ? "default" : "outline"}>
              {smsFeatureQuery.data?.is_enabled ? "Activé" : "Non activé"}
            </Badge>
          </div>

          {smsFeatureQuery.data?.is_enabled ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms-unit-price">Tarif par élève/mois (FCFA)</Label>
                <Input
                  id="sms-unit-price"
                  value={smsPriceDraft}
                  onChange={(event) => setSmsPriceDraft(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Ex: 2000"
                />
                <p className={isSmsPriceValid || smsPriceDraft.length === 0 ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                  Entier entre 1 et 50000.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => saveSmsPriceMutation.mutate()}
                  disabled={saveSmsPriceMutation.isPending || !isSmsPriceDirty || !isSmsPriceValid}
                >
                  {saveSmsPriceMutation.isPending
                    ? "Sauvegarde..."
                    : isSmsPriceDirty
                      ? "Sauvegarder le tarif"
                      : "Tarif à jour"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Commission EduTrack : <strong>{smsFeatureQuery.data.commission_pct}%</strong> (défini par
                  EduTrack)
                </p>
              </div>
            </div>
          ) : (
            <ContextualHelp title="Activation requise" tone="warning">
              Le portail d&apos;abonnement parent et les notifications SMS restent masqués tant que le service SMS Parents n&apos;est pas activé par EduTrack.
            </ContextualHelp>
          )}
        </section>
      ) : null}

      {!canManagePositions && !canManageSchoolSettings && !canAccessSmsTemplate ? (
        <ContextualHelp title="Paramètres non disponibles" tone="warning">
          Votre poste ne donne pas accès à la configuration école. Demandez au directeur les droits paramètres école, postes ou templates SMS selon la tâche à réaliser.
        </ContextualHelp>
      ) : null}
    </div>
  )
}
