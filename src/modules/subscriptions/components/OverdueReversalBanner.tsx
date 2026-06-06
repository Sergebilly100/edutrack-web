import { useState } from "react"
import { AlertTriangle, Copy, Mail } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatFcfa } from "@/shared/utils/formatting"
import type { OverdueMonth } from "../subscriptions.api"

type OverdueReversalBannerProps = {
  overdueMonths: OverdueMonth[]
}

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL ?? "support@ivoiredu.ci"

export function OverdueReversalBanner({ overdueMonths }: OverdueReversalBannerProps) {
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const { toast } = useToast()

  if (overdueMonths.length === 0) {
    return null
  }

  const totalOverdue = overdueMonths.reduce((sum, m) => sum + m.amount, 0)

  const buildSummaryText = () => {
    let text = "IVOIREDU - Reversements en retard\n\n"
    overdueMonths.forEach((month) => {
      text += `• ${month.month} : ${formatFcfa(month.amount)} (dû le ${new Date(month.dueDate).toLocaleDateString(
        "fr-FR"
      )})\n`
    })
    text += `\nTotal : ${formatFcfa(totalOverdue)}\n`
    text += `\nMerci de procéder au reversement dans les meilleurs délais.`
    return text
  }

  const handleCopySummary = () => {
    const text = buildSummaryText()
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copié",
        description: "Le récapitulatif a été copié dans le presse-papier",
      })
    })
  }

  return (
    <>
      <Alert className="bg-red-50 border-red-200 text-red-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 animate-pulse mt-0.5" />
          <div className="flex-1 space-y-2">
            <AlertTitle className="text-base font-semibold">
              Reversement en retard - Action requise
            </AlertTitle>
            <AlertDescription className="space-y-1">
              {overdueMonths.map((month) => (
                <div key={month.month} className="text-sm">
                  • <strong>{month.month}</strong> : {formatFcfa(month.amount)} non reversé (dû le{" "}
                  {new Date(month.dueDate).toLocaleDateString("fr-FR")})
                </div>
              ))}
            </AlertDescription>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactModalOpen(true)}
                className="border-red-300 bg-white hover:bg-red-50"
              >
                Contacter IvoirEdu
              </Button>
            </div>
          </div>
        </div>
      </Alert>

      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contacter IvoirEdu</DialogTitle>
            <DialogDescription>
              Pour procéder au reversement ou obtenir plus d'informations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Email de support</p>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Récapitulatif des montants dus</p>
              <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm space-y-1">
                {overdueMonths.map((month) => (
                  <div key={month.month} className="flex justify-between">
                    <span className="text-gray-600">{month.month}</span>
                    <span className="font-medium">{formatFcfa(month.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatFcfa(totalOverdue)}</span>
                </div>
              </div>
            </div>

            <Button onClick={handleCopySummary} variant="outline" className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              Copier le récapitulatif
            </Button>

            <p className="text-xs text-gray-500">
              Vous pouvez copier le récapitulatif pour l'envoyer par WhatsApp ou email
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
