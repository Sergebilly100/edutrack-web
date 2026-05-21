import { useEffect, useState } from "react"
import { BookOpen, GraduationCap, Users, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ImportType } from "./import-export.api"

type Props = {
  importType: ImportType
  phase: "analysis" | "import"
}

const MESSAGES: Record<ImportType, Record<"analysis" | "import", string[]>> = {
  students: {
    analysis: [
      "Lecture du fichier en cours…",
      "Vérification des noms et classes…",
      "Contrôle des doublons…",
      "Validation des contacts parents…",
    ],
    import: [
      "Enregistrement des élèves…",
      "Mise à jour des classes…",
      "Sauvegarde des contacts…",
      "Finalisation de l'import…",
    ],
  },
  teachers: {
    analysis: [
      "Lecture du fichier en cours…",
      "Vérification des noms des enseignants…",
      "Contrôle des matières…",
      "Validation des types de contrat…",
    ],
    import: [
      "Création des comptes enseignants…",
      "Attribution des matières…",
      "Configuration des accès…",
      "Finalisation de l'import…",
    ],
  },
  schedule: {
    analysis: [
      "Lecture du fichier en cours…",
      "Vérification des créneaux horaires…",
      "Contrôle des salles et classes…",
      "Détection des conflits…",
    ],
    import: [
      "Construction de l'emploi du temps…",
      "Affectation des salles…",
      "Activation des créneaux…",
      "Finalisation de l'import…",
    ],
  },
}

const ICON_BY_TYPE: Record<ImportType, typeof GraduationCap> = {
  students: GraduationCap,
  teachers: Users,
  schedule: Calendar,
}

const DOTS = [0, 1, 2, 3, 4]

export function ImportLoadingOverlay({ importType, phase }: Props) {
  const messages = MESSAGES[importType][phase]
  const [msgIndex, setMsgIndex] = useState(0)
  const [dotIndex, setDotIndex] = useState(0)

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length)
    }, 1800)
    return () => clearInterval(msgTimer)
  }, [messages.length])

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDotIndex((i) => (i + 1) % DOTS.length)
    }, 400)
    return () => clearInterval(dotTimer)
  }, [])

  const Icon = ICON_BY_TYPE[importType]

  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8">
      {/* Icône animée */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-ping rounded-full bg-primary/10" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-8 w-8 animate-pulse text-primary" />
        </div>
      </div>

      {/* Livres animés (défilement) */}
      <div className="flex items-end gap-1.5">
        {DOTS.map((i) => (
          <div
            key={i}
            className={cn(
              "rounded-full bg-primary transition-all duration-300",
              i === dotIndex ? "h-4 w-4 opacity-100" : "h-2.5 w-2.5 opacity-40"
            )}
          />
        ))}
      </div>

      {/* Barre de progression indéterminée */}
      <div className="w-full max-w-xs overflow-hidden rounded-full bg-primary/10">
        <div className="h-1.5 w-1/2 animate-[progress_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>

      {/* Message rotatif */}
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{messages[msgIndex]}</p>
        <p className="mt-1 text-xs text-muted-foreground">Veuillez patienter…</p>
      </div>

      {/* Icônes école décoratifs */}
      <div className="flex items-center gap-3 opacity-30">
        <BookOpen className="h-4 w-4" />
        <span className="h-1 w-1 rounded-full bg-current" />
        <GraduationCap className="h-4 w-4" />
        <span className="h-1 w-1 rounded-full bg-current" />
        <Calendar className="h-4 w-4" />
      </div>
    </div>
  )
}
