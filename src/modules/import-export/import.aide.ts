import type { AidePage } from "@/shared/aide/aide.types"

export const importAide: AidePage = {
  id: "import",
  espace: "Configuration",
  titre: "Import de données",
  chemins: ["/import", "/imports"],
  roles: ["director", "staff"],
  requires: ["import.students", "import.teachers", "import.schedule"],
  visite: "import",
  resume:
    "Cette page importe des données depuis un fichier Excel, comme l'emploi du temps, et garde l'historique des imports. Rien n'est enregistré avant votre confirmation.",
  prerequis: [
    "Utilisez le fichier modèle de l'étape 2 : une colonne manquante ou renommée bloque l'import.",
    "Pour l'emploi du temps, une année scolaire active est nécessaire.",
  ],
  taches: [
    {
      id: "importer-edt",
      titre: "Comment importer l'emploi du temps ?",
      etapes: [
        "Téléchargez le modèle et remplissez-le, sans garder les lignes d'exemple.",
        "Choisissez le mode : « Fusion » ou « Remplacement ».",
        "Choisissez la période : un lundi de début, un dimanche de fin.",
        "Chargez le fichier et lisez la validation : lignes valides, erreurs, avertissements.",
        "Cliquez sur « Importer » pour enregistrer.",
      ],
      requires: ["import.schedule"],
      reserve: "Réservé aux personnes qui peuvent importer l'emploi du temps",
    },
    {
      id: "fusion-remplacement",
      titre: "Quelle différence entre Fusion et Remplacement ?",
      etapes: [
        "« Fusion » ajoute et met à jour sans désactiver les éléments absents du fichier.",
        "« Remplacement » ajoute, met à jour, puis désactive tout ce qui est absent du fichier.",
        "En cas de doute, choisissez « Fusion ».",
      ],
    },
    {
      id: "corriger-erreurs",
      titre: "Que faire si le fichier contient des erreurs ?",
      etapes: [
        "Lisez le « Détail des erreurs » : chaque ligne est signalée.",
        "Corrigez le fichier Excel.",
        "Chargez-le de nouveau : la validation se refait.",
      ],
    },
    {
      id: "historique-imports",
      titre: "Comment retrouver un import passé ?",
      etapes: [
        "Descendez jusqu'à l'historique des imports.",
        "Filtrez par mois ou par type.",
        "Lisez la date, l'auteur, le type et le nombre de lignes importées.",
      ],
    },
  ],
  bonASavoir: [
    "Si des semaines ont déjà un emploi du temps, l'écran demande de confirmer le remplacement.",
    "Les créneaux passés peuvent être ignorés : l'écran vous demande si vous voulez continuer sans eux.",
    "Un import interrompu peut être repris, ou supprimé pour recommencer.",
  ],
}
