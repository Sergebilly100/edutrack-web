import type { AidePage } from "@/shared/aide/aide.types"

export const roomsAide: AidePage = {
  id: "rooms",
  espace: "Gestion de l'école",
  titre: "Salles et QR codes",
  chemins: ["/rooms"],
  roles: ["director", "staff"],
  requires: ["rooms.view"],
  visite: "rooms",
  resume:
    "Cette page liste les salles de l'école. Chaque salle a un QR code que le professeur scanne en arrivant pour prouver sa présence.",
  taches: [
    {
      id: "ajouter-salle",
      titre: "Comment ajouter une salle ?",
      etapes: [
        "Cliquez sur « Ajouter une salle ».",
        "Saisissez le nom de la salle, et si besoin le bâtiment et la capacité.",
        "Pour contrôler l'endroit du scan, renseignez la latitude, la longitude et le rayon GPS.",
        "Enregistrez : la salle apparaît dans la liste.",
      ],
      requires: ["rooms.create"],
      reserve: "Réservé aux personnes qui peuvent créer des salles",
    },
    {
      id: "imprimer-qr",
      titre: "Comment afficher le QR code d'une salle ?",
      etapes: [
        "Repérez la salle dans la liste.",
        "Cliquez sur « QR » sur sa ligne.",
        "Imprimez ou téléchargez le code.",
        "Collez-le dans la salle, à la vue des professeurs.",
      ],
    },
    {
      id: "regenerer-qr",
      titre: "Comment remplacer un QR code abîmé ou copié ?",
      etapes: [
        "Cliquez sur « Régénérer » sur la ligne de la salle.",
        "Lisez l'avertissement : l'ancien code ne marchera plus.",
        "Confirmez, puis imprimez le nouveau code.",
        "Remplacez l'ancien QR dans la salle.",
      ],
      requires: ["rooms.edit"],
      reserve: "Réservé aux personnes qui peuvent modifier les salles",
    },
    {
      id: "modifier-supprimer-salle",
      titre: "Comment modifier ou supprimer une salle ?",
      etapes: [
        "Cliquez sur « Modifier » ou « Supprimer » sur la ligne de la salle.",
        "Pour modifier, changez les informations puis enregistrez.",
        "Confirmez dans la fenêtre qui s'ouvre.",
      ],
      requires: ["rooms.edit", "rooms.delete"],
      reserve: "Réservé aux personnes qui peuvent modifier les salles",
    },
  ],
  bonASavoir: [
    "Régénérer un QR code rend l'ancien code inutilisable tout de suite.",
    "Sans coordonnées GPS, le lieu du scan n'est pas contrôlé.",
    "Les colonnes « EDT / semaine » et « Scans » comptent les cours prévus et les scans de la salle.",
  ],
}
