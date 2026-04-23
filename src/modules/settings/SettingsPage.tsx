import { useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@/components/ui/alert"
import SchoolConfigPanel from "@/modules/settings/components/SchoolConfigPanel"
import SmsTemplatePanel from "@/modules/settings/components/SmsTemplatePanel"
import { fetchSchoolConfig } from "@/modules/settings/settings.api"
import { OfflineIndicator } from "@/shared/components/OfflineIndicator"
import { useAuthStore } from "@/shared/store/auth.store"

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const schoolConfigQuery = useQuery({
    queryKey: ["settings", "school-config", "access-gate"],
    queryFn: fetchSchoolConfig,
  })

  const canAccessSchoolConfig =
    user?.role === "director" ||
    permissions.includes("settings.school") ||
    permissions.includes("settings.positions")
  const canEditSmsTemplateByAdmin = schoolConfigQuery.data?.school.canEditSmsTemplate ?? false
  const canAccessSmsTemplate =
    canEditSmsTemplateByAdmin && (user?.role === "director" || permissions.includes("settings.sms_templates"))

  return (
    <div className="animate-fade-in space-y-6">
      <OfflineIndicator />
      <div className="flex items-start justify-between border-b border-border pb-5">
        <div className="space-y-0.5">
          <h1 className="text-xl font-medium tracking-tight">Paramètres école</h1>
          <p className="text-sm text-muted-foreground">
            Configuration de l&apos;école et gestion des postes administratifs.
          </p>
        </div>
      </div>

      {canAccessSchoolConfig ? <SchoolConfigPanel /> : null}
      {canAccessSmsTemplate ? <SmsTemplatePanel /> : null}

      {!canAccessSchoolConfig && !canAccessSmsTemplate ? (
        <Alert variant="destructive">
          <AlertDescription>
            Vous n&apos;avez pas les permissions nécessaires pour accéder aux paramètres.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
