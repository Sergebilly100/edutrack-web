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
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const [smsPriceDraft, setSmsPriceDraft] = useState("")
  const schoolConfigQuery = useQuery({
    queryKey: ["settings", "school-config", "access-gate"],
    queryFn: fetchSchoolConfig,
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

  const canAccessSchoolConfig =
    user?.role === "director" ||
    hasPermission("settings.school") ||
    hasPermission("settings.positions")
  const canEditSmsTemplateByAdmin = schoolConfigQuery.data?.school.canEditSmsTemplate ?? false
  const canAccessSmsTemplate =
    canEditSmsTemplateByAdmin && (user?.role === "director" || hasPermission("settings.sms_templates"))

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

      {canAccessSchoolConfig ? <SchoolConfigPanel /> : null}
      {canAccessSmsTemplate ? <SmsTemplatePanel /> : null}
      {canAccessSchoolConfig ? (
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
                  placeholder="Ex: 2000"
                />
                <p className="text-xs text-muted-foreground">Entier &gt; 0, maximum 50000.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => saveSmsPriceMutation.mutate()}
                  disabled={saveSmsPriceMutation.isPending}
                >
                  Sauvegarder
                </Button>
                <p className="text-sm text-muted-foreground">
                  Commission EduTrack : <strong>{smsFeatureQuery.data.commission_pct}%</strong> (défini par
                  EduTrack)
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cette fonctionnalité n&apos;est pas encore activée. Contactez EduTrack pour l&apos;activer.
            </p>
          )}
        </section>
      ) : null}

      {!canAccessSchoolConfig && !canAccessSmsTemplate ? (
        <Alert variant="destructive">
          <AlertDescription>
            Vous n&apos;avez pas les permissions nécessaires pour accéder aux paramètres.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
