import { OnboardingReturn, useOnboardingContext } from "@/modules/onboarding/OnboardingReturn"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
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
  updateParentAlertSettings,
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
  mandatoryAtEnrollment: z.boolean(),
  imposedDurationMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).nullable(),
  showOnSchoolReceipt: z.boolean(),
}).refine((value) => !value.mandatoryAtEnrollment || value.imposedDurationMonths !== null, {
  path: ["imposedDurationMonths"],
  message: "Choisissez une période imposée.",
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
  const onboardingContext = useOnboardingContext()
  const simplifiedForOnboarding = Boolean(onboardingContext.target)
  const recovery = readTuitionRecovery(searchParams)
  const canEditTuition = hasPermission("tuition.edit")
  const canManageStudentSchedule = user?.role === "director" || hasPermission("tuition.manage_student_schedule")
  const currentLocation = useRef<typeof location | null>(location)
  useEffect(() => { currentLocation.current = location; return () => { currentLocation.current = null } }, [location])
  const studentLabels = useStudentLabels()
  const canManagePositions = user?.role === "director" || hasPermission("settings.positions")
  const canEditConductPolicy = user?.role === "director" || hasPermission("school_years.edit")
  const canViewConductSettings = canManagePositions || canEditConductPolicy
  const canManageSchoolSettings = user?.role === "director" || hasPermission("settings.school")
  const tour = useTourGuide("settings", user?.role === "director" && !simplifiedForOnboarding)
  const canEditSmsTemplate = hasPermission("settings.sms_templates")
  const canAccessSmsTemplate = user?.role === "director" || canEditSmsTemplate
  const smsTemplateAccessLabel = !canAccessSmsTemplate ? "Lecture restreinte"
    : canEditSmsTemplate ? "Modifiables" : "Activation requise"
  const canViewRequiredDocuments = user?.role === "director" || hasPermission("enrollments.view")
  const canEditRequiredDocuments = user?.role === "director" || hasPermission("enrollments.edit")
  const canViewTuition = user?.role === "director" || hasPermission("tuition.view") || canEditTuition || canManageStudentSchedule
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
      mandatoryAtEnrollment: smsFeatureQuery.data?.mandatory_at_enrollment ?? false,
      imposedDurationMonths: smsFeatureQuery.data?.imposed_duration_months ?? null,
      showOnSchoolReceipt: smsFeatureQuery.data?.show_on_school_receipt ?? false,
    },
  })

  useEffect(() => {
    if (!smsFeatureQuery.data) return
    smsPriceForm.reset({
      smsUnitPriceFcfa: smsFeatureQuery.data.sms_unit_price_fcfa ?? 0,
      checkoutToleranceMinutes: smsFeatureQuery.data.checkout_tolerance_minutes ?? 5,
      mandatoryAtEnrollment: smsFeatureQuery.data.mandatory_at_enrollment,
      imposedDurationMonths: smsFeatureQuery.data.imposed_duration_months,
      showOnSchoolReceipt: smsFeatureQuery.data.show_on_school_receipt,
    }, { keepDirty: false })
  }, [smsFeatureQuery.data, smsPriceForm])

  useEffect(() => {
    const schoolYears = schoolYearsQuery.data ?? []
    if (!financeSchoolYearId && schoolYears.length > 0) {
      setFinanceSchoolYearId((schoolYears.find((year) => year.status === "active") ?? schoolYears[0]).id)
    }
  }, [financeSchoolYearId, schoolYearsQuery.data])

  const tariffValue = useWatch({ control: smsPriceForm.control, name: "smsUnitPriceFcfa" }) ?? 0
  const mandatoryAtEnrollment = useWatch({ control: smsPriceForm.control, name: "mandatoryAtEnrollment" }) ?? false

  const saveSmsPriceMutation = useMutation({
    mutationFn: (values: SmsPriceFormValues) => updateParentAlertSettings({
      smsUnitPriceFcfa: values.smsUnitPriceFcfa,
      mandatoryAtEnrollment: values.mandatoryAtEnrollment,
      imposedDurationMonths: values.mandatoryAtEnrollment ? values.imposedDurationMonths : null,
      showOnSchoolReceipt: values.showOnSchoolReceipt,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "sms-feature"] })
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "feature-settings"] })
      toast({ title: "Service Alertes Parents sauvegardé" })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder le tarif.",
        variant: "destructive",
      })
    },
  })

  const canManageGeneralSettings = canManageSchoolSettings
  const defaultTab = canManageGeneralSettings
    ? "general"
    : canViewConductSettings ? "personnel" : canViewRequiredDocuments
      ? "scolarite"
      : canManageFinance ? "finance" : canManageRiskAlerts ? "risques" : canAccessSmsTemplate ? "communication" : "relances"

  return (
    <>
      {!simplifiedForOnboarding ? (
        <TourGuide
          steps={settingsTourSteps}
          run={tour.run}
          stepIndex={tour.stepIndex}
          onStepChange={tour.setStepIndex}
          onFinish={tour.markDone}
        />
      ) : null}
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
            Configuration de l&apos;école, du personnel, du suivi académique, des frais de scolarité et des communications.
          </p>
        </div>
        {user?.role === "director" && !simplifiedForOnboarding ? (
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

      <div className={cn("grid gap-px overflow-hidden rounded-lg border border-border bg-border", parentSmsMonetized ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <div className="bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">École</p>
          <p className="mt-1 truncate text-sm font-medium">
            {schoolConfigQuery.data?.school.name ?? "Configuration école"}
          </p>
        </div>
        {parentSmsMonetized ? (
          <div className="bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Tarif Alertes Parents</p>
            <p className="mt-1 text-sm tabular-nums">
              <span className="text-lg font-semibold">
                {smsFeatureQuery.data?.sms_unit_price_fcfa ? `${smsFeatureQuery.data.sms_unit_price_fcfa.toLocaleString("fr-FR")} FCFA` : "-"}
              </span>
              {smsFeatureQuery.data?.sms_unit_price_fcfa ? <span className="text-muted-foreground">{` par ${studentLabels.singularLower} et par mois`}</span> : null}
            </p>
          </div>
        ) : null}
        <div className="bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Modèles de SMS</p>
          <p className="mt-1 truncate text-sm font-medium">{smsTemplateAccessLabel}</p>
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
        {canViewRequiredDocuments ? <TabsTrigger value="scolarite" className="min-h-12">Académique</TabsTrigger> : null}
        {canManageFinance ? <TabsTrigger value="finance" className="min-h-12 whitespace-normal text-center">Scolarité &amp; finances</TabsTrigger> : null}
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
          <OfflineDisabledFieldset notice="Configuration indisponible hors ligne.">
            <div className="space-y-5">
              <RequiredDocumentsSettings canEdit={canEditRequiredDocuments} />
              {canManageSchoolSettings ? <SchoolConfigPanel section="academic" /> : null}
            </div>
          </OfflineDisabledFieldset>
        </TabsContent>
      ) : null}

      {canManageFinance ? (
        <TabsContent value="finance" className="space-y-4">
          {canViewTuition && (!recovery || canEditTuition) ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div className="w-full max-w-sm space-y-2">
                <Label htmlFor="finance-school-year">Année scolaire</Label>
                <Select value={financeSchoolYearId} onValueChange={setFinanceSchoolYearId} disabled={schoolYearsQuery.isLoading || schoolYearsQuery.isError}>
                  <SelectTrigger id="finance-school-year" className="min-h-12"><SelectValue placeholder="Choisir une année scolaire" /></SelectTrigger>
                  <SelectContent>
                    {financeSchoolYears.map((schoolYear) => <SelectItem key={schoolYear.id} value={schoolYear.id}>{schoolYear.label}{"status" in schoolYear && schoolYear.status === "active" ? " · Active" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="max-w-md pb-3 text-sm text-muted-foreground">Les frais et les seuils ci-dessous s’appliquent à l’année scolaire choisie.</p>
              </div>
              {schoolYearsQuery.isError ? <ContextualHelp title="Années scolaires indisponibles" tone="warning">Impossible de charger l&apos;année nécessaire à la configuration des frais.</ContextualHelp> : null}
              {financeSchoolYearId ? <TuitionConfiguration key={`${financeSchoolYearId}:${recovery?.enrollmentId ?? "normal"}`} schoolYearId={financeSchoolYearId} canEdit={canEditTuition} canGrantDiscount={false} canManageStudentSchedule={false} simplifiedForOnboarding={simplifiedForOnboarding} recovery={recovery} onPlanSaved={resumePayment} /> : null}
            </section>
          ) : null}

          <div className={cn("grid gap-6", canViewFinanceSettings && canManageSchoolSettings && parentSmsMonetized && "xl:grid-cols-2 xl:items-start")}>
          {canViewFinanceSettings ? <FinanceSettings canManageProviders={canManageSchoolSettings} /> : null}

          {canManageSchoolSettings && parentSmsMonetized ? (
            <section className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20" data-tour="settings-sms">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Service Alertes Parents</h2>
                  <p className="text-xs text-muted-foreground">Tarif mensuel par élève, obligation à l’inscription, période et reçu scolaire.</p>
                </div>
                <Badge variant="default">Activé</Badge>
              </div>

              {smsFeatureQuery.data?.is_enabled ? (
                <Form {...smsPriceForm}>
                  <form onSubmit={smsPriceForm.handleSubmit((values) => saveSmsPriceMutation.mutate(values))} className="space-y-4">
                    <FormField control={smsPriceForm.control} name="smsUnitPriceFcfa" render={({ field }) => (
                      <FormItem className="space-y-2">
                        <Label htmlFor="sms-unit-price">Tarif mensuel par élève (FCFA)</Label>
                        <FormControl><Input id="sms-unit-price" inputMode="numeric" maxLength={5} placeholder="Ex: 2000" {...field} onChange={(event) => field.onChange(Number(event.target.value.replace(/\D/g, "")))} value={field.value === 0 ? "" : String(field.value)} /></FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">Entier entre 1 et 50000.</p>
                      </FormItem>
                    )} />
                    <FormField control={smsPriceForm.control} name="mandatoryAtEnrollment" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                            <Checkbox checked={field.value} onCheckedChange={(checked) => {
                              field.onChange(checked === true)
                              if (checked !== true) smsPriceForm.setValue("imposedDurationMonths", null, { shouldDirty: true })
                              else if (smsPriceForm.getValues("imposedDurationMonths") === null) smsPriceForm.setValue("imposedDurationMonths", 1, { shouldDirty: true })
                            }} />
                            <span>Obligatoire à l’inscription</span>
                          </label>
                        </FormControl>
                      </FormItem>
                    )} />
                    {mandatoryAtEnrollment ? (
                      <FormField control={smsPriceForm.control} name="imposedDurationMonths" render={({ field }) => (
                        <FormItem className="max-w-sm space-y-2">
                          <Label htmlFor="parent-alerts-duration">Période imposée</Label>
                          <Select value={field.value ? String(field.value) : ""} onValueChange={(value) => field.onChange(Number(value))}>
                            <FormControl><SelectTrigger id="parent-alerts-duration" className="min-h-12"><SelectValue placeholder="Choisir une période" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="1">1 mois</SelectItem><SelectItem value="3">3 mois</SelectItem>
                              <SelectItem value="6">6 mois</SelectItem><SelectItem value="12">12 mois</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    ) : null}
                    <FormField control={smsPriceForm.control} name="showOnSchoolReceipt" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                            <span>Afficher la ligne « Alertes Parents » sur le reçu scolaire</span>
                          </label>
                        </FormControl>
                      </FormItem>
                    )} />
                    <div className="flex flex-wrap items-center gap-3">
                      {saveSmsPriceMutation.isSuccess && !smsPriceForm.formState.isDirty ? <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-300"><CheckCircle className="h-4 w-4" /><span className="text-sm font-medium">Paramètres sauvegardés</span></div> : <OfflineGuard><Button type="submit" disabled={saveSmsPriceMutation.isPending || !smsPriceForm.formState.isDirty || !smsPriceForm.formState.isValid}>{saveSmsPriceMutation.isPending ? "Sauvegarde..." : "Enregistrer les paramètres"}</Button></OfflineGuard>}
                      <p className="text-sm text-muted-foreground">Commission plateforme : <strong>{smsFeatureQuery.data.commission_pct}%</strong> (définie par IvoirEdu)</p>
                    </div>
                  </form>
                </Form>
              ) : <ContextualHelp title="Activation requise" tone="warning">Le portail d&apos;abonnement parent et les notifications Alertes Parents restent masqués tant que le service n&apos;est pas activé par IvoirEdu.</ContextualHelp>}
            </section>
          ) : null}
          </div>
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
