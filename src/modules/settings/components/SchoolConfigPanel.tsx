import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { ChevronDown, Pencil, Plus, Trash2, UserPlus } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import PositionFormModal, { type PositionPayload } from "@/modules/settings/components/PositionFormModal"
import {
  assignUserToPosition,
  createAdministrativeUser,
  deletePosition,
  fetchSchoolConfig,
  type CreateAdministrativeUserInput,
  type PositionItem,
  updateSchoolInfo,
  updateSchoolLimit,
} from "@/modules/settings/settings.api"
import { useAuthStore } from "@/shared/store/auth.store"

const SETTINGS_QUERY_KEY = ["settings", "school-config"] as const

export default function SchoolConfigPanel() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)

  const [informationOpen, setInformationOpen] = useState(true)
  const [positionsOpen, setPositionsOpen] = useState(true)
  const [usersOpen, setUsersOpen] = useState(true)
  const [limitsOpen, setLimitsOpen] = useState(true)

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

  const schoolConfigQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSchoolConfig,
  })

  const [maxAdminPositions, setMaxAdminPositions] = useState("0")
  const [logoUrlDraft, setLogoUrlDraft] = useState("")

  useEffect(() => {
    if (!schoolConfigQuery.data) {
      return
    }

    setMaxAdminPositions(String(schoolConfigQuery.data.limits.maxAdminPositions))
    setLogoUrlDraft(schoolConfigQuery.data.school.logoUrl ?? "")
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

  const deleteMutation = useMutation({
    mutationFn: deletePosition,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      toast({ title: "Poste supprimé" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le poste.",
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

  const positions = schoolConfigQuery.data?.positions ?? []
  const assignableUsers = schoolConfigQuery.data?.users ?? []
  const canEditLimits = user?.role === "super_admin"
  const school = schoolConfigQuery.data?.school

  const handleDeletePosition = (position: PositionPayload) => {
    const confirmed = window.confirm(`Supprimer le poste ${position.name} ?`)
    if (!confirmed) {
      return
    }

    deleteMutation.mutate(position.id)
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

    if (password.length < 8) {
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

    createUserMutation.mutate({
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      password,
    })
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
      <div className="space-y-4">
        <Collapsible open={informationOpen} onOpenChange={setInformationOpen} className="rounded-lg border border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
            <div>
              <h3 className="text-lg font-semibold">Informations école</h3>
              <p className="text-sm text-muted-foreground">Nom, ville et type d&apos;enseignement.</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border p-4">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">École</p>
                  <p className="text-sm font-medium">{school?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium">{planLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utilisateurs administratifs</p>
                  <p className="text-sm font-medium">{school ? `${school.adminUsersCount}` : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sous-domaine</p>
                  <p className="text-sm font-medium">{school?.subdomain || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ville</p>
                  <p className="text-sm font-medium">{school?.city || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type d&apos;enseignement</p>
                  <p className="text-sm font-medium">{teachingTypeLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Année scolaire active</p>
                  <p className="text-sm font-medium">{school?.activeSchoolYear ?? "-"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground">Logo école</p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
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
                    <div className="flex-1 space-y-2">
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
                      disabled={saveSchoolInfoMutation.isPending || !school}
                      onClick={() => saveSchoolInfoMutation.mutate({ logoUrl: logoUrlDraft || null })}
                    >
                      {saveSchoolInfoMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Le logo peut être ajusté ici. Les autres informations sont gérées par l&apos;administrateur EduTrack CI.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={positionsOpen} onOpenChange={setPositionsOpen} className="rounded-lg border border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
            <div>
              <h3 className="text-lg font-semibold">Postes administratifs</h3>
              <p className="text-sm text-muted-foreground">Créez, assignez et modifiez les postes.</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 border-t border-border p-4">
            <div className="flex justify-end">
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
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Poste</TableHead>
                  <TableHead className="w-[130px]">Nb permissions</TableHead>
                  <TableHead className="w-[170px]">Nb utilisateurs assignés</TableHead>
                  <TableHead className="w-[220px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Aucun poste créé.
                    </TableCell>
                  </TableRow>
                ) : (
                  positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{position.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {position.permissions.slice(0, 3).map((permission) => (
                              <Badge key={permission} variant="outline" className="text-[11px]">
                                {permission}
                              </Badge>
                            ))}
                            {position.permissions.length > 3 ? (
                              <Badge variant="outline" className="text-[11px]">+{position.permissions.length - 3}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{position.permissions.length}</TableCell>
                      <TableCell>{position.assignmentsCount}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => openAssignDialog(position)}
                          >
                            <UserPlus className="h-4 w-4" />
                            Assigner
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setPositionToEdit(position)
                              setPositionModalOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Éditer
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDeletePosition(position)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={usersOpen} onOpenChange={setUsersOpen} className="rounded-lg border border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
            <div>
              <h3 className="text-lg font-semibold">Utilisateurs administratifs</h3>
              <p className="text-sm text-muted-foreground">
                Créez des comptes administratifs et transmettez leurs accès.
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 border-t border-border p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-admin-name">Nom complet</Label>
                <Input
                  id="new-admin-name"
                  value={newUserName}
                  onChange={(event) => setNewUserName(event.target.value)}
                  placeholder="Ex: Kouamé Fatou"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-admin-password">Mot de passe provisoire</Label>
                <Input
                  id="new-admin-password"
                  type="password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  placeholder="Minimum 8 caractères"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-admin-email">Email (optionnel)</Label>
                <Input
                  id="new-admin-email"
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  placeholder="admin@ecole.ci"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-admin-phone">Téléphone (optionnel)</Label>
                <Input
                  id="new-admin-phone"
                  value={newUserPhone}
                  onChange={(event) => setNewUserPhone(event.target.value)}
                  placeholder="+2250700000000"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Compteurs utilisateurs actifs: {school ? `${school.adminUsersCount}` : "-"}
              </p>
              <Button
                onClick={handleCreateAdministrativeUser}
                disabled={createUserMutation.isPending}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {createUserMutation.isPending ? "Création..." : "Ajouter l'utilisateur"}
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignableUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Aucun utilisateur administratif pour le moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  assignableUsers.map((schoolUser) => (
                    <TableRow key={schoolUser.id}>
                      <TableCell className="font-medium">{schoolUser.name}</TableCell>
                      <TableCell>{schoolUser.email ?? "-"}</TableCell>
                      <TableCell>{schoolUser.phone ?? "-"}</TableCell>
                      <TableCell>{schoolUser.role}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={limitsOpen} onOpenChange={setLimitsOpen} className="rounded-lg border border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
            <div>
              <h3 className="text-lg font-semibold">Limites</h3>
              <p className="text-sm text-muted-foreground">Maximum de postes administratifs autorisés.</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>

          <CollapsibleContent className="border-t border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full max-w-xs space-y-2">
                <Label htmlFor="max-admin-positions">max_admin_positions</Label>
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
                <Button onClick={() => saveLimitMutation.mutate()} disabled={saveLimitMutation.isPending}>
                  {saveLimitMutation.isPending ? "Sauvegarde..." : "Mettre à jour"}
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <PositionFormModal
          open={positionModalOpen}
          onOpenChange={setPositionModalOpen}
          initialPosition={positionToEdit}
        />
      </div>

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
    </>
  )
}
