import type { AidePage } from "@/shared/aide/aide.types"

const ESPACE = "Académique"

export const schoolYearsAide: AidePage = {
  id: "school-years",
  espace: ESPACE,
  titre: "Structure scolaire : années et périodes",
  chemins: ["/academic/school-years"],
  roles: ["director", "staff"],
  requires: ["school_years.view"],
  visite: "school-years",
  resume:
    "Cette page règle le calendrier de l'année : les périodes d'évaluation et la date d'ouverture de la fin d'année. Les dates décident quand les professeurs saisissent leurs avis et quand on prépare les bulletins.",
  prerequis: ["L'année scolaire est ouverte par IvoirEdu. Sans année, la page affiche « Aucune année scolaire »."],
  taches: [
    {
      id: "modifier-periode",
      titre: "Comment modifier les dates d'une période ?",
      etapes: [
        "Cliquez sur la période pour l'ouvrir.",
        "Cliquez sur « Modifier » suivi du nom de la période.",
        "Changez le début, le début de revue ou la fin.",
        "Lisez le message « Impact », puis cliquez sur « Enregistrer ».",
      ],
      requires: ["school_years.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les années scolaires",
    },
    {
      id: "ajouter-periode",
      titre: "Comment ajouter une période ?",
      etapes: [
        "Descendez sous les périodes existantes.",
        "Saisissez le nom et les trois dates de la nouvelle période.",
        "Cliquez sur « Ajouter la période ».",
      ],
      requires: ["school_years.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les années scolaires",
    },
    {
      id: "ouvrir-fin-annee",
      titre: "Comment ouvrir la fin d'année ?",
      etapes: [
        "Dans « Décisions de fin d'année », choisissez la date d'ouverture.",
        "Cliquez sur le bouton d'enregistrement de cette date.",
        "À partir de cette date, cliquez sur « Ouvrir Fin d'année ».",
      ],
      requires: ["school_years.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les années scolaires",
    },
  ],
  bonASavoir: [
    "La « revue » ouvre la conduite et la préparation des bulletins ; les notes restent modifiables jusqu'à la validation de chaque matière.",
    "Une période dont les bulletins sont générés est figée : ses dates ne changent plus.",
    "La date d'ouverture de la fin d'année doit précéder la fin de l'année scolaire.",
    "Modifier la période courante demande une confirmation : les dates changent pour tout le monde.",
  ],
}

export const levelsAide: AidePage = {
  id: "levels",
  espace: ESPACE,
  titre: "Structure scolaire : niveaux",
  chemins: ["/academic/levels"],
  roles: ["director", "staff"],
  requires: ["classes.view"],
  resume:
    "Cette page liste les niveaux de l'école, comme 6ème ou Terminale, dans leur ordre d'affichage. Les classes et les matières se rattachent à un niveau.",
  taches: [
    {
      id: "ajouter-niveau",
      titre: "Comment ajouter un niveau ?",
      etapes: [
        "Cliquez sur « Ajouter un niveau ».",
        "Saisissez le nom du niveau, par exemple « 6ème ».",
        "Indiquez l'ordre d'affichage.",
        "Activez « Classe d'examen » si le niveau passe un examen.",
        "Cliquez sur « Enregistrer ».",
      ],
      requires: ["classes.create"],
      reserve: "Réservé aux personnes qui peuvent créer des classes et niveaux",
    },
    {
      id: "modifier-niveau",
      titre: "Comment modifier un niveau ?",
      etapes: [
        "Repérez le niveau dans la liste.",
        "Cliquez sur « Modifier ».",
        "Changez le nom, l'ordre ou l'option examen, puis enregistrez.",
      ],
      requires: ["classes.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les classes et niveaux",
    },
  ],
  bonASavoir: [
    "L'ordre détermine l'affichage des niveaux dans toutes les listes de l'application.",
    "Créez les niveaux avant les classes et les matières : sans niveau, on ne peut pas créer de classe.",
  ],
}

export const classesAide: AidePage = {
  id: "classes",
  espace: ESPACE,
  titre: "Structure scolaire : classes",
  chemins: ["/academic/classes"],
  roles: ["director", "staff"],
  requires: ["classes.view"],
  resume:
    "Cette page liste les classes de chaque année scolaire et leur professeur principal. Les inscriptions se font ensuite dans ces classes.",
  prerequis: ["Créez d'abord les niveaux : une classe est toujours rattachée à un niveau."],
  taches: [
    {
      id: "ajouter-classe",
      titre: "Comment ajouter une classe ?",
      etapes: [
        "Cliquez sur « Ajouter une classe ».",
        "Saisissez le libellé, par exemple « 6ème A ».",
        "Choisissez le niveau.",
        "Choisissez si besoin le professeur principal, puis enregistrez.",
      ],
      requires: ["classes.create"],
      reserve: "Réservé aux personnes qui peuvent créer des classes",
    },
    {
      id: "changer-prof-principal",
      titre: "Comment changer le professeur principal ?",
      etapes: [
        "Repérez la classe dans la liste.",
        "Cliquez sur « Modifier ».",
        "Choisissez le nouveau professeur principal, ou « Aucun professeur principal ».",
        "Enregistrez.",
      ],
      requires: ["classes.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les classes",
    },
    {
      id: "archiver-classe",
      titre: "Comment archiver une classe ?",
      etapes: [
        "Repérez la classe dans la liste.",
        "Cliquez sur « Archiver ».",
        "Lisez l'avertissement de la fenêtre, puis confirmez.",
      ],
      requires: ["classes.delete"],
      reserve: "Réservé à la direction",
    },
    {
      id: "autre-annee",
      titre: "Comment voir les classes d'une autre année ?",
      etapes: [
        "Ouvrez le menu « Année scolaire ».",
        "Choisissez l'année voulue.",
        "Les classes d'une année non active sont en lecture seule.",
      ],
      requires: ["school_years.view"],
      reserve: "Réservé aux personnes qui peuvent consulter les années scolaires",
    },
  ],
  bonASavoir: [
    "Une nouvelle classe est rattachée à l'année scolaire active.",
    "Les classes d'une année non active ne se modifient pas.",
    "Le professeur principal est facultatif.",
  ],
}

export const subjectsAide: AidePage = {
  id: "subjects",
  espace: ESPACE,
  titre: "Structure scolaire : matières",
  chemins: ["/academic/subjects"],
  roles: ["director", "staff"],
  requires: ["classes.view"],
  resume:
    "Cette page liste les matières enseignées et leur coefficient dans chaque niveau. Le coefficient pèse dans le calcul des moyennes.",
  prerequis: ["Créez d'abord les niveaux : le bouton « Ajouter une matière » reste grisé sans niveau."],
  taches: [
    {
      id: "ajouter-matiere",
      titre: "Comment ajouter une matière ?",
      etapes: [
        "Cliquez sur « Ajouter une matière ».",
        "Saisissez le nom, par exemple « Mathématiques ».",
        "Choisissez le coefficient par défaut et, si besoin, l'abréviation pour l'EDT.",
        "Cochez les niveaux concernés, puis cliquez sur « Ajouter aux niveaux ».",
      ],
      requires: ["classes.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les classes et matières",
    },
    {
      id: "changer-coefficient",
      titre: "Comment changer un coefficient ?",
      etapes: [
        "Repérez la matière dans la liste.",
        "Cliquez sur « Modifier ».",
        "Changez le coefficient du niveau voulu, ou ajoutez la matière à un autre niveau.",
        "Enregistrez.",
      ],
      requires: ["classes.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les classes et matières",
    },
  ],
  bonASavoir: [
    "Le coefficient est propre à chaque niveau : une même matière peut peser différemment en 6ème et en 3ème.",
    "L'abréviation s'affiche sur les emplois du temps ; le nom officiel reste utilisé ailleurs.",
  ],
}

export const evaluationsAide: AidePage = {
  id: "evaluations",
  espace: ESPACE,
  titre: "Suivi des évaluations et notes",
  chemins: ["/academic/evaluations"],
  roles: ["director", "staff"],
  requires: ["evaluations.view"],
  visite: "evaluations",
  resume:
    "Cette page suit les évaluations des professeurs et la saisie des notes. Elle vous montre qui est en retard et permet de le relancer.",
  prerequis: ["Une période d'évaluation doit être configurée pour l'année, dans Structure scolaire."],
  taches: [
    {
      id: "choisir-periode",
      titre: "Comment regarder une classe ou une matière précise ?",
      etapes: [
        "Choisissez l'année et la période.",
        "Choisissez le niveau, puis la classe, puis la matière, puis le professeur.",
        "Lisez les cartes de synthèse et la liste en dessous.",
      ],
    },
    {
      id: "voir-manquantes",
      titre: "Comment voir quelles notes manquent ?",
      etapes: [
        "Lisez les cartes « Notes saisies » et « Notes manquantes ».",
        "Triez la liste par « Retard » pour voir les plus en retard d'abord.",
        "Ouvrez une évaluation pour voir la progression des notes de la classe.",
      ],
    },
    {
      id: "relancer-professeur",
      titre: "Comment relancer un professeur en retard ?",
      etapes: [
        "Repérez l'évaluation en retard.",
        "Cliquez sur « Relancer ».",
        "Lisez l'aperçu du message : il part en notification dans l'application.",
        "Confirmez l'envoi.",
      ],
    },
    {
      id: "relance-groupee",
      titre: "Comment relancer plusieurs professeurs d'un coup ?",
      etapes: [
        "Cliquez sur « Relance groupée ».",
        "Cochez les évaluations à relancer.",
        "Cliquez sur « Relancer la sélection » et confirmez.",
      ],
    },
    {
      id: "notes-spontanees",
      titre: "Comment retrouver les notes d'un élève hors programme ?",
      etapes: [
        "Ouvrez l'onglet « Notes spontanées ».",
        "Tapez le nom ou le matricule dans « Rechercher un élève ».",
        "Cliquez sur « Rechercher ».",
      ],
    },
  ],
  bonASavoir: [
    "Un seul message est envoyé par professeur, même si plusieurs évaluations sont relancées.",
    "Seules les évaluations en retard peuvent être relancées.",
    "Cette page consulte les notes : elles se saisissent dans l'espace du professeur.",
  ],
}

export const conductAide: AidePage = {
  id: "conduct",
  espace: ESPACE,
  titre: "Conduite : décisions",
  chemins: ["/academic/conduct"],
  roles: ["director", "staff"],
  requires: ["conduct.finalize"],
  resume:
    "Cette page sert à arrêter la note de conduite finale de chaque élève, à partir des avis des professeurs. Les bulletins ne se génèrent pas sans cette note.",
  prerequis: [
    "La revue de conduite doit être ouverte pour la période : voir Structure scolaire, date « Début de revue ».",
    "Une classe doit vous être confiée : le mode de décision se règle dans Paramètres, onglet Personnel.",
  ],
  taches: [
    {
      id: "arreter-note",
      titre: "Comment arrêter la note de conduite d'un élève ?",
      etapes: [
        "Choisissez l'année, le niveau, la classe et la période.",
        "Cliquez sur l'élève dans la liste.",
        "Lisez les avis des professeurs et leurs observations.",
        "Saisissez la « Note finale / 20 ».",
        "Cliquez sur « Arrêter la note ».",
      ],
    },
    {
      id: "suivre-avancement",
      titre: "Comment savoir combien d'élèves restent à noter ?",
      etapes: [
        "Choisissez la classe et la période.",
        "Lisez le badge « décisions » au-dessus de la liste, par exemple 12/30.",
        "Cliquez sur les élèves restants un à un.",
      ],
    },
  ],
  bonASavoir: [
    "Les avis manquants des professeurs ne bloquent pas la décision.",
    "Hors de la période de revue, la page est en lecture seule : « Revue à venir » ou « Revue clôturée ».",
    "Une fois les bulletins générés, la note ne change plus.",
  ],
}

export const reportCardsAide: AidePage = {
  id: "report-cards",
  espace: ESPACE,
  titre: "Bulletins",
  chemins: ["/academic/report-cards"],
  roles: ["director", "staff"],
  requires: ["report_cards.view", "report_cards.publish"],
  visite: "report-cards",
  resume:
    "Cette page prépare, génère et publie les bulletins, classe par classe et période par période. Un bulletin publié devient visible par les parents.",
  prerequis: [
    "La période doit être en revue : sinon la génération est indisponible.",
    "Chaque matière doit être clôturée et validée, et chaque élève doit avoir une moyenne générale.",
    "La note de conduite finale de chaque élève doit être arrêtée dans « Conduite ».",
  ],
  taches: [
    {
      id: "generer-bulletins",
      titre: "Comment générer les bulletins d'une classe ?",
      etapes: [
        "Choisissez l'année, la classe et la période.",
        "Dans « Préparation de la classe », vérifiez que chaque matière est terminée.",
        "Lisez le message à côté du bouton : il dit ce qui manque.",
        "Cliquez sur « Générer les bulletins de la classe ».",
      ],
      requires: ["report_cards.publish"],
      reserve: "Réservé aux personnes qui peuvent publier les bulletins",
    },
    {
      id: "publier-bulletins",
      titre: "Comment publier les bulletins ?",
      etapes: [
        "Repérez les bulletins « Généré » dans « Bulletins de la classe ».",
        "Cliquez sur « Publier » pour un bulletin, ou « Publier tous les générés ».",
        "Les parents voient alors les bulletins publiés.",
      ],
      requires: ["report_cards.publish"],
      reserve: "Réservé aux personnes qui peuvent publier les bulletins",
    },
    {
      id: "telecharger-bulletin",
      titre: "Comment télécharger un bulletin en PDF ?",
      etapes: [
        "Repérez l'élève dans « Bulletins de la classe ».",
        "Cliquez sur « PDF » sur sa ligne.",
        "Attendez la préparation du fichier.",
      ],
    },
    {
      id: "corriger-note",
      titre: "Comment corriger une erreur après la génération ?",
      etapes: [
        "Dans « Préparation de la classe », cliquez sur « Ouvrir une réclamation » sur la matière.",
        "Décrivez l'erreur constatée.",
        "Attendez la décision : après approbation, les bulletins générés sont invalidés.",
        "Régénérez puis republiez les bulletins.",
      ],
      requires: ["report_cards.view", "report_cards.publish"],
      reserve: "Réservé aux personnes qui gèrent les bulletins",
    },
  ],
  bonASavoir: [
    "Une correction approuvée retire les bulletins publiés et impose une nouvelle publication.",
    "Une année clôturée est en lecture seule : on ne génère plus de bulletins.",
    "La génération est figée par période : choisissez la bonne période avant de lancer.",
  ],
}

export const reportCardClaimsAide: AidePage = {
  id: "report-card-claims",
  espace: ESPACE,
  titre: "Réclamations de bulletins",
  chemins: ["/academic/report-card-claims"],
  roles: ["director", "staff"],
  requires: ["report_cards.view", "report_cards.publish"],
  resume:
    "Cette page suit les demandes de correction d'un bulletin déjà généré ou publié. Chaque décision est tracée avec ses versions.",
  taches: [
    {
      id: "ouvrir-reclamation",
      titre: "Comment ouvrir une réclamation ?",
      etapes: [
        "Cliquez sur « Nouvelle réclamation ».",
        "Choisissez la classe, la période et la matière.",
        "Choisissez « Un élève » ou « Toute la classe ».",
        "Décrivez l'erreur en au moins 10 caractères, puis validez.",
      ],
    },
    {
      id: "decider-reclamation",
      titre: "Comment approuver ou refuser une réclamation ?",
      etapes: [
        "Cliquez sur la réclamation dans la liste.",
        "Lisez le motif et le journal des modifications.",
        "Saisissez le motif de votre décision, au moins 10 caractères.",
        "Cliquez sur « Refuser » ou sur le bouton d'approbation.",
      ],
      requires: ["report_cards.published_correction"],
      reserve: "Réservé aux personnes qui peuvent autoriser une correction exceptionnelle",
    },
    {
      id: "filtrer-reclamations",
      titre: "Comment retrouver une réclamation ?",
      etapes: [
        "Choisissez un statut dans « Filtrer par statut ».",
        "Choisissez une classe ou une matière.",
        "Tapez le nom de l'élève dans « Nom de l'élève ».",
      ],
    },
  ],
  bonASavoir: [
    "Une approbation invalide tous les bulletins générés de la classe et de la période.",
    "Après approbation, il faut régénérer puis republier les bulletins.",
    "Les anciennes versions publiées restent archivées.",
  ],
}

export const endOfYearAide: AidePage = {
  id: "end-of-year",
  espace: ESPACE,
  titre: "Fin d'année",
  chemins: ["/end-of-year"],
  roles: ["director", "staff"],
  requires: ["class_decisions.view"],
  visite: "end-of-year",
  resume:
    "Cette page valide la décision de chaque élève à la fin de l'année : admis, redoublant ou exclu, avec son niveau suivant. Ces décisions servent ensuite à la réinscription.",
  prerequis: [
    "Le menu n'apparaît qu'à la date d'ouverture réglée dans Structure scolaire.",
    "Les moyennes générales des élèves doivent être calculées pour obtenir une suggestion.",
  ],
  taches: [
    {
      id: "decider-eleve",
      titre: "Comment valider la décision d'un élève ?",
      etapes: [
        "Filtrez par niveau et par classe.",
        "Lisez la moyenne générale et la suggestion.",
        "Choisissez « Admis(e) », « Redouble » ou « Exclu(e) ».",
        "Choisissez le niveau suivant, puis cliquez sur « Valider ».",
      ],
      requires: ["class_decisions.validate"],
      reserve: "Réservé aux personnes qui peuvent valider les décisions de fin d'année",
    },
    {
      id: "decision-automatique",
      titre: "Comment décider pour toute une classe d'un coup ?",
      etapes: [
        "Choisissez un niveau pour activer « Décision automatique ».",
        "Saisissez la moyenne seuil d'admission, sur 20.",
        "Choisissez la décision au-dessus et en dessous du seuil.",
        "Cliquez sur « Voir la prévisualisation » et relisez-la.",
        "Cliquez sur « Valider définitivement ».",
      ],
      requires: ["class_decisions.validate"],
      reserve: "Réservé aux personnes qui peuvent valider les décisions de fin d'année",
    },
    {
      id: "corriger-decision",
      titre: "Comment changer une décision déjà validée ?",
      etapes: [
        "Repérez l'élève dans la liste.",
        "Changez la décision ou le niveau suivant.",
        "Cliquez sur « Mettre à jour ».",
      ],
      requires: ["class_decisions.validate"],
      reserve: "Réservé aux personnes qui peuvent valider les décisions de fin d'année",
    },
  ],
  bonASavoir: [
    "Les élèves dont la moyenne est en attente n'entrent pas dans la validation groupée.",
    "Un élève exclu n'a pas de niveau suivant et ne peut pas être réinscrit.",
    "La réinscription n'est possible qu'après ces décisions : voir la page Inscriptions.",
  ],
}
