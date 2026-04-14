import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import QRAlertsList from "@/modules/dashboard/components/QRAlertsList"

describe("QRAlertsList", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it("renders qr alerts row and opens detail modal", async () => {
    const onMarkRead = vi.fn()

    render(
      <QRAlertsList
        alerts={[
          {
            id: "qr-1",
            type: "teacher_qr_mismatch",
            status: "sent",
            message:
              "EduTrack: M. Diallo a scanné salle B2 au lieu de A1 - Mathématiques 08:00-09:00",
            dateTime: new Date().toISOString(),
            teacherName: "M. Diallo",
            subject: "Mathématiques",
            className: null,
            expectedRoom: "A1",
            scannedRoom: "B2",
            slotLabel: "08:00-09:00",
            isToday: true,
          },
        ]}
        readIds={{}}
        onMarkRead={onMarkRead}
      />
    )

    expect(screen.getByText("M. Diallo")).toBeInTheDocument()

    fireEvent.click(screen.getByText("M. Diallo"))

    expect(await screen.findByText("Détail alerte QR")).toBeInTheDocument()
    expect(screen.getByText("Marquer comme traité")).toBeInTheDocument()
    expect(onMarkRead).toHaveBeenCalledWith("qr-1")
  })
})
