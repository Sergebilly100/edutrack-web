import type { AidePage } from "@/shared/aide/aide.types"

export const directorDashboardAide: AidePage = {
  id: "dashboard",
  espace: "Pilotage",
  titre: "Tableau de bord",
  chemins: ["/dashboard"],
  roles: ["director", "staff"],
  visite: "dashboard",
  resume:
    "Le tableau de bord donne l'état de l'école en un coup d'œil : présence des professeurs et des élèves, actions à traiter, performance académique, risques et finances. Il suit toujours l'année scolaire active et la période que vous choisissez.",
  taches: [
    {
      id: "changer-periode",
      titre: "Comment regarder une autre période ?",
      etapes: [
        "Ouvrez le menu « Période » en haut de la page, à gauche de « Actualiser ».",
        "Choisissez la période.",
        "La performance académique et les élèves à suivre se mettent à jour. L'année active est rappelée sous le titre.",
      ],
    },
    {
      id: "traiter-actions",
      titre: "Comment traiter une action prioritaire ?",
      etapes: [
        "Repérez le bloc « Actions prioritaires » : les plus urgentes sont en haut.",
        "Cliquez sur un sujet.",
        "Vous arrivez sur la page où le traiter.",
      ],
    },
    {
      id: "notifications",
      titre: "Comment voir ce qui demande mon attention ?",
      etapes: [
        "Cliquez sur la cloche en haut de la page.",
        "Lisez les notifications : validations en attente, configuration à terminer.",
        "Cliquez sur une notification pour ouvrir la page concernée.",
      ],
    },
    {
      id: "actualiser",
      titre: "Comment mettre les chiffres à jour ?",
      etapes: [
        "Cliquez sur « Actualiser » en haut de la page.",
        "Attendez la fin de la mise à jour.",
        "Lisez l'heure de dernière actualisation à côté du bouton.",
      ],
    },
    {
      id: "voir-risques",
      titre: "Comment voir les élèves et professeurs à suivre ?",
      etapes: [
        "Repérez le bloc « Risques élèves et professeurs ».",
        "Cliquez sur « Voir plus ».",
        "Ouvrez la fiche d'un élève ou d'un professeur pour agir.",
      ],
    },
  ],
  bonASavoir: [
    "Les blocs affichés dépendent de vos droits : le suivi financier demande le droit de consulter les paiements.",
    "La performance académique n'apparaît qu'une fois les moyennes de la période calculées.",
    "Les seuils des risques se règlent dans Paramètres, onglet Risques.",
  ],
}

export const riskDetailsAide: AidePage = {
  id: "risk-details",
  espace: "Pilotage",
  titre: "Élèves et professeurs à suivre",
  chemins: ["/dashboard/risks"],
  roles: ["director", "staff"],
  requires: ["students.view", "teachers.view", "attendance.view"],
  resume:
    "Cette page détaille les signaux d'alerte du tableau de bord : les élèves et les professeurs à suivre, avec leur catégorie de risque et leur priorité.",
  taches: [
    {
      id: "lire-signaux",
      titre: "Comment lire la liste des élèves à suivre ?",
      etapes: [
        "Ouvrez l'onglet « Élèves ».",
        "Filtrez par niveau, classe, catégorie de risque ou priorité.",
        "Lisez la catégorie et la priorité de chaque élève.",
        "Ouvrez sa fiche pour agir.",
      ],
    },
    {
      id: "profs-a-suivre",
      titre: "Comment voir les professeurs à suivre ?",
      etapes: [
        "Ouvrez l'onglet « Professeurs ».",
        "Choisissez le mois.",
        "Lisez les absences répétées, les retards et le motif.",
        "Ouvrez la fiche du professeur concerné.",
      ],
    },
  ],
  prerequis: ["Les signaux dépendent des règles de risque : réglez-les dans Paramètres, onglet Risques."],
  bonASavoir: [
    "Une baisse de moyenne n'est retenue que si la période et la précédente sont clôturées.",
    "Les signaux sont recalculés au plus tard toutes les 15 minutes.",
  ],
}
