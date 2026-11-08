import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Building2, CheckCircle, ChevronDown, KeyRound, Lock, Pencil, Plus, Settings2, Shield, Trash2, UserPlus, Users, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import PositionFormModal, { type PositionPayload } from "@/modules/settings/components/PositionFormModal"
import {
  assignUserToPosition,
  createAdministrativeUser,
  deleteAdministrativeUser,
  deletePosition,
  fetchSchoolConfig,
  fetchAdministrationConfig,
  resetAdministrativeUserPassword,
  unassignUserFromPosition,
  type AssignableUser,
  type CreateAdministrativeUserInput,
  type PositionItem,
  updateAdministrativeUser,
  updateSchoolInfo,
  updateSchoolLimit,
  getSchoolSmsFeatureSettings,
  updateRealHoursConfig,
} from "@/modules/settings/settings.api"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { OfflineGuard } from "@/shared/components/OfflineGuard"
import { ContextualHelp } from "@/shared/components/ContextualHelp"
import { zodResolver } from "@hookform/resolvers/zod/dist/zod.js"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { SchoolIdentitySection } from "../identity/SchoolIdentitySection"

const SETTINGS_QUERY_KEY = ["settings", "school-config"] as const
const PHONE_CI_REGEX = /^225\d{10}$/

const normalizePhoneInput = (value: string) => value.replace(/\D/g, "").slice(0, 13)

const smsPriceSchema = z.object({
  smsUnitPriceFcfa: z.number().int().min(1).max(50000),
  checkoutToleranceMinutes: z.number().int().min(0).max(30),
})
type SmsPriceFormValues = z.infer<typeof smsPriceSchema>

export default function SchoolConfigPanel({ section = "all" }: { section?: "all" | "general" | "personnel" | "academic" }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const canManagePositions = hasPermission("settings.positions")
  const canManageSchoolSettings = user?.role === "director" || hasPermission("settings.school")
  const showGeneral = section === "all" || section === "general"
  const showPersonnel = section === "all" || section === "personnel"
  const showAcademic = section === "all" || section === "academic"

  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [positionToEdit, setPositionToEdit] = useState<PositionPayload | null>(null)

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [positionToAssign, setPositionToAssign] = useState<PositionItem | null>(null)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPhone, setNewUserPhone] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [resetPasswordTarget, setResetPasswordTarget] = useState<AssignableUser | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState("")
  const [criticalActionTarget, setCriticalActionTarget] = useState<
    | { type: "reset_credentials"; userId: string; userName: string; newPassword: string }
    | { type: "unassign_role"; userId: string; userName: string; positionId: string; positionName: string }
    | null
  >(null)
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "position"; id: string; name: string }
    | { type: "user"; id: string; name: string }
    | null
  >(null)

  const schoolConfigQuery = useQuery({
    queryKey: [...SETTINGS_QUERY_KEY, showPersonnel && canManagePositions ? "administration" : "school"],
    queryFn: showPersonnel && canManagePositions ? fetchAdministrationConfig : fetchSchoolConfig,
    enabled: canManagePositions || canManageSchoolSettings,
    refetchOnMount: "always",
    retry: false,
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

  // Le formulaire est créé avant l'arrivée des données : on l'aligne dès qu'elles sont chargées
  // (sans écraser une saisie en cours).
  useEffect(() => {
    if (!smsFeatureQuery.data) return
    smsPriceForm.reset({
      smsUnitPriceFcfa: smsFeatureQuery.data.sms_unit_price_fcfa ?? 0,
      checkoutToleranceMinutes: smsFeatureQuery.data.checkout_tolerance_minutes ?? 5,
    }, { keepDirtyValues: true })
  }, [smsFeatureQuery.data, smsPriceForm])

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

  const [maxAdminPositions, setMaxAdminPositions] = useState("0")
  const [addressDraft, setAddressDraft] = useState("")
  const [allowTeacherQrSkipDraft, setAllowTeacherQrSkipDraft] = useState(false)
  const [evaluationGraceDraft, setEvaluationGraceDraft] = useState('7')
  const [evaluationLateDraft, setEvaluationLateDraft] = useState('14')
  const [pendingQrSkipState, setPendingQrSkipState] = useState<boolean | null>(null)

  useEffect(() => {
    if (!schoolConfigQuery.data) {
      return
    }

    setMaxAdminPositions(String(schoolConfigQuery.data.limits.maxAdminPositions))
    setAddressDraft(schoolConfigQuery.data.school.address ?? "")
    setAllowTeacherQrSkipDraft(Boolean(schoolConfigQuery.data.school.allowTeacherQrSkip))
    setEvaluationGraceDraft(String(schoolConfigQuery.data.school.evaluationGraceDays))
    setEvaluationLateDraft(String(schoolConfigQuery.data.school.evaluationLateDays))
  }, [schoolConfigQuery.data])

  const saveSchoolInfoMutation = useMutation({
    mutationFn: (payload: { address?: string }) =>
      updateSchoolInfo({
        ...(payload.address !== undefined ? { address: payload.address } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      toast({ title: "Informations école mises à jour" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les informations de l’école.",
        variant: "destructive",
      })
    },
  })

  const saveQrSkipPolicyMutation = useMutation({
    mutationFn: (allowTeacherQrSkip: boolean) =>
      updateSchoolInfo({
        allowTeacherQrSkip,
      }),
    onSuccess: async (_, allowTeacherQrSkip) => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      setAllowTeacherQrSkipDraft(allowTeacherQrSkip)
      toast({
        title: "Politique de scan QR mise à jour",
        description: allowTeacherQrSkip
          ? "Les enseignants peuvent désormais passer l'étape du scan QR."
          : "Le scan QR redevient obligatoire pour tous les enseignants.",
      })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la politique de scan QR.",
        variant: "destructive",
      })
    },
    onSettled: () => {
      setPendingQrSkipState(null)
    },
  })

  const saveEvaluationDelaysMutation = useMutation({
    mutationFn: () => updateSchoolInfo({
      evaluationGraceDays: Number(evaluationGraceDraft), evaluationLateDays: Number(evaluationLateDraft),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['evaluation-review'] })
      toast({ title: 'Délais de saisie des notes enregistrés' })
    },
    onError: () => toast({ title: 'Impossible de sauvegarder les délais', variant: 'destructive' }),
  })

  const saveLimitMutation = useMutation({
    mutationFn: () => updateSchoolLimit(Number(maxAdminPositions)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      toast({ title: "Limite mise à jour" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la limite.",
        variant: "destructive",
      })
    },
  })

  const createUserMutation = useMutation({
    mutationFn: (payload: CreateAdministrativeUserInput) => createAdministrativeUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      setNewUserName("")
      setNewUserEmail("")
      setNewUserPhone("")
      setNewUserPassword("")
      toast({ title: "Utilisateur administratif créé" })
    },
    onError: (error) => {
      const description =
        axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible de créer l'utilisateur."
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; email: string | null; phone: string | null }) =>
      updateAdministrativeUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      setEditingUserId(null)
      setNewUserName("")
      setNewUserEmail("")
      setNewUserPhone("")
      setNewUserPassword("")
      toast({ title: "Utilisateur administratif mis à jour" })
    },
    onError: (error) => {
      const description =
        axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible de mettre à jour l'utilisateur."
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePosition,
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le poste.",
        variant: "destructive",
      })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: deleteAdministrativeUser,
    onError: (error) => {
      const description =
        axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible de supprimer l'utilisateur."
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      resetAdministrativeUserPassword(userId, newPassword),
    onSuccess: () => {
      setResetPasswordTarget(null)
      setResetPasswordValue("")
      toast({ title: "Mot de passe réinitialisé" })
    },
    onError: (error) => {
      const description =
        axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible de réinitialiser le mot de passe."
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ positionId, userId }: { positionId: string; userId: string }) =>
      assignUserToPosition(positionId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      setAssignDialogOpen(false)
      setPositionToAssign(null)
      setSelectedUserId("")
      setAssignError(null)
      toast({ title: "Utilisateur assigné" })
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
        const apiError = error.response.data.error
        setAssignError(apiError)
        return
      }

      setAssignError("Impossible d'assigner cet utilisateur.")
      toast({
        title: "Erreur",
        description: "Impossible d'assigner cet utilisateur.",
        variant: "destructive",
      })
    },
  })

  const unassignMutation = useMutation({
    mutationFn: ({ positionId, userId }: { positionId: string; userId: string }) =>
      unassignUserFromPosition(positionId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      toast({ title: "Rôle retiré" })
    },
    onError: (error) => {
      const description =
        axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : "Impossible de retirer ce rôle."
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })

  const positions = schoolConfigQuery.data?.positions ?? []
  const assignableUsers = schoolConfigQuery.data?.users ?? []
  const canEditLimits = user?.role === "super_admin"
  const school = schoolConfigQuery.data?.school
  const parsedMaxAdminPositions = Number(maxAdminPositions)
  const isMaxAdminPositionsValid =
    maxAdminPositions.length > 0 &&
    Number.isInteger(parsedMaxAdminPositions) &&
    parsedMaxAdminPositions >= 0 &&
    parsedMaxAdminPositions <= 500
  const isAdministrativePhoneValid = newUserPhone.trim().length === 0 || PHONE_CI_REGEX.test(newUserPhone.trim())
  const canSubmitAdministrativeUser =
    newUserName.trim().length >= 2 &&
    (editingUserId ? true : newUserPassword.length >= 8) &&
    (newUserEmail.trim().length > 0 || newUserPhone.trim().length > 0) &&
    isAdministrativePhoneValid

  const handleDeletePosition = (position: PositionPayload) => {
    setDeleteTarget({ type: "position", id: position.id, name: position.name })
  }

  const openAssignDialog = (position: PositionItem) => {
    setPositionToAssign(position)
    setSelectedUserId("")
    setAssignError(null)
    setAssignDialogOpen(true)
  }

  const handleCreateAdministrativeUser = () => {
    const name = newUserName.trim()
    const email = newUserEmail.trim()
    const phone = newUserPhone.trim()
    const password = newUserPassword

    if (name.length < 2) {
      toast({
        title: "Nom requis",
        description: "Saisissez un nom complet valide.",
        variant: "destructive",
      })
      return
    }

    if (!editingUserId && password.length < 8) {
      toast({
        title: "Mot de passe invalide",
        description: "Le mot de passe doit contenir au moins 8 caractères.",
        variant: "destructive",
      })
      return
    }

    if (!email && !phone) {
      toast({
        title: "Contact requis",
        description: "Ajoutez un email ou un numéro de téléphone.",
        variant: "destructive",
      })
      return
    }

    if (phone && !PHONE_CI_REGEX.test(phone)) {
      toast({
        title: "Téléphone invalide",
        description: "Le téléphone doit respecter le format 225XXXXXXXXXX.",
        variant: "destructive",
      })
      return
    }

    if (editingUserId) {
      updateUserMutation.mutate({
        id: editingUserId,
        name,
        email: email || null,
        phone: phone || null,
      })
      return
    }

    createUserMutation.mutate({
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      password,
    })
  }

  const handleEditAdministrativeUser = (schoolUser: AssignableUser) => {
    setEditingUserId(schoolUser.id)
    setNewUserName(schoolUser.name)
    setNewUserEmail(schoolUser.email ?? "")
    setNewUserPhone(schoolUser.phone ?? "")
    setNewUserPassword("")
  }

  const handleDeleteAdministrativeUser = (schoolUser: AssignableUser) => {
    setDeleteTarget({ type: "user", id: schoolUser.id, name: schoolUser.name })
  }

  const confirmDeleteTarget = () => {
    if (!deleteTarget) {
      return
    }

    if (deleteTarget.type === "position") {
      deleteMutation.mutate(deleteTarget.id, {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
          setDeleteTarget(null)
          toast({ title: "Poste supprimé" })
        },
      })
      return
    }

    deleteUserMutation.mutate(deleteTarget.id, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
        if (editingUserId === deleteTarget.id) {
          setEditingUserId(null)
          setNewUserName("")
          setNewUserEmail("")
          setNewUserPhone("")
          setNewUserPassword("")
        }
        setDeleteTarget(null)
        toast({ title: "Utilisateur administratif supprimé" })
      },
    })
  }

  const handleResetPassword = () => {
    const newPassword = resetPasswordValue.trim()
    if (!resetPasswordTarget) {
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: "Mot de passe invalide",
        description: "Le mot de passe doit contenir au moins 8 caractères.",
        variant: "destructive",
      })
      return
    }

    setCriticalActionTarget({
      type: "reset_credentials",
      userId: resetPasswordTarget.id,
      userName: resetPasswordTarget.name,
      newPassword,
    })
  }

  const handleUnassignPosition = (payload: {
    positionId: string
    userId: string
    userName: string
    positionName: string
  }) => {
    setCriticalActionTarget({
      type: "unassign_role",
      userId: payload.userId,
      userName: payload.userName,
      positionId: payload.positionId,
      positionName: payload.positionName,
    })
  }

  const confirmCriticalAction = () => {
    if (!criticalActionTarget) {
      return
    }

    if (criticalActionTarget.type === "reset_credentials") {
      resetPasswordMutation.mutate({
        userId: criticalActionTarget.userId,
        newPassword: criticalActionTarget.newPassword,
      })
      setCriticalActionTarget(null)
      return
    }

    unassignMutation.mutate({
      userId: criticalActionTarget.userId,
      positionId: criticalActionTarget.positionId,
    })
    setCriticalActionTarget(null)
  }

  const maxPositions = schoolConfigQuery.data?.limits.maxAdminPositions ?? 0
  const positionsUsagePct = maxPositions > 0 ? Math.min(100, Math.round((positions.length / maxPositions) * 100)) : 0
  const evaluationDelaysFilled = evaluationGraceDraft.trim() !== "" && evaluationLateDraft.trim() !== ""
  const evaluationDelaysInvalid = evaluationDelaysFilled && Number(evaluationGraceDraft) >= Number(evaluationLateDraft)

  const planLabel = school?.plan === "pro" ? "Pro" : school?.plan === "establishment" ? "Establishment" : "Essential"
  const teachingTypeLabel =
    school?.teachingType === "primaire"
      ? "Primaire"
      : school?.teachingType === "secondaire"
        ? "Secondaire"
        : school?.teachingType === "superieur"
          ? "Supérieur"
          : school?.teachingType === "mixte"
            ? "Mixte"
            : school?.teachingType === "technical"
              ? "Technique"
              : school?.teachingType === "mixed"
                ? "Mixte"
                : "Général"

  if (!canManagePositions && !canManageSchoolSettings) return (
    <Alert variant="destructive"><AlertDescription>Votre poste ne permet pas de consulter ces paramètres.</AlertDescription></Alert>
  )
  if (schoolConfigQuery.isPending) return (
    <div role="status" aria-label="Chargement des paramètres école" className="space-y-4">
      <p className="text-sm text-muted-foreground">Chargement des paramètres école…</p>
      <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
    </div>
  )
  if (schoolConfigQuery.isError) return (
    <Alert variant="destructive"><AlertDescription className="space-y-3">
      <p>{schoolConfigQuery.error instanceof Error ? schoolConfigQuery.error.message : "Impossible de charger les paramètres école."}</p>
      <Button type="button" variant="outline" className="min-h-12" onClick={() => void schoolConfigQuery.refetch()}>Réessayer</Button>
    </AlertDescription></Alert>
  )

  return (
    <>
      <div className="space-y-5">
        {showGeneral ? <>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-tour="settings-school-info">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4" data-tour="settings-school-info-header">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Informations école</p>
                    <p className="text-xs text-muted-foreground">Vue synthétique et identité visuelle.</p>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1.5"><Lock className="h-3 w-3" />Lecture seule</Badge>
              </div>
              <div className="space-y-5 p-5">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <SchoolInfoItem label="Nom de l'école" value={school?.name} />
                  <SchoolInfoItem label="Ville" value={school?.city} />
                  <SchoolInfoItem label="Adresse" value={addressDraft} />
                  <SchoolInfoItem label="Plan actif" value={planLabel}  />
                  <SchoolInfoItem label="Type d'enseignement" value={teachingTypeLabel} />
                  <SchoolInfoItem label="Année scolaire" value={school?.activeSchoolYear} />
                </dl>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">Adresse web de votre espace : <Badge variant="outline">{school?.subdomain ? `${school.subdomain}.ivoiredu.ci` : ""}</Badge></span> 
                </div> 
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    <span>Informations gérées par IvoirEdu : contactez-nous pour toute correction.</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm" data-tour="settings-qr-skip-policy">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Politique de scan QR Codes des salles</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choisissez si l’enseignant doit scanner le QR code de la salle pour terminer son pointage.</p>

                </div>
                <div className="grid items-center gap-3 sm:grid-cols-[1fr_0.5fr] items-baseline ">

                  <Alert className={cn(
                    "border",
                    allowTeacherQrSkipDraft
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-green-200 bg-green-50 text-green-900"
                  )}>
                    <AlertTitle>État actuel</AlertTitle>
                    <AlertDescription>
                      {allowTeacherQrSkipDraft
                        ? "Les enseignants peuvent terminer le flux de pointage sans scanner le QR code de salle."
                        : "Les enseignants doivent scanner le QR code de salle."}
                    </AlertDescription>
                  </Alert>
                  <Button
                    type="button"
                    aria-pressed={allowTeacherQrSkipDraft}
                    variant={allowTeacherQrSkipDraft ? "default" : "outline"}
                    className="min-w-44 "
                    disabled={saveQrSkipPolicyMutation.isPending}
                    onClick={() => setPendingQrSkipState(!allowTeacherQrSkipDraft)}
                  >
                    {allowTeacherQrSkipDraft ? "Désactiver le mode facultatif" : "Activer le mode facultatif"}
                  </Button> 
                </div>

                <p className="text-xs text-muted-foreground">
                  Obligatoire : le bouton « Passer cette étape » est masqué pendant le pointage. Facultatif : il est proposé à l’enseignant.
                  Ce paramètre est appliqué immédiatement après confirmation.
                </p>
              </div>
            </div>
        {canManageSchoolSettings ? (
          <section
            data-tour="settings-real-hours"
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
                {smsFeatureQuery.data?.use_real_hours ? "Activé par IvoirEdu" : "Non activé"}
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
                La valeur de tolérance existe mais elle est ignorée tant que les heures réelles ne sont pas activées par IvoirEdu. <br />
                Les heures courtes sont alors considérées comme des présences normales et validées automatiquement.
              </ContextualHelp>
            )}
          </section>
        ) : null}
          </div>
          <div className="space-y-5">
            <SchoolIdentitySection canManage={canManageSchoolSettings} />
          </div>
        </div>

        </> : null}

        {showAcademic ? <>
        {canManageSchoolSettings ? <section id="evaluation-delays" aria-labelledby="evaluation-delays-title" className="space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <div>
            <h2 id="evaluation-delays-title" className="text-lg font-semibold">Délais de saisie des notes</h2>
            <p className="text-sm text-muted-foreground">Après le délai de grâce, une saisie devient attendue. Au-delà du seuil de retard, elle apparaît en rouge.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="evaluation-grace-days">Délai de grâce (jours)</Label>
              <Input id="evaluation-grace-days" type="number" min={0} max={364} value={evaluationGraceDraft} onChange={(event) => setEvaluationGraceDraft(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="evaluation-late-days">Seuil de retard (jours)</Label>
              <Input id="evaluation-late-days" type="number" min={1} max={365} value={evaluationLateDraft} onChange={(event) => setEvaluationLateDraft(event.target.value)} /></div>
          </div>
          <p className={cn("text-sm", evaluationDelaysInvalid ? "text-destructive" : "text-muted-foreground")} role={evaluationDelaysInvalid ? "alert" : undefined}>Le seuil de retard doit être supérieur au délai de grâce.</p>
          {evaluationDelaysFilled && !evaluationDelaysInvalid ? <p className="text-sm text-muted-foreground">Avec ces valeurs : la saisie est attendue {evaluationGraceDraft} jour{Number(evaluationGraceDraft) > 1 ? "s" : ""} après l’évaluation, et apparaît en rouge au-delà de {evaluationLateDraft} jours.</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"> 
              
            <Button type="button" className="min-h-12" disabled={saveEvaluationDelaysMutation.isPending ||
              !Number.isInteger(Number(evaluationGraceDraft)) || !Number.isInteger(Number(evaluationLateDraft)) ||
              evaluationGraceDraft.trim() === '' || evaluationLateDraft.trim() === '' ||
              Number(evaluationGraceDraft) < 0 || Number(evaluationLateDraft) > 365 ||
              Number(evaluationGraceDraft) >= Number(evaluationLateDraft) ||
              (Number(evaluationGraceDraft) === school?.evaluationGraceDays && Number(evaluationLateDraft) === school?.evaluationLateDays)}
              onClick={() => saveEvaluationDelaysMutation.mutate()}>
              {saveEvaluationDelaysMutation.isPending ? 'Enregistrement…' : 'Enregistrer les délais'}
            </Button>
          </div>
        </section> : null}
        </> : null}

        {showPersonnel && canManagePositions ? <>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-tour="settings-positions-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Postes administratifs</p>
                  <p className="text-xs text-muted-foreground">Créez, assignez et modifiez les postes.</p>
                </div>
              </div>
              {canManagePositions ? (
                <Button
                  onClick={() => {
                    setPositionToEdit(null)
                    setPositionModalOpen(true)
                  }}
                  className="min-h-12 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau poste
                </Button>
              ) : null}
            </div>
            <div>
              {positions.length === 0 ? (
                <EmptyState title="Aucun poste créé" description="Créez un poste pour définir les accès du personnel administratif." />
              ) : (
                positions.map((position, index) => (
                  <div
                    key={position.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium",
                          index % 3 === 0 && "bg-blue-50 text-blue-700",
                          index % 3 === 1 && "bg-green-50 text-green-700",
                          index % 3 === 2 && "bg-amber-50 text-amber-900",
                        )}
                      >
                        {position.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{position.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {position.assignmentsCount ?? 0} personne{(position.assignmentsCount ?? 0) !== 1 ? "s" : ""} assignée
                          {(position.assignmentsCount ?? 0) !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {position.permissions.length} permission{position.permissions.length !== 1 ? "s" : ""}
                      </Badge>
                      {canManagePositions ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-12 gap-2 sm:min-h-9"
                            onClick={() => openAssignDialog(position)}
                            aria-label={`Assigner un utilisateur au poste ${position.name}`}
                          >
                            <UserPlus className="h-4 w-4" />
                            Assigner
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-12 gap-2 sm:min-h-9"
                            onClick={() => {
                              setPositionToEdit(position)
                              setPositionModalOpen(true)
                            }}
                            aria-label={`Modifier le poste ${position.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 text-destructive sm:h-9 sm:w-9"
                            onClick={() => handleDeletePosition(position)}
                            disabled={deleteMutation.isPending}
                            aria-label={`Supprimer le poste ${position.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-tour="settings-limits">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Limites</p>
                  <p className="text-xs text-muted-foreground">Maximum de postes administratifs autorisés.</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {positions.length}
                  <span className="text-lg font-medium text-muted-foreground"> / {maxPositions}</span>
                </p>
                <p className="text-sm text-muted-foreground">postes utilisés</p>
              </div>
              <Progress value={positionsUsagePct} aria-label="Postes utilisés" />
              {canEditLimits ? (
                <div className="space-y-2">
                  <Label htmlFor="max-admin-positions" className="text-sm font-medium">Nombre maximum de postes</Label>
                  <Input
                    id="max-admin-positions"
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    inputMode="numeric"
                    value={maxAdminPositions}
                    onChange={(event) => setMaxAdminPositions(event.target.value.replace(/\D/g, "").slice(0, 3))}
                  />
                  {!isMaxAdminPositionsValid ? (
                    <p className="text-xs text-destructive">Saisissez un entier entre 0 et 500.</p>
                  ) : null}
                  <Button
                    onClick={() => saveLimitMutation.mutate()}
                    disabled={saveLimitMutation.isPending || !isMaxAdminPositionsValid}
                    className="min-h-12 w-full"
                  >
                    {saveLimitMutation.isPending ? "Sauvegarde..." : "Mettre à jour"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Seul IvoirEdu peut modifier cette limite.</p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-tour="settings-admin-users">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Utilisateurs administratifs</p>
                <p className="text-xs text-muted-foreground">Créez des comptes et suivez leur affectation.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-admin-name" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Nom complet</Label>
                  <Input
                    id="new-admin-name"
                    value={newUserName}
                    onChange={(event) => setNewUserName(event.target.value)}
                    placeholder="Ex: Kouamé Fatou"
                  />
                </div>
                {!editingUserId ? (
                  <div className="space-y-2">
                    <Label htmlFor="new-admin-password" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mot de passe provisoire</Label>
                    <Input
                      id="new-admin-password"
                      type="password"
                      value={newUserPassword}
                      onChange={(event) => setNewUserPassword(event.target.value)}
                      placeholder="Minimum 8 caractères"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="new-admin-email" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Email</Label>
                  <Input
                    id="new-admin-email"
                    type="email"
                    value={newUserEmail}
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    placeholder="admin@ecole.ci"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-admin-phone" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Téléphone</Label>
                  <Input
                    id="new-admin-phone"
                    value={newUserPhone}
                    onChange={(event) => setNewUserPhone(normalizePhoneInput(event.target.value))}
                    inputMode="tel"
                    maxLength={13}
                    placeholder="2250700000000"
                  />
                  <p className={isAdministrativePhoneValid ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                    Format attendu : 225 suivi de 10 chiffres (ex. 2250700000000).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCreateAdministrativeUser}
                  disabled={createUserMutation.isPending || updateUserMutation.isPending || !canSubmitAdministrativeUser}
                  className="gap-2"
                >
                  {editingUserId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editingUserId
                    ? updateUserMutation.isPending
                      ? "Mise à jour..."
                      : "Mettre à jour l'utilisateur"
                    : createUserMutation.isPending
                      ? "Création..."
                      : "Ajouter l'utilisateur"}
                </Button>
                {editingUserId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingUserId(null)
                      setNewUserName("")
                      setNewUserEmail("")
                      setNewUserPhone("")
                      setNewUserPassword("")
                    }}
                  >
                    Annuler
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {school ? school.adminUsersCount : "-"} utilisateur{(school?.adminUsersCount ?? 0) !== 1 ? "s" : ""} actif{(school?.adminUsersCount ?? 0) !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Les accès d’un utilisateur dépendent des postes qui lui sont assignés.
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {assignableUsers.length === 0 ? (
                  <EmptyState title="Aucun utilisateur administratif" description="Ajoutez un utilisateur pour lui attribuer un poste." />
                ) : (
                  assignableUsers.map((schoolUser) => (
                    <div key={schoolUser.id} className="flex flex-col gap-3 border-b border-border px-4 py-3 text-sm last:border-0 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 sm:flex-1">
                        <p className="font-medium">{schoolUser.name}</p>
                        <div className="flex flex-wrap items-center gap-1">
                          {schoolUser.assignedPositions.length > 0 ? (
                            <>
                              {schoolUser.assignedPositions.map((assignedPosition) => (
                                <span
                                  key={`${schoolUser.id}-${assignedPosition.id}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                  {assignedPosition.name}
                                  {canManagePositions ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-3.5 w-3.5"
                                      onClick={() =>
                                        handleUnassignPosition({
                                          positionId: assignedPosition.id,
                                          userId: schoolUser.id,
                                          userName: schoolUser.name,
                                          positionName: assignedPosition.name,
                                        })
                                      }
                                      disabled={unassignMutation.isPending}
                                      aria-label={`Retirer ${assignedPosition.name} de ${schoolUser.name}`}
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </Button>
                                  ) : null}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Aucun poste
                            </span>
                          )}
                          {/* <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            {schoolUser.permissions.length} permission{schoolUser.permissions.length !== 1 ? "s" : ""}
                          </span> */}
                        </div>
                      </div>
                      <div className="min-w-0 space-y-0.5 text-muted-foreground sm:flex-1">
                        <p className="break-all">{schoolUser.email ?? "-"}</p>
                        <p>{schoolUser.phone ?? "-"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-12 gap-2 sm:min-h-9"
                          onClick={() => {
                            setResetPasswordTarget(schoolUser)
                            setResetPasswordValue("")
                          }}
                          aria-label={`Réinitialiser le mot de passe de ${schoolUser.name}`}
                        >
                          <KeyRound className="h-4 w-4" />
                          Mot de passe
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-12 gap-2 sm:min-h-9"
                          onClick={() => handleEditAdministrativeUser(schoolUser)}
                          aria-label={`Modifier ${schoolUser.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-12 w-12 text-destructive sm:h-9 sm:w-9"
                          disabled={deleteUserMutation.isPending || deleteTarget?.type === "user"}
                          onClick={() => handleDeleteAdministrativeUser(schoolUser)}
                          aria-label={`Supprimer ${schoolUser.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {canManagePositions ? (
          <PositionFormModal
            open={positionModalOpen}
            onOpenChange={setPositionModalOpen}
            initialPosition={positionToEdit}
          />
        ) : null}
        </> : null}
      </div>

      <AlertDialog
        open={criticalActionTarget !== null}
        onOpenChange={(open) => !open && setCriticalActionTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {criticalActionTarget?.type === "reset_credentials"
                ? "Confirmer la réinitialisation des credentials ?"
                : "Confirmer le retrait du rôle ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {criticalActionTarget?.type === "reset_credentials"
                ? `Le mot de passe de ${criticalActionTarget.userName} sera remplacé immédiatement. Communiquez le nouveau mot de passe via un canal sécurisé.`
                : `Le rôle "${criticalActionTarget?.positionName ?? ""}" sera retiré à ${criticalActionTarget?.userName ?? ""}. L'accès associé sera perdu immédiatement.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCriticalAction}
              disabled={resetPasswordMutation.isPending || unassignMutation.isPending}
            >
              {resetPasswordMutation.isPending || unassignMutation.isPending ? "Traitement..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "position"
                ? "Supprimer ce poste administratif ?"
                : "Supprimer cet utilisateur administratif ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "position"
                ? `Le poste "${deleteTarget.name}" sera retiré définitivement. Cette action est irréversible.`
                : `L'utilisateur "${deleteTarget?.name ?? ""}" sera désactivé et retiré des affectations de poste.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTarget}
              disabled={deleteMutation.isPending || deleteUserMutation.isPending}
            >
              {deleteMutation.isPending || deleteUserMutation.isPending ? "Suppression..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={resetPasswordTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordTarget(null)
            setResetPasswordValue("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {resetPasswordTarget
                ? `Définissez un nouveau mot de passe pour ${resetPasswordTarget.name}.`
                : "Définissez un nouveau mot de passe."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-password">Nouveau mot de passe</Label>
            <Input
              id="reset-password"
              type="password"
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
              placeholder="Minimum 8 caractères"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResetPasswordTarget(null)
                setResetPasswordValue("")
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "Réinitialisation..." : "Réinitialiser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingQrSkipState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingQrSkipState(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingQrSkipState
                ? "Activer le scan QR facultatif pour les enseignants ?"
                : "Rendre le scan QR obligatoire pour les enseignants ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingQrSkipState
                ? "Les enseignants verront le bouton « Passer cette étape » pendant le pointage et pourront valider sans scanner la salle."
                : "Le bouton « Passer cette étape » disparaîtra du pointage enseignant. Le scan QR sera requis pour continuer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveQrSkipPolicyMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={saveQrSkipPolicyMutation.isPending}
              onClick={() => {
                if (pendingQrSkipState === null) {
                  return
                }
                saveQrSkipPolicyMutation.mutate(pendingQrSkipState)
              }}
            >
              {saveQrSkipPolicyMutation.isPending ? "Mise à jour..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canManagePositions ? (
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assigner un utilisateur</DialogTitle>
              <DialogDescription>
                {positionToAssign
                  ? `Sélectionnez un utilisateur pour le poste ${positionToAssign.name}.`
                  : "Sélectionnez un utilisateur."}
              </DialogDescription>
            </DialogHeader>

          {assignableUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun utilisateur assignable disponible. Vérifiez la source de données des utilisateurs de l&apos;école.
            </p>
          ) : (
            <div className="space-y-3">
              {assignError ? (
                <Alert variant="destructive">
                  <AlertTitle>Limite utilisateurs</AlertTitle>
                  <AlertDescription>{assignError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="assign-user">Utilisateur</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="assign-user">
                    <SelectValue placeholder="Choisir un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((schoolUser) => (
                      <SelectItem key={schoolUser.id} value={schoolUser.id}>
                        {schoolUser.name} ({schoolUser.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                type="button"
                disabled={!positionToAssign || !selectedUserId || assignMutation.isPending}
                onClick={() => {
                  if (!positionToAssign || !selectedUserId) {
                    return
                  }

                  assignMutation.mutate({
                    positionId: positionToAssign.id,
                    userId: selectedUserId,
                  })
                }}
              >
                Assigner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

function SchoolInfoItem({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value || "-"}</dd>
    </div>
  )
}
