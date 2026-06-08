import type { Step } from "react-joyride"

export const dashboardTourSteps: Step[] = [
  {
    target: "[data-tour='dashboard-tabs']",
    title: "Navigation par onglets",
    content: "Basculez entre Vue d'ensemble, Présences et Salaires. Chaque onglet ne charge que ce dont vous avez besoin.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='dashboard-stats']",
    title: "Vue de synthèse",
    content: "Ces indicateurs vous donnent une vue instantanée sur vos professeurs, absences du jour, salaires et couverture des cours.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-tab-attendance']",
    title: "Onglet Présences",
    content: "Retrouvez plus en détails ici les présences du jour, les professeurs à risque et les absences d'élèves.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-tab-salaries']",
    title: "Onglet Salaires",
    content: "Consultez rapidement le récapitulatif des salaires du mois et les paiements en attente.",
    placement: "bottom",
  },
  {
    target: "[data-tour='dashboard-alerts']",
    title: "Alertes & notifications",
    content: "Ce bouton centralise toutes les alertes actives : absences élevées, validations en attente, salaires à traiter. Le badge rouge indique le nombre d'actions urgentes.",
    placement: "bottom-end",
  },
  {
    target: "[data-tour='dashboard-refresh']",
    title: "Rafraîchir les données",
    content: "Ce bouton permet de rafraîchir manuellement les données affichées. Utile si vous venez de valider des présences ou de traiter des salaires et que vous voulez voir les mises à jour immédiatement sans attendre le rafraîchissement automatique.",
    placement: "bottom",
  },
]

export const scheduleTourSteps: Step[] = [
  {
    target: "[data-tour='schedule-add-btn']",
    title: "Ajouter un créneau",
    content: "Ce bouton ouvre le formulaire pour créer un nouveau créneau : choisissez le professeur, la matière, la classe, la salle et le jour/horaire. Le créneau sera immédiatement visible dans la grille.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='schedule-periods']",
    title: "Navigation semaine et filtres",
    content: "Les flèches ◀ ▶ changent de semaine. Les menus 'Professeur' et 'Classe' sont des filtres : sélectionnez-en un pour ne voir que les créneaux de ce prof ou de cette classe. Utilisez 'Grille' ou 'Liste' pour changer l'affichage.",
    placement: "bottom",
  },
  {
    target: "[data-tour='schedule-grid']",
    title: "Voir, modifier ou supprimer un créneau",
    content: "Pour voir, modifier ou supprimer un créneau existant dans la grille, cliquez directement dessus.",
    placement: "center",
  },
]

export const teachersTourSteps: Step[] = [
  {
    target: "[data-tour='teachers-tab-liste']",
    title: "Onglet Liste - vue principale",
    content: "C'est l'onglet par défaut. Il affiche tous vos professeurs dans le tableau ci-dessous. Vous pouvez chercher, filtrer et cliquer sur une ligne pour ouvrir le profil complet du prof.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='teachers-tab-analyse']",
    title: "Onglet Analyse présence",
    content: "Cet onglet vous donne des statistiques détaillées sur la présence de chaque professeur sur une période que vous choisissez : taux de présence, absences, retards, salle incorrecte, pointages. Pratique pour repérer les profs peu assidus.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teachers-tab-classement']",
    title: "Onglet Classement",
    content: "Ce classement mensuel donne un score de conformité à chaque prof : il tient compte des présences, des scans de fin, de la bonne salle de cours et des pointages effectués. Plus le score est bas, plus le prof mérite votre attention.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teachers-filters']",
    title: "Filtres - affiner la liste",
    content: "Ces trois menus déroulants sont des filtres. Sélectionnez un type (vacataire ou permanent), un statut (actif ou bloqué) ou une matière pour réduire la liste. Les filtres se cumulent.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teachers-actions']",
    title: "Ajouter ou envoyer des identifiants",
    content: "Le bouton \"Ajouter un prof\" ouvre le formulaire de création. 'Envoyer les identifiants' envoie par email un mot de passe temporaire à tous les profs qui n'ont jamais reçu leurs accès à l'application de pointage. Vous pouvez reinitialiser le mot de passe d'un prof dans sa fiche.",
    placement: "left",
  },
]

export const teacherDetailTourSteps: Step[] = [
  {
    target: "[data-tour='teacher-detail-salary']",
    title: "Synthèse du mois en cours",
    content: "Ce bloc affiche pour le mois actuel : les heures prévues à l'EDT, les heures effectivement pointées, les heures d'absence, les heures restantes à faire et le statut du salaire (en attente, payé…). C'est une vue rapide avant d'aller dans le détail.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='teacher-detail-profile']",
    title: "Carte profil",
    content: "Les informations essentielles du prof : nom, matières, type de contrat (vacataire = payé à l'heure ; permanent = salaire fixe mensuel), statut et taux. Le bouton 'Bloquer' coupe immédiatement son accès à l'application de pointage.",
    placement: "right",
  },
  {
    target: "[data-tour='teacher-detail-weekly-schedule']",
    title: "EDT de la semaine",
    content: "Ce bloc affiche les créneaux de cours de ce professeur pour la semaine en cours et le lendemain. Cliquez sur 'Voir EDT semaine complète' pour afficher tous les jours. Si aucun créneau n'apparaît, le prof n'a pas été affecté à des cours dans l'emploi du temps.",
    placement: "top",
  },
  {
    target: "[data-tour='teacher-detail-tab-presences']",
    title: "Onglet Présences",
    content: "Cet onglet contient l'historique complet des séances du professeur : date, créneau, matière, statut (présent/absent/retard), heure d'entrée/sortie, salle et pointage des élèves. Changez le mois dans la section \"Mois analysé\". Le calendrier thermique donne une vue mensuelle d'un coup d'œil.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-detail-tab-documents']",
    title: "Onglet Documents",
    content: "Cet onglet permet de joindre et consulter les pièces RH du professeur : contrat, diplômes, justificatifs. Les documents déposés ici sont accessibles uniquement par la direction et le staff.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-detail-tab-infos']",
    title: "Onglet Infos",
    content: "Cet onglet permet de modifier les coordonnées du prof (email, téléphone, matières, type de contrat, taux horaire). C'est aussi ici que vous pouvez réinitialiser son mot de passe : un nouveau mot de passe temporaire est généré et envoyé par email. Le prof devra le changer à sa prochaine connexion.",
    placement: "bottom",
  },
]

export const studentsTourSteps: Step[] = [
  {
    target: "[data-tour='students-tab-liste']",
    title: "Onglet Liste - vue principale",
    content: "Liste complète de tous vos élèves. La colonne \"Absences mois\" affiche le nombre d'absences ce mois-ci. Les élèves avec trop d'absences apparaissent en rouge - cliquez sur leur ligne pour ouvrir leur fiche.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='students-tab-absences']",
    title: "Onglet Absences - vue analytique",
    content: "Cet onglet groupe les absences par élève sur une période choisie, triées du plus absent au moins absent. Utile pour identifier d'un seul coup d'œil les cas nécessitant un suivi renforcé.",
    placement: "bottom",
  },
  {
    target: "[data-tour='students-filters']",
    title: "Filtres - trouver un élève",
    content: "Le premier menu filtre par classe, le second par statut (actif / inactif). La barre de recherche permet de retrouver un élève par son nom. Ces filtres se combinent : vous pouvez filtrer \"Terminale A\" + \"actif\" simultanément.",
    placement: "bottom",
  },
  {
    target: "[data-tour='students-add-btn']",
    title: "Ajouter un élève",
    content: "Ce bouton ouvre le formulaire de création d'un élève : vous renseignez la classe, le nom, le prénom, le matricule et les numéros de téléphone des parents. Le téléphone/E-mail parent est nécessaire pour recevoir les alertes d'absence.",
    placement: "left",
  },
]

export const studentDetailTourSteps: Step[] = [
  {
    target: "[data-tour='student-detail-profile']",
    title: "Fiche identité",
    content: "Résumé de l'élève : nom, classe, matricule et date de naissance. Les badges indiquent si l'élève est actif et s'il est à risque ce mois-ci (rouge = plus de 3 absences = suivi renforcé recommandé).",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='student-detail-tab-absences']",
    title: "Onglet Absences",
    content: "Cet onglet liste chaque absence enregistrée : date, matière, créneau, statut (absent ou excusé) et statut du SMS envoyé au parent. Vous pouvez filtrer par mois, par matière ou par statut. Si vous avez le droit, le bouton 'Excuser' est disponible sur chaque ligne.",
    placement: "bottom",
  },
  {
    target: "[data-tour='student-detail-tab-informations']",
    title: "Onglet Informations",
    content: "Cet onglet contient les contacts des parents : nom, téléphone et email. Ces coordonnées sont utilisées pour les alertes SMS/E-mail d'absence. Modifiez-les ici si les informations changent.",
    placement: "bottom",
  },
  {
    target: "[data-tour='student-detail-tab-documents']",
    title: "Onglet Documents",
    content: "Cet onglet permet de joindre des pièces au dossier de l'élève : certificat de naissance, justificatifs d'absence, etc. Accessible uniquement par le staff autorisé.",
    placement: "bottom",
  },
  {
    target: "[data-tour='student-detail-tab-sms']",
    title: "Onglet SMS Parents",
    content: "Cet onglet liste tous les SMS envoyés aux parents de cet élève : date, motif, destinataire et statut (Livré, Envoyé, Échec). Si un SMS a échoué, le bouton 'Renvoyer' est disponible sur la ligne pour le remettre en file d'envoi.",
    placement: "bottom",
  },
  {
    target: "[data-tour='student-detail-absences']",
    title: "Statistiques d'absences",
    content: "Ces quatre cartes résument les absences total depuis l'inscription, ce mois-ci, cette semaine, et un graphique de présence estimée sur le mois. C'est ici que vous voyez rapidement si un élève décroche.",
    placement: "bottom",
  },
]

export const salariesTourSteps: Step[] = [
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
    target: "[data-tour='salaries-fixed-section']",
    title: "Section Permanents (salaire fixe)",
    content: "Les permanents ont un salaire mensuel fixe. Cliquez sur \"Marquer payé\" sur chaque ligne ou cochez plusieurs lignes pour un paiement groupé. Une fiche grisée signifie qu'il n'y a rien à payer ce mois-ci (aucun cours planifié).",
    placement: "bottom",
  },
]

export const validationsTourSteps: Step[] = [
  {
    target: "[data-tour='validations-short-hours']",
    title: "Onglet Heures à valider",
    content: "Cet onglet regroupe les cours dont la durée était plus courte que prévu. Pour chaque présence, vous choisissez : accorder les heures planifiées ou les heures réellement effectuées. Le montant du salaire vacataire est recalculé automatiquement.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='validations-tab-end-scan']",
    title: "Onglet Scan de fin",
    content: "Cet onglet recense les professeurs qui n'ont pas scanné la fin de leur cours. Sans scan de fin, le système ne peut pas confirmer l'heure réelle de sortie. Vous pouvez envoyer un avertissement, sanctionner, ou excuser chaque cas.",
    placement: "bottom",
  },
  {
    target: "[data-tour='validations-tab-gps']",
    title: "Onglet Présences suspectes",
    content: "Cet onglet affiche les présences pointées depuis un endroit géographiquement éloigné de la salle déclarée. Cela peut signaler un scan frauduleux ou une erreur de salle. Approuvez ou rejetez chaque présence après vérification.",
    placement: "bottom",
  },
  {
    target: "[data-tour='validations-bulk-checkbox']",
    title: "Validation groupée",
    content: "Cochez plusieurs présences d'un coup avec cette case à cocher, puis utilisez la barre flottante qui apparaît en bas pour tout valider en une seule action.",
    placement: "right",
  },
]

export const importTourSteps: Step[] = [
  {
    target: "[data-tour='import-header']",
    title: "Import de données - zone critique",
    content: "Cette page permet d'importer en masse trois types de données : les élèves, les professeurs et l'emploi du temps (EDT). Un import mal configuré peut écraser des données existantes - lisez attentivement chaque étape avant de confirmer.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='import-wizard-tab']",
    title: "Étape 1 - Choisir le type",
    content: "Commencez par sélectionner ce que vous voulez importer (élèves, professeurs ou EDT).",
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
    content: "Avant d'uploader le fichier, choisissez le mode d'import :\n• Fusion : ajoute les nouvelles données sans toucher aux existantes (recommandé pour les mises à jour).\n• Remplacement : efface TOUTES les données du type sélectionné et les remplace par le fichier. Attention ! À utiliser uniquement si vous refaites une saisie complète.",
    placement: "top",
  },
  {
    target: "[data-tour='import-periode-edt']",
    title: "Étape 3 - période de validité de l'EDT",
    content: "Pour l'import de l'emploi du temps, vous devez spécifier une période de validité (ex : Semaine, Mois, Trimestre…). Cette période détermine quand les créneaux sont actifs. Si vous importez un nouvel EDT pour remplacer l'actuel, vous devrez à nouveau spécifier une période de validité.",
    placement: "top",
  },
  {
    target: "[data-tour='import-validation']",
    title: "Étape 4 - Validation avant confirmation",
    content: "Après upload, le système analyse votre fichier ligne par ligne et liste les erreurs détectées (doublon, champ manquant, format incorrect…). Corrigez votre fichier Excel et re-uploadez-le si des erreurs bloquantes apparaissent. Aucune donnée n'est enregistrée tant que vous n'avez pas cliqué sur 'Confirmer l'import'.",
    placement: "top",
  },
  {
    target: "[data-tour='import-history']",
    title: "Historique des imports",
    content: "Tous les imports confirmés sont enregistrés ici : date, auteur, type, nombre de lignes importées et mises à jour. Utilisez les filtres mois/type pour retrouver un import passé. En cas d'erreur après confirmation, contactez IvoirEdu - certains imports peuvent être annulés dans les 24h.",
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
    title: "Liste des salles et QR Codes",
    content: "Chaque ligne propose : \"Voir QR\" pour afficher et imprimer le code QR de la salle, \"Régénérer\" pour regénérer le code QR nécessaire quand le nombre de scan de la salle dépasse un certain seuil, \"Modifier\" pour changer les infos, et \"Supprimer\". Imprimez et affichez les QR codes dans les salles pour que les profs puissent les scanner.",
    placement: "top",
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
    target: "[data-tour='subscriptions-add-btn']",
    title: "Créer un nouvel abonnement",
    content: "Ce bouton ouvre le formulaire de création. Saisissez le nom et les coordonnées du parent, choisissez la durée et l'enfant. Le parent reçoit ses identifiants par SMS/E-mail pour accéder au portail de suivi des absences. Vous pouvez aussi les lui transmettre manuellement après création.",
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

export const settingsTourSteps: Step[] = [
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
    target: "[data-tour='settings-positions-panel']",
    title: "Postes administratifs",
    content: "Créez et gérez ici les postes du personnel administratif (secrétaire, Censeur, comptable, surveillant…). Chaque poste peut se voir attribuer des droits précis : certains peuvent marquer les salaires payés, d'autres seulement consulter. Les droits sont cumulatifs avec le rôle.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-limits']",
    title: "Limites de l'école",
    content: "Ce bloc affiche les limites de votre forfait IvoirEdu : nombre maximum de professeurs, d'élèves et d'utilisateurs administratifs autorisés. Si une limite est atteinte, vous ne pourrez plus en ajouter de nouveaux. Contactez IvoirEdu pour faire évoluer votre forfait.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-admin-users']",
    title: "Utilisateurs administratifs",
    content: "Gérez ici les comptes du personnel administratif (hors professeurs). Pour chaque compte, vous assignez un poste créé au préalable qui détermine ses droits. Ces utilisateurs accèdent à l'interface web mais pas à l'application de pointage des profs.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-sms-templates-panel']",
    title: "Modèles de messages SMS",
    content: "Personnalisez le texte des SMS envoyés aux parents lors des absences. Les mots entre doubles accolades ({élève}, {matière}, {heure}) sont remplacés automatiquement par les vraies valeurs au moment de l'envoi.",
    placement: "top",
  },
  {
    target: "[data-tour='settings-sms']",
    title: "Service Alertes Parents",
    content: "Ce bloc apparaît si votre école utilise la facturation des alertes parents. Définissez ici le tarif par élève/mois (en FCFA) facturé aux parents abonnés. La commission IvoirEdu est calculée automatiquement sur ce montant.",
    placement: "top",
  },
]

export const teacherAppTourSteps: Step[] = [
  {
    target: "[data-tour='teacher-app-header']",
    title: "Mon planning",
    content: "Bienvenue dans votre application de pointage IvoirEdu. Cette page affiche vos cours de la semaine. Vous devez pointer chaque cours - début ET fin - pour que vos heures soient validées et intégrées dans votre salaire.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='teacher-app-compliance']",
    title: "Taux de conformité",
    content: "Ce score résume votre respect des pointages sur le mois en cours. Il tient compte des présences, des scans de fin manquants et des validations en attente. Un taux sous 80 % peut déclencher une alerte auprès de la direction.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-app-daypicker']",
    title: "Naviguer entre les jours",
    content: "Touchez un jour de la semaine pour afficher vos cours de ce jour. Les jours surlignés indiquent que vous avez des cours planifiés. Naviguez ainsi dans la semaine pour retrouver un cours passé ou à venir.",
    placement: "bottom",
  },
  {
    target: "[data-tour='teacher-app-courses']",
    title: "Cartes de cours",
    content: "Chaque carte représente un cours. Appuyez sur une carte pour démarrer le pointage : scannez le QR code de la salle ou utilisez votre position GPS. En fin de cours, revenez sur la carte et confirmez la fin de séance. Sans scan de fin, votre présence reste \"en cours\" et peut passer en validation manuelle.",
    placement: "top",
  },
]

export const parentPortalTourSteps: Step[] = [
  {
    target: "[data-tour='parent-student-selector']",
    title: "Sélectionner un enfant",
    content: "Si vous avez plusieurs enfants inscrits dans cet établissement, sélectionnez ici celui dont vous souhaitez consulter le suivi. Toutes les informations de la page se mettent à jour pour l'enfant sélectionné.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "[data-tour='parent-today-status']",
    title: "Présence aujourd'hui",
    content: "Ce bloc affiche le statut de présence de votre enfant pour les cours d'aujourd'hui. Vert = présent sur tous les cours passés. Rouge = au moins une absence détectée. Orange = les cours n'ont pas encore commencé. Le statut se met à jour en temps réel dès que le professeur pointe.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-stats']",
    title: "Statistiques de la semaine et du mois",
    content: "Ces deux cartes résument les absences de votre enfant : le nombre d'absences sur la semaine en cours, et le taux d'absence sur le mois. Un taux au-dessus de 20 % s'affiche en rouge - prenez contact avec l'établissement si nécessaire.",
    placement: "bottom",
  },
  {
    target: "[data-tour='parent-nav-links']",
    title: "Historique et emploi du temps",
    content: "Utilisez ces deux boutons pour consulter : l'historique complet des absences de votre enfant avec les détails de chaque séance, et l'emploi du temps de la semaine pour savoir quels cours sont prévus et à quelle heure.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-absences-tab']",
    title: "Détail des absences",
    content: "Ce menu vous présente la liste de toutes les absences enregistrées pour votre enfant : date, heure, matière. Vous pouvez filtrer par mois pour retrouver une absence spécifique.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-schedule-tab']",
    title: "Emploi du temps",
    content: "Ce menu vous présente l'emploi du temps de votre enfant pour savoir quels cours sont prévus et à quelle heure.",
    placement: "top",
  },
  {
    target: "[data-tour='parent-account-tab']",
    title: "Profil du parent",
    content: "Ce menu vous permet de voir vos informations personnelles et la durée restante de votre abonnement. Vous pouvez aussi changer votre mot de passe.",
    placement: "top",
  },
]
