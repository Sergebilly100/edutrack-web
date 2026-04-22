import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logout } from "@/modules/auth/auth.api"
import { cn } from "@/lib/utils"
import { LogoutIcon, UserIcon } from "@/shared/components/icons"
import { useAuthStore } from "@/shared/store/auth.store"

interface UserMenuProps {
  collapsed?: boolean
}

const roleLabels: Record<string, string> = {
  director: "Directeur",
  staff: "Staff",
  teacher: "Professeur",
  super_admin: "Super admin",
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "ET"
}

function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((total, char) => total + char.charCodeAt(0), 0)
  const hue = hash % 360
  return `hsl(${hue} 60% 92%)`
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const logoutStore = useAuthStore((state) => state.logout)

  const userName = user?.name ?? "Utilisateur"
  const userRole = roleLabels[user?.role ?? ""] ?? "Rôle inconnu"

  const avatarStyle = useMemo(
    () => ({
      backgroundColor: getAvatarColor(userName),
      color: "hsl(var(--foreground))",
    }),
    [userName]
  )

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      logoutStore()
      queryClient.clear()
      navigate("/login", { replace: true })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
            collapsed ? "justify-center px-0" : ""
          )}
          aria-label="Ouvrir le menu utilisateur"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profilePhotoUrl ?? undefined} alt={userName} />
            <AvatarFallback style={avatarStyle} className="text-xs font-semibold">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{userRole}</p>
            </div>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate(user?.role === "super_admin" ? "/admin/account" : "/account")}>
          <UserIcon className="h-4 w-4" />
          <span>Mon compte</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
          <LogoutIcon className="h-4 w-4" />
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
