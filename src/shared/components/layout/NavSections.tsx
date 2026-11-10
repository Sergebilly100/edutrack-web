import { Fragment, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ActionBadge } from "@/shared/components/ActionBadge"
import { toNavBlocks, type NavItem } from "@/shared/components/layout/nav-items"

type NavSectionsProps = {
  group: string
  items: NavItem[]
  isActive: (item: NavItem) => boolean
  renderItem: (item: NavItem) => ReactNode
  badgeFor: (item: NavItem) => { count?: number; details?: string[] }
  /** Cibles tactiles plus hautes dans le tiroir mobile. */
  touch?: boolean
}

/**
 * Entrées d'un groupe du menu, organisées en sous-groupes repliables façon arborescence :
 * - chaque sous-groupe a son titre (chevron à gauche) et ses entrées sont indentées derrière un filet vertical,
 *   pour montrer clairement l'imbrication ; aucune entrée n'est « hors » d'un sous-groupe ;
 * - seul le sous-groupe contenant la page active est ouvert ; les autres sont repliés. Un sous-groupe ouvert à la main
 *   n'est gardé ouvert que le temps de rester sur la même page : dès qu'on navigue, il se referme ;
 * - un sous-groupe replié affiche la somme des pastilles de ses entrées.
 */
export function NavSections({ group, items, isActive, renderItem, badgeFor, touch = false }: NavSectionsProps) {
  const blocks = toNavBlocks(items)
  const activeSection = blocks.find((block) => block.section && block.items.some(isActive))?.section ?? ""
  // Ouvertures manuelles, valables uniquement pour la page active au moment du clic.
  const [manual, setManual] = useState<{ anchor: string; open: Record<string, boolean> }>({ anchor: "", open: {} })
  const manualOpen = manual.anchor === activeSection ? manual.open : {}

  return (
    <>
      {blocks.map((block) => {
        const key = `${block.section ?? ""}:${block.items[0]!.href}`
        if (!block.section) {
          return <Fragment key={key}>{block.items.map((item) => <Fragment key={item.href}>{renderItem(item)}</Fragment>)}</Fragment>
        }
        const hasActive = block.items.some(isActive)
        const open = hasActive || manualOpen[block.section] === true
        const totals = block.items.reduce((sum, item) => sum + (badgeFor(item).count ?? 0), 0)
        const details = block.items.flatMap((item) => badgeFor(item).details ?? [])
        return (
          <Collapsible key={key} open={open} onOpenChange={(next) => { if (!hasActive) setManual({ anchor: activeSection, open: { ...manualOpen, [block.section!]: next } }) }} className="space-y-0.5">
            <CollapsibleTrigger
              className={cn(
                "group flex w-full items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                touch ? "min-h-11" : "min-h-9",
              )}
              aria-label={`${block.section}${open ? ", ouvert" : ", fermé"}`}
            >
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-90 motion-reduce:transition-none" />
              <span className="flex-1 text-left">{block.section}</span>
              {!open ? <ActionBadge count={totals} details={details} /> : null}
            </CollapsibleTrigger>
            <CollapsibleContent className={cn("ml-[15px] border-l border-border pl-1.5", touch ? "space-y-1" : "space-y-0.5")}>
              {block.items.map((item) => <Fragment key={item.href}>{renderItem(item)}</Fragment>)}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </>
  )
}
