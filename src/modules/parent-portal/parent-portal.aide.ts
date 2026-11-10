import type { AidePage } from "@/shared/aide/aide.types"

const ESPACE = "Portail parent"

export const parentDashboardAide: AidePage = {
  id: "parent-dashboard",
  espace: ESPACE,
  titre: "Accueil",
  chemins: ["/parent/dashboard"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "L'accueil résume la journée de votre enfant : ses cours d'aujourd'hui, ses absences de la semaine et du mois, son dernier bulletin et la situation de ses frais.",
  taches: [
    {
      id: "changer-enfant",
      titre: "Comment suivre un autre de mes enfants ?",
      etapes: [
        "Repérez la bande « Enfant sélectionné » en haut de la page.",
        "Touchez le nom de l'autre enfant.",
        "Toutes les informations de la page se mettent à jour.",
      ],
    },
    {
      id: "presence-jour",
      titre: "Comment savoir si mon enfant est présent aujourd'hui ?",
      etapes: [
        "Lisez le bloc « Présence aujourd'hui ».",
        "Chaque cours indique présent, absent ou à venir.",
        "Lisez le message en bas pour le résumé de la journée.",
      ],
    },
    {
      id: "derniere-absence",
      titre: "Comment voir le détail d'une absence ?",
      etapes: [
        "Repérez la carte « Dernière absence ».",
        "Touchez-la pour ouvrir l'historique des absences.",
        "Choisissez le mois pour en voir d'autres.",
      ],
    },
    {
      id: "bulletin-frais",
      titre: "Comment consulter le bulletin ou les frais ?",
      etapes: [
        "Touchez le bandeau du bulletin, ou « Consulter les bulletins scolaires ».",
        "Pour les frais, touchez la carte « Situation de scolarité ».",
        "Vous arrivez sur la page correspondante.",
      ],
    },
  ],
  bonASavoir: [
    "Un taux d'absence du mois au-dessus de 20 % s'affiche en rouge.",
    "Un bandeau « Abonnement bientôt expiré » apparaît quand il reste peu de jours : voir « Compte ».",
    "Sans abonnement, vous ne recevez pas les alertes d'absence en temps réel, mais vous pouvez toujours consulter les pages.",
  ],
}

export const parentAbsencesAide: AidePage = {
  id: "parent-absences",
  espace: ESPACE,
  titre: "Absences",
  chemins: ["/parent/absences"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "Cette page liste les absences de votre enfant, mois par mois, avec la matière, la date, l'horaire et le professeur.",
  taches: [
    {
      id: "chercher-absence",
      titre: "Comment retrouver une absence précise ?",
      etapes: [
        "Choisissez l'enfant si vous en avez plusieurs.",
        "Choisissez le mois dans le sélecteur de mois.",
        "Lisez la liste : une carte par absence.",
      ],
    },
  ],
  bonASavoir: [
    "Un mois sans absence affiche le message « Bravo ! ».",
    "Les mois proposés sont ceux de l'année scolaire en cours.",
  ],
}

export const parentScheduleAide: AidePage = {
  id: "parent-schedule",
  espace: ESPACE,
  titre: "Emploi du temps",
  chemins: ["/parent/schedule"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "Cette page montre les cours de la semaine de votre enfant, jour par jour, avec l'horaire, le professeur, la salle et son état de présence.",
  taches: [
    {
      id: "voir-jour",
      titre: "Comment voir les cours d'un jour ?",
      etapes: [
        "Touchez le jour voulu dans la rangée des jours.",
        "Lisez les cours : heure, matière, professeur et salle.",
        "Une pastille indique présent, absent ou à venir.",
      ],
    },
    {
      id: "autre-semaine",
      titre: "Comment voir une autre semaine ?",
      etapes: [
        "Touchez la flèche gauche ou droite à côté des dates.",
        "Vérifiez les dates de la semaine affichée.",
        "Choisissez ensuite le jour.",
      ],
    },
  ],
  bonASavoir: [
    "Le jour d'aujourd'hui est mis en couleur.",
    "Un jour sans cours affiche « Pas de cours ce jour ».",
  ],
}

export const parentGradesAide: AidePage = {
  id: "parent-grades",
  espace: ESPACE,
  titre: "Notes",
  chemins: ["/parent/grades"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "Cette page affiche les résultats validés de votre enfant pour l'année en cours : la conduite et la moyenne de chaque matière, avec le détail des évaluations.",
  taches: [
    {
      id: "voir-resultats",
      titre: "Comment voir les résultats d'une période ?",
      etapes: [
        "Choisissez l'enfant si besoin.",
        "Choisissez la période.",
        "Touchez une matière pour ouvrir le détail de ses évaluations.",
      ],
    },
    {
      id: "ouvrir-bulletin",
      titre: "Comment ouvrir le bulletin ?",
      etapes: [
        "Repérez le bandeau qui annonce que le bulletin est disponible.",
        "Touchez « Consulter le bulletin ».",
        "Choisissez la période et téléchargez le PDF si besoin.",
      ],
    },
  ],
  prerequis: ["Les résultats apparaissent après la saisie complète des notes par le professeur et la validation de la matière."],
  bonASavoir: [
    "« À valider » signale une moyenne que l'école n'a pas encore validée.",
    "Un message signale quand des résultats sont en cours de révision.",
    "La conduite est affichée sur 20, une fois validée.",
  ],
}

export const parentReportCardsAide: AidePage = {
  id: "parent-report-cards",
  espace: ESPACE,
  titre: "Bulletins scolaires",
  chemins: ["/parent/report-cards"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "Cette page rassemble les bulletins officiels publiés pour votre enfant, avec la moyenne générale et le rang. Vous pouvez les télécharger en PDF.",
  taches: [
    {
      id: "telecharger-bulletin",
      titre: "Comment télécharger un bulletin ?",
      etapes: [
        "Choisissez l'enfant et l'année scolaire.",
        "Repérez le bulletin de la période voulue.",
        "Touchez « Télécharger le PDF ».",
      ],
    },
  ],
  prerequis: ["Le bulletin doit être publié par l'école : avant, vous voyez « Aucun bulletin publié »."],
  bonASavoir: [
    "Un bulletin en révision réapparaît après sa nouvelle publication.",
    "Le rang est indiqué sur le nombre d'élèves de la classe.",
  ],
}

export const parentPaymentsAide: AidePage = {
  id: "parent-payments",
  espace: ESPACE,
  titre: "Frais et paiements",
  chemins: ["/parent/payments"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "Cette page montre la situation financière de votre enfant : total des frais, ce qui est versé et ce qui reste à payer, avec l'historique des versements et les reçus.",
  taches: [
    {
      id: "situation",
      titre: "Comment savoir combien il reste à payer ?",
      etapes: [
        "Choisissez l'enfant si besoin.",
        "Lisez les trois montants : total des frais, déjà versé, reste à payer.",
        "Pour verser, présentez-vous à la caisse de l'école ou contactez-la.",
      ],
    },
    {
      id: "recu",
      titre: "Comment obtenir le reçu d'un paiement ?",
      etapes: [
        "Repérez le paiement dans « Historique des paiements ».",
        "Touchez « Télécharger le reçu ».",
        "Attendez la préparation : le fichier s'enregistre ensuite.",
      ],
    },
  ],
  prerequis: ["Une année scolaire doit être active et les frais configurés par l'école, sinon la situation n'est pas disponible."],
  bonASavoir: [
    "Cette page ne permet pas de payer : les versements se font à la caisse de l'école.",
    "Seuls les paiements confirmés ont un reçu. Les paiements annulés restent visibles.",
  ],
}

export const parentNotificationsAide: AidePage = {
  id: "parent-notifications",
  espace: ESPACE,
  titre: "Notifications",
  chemins: ["/parent/notifications"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "Cette page rassemble les relances et informations de l'école qui concernent vos enfants, par exemple un rappel de scolarité.",
  taches: [
    {
      id: "lire-notifications",
      titre: "Comment lire mes notifications ?",
      etapes: [
        "Touchez la cloche en haut de l'écran.",
        "Les nouvelles sont marquées « Nouveau ».",
        "Touchez « Tout marquer comme lu » pour les effacer.",
      ],
    },
  ],
  bonASavoir: [
    "Le badge rouge sur la cloche donne le nombre de notifications non lues.",
    "Une relance de paiement dépend des règles réglées par l'école.",
  ],
}

export const parentAccountAide: AidePage = {
  id: "parent-account",
  espace: ESPACE,
  titre: "Compte",
  chemins: ["/parent/account"],
  roles: ["parent"],
  visite: "parent-portal",
  resume:
    "Cette page garde vos informations, l'état de votre abonnement aux alertes d'absence et votre mot de passe.",
  taches: [
    {
      id: "abonnement",
      titre: "Comment connaître la fin de mon abonnement ?",
      etapes: [
        "Lisez le bloc « Abonnement ».",
        "Il indique le statut, la date de fin et les jours restants.",
        "Pour renouveler, présentez-vous à l'administration de l'école.",
      ],
    },
    {
      id: "mot-de-passe",
      titre: "Comment changer mon mot de passe ?",
      etapes: [
        "Dans « Changer mon mot de passe », saisissez le mot de passe actuel.",
        "Saisissez le nouveau mot de passe, puis confirmez-le.",
        "Enregistrez : « Mot de passe mis à jour » s'affiche.",
      ],
    },
  ],
  bonASavoir: [
    "Le nouveau mot de passe doit comporter au moins 6 caractères et être saisi deux fois à l'identique.",
    "Mot de passe oublié : contactez l'administration de l'école.",
    "Un bandeau vous prévient quand votre abonnement expire bientôt.",
  ],
}

export const parentFirstLoginAide: AidePage = {
  id: "parent-first-login",
  espace: ESPACE,
  titre: "Première connexion",
  chemins: ["/parent/first-login-password"],
  roles: ["parent"],
  resume:
    "À votre première connexion, vous remplacez le mot de passe temporaire reçu de l'école par un mot de passe personnel. Vous ne pouvez rien consulter avant.",
  taches: [
    {
      id: "choisir-mot-de-passe",
      titre: "Comment choisir mon mot de passe ?",
      etapes: [
        "Saisissez le mot de passe temporaire reçu de l'école.",
        "Saisissez le nouveau mot de passe, puis confirmez-le.",
        "Vérifiez les exigences affichées : 8 caractères, une majuscule, un chiffre.",
        "Touchez « Mettre à jour le mot de passe ».",
      ],
    },
  ],
  bonASavoir: [
    "Touchez l'œil pour afficher ou masquer ce que vous tapez.",
    "Notez votre mot de passe en lieu sûr : l'école pourra le réinitialiser en cas d'oubli.",
  ],
}
