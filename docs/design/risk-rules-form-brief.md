# Brief : formulaire des règles de risque

Statut : brief confirmé par l'utilisateur et formulaire implémenté le 27 septembre 2026. Commande : Impeccable shape.

## 1. Fonction et objectif

Ce formulaire, accessible dans **Paramètres → Risques**, permet à la direction et aux utilisateurs autorisés à modifier les alertes de régler les signaux du tableau de bord. La refonte doit faciliter la lecture et l'enregistrement de cinq règles, sur ordinateur et téléphone.

Le succès attendu : comprendre quelle population est concernée, ce qui déclenche chaque signal et quelles modifications sont enregistrées, sans parcourir de grandes zones vides.

## 2. Action principale

Régler puis enregistrer une règle en comprenant son effet. Une règle représente une unité de travail : son activation, ses paramètres, sa validation et son retour de sauvegarde restent réunis.

## 3. Direction visuelle

- Stratégie **Restrained** : surfaces et textes des tokens existants, accent de marque réservé aux actions et états utiles.
- Scène : une personne de la direction ajuste les seuils dans un bureau éclairé en journée, sur un ordinateur ou un téléphone, et veut vérifier rapidement ses réglages. La présentation claire actuelle convient ; le thème sombre existant doit également fonctionner.
- Références : **IvoirEdu**, pour la continuité du produit, et **shadcn/ui**, pour les contrôles et conventions d'interaction.
- Sources : `archives/PRODUCT.md` et `archives/DESIGN.md`. Inter, rayons, composants et couleurs suivent ces documents.
- Exploration d'images écartée : la direction est déjà déterminée et la refonte concerne un formulaire existant, sans recherche d'une nouvelle identité visuelle.

## 4. Périmètre confirmé

L'utilisateur a choisi une refonte **prête à intégrer**, limitée à ce formulaire, **desktop et mobile**, avec interactions et finitions complètes. Il a choisi **deux sections visibles : Élèves puis Professeurs**.

La mise en œuvre concernera le composant du formulaire et les vérifications de son parcours. Elle conserve les règles métier et le contrat API en place.

## 5. Organisation de l'espace

Un en-tête court explique que les réglages alimentent les personnes à suivre sur le tableau de bord. Les deux sections comportent respectivement trois et deux règles, avec des séparateurs sobres.

Chaque règle présente son titre et son activation en tête, puis une description courte, les paramètres associés et son action d'enregistrement. Les champs ne sont plus isolés dans des colonnes fixes de 136 px. Les règles sans champ numérique ne réservent aucune colonne vide.

| Surface | Organisation |
| --- | --- |
| Ordinateur | Champs associés sur une même ligne lorsque la largeur le permet ; textes, champs et actions restent proches ; titres alignés en haut. |
| Mobile et zoom | Ordre vertical stable : titre, activation, explication, paramètres, retour et actions ; champs et actions accessibles sans défilement horizontal. |
| Retards professeur | Deux groupes nommés : **Tolérance du pointage** et **Signal sur le tableau de bord** ; période présentée comme **30 derniers jours, période fixe**. |

Les groupes de règles ne deviennent pas une grille de cartes identiques. Aucun encadrement imbriqué ni nouvelle modale.

## 6. États à couvrir

- **Chargement** : structure identifiable et message de chargement accessible.
- **Chargé** : valeurs connues, activation et unité visibles, aucune modification à enregistrer.
- **Première configuration** : le seuil des retards reste vide ; état « À configurer » et indication du nombre requis, sans inventer de valeur.
- **Modification** : état « Modifications non enregistrées » sur la règle concernée.
- **Valeur invalide** : message local expliquant la contrainte ; valeur conservée et état invalide accessible.
- **Sauvegarde** : attente sur la règle concernée et protection contre les clics répétés.
- **Succès** : confirmation locale et toast ; la règle revient à un état enregistré si aucun changement plus récent n'existe.
- **Échec** : valeurs conservées, explication et possibilité de réessayer.
- **Erreur de chargement** : message et action de nouvelle tentative.
- **Aucune règle renvoyée** : conserver les valeurs initiales définies par le module ; signal de retards désactivé et seuil vide.

## 7. Interactions

La sauvegarde reste **par règle**, conformément aux endpoints existants. « Enregistrer » devient utile lorsque la règle comporte une modification valide. « Annuler les modifications » apparaît uniquement sur une règle modifiée et restaure sa dernière configuration connue.

Une sauvegarde identifie la règle concernée dans son retour accessible. Les autres règles ne montrent pas de chargement. Un succès ne doit pas effacer une modification effectuée après le lancement de la requête.

L'activation des retards porte explicitement sur le **signal de risque**. La tolérance reste visible et applicable aux prochains pointages lorsque ce signal est désactivé. Les deux valeurs sont enregistrées ensemble : l'API exige un seuil de retards positif même lorsque le signal est désactivé. Cette exigence est expliquée près du champ ; aucune sauvegarde indépendante de la tolérance n'est promise.

Parcours complet au clavier, aides reliées aux champs, erreurs annoncées et zones tactiles d'au moins 48 px. Aucun comportement essentiel réservé au survol.

## 8. Contenu

- Introduction : « Définissez les situations à suivre sur le tableau de bord de direction. »
- Sections : « Élèves » et « Professeurs ».
- Absences : « Signaler à partir de [nombre] absences sur les [durée] derniers jours. » Le résumé reprend les valeurs saisies et respecte les absences réellement comptées par le module.
- Moyenne : expliquer une baisse entre les deux dernières périodes validées, en points.
- Finance : expliquer le retard de paiement sans mention de « cache financier ».
- Retards : « Nombre de retards », « Tolérance du pointage (minutes) » et « Signal sur le tableau de bord ».
- Aide de tolérance : « S'applique aux prochains pointages, même si le signal est désactivé. Les pointages déjà enregistrés conservent leur statut. »
- Aide de première configuration : « Renseignez un nombre de retards pour enregistrer cette règle, même si le signal est désactivé. »
- Délai : distinguer le recalcul des risques, au plus tard dans 15 minutes, de la tolérance applicable aux prochains pointages après enregistrement.
- Conséquences : préciser que ces signaux n'envoient pas automatiquement de message aux parents ou professeurs.

Les validations reprennent les contraintes existantes. Le seuil des retards reste un entier explicite, la tolérance un entier supérieur ou égal à zéro et la période des retards exactement 30 jours.

## 9. Références et vérification de l'implémentation

Références Impeccable pertinentes : `layout.md`, `clarify.md`, `harden.md`, puis `polish.md`.

Avant toute modification du composant, exécuter les tests existants. Après modification, vérifier l'enregistrement avec son payload métier, la validation, les états par règle, l'annulation, la conservation des changements récents et la première configuration sans seuil inventé. Vérifier le parcours réel dans Paramètres → Risques sur desktop et Chrome en émulation Android, ainsi que le clavier, le zoom et le thème sombre. L'émulation ne remplace pas un essai sur appareil physique.

## 10. Questions ouvertes et statut

Aucune décision métier ne reste ouverte. Le brief a été confirmé par l'utilisateur (« vas y ») avant la réalisation du formulaire.

La critique a attribué 21/40 au formulaire actuel ; le scan déterministe Impeccable n'a signalé aucun de ses motifs pris en charge. L'implémentation devra traiter les problèmes de proximité, de validation et de compréhension identifiés par la revue humaine.

Le formulaire livré et ses vérifications sont décrits dans [l'auto-revue](risk-rules-form-review.md). Les textes « absences non justifiées » et « périodes validées » ont été remplacés par des formulations reflétant le calcul réel, qui ne contient pas ces filtres.

Message de commit proposé pour le futur changement livré : `fix(risk): clarify and compact risk rule settings`.
