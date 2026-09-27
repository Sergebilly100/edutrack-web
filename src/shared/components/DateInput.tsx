import { useRef } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type DateInputProps = {
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  value: string
  onChange: (value: string) => void
  className?: string
  min?: string
  max?: string
  disabled?: boolean
  "aria-label"?: string
}

/**
 * Input date qui ouvre le picker natif au clic sur n'importe quelle zone du champ.
 * showPicker() est l'API standard (Chrome/Edge/Android). Sur les autres navigateurs,
 * le focus suffit à déclencher l'ouverture.
 */
export function DateInput({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy, value, onChange, className, min, max, disabled, "aria-label": ariaLabel }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    const el = inputRef.current
    if (!el || disabled) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }

  return (
    <Input
      id={id}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      ref={inputRef}
      type="date"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn("cursor-pointer", className)}
      onChange={(event) => onChange(event.target.value)}
      onClick={handleClick}
    />
  )
}
