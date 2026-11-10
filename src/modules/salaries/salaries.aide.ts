import type { AidePage } from "@/shared/aide/aide.types"

export const salariesAide: AidePage = {
  id: "salaries",
  espace: "Gestion de l'école",
  titre: "Salaires des professeurs",
  chemins: ["/salaries"],
  roles: ["director", "staff"],
  requires: ["salary.view"],
  visite: "salaries",
  resume:
    "Cette page prépare la paie du mois : vous calculez les salaires à partir des présences validées, puis vous marquez chaque fiche comme payée. Les vacataires sont payés à l'heure, les permanents au salaire fixe.",
  taches: [
    {
      id: "calculer-mois",
      titre: "Comment calculer les salaires d'un mois ?",
      etapes: [
        "Choisissez le mois avec les flèches ou le menu.",
        "Si un message signale des présences à valider, cliquez sur « Valider maintenant » et traitez-les d'abord.",
        "Cliquez sur « Calculer les salaires ».",
        "Confirmez : les fiches et les cartes de synthèse se mettent à jour.",
      ],
      requires: ["salary.compute"],
      reserve: "Réservé aux personnes qui peuvent calculer les salaires",
    },
    {
      id: "marquer-paye",
      titre: "Comment marquer un salaire comme payé ?",
      etapes: [
        "Repérez le professeur dans la liste des vacataires ou des permanents.",
        "Cliquez sur « Marquer payé » sur sa ligne.",
        "Vérifiez le montant dans la fenêtre, puis confirmez.",
      ],
      requires: ["salary.mark_paid"],
      reserve: "Réservé aux personnes qui peuvent marquer les paiements",
    },
    {
      id: "payer-plusieurs",
      titre: "Comment payer plusieurs professeurs d'un coup ?",
      etapes: [
        "Cochez les lignes à payer, ou la case « Tout sélectionner ».",
        "Cliquez sur « Marquer payés » dans la barre qui apparaît.",
        "Vérifiez le total, puis confirmez.",
      ],
      requires: ["salary.mark_paid"],
      reserve: "Réservé aux personnes qui peuvent marquer les paiements",
    },
    {
      id: "voir-detail",
      titre: "Comment voir le détail ou l'historique d'un salaire ?",
      etapes: [
        "Repérez le professeur dans la liste.",
        "Cliquez sur « Détails » pour voir le calcul.",
        "Cliquez sur « Historique » pour voir les paiements passés.",
      ],
    },
    {
      id: "exporter-bilan",
      titre: "Comment sortir le bilan du mois en PDF ?",
      etapes: [
        "Cliquez sur « Export bilan PDF ».",
        "Choisissez la période et ce que vous voulez exporter.",
        "Lancez l'export, puis téléchargez le fichier.",
      ],
      requires: ["salary.export"],
      reserve: "Réservé aux personnes qui peuvent exporter les salaires",
    },
  ],
  bonASavoir: [
    "Les mois à venir sont fermés : les présences n'y sont pas encore enregistrées.",
    "Relancez le calcul après toute présence modifiée ou validée, sinon les montants sont périmés.",
    "Une fiche grisée signifie qu'il n'y a rien à payer ce mois-ci.",
    "Une fois payé, un salaire apparaît dans l'historique du professeur.",
  ],
}
