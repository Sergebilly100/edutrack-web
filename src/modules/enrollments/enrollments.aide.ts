import type { AidePage } from "@/shared/aide/aide.types"

export const enrollmentsAide: AidePage = {
  id: "enrollments",
  espace: "Vie scolaire",
  titre: "Inscriptions",
  chemins: ["/enrollments"],
  roles: ["director", "staff"],
  requires: ["enrollments.view"],
  visite: "enrollments",
  resume:
    "Cette page suit tous les dossiers d'inscription de l'année en cours. Elle sert aussi à réinscrire les élèves de l'année précédente et à ouvrir la caisse pour confirmer un paiement.",
  prerequis: [
    "Une année scolaire doit être active : ouverte par IvoirEdu.",
    "Pour suivre les pièces des dossiers, configurez les documents requis dans Paramètres, onglet Académique.",
  ],
  taches: [
    {
      id: "nouvelle-inscription",
      titre: "Comment inscrire un nouvel élève ?",
      etapes: [
        "Cliquez sur « Nouvelle inscription » en haut de la page.",
        "Remplissez l'identité de l'élève, sa classe et les contacts du parent.",
        "Cliquez sur « Créer et continuer ».",
        "Cochez les pièces reçues, puis cliquez sur « Terminer le dossier ».",
        "Revenez ici et ouvrez « Caisse » pour enregistrer le paiement.",
      ],
      requires: ["enrollments.create"],
      reserve: "Réservé aux personnes qui peuvent créer des inscriptions",
    },
    {
      id: "retrouver-dossier",
      titre: "Comment retrouver un dossier d'inscription ?",
      etapes: [
        "Tapez le nom ou le matricule dans « Élève, nom ou matricule ».",
        "Affinez avec le niveau, la classe ou le statut.",
        "Cliquez sur la ligne pour ouvrir le dossier.",
        "Cliquez sur « Réinitialiser les filtres » pour recommencer.",
      ],
    },
    {
      id: "enregistrer-paiement",
      titre: "Comment confirmer l'inscription après le paiement ?",
      etapes: [
        "Cliquez sur les trois points à droite du dossier.",
        "Choisissez « Caisse ».",
        "Saisissez le montant reçu et la référence du reçu.",
        "Cliquez sur le bouton « Enregistrer » suivi du montant : l'inscription est confirmée.",
      ],
      requires: ["enrollments.confirm_payment"],
      reserve: "Réservé aux personnes qui tiennent la caisse",
    },
    {
      id: "reinscrire-eleve",
      titre: "Comment réinscrire un élève de l'année passée ?",
      etapes: [
        "Ouvrez l'onglet « Réinscriptions ».",
        "Retrouvez l'élève, avec les filtres si besoin.",
        "Choisissez sa classe d'accueil, et indiquez s'il est redoublant.",
        "Cliquez sur « Réinscrire ».",
        "Ouvrez ensuite « Caisse » dans l'onglet « Dossiers » pour le paiement.",
      ],
      requires: ["enrollments.create"],
      reserve: "Réservé aux personnes qui peuvent créer des inscriptions",
    },
    {
      id: "corriger-dossier",
      titre: "Comment corriger un dossier ?",
      etapes: [
        "Cliquez sur les trois points à droite du dossier.",
        "Choisissez « Modifier ».",
        "Corrigez l'identité, les contacts ou la classe.",
        "Cliquez sur « Enregistrer et continuer ».",
      ],
      requires: ["enrollments.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les inscriptions",
    },
  ],
  bonASavoir: [
    "Un dossier confirmé après paiement ne se modifie plus.",
    "Un élève n'est réinscrit qu'après la fin de l'année précédente et l'ouverture de la nouvelle année.",
    "Un élève avec un impayé de l'année passée ne peut pas être réinscrit avant régularisation à la caisse.",
    "Les élèves confirmés apparaissent ensuite dans la page « Élèves ».",
  ],
}

export const enrollmentNewAide: AidePage = {
  id: "enrollment-new",
  espace: "Vie scolaire",
  titre: "Nouvelle inscription",
  chemins: ["/enrollments/new", "/enrollments/:enrollmentId/edit"],
  roles: ["director", "staff"],
  requires: ["enrollments.create", "enrollments.edit"],
  visite: "enrollment-new",
  resume:
    "Ce formulaire crée le dossier d'un nouvel élève en deux étapes : d'abord l'élève et sa classe, ensuite les pièces du dossier. Le paiement se fait après, à la caisse.",
  taches: [
    {
      id: "remplir-formulaire",
      titre: "Comment remplir le formulaire ?",
      etapes: [
        "Renseignez le prénom, le nom, la date et le lieu de naissance.",
        "Choisissez le sexe et la nationalité, puis indiquez si l'élève est redoublant.",
        "Choisissez le niveau, puis la classe visée.",
        "Ajoutez le nom et le téléphone du parent.",
        "Cliquez sur « Créer et continuer ».",
      ],
    },
    {
      id: "pieces-dossier",
      titre: "Comment gérer les pièces du dossier ?",
      etapes: [
        "Dans l'étape « Documents », repérez les pièces marquées « Obligatoire ».",
        "Cliquez sur « Photo ou fichier » pour joindre chaque pièce reçue.",
        "Cliquez sur « Terminer le dossier ».",
        "Le parent reçoit un message si des pièces obligatoires manquent.",
      ],
    },
    {
      id: "bouton-bloque",
      titre: "Pourquoi le bouton « Créer et continuer » est grisé ?",
      etapes: [
        "Lisez le message à gauche du bouton : il indique ce qui manque.",
        "Complétez le champ signalé, par exemple la classe ou le lieu de naissance.",
        "Le bouton s'active quand tout est complet.",
      ],
    },
  ],
  bonASavoir: [
    "Le nom et le téléphone du parent vont ensemble : remplissez les deux, ou laissez les deux vides.",
    "Le téléphone du parent sert à envoyer les alertes d'absence et les rappels de pièces.",
    "Sans année scolaire active, on ne peut pas créer d'inscription.",
  ],
}

export const enrollmentPaymentAide: AidePage = {
  id: "enrollment-payment",
  espace: "Vie scolaire",
  titre: "Confirmation caisse",
  chemins: ["/enrollments/:enrollmentId/payment"],
  roles: ["director", "staff"],
  requires: ["enrollments.confirm_payment"],
  resume:
    "Cette page enregistre le paiement déjà reçu pour confirmer une inscription. Vous recopiez le montant et la référence du reçu présenté par le parent.",
  prerequis: [
    "Le plan de frais du niveau et de l'année doit être enregistré, sinon le paiement ne peut pas être confirmé.",
  ],
  taches: [
    {
      id: "confirmer-paiement",
      titre: "Comment confirmer un paiement ?",
      etapes: [
        "Vérifiez la classe et le reste de scolarité affichés en haut.",
        "Saisissez le montant reçu, au moins égal au minimum indiqué.",
        "Choisissez le mode de paiement.",
        "Recopiez la référence du reçu de caisse.",
        "Cliquez sur « Enregistrer ».",
      ],
    },
    {
      id: "frais-non-configures",
      titre: "Que faire si les frais ne sont pas configurés ?",
      etapes: [
        "Lisez le message : il indique le niveau et l'année concernés.",
        "Cliquez sur « Configurer les frais ».",
        "Enregistrez le plan de frais de ce niveau.",
        "Vous revenez automatiquement à ce paiement.",
      ],
      requires: ["tuition.edit"],
      reserve: "Réservé aux personnes qui configurent les frais : demandez à la direction",
    },
  ],
  bonASavoir: [
    "Cette page enregistre un paiement déjà reçu : elle n'encaisse pas d'argent.",
    "Le montant ne peut pas dépasser le reste de scolarité.",
    "Le numéro du parent est nécessaire pour valider : ajoutez-le dans le dossier s'il manque.",
  ],
}

export const enrollmentDocumentsAide: AidePage = {
  id: "enrollment-documents",
  espace: "Vie scolaire",
  titre: "Documents du dossier",
  chemins: ["/enrollments/students/:studentId/documents"],
  roles: ["director", "staff"],
  requires: ["enrollments.view"],
  resume:
    "Cette page liste les pièces demandées pour le niveau de l'élève. Vous y ajoutez les pièces reçues ou vous demandez leur renouvellement.",
  taches: [
    {
      id: "ajouter-piece",
      titre: "Comment ajouter une pièce reçue ?",
      etapes: [
        "Repérez la pièce dans la liste.",
        "Cliquez sur « Photo ou fichier » sur la ligne de cette pièce.",
        "Choisissez le fichier sur l'appareil.",
        "Cliquez sur « Consulter » pour vérifier qu'il s'ouvre bien.",
      ],
      requires: ["enrollments.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les inscriptions",
    },
    {
      id: "renouveler-piece",
      titre: "Comment demander le renouvellement d'une pièce ?",
      etapes: [
        "Repérez la pièce périmée ou illisible.",
        "Cliquez sur « À renouveler » (visible quand la pièce est fournie).",
        "La pièce repasse en attente jusqu'à l'ajout d'un nouveau fichier.",
      ],
      requires: ["enrollments.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les inscriptions",
    },
  ],
  bonASavoir: [
    "Les pièces marquées « Obligatoire » bloquent la complétude du dossier.",
    "La liste des pièces se règle dans Paramètres, onglet Académique.",
  ],
}
