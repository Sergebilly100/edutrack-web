import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Building2, KeyRound, Pencil, Plus, Settings2, Shield, Trash2, UserPlus, Users, X } from "lucide-react"

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
  resetAdministrativeUserPassword,
  unassignUserFromPosition,
  type AssignableUser,
  type CreateAdministrativeUserInput,
  type PositionItem,
  updateAdministrativeUser,
  updateSchoolInfo,
  updateSchoolLimit,
} from "@/modules/settings/settings.api"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"

const SETTINGS_QUERY_KEY = ["settings", "school-config"] as const

export default function SchoolConfigPanel() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()
  const canManagePositions = hasPermission("settings.positions")

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
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSchoolConfig,
  })

  const [maxAdminPositions, setMaxAdminPositions] = useState("0")
  const [logoUrlDraft, setLogoUrlDraft] = useState("")
  const [allowTeacherQrSkipDraft, setAllowTeacherQrSkipDraft] = useState(false)
  const [pendingQrSkipState, setPendingQrSkipState] = useState<boolean | null>(null)

  useEffect(() => {
    if (!schoolConfigQuery.data) {
      return
    }

    setMaxAdminPositions(String(schoolConfigQuery.data.limits.maxAdminPositions))
    setLogoUrlDraft(schoolConfigQuery.data.school.logoUrl ?? "")
    setAllowTeacherQrSkipDraft(Boolean(schoolConfigQuery.data.school.allowTeacherQrSkip))
  }, [schoolConfigQuery.data])

  const saveSchoolInfoMutation = useMutation({
    mutationFn: (payload: { logoUrl: string | null }) =>
      updateSchoolInfo({
        name: school?.name ?? "",
        city: school?.city ?? "",
        teachingType: school?.teachingType ?? "general",
        logoUrl: payload.logoUrl,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      toast({ title: "Logo mis à jour" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le logo.",
        variant: "destructive",
      })
    },
  })
  const saveQrSkipPolicyMutation = useMutation({
    mutationFn: (allowTeacherQrSkip: boolean) =>
      updateSchoolInfo({
        name: school?.name ?? "",
        city: school?.city ?? "",
        teachingType: school?.teachingType ?? "general",
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

  return (
    <>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Informations école</p>
                <p className="text-xs text-muted-foreground">Vue synthétique et identité visuelle.</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Nom de l&apos;école
                    </Label>
                    <Input value={school?.name ?? "-"} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Ville
                    </Label>
                    <Input value={school?.city ?? "-"} readOnly />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Sous-domaine
                    </Label>
                    <Input value={school?.subdomain ?? "-"} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Type d&apos;enseignement
                    </Label>
                    <Input value={teachingTypeLabel} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Année scolaire
                    </Label>
                    <Input value={school?.activeSchoolYear ?? "-"} readOnly />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                  <p>Plan actif: <span className="font-medium text-foreground">{planLabel}</span></p>
                  <p>Utilisateurs administratifs: <span className="font-medium text-foreground">{school ? `${school.adminUsersCount}` : "-"}</span></p>
                  <p>Gestion: centralisée par EduTrack CI</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {logoUrlDraft ? (
                      <img
                        src={logoUrlDraft}
                        alt="Logo école"
                        className="h-14 w-14 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                        Logo
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Logo de l&apos;établissement</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      URL du logo
                    </Label>
                    <Input
                      value={logoUrlDraft}
                      onChange={(event) => setLogoUrlDraft(event.target.value)}
                      placeholder="URL du logo ou image importée"
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) {
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () => {
                          const result = typeof reader.result === "string" ? reader.result : ""
                          setLogoUrlDraft(result)
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={saveSchoolInfoMutation.isPending || !school}
                    onClick={() =>
                      saveSchoolInfoMutation.mutate({
                        logoUrl: logoUrlDraft || null,
                      })
                    }
                  >
                    {saveSchoolInfoMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-8 rounded-lg border border-border bg-background p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-5">Politique de scan QR Codes des salles</p>

                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    aria-pressed={allowTeacherQrSkipDraft}
                    variant={allowTeacherQrSkipDraft ? "default" : "outline"}
                    className="min-w-44"
                    disabled={saveQrSkipPolicyMutation.isPending}
                    onClick={() => setPendingQrSkipState(!allowTeacherQrSkipDraft)}
                  >
                    {allowTeacherQrSkipDraft ? "Désactiver le mode facultatif" : "Activer le mode facultatif"}
                  </Button> 
                </div>
                <Alert className={cn(
                  "border",
                  allowTeacherQrSkipDraft
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-green-200 bg-green-50 text-green-900"
                )}>
                  <AlertTitle>État actuelle</AlertTitle>
                  <AlertDescription>
                    {allowTeacherQrSkipDraft
                      ? "Les enseignants peuvent terminer le flux de pointage sans scanner le QR code de salle."
                      : "Les enseignants doivent scanner le QR code de salle."}
                  </AlertDescription>
                </Alert>
                <p className="text-xs text-muted-foreground">
                  Ce paramètre est appliqué immédiatement après confirmation.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
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
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau poste
                </Button>
              ) : null}
            </div>
            <div>
              {positions.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">Aucun poste créé.</p>
              ) : (
                positions.map((position, index) => (
                  <div
                    key={position.id}
                    className="flex cursor-pointer items-center justify-between border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium",
                          index % 3 === 0 && "bg-blue-50 text-blue-700",
                          index % 3 === 1 && "bg-green-50 text-green-700",
                          index % 3 === 2 && "bg-amber-50 text-amber-700",
                        )}
                      >
                        {position.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{position.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {position.assignmentsCount ?? 0} personne{(position.assignmentsCount ?? 0) !== 1 ? "s" : ""} assignée
                          {(position.assignmentsCount ?? 0) !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {position.permissions.length} permission{position.permissions.length !== 1 ? "s" : ""}
                      </span>
                      {canManagePositions ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openAssignDialog(position)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setPositionToEdit(position)
                              setPositionModalOpen(true)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeletePosition(position)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
            <div className="p-5">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="max-admin-positions" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">max_admin_positions</Label>
                  <Input
                    id="max-admin-positions"
                    type="number"
                    min={0}
                    step={1}
                    value={maxAdminPositions}
                    readOnly={!canEditLimits}
                    onChange={(event) => setMaxAdminPositions(event.target.value)}
                  />
                </div>

                {!canEditLimits ? (
                  <p className="text-xs text-muted-foreground">Seul le super admin peut modifier cette limite.</p>
                ) : (
                  <Button onClick={() => saveLimitMutation.mutate()} disabled={saveLimitMutation.isPending} className="w-full">
                    {saveLimitMutation.isPending ? "Sauvegarde..." : "Mettre à jour"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-border bg-background p-4">
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
                    onChange={(event) => setNewUserPhone(event.target.value)}
                    placeholder="+2250700000000"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCreateAdministrativeUser}
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
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

            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Compteurs utilisateurs actifs: {school ? `${school.adminUsersCount}` : "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Accès visibles: postes assignés + total des permissions héritées.
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {assignableUsers.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Aucun utilisateur administratif pour le moment.
                  </p>
                ) : (
                  assignableUsers.map((schoolUser) => (
                    <div key={schoolUser.id} className="grid grid-cols-1 gap-2 border-b border-border px-4 py-3 text-sm last:border-0 sm:grid-cols-[2fr_2fr_2fr_1fr_auto] sm:items-center sm:gap-2">
                      <div className="space-y-1">
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
                      <p className="text-muted-foreground">{schoolUser.email ?? "-"}</p>
                      <p className="text-muted-foreground">{schoolUser.phone ?? "-"}</p>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setResetPasswordTarget(schoolUser)
                            setResetPasswordValue("")
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditAdministrativeUser(schoolUser)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={deleteUserMutation.isPending || deleteTarget?.type === "user"}
                          onClick={() => handleDeleteAdministrativeUser(schoolUser)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
            canManageSmsTemplates={school?.canEditSmsTemplate ?? false}
          />
        ) : null}
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
