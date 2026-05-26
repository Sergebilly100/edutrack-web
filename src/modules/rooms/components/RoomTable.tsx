import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pencil, QrCode, RefreshCw, Trash2 } from "lucide-react"
import { OfflineGuard } from "@/shared/components/OfflineGuard"
import type { RoomListItem } from "../rooms.api"
import { Badge } from "@/components/ui/badge"

type RoomTableProps = {
  rooms: RoomListItem[]
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onViewQr: (roomId: string) => void
  onRegenerateQr: (roomId: string) => void
  onEdit: (room: RoomListItem) => void
  onDelete: (room: RoomListItem) => void
  canEditRoom: boolean
  canDeleteRoom: boolean
}

const formatCapacity = (value: number | null): string => (value === null ? "Non défini" : `${value} places`)

const formatGps = (room: RoomListItem): JSX.Element => {
  if (room.latitude !== null && room.longitude !== null) {
    const radius = room.geoRadius !== null ? `${room.geoRadius}m` : "rayon désactivé"

    return (
              <Badge variant="success" className="bg-green-100 text-green-800">
                GPS configuré ({radius})
              </Badge>
            )
  }
  return <Badge variant="outline" className="bg-muted text-muted-foreground">GPS non configuré</Badge>
}

export function RoomTable({
  rooms,
  page,
  totalPages,
  onPageChange,
  onViewQr,
  onRegenerateQr,
  onEdit,
  onDelete,
  canEditRoom,
  canDeleteRoom,
}: RoomTableProps) {
  return (
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
          {rooms.map((room) => (
            <TableRow key={room.id}>
              <TableCell className="font-medium">{room.name}</TableCell>
              <TableCell>{room.building || "-"}</TableCell>
              <TableCell>{formatCapacity(room.capacity)}</TableCell>
              <TableCell>{formatGps(room)}</TableCell>
              <TableCell>{room.stats.weeklySchedulesCount}</TableCell>
              <TableCell>{room.stats.scansCount}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <OfflineGuard>
                    <Button size="sm" variant="outline" onClick={() => onViewQr(room.id)}>
                      <QrCode className="mr-2 h-4 w-4" />
                      QR
                    </Button>
                  </OfflineGuard>
                  {canEditRoom ? (
                    <>
                      <OfflineGuard>
                        <Button size="sm" variant="outline" onClick={() => onRegenerateQr(room.id)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Régénérer
                        </Button>
                      </OfflineGuard>
                      <OfflineGuard>
                        <Button size="sm" variant="outline" onClick={() => onEdit(room)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </Button>
                      </OfflineGuard>
                    </>
                  ) : null}
                  {canDeleteRoom ? (
                    <OfflineGuard>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(room)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </Button>
                    </OfflineGuard>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Page {page}/{totalPages} • {rooms.length} salle(s) affichée(s)
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            Précédent
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  )
}
