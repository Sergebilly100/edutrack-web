import type { AidePage } from "@/shared/aide/aide.types"

export const scheduleAide: AidePage = {
  id: "schedule",
  espace: "Gestion de l'école",
  titre: "Emploi du temps",
  chemins: ["/schedule"],
  roles: ["director", "staff"],
  visite: "schedule",
  resume:
    "Cette page montre les cours de la semaine, classe par classe et professeur par professeur. Vous y ajoutez, déplacez ou supprimez un créneau, ou vous importez tout l'emploi du temps d'un coup.",
  prerequis: [
    "Une période active est nécessaire : importez d'abord l'emploi du temps avec ses dates d'application.",
  ],
  taches: [
    {
      id: "changer-semaine",
      titre: "Comment voir une autre semaine ?",
      etapes: [
        "Cliquez sur les flèches « Semaine précédente » ou « Semaine suivante ».",
        "Cliquez sur « Aujourd'hui » pour revenir à la semaine en cours.",
        "Choisissez « Grille » ou « Liste » pour changer l'affichage.",
      ],
    },
    {
      id: "filtrer-cours",
      titre: "Comment voir les cours d'un professeur ou d'une classe ?",
      etapes: [
        "Ouvrez le menu « Filtrer par professeur », « par classe » ou « par niveau ».",
        "Choisissez un nom : seuls ses cours restent affichés.",
        "Cliquez sur le filtre actif pour l'effacer.",
      ],
    },
    {
      id: "importer-edt",
      titre: "Comment importer tout l'emploi du temps ?",
      etapes: [
        "Cliquez sur « Importer l'EDT ».",
        "Suivez les étapes de la page d'import avec votre fichier.",
        "Indiquez les dates d'application de l'emploi du temps.",
        "Revenez ici avec « Retour à l'EDT » pour vérifier la semaine.",
      ],
      requires: ["import.schedule"],
      reserve: "Réservé aux personnes qui peuvent importer l'emploi du temps",
    },
    {
      id: "ajouter-creneau",
      titre: "Comment ajouter un cours ?",
      etapes: [
        "Cliquez sur « Ajouter un créneau », ou sur une case vide de la grille.",
        "Choisissez la période, le professeur, la classe et la matière.",
        "Indiquez le jour, l'heure de début et de fin, puis la salle.",
        "Cliquez sur le bouton d'enregistrement.",
      ],
      requires: ["schedule.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier l'emploi du temps",
    },
    {
      id: "modifier-creneau",
      titre: "Comment modifier ou supprimer un cours ?",
      etapes: [
        "Cliquez sur le cours dans la grille ou la liste.",
        "Cliquez sur « Modifier » ou sur « Supprimer ».",
        "Si le cours revient chaque semaine, choisissez : cette occurrence, les suivantes, ou toutes.",
        "Confirmez.",
      ],
      requires: ["schedule.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier l'emploi du temps",
    },
  ],
  bonASavoir: [
    "Sans période active, on ne peut ni ajouter ni modifier de créneau : importez d'abord l'emploi du temps.",
    "Un cours déjà enseigné ne peut plus être modifié pour toutes ses occurrences.",
    "Un professeur bloqué reste visible dans l'emploi du temps mais ne peut plus pointer.",
    "Le badge « Lecture seule » signifie que votre profil ne modifie pas l'emploi du temps.",
  ],
}
