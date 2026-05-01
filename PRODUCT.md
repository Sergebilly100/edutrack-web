---
name: EDUTrack Web
description: EduTrack CI est une application de gestion scolaire conçue spécialement pour les écoles privées en Côte d'Ivoire. Elle permet aux directeurs de suivre en temps réel les présences des enseignants et des élèves, de gérer les emplois du temps, et de valider les paiements de salaires - le tout depuis un téléphone ou un ordinateur. L'application permet également aux parents d'élève de suivre les présences de leurs enfants en temps réel via une interface dédiée.EduTrack CI fonctionne même sans connexion internet (mode hors ligne) et se synchronise automatiquement dès que le réseau est disponible. Elle est accessible sans télécharger d'application, directement depuis le navigateur.
> Positionnement : *"Le seul outil qui prouve que les cours ont été donnés."*
register: product
---

# PRODUCT.md

## 1. Register

**Type**: Product (interface application - le design SERVIT le produit)

EDUTrack est une plateforme SaaS de gestion scolaire avec des interfaces pour:
- Administrateurs d'écoles (gestion des écoles, utilisateurs, abonnements)
- Enseignants (pointage, suivi des présences, communication)
- Parents (portail parent, suivi des enfants)

## 2. Users

### Utilisateurs Principaux

**Directeur** - Le focus principal
- Context: Utilisation quotidienne pour le suivi des professeurs et élèves. Suivi des salaires à payer et des abonnements parent.
- Job to be done: suivre les absences et retards, créer et suivre les abonnements avec les parents, payer les salaires professeurs, Importer les fichiers xls dans l'app, Gérer les salles de classes, Consulter les revenus d'abonnement parent.

### Utilisateurs Secondaires


**Enseignants** - Le focus secondaire
- Context: Utilisation quotidienne pour le pointage et le suivi des élèves
- Job to be done: Signaler sa présences, faire le pointage des élèves, consulter son emploi du temps. 

**Le Staff école** - Le focus suivant
- Context: Utilisation quotidienne pour executer les taches en rapport avec les permissions accordées par le Directeur dans paramètres Directeur (suivi des présences prof/élève, gestion des emploi du temps, gestion des salles de classe, gestion des abonnements parent, gestion des import de fichier dans l'app, gestion des salaires professeur etc)
- Job to be done: Utilisateurs fait les taches qui lui sont confier. 

**Les parents d'élève** - Le focus suivant
- Context: Utilisation quotidienne pour consultation des absences/présences de leurs enfants, voir leur emploi du temps
- Job to be done: Suivi des présence et absence élève, consultation de l'historique des absences, consultation de l'emploi du temps des élèves. 

## 3. Product Purpose

**Purpose**: Plateforme de gestion scolaire conçue pour les écoles privées. Elle permet aux directeurs de suivre en temps réel les présences des enseignants et des élèves, de gérer les emplois du temps, et de valider les paiements de salaires

### Fonctionnalités Clés

1. **Gestion des Présences**
   - Pointage quotidien des élèves et professeurs
   - Suivi des absences et retards
   - Statistiques de présence
   - Historique

2. **Communication École-Famille**
   - Notifications aux parents
   - Portail parent
   - Messages et alertes

3. **Administration Scolaire**
   - Gestion des élèves
   - Gestion des classes
   - Gestion des Emploi du temps
   - Gestion des salaires professeurs
   - Gestio des salles de classe
   - Suivi des abonnements

## 4. Brand Personality

**Personnalité**: Accueillant et chaleureux

### Caractéristiques

- **Approchable**: Interface facile à utiliser, pas de barrière technique
- **Fiable**: Données précises, suivi fiable des présences
- **Moderne**: Technologies récentes, interface actuelle
- **Humain**: Pas d'interface froide ou technique, expérience utilisateur chaleureuse

### Ton

- Professionnel mais accessible
- Clair et direct
- Orienté solution

## 5. Anti-References

**Ce à éviter**:

1. **Interfaces surchargées**
   - Trop d'informations sur un écran
   - Clutter visuel
   - Navigation complexe

2. **Designs génériques ("AI slop")**
   - Palettes couleurs évidentes (bleu éducation par défaut)
   - Templates hero-metric
   - Grilles de cartes identiques

3. **Couleurs inadaptées**
   - Couleurs criardes ou saturées
   - Mauvais contraste
   - Utilisation de la couleur seule pour transmettre l'information

## 6. Strategic Design Principles

### Principes Directeurs

1. **Clarté**
   - Information facile à scanner
   - Navigation intuitive
   - Actions évidentes

2. **Efficacité**
   - Réduire le nombre de clics
   - Accès rapide aux actions fréquentes
   - Feedback immédiat

3. **Confiance**
   - Données précises et à jour
   - Transparence des actions
   - Cohérence visuelle

4. **Accessibilité (WCAG AAA)**
   - Contraste suffisant (7:1 minimum)
   - Navigation clavier complète
   - Support des lecteurs d'écran
   - Textes redimensionnables
   - Indicateurs de focus visibles

## 7. Contraintes Techniques

- **Stack**: React 18, TypeScript, Tailwind CSS, Radix UI
- **Design System**: shadcn/ui
- **Police**: Inter (variable)
- **Mode Sombre**: Supporté avec `.dark` class

---