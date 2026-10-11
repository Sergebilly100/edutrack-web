import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MessageSquareText } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/shared/components/EmptyState"
import {
  getSchoolStudentAbsenceSmsTemplate,
  resetSchoolStudentAbsenceSmsTemplate,
  updateSchoolStudentAbsenceSmsTemplate,
} from "@/modules/settings/settings.api"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"

const SMS_TEMPLATE_QUERY_KEY = ["settings", "sms-template", "student-absence"] as const

export default function SmsTemplatePanel({ canReadTemplate }: { canReadTemplate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [messageTemplate, setMessageTemplate] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const studentLabels = useStudentLabels()

  const templateQuery = useQuery({
    queryKey: SMS_TEMPLATE_QUERY_KEY,
    queryFn: getSchoolStudentAbsenceSmsTemplate,
    enabled: canReadTemplate,
    retry: false,
  })

  useEffect(() => {
    if (!templateQuery.data) {
      return
    }
    setMessageTemplate(templateQuery.data.messageTemplate)
  }, [templateQuery.data])

  const updateMutation = useMutation({
    mutationFn: () =>
      updateSchoolStudentAbsenceSmsTemplate({
        message_template: messageTemplate.trim(),
        variables: templateQuery.data?.variables ?? [],
      }),
    onSuccess: async () => {
      const wasSchoolTemplate = templateQuery.data?.source === "school"
      await queryClient.invalidateQueries({ queryKey: SMS_TEMPLATE_QUERY_KEY })
      toast({ title: wasSchoolTemplate ? "Modèle SMS mis à jour" : "Modèle SMS créé" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le template SMS.",
        variant: "destructive",
      })
    },
  })

  const resetMutation = useMutation({
    mutationFn: resetSchoolStudentAbsenceSmsTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SMS_TEMPLATE_QUERY_KEY })
      toast({ title: "Modèle SMS de l’école réinitialisé" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser le template SMS.",
        variant: "destructive",
      })
    },
  })

  const isEnabled = canReadTemplate && (templateQuery.data?.enabledBySuperAdmin ?? false)
  const source = templateQuery.data?.source
  const sourceLabel = source === "school" ? "Personnalisé (école)"
    : source === "global" ? "Modèle global IvoirEdu" : "Message système"

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
            <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{`Template SMS absence ${studentLabels.singularLower}`}</p>
            <p className="text-xs text-muted-foreground">
              Visible/modifiable selon autorisation du super admin.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {!canReadTemplate ? (
          <Alert><AlertDescription>
            La personnalisation des modèles SMS n’est pas activée pour cette école. Demandez son activation à IvoirEdu avant d’ajouter un message.
          </AlertDescription></Alert>
        ) : templateQuery.isPending ? (
          <div role="status" aria-label="Chargement du modèle SMS" className="space-y-3">
            <Skeleton className="h-6 w-2/3" /><Skeleton className="h-32 w-full" />
          </div>
        ) : templateQuery.isError ? (
          <Alert variant="destructive"><AlertDescription className="space-y-3">
            <p>{templateQuery.error instanceof Error && "status" in templateQuery.error && templateQuery.error.status === 403
              ? "L’accès au modèle SMS est refusé. Vérifiez que la personnalisation est activée et que votre poste possède le droit correspondant."
              : "Impossible de charger le modèle SMS. Vérifiez la connexion puis réessayez."}</p>
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void templateQuery.refetch()}>Réessayer</Button>
          </AlertDescription></Alert>
        ) : (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{`Absence ${studentLabels.singularLower} vers parent`}</CardTitle>
              <CardDescription>Source active : {sourceLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {source === "default" ? <EmptyState
                title="Aucun modèle SMS personnalisé"
                description="Le message système ci-dessous est utilisé actuellement. Modifiez-le puis enregistrez pour ajouter votre propre message."
                classNameRendu="py-3"
              /> : null}
              {source === "default" && isEnabled ? <Button type="button" variant="outline" className="min-h-12"
                onClick={() => { textareaRef.current?.focus(); textareaRef.current?.select() }}>Ajouter un message</Button> : null}
              {!isEnabled ? (
                <Alert><AlertDescription>
                  Le super admin n&apos;a pas autorisé la personnalisation des modèles SMS pour cette école.
                </AlertDescription></Alert>
              ) : null}
              <Textarea
                ref={textareaRef}
                aria-label={`Texte du SMS d’absence ${studentLabels.singularLower}`}
                value={messageTemplate}
                onChange={(event) => setMessageTemplate(event.target.value)}
                rows={5}
                disabled={!isEnabled}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">{messageTemplate.trim().length} caractères</p>
                <div className="flex flex-wrap gap-2">
                  {source === "school" ? <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    onClick={() => resetMutation.mutate()}
                    disabled={!isEnabled || resetMutation.isPending}
                  >Réinitialiser</Button> : null}
                  <Button
                    type="button"
                    className="min-h-12"
                    onClick={() => updateMutation.mutate()}
                    disabled={!isEnabled || updateMutation.isPending || messageTemplate.trim().length < 5}
                  >{source === "school" ? "Enregistrer" : "Créer le modèle SMS"}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
