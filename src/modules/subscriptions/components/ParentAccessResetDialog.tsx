import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Copy, Hand, Mail, MessageSquare } from "lucide-react"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import {
  getParentAccessStatuses,
  resetParentSubscriptionPassword,
  type ParentAccessResetResult,
} from "@/modules/subscriptions/subscriptions.api"
import type {
  StudentParentAccessResetResult,
} from "@/modules/students/students.api"

type Channel = "sms" | "email"

const usablePhone = (phone: string) => /^225\d{10}$/.test(phone)
const usableEmail = (email: string | null) => z.email().safeParse(email).success

export type ParentAccessDialogTarget = {
  parent_id: string
  full_name: string
  phone: string
  email: string | null
}

export function ParentAccessResetDialog({
  parent,
  onClose,
  resetAccess = resetParentSubscriptionPassword,
  getStatuses = (parentId, rotationId) => getParentAccessStatuses(parentId, rotationId),
  onSuccess,
  initialAccess = false,
  statusScopeKey = "subscription",
}: {
  parent: ParentAccessDialogTarget
  onClose: () => void
  resetAccess?: (
    parentId: string,
    channels: Channel[],
    manualOnly?: boolean,
    signal?: AbortSignal
  ) => Promise<ParentAccessResetResult | StudentParentAccessResetResult>
  getStatuses?: (parentId: string, rotationId: string) => Promise<Array<{
    channel: Channel
    status: "queued" | "sent" | "delivered" | "failed"
  }>>
  onSuccess?: () => Promise<unknown> | void
  initialAccess?: boolean
  statusScopeKey?: string
}) {
  const phoneAvailable = usablePhone(parent.phone)
  const emailAvailable = usableEmail(parent.email)
  const [sms, setSms] = useState(phoneAvailable)
  const [email, setEmail] = useState(false)
  const [physicalDelivery, setPhysicalDelivery] = useState(!phoneAvailable && !emailAvailable)
  const [result, setResult] = useState<ParentAccessResetResult | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const submitting = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => () => controller.current?.abort(), [])

  const selected: Channel[] = [sms && phoneAvailable ? "sms" : null, email && emailAvailable ? "email" : null]
    .filter((channel): channel is Channel => channel !== null)
  const manualOnly = physicalDelivery

  const statusQuery = useQuery({
    queryKey: ["parent-access", "status", statusScopeKey, parent.parent_id, result?.rotation_id],
    queryFn: () => getStatuses(parent.parent_id, result!.rotation_id),
    enabled: Boolean(result?.rotation_id && result.channels.length),
    refetchInterval: (query) => query.state.data?.some((item) => item.status === "queued") ? 3000 : false,
  })
  const states = statusQuery.data ?? result?.channels ?? []

  const submit = async () => {
    if (submitting.current || (!selected.length && !manualOnly)) return
    submitting.current = true
    setPending(true)
    const abort = new AbortController()
    controller.current = abort
    try {
      const access = await resetAccess(parent.parent_id, selected, manualOnly, abort.signal)
      if (abort.signal.aborted) return
      setResult(access)
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "parents"], refetchType: "active" })
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "details", parent.parent_id], refetchType: "active" })
      await onSuccess?.()
      toast({ title: "Accès parent réinitialisé", description: selected.length ? "Les envois demandés sont en cours." : "Copiez l’accès dans ce dialogue." })
    } catch (error) {
      if (!abort.signal.aborted) {
        toast({ title: "Réinitialisation impossible", description: error instanceof Error ? error.message : "Réessayez.", variant: "destructive" })
      }
    } finally {
      submitting.current = false
      if (!abort.signal.aborted) setPending(false)
    }
  }

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(`Connexion : ${result.login}\nMot de passe temporaire : ${result.new_temp_password}`)
      setCopied(true)
      toast({ title: "Accès copié", description: "Transmettez-le au parent par un moyen sûr." })
    } catch {
      toast({ title: "Copie impossible", description: "Sélectionnez et copiez les identifiants affichés.", variant: "destructive" })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) { controller.current?.abort(); setResult(null); onClose() } }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {result ? "Accès parent créé" : initialAccess ? "Envoyer l’accès parent" : "Réinitialiser l’accès parent"}
          </DialogTitle>
          <DialogDescription>
            {parent.full_name}. {initialAccess ? "Un mot de passe temporaire sera généré." : "L’ancien mot de passe cessera de fonctionner."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4" aria-live="polite">
            <Alert><AlertDescription>Ce mot de passe est affiché une seule fois. Fermer ce dialogue l’efface de l’écran.</AlertDescription></Alert>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="break-all">Identifiant : <strong>{result.login}</strong></p>
              <p className="break-all">Mot de passe temporaire : <strong>{result.new_temp_password}</strong></p>
            </div>
            <div className="space-y-2" aria-label="État des envois">
              {statusQuery.isError ? <p className="text-sm text-amber-700">État des envois momentanément indisponible. Vous pouvez copier l’accès.</p> : null}
              {states.map((item) => (
                <p key={item.channel} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.channel === "sms" ? "SMS" : "E-mail"} : {item.status === "sent" || item.status === "delivered" ? "envoyé" : item.status === "failed" ? "échec, copiez l’accès ou générez-en un nouveau" : "mis en file"}
                </p>
              ))}
              {!phoneAvailable ? <p className="text-sm text-muted-foreground">SMS : indisponible, numéro absent ou invalide</p> : null}
              {!emailAvailable ? <p className="text-sm text-muted-foreground">E-mail : indisponible, adresse absente ou invalide</p> : null}
              {!states.length ? <p className="text-sm text-amber-700">Aucune notification demandée. Copiez l’accès et remettez-le au parent en main propre.</p> : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-12" onClick={copy}><Copy className="mr-2 h-4 w-4" />{copied ? "Copié" : "Copier l’accès"}</Button>
              {states.some((item) => item.status === "failed") ? (
                <Button type="button" variant="outline" className="min-h-12" onClick={() => { setResult(null); setCopied(false) }}>Générer un nouvel accès</Button>
              ) : null}
              <Button type="button" className="min-h-12" onClick={() => { setResult(null); onClose() }}>Fermer et effacer</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">Choisissez les canaux ou la remise en main propre avant de créer le mot de passe temporaire.</p>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={sms} onCheckedChange={(checked) => { setSms(checked === true); if (checked === true) setPhysicalDelivery(false) }} disabled={!phoneAvailable || pending} aria-label="Envoyer par SMS" />
              <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 text-sm">SMS <span className="block break-all text-muted-foreground">{phoneAvailable ? parent.phone : "Numéro absent ou invalide"}</span></span>
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={email} onCheckedChange={(checked) => { setEmail(checked === true); if (checked === true) setPhysicalDelivery(false) }} disabled={!emailAvailable || pending} aria-label="Envoyer par e-mail" />
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 text-sm">E-mail <span className="block break-all text-muted-foreground">{emailAvailable ? parent.email : "Adresse absente ou invalide"}</span></span>
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={physicalDelivery} onCheckedChange={(checked) => { setPhysicalDelivery(checked === true); if (checked === true) { setSms(false); setEmail(false) } }} disabled={pending} aria-label="Ne pas envoyer de notification, transmission physique" />
              <Hand className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 text-sm">Ne pas envoyer de notification <span className="block text-muted-foreground">Transmission physique au parent</span></span>
            </label>
            {manualOnly ? <Alert><AlertDescription>Aucun SMS ni e-mail ne sera envoyé. Copiez l’accès après la réinitialisation et remettez-le au parent en main propre.</AlertDescription></Alert> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-12" onClick={onClose} disabled={pending}>Annuler</Button>
              <Button type="button" className="min-h-12" onClick={submit} disabled={pending || (!selected.length && !manualOnly)}>
                {pending
                  ? "Préparation en cours…"
                  : manualOnly
                    ? initialAccess
                      ? "Préparer pour remise en main propre"
                      : "Réinitialiser pour remise en main propre"
                    : initialAccess
                      ? "Envoyer les identifiants"
                      : "Réinitialiser et envoyer"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
