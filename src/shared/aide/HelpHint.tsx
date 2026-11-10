import { HelpCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type HelpHintProps = {
  /** Terme expliqué, ex. « Impayé ». Sert au libellé accessible du bouton. */
  term: string
  /** 1 à 2 phrases en français simple. */
  children: string
}

/** Petit « ? » à côté d'un champ ou d'un terme difficile. Zone tactile de 48 px. */
export function HelpHint({ term, children }: HelpHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-12 w-12 shrink-0 text-muted-foreground" aria-label={`Explication : ${term}`}>
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-w-[calc(100vw-2rem)] space-y-1 p-3" align="start">
        <p className="text-sm font-semibold">{term}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </PopoverContent>
    </Popover>
  )
}
