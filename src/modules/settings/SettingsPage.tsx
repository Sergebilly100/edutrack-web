import SchoolConfigPanel from "@/modules/settings/components/SchoolConfigPanel"

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-1 md:py-2">
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres école</h1>
        <p className="text-sm text-muted-foreground">Configuration de l&apos;école et gestion des postes administratifs.</p>
      </header>

      <SchoolConfigPanel />
    </div>
  )
}
