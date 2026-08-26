import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import SchoolConfigPanel from "@/modules/settings/components/SchoolConfigPanel"
import SmsTemplatePanel from "@/modules/settings/components/SmsTemplatePanel"
import {
  fetchSchoolConfig,
  getSchoolSmsFeatureSettings,
  updateSchoolSmsUnitPrice,
} from "@/modules/settings/settings.api"
import { OfflineDisabledFieldset } from "@/shared/components/OfflineDisabledFieldset"
import { OfflineGuard } from "@/shared/components/OfflineGuard"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { ContextualHelp } from "@/shared/components/ContextualHelp"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { useAuthStore } from "@/shared/store/auth.store"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { settingsTourSteps } from "@/shared/lib/tour-steps"

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
  const tour = useTourGuide("settings", user?.role === "director")
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
  // L'école ne monétise les alertes parents que si IvoirEdu a activé le service
  // (is_enabled) ET que l'école a opté pour la monétisation (monetize_parent_alerts).
  // Toute la surface "abonnements SMS parents" (menus Abonnements/Revenus, colonne
  // Abonnements de la matrice de rôles, et la section "Service SMS Parents" ci-dessous)
  // est conditionnée à ce booléen : si l'école ne monétise pas, rien ne s'affiche.
  const parentSmsMonetized =
    smsFeatureQuery.data?.is_enabled === true &&
    smsFeatureQuery.data?.monetize_parent_alerts === true

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
      : parentSmsMonetized
        ? "Activé"
        : "Non activé"

  return (
    <>
      <TourGuide
        steps={settingsTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <div className="animate-fade-in space-y-6">
      <OfflineIndicator />
      <div className="flex items-start justify-between border-b border-border pb-5">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-medium tracking-tight">Paramètres école</h1>
          <p className="text-sm text-muted-foreground">
            Configuration de l&apos;école et gestion des postes administratifs.
          </p>
        </div>
        {user?.role === "director" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-muted-foreground"
            onClick={() => tour.restart()}
            aria-label="Revoir le guide"
          >
            <Info className="mr-1.5 h-4 w-4" />
            Guide
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 bg-muted/30 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Centre de configuration</p>
            <p className="text-xs text-muted-foreground">
              {parentSmsMonetized
                ? "Les accès, le service Alertes Parents et les templates sont visibles au même endroit."
                : "Les accès et les templates sont visibles au même endroit."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={schoolConfigQuery.isError ? "destructive" : "secondary"} className="rounded-md px-2.5 py-1">
              École: {schoolConfigState}
            </Badge>
            {parentSmsMonetized ? (
              <Badge variant="default" className="rounded-md px-2.5 py-1">
                SMS: {smsFeatureState}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">École</p>
            <p className="mt-1 truncate text-sm font-medium">
              {schoolConfigQuery.data?.school.name ?? "Configuration école"}
            </p>
          </div>
          {parentSmsMonetized ? (
            <div className="bg-background px-4 py-3">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Tarif SMS</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {smsFeatureQuery.data?.sms_unit_price_fcfa ? `${smsFeatureQuery.data.sms_unit_price_fcfa} FCFA` : "-"}
              </p>
            </div>
          ) : null}
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
            Impossible de charger les paramètres Alertes Parents. Le tarif ne peut pas être modifié pour le moment.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="general">Général</TabsTrigger>
        <TabsTrigger value="scolarite">Scolarité</TabsTrigger>
        <TabsTrigger value="abonnements">Abonnements</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="alertes">Alertes</TabsTrigger>
        <TabsTrigger value="personnel">Personnel</TabsTrigger>
      </TabsList>
      {canManagePositions ? (
        <TabsContent value="general" data-tour="settings-school-panel">
        <OfflineDisabledFieldset notice="Configuration école indisponible hors ligne. Reconnectez-vous pour modifier ces paramètres.">
          <SchoolConfigPanel />
        </OfflineDisabledFieldset>
        </TabsContent>
      ) : null}

      <TabsContent value="scolarite" className="grid gap-3 sm:grid-cols-2">
        {[
          { href: "/academic/notes", label: "Notes & évaluations", desc: "Espace professeur" },
          { href: "/academic/completion", label: "Suivi de complétude", desc: "Bulletins par classe/matière" },
          { href: "/academic/report-cards", label: "Bulletins", desc: "Génération et publication" },
          { href: "/academic/conduct", label: "Conduite", desc: "Saisie prof / décision éducateur" },
        ].map((item) => (
          <Link key={item.href} to={item.href}
            className="min-h-12 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50"
          >
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block text-xs text-muted-foreground">{item.desc}</span>
          </Link>
        ))}
      </TabsContent>

      <TabsContent value="alertes" className="space-y-3">
        <Link to="/finance"
          className="flex min-h-12 items-center justify-between rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50"
        >
          <span>
            <span className="block text-sm font-medium">Règles de relance paiements</span>
            <span className="block text-xs text-muted-foreground">Préventive, retard, retard important</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </TabsContent>

      <TabsContent value="documents" className="space-y-3">
        <Link to="/enrollments"
          className="flex min-h-12 items-center justify-between rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50"
        >
          <span>
            <span className="block text-sm font-medium">Documents requis (inscriptions)</span>
            <span className="block text-xs text-muted-foreground">Pièces du dossier élève</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </TabsContent>

      {canAccessSmsTemplate ? (
        <TabsContent value="personnel" data-tour="settings-sms-templates-panel">
        <OfflineDisabledFieldset notice="Templates SMS indisponibles hors ligne.">
          <SmsTemplatePanel />
        </OfflineDisabledFieldset>
        </TabsContent>
      ) : null}

      </Tabs>
      {/* Section masquée tant que l'école ne monétise pas les alertes parents :
          le tarif/abonnement parent n'a aucun sens sans monétisation (cohérent avec les
          menus Abonnements/Revenus et la colonne Abonnements de la matrice de rôles). */}
      {canManageSchoolSettings && parentSmsMonetized ? (
        <TabsContent value="abonnements">
        <section className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20" data-tour="settings-sms">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Service Alertes Parents</h2>
              <p className="text-xs text-muted-foreground">
                Paramétrage de la souscription parent pour les notifications.
              </p>
            </div>
            <Badge variant="default">Activé</Badge>
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
                    Commission IvoirEdu : <strong>{smsFeatureQuery.data.commission_pct}%</strong> (défini par
                    IvoirEdu)
                  </p>
                </div>
              </form>
            </Form>
          ) : (
            <ContextualHelp title="Activation requise" tone="warning">
              Le portail d&apos;abonnement parent et les notifications Alertes Parents restent masqués tant que le service Alertes Parents n&apos;est pas activé par IvoirEdu.
            </ContextualHelp>
          )}
        </section>
        </TabsContent>
      ) : null}

      {!canManagePositions && !canManageSchoolSettings && !canAccessSmsTemplate ? (
        <ContextualHelp title="Paramètres non disponibles" tone="warning">
          Votre poste ne donne pas accès à la configuration école. Demandez au directeur les droits paramètres école, postes ou templates Alertes Parents selon la tâche à réaliser.
        </ContextualHelp>
      ) : null}
    </div>
    </>
  )
}
