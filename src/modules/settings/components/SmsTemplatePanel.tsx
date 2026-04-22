import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MessageSquareText } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import {
  getSchoolStudentAbsenceSmsTemplate,
  resetSchoolStudentAbsenceSmsTemplate,
  updateSchoolStudentAbsenceSmsTemplate,
} from "@/modules/settings/settings.api"

const SMS_TEMPLATE_QUERY_KEY = ["settings", "sms-template", "student-absence"] as const

export default function SmsTemplatePanel() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [messageTemplate, setMessageTemplate] = useState("")

  const templateQuery = useQuery({
    queryKey: SMS_TEMPLATE_QUERY_KEY,
    queryFn: getSchoolStudentAbsenceSmsTemplate,
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
      await queryClient.invalidateQueries({ queryKey: SMS_TEMPLATE_QUERY_KEY })
      toast({ title: "Template absence élève mis à jour" })
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
      toast({ title: "Template école réinitialisé (modèle global appliqué)" })
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser le template SMS.",
        variant: "destructive",
      })
    },
  })

  const isEnabled = templateQuery.data?.enabledBySuperAdmin ?? false
  const sourceLabel = useMemo(() => {
    const source = templateQuery.data?.source
    if (source === "school") return "Personnalisé (école)"
    if (source === "global") return "Modèle global EduTrack"
    return "Modèle par défaut système"
  }, [templateQuery.data?.source])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
            <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Template SMS absence élève</p>
            <p className="text-xs text-muted-foreground">
              Visible/modifiable selon autorisation du super admin.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {templateQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Impossible de charger le template SMS. Vérifie les droits d&apos;accès.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Absence élève vers parent</CardTitle>
            <CardDescription>
              Source active: {sourceLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isEnabled ? (
              <Alert>
                <AlertDescription>
                  Le super admin n&apos;a pas autorisé la personnalisation des templates pour cette école.
                </AlertDescription>
              </Alert>
            ) : null}

            <textarea
              value={messageTemplate}
              onChange={(event) => setMessageTemplate(event.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={!isEnabled}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {messageTemplate.trim().length} caractères
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetMutation.mutate()}
                  disabled={!isEnabled || resetMutation.isPending}
                >
                  Réinitialiser
                </Button>
                <Button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={!isEnabled || updateMutation.isPending || messageTemplate.trim().length < 5}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
