import type { Step } from "react-joyride"

export const dashboardTourSteps: Step[] = [
  {
    target: "[data-tour='dashboard-stats']",
    title: "Vue d'ensemble",
    content: "Ces indicateurs vous donnent une vue instantanée sur vos professeurs, absences du jour et couverture des cours.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='dashboard-tabs']",
    title: "Navigation par onglets",
    content: "Basculez entre Vue d'ensemble, Présences et Salaires. Chaque onglet ne charge que ce dont vous avez besoin.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-tab-attendance']",
    title: "Onglet Présences",
    content: "Retrouvez ici les présences du jour, les professeurs à risque et les absences d'élèves.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-tab-salaries']",
    title: "Onglet Salaires",
    content: "Consultez le récapitulatif des salaires du mois et les paiements en attente.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-alerts']",
    title: "Alertes & notifications",
    content: "Ce bouton centralise toutes les alertes actives : absences élevées, validations en attente, salaires à traiter. Le badge rouge indique le nombre d'actions urgentes.",
    placement: "bottom-end",
    skipBeacon: true,
  },
]

export const validationsTourSteps: Step[] = [
  {
    target: "[data-tour='validations-tabs']",
    title: "Onglets de validation",
    content: "Trois catégories à traiter : heures courtes (cours trop courts), scan de fin manquant et présences GPS hors périmètre. Chaque onglet affiche le nombre de cas en attente.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='validations-short-hours']",
    title: "Heures à valider",
    content: "Ces cours ont été scannés moins longtemps que prévu. Pour chaque présence vous choisissez : accorder les heures planifiées ou les heures réellement effectuées. Le salaire est recalculé automatiquement.",
    placement: "bottom",
  },
  {
    // Colonne checkbox du tableau desktop — rendu quand l'onglet "hours" est actif (defaultValue)
    target: "[data-tour='validations-bulk-checkbox']",
    title: "Validation groupée",
    content: "Cochez plusieurs présences d'un coup avec cette case à cocher, puis utilisez la barre flottante qui apparaît en bas pour tout valider en une seule action.",
    placement: "right",
  },
]
