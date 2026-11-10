import type { AidePage } from "@/shared/aide/aide.types"

const ESPACE = "Espace professeur"

export const teacherDashboardAide: AidePage = {
  id: "teacher-dashboard",
  espace: ESPACE,
  titre: "Aujourd'hui",
  chemins: ["/dashboard"],
  roles: ["teacher"],
  visite: "teacher-dashboard",
  resume:
    "Cette page résume votre journée : votre prochain cours, la liste de vos cours d'aujourd'hui, la conduite à renseigner et vos classes. C'est le point de départ pour pointer ou saisir des notes.",
  taches: [
    {
      id: "ouvrir-cours",
      titre: "Comment ouvrir mon cours du moment ?",
      etapes: [
        "Lisez la carte « Cours en cours » ou « Prochain cours ».",
        "Cliquez sur « Ouvrir le cours » ou « Préparer le cours ».",
        "Vous arrivez sur « Mes cours », où se fait le pointage.",
      ],
    },
    {
      id: "notes-classe",
      titre: "Comment saisir les notes d'une de mes classes ?",
      etapes: [
        "Descendez jusqu'à « Mes classes et périodes ».",
        "Cliquez sur la classe voulue.",
        "L'espace de notes s'ouvre sur la période en cours.",
      ],
    },
    {
      id: "avis-conduite",
      titre: "Comment renseigner les avis de conduite ?",
      etapes: [
        "Repérez le bloc « Conduite à renseigner » : il n'apparaît que si la revue est ouverte.",
        "Cliquez sur la ligne de la classe : elle indique le nombre d'avis restants.",
        "Saisissez une note et une observation pour chaque élève.",
      ],
    },
    {
      id: "lire-notifications",
      titre: "Comment lire mes notifications ?",
      etapes: [
        "Cliquez sur la cloche en haut à droite.",
        "Lisez les messages de l'école, par exemple une relance pour une note manquante.",
        "Ouvrez la page concernée pour traiter la demande.",
      ],
    },
  ],
  bonASavoir: [
    "Les cours listés sont ceux de l'emploi du temps : ils sont placés par la direction.",
    "Une journée sans cours affiche « Journée libre ».",
    "Le bloc « Conduite à renseigner » disparaît quand la revue est terminée.",
  ],
}

export const teacherAppAide: AidePage = {
  id: "teacher-app",
  espace: ESPACE,
  titre: "Mes cours : pointage",
  chemins: ["/attendance"],
  roles: ["teacher"],
  visite: "teacher-app",
  resume:
    "Cette page liste vos cours de la semaine et sert à pointer : votre présence, le pointage des élèves et la fin du cours. C'est ce pointage qui valide vos heures et alimente votre salaire.",
  prerequis: [
    "Vos cours doivent être placés dans l'emploi du temps par la direction, avec une salle.",
    "Chaque salle a un QR code affiché par l'école : sans lui, vous ne pouvez pas confirmer votre présence, sauf si l'école a rendu le scan facultatif.",
    "Hors connexion, le pointage est mis en attente puis synchronisé tout seul au retour du réseau.",
  ],
  taches: [
    {
      id: "pointer-debut",
      titre: "Comment pointer au début d'un cours ?",
      etapes: [
        "Choisissez le jour, puis cliquez sur « Démarrer le cours » sur la carte (dès 5 minutes avant le début).",
        "Cliquez sur « Je suis présent(e) ».",
        "Scannez le QR code de la salle : « Présence confirmée » s'affiche.",
        "Faites ensuite le pointage des élèves, ou choisissez « Le faire plus tard ».",
      ],
    },
    {
      id: "faire-appel",
      titre: "Comment faire l'appel des élèves ?",
      etapes: [
        "Après la présence, choisissez « Faire l'appel maintenant ».",
        "Touchez « Présent » ou « Absent » pour chaque élève.",
        "Le bouton de validation reste grisé tant qu'il reste des élèves à marquer.",
        "Cliquez sur « Valider l'appel » avec le nombre d'absents.",
      ],
    },
    {
      id: "appel-plus-tard",
      titre: "Comment faire l'appel plus tard ?",
      etapes: [
        "Choisissez « Le faire plus tard » dans la fenêtre qui s'ouvre.",
        "Revenez sur la carte du cours.",
        "Cliquez sur « Faire le pointage des élèves » avant l'heure limite : 15 minutes après la fin du cours.",
      ],
    },
    {
      id: "terminer-cours",
      titre: "Comment terminer un cours ?",
      etapes: [
        "Après l'appel validé, l'étape de fin du cours s'ouvre.",
        "Scannez le QR code de la salle, le même qu'au début.",
        "Cliquez sur « Terminer le cours ».",
        "Fenêtre fermée ? Utilisez « Terminer le cours » sur la carte, dans les 30 minutes après la fin.",
      ],
    },
    {
      id: "qr-impossible",
      titre: "Que faire si le scan du QR code ne marche pas ?",
      etapes: [
        "Dans l'étape « Salle », saisissez le code dans « Entrer le code manuellement ».",
        "Cliquez sur « Valider ».",
        "Si le bouton « Valider sans QR » est proposé, vous pouvez l'utiliser : l'école a rendu le scan facultatif.",
        "Sinon, prévenez la direction : elle pourra valider votre présence.",
      ],
    },
    {
      id: "corriger-appel",
      titre: "Comment corriger l'appel d'un élève ?",
      etapes: [
        "Ouvrez la carte du cours dont l'appel est fait.",
        "Cliquez sur « Modifier l'appel ».",
        "Changez le statut de l'élève, par exemple absent devenu présent.",
        "Validez de nouveau.",
      ],
    },
    {
      id: "note-spontanee",
      titre: "Comment donner une note spontanée à un élève ?",
      etapes: [
        "Une fois votre présence validée, cliquez sur « Note spontanée » sur la carte.",
        "Choisissez l'élève.",
        "Ajoutez ou retirez des points avec les boutons ou le champ « Points ».",
        "Saisissez le justificatif, qui est obligatoire, puis cliquez sur « Enregistrer ».",
      ],
    },
  ],
  bonASavoir: [
    "Sans scan de fin, votre présence passe en validation manuelle par la direction.",
    "La note spontanée reste possible jusqu'à 24 heures après la fin du cours.",
    "« Poursuivre le pointage » reprend un pointage commencé si vous avez fermé la fenêtre.",
    "Un cours sans pointage apparaît « Non pointé » : prévenez la direction.",
  ],
}

export const teacherNotesAide: AidePage = {
  id: "teacher-notes",
  espace: ESPACE,
  titre: "Notes et moyennes",
  chemins: ["/academic/notes"],
  roles: ["teacher"],
  visite: "teacher-notes",
  resume:
    "Cet espace regroupe votre travail sur les notes : programmer des évaluations, saisir les notes, calculer puis valider les moyennes de chaque matière, et renseigner la conduite quand la revue est ouverte.",
  prerequis: [
    "La direction doit vous avoir attribué la classe et la matière : sinon la liste reste vide.",
    "Une période d'évaluation doit être ouverte pour la classe : voir Structure scolaire côté direction.",
    "L'onglet « Conduite » n'apparaît que pendant la revue de conduite ; « Décisions » seulement si on vous confie la décision.",
  ],
  taches: [
    {
      id: "programmer-evaluation",
      titre: "Comment programmer une évaluation ?",
      etapes: [
        "Dans « Évaluations », choisissez la classe et la période.",
        "Cliquez sur « Programmer une évaluation ».",
        "Choisissez la date, puis la matière et, si besoin, le créneau de cours.",
        "Donnez un libellé, par exemple « Devoir surveillé n°1 », et un coefficient.",
        "Cliquez sur « Programmer ».",
      ],
    },
    {
      id: "saisir-notes",
      titre: "Comment saisir les notes d'une évaluation ?",
      etapes: [
        "Touchez l'évaluation dans la liste.",
        "Saisissez la note de chaque élève, puis cliquez sur « Enregistrer ».",
        "Utilisez « Effacer » pour retirer une note.",
        "Le compteur de l'évaluation indique les notes déjà saisies.",
      ],
    },
    {
      id: "calculer-moyennes",
      titre: "Comment calculer puis valider mes moyennes ?",
      etapes: [
        "Ouvrez l'onglet « Moyennes » et choisissez la classe et la période.",
        "Sur la matière, cliquez sur « Démarrer le calcul » quand toutes les notes sont saisies.",
        "Vérifiez les notes par élève, puis les moyennes sur 20.",
        "Cliquez sur « Valider mes moyennes » : elles sont transmises à l'administration.",
      ],
    },
    {
      id: "notes-manquantes",
      titre: "Que faire s'il manque des notes ?",
      etapes: [
        "Lisez le message sur la carte de la matière : saisie à terminer ou évaluation à programmer.",
        "Cliquez sur « Saisir les notes ».",
        "Complétez les notes manquantes, puis revenez aux moyennes.",
      ],
    },
    {
      id: "avis-conduite",
      titre: "Comment saisir les avis de conduite ?",
      etapes: [
        "Ouvrez l'onglet « Conduite » (visible quand la revue est ouverte).",
        "Choisissez la classe et la période.",
        "Pour chaque élève, saisissez la note sur 20 et une observation facultative, puis « Enregistrer ».",
        "Pour gagner du temps, cochez des élèves et utilisez « Attribution en masse ».",
      ],
    },
  ],
  bonASavoir: [
    "Le coefficient d'une évaluation pondère cette évaluation, sans changer celui de la matière.",
    "Après validation, les moyennes d'une matière ne se modifient plus : seule une correction approuvée par la direction les rouvre.",
    "Une classe et une période clôturées restent consultables, mais plus modifiables.",
    "Une note spontanée donnée en cours compte dans la moyenne : retrouvez-la dans le détail de l'élève.",
  ],
}

export const teacherCalculationAide: AidePage = {
  id: "teacher-calculation",
  espace: ESPACE,
  titre: "Calcul des moyennes",
  chemins: ["/academic/calculation"],
  roles: ["teacher"],
  visite: "teacher-calculation",
  resume:
    "Cette page calcule les moyennes d'une matière pour une classe et une période. Vous contrôlez les notes puis vous validez : les moyennes partent alors à l'administration.",
  prerequis: ["Toutes les notes des évaluations programmées doivent être saisies : sinon la validation reste grisée."],
  taches: [
    {
      id: "valider-moyennes",
      titre: "Comment valider mes moyennes ?",
      etapes: [
        "Vérifiez les « Notes par élève » : cliquez sur le détail d'un élève pour voir chaque note.",
        "Cliquez sur « Voir les moyennes par élève ».",
        "Relisez les moyennes sur 20.",
        "Cliquez sur « Valider mes moyennes ».",
      ],
    },
    {
      id: "revenir-notes",
      titre: "Comment corriger une note avant de valider ?",
      etapes: [
        "Cliquez sur « Retour aux moyennes » en haut de la page.",
        "Sur la matière, cliquez sur « Saisir les notes » et corrigez la note.",
        "Revenez au calcul et cliquez sur « Recalculer les moyennes ».",
        "Relisez les moyennes, puis validez.",
      ],
    },
  ],
  bonASavoir: [
    "Après validation, les moyennes restent consultables mais ne sont plus modifiables.",
    "Si une classe et une période sont clôturées, une correction approuvée par la direction peut les rouvrir.",
    "Le message sous le bouton de validation indique ce qui manque.",
  ],
}
