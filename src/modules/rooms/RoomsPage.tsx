import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, Plus } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { OfflineGuard } from "@/shared/components/OfflineGuard"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { TourGuide } from "@/shared/components/TourGuide"
import { useTourGuide } from "@/shared/hooks/useTourGuide"
import { roomsTourSteps } from "@/shared/lib/tour-steps"
import { createRoom, deleteRoom, getRoomQr, listRooms, regenerateRoomQr, updateRoom, type RoomListItem, type RoomQrPayload } from "./rooms.api"
import { RoomFormDialog } from "./components/RoomFormDialog"
import { RoomQrDialog } from "./components/RoomQrDialog"
import { RoomDeleteDialog, RoomEditConfirmDialog, RoomQrRegenerateDialog } from "./components/RoomConfirmDialogs"
import { RoomTable } from "./components/RoomTable"

const QUERY_KEY = ["rooms", "management"]

type RoomFormState = {
  name: string
  building: string
  capacity: string
  latitude: string
  longitude: string
  geoRadius: string
}

const EMPTY_FORM: RoomFormState = {
  name: "",
  building: "",
  capacity: "",
  latitude: "",
  longitude: "",
  geoRadius: "",
}

const toNullableCapacity = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const toNullableCoordinate = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const toGeoRadius = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) return null
  return Math.min(300, Math.max(30, parsed))
}

const parseApiError = (error: unknown): string | null => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { code?: string } } }).response
    if (response?.data?.code === "ROOM_CONFLICT") {
      return "Une salle avec ce nom existe déjà."
    }
  }
  return null
}

export default function RoomsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canViewRooms = hasPermission("rooms.view")
  const canCreateRoom = hasPermission("rooms.create")
  const canEditRoom = hasPermission("rooms.edit")
  const canDeleteRoom = hasPermission("rooms.delete")
  const tour = useTourGuide("rooms", true)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [form, setForm] = useState<RoomFormState>(EMPTY_FORM)
  const [selectedRoom, setSelectedRoom] = useState<RoomListItem | null>(null)
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomListItem | null>(null)
  const [roomPendingQrRegenerate, setRoomPendingQrRegenerate] = useState<RoomListItem | null>(null)
  const [confirmEditOpen, setConfirmEditOpen] = useState(false)
  const [selectedQr, setSelectedQr] = useState<RoomQrPayload | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const roomsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listRooms,
    enabled: canViewRooms,
  })

  const sortedRooms = useMemo(() => {
    return [...(roomsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr"))
  }, [roomsQuery.data])

  const totalPages = Math.max(1, Math.ceil(sortedRooms.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pagedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRooms.slice(start, start + pageSize)
  }, [currentPage, sortedRooms])

  // Fix pagination: retour auto à la page précédente si page actuelle > totalPages
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: async (newRoom) => {
      // Ajouter la nouvelle salle au cache IMMÉDIATEMENT. Une salle qui vient
      // d'être créée n'a ni créneau ni scan : stats à 0 est exact. Pas de
      // refetch immédiat (cf. updateMutation : il écraserait ce cache frais).
      queryClient.setQueryData<RoomListItem[]>(QUERY_KEY, (oldRooms) => {
        if (!oldRooms) return [newRoom]
        return [...oldRooms, newRoom]
      })

      setCreateDialogOpen(false)
      setForm(EMPTY_FORM)
      toast({ title: "Salle ajoutée" })
    },
    onError: (error) => {
      const specificMessage = parseApiError(error)
      toast({
        title: "Erreur",
        description: specificMessage ?? "Impossible d'ajouter la salle.",
        variant: "destructive",
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      roomId: string
      payload: {
        name: string
        building: string | null
        capacity: number | null
        latitude?: number | null
        longitude?: number | null
        geoRadius?: number | null
      }
    }) => updateRoom(input.roomId, input.payload),
    onSuccess: async (updatedRoom) => {
      // Mettre à jour le cache IMMÉDIATEMENT avec la salle modifiée.
      // On conserve les stats existantes (modifier nom/GPS/capacité ne les change
      // pas) car la réponse PATCH ne renvoie pas les stats. On NE refetch PAS
      // ensuite : un refetch immédiat écrase ce cache frais par une réponse qui
      // peut être servie depuis un cache HTTP/réplique en lag, d'où l'ancien bug
      // "rien ne change puis les données apparaissent quelques minutes après".
      queryClient.setQueryData<RoomListItem[]>(QUERY_KEY, (oldRooms) => {
        if (!oldRooms) return oldRooms
        return oldRooms.map((room) =>
          room.id === updatedRoom.id
            ? { ...updatedRoom, stats: room.stats }
            : room
        )
      })

      setEditDialogOpen(false)
      setSelectedRoom(null)
      setForm(EMPTY_FORM)
      toast({ title: "Salle mise à jour" })
    },
    onError: (error) => {
      const specificMessage = parseApiError(error)
      toast({
        title: "Erreur",
        description: specificMessage ?? "Impossible de modifier la salle.",
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast({ title: "Salle supprimée" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la salle: elle est encore utilisée dans des créneaux.",
        variant: "destructive",
      })
    },
  })

  const qrMutation = useMutation({
    mutationFn: getRoomQr,
    onSuccess: (payload) => {
      setSelectedQr(payload)
      setQrDialogOpen(true)
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de charger le QR code.",
        variant: "destructive",
      })
    },
  })

  const regenerateQrMutation = useMutation({
    mutationFn: regenerateRoomQr,
    onSuccess: (payload) => {
      setSelectedQr(payload)
      setQrDialogOpen(true)
      toast({ title: "QR régénéré" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de régénérer le QR.",
        variant: "destructive",
      })
    },
  })

  const openCreate = () => {
    if (!canCreateRoom) return
    setForm(EMPTY_FORM)
    setCreateDialogOpen(true)
  }

  const openEdit = (room: RoomListItem) => {
    if (!canEditRoom) return
    setSelectedRoom(room)
    setForm({
      name: room.name,
      building: room.building ?? "",
      capacity: room.capacity === null ? "" : String(room.capacity),
      latitude: room.latitude === null ? "" : String(room.latitude),
      longitude: room.longitude === null ? "" : String(room.longitude),
      geoRadius: room.geoRadius === null ? "" : String(room.geoRadius),
    })
    setEditDialogOpen(true)
  }

  const handleCreateSubmit = () => {
    if (!canCreateRoom) return
    const name = form.name.trim()
    const capacity = toNullableCapacity(form.capacity)
    const latitude = toNullableCoordinate(form.latitude)
    const longitude = toNullableCoordinate(form.longitude)

    if (!name) {
      toast({
        title: "Champ requis",
        description: "Le nom de salle est obligatoire.",
        variant: "destructive",
      })
      return
    }

    if (form.capacity.trim().length > 0 && capacity === null) {
      toast({
        title: "Capacité invalide",
        description: "La capacité doit être un nombre entier positif.",
        variant: "destructive",
      })
      return
    }

    createMutation.mutate({
      name,
      building: form.building.trim() || null,
      capacity,
      latitude,
      longitude,
      geoRadius: toGeoRadius(form.geoRadius),
    })
  }

  const handleEditSubmit = () => {
    if (!canEditRoom || !selectedRoom) return
    const name = form.name.trim()
    const capacity = toNullableCapacity(form.capacity)

    if (!name) {
      toast({
        title: "Champ requis",
        description: "Le nom de salle est obligatoire.",
        variant: "destructive",
      })
      return
    }

    if (form.capacity.trim().length > 0 && capacity === null) {
      toast({
        title: "Capacité invalide",
        description: "La capacité doit être un nombre entier positif.",
        variant: "destructive",
      })
      return
    }

    setConfirmEditOpen(true)
  }

  const handleEditConfirm = () => {
    if (!selectedRoom) return
    const name = form.name.trim()
    const capacity = toNullableCapacity(form.capacity)
    const latitude = toNullableCoordinate(form.latitude)
    const longitude = toNullableCoordinate(form.longitude)

    updateMutation.mutate({
      roomId: selectedRoom.id,
      payload: {
        name,
        building: form.building.trim() || null,
        capacity,
        latitude,
        longitude,
        geoRadius: toGeoRadius(form.geoRadius),
      },
    })
  }

  return (
    <>
      <TourGuide
        steps={roomsTourSteps}
        run={tour.run}
        stepIndex={tour.stepIndex}
        onStepChange={tour.setStepIndex}
        onFinish={tour.markDone}
      />
    <div className="space-y-6" data-testid="rooms-page">
      <OfflineIndicator />
      <header className="space-y-2 md:py-2" data-tour="rooms-header">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Salles & QR Codes</h1>
            <p className="text-sm text-muted-foreground">
              Gérez les salles de classe et imprimez les QR codes pour le check-in professeur.
            </p>
          </div>
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
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Salles de l&apos;établissement</CardTitle>
            <CardDescription>Création, édition, suppression et gestion des QR codes.</CardDescription>
          </div>
          {canCreateRoom ? (
            <OfflineGuard>
              <Button onClick={openCreate} type="button" data-tour="rooms-add-btn">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une salle
              </Button>
            </OfflineGuard>
          ) : null}
        </CardHeader>
        <CardContent>
          {!canViewRooms ? (
            <Alert variant="destructive">
              <AlertDescription>Permission rooms.view requise pour afficher les salles.</AlertDescription>
            </Alert>
          ) : null}
          {roomsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement des salles...</p>
          ) : canViewRooms && sortedRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune salle active trouvée.</p>
          ) : canViewRooms ? (
            <div data-tour="rooms-table">
            <RoomTable
              rooms={pagedRooms}
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              onViewQr={(roomId) => qrMutation.mutate(roomId)}
              onRegenerateQr={(roomId) => {
                const room = sortedRooms.find((item) => item.id === roomId) ?? null
                setRoomPendingQrRegenerate(room)
              }}
              onEdit={openEdit}
              onDelete={setRoomPendingDelete}
              canEditRoom={canEditRoom}
              canDeleteRoom={canDeleteRoom}
            />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <RoomFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        form={form}
        setForm={setForm}
        onSubmit={handleCreateSubmit}
        isPending={createMutation.isPending}
        mode="create"
      />

      <RoomFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        form={form}
        setForm={setForm}
        onSubmit={handleEditSubmit}
        isPending={updateMutation.isPending}
        mode="edit"
      />

      <RoomEditConfirmDialog
        open={confirmEditOpen}
        onOpenChange={setConfirmEditOpen}
        onConfirm={handleEditConfirm}
      />

      <RoomQrDialog open={qrDialogOpen} onOpenChange={setQrDialogOpen} qrPayload={selectedQr} />

      <RoomDeleteDialog
        room={roomPendingDelete}
        onOpenChange={(open) => {
          if (!open) setRoomPendingDelete(null)
        }}
        onConfirm={() => {
          if (!roomPendingDelete) return
          deleteMutation.mutate(roomPendingDelete.id)
          setRoomPendingDelete(null)
        }}
      />

      <RoomQrRegenerateDialog
        room={roomPendingQrRegenerate}
        onOpenChange={(open) => {
          if (!open) setRoomPendingQrRegenerate(null)
        }}
        onConfirm={() => {
          if (!roomPendingQrRegenerate) return
          regenerateQrMutation.mutate(roomPendingQrRegenerate.id)
          setRoomPendingQrRegenerate(null)
        }}
      />
    </div>
    </>
  )
}
