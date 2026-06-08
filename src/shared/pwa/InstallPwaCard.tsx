import { useState } from "react"
import { Bell, BellRing, Download, Share, SquarePlus, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { usePushNotifications, type PushAudience } from "@/shared/push/usePushNotifications"
import { useInstallPrompt } from "./useInstallPrompt"

type InstallPwaCardProps = {
  /** 'user' = prof/staff, 'parent' = portail parent. */
  audience: PushAudience
  /** Texte d'accroche adapté au public. */
  headline?: string
}

/**
 * Carte d'onboarding qui guide l'utilisateur (prof ou parent) pour :
 *  1. installer l'app sur son téléphone (PWA),
 *  2. activer les notifications.
 * S'efface d'elle-même si l'app est déjà installée ET les notifs déjà activées.
 */
export function InstallPwaCard({ audience, headline }: InstallPwaCardProps) {
  const { toast } = useToast()
  const { isInstalled, canPromptInstall, platform, promptInstall } = useInstallPrompt()
  const push = usePushNotifications(audience)
  const [howToOpen, setHowToOpen] = useState(false)

  const notificationsActive = push.isSubscribed && push.permission === "granted"

  // Rien à proposer : déjà installée + notifs actives (ou push non supporté).
  if (isInstalled && (notificationsActive || !push.isSupported)) {
    return null
  }

  const handleInstall = async () => {
    if (canPromptInstall) {
      const accepted = await promptInstall()
      if (accepted) {
        toast({ title: "Application installée", description: "Retrouvez IvoirEdu sur votre écran d'accueil." })
      }
    } else {
      // iOS / navigateurs sans prompt natif → instructions manuelles.
      setHowToOpen(true)
    }
  }

  const handleEnableNotifications = async () => {
    const ok = await push.subscribe()
    if (ok) {
      toast({ title: "Notifications activées", description: "Vous serez prévenu directement sur cet appareil." })
    } else if (push.permission === "denied") {
      toast({
        variant: "destructive",
        title: "Notifications bloquées",
        description: "Autorisez les notifications dans les réglages de votre navigateur pour les recevoir.",
      })
    }
  }

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-blue-100 p-2 text-blue-700">
              <Smartphone className="h-5 w-5" />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-blue-900">
                {headline ?? "Installez IvoirEdu sur votre téléphone"}
              </p>
              <p className="text-xs text-blue-800">
                Accès rapide depuis l'écran d'accueil et notifications directes, même app fermée.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!isInstalled ? (
              <Button size="sm" onClick={handleInstall} className="min-h-9">
                <Download className="mr-1.5 h-4 w-4" />
                Installer l'app
              </Button>
            ) : null}
            {push.isSupported && !notificationsActive ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnableNotifications}
                disabled={push.isBusy}
                className="min-h-9"
              >
                {notificationsActive ? (
                  <BellRing className="mr-1.5 h-4 w-4" />
                ) : (
                  <Bell className="mr-1.5 h-4 w-4" />
                )}
                {push.isBusy ? "Activation…" : "Activer les notifications"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={howToOpen} onOpenChange={setHowToOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Installer IvoirEdu</DialogTitle>
            <DialogDescription>
              En quelques secondes, ajoutez l'app à votre écran d'accueil.
            </DialogDescription>
          </DialogHeader>
          {platform === "ios" ? (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Share className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>Touchez le bouton <strong>Partager</strong> en bas de Safari.</span>
              </li>
              <li className="flex items-start gap-2">
                <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>Choisissez <strong>« Sur l'écran d'accueil »</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>Validez avec <strong>Ajouter</strong>. L'icône IvoirEdu apparaît sur votre écran.</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>Ouvrez le menu <strong>⋮</strong> de votre navigateur.</span>
              </li>
              <li className="flex items-start gap-2">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  Touchez <strong>« Installer l'application »</strong> ou{" "}
                  <strong>« Ajouter à l'écran d'accueil »</strong>.
                </span>
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
