import type { Step } from "react-joyride"

import type { AuthRole, PermissionKey } from "@/shared/store/auth.store"

/** Rôle d'un lecteur de l'aide : les parents ont leur propre authentification. */
export type AideRole = AuthRole | "parent"

/** Étape de visite guidée, avec conditions optionnelles de rôle et de permission. */
export type AideStep = Step & {
  roles?: AideRole[]
  /** Au moins une de ces permissions est requise. */
  requires?: PermissionKey[]
}

export type AideTask = {
  id: string
  /** Question de l'utilisateur, ex. « Comment réinscrire un élève ? » */
  titre: string
  /** 3 à 6 étapes courtes, verbe d'action en tête. */
  etapes: string[]
  roles?: AideRole[]
  requires?: PermissionKey[]
  /** Texte affiché à la place de la tâche quand l'utilisateur n'y a pas droit. */
  reserve?: string
}

export type AidePage = {
  /** Identique à l'identifiant de visite (useTourGuide) quand la page en a une. */
  id: string
  /** Regroupement dans le centre d'aide, ex. « Vie scolaire ». */
  espace: string
  titre: string
  /** Motifs de route React Router, ex. "/students". */
  chemins: string[]
  roles: AideRole[]
  requires?: PermissionKey[]
  /** « À quoi sert cette page » : 2 à 3 phrases. */
  resume: string
  /** Fonctionnalité à activer ou réglage à faire avant que la page serve (1 à 3 phrases courtes). */
  prerequis?: string[]
  taches: AideTask[]
  /** 2 à 4 points : règles, pièges, irréversible, ce que voit chaque rôle. */
  bonASavoir: string[]
  /** Identifiant de la visite guidée de la page. */
  visite?: string
}

export type AideViewer = {
  role: AideRole | undefined
  hasPermission: (key: PermissionKey) => boolean
}
