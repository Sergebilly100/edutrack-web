import type { AidePage } from "@/shared/aide/aide.types"

export const accountAide: AidePage = {
  id: "account",
  espace: "Mon compte",
  titre: "Mon compte",
  chemins: ["/account"],
  roles: ["director", "staff", "teacher"],
  resume:
    "Cette page garde vos informations personnelles et votre mot de passe. Utilisez-la pour corriger votre nom ou votre téléphone, ou pour changer de mot de passe.",
  taches: [
    {
      id: "modifier-profil",
      titre: "Comment changer mon nom ou mon téléphone ?",
      etapes: [
        "Modifiez le « Nom complet » ou le « Numéro de téléphone » dans le bloc Profil.",
        "Cliquez sur le bouton d'enregistrement du profil.",
        "Le message « Profil mis à jour » confirme le changement.",
      ],
    },
    {
      id: "changer-mot-de-passe",
      titre: "Comment changer mon mot de passe ?",
      etapes: [
        "Ouvrez le bloc « Sécurité ».",
        "Saisissez votre mot de passe actuel.",
        "Saisissez le nouveau mot de passe, puis confirmez-le.",
        "Cliquez sur le bouton d'enregistrement : « Mot de passe modifié » s'affiche.",
      ],
    },
  ],
  bonASavoir: [
    "Le nouveau mot de passe a au moins 8 caractères, une majuscule et un chiffre.",
    "L'adresse e-mail ne se modifie pas ici : demandez à la direction.",
    "Si vous avez oublié votre mot de passe, demandez à la direction de le réinitialiser.",
  ],
}
