import { Link } from "react-router-dom"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getNavItemsByRole } from "@/shared/components/layout/nav-items"
import { useStudentLabels } from "@/shared/hooks/useStudentLabel"
import { useAuthStore } from "@/shared/store/auth.store"

export default function AdministrativeDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const studentLabels = useStudentLabels()

  const quickLinks = getNavItemsByRole(user?.role, permissions, studentLabels.plural).filter((item) => item.href !== "/dashboard")

  return (
    <div className="space-y-6 animate-fade-in py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenue {user?.name ?? ""}</h1>
        <p className="text-sm text-muted-foreground">
          Tableau de bord administratif. Accédez rapidement aux modules autorisés pour votre rôle.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickLinks.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Aucun module n&apos;est encore autorisé pour votre profil.
            </CardContent>
          </Card>
        ) : (
          quickLinks.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} to={item.href}>
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </CardTitle>
                    <CardDescription>Ouvrir le module</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">Consulter et gérer les données autorisées.</CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
