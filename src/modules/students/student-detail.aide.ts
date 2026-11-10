import type { AidePage } from "@/shared/aide/aide.types"

export const studentDetailAide: AidePage = {
  id: "student-detail",
  espace: "Vie scolaire",
  titre: "Fiche élève",
  chemins: ["/students/:studentId", "/students/:studentId/history"],
  roles: ["director", "staff"],
  requires: ["students.view"],
  visite: "student-detail",
  resume:
    "La fiche réunit tout ce que l'école sait d'un élève : identité, absences, dossier, résultats, paiements et contacts des parents. Utilisez-la pour suivre un élève ou corriger les coordonnées de ses parents.",
  taches: [
    {
      id: "voir-absences",
      titre: "Comment voir les absences d'un élève ?",
      etapes: [
        "Ouvrez l'onglet « Absences ».",
        "Filtrez par mois, par matière ou par statut si besoin.",
        "Lisez la date, la matière et l'état du message envoyé au parent.",
      ],
      requires: ["attendance.view"],
      reserve: "Réservé aux personnes qui peuvent consulter les présences",
    },
    {
      id: "excuser-absence",
      titre: "Comment excuser une absence ?",
      etapes: [
        "Ouvrez l'onglet « Absences ».",
        "Cliquez sur « Excuser » sur la ligne de l'absence.",
        "Saisissez le motif de l'excuse.",
        "Confirmez.",
      ],
      requires: ["students.excuse"],
      reserve: "Réservé aux personnes qui peuvent excuser les absences",
    },
    {
      id: "modifier-contacts",
      titre: "Comment changer le téléphone d'un parent ?",
      etapes: [
        "Ouvrez l'onglet « Infos Parents ».",
        "Modifiez le nom, le téléphone ou l'e-mail du parent.",
        "Cliquez sur « Modifier les contacts ».",
      ],
      requires: ["students.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les élèves",
    },
    {
      id: "renvoyer-message",
      titre: "Comment renvoyer un message échoué au parent ?",
      etapes: [
        "Ouvrez l'onglet « Notifications Parents ».",
        "Repérez le message au statut « Échec ».",
        "Cliquez sur « Renvoyer » sur sa ligne.",
      ],
      requires: ["attendance.view"],
      reserve: "Réservé aux personnes qui peuvent consulter les présences",
    },
    {
      id: "ajouter-piece",
      titre: "Comment ajouter une pièce au dossier ?",
      etapes: [
        "Ouvrez l'onglet « Dossier ».",
        "Repérez la pièce à ajouter.",
        "Déposez le fichier ou cliquez pour le choisir sur l'appareil.",
      ],
      requires: ["students.documents"],
      reserve: "Réservé aux personnes qui gèrent les dossiers",
    },
    {
      id: "annees-passees",
      titre: "Comment voir les années précédentes ?",
      etapes: [
        "Cliquez sur « Historique scolaire » en haut de la page.",
        "Choisissez l'année scolaire à consulter.",
        "Parcourez les onglets : absences, bulletins, résultats.",
      ],
    },
  ],
  bonASavoir: [
    "Un élève avec plus de 3 absences ce mois-ci porte une pastille rouge : un suivi est conseillé.",
    "Les onglets affichés dépendent de vos droits : un onglet absent n'est pas ouvert à votre profil.",
    "Sans téléphone du parent, aucun message d'absence ne peut partir.",
  ],
}

export const studentsHistoryAide: AidePage = {
  id: "students-history",
  espace: "Vie scolaire",
  titre: "Tous les dossiers élèves",
  chemins: ["/students/history"],
  roles: ["director", "staff"],
  requires: ["students.view"],
  resume:
    "Cette page retrouve n'importe quel élève de l'école, même sans inscription cette année. Elle ouvre ensuite son dossier avec toutes ses années.",
  taches: [
    {
      id: "retrouver-dossier",
      titre: "Comment retrouver un ancien élève ?",
      etapes: [
        "Laissez « Tous les dossiers » sélectionné.",
        "Tapez le nom ou le matricule dans la zone de recherche.",
        "Choisissez une année ou un niveau pour réduire la liste.",
        "Cliquez sur l'élève pour ouvrir son dossier.",
      ],
    },
    {
      id: "inscrits-cette-annee",
      titre: "Comment voir seulement les inscrits de cette année ?",
      etapes: [
        "Cliquez sur « Inscrits cette année ».",
        "Cliquez sur un élève pour ouvrir son dossier.",
        "Cliquez sur « Voir les effectifs et absences » pour revenir à la liste des élèves.",
      ],
    },
  ],
  bonASavoir: [
    "Un élève sans inscription active reste consultable ici.",
    "Pour suivre les absences du mois, utilisez la page « Élèves ».",
  ],
}
