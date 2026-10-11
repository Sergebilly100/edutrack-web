import { OnboardingReturn } from "@/modules/onboarding/OnboardingReturn"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listSchoolYears } from "@/modules/academic/academic.api"
import { FinancialAlertRules } from "@/modules/finance/components/FinancialAlertRules"
import { FinanceSettings } from "@/modules/finance/components/FinanceSettings"
import { TuitionConfiguration } from "@/modules/finance/components/TuitionConfiguration"
import { planResolvesRecovery, readTuitionRecovery } from "@/modules/finance/tuition-recovery"
import type { TuitionPlan } from "@/modules/finance/finance.api"
import { getEnrollmentPaymentSummary } from "@/modules/enrollments/enrollments.api"
import { RiskAlertRules } from "@/modules/risk/components/RiskAlertRules"
import SchoolConfigPanel from "@/modules/settings/components/SchoolConfigPanel"
import SmsTemplatePanel from "@/modules/settings/components/SmsTemplatePanel"
import { RequiredDocumentsSettings } from "@/modules/settings/components/RequiredDocumentsSettings"
import { ConductSettings } from "@/modules/settings/components/ConductSettings"
import {
  fetchSchoolConfig,
  fetchAdministrationConfig,
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
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const recovery = readTuitionRecovery(searchParams)
  const canEditTuition = hasPermission("tuition.edit")
  const currentLocation = useRef<typeof location | null>(location)
  useEffect(() => { currentLocation.current = location; return () => { currentLocation.current = null } }, [location])
  const studentLabels = useStudentLabels()
  const canManagePositions = user?.role === "director" || hasPermission("settings.positions")
  const canEditConductPolicy = user?.role === "director" || hasPermission("school_years.edit")
  const canViewConductSettings = canManagePositions || canEditConductPolicy
  const canManageSchoolSettings = user?.role === "director" || hasPermission("settings.school")
  const tour = useTourGuide("settings", user?.role === "director")
  const canEditSmsTemplate = hasPermission("settings.sms_templates")
  const canAccessSmsTemplate = user?.role === "director" || canEditSmsTemplate
  const smsTemplateAccessLabel = !canAccessSmsTemplate ? "Lecture restreinte"
    : canEditSmsTemplate ? "Modifiables" : "Activation requise"
  const canViewRequiredDocuments = user?.role === "director" || hasPermission("enrollments.view")
  const canEditRequiredDocuments = user?.role === "director" || hasPermission("enrollments.edit")
  const canViewTuition = user?.role === "director" || hasPermission("tuition.view") || canEditTuition
  const canViewFinancialAlerts = user?.role === "director" || hasPermission("payments.view")
  const canEditFinancialAlerts = user?.role === "director" || hasPermission("financial_alerts.edit")
  const canManageRiskAlerts = user?.role === "director" || hasPermission("risk_alerts.edit")
  const canViewFinanceSettings = canManageSchoolSettings || user?.role === "director" || hasPermission("subscription_plans.view")
  const canManageFinance = canViewTuition || canViewFinancialAlerts || canViewFinanceSettings
  const canReadSchoolYears = hasPermission("school_years.view")
  const schoolYearsQuery = useQuery({ queryKey: ["academic", "school-years"], queryFn: listSchoolYears, enabled: canReadSchoolYears })
  const [financeSchoolYearId, setFinanceSchoolYearId] = useState(recovery && canEditTuition ? recovery.schoolYearId : "")
  const financeSchoolYears = recovery && canEditTuition && !canReadSchoolYears
    ? [{ id: recovery.schoolYearId, label: recovery.schoolYearLabel }]
    : schoolYearsQuery.data ?? []

  const resumePayment = async (plan: TuitionPlan) => {
    const startingLocation = location
    if (!recovery || !canEditTuition || !hasPermission("enrollments.confirm_payment") || !planResolvesRecovery(plan, recovery)) return
    try {
      // The server verifies that the dossier can now use the saved plan.
      await queryClient.fetchQuery({
        queryKey: ["enrollments", "payment-summary", recovery.enrollmentId],
        queryFn: () => getEnrollmentPaymentSummary(recovery.enrollmentId),
        staleTime: 0,
        retry: false,
      })
      if (currentLocation.current?.key === startingLocation.key) navigate(recovery.returnTo, { replace: true })
    } catch {
      toast({ title: "Paiement à vérifier", description: "Le plan est enregistré, mais ce paiement ne peut pas encore être repris. Vérifiez l’année et le niveau du dossier.", variant: "destructive" })
    }
  }
  const schoolConfigQuery = useQuery({
    queryKey: ["settings", "school-config", "access-gate", canManagePositions ? "administration" : "school"],
    queryFn: canManagePositions ? fetchAdministrationConfig : fetchSchoolConfig,
    enabled: canManagePositions || canManageSchoolSettings,
    retry: false,
  })
  const smsFeatureQuery = useQuery({
    queryKey: ["settings", "sms-feature"],
    queryFn: getSchoolSmsFeatureSettings,
  })
  // L'école ne monétise les alertes parents que si IvoirEdu a activé le service
  // (is_enabled) ET que l'école a opté pour la monétisation (monetize_parent_alerts).
  // Les écrans Abonnements/Revenus et le tarif ci-dessous suivent ce booléen.
  // La matrice affiche toujours le catalogue complet et explique les indisponibilités.
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

  useEffect(() => {
    const schoolYears = schoolYearsQuery.data ?? []
    if (!financeSchoolYearId && schoolYears.length > 0) {
      setFinanceSchoolYearId((schoolYears.find((year) => year.status === "active") ?? schoolYears[0]).id)
    }
  }, [financeSchoolYearId, schoolYearsQuery.data])

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
  const canManageGeneralSettings = canManageSchoolSettings
  const defaultTab = canManageGeneralSettings
    ? "general"
    : canViewConductSettings ? "personnel" : canViewRequiredDocuments
      ? "scolarite"
      : canManageFinance ? "finance" : canManageRiskAlerts ? "risques" : canAccessSmsTemplate ? "communication" : "relances"

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
      <OnboardingReturn />
      {recovery ? <Alert><AlertDescription>{canEditTuition
        ? `Paiement en attente : configurez les frais du niveau ${recovery.levelName} pour l’année ${recovery.schoolYearLabel}. Le retour au paiement aura lieu après l’enregistrement de ce plan.`
        : "Contactez le responsable habilité de l’école pour configurer ces frais, puis reprenez ce paiement."}</AlertDescription></Alert> : null}
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
              {smsTemplateAccessLabel}
            </p>
          </div>
        </div>
      </div>

      {(canManagePositions || canManageSchoolSettings) && schoolConfigQuery.isError ? (
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

      <Tabs value={([
        canManageGeneralSettings && "general", canViewConductSettings && "personnel",
        canViewRequiredDocuments && "scolarite", canManageFinance && "finance",
        canViewFinancialAlerts && "relances", canManageRiskAlerts && "risques",
        canAccessSmsTemplate && "communication",
      ]).includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : defaultTab}
        onValueChange={(tab) => {
          if (tab !== "finance") currentLocation.current = null
          setSearchParams((current) => { const next = new URLSearchParams(current); next.set("tab", tab); return next })
        }}
        className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border sm:grid-cols-4 lg:grid-cols-7">
        {canManageGeneralSettings ? <TabsTrigger value="general" className="min-h-12">Général</TabsTrigger> : null}
        {canViewConductSettings ? <TabsTrigger value="personnel" className="min-h-12">Personnel</TabsTrigger> : null}
        {canViewRequiredDocuments ? <TabsTrigger value="scolarite" className="min-h-12">Scolarité</TabsTrigger> : null}
        {canManageFinance ? <TabsTrigger value="finance" className="min-h-12">Finance</TabsTrigger> : null}
        {canViewFinancialAlerts ? <TabsTrigger value="relances" className="min-h-12">Relances</TabsTrigger> : null}
        {canManageRiskAlerts ? <TabsTrigger value="risques" className="min-h-12">Risques</TabsTrigger> : null}
        {canAccessSmsTemplate ? <TabsTrigger value="communication" className="min-h-12">Communication</TabsTrigger> : null}
      </TabsList>
      {canManageGeneralSettings ? (
        <TabsContent value="general" data-tour="settings-school-panel">
        <OfflineDisabledFieldset notice="Configuration école indisponible hors ligne. Reconnectez-vous pour modifier ces paramètres.">
          <SchoolConfigPanel section="general" />
        </OfflineDisabledFieldset>
        </TabsContent>
      ) : null}

      {canViewConductSettings ? (
        <TabsContent value="personnel">
          <OfflineDisabledFieldset notice="Gestion du personnel indisponible hors ligne. Reconnectez-vous pour modifier les postes et les accès.">
            <div className="space-y-5">
              {canManagePositions ? <SchoolConfigPanel section="personnel" /> : null}
              <ConductSettings canEditPolicy={canEditConductPolicy} canManageAssignments={canManagePositions} />
            </div>
          </OfflineDisabledFieldset>
        </TabsContent>
      ) : null}

      {canViewRequiredDocuments ? (
        <TabsContent value="scolarite" className="space-y-3">
          <OfflineDisabledFieldset notice="Configuration des documents indisponible hors ligne.">
            <RequiredDocumentsSettings canEdit={canEditRequiredDocuments} />
          </OfflineDisabledFieldset>
        </TabsContent>
      ) : null}

      {canManageFinance ? (
        <TabsContent value="finance" className="space-y-4">
          {canViewTuition && (!recovery || canEditTuition) ? (
            <section className="space-y-4">
              <div className="max-w-sm space-y-2">
                <Label htmlFor="finance-school-year">Année scolaire</Label>
                <Select value={financeSchoolYearId} onValueChange={setFinanceSchoolYearId} disabled={schoolYearsQuery.isLoading || schoolYearsQuery.isError}>
                  <SelectTrigger id="finance-school-year" className="min-h-12"><SelectValue placeholder="Choisir une année scolaire" /></SelectTrigger>
                  <SelectContent>
                    {financeSchoolYears.map((schoolYear) => <SelectItem key={schoolYear.id} value={schoolYear.id}>{schoolYear.label}{"status" in schoolYear && schoolYear.status === "active" ? " · Active" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {schoolYearsQuery.isError ? <ContextualHelp title="Années scolaires indisponibles" tone="warning">Impossible de charger l&apos;année nécessaire à la configuration des frais.</ContextualHelp> : null}
              {financeSchoolYearId ? <TuitionConfiguration key={`${financeSchoolYearId}:${recovery?.enrollmentId ?? "normal"}`} schoolYearId={financeSchoolYearId} canEdit={canEditTuition} canGrantDiscount={user?.role === "director" || hasPermission("tuition.grant_discount")} recovery={recovery} onPlanSaved={resumePayment} /> : null}
            </section>
          ) : null}

          {canViewFinanceSettings ? <FinanceSettings canManageProviders={canManageSchoolSettings} canViewPlans={user?.role === "director" || hasPermission("subscription_plans.view")} canEditPlans={user?.role === "director" || hasPermission("subscription_plans.edit")} /> : null}

          {canManageSchoolSettings && parentSmsMonetized ? (
            <section className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20" data-tour="settings-sms">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Service Alertes Parents</h2>
                  <p className="text-xs text-muted-foreground">Paramétrage de la souscription parent pour les notifications.</p>
                </div>
                <Badge variant="default">Activé</Badge>
              </div>

              {smsFeatureQuery.data?.is_enabled ? (
                <Form {...smsPriceForm}>
                  <form onSubmit={smsPriceForm.handleSubmit((values) => saveSmsPriceMutation.mutate(values))} className="space-y-4">
                    <FormField control={smsPriceForm.control} name="smsUnitPriceFcfa" render={({ field }) => (
                      <FormItem className="space-y-2">
                        <Label htmlFor="sms-unit-price">{`Tarif par ${studentLabels.singularLower}/mois (FCFA)`}</Label>
                        <FormControl><Input id="sms-unit-price" inputMode="numeric" maxLength={5} placeholder="Ex: 2000" {...field} onChange={(event) => field.onChange(Number(event.target.value.replace(/\D/g, "")))} value={field.value === 0 ? "" : String(field.value)} /></FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">Entier entre 1 et 50000.</p>
                      </FormItem>
                    )} />
                    <div className="flex flex-wrap items-center gap-3">
                      {saveSmsPriceMutation.isSuccess && !smsPriceForm.formState.isDirty ? <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-300"><CheckCircle className="h-4 w-4" /><span className="text-sm font-medium">Tarif sauvegardé</span></div> : <OfflineGuard><Button type="submit" disabled={saveSmsPriceMutation.isPending || !smsPriceForm.formState.isDirty || !smsPriceForm.formState.isValid}>{saveSmsPriceMutation.isPending ? "Sauvegarde..." : "Sauvegarder le tarif"}</Button></OfflineGuard>}
                      <p className="text-sm text-muted-foreground">Commission IvoirEdu : <strong>{smsFeatureQuery.data.commission_pct}%</strong> (défini par IvoirEdu)</p>
                    </div>
                  </form>
                </Form>
              ) : <ContextualHelp title="Activation requise" tone="warning">Le portail d&apos;abonnement parent et les notifications Alertes Parents restent masqués tant que le service n&apos;est pas activé par IvoirEdu.</ContextualHelp>}
            </section>
          ) : null}
        </TabsContent>
      ) : null}

      {canViewFinancialAlerts ? <TabsContent value="relances"><FinancialAlertRules canEdit={canEditFinancialAlerts} /></TabsContent> : null}

      {canManageRiskAlerts ? (
        <TabsContent value="risques">
          <RiskAlertRules />
        </TabsContent>
      ) : null}

      {canAccessSmsTemplate ? (
        <TabsContent value="communication" data-tour="settings-sms-templates-panel">
        <OfflineDisabledFieldset notice="Templates SMS indisponibles hors ligne.">
          <SmsTemplatePanel canReadTemplate={canEditSmsTemplate} />
        </OfflineDisabledFieldset>
        </TabsContent>
      ) : null}

      </Tabs>

      {!canManagePositions && !canManageSchoolSettings && !canAccessSmsTemplate && !canViewRequiredDocuments && !canManageFinance && !canManageRiskAlerts ? (
        <ContextualHelp title="Paramètres non disponibles" tone="warning">
          Votre poste ne donne pas accès à la configuration école. Demandez au directeur les droits paramètres école, postes ou templates Alertes Parents selon la tâche à réaliser.
        </ContextualHelp>
      ) : null}
    </div>
    </>
  )
}
