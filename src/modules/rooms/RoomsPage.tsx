import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, QrCode, RefreshCw, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { QRCodeGenerator } from "@/shared/components/QRCodeGenerator"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { createRoom, deleteRoom, getRoomQr, listRooms, regenerateRoomQr, updateRoom, type RoomListItem, type RoomQrPayload } from "./rooms.api"

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
  geoRadius: "100",
}

const toNullableCapacity = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

const formatCapacity = (value: number | null): string => (value === null ? "Non défini" : `${value} places`)
const formatGps = (room: RoomListItem): string =>
  room.latitude !== null && room.longitude !== null ? `GPS configuré (${room.geoRadius}m)` : "GPS non configuré"

const toNullableCoordinate = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const toGeoRadius = (value: string): number => {
  const parsed = Number(value.trim())
  if (!Number.isInteger(parsed)) return 100
  return Math.min(300, Math.max(30, parsed))
}

export default function RoomsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canViewRooms = hasPermission("rooms.view")
  const canCreateRoom = hasPermission("rooms.create")
  const canEditRoom = hasPermission("rooms.edit")
  const canDeleteRoom = hasPermission("rooms.delete")

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

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setCreateDialogOpen(false)
      setForm(EMPTY_FORM)
      toast({ title: "Salle ajoutée" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la salle.",
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
    }) =>
      updateRoom(input.roomId, input.payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setEditDialogOpen(false)
      setSelectedRoom(null)
      setForm(EMPTY_FORM)
      toast({ title: "Salle mise à jour" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la salle.",
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
    if (!canCreateRoom) {
      return
    }
    setForm(EMPTY_FORM)
    setCreateDialogOpen(true)
  }

  const openEdit = (room: RoomListItem) => {
    if (!canEditRoom) {
      return
    }
    setSelectedRoom(room)
    setForm({
      name: room.name,
      building: room.building ?? "",
      capacity: room.capacity === null ? "" : String(room.capacity),
      latitude: room.latitude === null ? "" : String(room.latitude),
      longitude: room.longitude === null ? "" : String(room.longitude),
      geoRadius: String(room.geoRadius),
    })
    setEditDialogOpen(true)
  }

  const openQr = (roomId: string) => {
    if (!canViewRooms) {
      return
    }
    qrMutation.mutate(roomId)
  }

  const regenerateQr = (roomId: string) => {
    if (!canEditRoom) {
      return
    }
    const room = sortedRooms.find((item) => item.id === roomId) ?? null
    setRoomPendingQrRegenerate(room)
  }

  const handleDelete = (room: RoomListItem) => {
    if (!canDeleteRoom) {
      return
    }
    setRoomPendingDelete(room)
  }

  const handleCreateSubmit = () => {
    if (!canCreateRoom) {
      return
    }
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
    if (!canEditRoom) {
      return
    }
    if (!selectedRoom) {
      return
    }

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

    setConfirmEditOpen(true)
  }

  const capturePosition = () => {
    if (!("geolocation" in navigator)) {
      toast({
        title: "GPS indisponible",
        description: "Ce navigateur ne permet pas de capturer la position.",
        variant: "destructive",
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }))
        toast({ title: "Position capturée" })
      },
      () => {
        toast({
          title: "Position non capturée",
          description: "Autorisez la géolocalisation puis réessayez.",
          variant: "destructive",
        })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }

  return (
    <div className="space-y-6" data-testid="rooms-page">
      <OfflineIndicator />
      <header className="space-y-2 md:py-2">
        <h1 className="text-2xl font-semibold tracking-tight">Salles & QR Codes</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les salles de classe et imprimez les QR codes pour le check-in professeur.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Salles de l&apos;établissement</CardTitle>
            <CardDescription>Création, édition, suppression et gestion des QR codes.</CardDescription>
          </div>
          {canCreateRoom ? (
            <Button onClick={openCreate} type="button">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une salle
            </Button>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salle</TableHead>
                    <TableHead>Bâtiment</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>EDT / semaine</TableHead>
                    <TableHead>Scans</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell>{room.building || "-"}</TableCell>
                      <TableCell>{formatCapacity(room.capacity)}</TableCell>
                      <TableCell>{formatGps(room)}</TableCell>
                      <TableCell>{room.stats.weeklySchedulesCount}</TableCell>
                      <TableCell>{room.stats.scansCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openQr(room.id)}>
                            <QrCode className="mr-2 h-4 w-4" />
                            QR
                          </Button>
                          {canEditRoom ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => regenerateQr(room.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Régénérer
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openEdit(room)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                              </Button>
                            </>
                          ) : null}
                          {canDeleteRoom ? (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(room)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Page {currentPage}/{totalPages} • {sortedRooms.length} salle(s)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une salle</DialogTitle>
            <DialogDescription>Le QR token sera généré automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nom de la salle"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              placeholder="Bâtiment (optionnel)"
              value={form.building}
              onChange={(event) => setForm((prev) => ({ ...prev, building: event.target.value }))}
            />
            <Input
              placeholder="Capacité (optionnel)"
              inputMode="numeric"
              value={form.capacity}
              onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Latitude GPS"
                inputMode="decimal"
                value={form.latitude}
                onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
              />
              <Input
                placeholder="Longitude GPS"
                inputMode="decimal"
                value={form.longitude}
                onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
              />
              <Input
                placeholder="Rayon GPS"
                inputMode="numeric"
                value={form.geoRadius}
                onChange={(event) => setForm((prev) => ({ ...prev, geoRadius: event.target.value }))}
              />
            </div>
            <Button type="button" variant="outline" onClick={capturePosition}>
              Capturer ma position
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEditOpen} onOpenChange={setConfirmEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la modification de la salle</AlertDialogTitle>
            <AlertDialogDescription>
              Cette modification peut impacter les emplois du temps (EDT) et la cohérence des cours planifiés.
              Vérifiez les informations avant de continuer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!selectedRoom) return
                const name = form.name.trim()
                const capacity = toNullableCapacity(form.capacity)
                updateMutation.mutate({
                  roomId: selectedRoom.id,
                  payload: {
                    name,
                    building: form.building.trim() || null,
                    capacity,
                    latitude: toNullableCoordinate(form.latitude),
                    longitude: toNullableCoordinate(form.longitude),
                    geoRadius: toGeoRadius(form.geoRadius),
                  },
                })
              }}
            >
              Confirmer la modification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(roomPendingQrRegenerate)}
        onOpenChange={(open) => {
          if (!open) setRoomPendingQrRegenerate(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Régénérer le QR code de salle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action remplace immédiatement le QR code actuel de{" "}
              <span className="font-medium">{roomPendingQrRegenerate?.name ?? "la salle"}</span>. Le QR imprimé dans
              la salle devra être remplacé pour éviter les scans invalides.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!roomPendingQrRegenerate) return
                regenerateQrMutation.mutate(roomPendingQrRegenerate.id)
                setRoomPendingQrRegenerate(null)
              }}
            >
              Régénérer le QR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(roomPendingDelete)}
        onOpenChange={(open) => {
          if (!open) setRoomPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette salle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La suppression sera refusée si la salle est utilisée dans un créneau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!roomPendingDelete) return
                deleteMutation.mutate(roomPendingDelete.id)
                setRoomPendingDelete(null)
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la salle</DialogTitle>
            <DialogDescription>Mettez à jour les informations de salle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nom de la salle"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              placeholder="Bâtiment (optionnel)"
              value={form.building}
              onChange={(event) => setForm((prev) => ({ ...prev, building: event.target.value }))}
            />
            <Input
              placeholder="Capacité (optionnel)"
              inputMode="numeric"
              value={form.capacity}
              onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Latitude GPS"
                inputMode="decimal"
                value={form.latitude}
                onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
              />
              <Input
                placeholder="Longitude GPS"
                inputMode="decimal"
                value={form.longitude}
                onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
              />
              <Input
                placeholder="Rayon GPS"
                inputMode="numeric"
                value={form.geoRadius}
                onChange={(event) => setForm((prev) => ({ ...prev, geoRadius: event.target.value }))}
              />
            </div>
            <Button type="button" variant="outline" onClick={capturePosition}>
              Capturer ma position
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR code de salle</DialogTitle>
            <DialogDescription>
              Imprimez ou téléchargez ce QR pour affichage en classe.
            </DialogDescription>
          </DialogHeader>
          {selectedQr ? <QRCodeGenerator roomName={selectedQr.roomName} roomToken={selectedQr.qrToken} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
