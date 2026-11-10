import type { AidePage } from "@/shared/aide/aide.types"

export const teachersAide: AidePage = {
  id: "teachers",
  espace: "Vie scolaire",
  titre: "Professeurs",
  chemins: ["/teachers"],
  roles: ["director", "staff"],
  requires: ["teachers.view"],
  visite: "teachers",
  resume:
    "Cette page liste les professeurs de l'école. Vous y ajoutez un professeur, lui envoyez ses identifiants et suivez sa présence et son classement.",
  taches: [
    {
      id: "ajouter-prof",
      titre: "Comment ajouter un professeur ?",
      etapes: [
        "Cliquez sur « Ajouter un prof » en haut de la page.",
        "Remplissez son identité, son type (vacataire ou permanent) et ses matières.",
        "Cliquez sur « Créer le professeur ».",
        "Cliquez ensuite sur « Envoyer les identifiants » pour lui donner accès.",
      ],
      requires: ["teachers.create"],
      reserve: "Réservé à la direction et aux personnes qui gèrent les professeurs",
    },
    {
      id: "retrouver-prof",
      titre: "Comment retrouver un professeur ?",
      etapes: [
        "Tapez son nom dans « Rechercher un professeur ».",
        "Filtrez par type, statut ou matière si besoin.",
        "Cliquez sur sa ligne pour ouvrir sa fiche.",
      ],
    },
    {
      id: "envoyer-identifiants",
      titre: "Comment donner leurs accès aux professeurs ?",
      etapes: [
        "Cliquez sur « Envoyer les identifiants ».",
        "Lisez le message de confirmation.",
        "Confirmez : chaque professeur sans accès reçoit un mot de passe temporaire.",
      ],
      requires: ["teachers.password.reset"],
      reserve: "Réservé aux personnes qui gèrent les accès des professeurs",
    },
    {
      id: "suivre-presence",
      titre: "Comment repérer les professeurs peu présents ?",
      etapes: [
        "Ouvrez l'onglet « Analyse présence ».",
        "Choisissez la période à regarder.",
        "Lisez le taux de présence, les absences et les retards de chacun.",
        "Ouvrez « Classement » pour voir le score du mois.",
      ],
      requires: ["teachers.attendance.view", "teachers.ranking.view"],
      reserve: "Réservé aux personnes qui peuvent consulter les présences des professeurs",
    },
    {
      id: "exporter-liste",
      titre: "Comment sortir la liste en fichier Excel ?",
      etapes: [
        "Cliquez sur « Exporter » à côté de « Ajouter un prof ».",
        "Choisissez l'année et, si besoin, uniquement la liste filtrée.",
        "Lancez l'export puis ouvrez le fichier téléchargé.",
      ],
    },
  ],
  bonASavoir: [
    "Un vacataire est payé à l'heure ; un permanent reçoit un salaire fixe par mois.",
    "Un professeur bloqué ne peut plus se connecter à l'application de pointage.",
    "Le mot de passe temporaire doit être changé par le professeur à sa première connexion.",
  ],
}

export const teacherDetailAide: AidePage = {
  id: "teacher-detail",
  espace: "Vie scolaire",
  titre: "Fiche professeur",
  chemins: ["/teachers/:teacherId"],
  roles: ["director", "staff"],
  requires: ["teachers.view"],
  visite: "teacher-detail",
  resume:
    "La fiche réunit le mois en cours, l'emploi du temps, les présences et les documents d'un professeur. Utilisez-la pour le suivre, corriger ses informations ou bloquer son accès.",
  taches: [
    {
      id: "voir-mois",
      titre: "Comment voir où en est le professeur ce mois-ci ?",
      etapes: [
        "Lisez le bloc « Synthèse du mois en cours » en haut de la page.",
        "Comparez les heures prévues, les heures pointées et les heures d'absence.",
        "Ouvrez l'onglet « Présences » pour le détail séance par séance.",
      ],
    },
    {
      id: "modifier-infos",
      titre: "Comment modifier les informations du professeur ?",
      etapes: [
        "Ouvrez l'onglet « Infos ».",
        "Corrigez le téléphone, l'e-mail, les matières ou le taux.",
        "Cliquez sur « Enregistrer ».",
      ],
      requires: ["teachers.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les professeurs",
    },
    {
      id: "reinitialiser-mot-de-passe",
      titre: "Comment réinitialiser son mot de passe ?",
      etapes: [
        "Ouvrez l'onglet « Infos ».",
        "Dans le bloc « Compte », cliquez sur « Réinitialiser le mot de passe ».",
        "Confirmez : un mot de passe temporaire est créé.",
        "Transmettez-le au professeur s'il s'affiche à l'écran.",
      ],
      requires: ["teachers.password.reset"],
      reserve: "Réservé aux personnes qui gèrent les accès des professeurs",
    },
    {
      id: "bloquer-prof",
      titre: "Comment bloquer ou débloquer un professeur ?",
      etapes: [
        "Dans la carte du profil, cliquez sur « Bloquer » ou « Débloquer ».",
        "Pour bloquer, saisissez la raison du blocage.",
        "Confirmez.",
      ],
      requires: ["teachers.block"],
      reserve: "Réservé à la direction",
    },
    {
      id: "documents-prof",
      titre: "Comment ajouter un document au dossier ?",
      etapes: [
        "Ouvrez l'onglet « Documents ».",
        "Déposez le fichier : contrat, diplôme ou justificatif.",
        "Vérifiez qu'il apparaît dans la liste des documents.",
      ],
      requires: ["teachers.documents"],
      reserve: "Réservé aux personnes qui gèrent les dossiers des professeurs",
    },
  ],
  bonASavoir: [
    "« HAV » signifie « heures à valider » : des présences pointées que la direction n'a pas encore validées.",
    "Bloquer un professeur coupe son accès tout de suite.",
    "Sans e-mail renseigné, le nouveau mot de passe s'affiche à l'écran au lieu d'être envoyé.",
  ],
}
