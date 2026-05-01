---
name: EDUTrack Web
description: Plateforme de gestion scolaire - Interface administrative et parentale
colors:
  primary: "#3b82f6"
  primary-foreground: "#ffffff"
  secondary: "#64748b"
  secondary-foreground: "#ffffff"
  accent: "#f1f5f9"
  accent-foreground: "#1e293b"
  background: "#ffffff"
  foreground: "#0f172a"
  card: "#ffffff"
  card-foreground: "#0f172a"
  muted: "#f1f5f9"
  muted-foreground: "#64748b"
  destructive: "#dc2626"
  destructive-foreground: "#ffffff"
  border: "#e2e8f0"
  input: "#e2e8f0"
  ring: "#3b82f6"
  present: "#16a34a"
  absent: "#dc2626"
  late: "#d97706"
  sidebar-bg: "#fafafa"
  sidebar-border: "#e2e8f0"
  topbar-bg: "#ffffff"
  stat-card-bg: "#ffffff"
typography:
  display:
    fontFamily: "Inter var, Inter, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter var, Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Inter var, Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Inter var, Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter var, Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  small:
    fontFamily: "Inter var, Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  DEFAULT: "0.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  "2xl": "3rem"
components:
  button-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    border: "1px solid {colors.border}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-sm:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    fontSize: "0.875rem"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "1rem"
    shadow: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    border: "1px solid {colors.input}"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    border: "1px solid {colors.border}"
---

# Design System: EDUTrack Web

## 1. Overview

**Creative North Star: "La Classe Moderne"**

Système de design pour une plateforme de gestion scolaire destinée aux administrateurs d'écoles, enseignants, et parents. L'interface privilégie la clarté et l'efficacité tout en maintenant une atmosphère accueillante et professionnelle.

Philosophie esthétique: **Accueillant et chaleureux**. Le système évite les interfaces froides et techniques au profit d'une expérience utilisateur plus humaine, adaptée au contexte éducatif où la confiance et la communication sont essentielles.

### Caractéristiques Clés

- **Clarté**: Information facile à scanner, navigation intuitive
- **Hiérarchie visuelle**: Utilisation de couches subtiles pour organiser l'information
- **Couleurs fonctionnelles**: Vert (present), Rouge (absent), Orange (late) pour le suivi de présence
- **Accessibilité**: Contraste suffisant, focus visible, taille de police lisible

### Ce que le système rejette

- Interfaces surchargées avec trop d'informations
- Couleurs criardes ou saturées
- Animations excessives ou distrayantes

## 2. Colors: Le Bleu Éducatif

La palette utilise un bleu primaire evokes la confiance, la stabilité et l'apprentissage.

### Primary
- **Bleu Éducatif** (#3b82f6 / oklch(221.2 83.2% 53.3%)): Boutons principaux, liens, éléments d'accentuation. Communicate l'autorité et la professionalism tout en restant accessible.

### Secondary
- **Gris Ardoise** (#64748b): Textes secondaires, icônes, éléments de support.

### Accent
- **Gris Nuage** (#f1f5f9): Arrière-plans de sections, zones de contenu alternatif.

### Neutral
- **Blanc Pur** (#ffffff): Arrière-plan principal, cartes.
- **Gris Ardoise Foncé** (#0f172a): Text principal, titres.
- **Gris Bordure** (#e2e8f0): Bordures, séparateurs.

### Fonctionnel (Présence)
- **Vert Présence** (#16a34a): Statut présent, succès, confirmation.
- **Rouge Absence** (#dc2626): Statut absent, erreur, action destructive.
- **Orange Retard** (#d97706): Statut retard, avertissement, attention.

### Dark Mode
Le système supporte un mode sombre avec inversion des valeurs HSL:
- Background: 222.2 84% 4.9% (presque noir bleuté)
- Foreground: 210 40% 98% (presque blanc)
- Primary: 217.2 91.2% 59.8% (bleu plus clair)

## 3. Typography

**Police**: Inter (variable) avec fallbacks système.

### Hierarchy

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|--------------|-------|
| Display | 2.25rem (36px) | 600 | 1.2 | Titres de pages |
| Headline | 1.875rem (30px) | 600 | 1.3 | Sections principales |
| Title | 1.5rem (24px) | 500 | 1.4 | Cartes, composants |
| Body | 1rem (16px) | 400 | 1.5 | Texte principal |
| Label | 0.875rem (14px) | 500 | 1.4 | Labels, boutons |
| Small | 0.75rem (12px) | 400 | 1.5 | Métadonnées, hints |

### Caractéristiques
- **font-feature-settings**: "cv11", "ss01", "tnum" pour tables numériques
- **Line length**: Max 65-75 caractères pour la lisibilité

## 4. Elevation

**Philosophie**: Couches (layered) - ombres subtiles pour créer de la profondeur sans surcharger.

### Niveaux d'Ombre

| Nom | Valeur | Usage |
|-----|--------|-------|
| card | 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px | Cartes par défaut |
| card-lg | 0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px | Cartes mises en évidence |
| card-hover | 0 8px 16px -4px rgb(0 0 0 / 0.08), 0 4px 6px -2px | Au survol |
| focus | 0 0 0 3px rgb(59 130 246 / 0.12) | Indicateur de focus |

### Animations
- **Duration**: 150ms (default), 100ms (fast), 300ms (slow)
- **Easing**: cubic-bezier(0.4, 0, 0.2, 1)
- **Keyframes**: fade-in, slide-up, slide-down, accordion-down/up

## 5. Components

### Button
Variantes: default, destructive, outline, secondary, ghost, link
Tailles: default (h-9), sm (h-8), lg (h-10), icon (h-9 w-9)

### Card
- Background: white
- Border radius: lg (12px)
- Padding: 1rem
- Ombre: card

### Input
- Background: white
- Border: 1px solid #e2e8f0
- Border radius: md (8px)
- Focus: ring de 3px en bleu

### Badge
- Variantes: default (remplit), outline (bordure), secondary
- Border radius: sm (4px)

### Autres Composants
- Alert Dialog
- Avatar
- Checkbox
- Collapsible
- Dialog
- Dropdown Menu
- Form
- Progress
- Select
- Separator
- Sheet
- Skeleton
- Table
- Tabs
- Toast
- Tooltip

## 6. Do's and Don'ts

### ✅ Do
- Utiliser les couleurs fonctionnelles (present/absent/late) pour le suivi de présence
- Maintenir une hiérarchie visuelle claire avec les ombres
- Utiliser Inter comme police principale
- Respecter les espacements définis (sm, md, lg, xl)
- Ajouter des focus indicators pour l'accessibilité

### ❌ Don't
- Utiliser plus d'une couleur primaire (bleu #3b82f6)
- Créer des cartes imbriquées (nested cards)
- Utiliser des animations sur les propriétés de layout
- Ajouter du glassmorphism décoratif
- Utiliser des gradients text
- Utiliser des bordures latérales (side-stripe) colorées
- Utiliser des modales comme première solution (préférer le inline)