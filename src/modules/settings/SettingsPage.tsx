import SchoolConfigPanel from "@/modules/settings/components/SchoolConfigPanel"

export default function SettingsPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between border-b border-border pb-5">
        <div className="space-y-0.5">
          <h1 className="text-xl font-medium tracking-tight">Paramètres école</h1>
          <p className="text-sm text-muted-foreground">
            Configuration de l&apos;école et gestion des postes administratifs.
          </p>
        </div>
      </div>
      <SchoolConfigPanel />
    </div>
  )
}
