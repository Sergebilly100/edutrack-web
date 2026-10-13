import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useAuthStore } from "@/shared/store/auth.store"

export function RecordsNavigation() {
  const location = useLocation()
  const role = useAuthStore((state) => state.user?.role)
  const { hasPermission } = usePermissions()
  const canViewStudents = role === "director" || role === "super_admin" || hasPermission("students.view")
  const canViewEnrollments = role === "director" || role === "super_admin" || hasPermission("enrollments.view")
  const isCampaign = location.pathname === "/enrollments" && new URLSearchParams(location.search).get("tab") === "re-enrollment"
  const selected = location.pathname === "/enrollments" ? (isCampaign ? "campaign" : "enrollments") : "students"

  return (
    <nav aria-label="Inscriptions et dossiers" className="flex flex-wrap gap-2">
      {canViewStudents ? (
        <Button asChild variant={selected === "students" ? "default" : "outline"} className="min-h-12">
          <Link to="/records" aria-current={selected === "students" ? "page" : undefined}>Dossiers élèves</Link>
        </Button>
      ) : null}
      {canViewEnrollments ? (
        <>
          <Button asChild variant={selected === "enrollments" ? "default" : "outline"} className="min-h-12">
            <Link to="/enrollments" aria-current={selected === "enrollments" ? "page" : undefined}>Inscriptions</Link>
          </Button>
          <Button asChild variant={selected === "campaign" ? "default" : "outline"} className="min-h-12">
            <Link to="/enrollments?tab=re-enrollment" aria-current={selected === "campaign" ? "page" : undefined}>Réinscriptions</Link>
          </Button>
        </>
      ) : null}
    </nav>
  )
}
