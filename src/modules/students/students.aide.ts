import type { AidePage } from "@/shared/aide/aide.types"

export const studentsAide: AidePage = {
  id: "students",
  espace: "Vie scolaire",
  titre: "Élèves",
  chemins: ["/students"],
  roles: ["director", "staff"],
  requires: ["students.view"],
  visite: "students",
  resume:
    "Cette page liste tous les élèves de l'école avec leur classe, leur statut et leurs absences du mois. Utilisez-la pour retrouver un élève, ouvrir sa fiche ou repérer ceux qui s'absentent trop.",
  taches: [
    {
      id: "retrouver-eleve",
      titre: "Comment retrouver un élève ?",
      etapes: [
        "Tapez le nom dans la zone « Rechercher par nom ».",
        "Choisissez si besoin un niveau, une classe ou un statut avec les menus au-dessus de la liste.",
        "Cliquez sur la ligne de l'élève pour ouvrir sa fiche.",
      ],
    },
    {
      id: "suivre-absences",
      titre: "Comment voir qui s'absente le plus ?",
      etapes: [
        "Ouvrez l'onglet « Absences ».",
        "Choisissez la période à regarder.",
        "Lisez la liste : les élèves les plus absents sont en haut.",
        "Cliquez sur un élève pour voir le détail de ses absences.",
      ],
      requires: ["attendance.view"],
      reserve: "Réservé aux personnes qui peuvent consulter les présences",
    },
    {
      id: "ajouter-eleve",
      titre: "Comment ajouter un nouvel élève ?",
      etapes: [
        "Ouvrez « Inscriptions » dans le menu.",
        "Cliquez sur « Nouvelle inscription ».",
        "Remplissez les informations de l'élève et de ses parents.",
        "Validez : l'élève apparaît ensuite dans cette liste.",
      ],
      requires: ["enrollments.create"],
      reserve: "Réservé à la direction et aux personnes qui gèrent les inscriptions",
    },
    {
      id: "consulter-dossiers",
      titre: "Comment consulter l'historique d'un élève ?",
      etapes: [
        "Cliquez sur « Tous les dossiers élèves » en haut de la page.",
        "Retrouvez l'élève dans la liste.",
        "Ouvrez son dossier pour voir ses années précédentes.",
      ],
    },
  ],
  bonASavoir: [
    "Les élèves ne se créent pas ici : ils sont ajoutés par une inscription.",
    "Un élève avec trop d'absences dans le mois apparaît en rouge.",
    "Le téléphone ou l'e-mail du parent est nécessaire pour envoyer les alertes d'absence.",
  ],
}
