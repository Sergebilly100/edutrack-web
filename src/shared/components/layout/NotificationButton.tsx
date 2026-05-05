import { Bell } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/shared/store/auth.store"

type NotificationButtonProps = {
  count?: number
  className?: string
}

export function NotificationButton({ count = 0, className }: NotificationButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)

  if (user?.role !== "director") {
    return null
  }

  const handleClick = () => {
    if (location.pathname === "/dashboard") {
      window.dispatchEvent(new Event("dashboard:mobile-toggle-notifications"))
      return
    }

    navigate("/dashboard", { state: { openNotifications: true } })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Voir les notifications"
      onClick={handleClick}
      className={cn("relative h-9 w-9", className)}
    >
      <Bell className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Button>
  )
}
