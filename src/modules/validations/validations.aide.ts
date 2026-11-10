import type { AidePage } from "@/shared/aide/aide.types"

export const validationsAide: AidePage = {
  id: "validations",
  espace: "Gestion de l'école",
  titre: "Validation des horaires",
  chemins: ["/validations"],
  roles: ["director", "staff"],
  requires: ["validations.view"],
  visite: "validations",
  resume:
    "Cette page rassemble les présences de professeurs qui attendent votre décision : cours trop courts, scan de fin oublié, pointage suspect. Tant qu'elles ne sont pas traitées, ces heures ne comptent pas dans les salaires.",
  prerequis: [
    "L'onglet « Heures à valider » ne se remplit que si la fonction « Heures réelles » est activée par IvoirEdu pour votre école.",
    "Sans elle, les cours courts sont validés automatiquement et rien n'attend votre décision ici.",
    "Vous voyez l'état de cette fonction dans Paramètres, onglet Général, bloc « Heures réelles ». Demandez son activation à IvoirEdu.",
  ],
  taches: [
    {
      id: "heures-courtes",
      titre: "Comment valider les heures d'un cours trop court ?",
      etapes: [
        "Ouvrez l'onglet « Heures à valider ».",
        "Repérez le professeur, avec la zone de recherche si besoin.",
        "Cliquez sur « Accorder le prévu » ou « Accorder l'effectué ».",
        "Confirmez : le salaire du vacataire est recalculé.",
      ],
      requires: ["validations.approve"],
      reserve: "Réservé aux personnes qui peuvent valider les présences",
    },
    {
      id: "valider-plusieurs",
      titre: "Comment valider plusieurs présences d'un coup ?",
      etapes: [
        "Cochez les présences à traiter, ou la case du haut pour tout cocher.",
        "Utilisez la barre qui apparaît en bas de l'écran.",
        "Confirmez la validation groupée.",
      ],
      requires: ["validations.approve"],
      reserve: "Réservé aux personnes qui peuvent valider les présences",
    },
    {
      id: "scan-fin",
      titre: "Comment traiter un scan de fin oublié ?",
      etapes: [
        "Ouvrez l'onglet « Scan de fin ».",
        "Repérez le cours concerné.",
        "Cliquez sur « Tolérer avec avertissement » ou sur « Sanctionner ».",
        "Confirmez : un message est envoyé au professeur.",
      ],
      requires: ["validations.approve"],
      reserve: "Réservé aux personnes qui peuvent valider les présences",
    },
    {
      id: "presence-suspecte",
      titre: "Comment traiter une présence suspecte ?",
      etapes: [
        "Ouvrez l'onglet « Présences suspectes ».",
        "Regardez l'écart GPS entre le scan et la salle.",
        "Cliquez sur « Valider » si la présence est bonne.",
        "Cliquez sur « Marquer absent » sinon, et saisissez le motif du refus.",
      ],
      requires: ["validations.approve", "validations.reject"],
      reserve: "Réservé aux personnes qui peuvent valider les présences",
    },
    {
      id: "annuler-sanction",
      titre: "Comment annuler une sanction ?",
      etapes: [
        "Ouvrez l'onglet « Scan de fin ».",
        "Repérez le cours sanctionné.",
        "Cliquez sur « Annuler la sanction » puis confirmez.",
      ],
      requires: ["validations.approve"],
      reserve: "Réservé aux personnes qui peuvent valider les présences",
    },
  ],
  bonASavoir: [
    "Les heures en attente ne sont pas comptées dans les salaires : traitez-les avant de calculer le mois.",
    "Un cours sanctionné n'est pas comptabilisé : le professeur doit se justifier à l'administration.",
    "Le chiffre entre parenthèses dans chaque onglet donne le nombre de cas à traiter.",
  ],
}
