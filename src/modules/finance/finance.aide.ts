import type { AidePage } from "@/shared/aide/aide.types"

const ESPACE = "Finance"

export const financeDashboardAide: AidePage = {
  id: "finance-dashboard",
  espace: ESPACE,
  titre: "Vue financière",
  chemins: ["/finance/dashboard"],
  roles: ["director", "staff"],
  requires: ["payments.view"],
  visite: "finance-dashboard",
  resume:
    "Cette page résume les encaissements de l'année : ce qui devrait déjà être payé, ce qui a été encaissé et ce qui reste dû. Utilisez-la pour savoir où en est l'école et repérer les impayés.",
  prerequis: [
    "Les frais de chaque niveau doivent être configurés dans Paramètres, sinon les montants attendus restent vides ou partiels.",
    "Un message « Certains échéanciers sont absents ou incomplets » signale que les montants affichés sont partiels.",
  ],
  taches: [
    {
      id: "choisir-annee",
      titre: "Comment voir une autre année scolaire ?",
      etapes: [
        "Ouvrez le menu « Année scolaire » en haut de la page.",
        "Choisissez l'année : l'année active porte la mention « Active ».",
        "Les chiffres de la page se mettent à jour.",
      ],
    },
    {
      id: "lire-synthese",
      titre: "Comment savoir ce qu'il reste à encaisser ?",
      etapes: [
        "Lisez le bloc « À ce jour » : attendu, encaissé et impayé à date.",
        "Lisez le bloc « Sur l'année » : total à encaisser et solde restant.",
        "Regardez le taux de recouvrement pour comparer les deux.",
      ],
    },
    {
      id: "voir-impayes",
      titre: "Comment voir quels élèves ont des impayés ?",
      etapes: [
        "Repérez « Ancienneté des impayés ».",
        "Cliquez sur une tranche pour ouvrir la liste des élèves concernés.",
        "Cliquez sur un élève pour ouvrir son détail financier.",
      ],
    },
    {
      id: "recalculer",
      titre: "Comment mettre les chiffres à jour ?",
      etapes: [
        "Cliquez sur « Recalculer les données ».",
        "Attendez la fin du recalcul.",
        "Vérifiez la date indiquée sous le bouton : « Dernier calcul ».",
      ],
    },
    {
      id: "recouvrement-niveau",
      titre: "Comment voir le recouvrement par niveau ou par classe ?",
      etapes: [
        "Repérez le bloc « Recouvrement par niveau ».",
        "Cliquez sur un niveau pour voir ses classes.",
        "Cliquez sur « Voir le recouvrement détaillé » pour la page complète.",
      ],
    },
  ],
  bonASavoir: [
    "Si les chiffres semblent anciens, cliquez sur « Recalculer les données » : ils se calculent à part et ne bougent pas seuls.",
    "« À ce jour » compte seulement les échéances déjà passées ; « Sur l'année » compte tout le plan de paiement.",
    "Cliquez sur « Détail financier » dans « Derniers encaissements » pour ouvrir la fiche de paiement d'un élève.",
  ],
}

export const financeRecoveryAide: AidePage = {
  id: "finance-recovery",
  espace: ESPACE,
  titre: "Recouvrement détaillé",
  chemins: ["/finance/recovery"],
  roles: ["director", "staff"],
  requires: ["payments.view"],
  visite: "finance-recovery",
  resume:
    "Cette page détaille le recouvrement niveau par niveau et classe par classe. Elle vous dit où se concentrent les impayés et quels élèves relancer.",
  prerequis: ["Les frais de chaque niveau doivent être configurés dans Paramètres pour que les montants attendus soient calculés."],
  taches: [
    {
      id: "filtrer-recouvrement",
      titre: "Comment regarder un niveau ou une classe précise ?",
      etapes: [
        "Choisissez l'année scolaire en haut de la page.",
        "Ouvrez le menu « Niveau » puis, si besoin, le menu « Classe ».",
        "Lisez le taux de recouvrement et le reste à collecter.",
      ],
    },
    {
      id: "voir-eleves-a-suivre",
      titre: "Comment voir les élèves à relancer d'une classe ?",
      etapes: [
        "Repérez la classe dans le tableau « Par niveau et par classe ».",
        "Cliquez sur « Voir les élèves » à droite de la ligne.",
        "Cliquez sur un élève pour ouvrir son détail financier.",
      ],
    },
  ],
  bonASavoir: [
    "Le taux compare ce qui est encaissé à ce qui était attendu à la date du jour.",
    "Sans élève confirmé pour la sélection, la page affiche « Aucune inscription confirmée ».",
  ],
}

export const financeEntryAide: AidePage = {
  id: "finance-entry",
  espace: ESPACE,
  titre: "Encaissements",
  chemins: ["/finance/encaissements"],
  roles: ["director", "staff"],
  requires: ["payments.record"],
  visite: "finance-entry",
  resume:
    "Cette page enregistre les versements de la caisse, un par un en saisie rapide ou par import d'un fichier Excel. Chaque paiement génère un reçu.",
  prerequis: [
    "L'élève doit avoir une inscription confirmée, ou une réinscription bloquée par un impayé.",
    "Le plan de frais de son niveau doit être enregistré dans Paramètres.",
  ],
  taches: [
    {
      id: "saisir-paiement",
      titre: "Comment enregistrer un paiement ?",
      etapes: [
        "Ouvrez l'onglet « Enregistrement ».",
        "Recherchez l'élève par son nom ou son matricule.",
        "Saisissez le montant et, si vous l'avez, la référence du reçu de l'école.",
        "Cliquez sur « Enregistrer et continuer » pour passer à la ligne suivante.",
      ],
    },
    {
      id: "saisir-plusieurs",
      titre: "Comment saisir plusieurs paiements à la suite ?",
      etapes: [
        "Choisissez le mode de paiement appliqué aux nouvelles lignes.",
        "Cliquez sur « Ajouter une ligne » pour chaque paiement.",
        "Cliquez sur « Nouvelle session » pour repartir d'un tableau vide.",
      ],
    },
    {
      id: "importer-paiements",
      titre: "Comment importer des paiements depuis Excel ?",
      etapes: [
        "Ouvrez l'onglet « Importer les paiements ».",
        "Choisissez le fichier Excel de la caisse, avec une ligne d'en-têtes.",
        "Associez chaque colonne : matricule, montant, date, référence et mode.",
        "Vérifiez les lignes valides et celles en erreur.",
        "Cliquez sur « Importer » pour enregistrer les paiements valides.",
      ],
    },
  ],
  bonASavoir: [
    "Un paiement enregistré ne se modifie pas : il s'annule depuis « Historique & reçus ».",
    "Pour un élève dont la réinscription est bloquée, le versement va d'abord à l'année de la dette.",
    "Le profil de correspondance des colonnes est mémorisé pour les imports suivants.",
    "Les lignes en erreur de l'import sont ignorées : corrigez-les dans le fichier puis réimportez.",
  ],
}

export const financeHistoryAide: AidePage = {
  id: "finance-history",
  espace: ESPACE,
  titre: "Historique et reçus",
  chemins: ["/finance/history"],
  roles: ["director", "staff"],
  requires: ["payments.view"],
  visite: "finance-history",
  resume:
    "Cette page retrouve tous les paiements enregistrés et leurs reçus. Utilisez-la pour vérifier un versement ou ouvrir le détail financier d'un élève.",
  taches: [
    {
      id: "filtrer-paiements",
      titre: "Comment retrouver un paiement ?",
      etapes: [
        "Choisissez les dates « Du » et « Au ».",
        "Choisissez si besoin un niveau, une classe ou une situation.",
        "Cliquez sur « Détails » sur la ligne du paiement.",
      ],
    },
    {
      id: "voir-detail-eleve",
      titre: "Comment voir le détail financier d'un élève ?",
      etapes: [
        "Cliquez sur « Détails » sur la ligne d'un de ses paiements.",
        "Lisez sa situation à date et la liste de ses paiements.",
        "Cliquez sur le fil d'Ariane « Historique & reçus » pour revenir.",
      ],
    },
  ],
  bonASavoir: [
    "« À jour » ou « En retard » donne la situation actuelle de l'élève, pas celle du jour du paiement.",
    "Un paiement annulé reste visible, avec son motif.",
  ],
}

export const financeHistoryDetailAide: AidePage = {
  id: "finance-history-detail",
  espace: ESPACE,
  titre: "Détail financier d'un élève",
  chemins: ["/finance/history/:studentId"],
  roles: ["director", "staff"],
  requires: ["payments.view"],
  resume:
    "Cette page montre la situation de paiement d'un élève : ce qu'il doit, ce qu'il a payé et chaque versement avec son reçu.",
  taches: [
    {
      id: "telecharger-recu",
      titre: "Comment obtenir le reçu d'un paiement ?",
      etapes: [
        "Repérez le paiement dans la liste.",
        "Cliquez sur « Reçu » sur sa ligne.",
        "Attendez la préparation : le PDF se télécharge ensuite.",
      ],
    },
    {
      id: "enregistrer-paiement",
      titre: "Comment enregistrer un nouveau paiement pour cet élève ?",
      etapes: [
        "Cliquez sur « Enregistrer un paiement ».",
        "L'élève est déjà choisi dans la saisie rapide.",
        "Saisissez le montant et enregistrez.",
      ],
      requires: ["payments.record"],
      reserve: "Réservé aux personnes qui peuvent enregistrer les paiements",
    },
    {
      id: "annuler-paiement",
      titre: "Comment annuler un paiement saisi par erreur ?",
      etapes: [
        "Cliquez sur les trois points à droite du paiement.",
        "Choisissez « Annuler le paiement ».",
        "Saisissez le motif, par exemple « paiement attribué au mauvais élève ».",
        "Cliquez sur « Confirmer l'annulation ».",
      ],
      requires: ["payments.cancel"],
      reserve: "Réservé aux personnes qui peuvent annuler les paiements",
    },
  ],
  bonASavoir: [
    "L'annulation est définitive : le paiement reste visible avec votre justification.",
    "La colonne « Reste après » montre le solde juste après chaque paiement.",
  ],
}

export const financeJournalAide: AidePage = {
  id: "finance-journal",
  espace: ESPACE,
  titre: "Journal de caisse",
  chemins: ["/finance/journal"],
  roles: ["director", "staff"],
  requires: ["payments.view"],
  visite: "finance-journal",
  resume:
    "Le journal liste les paiements d'une période, jour par jour. Il sert à faire le point de la caisse et à exporter les montants.",
  taches: [
    {
      id: "choisir-periode",
      titre: "Comment voir les paiements d'une période ?",
      etapes: [
        "Cliquez sur « Aujourd'hui », « Cette semaine » ou « Ce mois ».",
        "Pour d'autres dates, cliquez sur « Personnalisé » et choisissez « Du » et « Au ».",
        "Lisez le total confirmé et la répartition par mode de paiement.",
      ],
    },
    {
      id: "filtrer-journal",
      titre: "Comment isoler un mode de paiement ou une classe ?",
      etapes: [
        "Ouvrez le menu « Classe », « Mode de paiement » ou « Statut ».",
        "Choisissez la valeur : la liste et les totaux suivent.",
        "Choisissez « Annulés » dans Statut pour voir les paiements annulés.",
      ],
    },
    {
      id: "exporter-journal",
      titre: "Comment exporter le journal ?",
      etapes: [
        "Choisissez la période et les filtres voulus.",
        "Cliquez sur « Exporter ».",
        "Choisissez « Excel » ou « PDF ».",
      ],
    },
  ],
  prerequis: ["L'export doit être autorisé pour votre école : sinon le bouton « Exporter » est grisé."],
  bonASavoir: [
    "Les paiements annulés ne comptent pas dans le « Total confirmé ».",
    "La liste est regroupée par jour, avec le nombre et le total de chaque jour.",
  ],
}

export const financeAgreementsAide: AidePage = {
  id: "finance-agreements",
  espace: ESPACE,
  titre: "Accords & ajustements",
  chemins: ["/finance/agreements"],
  roles: ["director", "staff"],
  requires: ["tuition.view", "tuition.grant_discount", "tuition.manage_student_schedule"],
  visite: "finance-agreements",
  resume:
    "Cette page suit les arrangements individuels : remises sur la scolarité d'un élève et échéanciers négociés. Chaque décision est tracée et ne change pas les montants de référence de l'école.",
  taches: [
    {
      id: "voir-accords",
      titre: "Comment retrouver l'accord d'un élève ?",
      etapes: [
        "Choisissez « Remises et ajustements » ou « Échéanciers négociés ».",
        "Tapez le nom, le matricule, la classe ou le niveau dans la recherche.",
        "Filtrez par statut : actifs, retirés, remplacés.",
        "Cliquez sur « Détail » pour lire l'accord.",
      ],
    },
    {
      id: "nouvel-ajustement",
      titre: "Comment accorder une remise ou un ajustement ?",
      etapes: [
        "Ouvrez « Remises et ajustements ».",
        "Cliquez sur « Nouvel ajustement ».",
        "Choisissez l'élève, le type et le montant en FCFA.",
        "Saisissez le motif obligatoire, puis enregistrez.",
      ],
      requires: ["tuition.grant_discount"],
      reserve: "Réservé aux personnes qui peuvent accorder des remises",
    },
    {
      id: "nouvel-echeancier",
      titre: "Comment négocier un échéancier avec un parent ?",
      etapes: [
        "Ouvrez « Échéanciers négociés ».",
        "Cliquez sur « Nouvel échéancier ».",
        "Choisissez l'élève et planifiez les versements du reste à payer.",
        "Enregistrez avec le motif.",
      ],
      requires: ["tuition.manage_student_schedule"],
      reserve: "Réservé aux personnes qui peuvent négocier des échéanciers",
    },
    {
      id: "modifier-accord",
      titre: "Comment modifier un accord existant ?",
      etapes: [
        "Repérez l'accord dans la liste.",
        "Cliquez sur « Modifier ».",
        "Changez les valeurs et saisissez le motif de la modification.",
        "Enregistrez : le nouvel accord remplace l'ancien, qui reste dans l'historique.",
      ],
      requires: ["tuition.grant_discount", "tuition.manage_student_schedule"],
      reserve: "Réservé aux personnes qui gèrent les accords",
    },
  ],
  bonASavoir: [
    "Un nouvel ajustement remplace l'accord actif sans effacer son historique.",
    "Le motif est obligatoire : il sert de trace en cas de contrôle.",
    "Un échéancier ne planifie que le reste à payer : les paiements déjà confirmés ne changent jamais.",
  ],
}
