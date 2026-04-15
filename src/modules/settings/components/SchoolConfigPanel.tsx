import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { apiClient } from "@/shared/api/client"
import { useAuthStore } from "@/shared/store/auth.store"

type TeachingType = "general" | "technical" | "mixed"

type SchoolConfigResponse = {
  school: {
    name: string
    city: string
    teachingType: TeachingType
  }
  positions: PositionPayload[]
  limits: {
    max_admin_positions: number
  }
}

type SchoolInfoPayload = {
  name: string
  city: string
  teachingType: TeachingType
}

const fetchSchoolConfig = () =>
  apiClient.get<SchoolConfigResponse>("/permissions/config").then((response) => response.data)

const patchSchoolInfo = (payload: SchoolInfoPayload) =>
  apiClient.patch("/permissions/config/school", payload).then((response) => response.data)

const patchMaxAdminPositions = (max_admin_positions: number) =>
  apiClient
    .patch("/permissions/config/limits", { max_admin_positions })
    .then((response) => response.data)

const deletePosition = (positionId: string) =>
  apiClient.delete(`/permissions/positions/${positionId}`).then((response) => response.data)

export default function SchoolConfigPanel() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)

  const [informationOpen, setInformationOpen] = useState(true)
  const [positionsOpen, setPositionsOpen] = useState(true)
  const [limitsOpen, setLimitsOpen] = useState(true)

  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [positionToEdit, setPositionToEdit] = useState<PositionPayload | null>(null)

  const schoolConfigQuery = useQuery({
    queryKey: ["settings", "positions"],
    queryFn: fetchSchoolConfig,
  })

  const [schoolName, setSchoolName] = useState("")
  const [city, setCity] = useState("")
  const [teachingType, setTeachingType] = useState<TeachingType>("general")
  const [maxAdminPositions, setMaxAdminPositions] = useState("0")

  useEffect(() => {
    if (!schoolConfigQuery.data) {
      return
    }

    setSchoolName(schoolConfigQuery.data.school.name)
    setCity(schoolConfigQuery.data.school.city)
    setTeachingType(schoolConfigQuery.data.school.teachingType)
    setMaxAdminPositions(String(schoolConfigQuery.data.limits.max_admin_positions))
  }, [schoolConfigQuery.data])

  const saveSchoolInfoMutation = useMutation({
    mutationFn: () =>
      patchSchoolInfo({
        name: schoolName.trim(),
        city: city.trim(),
        teachingType,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "positions"] })
      toast({ title: "Informations école mises à jour" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les informations de l'école.",
        variant: "destructive",
      })
    },
  })

  const saveLimitMutation = useMutation({
    mutationFn: () => patchMaxAdminPositions(Number(maxAdminPositions)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "positions"] })
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
      await queryClient.invalidateQueries({ queryKey: ["settings", "positions"] })
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

  const positions = schoolConfigQuery.data?.positions ?? []
  const isDirector = user?.role === "director"

  const hasDirtySchoolInfo = useMemo(() => {
    const data = schoolConfigQuery.data
    if (!data) {
      return false
    }

    return (
      schoolName !== data.school.name || city !== data.school.city || teachingType !== data.school.teachingType
    )
  }, [city, schoolConfigQuery.data, schoolName, teachingType])

  const handleDeletePosition = (position: PositionPayload) => {
    const confirmed = window.confirm(`Supprimer le poste ${position.name} ?`)
    if (!confirmed) {
      return
    }

    deleteMutation.mutate(position.id)
  }

  return (
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
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="school-name">Nom</Label>
              <Input id="school-name" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-city">Ville</Label>
              <Input id="school-city" value={city} onChange={(event) => setCity(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Type d&apos;enseignement</Label>
              <Select value={teachingType} onValueChange={(value) => setTeachingType(value as TeachingType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Général</SelectItem>
                  <SelectItem value="technical">Technique</SelectItem>
                  <SelectItem value="mixed">Mixte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveSchoolInfoMutation.mutate()}
              disabled={!hasDirtySchoolInfo || saveSchoolInfoMutation.isPending}
            >
              {saveSchoolInfoMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={positionsOpen} onOpenChange={setPositionsOpen} className="rounded-lg border border-border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
          <div>
            <h3 className="text-lg font-semibold">Postes administratifs</h3>
            <p className="text-sm text-muted-foreground">Créez, modifiez et supprimez les postes.</p>
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
                <TableHead>Permissions</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun poste créé.
                  </TableCell>
                </TableRow>
              ) : (
                positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {position.permissions.map((permission) => (
                          <Badge key={permission} variant="outline">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
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
  )
}
