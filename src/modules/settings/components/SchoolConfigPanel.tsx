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
  deletePosition,
  fetchSchoolConfig,
  type PositionItem,
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
  const [limitsOpen, setLimitsOpen] = useState(true)

  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [positionToEdit, setPositionToEdit] = useState<PositionPayload | null>(null)

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [positionToAssign, setPositionToAssign] = useState<PositionItem | null>(null)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)

  const schoolConfigQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSchoolConfig,
  })

  const [maxAdminPositions, setMaxAdminPositions] = useState("0")

  useEffect(() => {
    if (!schoolConfigQuery.data) {
      return
    }

    setMaxAdminPositions(String(schoolConfigQuery.data.limits.maxAdminPositions))
  }, [schoolConfigQuery.data])

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
  const isDirector = user?.role === "director"
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
                  <p className="text-xs text-muted-foreground">Utilisateurs</p>
                  <p className="text-sm font-medium">{school ? `${school.currentUsers} / ${school.maxUsers}` : "-"}</p>
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
              </div>

              <p className="text-sm text-muted-foreground">
                Pour modifier ces informations, contactez l&apos;administrateur EduTrack CI.
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
                  readOnly={isDirector}
                  onChange={(event) => setMaxAdminPositions(event.target.value)}
                />
              </div>

              {isDirector ? (
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
