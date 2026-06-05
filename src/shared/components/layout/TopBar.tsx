import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { OfflineQueueBadge } from "@/shared/components/OfflineQueueBadge"
import { ThemeToggle } from "@/shared/components/ThemeToggle"
import { UserMenu } from "@/shared/components/layout/UserMenu"

interface TopBarProps {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background md:hidden">
      <div className="grid h-full grid-cols-[40px_1fr_auto] items-center gap-2 px-3">
        <Button type="button" variant="ghost" size="icon" onClick={onMenuClick} aria-label="Ouvrir le menu de navigation">
          <Menu size={20} />
        </Button>

        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
            ET
          </span>
          <span className="text-sm font-semibold">IvoirEdu</span>
        </div>

        <div className="flex items-center justify-end gap-1">
          <OfflineQueueBadge />
          <ThemeToggle />
          <UserMenu collapsed />
        </div>
      </div>
    </header>
  )
}
