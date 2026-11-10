import type { Step } from "react-joyride"

import type { AideStep } from "@/shared/aide/aide.types"

export const dashboardTourSteps: AideStep[] = [
  {
    target: "[data-tour='dashboard-context']",
    title: "Période",
    content: "Le tableau de bord suit l'année scolaire active (rappelée sous le titre). Choisissez ici la période à regarder : la performance académique et les élèves à suivre suivent ce choix.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='dashboard-alerts']",
    title: "Notifications",
    content: "Cette cloche rassemble ce qui demande votre attention : validations en attente, configuration à terminer. Le badge rouge donne le nombre d'éléments.",
    placement: "bottom-end",
  },
  {
    target: "[data-tour='dashboard-refresh']",
    title: "Actualiser les données",
    content: "Cliquez ici pour mettre à jour tous les chiffres, par exemple après avoir validé des présences. L'heure de la dernière mise à jour s'affiche à côté.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-stats']",
    title: "Les quatre chiffres du jour",
    content: "Présence des professeurs, présence des élèves, nombre d'élèves confirmés et nombre de professeurs. Cliquez sur une carte pour ouvrir la page détaillée correspondante.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-chart']",
    title: "Présence des professeurs sur 7 jours",
    content: "Ce graphique empile, pour chacun des 7 derniers jours, les cours où le professeur était présent, en retard ou absent. Il sert à repérer une baisse de présence avant qu'elle ne s'installe.",
    placement: "top",
  },
  {
    target: "[data-tour='dashboard-priorities']",
    title: "Actions prioritaires",
    content: "Cette liste classe les situations qui attendent votre décision, les plus urgentes d'abord. Cliquez sur un sujet pour ouvrir la page où le traiter.",
    placement: "left",
  },
  {
    target: "[data-tour='dashboard-academic']",
    title: "Performance académique",
    content: "Les moyennes générales de la période, niveau par niveau, avec le nombre d'élèves notés. Elles n'apparaissent qu'une fois les moyennes calculées. « Détails » ouvre le suivi des évaluations.",
    placement: "top",
  },
  {
    target: "[data-tour='dashboard-risks']",
    title: "Risques élèves et professeurs",
    content: "Ces compteurs viennent des règles d'alerte réglées dans Paramètres, onglet Risques. « Voir plus » ouvre la liste des élèves ou des professeurs concernés.",
    placement: "left",
  },
  {
    target: "[data-tour='dashboard-today']",
    title: "Les cours d'aujourd'hui",
    content: "Chaque cours du jour avec son heure, son professeur, sa matière, sa classe et son statut. « Analyser » ouvre l'analyse de présence des professeurs.",
    placement: "top",
    requires: ["attendance.view"],
  },
  {
    target: "[data-tour='dashboard-finance']",
    title: "Suivi financier",
    content: "Un résumé de l'encaissement : taux de recouvrement et impayés à date, niveau par niveau. Ce sont les mêmes chiffres que la Vue financière, dont « Voir tout » ouvre le détail.",
    placement: "left",
    requires: ["payments.view"],
  },
]

export const scheduleTourSteps: Step[] = [
  {
    target: "[data-tour='schedule-import-btn']",
    title: "Importer l'EDT",
    content: "Ce bouton ouvre l'import de l'emploi du temps depuis un fichier Excel. C'est le moyen le plus rapide de poser tous les créneaux d'un coup.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='schedule-add-btn']",
    title: "Ajouter un créneau",
    content: "Ce bouton ouvre le formulaire pour créer un créneau : professeur, matière, classe, salle, jour et horaire. Il est grisé s'il n'y a pas de période active sur la semaine affichée.",
    placement: "bottom",
  },
  {
    target: "[data-tour='schedule-coverage']",
    title: "Semaine prochaine non configurée",
    content: "Ce bandeau apparaît quand l'emploi du temps de la semaine prochaine est vide. Cliquez sur « Procéder à l'importation » pour le charger avant que les cours commencent.",
    placement: "bottom",
  },
  {
    target: "[data-tour='schedule-week-nav']",
    title: "Changer de semaine",
    content: "Les flèches passent à la semaine précédente ou suivante. « Aujourd'hui » ramène à la semaine en cours. La plage de dates affichée indique la semaine regardée.",
    placement: "bottom",
  },
  {
    target: "[data-tour='schedule-view-toggle']",
    title: "Grille ou liste",
    content: "« Grille » montre la semaine comme un tableau d'heures et de jours, pratique pour voir les trous. « Liste » regroupe les créneaux par ligne horaire, plus lisible sur un petit écran.",
    placement: "bottom",
  },
  {
    target: "[data-tour='schedule-filters']",
    title: "Filtrer par niveau, classe ou professeur",
    content: "Les trois menus réduisent l'emploi du temps à un niveau, une classe ou un professeur. Un bouton apparaît pour chaque filtre actif : cliquez dessus pour l'effacer.",
    placement: "bottom",
  },
  {
    target: "[data-tour='schedule-grid']",
    title: "Voir, modifier ou supprimer un créneau",
    content: "Cliquez sur un créneau pour voir son détail, puis sur « Modifier » ou « Supprimer ». Pour un cours qui revient chaque semaine, choisissez s'il s'agit de cette occurrence, des suivantes ou de toutes. Dans la grille, une case vide permet d'ajouter un créneau directement.",
    placement: "top",
  },
]

export const teachersTourSteps: AideStep[] = [
  {
    target: "[data-tour='teachers-actions']",
    title: "Exporter, envoyer les accès, ajouter",
    content: "« Exporter » sort la liste en Excel. « Envoyer les identifiants » envoie un mot de passe temporaire par e-mail à tous les profs qui n'ont jamais reçu leurs accès. « Ajouter un prof » ouvre le formulaire de création.",
    placement: "left",
  },
  {
    target: "[data-tour='teachers-tablist']",
    title: "Les onglets",
    content: "« Liste » affiche tous vos professeurs. « Analyse présence » donne des statistiques de présence sur une période choisie. « Classement » donne un score de conformité mensuel à chaque professeur. La visite présente l'onglet ouvert : changez d'onglet puis relancez-la.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teachers-overview']",
    title: "La vue d'ensemble",
    content: "Ces pastilles comptent les professeurs visibles, les vacataires (payés à l'heure) et les permanents (salaire fixe). Le dernier indicateur dit si un filtre est actif.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teachers-filters']",
    title: "Filtres - affiner la liste",
    content: "Ces trois menus déroulants sont des filtres. Sélectionnez un type (vacataire ou permanent), un statut (actif ou bloqué) ou une matière pour réduire la liste. Les filtres se cumulent.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teachers-table']",
    title: "La liste des professeurs",
    content: "Une ligne par professeur : nom, matières, type et statut (actif ou bloqué). Tapez un nom dans la recherche, ou cliquez sur une ligne pour ouvrir sa fiche. Sur téléphone, chaque professeur est une carte à toucher.",
    placement: "top",
  },
  {
    target: "[data-tour='teachers-analysis-filters']",
    title: "Choisir la période à analyser",
    content: "Choisissez les dates « Du » et « Au », puis affinez par statut (absences, salle incorrecte, pointage manquant), professeur, matière ou classe. Cliquez sur « Analyser » pour lancer.",
    placement: "bottom",
    requires: ["teachers.attendance.view", "attendance.view"],
  },
  {
    target: "[data-tour='teachers-analysis-results']",
    title: "Le résultat par professeur",
    content: "Pour chaque professeur : taux de présence, présences sur cours prévus, heures, retards, salle incorrecte et pointage des élèves. Un taux sous 80 % est signalé.",
    placement: "top",
    requires: ["teachers.attendance.view", "attendance.view"],
  },
  {
    target: "[data-tour='teachers-ranking-header']",
    title: "Le classement du mois",
    content: "Choisissez le mois et la matière : les professeurs sont classés selon leur conformité. Les trois chiffres donnent le nombre de professeurs classés, le meilleur taux et la moyenne.",
    placement: "bottom",
    requires: ["teachers.ranking.view"],
  },
]

export const teacherDetailTourSteps: AideStep[] = [
  {
    target: "[data-tour='teacher-detail-salary']",
    title: "Synthèse du mois en cours",
    content: "Ce bloc affiche pour le mois actuel : les heures prévues à l'EDT, les heures effectivement pointées, les heures d'absence, les heures restantes à faire et le statut du salaire (en attente, payé…). C'est une vue rapide avant d'aller dans le détail. NB: HAV = Heures à valider (présences pointées mais non validées par la direction).",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='teacher-detail-profile']",
    title: "Carte profil",
    content: "Les informations essentielles du prof : nom, matières, type de contrat (vacataire = payé à l'heure ; permanent = salaire fixe mensuel), statut et taux. Le bouton « Bloquer » coupe immédiatement son accès à l'application de pointage ; « Débloquer » le rétablit.",
    placement: "right",
  },
  {
    target: "[data-tour='teacher-detail-weekly-schedule']",
    title: "EDT de la semaine",
    content: "Ce bloc affiche les créneaux de cours de ce professeur pour aujourd'hui et demain. Cliquez sur « Voir EDT semaine complète » pour afficher tous les jours. Si aucun créneau n'apparaît, le prof n'a pas été affecté à des cours dans l'emploi du temps.",
    placement: "top",
  },
  {
    target: "[data-tour='teacher-detail-tabs']",
    title: "Les onglets de la fiche",
    content: "« Présences » donne l'historique des séances. « Documents » sert aux pièces RH du professeur, si vous y avez droit. « Infos » sert à modifier ses coordonnées et son compte. La visite présente l'onglet ouvert : changez d'onglet puis relancez-la.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-detail-month']",
    title: "Choisir le mois analysé",
    content: "Changez le mois pour revoir l'historique d'un mois passé. Le calendrier et le tableau en dessous suivent ce choix.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-detail-month-summary']",
    title: "Les heures du mois",
    content: "Quatre cartes pour le mois choisi : les heures prévues à l'EDT, les heures faites (hors heures encore à valider), les heures d'absence et les heures restantes à faire.",
    placement: "right",
  },
  {
    target: "[data-tour='teacher-detail-heatmap']",
    title: "Le calendrier de présence",
    content: "Une vue du mois en un coup d'œil : chaque jour est coloré selon que le professeur était présent, en retard, absent ou non marqué. Repérez les jours à problème avant d'ouvrir le détail.",
    placement: "left",
  },
  {
    target: "[data-tour='teacher-detail-presence-table']",
    title: "Détail des présences",
    content: "Une ligne par séance : date, créneau, matière, classe, statut, minutes de retard, heures d'entrée et de sortie, salle correcte ou incorrecte, et pointage des élèves effectué ou manquant.",
    placement: "top",
  },
  {
    target: "[data-tour='teacher-detail-docs-upload']",
    title: "Ajouter un document",
    content: "Déposez un fichier ou cliquez pour le choisir. Il apparaît ensuite dans la liste « Documents » juste en dessous.",
    placement: "top",
    requires: ["teachers.documents"],
  },
  {
    target: "[data-tour='teacher-detail-infos-form']",
    title: "Informations du professeur",
    content: "Cliquez sur « Enregistrer » pour valider vos changements. Seuls les profils qui peuvent modifier les professeurs peuvent le faire.",
    placement: "top",
  },
  {
    target: "[data-tour='teacher-detail-account']",
    title: "Compte du professeur",
    content: "« Réinitialiser le mot de passe » génère un mot de passe temporaire et l'envoie par e-mail. Sans e-mail renseigné, il s'affiche à l'écran. Le professeur devra le changer à sa prochaine connexion.",
    placement: "top",
    requires: ["teachers.password.reset"],
  },
]

export const studentsTourSteps: AideStep[] = [
  {
    target: "[data-tour='students-dossiers-btn']",
    title: "Tous les dossiers élèves",
    content: "Ce bouton ouvre la recherche de tous les élèves de l'école, même ceux sans inscription cette année. Utilisez-le pour retrouver un ancien élève.",
    placement: "bottom",
    requires: ["students.view"],
  },
  {
    target: "[data-tour='students-tablist']",
    title: "Deux onglets",
    content: "« Liste » affiche tous vos élèves confirmés, avec leurs absences du mois. « Absences » groupe les absences par élève sur une période choisie, du plus au moins absent. La visite présente l'onglet ouvert : changez d'onglet puis relancez-la pour voir l'autre.",
    placement: "bottom",
  },
  {
    target: "[data-tour='students-overview']",
    title: "La vue d'ensemble",
    content: "Ces pastilles comptent les élèves confirmés, actifs, inactifs et ceux à surveiller pour leurs absences. En dessous : le nombre de classes affichées, d'élèves dont un parent a un téléphone, et l'état du filtre.",
    placement: "bottom",
  },
  {
    target: "[data-tour='students-filters']",
    title: "Filtres - trouver un élève",
    content: "Les menus filtrent par niveau, par classe et par statut (actif ou inactif). La zone de recherche retrouve un élève par son nom. Ces filtres se combinent.",
    placement: "bottom",
  },
  {
    target: "[data-tour='students-table']",
    title: "La liste des élèves",
    content: "Chaque ligne affiche l'élève, sa classe, son statut et ses absences du mois. Cliquez sur une ligne pour ouvrir sa fiche. Sur téléphone, la liste devient une suite de cartes à toucher.",
    placement: "top",
  },
  {
    target: "[data-tour='students-absences-filters']",
    title: "Choisir la période d'absences",
    content: "Choisissez les dates « Du » et « Au », puis affinez par niveau, classe, matière, état du message SMS ou nombre minimum d'absences. Cliquez sur « Analyser » pour lancer.",
    placement: "bottom",
    requires: ["attendance.view"],
  },
  {
    target: "[data-tour='students-absences-results']",
    title: "Le résultat par élève",
    content: "Les élèves les plus absents sont en haut, avec leur nombre d'absences, leur taux d'absence, le contact du parent et l'état du SMS envoyé. Cliquez sur un élève pour voir le détail de ses absences.",
    placement: "top",
    requires: ["attendance.view"],
  },
]

export const studentDetailTourSteps: AideStep[] = [
  {
    target: "[data-tour='student-detail-profile']",
    title: "Fiche identité",
    content: "Résumé de l'élève : nom, classe, matricule, date et lieu de naissance, sexe et nationalité. Les badges indiquent si l'élève est actif et s'il est à risque ce mois-ci (rouge = plus de 3 absences = suivi renforcé recommandé).",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='student-detail-year']",
    title: "Choisir une année passée",
    content: "Dans l'historique scolaire (bouton « Historique scolaire » en haut), ce menu choisit l'année consultée. La page passe en lecture seule : on consulte, on ne modifie pas.",
    placement: "bottom",
  },
  {
    target: "[data-tour='student-detail-finance']",
    title: "Situation financière",
    content: "Cette bande est verte si les échéances sont à jour, rouge si elles sont en retard. Elle donne le reste total à régler, les paiements confirmés et les remises accordées. Elle apparaît seulement pour les profils qui peuvent consulter la finance.",
    placement: "top",
    requires: ["tuition.view", "payments.view", "payments.record"],
  },
  {
    target: "[data-tour='student-detail-tabs']",
    title: "Les onglets du dossier",
    content: "Selon vos droits : « Absences », « Fil d'activité » (la chronologie du dossier), « Dossier » (les pièces), « Bulletins », « Résultats », « Paiements », « Infos Parents » (contacts pour les alertes SMS) et « Notifications Parents » (messages envoyés, à renvoyer en cas d'échec).",
    placement: "bottom",
  },
  {
    target: "[data-tour='student-detail-absences']",
    title: "Statistiques d'absences",
    content: "Ces cartes résument les absences depuis l'inscription, ce mois-ci et cette semaine, avec une estimation de présence sur le mois. C'est ici que vous voyez rapidement si un élève décroche.",
    placement: "bottom",
    requires: ["attendance.view"],
  },
  {
    target: "[data-tour='student-detail-absence-filters']",
    title: "Filtrer les absences",
    content: "Choisissez un mois, une matière ou un statut pour ne garder que les absences voulues, sans quitter le dossier.",
    placement: "bottom",
    requires: ["attendance.view"],
  },
]

export const salariesTourSteps: AideStep[] = [
  {
    target: "[data-tour='salaries-month']",
    title: "Choisir le mois",
    content: "Utilisez les flèches ◀ ▶ ou le menu déroulant pour changer de mois. Vous ne pouvez consulter que les mois passés ou en cours - les mois futurs sont verrouillés car les présences ne sont pas encore enregistrées.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='salaries-compute']",
    title: "Calculer les salaires",
    content: "Appuyez ici pour lancer le calcul du mois sélectionné. Le système lit toutes les présences validées et génère les fiches de paie. À relancer chaque fois qu'une présence est modifiée ou validée pour que les montants soient à jour. La date du dernier calcul s'affiche en dessous du bouton.",
    placement: "bottom",
  },
  {
    target: "[data-tour='salaries-export']",
    title: "Exporter le bilan PDF",
    content: "Ce bouton génère un PDF récapitulatif de tous les salaires du mois : vacataires et permanents. Pratique pour conserver une trace ou partager le bilan avec la comptabilité.",
    placement: "bottom",
  },
  {
    target: "[data-tour='salaries-stats']",
    title: "Cartes de synthèse",
    content: "Ces cartes résument la situation financière du mois : montant total à payer aux professeurs, montant total payé ce mois, montant d'économie et taux de présence des profs. Elles se mettent à jour après chaque calcul.",
    placement: "bottom",
  },
  {
    target: "[data-tour='salaries-hav']",
    title: "Présences à valider (HAV)",
    content: "Ce bandeau signale des présences pas encore validées. Tant qu'elles ne le sont pas, ces heures ne comptent pas dans les salaires. Cliquez sur « Valider maintenant » avant de calculer le mois.",
    placement: "bottom",
    requires: ["validations.view"],
  },
  {
    target: "[data-tour='salaries-stale']",
    title: "Fiches à recalculer",
    content: "Quand une présence a changé après le dernier calcul, ce bandeau compte les fiches périmées. Cliquez sur « Recalculer maintenant » pour mettre les montants à jour.",
    placement: "bottom",
    requires: ["salary.compute"],
  },
  {
    target: "[data-tour='salaries-filtre']",
    title: "Filtre des fiches de paie",
    content: "Filtrez la liste des fiches de paie par professeur, par statut (payé/en attente) ou par type de contrat (vacataire/permanent). Combinez les filtres pour retrouver rapidement la fiche que vous cherchez.",
    placement: "bottom",
  },
  {
    target: "[data-tour='salaries-vacataire-section']",
    title: "Section Vacataires",
    content: "Les vacataires sont payés à l'heure : montant = heures pointées × taux horaire. Cochez les cases à gauche pour sélectionner plusieurs fiches, puis cliquez sur le bouton vert qui apparaît en bas pour tout marquer payé en une seule action.",
    placement: "bottom",
  },
  {
    target: "[data-tour='salaries-total-col']",
    title: "Total hors HAV",
    content: "Le montant calculé sans les heures encore à valider. Une fois ces heures validées et le mois recalculé, le total augmente.",
    placement: "bottom",
  },
  {
    target: "[data-tour='salaries-actions-col']",
    title: "Détails, historique et paiement",
    content: "« Détails » montre le calcul de la fiche. « Historique » liste les paiements déjà faits. « Marquer payé » enregistre un paiement : vérifiez le montant dans la fenêtre avant de confirmer.",
    placement: "left",
  },
  {
    target: "[data-tour='salaries-fixed-section']",
    title: "Section Permanents (salaire fixe)",
    content: "Les permanents ont un salaire mensuel fixe. Cliquez sur \"Marquer payé\" sur chaque ligne ou cochez plusieurs lignes pour un paiement groupé. Une fiche grisée signifie qu'il n'y a rien à payer ce mois-ci (aucun cours planifié).",
    placement: "bottom",
  },
]

export const validationsTourSteps: Step[] = [
  {
    target: "[data-tour='validations-tabs']",
    title: "Trois sortes de cas à traiter",
    content: "« Heures à valider » : cours terminés plus tôt que prévu (il faut que « Heures réelles » soit activé par IvoirEdu). « Scan de fin » : professeurs qui n'ont pas scanné la fin du cours. « Présences suspectes » : pointages faits loin de la salle. Le chiffre entre parenthèses donne le nombre de cas.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='validations-hours-info']",
    title: "Heures à valider : le principe",
    content: "Ces professeurs ont terminé leur cours avant l'heure prévue. Pour chacun, choisissez « Accorder le prévu » (la durée complète du créneau) ou « Accorder l'effectué » (la durée réellement passée en classe). Le salaire du vacataire est recalculé.",
    placement: "bottom",
  },
  {
    target: "[data-tour='validations-search']",
    title: "Retrouver un professeur",
    content: "Tapez un nom pour ne garder que ses cours à valider.",
    placement: "bottom",
  },
  {
    target: "[data-tour='validations-bulk-checkbox']",
    title: "Validation groupée",
    content: "Cochez plusieurs présences d'un coup avec cette case à cocher, puis utilisez la barre flottante qui apparaît en bas pour tout valider en une seule action. La même décision s'applique à toutes les lignes cochées.",
    placement: "right",
  },
  {
    target: "[data-tour='validations-endscan-info']",
    title: "Scan de fin : le principe",
    content: "Ces professeurs ont pointé leur arrivée mais pas la fin du cours. « Tolérer avec avertissement » envoie un message au professeur sans retirer le cours. « Sanctionner » ne comptabilise pas le cours et le professeur doit se justifier à l'administration.",
    placement: "bottom",
  },
  {
    target: "[data-tour='validations-endscan-filters']",
    title: "Filtrer les scans de fin",
    content: "Filtrez par mois et par statut : en attente, averti, sanctionné ou sanction annulée. « Annuler la sanction » reste possible sur un cours sanctionné.",
    placement: "bottom",
  },
  {
    target: "[data-tour='validations-gps-info']",
    title: "Présences suspectes : le principe",
    content: "Ces professeurs ont scanné hors du périmètre de la salle. Regardez la colonne « Écart GPS » et vérifiez avec eux, puis « Valider » ou « Marquer absent » avec le motif du refus.",
    placement: "bottom",
  },
]

export const historicalStudentsImportTourSteps: Step[] = [
  {
    target: "[data-tour='import-header']",
    title: "Préparer les profils historiques",
    content: "Importez les élèves déjà connus et leurs contacts parents. Leur année et leur ancienne classe restent des références historiques. Vous les inscrirez plus tard, lors de l’ouverture des classes. Cet import ne crée ni inscription, paiement, dossier financier ni document.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='historical-students-file']",
    title: "Analyser et associer les colonnes",
    content: "Renseignez l’année historique puis glissez votre fichier Excel dans cette zone, ou utilisez Parcourir. Le modèle élèves habituel conserve les contacts des deux parents. Seuls le nom et le prénom sont requis ; le matricule aide à retrouver les profils. Enregistrez les correspondances, vérifiez l’aperçu et les erreurs par ligne, puis importez les profils valides. Les profils déjà présents avec la même identité sont conservés.",
    placement: "top",
  },
]

export const importTourSteps: Step[] = [
  {
    target: "[data-tour='import-header']",
    title: "Import de données - zone critique",
    content: "Sur cette page, vous importez l'emploi du temps depuis un fichier Excel et vous consultez les imports déjà faits. Vous y arrivez par « Importer l'EDT » sur la page Emploi du temps ; « Retour à l'EDT » vous y ramène. Pendant la configuration initiale, elle sert aussi à préparer les profils professeurs.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='import-wizard-tab']",
    title: "Étape 1 - Choisir le type",
    content: "Le type disponible dépend du contexte : profils professeurs pendant l’initialisation, emploi du temps sur la page ordinaire.",
    placement: "top",
  },
  {
    target: "[data-tour='import-wizard-file']",
    title: "Étape 2 - Télécharger le modèle",
    content: "Téléchargez le fichier modèle Excel (.xlsx) fourni et remplissez-le avec vos données. Respectez exactement les colonnes du modèle - une colonne manquante ou renommée bloque l'import. N'oubliez pas de supprimer les lignes d'exemple avant de réimporter votre fichier complété.",
    placement: "top",
  },
  {
    target: "[data-tour='import-mode']",
    title: "Étape 3 - Mode fusion ou remplacement",
    content: "Avant d'importer le fichier, choisissez le mode :\n• Fusion : ajoute les nouvelles données et met à jour les existantes, sans désactiver celles absentes du fichier.\n• Remplacement : ajoute, met à jour, puis désactive tout ce qui est absent du fichier. Vérifiez le fichier avec soin avant de confirmer.",
    placement: "top",
  },
  {
    target: "[data-tour='import-periode-edt']",
    title: "Étape 3 - période de validité de l'EDT",
    content: "Pour l'emploi du temps, choisissez la période d'application : un lundi de début et un dimanche de fin, en semaines complètes. Elle détermine quand les créneaux sont actifs. Si des semaines ont déjà un emploi du temps, l'écran vous demande de confirmer le remplacement.",
    placement: "top",
  },
  {
    target: "[data-tour='import-validation']",
    title: "Étape 4 - Validation avant confirmation",
    content: "Après upload, le système analyse votre fichier ligne par ligne et liste les erreurs détectées (doublon, champ manquant, format incorrect…). Corrigez votre fichier Excel et re-uploadez-le si des erreurs bloquantes apparaissent. Aucune donnée n'est enregistrée tant que vous n'avez pas cliqué sur « Importer ».",
    placement: "top",
  },
  {
    target: "[data-tour='import-history']",
    title: "Historique des imports",
    content: "Tous les imports confirmés sont enregistrés ici : date, auteur, type, nombre de lignes importées et mises à jour. Utilisez les filtres mois/type pour retrouver un import passé. En cas d'erreur après confirmation, contactez IvoirEdu.",
    placement: "top",
  },
]

export const roomsTourSteps: Step[] = [
  {
    target: "[data-tour='rooms-header']",
    title: "Salles & QR Codes",
    content: "Cette page centralise la gestion des salles de classe. Chaque salle a un QR code unique que les professeurs scannent pour pointer leur présence. Sans salle assignée à un créneau, le pointage par QR n'est pas possible.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='rooms-add-btn']",
    title: "Ajouter une salle",
    content: "Ce bouton ouvre le formulaire de création. Renseignez le nom de la salle, le bâtiment (facultatif), la capacité et les coordonnées GPS si vous activez la vérification de géolocalisation. Le rayon GPS définit la distance maximale tolérée pour un pointage valide (100m par défaut).",
    placement: "left",
  },
  {
    target: "[data-tour='rooms-table']",
    title: "La liste des salles",
    content: "Une ligne par salle, avec son bâtiment et sa capacité. Si la liste est longue, elle est découpée en pages.",
    placement: "top",
  },
  {
    target: "[data-tour='rooms-gps-col']",
    title: "La colonne GPS",
    content: "Elle montre les coordonnées de la salle. « GPS non configuré » signifie que le lieu du scan n'est pas contrôlé pour cette salle. Sinon, un scan trop éloigné arrive dans les présences suspectes des Validations.",
    placement: "bottom",
  },
  {
    target: "[data-tour='rooms-edt-col']",
    title: "EDT par semaine",
    content: "Nombre de cours prévus chaque semaine dans cette salle. Une salle à 0 n'est utilisée par aucun créneau de l'emploi du temps.",
    placement: "bottom",
  },
  {
    target: "[data-tour='rooms-scans-col']",
    title: "Le nombre de scans",
    content: "Nombre de fois où le QR code de la salle a été scanné. Un nombre très élevé est le signal pour régénérer le code.",
    placement: "bottom",
  },
  {
    target: "[data-tour='rooms-actions']",
    title: "Les actions d'une salle",
    content: "« QR » affiche le code à imprimer ou télécharger. « Régénérer » crée un nouveau code et rend l'ancien inutilisable : réimprimez-le. « Modifier » change les informations. « Supprimer » retire la salle. Affichez les QR dans les salles pour que les professeurs puissent les scanner.",
    placement: "left",
  },
]

export const subscriptionsTourSteps: Step[] = [
  {
    target: "[data-tour='subscriptions-filters']",
    title: "Filtres de recherche",
    content: "Ces champs vous permettent de filtrer la liste : par statut (actif, expiré, annulé), par mois de souscription, par responsable ou par nom du parent. Combinez-les pour retrouver n'importe quel dossier.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='subscriptions-stats']",
    title: "Indicateurs clés du mois",
    content: "Ces cartes récapitulent la situation : abonnements actifs en ce moment, total de parents inscrits, mois affiché et nombre de nouveaux abonnements créés ce mois-ci.",
    placement: "bottom",
  },
  {
    target: "[data-tour='subscriptions-table']",
    title: "Liste des parents abonnés",
    content: "Chaque ligne correspond à un parent. Le badge de couleur indique l'état : vert = actif, orange = expire bientôt, rouge = expiré. Le bouton \"Voir dossier\" ouvre la fiche complète. Le menu ⋮ permet de renouveler, modifier les coordonnées ou annuler un abonnement. NB: l'annulation est impossible 7 jours après la création.",
    placement: "top",
  },
  {
    target: "[data-tour='subscriptions-status-col']",
    title: "Le statut d'un abonnement",
    content: "Chaque abonnement a un statut : actif, expire bientôt ou expiré. Les colonnes « Expire le » et « Jours restants » aident à anticiper les renouvellements.",
    placement: "bottom",
  },
  {
    target: "[data-tour='subscriptions-actions-col']",
    title: "Voir, renouveler, modifier",
    content: "« Voir dossier » ouvre la fiche complète du parent et ses abonnements. « Renouveler l'accès » prolonge l'abonnement. Le menu permet aussi de modifier les coordonnées ou d'annuler.",
    placement: "left",
  },
  {
    target: "[data-tour='subscriptions-add-btn']",
    title: "Créer un nouvel abonnement",
    content: "Ce bouton ouvre le formulaire en plusieurs étapes : choisissez le parent (ou créez-le), la classe et l'élève, la durée, puis la méthode de paiement. À la fin, l'écran affiche les accès du parent : copiez-les avec « Copier les accès » et transmettez-les par un moyen sûr.",
    placement: "left",
  },
]

export const subscriptionRevenueTourSteps: Step[] = [
  {
    target: "[data-tour='revenue-nav']",
    title: "Navigation par mois",
    content: "Les flèches ◀ ▶ changent le mois affiché. Toutes les données de la page (statistiques, détail, reversements) se mettent à jour automatiquement pour le mois sélectionné.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='revenue-commission']",
    title: "Commission IvoirEdu",
    content: "IvoirEdu prélève un pourcentage sur chaque abonnement collecté. Ce bloc indique le taux appliqué. Si un versement est en attente ou en retard, une alerte orange apparaît - contactez IvoirEdu pour régulariser.",
    placement: "bottom",
  },
  {
    target: "[data-tour='revenue-export']",
    title: "Exporter le bilan",
    content: "Ce bouton sort le bilan des revenus de la période choisie, à conserver ou à partager avec la comptabilité.",
    placement: "bottom",
  },
  {
    target: "[data-tour='revenue-tab-subscriptions']",
    title: "Onglet Détail abonnements",
    content: "Cet onglet liste tous les paiements d'abonnements encaissés ce mois-ci : nom du parent, montant, date et moyen de paiement. Utile pour vérifier un paiement ou exporter le bilan.",
    placement: "bottom",
  },
  {
    target: "[data-tour='revenue-tab-payments']",
    title: "Onglet Historique des reversements",
    content: "Cet onglet enregistre tous les versements effectués à IvoirEdu pour ce mois. Après chaque versement de commission, l'équipe d'IvoirEdu l'enregistre et vous l'affiche ici pour garder une trace comptable.",
    placement: "bottom",
  },
]

export const settingsTourSteps: AideStep[] = [
  {
    target: "[data-tour='settings-tabs']",
    title: "Les onglets des paramètres",
    content: "Chaque onglet regroupe un sujet : Général, Personnel, Académique, Scolarité & finances, Relances, Risques et Communication. Seuls ceux auxquels vous avez droit s'affichent. La visite présente l'onglet ouvert : changez d'onglet puis relancez-la pour découvrir les autres.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='settings-tab-general']",
    title: "Onglet Général",
    content: "L'identité de l'école : informations, logo, cachet et signature, politique de scan des QR codes et heures réelles.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-school-info-header']",
    title: "Informations de l'école",
    content: "Ce formulaire contient les données de base : nom de l'école, type d'établissement, année scolaire en cours etc. Ces valeurs apparaissent dans les exports et rapports.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='settings-logo']",
    title: "Logo de l'école",
    content: "Importez ici le logo officiel de votre établissement. Il sera affiché sur les exports PDF (bilans de salaires etc). Format recommandé : PNG fond transparent.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-seal']",
    title: "Cachet et signature",
    content: "Importez l'image du cachet et de la signature de la direction. Elle sera apposée sur les bulletins.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-qr-skip-policy']",
    title: "Politique de scan QR Codes",
    content: "Contrôlez si les enseignants peuvent terminer le flux de pointage sans scanner le QR code de salle. Si cette option est activée, les enseignants peuvent confirmer leur présence sans scan, mais cela peut réduire la fiabilité des données de présence. Si elle est désactivée, le scan du QR code de la salle est obligatoire pour valider une présence.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-real-hours']",
    title: "Heures réelles - tolérance check-out",
    content: "Cette section contrôle la tolérance avant qu'une présence courte parte en validation. Par exemple, une tolérance de 5 minutes signifie qu'un cours terminé 5 minutes avant l'heure prévue est accepté sans validation manuelle. Si la fonctionnalité est désactivée, IvoirEdu doit l'activer pour vous.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-tab-personnel']",
    title: "Onglet Personnel",
    content: "Gérez ici le personnel administratif et les règles de conduite : postes, droits et affectations.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-positions-panel']",
    title: "Postes administratifs",
    content: "Créez et gérez ici les postes du personnel administratif (secrétaire, Censeur, comptable, surveillant…). Chaque poste peut se voir attribuer des droits précis : certains peuvent marquer les salaires payés, d'autres seulement consulter. Les droits sont cumulatifs avec le rôle.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-limits']",
    title: "Limites de l'école",
    content: "Ce bloc affiche le nombre maximum de postes administratifs autorisés pour votre école, avec une barre qui montre combien sont déjà utilisés. Seul IvoirEdu peut modifier cette limite : contactez-nous pour la faire évoluer.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-admin-users']",
    title: "Utilisateurs administratifs",
    content: "Gérez ici les comptes du personnel administratif (hors professeurs). Pour chaque compte, vous assignez un poste créé au préalable qui détermine ses droits. Ces utilisateurs accèdent à l'interface web mais pas à l'application de pointage des profs.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-conduct']",
    title: "Décision de conduite",
    content: "Choisissez l'année, puis qui décide de la note finale de conduite : le professeur principal de chaque classe, la direction, ou un éducateur délégué. Le « coefficient annuel » fixe le poids de la conduite dans la moyenne. Seule la note finale compte : les avis manquants des professeurs ne bloquent pas la décision.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tab-scolarite']",
    title: "Onglet Académique",
    content: "Réglez ici les documents demandés à l'inscription et les paramètres de la scolarité.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-required-docs']",
    title: "Documents requis par niveau",
    content: "Créez chaque pièce une seule fois (par exemple « Extrait de naissance »), puis cochez tous les niveaux concernés. Décochez « Obligatoire » pour qu'une pièce soit facultative. Ces pièces sont celles que vous suivez dans les dossiers d'inscription.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-required-docs-list']",
    title: "Le récapitulatif des pièces",
    content: "Une ligne par document, avec ses niveaux et son exigence. « Modifier » corrige une pièce ; « Archiver » arrête de la demander, mais les pièces déjà fournies sont conservées. Les niveaux sans document requis sont listés au-dessus.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-evaluation-delays']",
    title: "Délais de saisie des notes",
    content: "Le « délai de grâce » est le nombre de jours après une évaluation avant que la saisie des notes soit attendue. Passé le « seuil de retard », elle apparaît en rouge dans le suivi des évaluations. Le seuil doit être supérieur au délai de grâce.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tab-finance']",
    title: "Onglet Scolarité & finances",
    content: "Choisissez l'année scolaire, puis définissez les frais et les seuils qui s'y appliquent.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-finance-year']",
    title: "Choisir l'année des frais",
    content: "Les frais et les seuils ci-dessous s'appliquent à l'année scolaire choisie ici. Les montants d'une année n'affectent pas les autres.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-tuition-plan']",
    title: "Le plan de frais par niveau",
    content: "Choisissez un niveau : toutes ses classes utilisent le même plan pendant l'année. Ce plan est indispensable : sans lui, la caisse ne peut pas confirmer une inscription et la Vue financière reste vide.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tuition-total']",
    title: "Montant annuel et inscription",
    content: "Saisissez le montant total de la scolarité annuelle, puis le montant obligatoire à régler lors de l'inscription.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-tuition-curve']",
    title: "La courbe cumulative attendue",
    content: "Chaque seuil a une date et un montant cumulé attendu à cette date, avec sa part du total. Les dates doivent aller en croissant, et les montants ne dépassent pas le total. Aucun versement individuel n'est imposé : le plan sert à repérer les retards et à déclencher les relances.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tuition-copy']",
    title: "Copier vers d'autres niveaux",
    content: "Quand plusieurs niveaux ont le même plan, enregistrez-le d'abord, puis cliquez sur « Copier vers… » pour le reprendre sur d'autres niveaux sans tout ressaisir.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tuition-negotiated']",
    title: "Échéancier négocié",
    content: "Pour un élève précis, remplace le plan de son niveau par un calendrier convenu avec le parent. Un motif est demandé. Les statuts financiers et les relances suivent alors cet accord.",
    placement: "top",
    requires: ["tuition.manage_student_schedule"],
  },
  {
    target: "[data-tour='settings-tuition-adjust']",
    title: "Ajustement individuel",
    content: "Accorde une remise ou fixe un montant personnalisé pour un élève, avec un motif obligatoire. Le montant dû de l'élève est recalculé. Vous retrouvez tous ces accords dans le menu Finance, « Accords & ajustements ».",
    placement: "top",
    requires: ["tuition.grant_discount"],
  },
  {
    target: "[data-tour='settings-sms']",
    title: "Service Alertes Parents",
    content: "Ce bloc apparaît si votre école utilise la facturation des alertes parents. Définissez ici le tarif par élève/mois (en FCFA) facturé aux parents abonnés. La commission IvoirEdu est calculée automatiquement sur ce montant.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-mobile-money']",
    title: "Coordonnées de versement",
    content: "Renseignez l'opérateur et le numéro marchand ou de versement. Le numéro peut s'afficher dans les consignes de versement manuel. Le paiement direct par bouton « Payer » est temporairement désactivé pour les parents.",
    placement: "top",
    requires: ["settings.school"],
  },
  {
    target: "[data-tour='settings-tab-relances']",
    title: "Onglet Relances",
    content: "Définissez les règles qui déclenchent les alertes de paiement.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-alert-rules']",
    title: "Les règles de relance",
    content: "Une règle par type : « Préventive » prévient les parents quelques jours avant une échéance, « Retard » les relance après un premier retard, « Retard important » envoie la relance urgente. Choisissez le délai en jours, le canal (SMS, dans l'application ou les deux) et cochez « Active ». Les relances partent chaque matin.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-alert-log']",
    title: "Historique des relances",
    content: "Toutes les relances envoyées par l'école, de la plus récente à la plus ancienne, avec l'élève, le type, le canal et le statut (envoyée ou échec). Elle reste vide tant qu'aucune règle ne s'est déclenchée.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tab-risques']",
    title: "Onglet Risques",
    content: "Définissez les règles qui déclenchent les alertes de risque sur le suivi des élèves et des professeurs.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-risk-student']",
    title: "Les signaux sur les élèves",
    content: "Pour chaque signal, cochez « Signal actif » et réglez son seuil, par exemple un nombre d'absences sur une période en jours ou une baisse de moyenne. Cliquez sur « Enregistrer » à côté du signal. Les résultats alimentent « Risques élèves et professeurs » du tableau de bord.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-risk-teacher']",
    title: "Les signaux sur les professeurs",
    content: "La « tolérance du pointage » fixe à partir de combien de minutes un pointage compte comme en retard : elle s'applique aux prochains pointages, même si le signal est désactivé. Le nombre de retards sur 30 jours alimente « Professeurs à suivre ». Les signaux sont recalculés au plus tard dans 15 minutes.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tab-communication']",
    title: "Modèles de messages SMS",
    content: "Personnalisez le texte du SMS envoyé aux parents lors d'une absence. Les informations insérées (prénom, matière, date, téléphone de l'école) sont remplacées automatiquement par les vraies valeurs au moment de l'envoi.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-sms-insert']",
    title: "Insérer une information",
    content: "Cliquez sur « Prénom », « Matière », « Date » ou « Téléphone de l'école » pour placer l'information dans le message, là où se trouve votre curseur. Elle sera remplacée par la vraie valeur à l'envoi.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-sms-editor']",
    title: "Le texte du SMS",
    content: "Écrivez ou modifiez le message d'absence (au moins 5 caractères). Tant que vous n'avez rien enregistré, le message du système est utilisé. Le bouton « Créer le modèle SMS » (puis « Enregistrer » pour les modifications suivantes) conserve votre message ; « Réinitialiser » revient au message du système.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-sms-preview']",
    title: "L'aperçu chez le parent",
    content: "Cet exemple, avec des valeurs fictives, montre le SMS tel que le parent le recevra. Relisez-le avant d'enregistrer.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-tabs']",
    title: "Voir un autre onglet",
    content: "La visite présente seulement l'onglet ouvert. Cliquez sur un autre onglet puis relancez-la avec le bouton « Aide » : elle commencera directement par cet onglet.",
    placement: "bottom",
  },
]

export const teacherAppTourSteps: AideStep[] = [
  {
    target: "[data-tour='teacher-app-header']",
    title: "Mon planning",
    content: "Cette page affiche vos cours de la semaine. Pour valider vos heures, pointez chaque cours en quatre temps : présence, scan du QR de la salle, appel des élèves, puis scan de fin.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='teacher-app-compliance']",
    title: "Taux de conformité du mois",
    content: "Cette barre résume le respect de vos pointages sur le mois en cours. Si aucun cours n'est programmé ce mois, elle l'indique.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-app-daypicker']",
    title: "Naviguer entre les jours",
    content: "Touchez un jour de la semaine pour afficher ses cours. Les flèches changent de semaine. Utilisez-les pour retrouver un cours passé ou à venir.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-app-course-info']",
    title: "Une carte = un cours",
    content: "Elle indique l'horaire, la matière, la classe et la salle. Un point vert « En cours » signale le cours du moment.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-app-course-actions']",
    title: "Les boutons et les états",
    content: "Le bouton change avec l'avancement : « Démarrer le cours » (dès 5 minutes avant), « Poursuivre le pointage », puis « Terminer le cours ». Une pastille indique l'état du pointage.",
    placement: "top",
  },
]

export const teacherDashboardTourSteps: Step[] = [
  {
    target: "[data-tour='teacher-dashboard-header']",
    title: "La date et l'aide",
    content: "La date du jour s'affiche à gauche. À droite, le bouton « Aide » rouvre ce guide et la cloche rassemble vos notifications.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='teacher-dashboard-notifications']",
    title: "Vos notifications",
    content: "La cloche affiche les messages de l'école qui vous concernent, par exemple une relance pour une note manquante. Ouvrez-la pour les lire.",
    placement: "bottom-end",
  },
  {
    target: "[data-tour='teacher-dashboard-conduct']",
    title: "Conduite à renseigner",
    content: "Cette liste apparaît quand l'école ouvre la revue de conduite. Chaque ligne indique la classe et le nombre d'avis qu'il vous reste à saisir. Cliquez dessus pour les renseigner.",
    placement: "top",
  },
  {
    target: "[data-tour='teacher-dashboard-course']",
    title: "Préparer ou ouvrir un cours",
    content: "Cette carte montre le cours en cours ou le prochain. Ouvrez-le pour faire l'appel. Une fois la journée finie, elle propose de consulter le planning.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-dashboard-today']",
    title: "Les cours d'aujourd'hui",
    content: "Tous vos cours du jour, avec l'heure, la matière, la classe et un statut. Cliquez sur un cours pour ouvrir l'appel ; « Voir le planning » affiche toute la semaine.",
    placement: "top",
  },
  {
    target: "[data-tour='teacher-dashboard-classes']",
    title: "Retrouver vos classes",
    content: "Chaque classe ouvre l'espace de notes de la période scolaire active. La période en cours est indiquée en haut de ce bloc.",
    placement: "top",
  },
]

export const parentPortalTourSteps: AideStep[] = [
  {
    target: "[data-tour='parent-bell']",
    title: "Les notifications",
    content: "Les relances et informations de l'école apparaissent ici. Un badge rouge indique le nombre de nouveautés.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='parent-student-selector']",
    title: "Choisir un enfant",
    content: "Si plusieurs de vos enfants sont inscrits dans l'école, choisissez celui que vous voulez suivre. Toute la page se met à jour pour lui.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-today-status']",
    title: "Présence aujourd'hui",
    content: "Les cours du jour de votre enfant, un par un : présent, absent ou à venir. Le message en bas résume la journée, par exemple « Aucune absence signalée sur les cours déjà passés ».",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-overview']",
    title: "Bulletin et situation de scolarité",
    content: "Quand un bulletin est publié, un bandeau annonce la moyenne et le rang. La carte « Situation de scolarité » indique si les frais sont à jour ou en retard, avec le reste dû sur l'année.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-stats']",
    title: "Absences de la semaine et du mois",
    content: "Le nombre d'absences cette semaine, et le taux d'absence du mois, en rouge au-dessus de 20 %. Touchez la « Dernière absence » pour ouvrir l'historique.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-nav-links']",
    title: "Raccourcis",
    content: "Quatre raccourcis : bulletins scolaires, historique des absences, emploi du temps, et frais et paiements.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-absences-filters']",
    title: "Choisir l'enfant et le mois",
    content: "Choisissez l'enfant puis le mois pour retrouver une absence précise.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-absences-list']",
    title: "Les absences du mois",
    content: "Le nombre d'absences du mois, puis chaque absence avec la matière, la date, l'horaire et le professeur. Un mois sans absence affiche « Bravo ! ».",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-schedule-week']",
    title: "Changer de semaine",
    content: "Les flèches affichent la semaine précédente ou suivante, avec ses dates.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-schedule-days']",
    title: "Choisir un jour",
    content: "Touchez un jour pour afficher ses cours. Le jour d'aujourd'hui est mis en couleur.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-schedule-slots']",
    title: "Les cours du jour",
    content: "Chaque cours indique l'heure, la matière, le professeur et la salle, et son état : présent, absent ou à venir.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-grades-period']",
    title: "Choisir la période",
    content: "Choisissez la période dont vous voulez voir les résultats. Seuls les résultats validés par l'école sont affichés.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-grades-results']",
    title: "Les résultats",
    content: "La conduite est affichée en premier quand elle est validée. Chaque matière montre sa moyenne sur 20 : touchez-la pour voir le détail des évaluations. « À valider » signale une moyenne pas encore validée.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-reports-filters']",
    title: "Choisir l'enfant et l'année",
    content: "Choisissez l'enfant (si vous en avez plusieurs), puis l'année scolaire dont vous voulez voir les bulletins.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-reports-list']",
    title: "Les bulletins publiés",
    content: "Chaque bulletin indique la période, la moyenne générale et le rang. « Télécharger le PDF » l'enregistre sur votre téléphone. Un bulletin en révision apparaît après publication.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-payments-status']",
    title: "Situation financière",
    content: "Le total des frais, ce qui est déjà versé et ce qui reste à payer pour l'année en cours.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-payments-history']",
    title: "Historique des paiements",
    content: "Les versements reconnus par l'école, chacun avec son statut. Les paiements annulés restent visibles. « Télécharger le reçu » enregistre le reçu d'un paiement confirmé.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-notifications-list']",
    title: "Vos notifications",
    content: "Les rappels de scolarité et informations de l'école, les plus récentes en premier. Les nouvelles sont marquées « Nouveau » ; « Tout marquer comme lu » les efface.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-account-info']",
    title: "Mon compte",
    content: "Votre e-mail et votre téléphone, tels que l'école les connaît.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-account-subscription']",
    title: "Mon abonnement",
    content: "Les alertes d'absence en temps réel sont un abonnement. Vous voyez sa date de fin, les jours restants et le tarif mensuel. Pour le renouveler, présentez-vous à l'administration de l'école.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-account-password']",
    title: "Changer mon mot de passe",
    content: "Saisissez votre mot de passe actuel, puis le nouveau deux fois, et enregistrez.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-nav']",
    title: "Le menu du bas",
    content: "Cinq onglets : Accueil (la journée de votre enfant), Absences (mois par mois), EDT (les cours de la semaine), Notes (les résultats validés) et Compte (vos informations, votre abonnement et votre mot de passe).",
    placement: "top",
  },
]

export const enrollmentsTourSteps: AideStep[] = [
  {
    target: "[data-tour='enrollments-new-btn']",
    title: "Créer une inscription",
    content: "Ce bouton ouvre le formulaire d'un nouvel élève. C'est par ici qu'un élève entre dans l'école : il apparaît ensuite dans la page Élèves.",
    placement: "bottom",
    skipBeacon: true,
    requires: ["enrollments.create"],
  },
  {
    target: "[data-tour='enrollments-tabs']",
    title: "Deux onglets",
    content: "« Dossiers » liste les inscriptions de l'année en cours. « Réinscriptions » suit les élèves de l'année passée. La visite présente l'onglet ouvert : changez d'onglet puis relancez-la pour voir l'autre.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='enrollments-summary']",
    title: "Le point sur l'année",
    content: "Ces trois cartes comptent le total des inscrits, les nouvelles inscriptions et les réinscriptions de l'année.",
    placement: "bottom",
  },
  {
    target: "[data-tour='enrollments-filters']",
    title: "Retrouver un dossier",
    content: "Tapez un nom ou un matricule, ou choisissez un niveau, une classe ou un statut. Les filtres se combinent. Cliquez ensuite sur une ligne pour ouvrir le dossier ; les trois points donnent accès à la caisse.",
    placement: "bottom",
  },
  {
    target: "[data-tour='enrollments-campaign']",
    title: "La campagne de réinscription",
    content: "Cette barre montre combien d'élèves attendus sont déjà réinscrits. Les boutons en dessous filtrent les élèves selon leur état : prêts, impayés, en attente de caisse.",
    placement: "bottom",
  },
  {
    target: "[data-tour='enrollments-candidates']",
    title: "Réinscrire un élève",
    content: "Pour un élève prêt, choisissez sa classe d'accueil, indiquez s'il redouble, puis cliquez sur « Réinscrire ». Le paiement se confirme ensuite à la caisse, dans l'onglet « Dossiers ».",
    placement: "top",
    requires: ["enrollments.create"],
  },
]

export const enrollmentNewTourSteps: AideStep[] = [
  {
    target: "[data-tour='enrollment-new-progress']",
    title: "Deux étapes",
    content: "L'inscription se fait en deux étapes : l'élève et sa classe, puis les pièces du dossier. Le paiement se fait plus tard, à la caisse.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='enrollment-new-identity']",
    title: "L'identité de l'élève",
    content: "Renseignez le prénom, le nom, la date et le lieu de naissance, le sexe et la nationalité. Les champs marqués d'une étoile sont obligatoires.",
    placement: "bottom",
  },
  {
    target: "[data-tour='enrollment-new-class']",
    title: "La classe visée",
    content: "Choisissez d'abord le niveau, puis la classe. Indiquez aussi si l'élève est redoublant.",
    placement: "top",
  },
  {
    target: "[data-tour='enrollment-new-parent']",
    title: "Le contact du parent",
    content: "Ajoutez le nom et le téléphone du parent : ils vont ensemble. Ce numéro sert aux alertes d'absence et aux rappels de pièces manquantes.",
    placement: "top",
  },
  {
    target: "[data-tour='enrollment-new-submit']",
    title: "Créer le dossier",
    content: "Le texte à gauche du bouton dit ce qui manque. Quand tout est complet, cliquez sur « Créer et continuer ».",
    placement: "top",
  },
  {
    target: "[data-tour='enrollment-new-documents']",
    title: "Les pièces du dossier",
    content: "Ajoutez chaque pièce reçue avec « Photo ou fichier ». Cliquez ensuite sur « Terminer le dossier » : le parent est prévenu si une pièce obligatoire manque.",
    placement: "top",
  },
]

export const financeDashboardTourSteps: AideStep[] = [
  {
    target: "[data-tour='finance-year']",
    title: "Choisir l'année",
    content: "Tous les chiffres de la page concernent l'année choisie ici. L'année en cours porte la mention « Active ».",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='finance-recalc']",
    title: "Mettre les chiffres à jour",
    content: "Les montants se calculent à part. Cliquez sur « Recalculer les données » si vous attendez un paiement récent. La date du dernier calcul s'affiche dessous.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-summary']",
    title: "Attendu, encaissé, impayé",
    content: "À gauche, la situation « à ce jour » : ce qui devait déjà être payé, ce qui l'a été et l'impayé. À droite, le total de l'année après remises et le solde restant. Le taux de recouvrement compare l'encaissé à l'attendu.",
    placement: "top",
  },
  {
    target: "[data-tour='finance-upcoming']",
    title: "Prochaines échéances",
    content: "Les versements attendus dans les prochains jours, avec le compte à rebours. Un message signale si certains échéanciers sont absents ou incomplets : les montants sont alors partiels.",
    placement: "top",
  },
  {
    target: "[data-tour='finance-monthly']",
    title: "Montants encaissés par mois",
    content: "Les barres montrent les encaissements confirmés, mois par mois, sur l'année scolaire. Un tableau en dessous donne les mêmes montants en chiffres. Les paiements annulés n'y figurent pas.",
    placement: "top",
  },
  {
    target: "[data-tour='finance-modes']",
    title: "Répartition par mode de paiement",
    content: "Ce graphique montre quelle part des encaissements passe par les espèces, le Mobile Money ou les virements.",
    placement: "left",
  },
  {
    target: "[data-tour='finance-accords']",
    title: "Suivi des accords individuels",
    content: "Quatre cartes comptent les remises actives, les échéanciers négociés actifs, ceux en retard et le montant restant à recouvrer. Cliquez sur une carte pour ouvrir la liste correspondante dans « Accords & ajustements ».",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-levels']",
    title: "Le recouvrement par niveau",
    content: "Chaque niveau a son taux à date. Cliquez sur un niveau pour voir ses classes, ou sur « Voir le recouvrement détaillé » pour la page complète.",
    placement: "top",
  },
  {
    target: "[data-tour='finance-aging']",
    title: "Les impayés par ancienneté",
    content: "Les soldes échus sont rangés par ancienneté, les plus anciens étant payés en premier. Cliquez sur une tranche pour voir les élèves concernés, puis sur un élève pour ouvrir son détail.",
    placement: "top",
  },
  {
    target: "[data-tour='finance-latest']",
    title: "Derniers encaissements",
    content: "Les paiements confirmés les plus récents, avec le reçu et le statut. « Détail financier » ouvre la fiche de l'élève ; « Voir tout » ouvre l'historique complet.",
    placement: "top",
  },
]

export const financeRecoveryTourSteps: AideStep[] = [
  {
    target: "[data-tour='finance-recovery-year']",
    title: "Choisir l'année",
    content: "Le recouvrement se lit année par année. L'année active est proposée par défaut ; choisissez une année passée pour voir ce qui restait à encaisser.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='finance-recovery-filters']",
    title: "Choisir le niveau et la classe",
    content: "Affinez avec les menus « Niveau » et « Classe ». Les chiffres de la page suivent ce choix. La date de la situation est indiquée à droite.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-recovery-stats']",
    title: "Les trois chiffres clés",
    content: "Le taux de recouvrement (encaissé sur attendu à date), le reste à collecter, et le nombre d'élèves à suivre pour la sélection choisie.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-recovery-table']",
    title: "Niveau par niveau, classe par classe",
    content: "Chaque ligne donne l'effectif, l'attendu, l'encaissé, le reste et le taux. Repérez les classes au taux le plus bas, puis cliquez sur « Voir les élèves » pour obtenir la liste de ceux à relancer.",
    placement: "top",
  },
]

export const financeEntryTourSteps: AideStep[] = [
  {
    target: "[data-tour='finance-entry-tabs']",
    title: "Deux façons d'encaisser",
    content: "« Enregistrement » saisit les paiements un par un. « Importer les paiements » charge un fichier Excel de la caisse. La visite présente l'onglet ouvert : changez d'onglet puis relancez-la pour voir l'autre.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='finance-entry-form']",
    title: "La saisie rapide",
    content: "Recherchez un élève confirmé, ou une réinscription bloquée par un impayé. Pour un dossier bloqué, le règlement est affecté à l'année de la dette. « Nouvelle session » remet le tableau à zéro.",
    placement: "top",
  },
  {
    target: "[data-tour='finance-entry-method']",
    title: "Le mode de paiement",
    content: "Choisissez espèces, Mobile Money manuel ou virement bancaire. Ce mode s'applique aux nouvelles lignes que vous ajoutez.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-entry-table']",
    title: "Une ligne par paiement",
    content: "Pour chaque ligne : cherchez l'élève, saisissez le montant, puis la référence du reçu de l'école si vous l'avez. L'état à gauche passe à « enregistré » une fois le paiement validé. « Ajouter une ligne » prépare le suivant.",
    placement: "top",
  },
  {
    target: "[data-tour='finance-import']",
    title: "L'import depuis Excel",
    content: "Les cinq champs sont obligatoires : matricule, montant, date du paiement, référence et mode de paiement. Vous associez chaque colonne de votre fichier à un champ. La correspondance est mémorisée pour les imports suivants.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-import-file']",
    title: "Choisir le fichier",
    content: "Choisissez le fichier Excel de la caisse (.xlsx), avec une ligne d'en-têtes. Vous verrez ensuite les lignes valides et celles en erreur avant d'importer : les lignes en erreur sont ignorées.",
    placement: "top",
  },
]

export const financeHistoryTourSteps: AideStep[] = [
  {
    target: "[data-tour='finance-history-filters']",
    title: "Retrouver un paiement",
    content: "Choisissez les dates « Du » et « Au », puis si besoin le niveau, la classe ou la situation de l'élève (à jour ou en retard). La liste se met à jour toute seule.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='finance-history-table']",
    title: "La liste des paiements",
    content: "Chaque ligne affiche la date, l'élève, sa classe, le numéro de reçu, le statut du paiement (confirmé ou annulé), la situation actuelle de l'élève et le montant. Cliquez sur « Détails » pour ouvrir le détail financier de l'élève, où l'on télécharge un reçu ou annule un paiement.",
    placement: "top",
  },
]

export const financeJournalTourSteps: AideStep[] = [
  {
    target: "[data-tour='finance-journal-period']",
    title: "Choisir la période",
    content: "Cliquez sur « Aujourd'hui », « Cette semaine » ou « Ce mois ». « Personnalisé » vous laisse choisir deux dates.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='finance-journal-export']",
    title: "Exporter",
    content: "Exportez le journal de la période en Excel ou en PDF. Le bouton est grisé si l'export n'est pas autorisé pour votre école.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-journal-filters']",
    title: "Filtrer le journal",
    content: "Isolez une classe, un mode de paiement (espèces, Mobile Money, virement) ou un statut. Choisissez « Annulés » pour voir les paiements annulés.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-journal-totals']",
    title: "Les totaux",
    content: "Le total confirmé ne compte pas les paiements annulés. La répartition par mode vous aide à faire le point de la caisse.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-journal-list']",
    title: "La liste, jour par jour",
    content: "Les paiements sont regroupés par jour, avec le nombre et le total de chaque jour. Chaque ligne donne l'élève, sa classe, le mode, la référence, le numéro de reçu et le statut. Les paiements annulés sont signalés avec leur motif.",
    placement: "top",
  },
]

export const financeAgreementsTourSteps: AideStep[] = [
  {
    target: "[data-tour='finance-agreements-tabs']",
    title: "Deux types d'accords",
    content: "« Remises et ajustements » traite les réductions accordées à un élève. « Échéanciers négociés » traite les calendriers de paiement convenus avec un parent. Chacun a son propre bouton de création.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='finance-agreements-new']",
    title: "Créer un accord",
    content: "« Nouvel ajustement » accorde une remise sur frais ou fixe un montant total personnalisé. « Nouvel échéancier » planifie les versements du reste à payer. Le motif est obligatoire dans les deux cas : c'est la trace en cas de contrôle.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-agreements-search']",
    title: "Retrouver un accord",
    content: "Cherchez par élève, matricule, classe ou niveau.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-agreements-status']",
    title: "Filtrer par statut",
    content: "Actifs, retirés, remplacés ou réinitialisés. Un accord remplacé reste consultable : un nouvel accord ne supprime jamais l'ancien.",
    placement: "bottom",
  },
  {
    target: "[data-tour='finance-agreements-table']",
    title: "Le registre des accords",
    content: "Chaque ligne montre l'élève, son arrangement et sa situation financière (plan, montant de la remise, prochaine échéance, encaissé, solde). « Détail » ouvre l'historique de l'accord ; « Modifier » le remplace par un nouvel accord.",
    placement: "top",
  },
]

export const schoolYearsTourSteps: AideStep[] = [
  {
    target: "[data-tour='years-summary']",
    title: "L'année en cours",
    content: "Ces trois cartes montrent l'année active et le temps qu'il lui reste, la période courante et son état (saisie des notes, revue de conduite), et la prochaine échéance du calendrier.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='years-table']",
    title: "Les années scolaires",
    content: "Chaque ligne est une année, avec son cycle (semestres ou trimestres), la date d'ouverture des décisions et son statut. Cliquez sur une ligne pour afficher son calendrier et ses périodes plus bas.",
    placement: "top",
  },
  {
    target: "[data-tour='years-timeline']",
    title: "Le calendrier de l'année",
    content: "Cette frise place toute l'année sur une ligne de temps. Une barre par période : la partie claire est la période de cours, la partie foncée est la « revue », où l'on arrête les notes de conduite et prépare les bulletins. Les périodes se chevauchent volontairement : la revue de l'une peut commencer avant la fin de la suivante.",
    placement: "top",
  },
  {
    target: "[data-tour='years-timeline']",
    title: "Lire les repères",
    content: "Le trait vertical marque aujourd'hui. Le losange orange marque l'ouverture des décisions de fin d'année, et le trait final la fin de l'année. Sur téléphone, faites défiler la frise sur le côté pour la voir en entier.",
    placement: "top",
  },
  {
    target: "[data-tour='years-periods']",
    title: "Les périodes d'évaluation",
    content: "Chaque période a trois dates : début, début de revue et fin. Cliquez sur une période pour l'ouvrir, puis sur « Modifier » pour changer ses dates. Une pastille indique son état : à venir, saisie des notes, revue de conduite ou clôturée.",
    placement: "top",
    requires: ["school_years.view"],
  },
  {
    target: "[data-tour='years-decisions']",
    title: "Ouvrir la fin d'année",
    content: "La date choisie ici ouvre le menu « Fin d'année » pour valider les passages. Elle doit précéder la fin de l'année scolaire. Le bouton « Ouvrir Fin d'année » ne marche qu'à partir de cette date.",
    placement: "left",
  },
]

export const evaluationsTourSteps: AideStep[] = [
  {
    target: "[data-tour='evaluations-filters']",
    title: "Choisir ce que vous regardez",
    content: "Choisissez l'année et la période, puis affinez par niveau, classe, matière ou professeur. Les menus se règlent les uns après les autres.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='evaluations-tabs']",
    title: "Deux sortes de notes",
    content: "« Évaluations programmées » liste les devoirs prévus par les professeurs. « Notes spontanées » liste les notes données hors programme, avec une recherche par élève.",
    placement: "bottom",
  },
  {
    target: "[data-tour='evaluations-summary']",
    title: "Le point sur les notes",
    content: "Ces cartes comptent les évaluations, les notes saisies et les notes manquantes. Le dernier pourcentage montre la complétion.",
    placement: "bottom",
  },
  {
    target: "[data-tour='evaluations-sort']",
    title: "Trier et relancer",
    content: "Triez par retard, par professeur ou par classe. « Relance groupée » permet de choisir plusieurs évaluations et de relancer les professeurs en retard en une fois.",
    placement: "bottom",
  },
  {
    target: "[data-tour='evaluations-list']",
    title: "La liste des évaluations",
    content: "Chaque ligne est une évaluation, avec son professeur, sa classe, son retard éventuel et la barre de saisie des notes. Cliquez dessus pour voir la progression élève par élève. « Relancer » prévient le professeur d'une note manquante.",
    placement: "top",
  },
]

export const reportCardsTourSteps: AideStep[] = [
  {
    target: "[data-tour='report-cards-filters']",
    title: "Choisir la classe et la période",
    content: "Choisissez l'année, le niveau, la classe puis la période. La classe et la période sont obligatoires pour voir la préparation et les bulletins.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='report-cards-readiness']",
    title: "Préparer la classe",
    content: "Chaque matière doit être clôturée et validée par son professeur. Ce tableau montre l'état de chaque matière et permet d'ouvrir une réclamation.",
    placement: "top",
  },
  {
    target: "[data-tour='report-cards-generate']",
    title: "Générer les bulletins",
    content: "Quand la classe est prête, cliquez sur « Générer les bulletins de la classe ». Si le bouton est grisé, le message à gauche dit ce qui manque.",
    placement: "top",
    requires: ["report_cards.publish"],
  },
  {
    target: "[data-tour='report-cards-list']",
    title: "Publier et télécharger",
    content: "Les bulletins générés sont ici. « Publier » les rend visibles aux parents. « PDF » télécharge un bulletin. Une publication ne se défait pas sans réclamation approuvée.",
    placement: "top",
  },
]

export const endOfYearTourSteps: AideStep[] = [
  {
    target: "[data-tour='end-year-filters']",
    title: "Traiter un groupe à la fois",
    content: "Les décisions se prennent par niveau et par classe, pour garder la liste courte. Commencez par choisir le niveau.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='end-year-level']",
    title: "Le niveau",
    content: "Choisir un niveau active la « Décision automatique ». Les élèves du niveau choisi sont les seuls concernés par une validation groupée.",
    placement: "bottom",
  },
  {
    target: "[data-tour='end-year-class']",
    title: "La classe",
    content: "Affinez par classe pour ne valider que les élèves d'une seule classe, ou laissez « Toutes les classes ».",
    placement: "bottom",
  },
  {
    target: "[data-tour='end-year-auto']",
    title: "La décision automatique",
    content: "Fixez une moyenne seuil sur 20, puis la décision au-dessus et en dessous du seuil (admis, redouble ou exclu) avec le niveau de destination. Une prévisualisation précède la validation définitive : relisez-la.",
    placement: "bottom",
    requires: ["class_decisions.validate"],
  },
  {
    target: "[data-tour='end-year-table']",
    title: "Décider élève par élève",
    content: "Chaque ligne affiche la moyenne générale et une suggestion. Choisissez « Admis(e) », « Redouble » ou « Exclu(e) », le niveau suivant, puis cliquez sur « Valider ». « Mettre à jour » corrige une décision déjà validée. Une moyenne en attente signale qu'il manque des notes.",
    placement: "top",
  },
]

export const teacherNotesTourSteps: AideStep[] = [
  {
    target: "[data-tour='notes-tabs']",
    title: "Les sections des notes",
    content: "« Évaluations » sert à programmer vos devoirs et saisir les notes. « Moyennes » sert à calculer puis valider chaque matière. « Conduite » apparaît quand la direction ouvre la revue de conduite, et « Décisions » si vous décidez de la note finale. La visite présente la section ouverte : changez de section puis relancez-la.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='notes-context']",
    title: "Choisir la classe et la période",
    content: "Choisissez la classe que vous enseignez et la période de calcul. Toutes les actions en dessous concernent cette sélection.",
    placement: "bottom",
  },
  {
    target: "[data-tour='notes-add-evaluation']",
    title: "Programmer une évaluation",
    content: "Choisissez d'abord la date : l'écran charge alors vos matières et les créneaux de l'emploi du temps. Le créneau est facultatif. Donnez un libellé et un coefficient propre à cette évaluation. Ce coefficient ne change pas celui de la matière.",
    placement: "top",
  },
  {
    target: "[data-tour='notes-evaluations']",
    title: "Vos évaluations programmées",
    content: "Chaque ligne indique la matière, la date et le nombre de notes saisies. Touchez une évaluation pour saisir ou corriger les notes élève par élève. Une saisie clôturée reste consultable.",
    placement: "top",
  },
  {
    target: "[data-tour='averages-filters']",
    title: "Moyennes : classe et période",
    content: "Choisissez la classe et la période pour voir l'état de chacune de vos matières.",
    placement: "bottom",
  },
  {
    target: "[data-tour='averages-subject']",
    title: "L'état d'une matière",
    content: "Chaque carte indique le nombre d'évaluations, les notes saisies et manquantes, et un statut : saisie incomplète, en calcul ou validée. « Démarrer le calcul » ouvre le calcul quand tout est saisi ; « Saisir les notes » vous ramène aux évaluations s'il en manque.",
    placement: "top",
  },
  {
    target: "[data-tour='conduct-filters']",
    title: "Conduite : classe et période",
    content: "Choisissez la classe et la période dont la revue de conduite est ouverte.",
    placement: "bottom",
  },
  {
    target: "[data-tour='conduct-bulk']",
    title: "Attribution en masse",
    content: "Cochez les élèves, saisissez une note sur 20 et une observation commune, puis appliquez-les d'un coup. Chaque élève garde ensuite sa ligne pour être corrigé un par un.",
    placement: "top",
  },
]

export const teacherCalculationTourSteps: AideStep[] = [
  {
    target: "[data-tour='calc-context']",
    title: "La classe, la matière et la période",
    content: "Cet en-tête rappelle ce que vous calculez, avec l'état : « Calcul en cours » ou « Moyennes validées ». « Retour aux moyennes » ramène à la liste de vos matières.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='calc-steps']",
    title: "Les trois étapes",
    content: "1. Notes saisies, 2. Notes par élève, 3. Moyennes. L'étape en cours est colorée. Vous avancez d'étape en étape avant de valider.",
    placement: "bottom",
  },
  {
    target: "[data-tour='calc-notes']",
    title: "Notes par élève",
    content: "Pour chaque élève, le nombre de notes retenues. Le bouton de détail montre chaque évaluation, son coefficient et les notes spontanées avec leur justificatif.",
    placement: "top",
  },
  {
    target: "[data-tour='calc-averages']",
    title: "Les moyennes sur 20",
    content: "La moyenne de chaque élève pour cette matière. Vérifiez-les avant de valider : après validation, elles ne se modifient plus.",
    placement: "top",
  },
  {
    target: "[data-tour='calc-validate']",
    title: "Valider mes moyennes",
    content: "Ce bouton transmet vos moyennes à l'administration. Il reste grisé tant qu'il manque des notes : le message dessous dit combien. Il faut alors saisir les notes manquantes ou programmer au moins une évaluation.",
    placement: "top",
  },
]
