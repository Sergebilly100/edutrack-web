import type { AidePage } from "@/shared/aide/aide.types"

export const subscriptionsAide: AidePage = {
  id: "subscriptions",
  espace: "Finance",
  titre: "Abonnements parents",
  chemins: ["/subscriptions"],
  roles: ["director", "staff"],
  requires: ["subscriptions.view"],
  visite: "subscriptions",
  resume:
    "Cette page gère les abonnements des parents aux alertes d'absence en temps réel : créer un abonnement, le renouveler, modifier le contact ou l'annuler.",
  prerequis: [
    "La fonction « Alertes Parents » doit être activée par IvoirEdu, et son tarif défini dans Paramètres. Sinon la page affiche « Fonctionnalité non activée ».",
  ],
  taches: [
    {
      id: "creer-abonnement",
      titre: "Comment créer un abonnement ?",
      etapes: [
        "Cliquez sur « Nouvel abonnement ».",
        "Choisissez le parent, ou créez-le avec son nom et son téléphone.",
        "Choisissez la classe et l'élève, puis la durée.",
        "Choisissez la méthode de paiement : espèces, MTN MoMo ou Orange Money.",
        "Cliquez sur « Créer l'abonnement », puis « Copier les accès » et transmettez-les au parent.",
      ],
      requires: ["subscriptions.create"],
      reserve: "Réservé aux personnes qui peuvent créer des abonnements",
    },
    {
      id: "retrouver-parent",
      titre: "Comment retrouver un parent ?",
      etapes: [
        "Tapez son nom ou son téléphone dans « Retrouver un parent ».",
        "Filtrez par état de l'accès ou par mois de souscription.",
        "Cliquez sur « Voir dossier » pour ouvrir sa fiche.",
      ],
    },
    {
      id: "renouveler",
      titre: "Comment renouveler un abonnement ?",
      etapes: [
        "Repérez le parent dans la liste.",
        "Cliquez sur « Renouveler l'accès ».",
        "Choisissez la durée et confirmez.",
      ],
      requires: ["subscriptions.renew"],
      reserve: "Réservé aux personnes qui peuvent renouveler les abonnements",
    },
    {
      id: "annuler",
      titre: "Comment annuler un abonnement ?",
      etapes: [
        "Ouvrez le menu d'actions du parent.",
        "Choisissez « Annuler l'abonnement ».",
        "Saisissez le motif, obligatoire, puis confirmez.",
      ],
      requires: ["subscriptions.cancel"],
      reserve: "Réservé aux personnes qui peuvent annuler les abonnements",
    },
  ],
  bonASavoir: [
    "Un abonnement n'est annulable que dans les 7 jours suivant la souscription.",
    "L'annulation désactive tout de suite l'accès du parent pour cette souscription.",
    "Le badge de statut indique : actif, expire bientôt ou expiré.",
  ],
}

export const subscriptionRevenueAide: AidePage = {
  id: "subscription-revenue",
  espace: "Finance",
  titre: "Revenus abonnements",
  chemins: ["/subscriptions/revenue"],
  roles: ["director", "staff"],
  requires: ["subscriptions.revenue"],
  visite: "subscription-revenue",
  resume:
    "Cette page suit les revenus des abonnements parents, mois par mois, la commission d'IvoirEdu et les reversements déjà effectués.",
  taches: [
    {
      id: "changer-mois",
      titre: "Comment voir un autre mois ?",
      etapes: [
        "Utilisez les flèches à côté du mois affiché.",
        "Les statistiques, le détail et les reversements se mettent à jour.",
        "Vérifiez le bandeau de commission s'il apparaît.",
      ],
    },
    {
      id: "detail-abonnements",
      titre: "Comment voir le détail des abonnements encaissés ?",
      etapes: [
        "Ouvrez l'onglet « Détail abonnements ».",
        "Lisez le parent, la date d'encaissement, la durée, le montant et le moyen.",
        "Vérifiez le total encaissé en haut de l'onglet.",
      ],
    },
    {
      id: "exporter-bilan",
      titre: "Comment exporter le bilan des reversements ?",
      etapes: [
        "Cliquez sur « Exporter bilan ».",
        "Choisissez le mois de début et le mois de fin.",
        "Lancez l'export.",
      ],
    },
  ],
  bonASavoir: [
    "Un reversement en attente ou en retard est signalé par un bandeau : contactez IvoirEdu pour le régulariser.",
    "L'historique des reversements est enregistré par IvoirEdu après chaque versement.",
  ],
}
