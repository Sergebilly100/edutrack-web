# Refonte du formulaire des règles de risque

## Résultat livré

Le formulaire est accessible depuis **Paramètres → Risques**, avec les permissions existantes. Deux sections visibles regroupent les règles Élèves et Professeurs. Les champs et actions sont rapprochés ; les aides d'absence sont réunies dans un résumé du seuil et de la période.

Les retards présentent séparément la tolérance du pointage et le signal de suivi du professeur. La période fixe de 30 jours est une information. Le nombre de retards reste explicitement à configurer, sans valeur inventée. L'aide explique pourquoi ce nombre est requis pour enregistrer la règle même lorsque le signal est désactivé, conformément au contrat API.

Chaque règle possède ses états modifié, invalide, en cours, enregistré et erreur, ainsi qu'une annulation locale. Une requête en cours n'affiche pas d'attente sur les autres règles. Une sauvegarde n'efface pas les changements effectués pendant la requête ; les anciennes lectures sont annulées et les valeurs acquittées sont répercutées dans le cache avant actualisation.

## Fichiers

- `src/modules/risk/components/RiskAlertRules.tsx` : structure, formulaires shadcn et React Hook Form, interactions, retours accessibles et synchronisation.
- `src/modules/risk/components/risk-rule-form.ts` : définitions, valeurs initiales, transformation du payload et validation Zod des contraintes existantes.
- Les deux fichiers de tests dans `src/modules/risk/components/__tests__/` : validation et parcours des règles.
- `e2e/critical/risk-rules-form.spec.ts` : parcours réel sur ordinateur et en émulation Android.
- `e2e/critical/teacher-risk.spec.ts` : adaptation des sélecteurs au formulaire nommé, avec conservation du parcours risque → job → dashboard.
- Le brief confirmé, cette revue et les captures dans `docs/design/`.

## Vérifications

La baseline des trois tests originaux du formulaire passait avant modification.

- **85 tests passent** dans les suites risque, dashboard et paramètres, avec deux workers.
- Les **28 tests du formulaire et de sa validation** ont également été exécutés après les dernières finitions.
- **3 parcours Playwright passent** avec l'API réelle et des services QA jetables : formulaire desktop, formulaire Android et parcours C13 des retards jusqu'au dashboard.
- Vérifications navigateur : valeurs invalides et messages liés aux champs, annulation, payload enregistré, état de succès, tabulation entre champs, cibles de 48 px, absence de débordement horizontal à 393 et 320 px, reflow avec texte agrandi, thème sombre.
- TypeScript, ESLint ciblé sans avertissement, build de production et contrôle des espaces du diff.
- Une revue complémentaire en lecture seule a identifié puis confirmé la correction de la course entre deux sauvegardes successives. Le test correspondant retarde volontairement la seconde actualisation.

Un premier lancement de la suite étendue avec le parallélisme par défaut a dépassé le délai d'attente d'une assertion dashboard. La même assertion passe sur la version HEAD isolée et la suite complète passe avec deux workers. Aucun fichier dashboard n'a été modifié.

## Captures

- [Formulaire desktop](risk-rules-desktop.png)
- [Formulaire Android](risk-rules-android.png)
- [Retards Android](risk-lateness-android.png)
- [Retards desktop, thème sombre](risk-lateness-desktop-dark.png)

Les captures intégrales retirent temporairement le clipping des conteneurs de défilement, puis restaurent leurs styles. Les assertions de largeur, de taille tactile et de reflow portent sur l'interface dans son fonctionnement habituel.

## Auto-revue

- Périmètre limité à `edutrack-web` et au formulaire, à ses tests et à sa documentation. Aucun changement de backend, de schéma, de permission, de menu ou de logique de risque.
- Exploration du code réel avant modification et brief confirmé. Les libellés d'absences et de moyennes reflètent les filtres réellement présents dans les calculs.
- Composants shadcn, typographie, nuances de couleurs, rayons et espacements du système IvoirEdu ; aucune carte imbriquée, nouvelle palette, modale ou modification de la barre latérale.
- Aucune requête déclenchée par un effet React, aucun détail interne d'erreur exposé, aucune donnée personnelle ajoutée aux logs et aucune dépendance ajoutée.
- Les effets ne font que synchroniser un formulaire inchangé avec les données reçues. Les brouillons modifiés sont préservés, y compris lors d'une erreur d'actualisation.
- Les vérifications finales passent. Aucune régression détectée dans les parcours contrôlés ; refonte intégralement réalisée selon le brief.

Limites de vérification : Chrome en émulation Android, sans appareil Tecno/Itel physique. Les labels, annonces et messages accessibles ont été contrôlés dans le DOM et le parcours clavier ; aucune certification WCAG ni session avec un lecteur d'écran n'est revendiquée.

Message de commit proposé : `fix(risk): clarify and compact risk rule settings`.
