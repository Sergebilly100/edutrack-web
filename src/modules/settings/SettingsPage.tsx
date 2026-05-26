import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import SchoolConfigPanel from "@/modules/settings/components/SchoolConfigPanel"
import SmsTemplatePanel from "@/modules/settings/components/SmsTemplatePanel"
import {
  fetchSchoolConfig,
  getSchoolSmsFeatureSettings,
  updateRealHoursConfig,
  updateSchoolSmsUnitPrice,
} from "@/modules/settings/settings.api"
import { OfflineDisabledFieldset } from "@/shared/components/OfflineDisabledFieldset"
import { OfflineGuard } from "@/shared/components/OfflineGuard"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { ContextualHelp } from "@/shared/components/ContextualHelp"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { useAuthStore } from "@/shared/store/auth.store"

const smsPriceSchema = z.object({
  smsUnitPriceFcfa: z.number().int().min(1).max(50000),
  checkoutToleranceMinutes: z.number().int().min(0).max(30),
})
type SmsPriceFormValues = z.infer<typeof smsPriceSchema>

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const studentLabels = useStudentLabels()
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

  const smsPriceForm = useForm<SmsPriceFormValues>({
    resolver: zodResolver(smsPriceSchema),
    defaultValues: {
      smsUnitPriceFcfa: smsFeatureQuery.data?.sms_unit_price_fcfa ?? 0,
      checkoutToleranceMinutes: smsFeatureQuery.data?.checkout_tolerance_minutes ?? 5,
    },
  })

  useEffect(() => {
    if (!smsFeatureQuery.data) return
    smsPriceForm.reset({
      smsUnitPriceFcfa: smsFeatureQuery.data.sms_unit_price_fcfa ?? 0,
      checkoutToleranceMinutes: smsFeatureQuery.data.checkout_tolerance_minutes ?? 5,
    }, { keepDirty: false })
  }, [smsFeatureQuery.data, smsPriceForm])

  const saveSmsPriceMutation = useMutation({
    mutationFn: (values: SmsPriceFormValues) => updateSchoolSmsUnitPrice(values.smsUnitPriceFcfa),
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

  const saveRealHoursConfigMutation = useMutation({
    mutationFn: (values: SmsPriceFormValues) => updateRealHoursConfig(values.checkoutToleranceMinutes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "sms-feature"] })
      toast({ title: "Tolérance heures réelles sauvegardée" })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder la tolérance.",
        variant: "destructive",
      })
    },
  })
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
          <h1 className="text-2xl font-medium tracking-tight">Paramètres école</h1>
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

      {canManageSchoolSettings ? (
        <section
          className={
            smsFeatureQuery.data?.use_real_hours
              ? "space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/70 dark:bg-blue-950/20"
              : "space-y-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 opacity-90"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Heures réelles</h2>
              <p className="text-xs text-muted-foreground">
                Tolérance appliquée au check-out avant qu&apos;une présence courte passe en validation.
              </p>
            </div>
            <Badge variant={smsFeatureQuery.data?.use_real_hours ? "default" : "outline"}>
              {smsFeatureQuery.data?.use_real_hours ? "Activé" : "Ignoré"}
            </Badge>
          </div>

          {smsFeatureQuery.data?.use_real_hours ? (
            <Form {...smsPriceForm}>
              <form
                onSubmit={smsPriceForm.handleSubmit((values) => saveRealHoursConfigMutation.mutate(values))}
                className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
              >
                <FormField
                  control={smsPriceForm.control}
                  name="checkoutToleranceMinutes"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label htmlFor="checkout-tolerance-minutes">Tolérance check-out (minutes)</Label>
                      <FormControl>
                        <Input
                          id="checkout-tolerance-minutes"
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="5"
                          {...field}
                          onChange={(event) => field.onChange(Number(event.target.value.replace(/\D/g, "")))}
                          value={field.value === 0 ? "" : String(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Entier entre 0 et 30. Une présence plus courte part en validation.
                      </p>
                    </FormItem>
                  )}
                />
                {saveRealHoursConfigMutation.isSuccess && !smsPriceForm.formState.isDirty ? (
                  <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Tolérance sauvegardée</span>
                  </div>
                ) : (
                  <OfflineGuard>
                    <Button
                      type="submit"
                      disabled={
                        saveRealHoursConfigMutation.isPending ||
                        !smsPriceForm.formState.dirtyFields.checkoutToleranceMinutes ||
                        !smsPriceForm.formState.isValid
                      }
                    >
                      {saveRealHoursConfigMutation.isPending
                        ? "Sauvegarde..."
                        : smsPriceForm.formState.dirtyFields.checkoutToleranceMinutes
                          ? "Sauvegarder"
                          : "Tolérance à jour"}
                    </Button>
                  </OfflineGuard>
                )}
              </form>
            </Form>
          ) : (
            <ContextualHelp title="Heures réelles désactivées" tone="warning">
              La valeur de tolérance existe en base mais elle est ignorée tant que les heures réelles ne sont pas activées par EduTrack.
            </ContextualHelp>
          )}
        </section>
      ) : null}

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

      {canManagePositions ? (
        <OfflineDisabledFieldset notice="Configuration école indisponible hors ligne. Reconnectez-vous pour modifier ces paramètres.">
          <SchoolConfigPanel />
        </OfflineDisabledFieldset>
      ) : null}
      {canAccessSmsTemplate ? (
        <OfflineDisabledFieldset notice="Templates SMS indisponibles hors ligne.">
          <SmsTemplatePanel />
        </OfflineDisabledFieldset>
      ) : null}
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
            <Form {...smsPriceForm}>
              <form
                onSubmit={smsPriceForm.handleSubmit((values) => saveSmsPriceMutation.mutate(values))}
                className="space-y-4"
              >
                <FormField
                  control={smsPriceForm.control}
                  name="smsUnitPriceFcfa"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label htmlFor="sms-unit-price">{`Tarif par ${studentLabels.singularLower}/mois (FCFA)`}</Label>
                      <FormControl>
                        <Input
                          id="sms-unit-price"
                          inputMode="numeric"
                          maxLength={5}
                          placeholder="Ex: 2000"
                          {...field}
                          onChange={(event) => field.onChange(Number(event.target.value.replace(/\D/g, "")))}
                          value={field.value === 0 ? "" : String(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">Entier entre 1 et 50000.</p>
                    </FormItem>
                  )}
                />
                <div className="flex flex-wrap items-center gap-3">
                  {saveSmsPriceMutation.isSuccess && !smsPriceForm.formState.isDirty ? (
                    <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-300">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Tarif sauvegardé</span>
                    </div>
                  ) : (
                    <OfflineGuard>
                      <Button
                        type="submit"
                        disabled={
                          saveSmsPriceMutation.isPending ||
                          !smsPriceForm.formState.isDirty ||
                          !smsPriceForm.formState.isValid
                        }
                      >
                        {saveSmsPriceMutation.isPending ? "Sauvegarde..." : "Sauvegarder le tarif"}
                      </Button>
                    </OfflineGuard>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Commission EduTrack : <strong>{smsFeatureQuery.data.commission_pct}%</strong> (défini par
                    EduTrack)
                  </p>
                </div>
              </form>
            </Form>
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
