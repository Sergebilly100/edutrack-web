import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { QRCodeGenerator } from "@/shared/components/QRCodeGenerator"
import type { RoomQrPayload } from "../rooms.api"

type RoomQrDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrPayload: RoomQrPayload | null
}

export function RoomQrDialog({ open, onOpenChange, qrPayload }: RoomQrDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR code de salle</DialogTitle>
          <DialogDescription>Imprimez ou téléchargez ce QR pour affichage en classe.</DialogDescription>
        </DialogHeader>
        {qrPayload ? <QRCodeGenerator roomName={qrPayload.roomName} roomToken={qrPayload.qrToken} /> : null}
      </DialogContent>
    </Dialog>
  )
}
