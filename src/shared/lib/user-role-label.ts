import type { AuthUser } from "@/shared/store/auth.store"

const ROLE_LABELS: Record<string, string> = {
  director: "Directeur",
  teacher: "Professeur",
  super_admin: "Super admin",
}

export const getUserRoleLabel = (user: AuthUser | null | undefined): string => {
  if (!user) {
    return "Rôle inconnu"
  }

  if (user.role === "staff") {
    return user.primaryPosition?.trim() || "Staff"
  }

  return ROLE_LABELS[user.role] ?? "Rôle inconnu"
}
