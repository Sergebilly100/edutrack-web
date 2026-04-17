import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, QrCode, RefreshCw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { QRCodeGenerator } from "@/shared/components/QRCodeGenerator"
import { createRoom, deleteRoom, getRoomQr, listRooms, regenerateRoomQr, updateRoom, type RoomListItem, type RoomQrPayload } from "./rooms.api"

const QUERY_KEY = ["rooms", "management"]

type RoomFormState = {
  name: string
  building: string
  capacity: string
}

const EMPTY_FORM: RoomFormState = {
  name: "",
  building: "",
  capacity: "",
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

export default function RoomsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [form, setForm] = useState<RoomFormState>(EMPTY_FORM)
  const [selectedRoom, setSelectedRoom] = useState<RoomListItem | null>(null)
  const [selectedQr, setSelectedQr] = useState<RoomQrPayload | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)

  const roomsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listRooms,
  })

  const sortedRooms = useMemo(() => {
    return [...(roomsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr"))
  }, [roomsQuery.data])

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
    mutationFn: (input: { roomId: string; payload: { name: string; building: string | null; capacity: number | null } }) =>
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
        description: "Impossible de supprimer la salle (vérifiez les EDT futurs).",
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
    setForm(EMPTY_FORM)
    setCreateDialogOpen(true)
  }

  const openEdit = (room: RoomListItem) => {
    setSelectedRoom(room)
    setForm({
      name: room.name,
      building: room.building ?? "",
      capacity: room.capacity === null ? "" : String(room.capacity),
    })
    setEditDialogOpen(true)
  }

  const openQr = (roomId: string) => {
    qrMutation.mutate(roomId)
  }

  const regenerateQr = (roomId: string) => {
    regenerateQrMutation.mutate(roomId)
  }

  const handleDelete = (room: RoomListItem) => {
    const confirmed = window.confirm(`Supprimer la salle "${room.name}" ?`)
    if (!confirmed) {
      return
    }
    deleteMutation.mutate(room.id)
  }

  const handleCreateSubmit = () => {
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

    createMutation.mutate({
      name,
      building: form.building.trim() || null,
      capacity,
    })
  }

  const handleEditSubmit = () => {
    if (!selectedRoom) {
      return
    }

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

    updateMutation.mutate({
      roomId: selectedRoom.id,
      payload: {
        name,
        building: form.building.trim() || null,
        capacity,
      },
    })
  }

  return (
    <div className="space-y-6" data-testid="rooms-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Salles & QR</h1>
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
          <Button onClick={openCreate} type="button">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une salle
          </Button>
        </CardHeader>
        <CardContent>
          {roomsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement des salles...</p>
          ) : sortedRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune salle active trouvée.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salle</TableHead>
                    <TableHead>Bâtiment</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>EDT / semaine</TableHead>
                    <TableHead>Scans</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell>{room.building || "-"}</TableCell>
                      <TableCell>{formatCapacity(room.capacity)}</TableCell>
                      <TableCell>{room.stats.weeklySchedulesCount}</TableCell>
                      <TableCell>{room.stats.scansCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openQr(room.id)}>
                            <QrCode className="mr-2 h-4 w-4" />
                            QR
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => regenerateQr(room.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Régénérer
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(room)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(room)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
