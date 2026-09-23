# Recette manuelle avant démonstration — IvoirEdu

Référence : [inventaire intégral](inventaire-reference.md). Correspondance et preuves automatisées : [cartographie](cartographie.md). Les 37 fiches suivent l’ordre et les thèmes de cet inventaire. Ce document décrit une recette à exécuter ; il ne constitue pas un procès-verbal de recette déjà effectuée.

## Préparer la recette

Utiliser une école de démonstration et des personnes fictives. Réserver les essais SMS à un numéro de test dont le détenteur participe à la recette. Les versements ci-dessous sont des écritures de démonstration, pas des paiements bancaires.

Demander au responsable de l’environnement :

- L’adresse de l’école, un compte directeur, un professeur principal, un autre professeur, un agent administratif autorisé et un agent sans droit financier.
- Un parent lié à deux élèves fictifs (Aya Recette et Koffi Recette), un second parent lié à un autre enfant ; conserver les sessions dans des profils de navigateur séparés.
- Une année active avec une période de notation ouverte, un niveau et une classe QA, une matière et un professeur affecté, une salle géolocalisée avec son QR. Pour les tests d’appel, prévoir un cours à l’heure réelle de la recette.
- Un niveau de scolarité à 120 000 FCFA : premier seuil cumulé 40 000 FCFA aujourd’hui, dernier seuil 120 000 FCFA plus tard. Les dates doivent être comprises dans l’année scolaire. Réserver un élève sans paiement à chaque essai financier pour ne pas mélanger les résultats.
- Un petit PDF et une photo fictifs pour les documents, des fichiers Excel issus des modèles proposés, et un fichier de paiements avec une ligne correcte et un matricule inconnu.
- Pour les fiches dépendant de services : workers actifs, stockage de documents/PDF configuré, fournisseur SMS opérationnel et service Alertes Parents activé. Si ce prérequis manque, noter **BLOQUÉ**, jamais **OK**.

Naviguer par le menu indiqué. Sur téléphone, ouvrir **Ouvrir le menu**, puis le groupe concerné ; sur ordinateur, développer le groupe dans la barre latérale. Certains termes peuvent être personnalisés par l’école (« Élèves », « Directeur »). Les fiches utilisent les libellés par défaut. Fermer le guide de découverte pour accéder aux commandes.

Pour chaque fiche, relever : date/heure, version, appareil/navigateur, école, rôle, données utilisées, statut **OK / KO / BLOQUÉ**, étape en défaut, résultat observé et preuve. Recharger la page après toute écriture importante : une notification de succès seule ne prouve pas la sauvegarde. Ne pas joindre de mot de passe, de document réel ni de numéro familial à un ticket.

Exécuter sur ordinateur puis sur Chrome Android réel (Tecno/Itel si disponible) les parcours F01, F02, F05, F10, F16, F23, F26 et F29. Une émulation Pixel 5 ne remplace pas l’essai de caméra, GPS, clavier, réseau mobile et téléchargement sur appareil physique.

## Suivi de l’assiduité

### F01 — Pointage des enseignants avec QR code

**Prérequis :** professeur affecté au cours du jour, salle et QR actifs ; accès caméra autorisé ; GPS autorisé si l’école le demande.

1. Se connecter comme professeur, ouvrir **Mes cours**, choisir le cours concerné. Vérifier la date, la classe, la matière, l’horaire et la salle.
2. Démarrer le cours et scanner le QR de cette salle. Attendu : début de cours confirmé, heure de pointage visible et accès à l’appel.
3. Tenter le QR d’une autre salle sur un autre cours de test. Attendu : erreur explicite, aucune fausse validation.
4. Au moment de terminer le cours, utiliser l’action de fin puis scanner le QR. Recharger **Mes cours** : le cours reste terminé et les pointages restent conservés.
5. Se connecter comme directeur et consulter **Pilotage → Validations horaires** ou le suivi de présence du professeur. Vérifier les heures et les éventuelles alertes GPS.

**Bug :** QR incorrect accepté, début/fin inversés, pointage disparu ou doublonné. Une autorisation sans QR n’est attendue que si elle a été expressément activée pour ce professeur.

### F02 — Appel des élèves par cours

**Prérequis :** professeur ; F01 démarré ; au moins deux élèves inscrits dans la classe ; fenêtre de modification ouverte.

1. Ouvrir l’appel depuis le cours. Vérifier que la liste correspond à la classe et n’inclut pas une autre classe.
2. Marquer Aya absente, laisser Koffi présent, puis valider l’appel. Attendu : confirmation et récapitulatif des absents.
3. Revenir sur l’appel, le corriger pendant le délai autorisé et remettre Aya présente. Valider puis recharger : la correction est conservée.
4. Refaire un appel avec Aya absente pour F03/F30. Après expiration du délai affiché, vérifier que la modification n’est plus autorisée.

**Bug :** tous les élèves deviennent absents, correction perdue, élève étranger à la classe, modification acceptée hors fenêtre.

### F03 — Historique et justification d’absence

**Prérequis :** directeur ou agent autorisé à justifier ; absence issue de F02 ; motif fictif « Certificat reçu pour recette QA ».

1. Ouvrir **Vie scolaire → Élèves**, rechercher Aya et ouvrir sa fiche, puis la partie **Absences**. Attendu : cours/date/statut correspondant à F02.
2. Filtrer par dates, matière et statut. Attendu : seules les absences correspondant aux filtres restent affichées ; une période sans absence donne un état vide compréhensible.
3. Sur une absence, ouvrir la justification, saisir le motif et **Confirmer**. Attendu : statut justifié et motif consultable.
4. Recharger la fiche puis ouvrir le portail du parent concerné, **Absences**. Vérifier la même absence et son statut.
5. Avec l’agent non autorisé, ouvrir la même fiche. La justification ne doit pas pouvoir être enregistrée.

**Bug :** absence supprimée au lieu d’être justifiée, motif perdu, filtres incohérents ou droit d’écriture accordé au mauvais rôle.

### F04 — Contrôle des heures et anomalies des professeurs

**Prérequis :** directeur/agent habilité ; un cours court, un GPS suspect et un scan de fin manquant éligibles à la revue ; noter les heures prévues.

1. Ouvrir **Pilotage → Validations horaires**. Examiner les onglets d’heures à valider, de présences GPS suspectes et de scans de fin manquants.
2. Sur un cours court, examiner le détail puis valider les heures réellement retenues ; sur un autre cas, refuser avec un motif. Attendu : chaque décision, motif et volume d’heures sont conservés.
3. Dans les présences suspectes, traiter un cas en validant ou en marquant absent après examen. Attendu : la ligne sort des cas en attente.
4. Dans les scans manquants, essayer l’avertissement puis la sanction sur deux cas distincts. Choisir **Tous les statuts** pour revoir un cas traité.
5. Recalculer la paie du mois (F08). Les heures approuvées comptent, les heures refusées ne produisent pas de paiement.

**Bug :** traitement répété produisant une double écriture, cas traité encore en attente, heures refusées payées ou absence de motif dans le détail.

### F05 — Appel avec connectivité instable

**Prérequis :** professeur ; cours et liste d’élèves déjà ouverts en ligne ; navigateur autorisant le stockage local.

1. En ligne, démarrer le cours et charger l’appel.
2. Couper le réseau du téléphone ou passer le navigateur hors connexion. Marquer une absence puis valider. Attendu : indication hors connexion/en attente de synchronisation, sans perdre la saisie.
3. Rétablir le réseau et attendre le traitement des opérations en attente. Attendu : disparition de l’attente ou message de conflit exploitable.
4. Recharger puis consulter l’absence depuis une session directeur en ligne. Attendu : un seul résultat enregistré pour l’élève et le cours.
5. Sur un autre essai, changer d’utilisateur avant synchronisation. Une opération de l’ancien compte ne doit pas être envoyée sous l’identité du nouveau compte.

**Bug :** saisie perdue, succès annoncé sans persistance, duplication ou données d’un autre utilisateur. Le hors connexion ne garantit pas l’ouverture à froid de toute l’application ni la saisie financière.

## Organisation quotidienne de l’école

### F06 — Emplois du temps, créneaux et affectations

**Prérequis :** directeur/agent autorisé à modifier l’EDT ; année/classe/matière/professeur/salle existants ; période d’EDT couvrant la semaine.

1. Ouvrir **Vie scolaire → Emploi du temps**. Choisir la semaine QA ; vérifier la période active affichée.
2. Cliquer **Ajouter un créneau**, renseigner le professeur, la classe, la matière, la salle, le jour et l’horaire ; enregistrer. Attendu : cours à la bonne position dans la semaine.
3. Modifier ce cours et recharger. Attendu : nouvelle affectation conservée et ancienne remplacée.
4. Essayer un chevauchement de professeur ou de salle. Attendu : conflit explicite, pas de seconde affectation silencieuse.
5. Vérifier la même séance dans **Mes cours** du professeur puis **EDT** du parent lié à cette classe.

**Bug :** divergence entre rôles, cours hors période ou conflit non signalé. La duplication d’une période est actuellement couverte côté API ; aucun bouton de duplication n’a été trouvé dans cet écran, elle n’est donc pas une étape de démonstration UI.

### F07 — Salles, coordonnées et QR codes

**Prérequis :** directeur/agent autorisé ; une salle de test non affectée et une salle déjà utilisée.

1. Ouvrir **Vie scolaire → Salles & QR Codes**, **Ajouter une salle**, renseigner son nom et ses coordonnées, puis **Ajouter**. Attendu : salle visible.
2. Modifier la salle, **Sauvegarder**, recharger et rouvrir. Attendu : valeurs conservées.
3. Ouvrir son QR, l’imprimer ou le télécharger via les commandes proposées. Attendu : QR lisible et nom de salle correct.
4. Choisir **Régénérer**, confirmer **Régénérer le QR**, puis refaire F01 : nouveau QR accepté, ancien QR refusé.
5. Essayer de supprimer la salle affectée. Attendu : refus explicite ; supprimer uniquement la salle de test libre.

**Bug :** QR commun à plusieurs salles, ancien QR encore accepté après rotation, coordonnées perdues ou salle utilisée supprimée.

## Fiabilité de la paie enseignante

### F08 — Calcul des salaires

**Prérequis :** directeur/comptable ; vacataire à 5 000 FCFA/h avec 2 h payables validées, sans versement ; enseignant permanent avec salaire contractuel connu.

1. Ouvrir **Administration → Salaires professeurs**, choisir le mois/période QA.
2. Lancer le calcul des salaires, vérifier les dates dans la confirmation, puis confirmer. Attendu pour le vacataire isolé : 10 000 FCFA dus, zéro payé, 10 000 restant.
3. Consulter le détail : les cours retenus expliquent le montant. Pour le permanent, comparer au montant fixe et aux règles affichées dans son détail.
4. Relancer le calcul sans changement. Attendu : mêmes montants, pas de doublon.
5. Après un paiement partiel F09, recalculer. Attendu : paiement conservé et seul le reste dû disponible.

**Bug :** calcul depuis les seules heures prévues malgré une validation différente, taux erroné, versement effacé, montant fixe multiplié par le nombre de cours. Les options « heures réelles » et les absences doivent correspondre à la configuration de l’école.

### F09 — Versements et exports de paie

**Prérequis :** directeur/comptable ; F08 calculé ; deux enseignants dus ; worker PDF et stockage disponibles.

1. Sur la ligne du vacataire, ouvrir le paiement et enregistrer 4 000 FCFA avec le mode/date proposés. Attendu : 4 000 payé, 6 000 restant sur une dette initiale de 10 000.
2. Ouvrir **Historique** et le détail. Attendu : ce versement unique, son montant et sa date ; recharger et vérifier à nouveau.
3. Sélectionner deux lignes de test et utiliser le paiement en lot, vérifier la liste et les montants avant confirmation. Attendu : seules les lignes choisies sont réglées.
4. Demander l’export PDF, attendre son état prêt puis télécharger. Ouvrir le fichier : école, période, enseignants et totaux doivent correspondre à l’écran.

**Bug :** paiement supérieur au reste dû accepté, doublon lors d’un clic répété, lot touchant d’autres lignes, PDF vide ou pour une autre période. Une demande d’export « en file » n’est pas un PDF validé.

## Inscriptions, dossiers et administration des élèves

### F10 — Inscription jusqu’au passage en caisse

**Prérequis :** directeur/agent avec création et confirmation de paiement ; année/classe et frais définis ; matricule neuf.

1. Ouvrir **Vie scolaire → Inscriptions → Nouvelle inscription**. Saisir prénom, nom, matricule, année puis classe ; renseigner les contacts parentaux de test.
2. Cliquer **Créer et continuer**. Attendu : dossier créé et étape **Documents requis**, sans inscription confirmée prématurément.
3. Fournir les pièces obligatoires (F11), puis **Terminer le dossier**. Attendu : retour aux dossiers et action **Caisse** sur le dossier prêt.
4. Ouvrir **Caisse**. Saisir un montant supérieur au solde : erreur visible et enregistrement impossible.
5. Saisir 25 000 FCFA et la **Référence du reçu de caisse** « QA-CAISSE-001 », enregistrer. Attendu : dossier **Confirmée**, paiement unique de 25 000, reste 95 000 pour un total de 120 000.
6. Recharger les dossiers puis consulter F18 : confirmation et reçu subsistent.

**Bug :** classe choisie sans année valide, confirmation sans conditions requises, dépassement accepté, dossier et paiement incohérents ou double paiement.

### F11 — Documents exigés

**Prérequis :** directeur/agent autorisé ; un niveau et un dossier de ce niveau ; PDF/photo fictifs.

1. Ouvrir **Administration → Paramètres → Scolarité → Documents requis par niveau**. Ajouter « Extrait QA », choisir le niveau, cocher **Obligatoire** et enregistrer.
2. Dans **Inscriptions**, ouvrir les documents du dossier. Attendu : Extrait QA **Manquante** et compteur obligatoire augmenté.
3. Cliquer **Photo ou fichier**, choisir le document. Attendu : **Fournie** ; **Consulter** ouvre le bon fichier.
4. Cliquer **À renouveler**. Attendu : pièce à nouveau signalée ; **Remplacer**/nouvel envoi conserve le nouveau fichier après rechargement.
5. Archiver le type de document dans les paramètres. Attendu : il n’est plus exigé, mais la pièce déjà fournie reste conservée dans le dossier.

**Bug :** compteur comptant une pièce facultative/archivée comme obligatoire, faux statut fournie sans fichier, document d’un autre élève ou fichier introuvable.

### F12 — Réinscription traitée par l’école

**Prérequis :** directeur/agent autorisé ; année précédente clôturée ; décisions finales validées ; année cible et classes compatibles ; un élève à jour et un avec dette.

1. Ouvrir **Vie scolaire → Inscriptions → Réinscriptions**, sélectionner l’année cible et rechercher l’élève à jour.
2. **Voir dossier** : vérifier l’ancienne classe, la décision et le niveau proposé. Choisir la classe compatible puis lancer la réinscription. Attendu : un seul nouveau dossier.
3. Faire la même opération pour l’élève débiteur. Attendu : blocage pour impayé, sans confirmation définitive.
4. Régulariser la dette via **Finance → Encaissements** sur l’année concernée, revenir au dossier et poursuivre les étapes proposées. Attendu : blocage levé lorsque la situation est régularisée.
5. Vérifier un élève sans décision validée et un exclu. Attendu : absence de réinscription normale autorisée.

**Bug :** doublon sur l’année cible, classe incompatible, dette ignorée ou parent capable de se réinscrire lui-même. Ne pas confondre versement et remise accordée par un rôle habilité.

### F13 — Dossier chronologique

**Prérequis :** directeur/agent autorisé ; élève ayant une inscription, un document, un paiement et un bulletin.

1. Ouvrir **Vie scolaire → Élèves**, rechercher l’élève et ouvrir sa fiche.
2. Ouvrir l’onglet **Fil d’activité** dans la fiche. Vérifier la présence des événements connus avec leurs dates et types.
3. Consulter les détails proposés pour l’inscription, le paiement et le bulletin. Attendu : même élève, montants et période corrects.
4. Ajouter un document ou enregistrer un paiement, puis recharger le dossier. Attendu : nouvel événement sans disparition des précédents.

**Bug :** mélange d’élèves/années, événements dupliqués ou données confidentielles d’une autre école. Le dossier consolidé interne n’est pas une fonctionnalité parent.

### F14 — Compte parent issu du dossier

**Prérequis :** directeur/agent pouvant modifier les contacts ; téléphone de test valide ; SMS configuré pour la réception effective.

1. Dans la fiche élève, ouvrir les contacts parentaux, saisir le nom et le téléphone de test, puis enregistrer. Attendu : contact conservé.
2. Sur un second élève, renseigner le même parent/téléphone. Attendu : réutilisation du compte et rattachement des deux enfants.
3. Réceptionner les accès sur le téléphone de test lorsqu’ils sont envoyés. Se connecter au portail parent avec ces accès ; effectuer le changement obligatoire du mot de passe s’il est demandé.
4. Vérifier les deux enfants puis se déconnecter/reconnecter. Attendu : accès conservé, aucun troisième enfant.
5. Modifier un contact déjà connu sans demander de réinitialisation. Le mot de passe déjà choisi ne doit pas être changé arbitrairement.

**Bug :** compte doublonné, rattachement manquant, mot de passe réinitialisé implicitement ou mauvais destinataire. En l’absence de fournisseur SMS, distinguer compte créé et accès réellement reçus.

## Suivi financier et recouvrement

### F15 — Frais, échéancier cumulatif et ajustements

**Prérequis :** directeur/agent autorisé ; année et niveau QA ; élève sans paiement.

1. Ouvrir **Administration → Paramètres → Finance**, sélectionner l’année et le niveau dans les frais de scolarité.
2. Définir un total de 120 000 FCFA et deux **Seuils cumulés attendus** : 40 000 aujourd’hui, 120 000 plus tard. **Enregistrer le plan**, recharger. Attendu : mêmes seuils ; le deuxième représente le cumul, pas 120 000 supplémentaires.
3. Essayer une date hors année, un cumul décroissant ou supérieur au total. Attendu : refus avant sauvegarde.
4. Dans **Ajustement individuel**, chercher l’élève, choisir **Remise à déduire**, saisir 10 000 et un **Motif obligatoire**, puis **Accorder l’ajustement**. Attendu : total net 110 000, versements toujours zéro.
5. Dans **Courbe individuelle**, rechercher un autre élève, ajuster ses seuils, **Enregistrer la courbe**, recharger ; puis **Revenir au plan du niveau** et confirmer. Attendu : retour aux seuils communs.

**Bug :** échéances additionnées comme mensualités, remise comptabilisée comme argent encaissé, motif absent, courbe d’un élève appliquée à toute la classe.

### F16 — Saisie rapide des encaissements

**Prérequis :** caisse/directeur avec droit d’enregistrer ; élève au total net 120 000 et sans paiement.

1. Ouvrir **Finance → Encaissements → Enregistrement**, choisir la bonne année.
2. Rechercher l’élève par nom ou matricule, le sélectionner. Attendu : identité/classe et situation financière correctes.
3. Saisir 25 000 FCFA, date, mode de paiement et référence de caisse demandée, puis enregistrer une fois. Attendu : confirmation de l’écriture.
4. Ouvrir **Historique & reçus** et rechercher le même élève. Attendu : un paiement de 25 000 et un reste de 95 000.
5. Revenir à la saisie et choisir un second élève. Vérifier que le formulaire ne réutilise pas accidentellement le premier élève. Avec l’agent sans droit financier, vérifier que l’enregistrement est inaccessible.

**Bug :** double écriture sur Entrée/clic, montant nul ou supérieur au solde accepté, mauvaise année ou mauvaise identité.

### F17 — Import de paiements avec correspondances

**Prérequis :** directeur/comptable autorisé ; fichier Excel de test, élèves existants, profils de correspondance propres à l’école.

1. Ouvrir **Finance → Encaissements → Importer les paiements**, sélectionner le fichier.
2. Associer les colonnes aux champs demandés et enregistrer les correspondances. Attendu : les champs obligatoires sont tous associés, sans colonne ambiguë silencieusement choisie.
3. Lancer l’aperçu. Comparer montant/date/matricule de chaque ligne. Attendu : matricule inconnu signalé et aucune écriture encore présente dans l’historique financier.
4. Corriger le fichier ou la correspondance, refaire l’aperçu et cliquer **Importer … paiement**. Attendu : bilan des lignes importées puis paiements visibles dans F18.
5. Recharger l’importeur et charger un fichier avec les mêmes en-têtes. Attendu : correspondances mémorisées ; contrôler toujours l’aperçu avant confirmation.

**Bug :** écriture au simple aperçu, élève deviné à tort, montant mal interprété, erreur de ligne masquée. Ne pas confirmer deux fois un même historique sans contrôler le bilan des doublons.

### F18 — Historique, reçus et annulation

**Prérequis :** directeur/comptable ; paiement de 25 000 sur dette initiale 120 000 ; droit d’annulation ; worker PDF.

1. Ouvrir **Finance → Historique & reçus**, choisir l’année et les filtres, puis **Détails** pour l’élève.
2. Vérifier **Total dû**, **Cumul versé**, **Reste à payer**, date/mode/référence et **Solde après mouvement**. Attendu : 120 000 / 25 000 / 95 000 dans le cas simple.
3. Cliquer **Reçu**, attendre et ouvrir le PDF. Attendu : élève, école, somme et référence identiques.
4. Cliquer **Annuler**. Sans **Justification obligatoire**, la confirmation doit rester bloquée. Saisir « Erreur recette QA », puis **Confirmer l’annulation**.
5. Recharger. Attendu : paiement conservé avec statut **Annulé** et motif ; cumul versé revenu à zéro, reste à 120 000 ; aucun second bouton d’annulation sur ce paiement.

**Bug :** paiement effacé, annulation sans motif, solde non rétabli, reçu d’un autre élève ou seconde annulation changeant encore le solde.

### F19 — Journal de caisse et exports

**Prérequis :** directeur/comptable ; deux paiements de dates/modes/classes distincts et une annulation connue.

1. Ouvrir **Finance → Journal de caisse**, choisir l’année puis la période contenant les versements.
2. Noter les lignes et le total ; filtrer par classe puis par mode. Attendu : lignes filtrées et total correspondant au périmètre.
3. Exporter avec la commande proposée et ouvrir le fichier téléchargé. Vérifier les colonnes, montants, dates et références contre l’écran.
4. Choisir une période sans paiement. Attendu : état vide et total nul, sans anciennes lignes restantes.

**Bug :** export ne respectant pas les filtres, annulés additionnés aux encaissements confirmés, totaux divergents ou fichier non ouvrable.

### F20 — Tableau de recouvrement

**Prérequis :** directeur/agent financier ; jeu de paiements et remises connus ; noter les chiffres avant essai.

1. Ouvrir **Finance → Vue financière**, sélectionner l’année, puis **Recalculer les données**. Attendu : date du dernier calcul, encaissements, restant, taux et répartition par classe.
2. Enregistrer un paiement de 25 000 (F16), revenir et recalculer. Attendu : encaissé augmenté de 25 000 et restant diminué d’autant.
3. Annuler ce paiement (F18), recalculer. Attendu : retour aux valeurs de départ.
4. Accorder une remise de 10 000 (F15), recalculer. Attendu : dette réduite ; l’encaissé n’augmente pas.
5. Changer d’année. Attendu : chiffres et échéances de l’année choisie, sans mélange.

**Bug :** taux dépassant les limites sans explication, chiffres figés après recalcul, remise assimilée à un versement.

### F21 — Relances financières automatiques

**Prérequis :** directeur/agent habilité ; élève débiteur lié à un compte parent actif ; second parent d’une autre famille ; échéance connue ; worker de relance actif ; SMS configuré pour le scénario SMS.

1. Ouvrir **Administration → Paramètres → Relances**. Activer une règle préventive, une de retard ou de retard important ; définir le nombre de jours et le canal, puis **Enregistrer** sur la règle.
2. Recharger. Attendu : jours, activation et canal conservés. Essayer -1 ou plus de 365 jours : sauvegarde refusée.
3. Prévoir une échéance correspondant à la règle au prochain passage quotidien du worker. Après ce passage, consulter **Historique des relances**. Attendu : élève, date, type, canal et résultat corrects.
4. Pour **In-app**, se connecter comme parent lié et ouvrir la cloche **Voir les notifications**. Attendu : rappel au nom du bon enfant. Cliquer dessus : ouverture de **Paiements** sur cet enfant ; revenir aux notifications et recharger : le rappel est lu. La direction consulte l’historique d’exécution, elle n’est pas le destinataire familial.
5. Se connecter comme parent d’une autre famille. Attendu : aucun accès à ce rappel. Avec le premier parent, **Tout marquer comme lu**, puis recharger : aucun badge **Nouveau** restant.
6. Pour SMS, vérifier le téléphone de test ; un historique « envoyé » signifie mise en file, pas réception opérateur. Pour le canal combiné, une mise en file SMS échouée doit pouvoir être retentée sans doubler la notification déjà reçue dans l’application.
7. Préparer une échéance future déjà couverte par les paiements (y compris après remise) : aucune relance préventive. Sur un autre dossier à jour mais avec une échéance future non couverte, le rappel annonce l’échéance à venir, sans prétendre que le parent est en retard.
8. Désactiver la règle, enregistrer, puis vérifier l’absence de nouveaux rappels de ce type au passage suivant.

**Bug :** rappel adressé à la direction ou à une autre famille, doublon lors d’une reprise, lecture non conservée, échéance déjà payée relancée, règle désactivée encore utilisée. L’inventaire initial décrivait incorrectement le destinataire in-app ; le code actuel et la recette visent les parents liés.

### F22 — Consultation financière parent

**Prérequis :** parent lié à deux enfants ayant des montants distincts ; au moins un paiement confirmé.

1. Se connecter au portail et ouvrir **Paiements**, sélectionner Aya. Attendu : total, versements, reste et statut correspondant à F18.
2. Sélectionner Koffi. Attendu : chiffres propres à Koffi et aucune ligne d’Aya.
3. Télécharger un reçu et l’ouvrir. Attendu : enfant, montant et référence corrects. Le solde doit être visible pour l’année active réelle ; en l’absence d’année active, un message demande de contacter l’établissement, sans prétendre que l’historique est vide.
4. Lire les coordonnées de caisse/Mobile Money affichées. Le paiement direct dans IvoirEdu doit rester désactivé.
5. Se connecter comme un autre parent dans un autre profil : seuls ses propres enfants sont consultables.

**Bug :** solde confondu entre enfants, reçu étranger, bouton direct réellement débitant ou accès à un enfant non rattaché.

## Suivi pédagogique, conduite et décisions de fin d’année

### F23 — Évaluations et saisie des notes

**Prérequis :** professeur affecté à la classe/matière ; période ouverte ; calcul pas encore validé.

1. Ouvrir **Notes**, sélectionner classe et période. Attendu : matière du professeur et élèves de cette classe.
2. Créer une évaluation avec libellé, date, coefficient et barème. Sans EDT configuré, utiliser le choix sans créneau proposé.
3. Saisir par exemple Aya 16/20, Koffi 12/20, puis enregistrer. Recharger : mêmes notes.
4. Modifier Aya à 17/20 avant validation ; vérifier la nouvelle valeur après rechargement.
5. Tenter une note au-delà du barème ou négative. Attendu : erreur et aucune valeur invalide persistée.

**Bug :** note attribuée à un autre élève, perte silencieuse, date oubliée acceptée malgré validation, professeur modifiant la matière d’un collègue.

### F24 — Notes spontanées pendant un cours

**Prérequis :** professeur ; cours démarré et QR de début validé ; période/matière non verrouillée.

1. Ouvrir le cours dans **Mes cours**, puis l’action de notes spontanées disponible.
2. Choisir Aya et saisir un ajustement positif avec justification, enregistrer ; refaire un ajustement négatif motivé sur Koffi.
3. Consulter le détail pédagogique de chacun. Attendu : signe, valeur, justification et auteur conservés.
4. Essayer sans justification ou après validation définitive des moyennes. Attendu : refus.
5. Revoir un cours terminé depuis plus de 24 heures. L’action ne doit plus permettre une nouvelle note spontanée.

**Bug :** bonus transformé en malus, justification perdue, saisie hors fenêtre ou recalcul modifiant des résultats déjà verrouillés. La fenêtre actuelle couvre le cours puis 24 h après sa fin ; l’UI exige aussi le début de cours confirmé.

### F25 — Calcul et validation des moyennes

**Prérequis :** professeur ; notes enregistrées pour chaque élève ; évaluations/coefficient connus ; période ouverte.

1. Dans **Notes**, choisir classe/période puis **Calculer les moyennes** ou **Ouvrir le calcul** si déjà commencé.
2. Parcourir les étapes de calcul ; ouvrir **Consulter les notes de …** pour Aya. Comparer au calcul attendu : 10 coefficient 1 et 16 coefficient 2 donnent 14/20.
3. Cliquer **Voir les moyennes par élève**. Vérifier qu’un élève sans note est signalé, sans validation trompeuse d’une classe incomplète.
4. Après correction des données, **Valider mes moyennes de [matière]**. Attendu : **Moyennes validées**.
5. Recharger et retourner aux évaluations. Attendu : résultats consultables, modifications verrouillées ; suivi de complétude mis à jour côté direction.

**Bug :** mauvaise pondération, élève absent du calcul sans signalement, validation perdue ou modification encore possible après verrouillage.

### F26 — Bulletins, publication et PDF

**Prérequis :** directeur/staff avec accès bulletins et publication ; toutes les matières requises finalisées ; conduite finale renseignée ; parent lié ; worker PDF disponible.

1. Ouvrir **Académique → Bulletins**, choisir classe et période. Examiner le suivi de complétude. Une matière manquante doit être signalée avant génération.
2. **Générer les bulletins de la classe**. Attendu : bulletins générés ; vérifier élève, période, moyenne et rang.
3. Dans une session parent séparée, recharger l’accueil. Aucun lien vers un nouveau bulletin non publié ne doit être présenté.
4. Côté direction, **Publier tous les générés** ou publier le bulletin choisi. Attendu : statut **Publié**.
5. Recharger l’accueil parent, sélectionner l’enfant et cliquer **Bulletin du … disponible**. Choisir l’enfant dans **Bulletins scolaires**. Attendu : bulletin publié seulement, moyenne/rang corrects.
6. **Télécharger le PDF**, attendre puis ouvrir. Vérifier matières, coefficients, conduite, moyenne, identité et année. Pour 16 en matière coefficient 4 et conduite 18 coefficient 1, la moyenne générale attendue est 16,40.
7. Changer d’enfant et recharger si la page était déjà ouverte avant publication : aucun mélange, aucun brouillon visible.

**Bug :** bulletin visible avant publication, génération malgré matière requise manquante, PDF d’un autre enfant ou moyenne omettant la conduite. L’accès d’accueil parent apparaît après publication ; les listes déjà ouvertes peuvent nécessiter un rechargement.

### F27 — Décisions de passage, redoublement ou exclusion

**Prérequis :** directeur/agent explicitement habilité ; année et date de revue configurées ; élèves avec résultats annuels ; environnement de test permettant les deux dates.

1. Dans **Académique → Structure scolaire → Années scolaires**, vérifier la date de revue de fin d’année.
2. Avant cette date, vérifier que **Académique → Fin d’année** n’est pas proposé. Ce masquage est attendu.
3. À partir de la date, ouvrir **Fin d’année**, choisir année/classe ; préparer une décision individuelle puis une opération en lot sur des élèves de test.
4. Lire la prévisualisation, corriger les choix nécessaires, puis valider. Attendu : décisions finales, auteurs et classes/niveaux proposés cohérents.
5. Recharger et consulter **Inscriptions → Réinscriptions**. Attendu : les décisions gouvernent les candidats et les classes possibles.

**Bug :** menu absent malgré date et droits valides, validation par rôle non autorisé, lot touchant une autre classe, réinscription d’un exclu. Les changements de date doivent rester limités à l’école de recette.

### F28 — Décision finale de conduite

**Prérequis :** professeur principal affecté à la classe, ou éducateur affecté disposant du droit de décision ; élèves et période existants.

1. Sur ordinateur, comme professeur principal, ouvrir **Enseignement → Décision finale de conduite**. Sur le parcours mobile de calcul, la commande **Définir la conduite de …** permet aussi de traiter la conduite avant verrouillage.
2. Sélectionner **Classe enseignée**, **Période**, puis **Élève**. Consulter les éléments de conduite affichés.
3. Saisir 18/20 puis **Arrêter la note**. Attendu : **Note définitive : 18/20** ; recharger et sélectionner à nouveau l’élève pour vérifier.
4. Essayer -1 ou 21 : refus. Si la classe contient plus de 100 élèves, rechercher aussi un élève au-delà des 100 premiers.
5. Avec un professeur non principal sans affectation autorisée, vérifier le refus de décision. Vérifier la conduite dans le bulletin F26.

**Bug :** autre classe accessible en écriture, 101e élève introuvable, valeur hors 0–20, décision perdue. Écart à l’inventaire : le professeur principal est autorisé par son affectation, sans permission additionnelle ; l’éducateur doit être affecté et posséder le droit dédié.

## Communication et service aux parents

### F29 — Portail parent multi-enfants

**Prérequis :** parent lié à deux enfants de classes différentes ou aux données distinctes.

1. Se connecter avec téléphone/mot de passe ; effectuer le changement obligatoire si demandé. Attendu : accueil avec les enfants rattachés.
2. Choisir Aya sur l’accueil : vérifier présence du jour et compteurs d’absences. Choisir Koffi : données mises à jour pour lui.
3. Ouvrir successivement **Absences**, **EDT**, **Paiements** et le bulletin publié depuis l’accueil (F26). Vérifier le nom sélectionné sur chaque écran et changer d’enfant lorsque le sélecteur est proposé.
4. Ouvrir **Compte** : identité et statut d’abonnement éventuel, sans création autonome de souscription.
5. Changer le mot de passe, se déconnecter puis se reconnecter avec le nouveau. Attendu : nouveau mot de passe accepté et anciens accès refusés.

**Bug :** données restant celles du précédent enfant, enfant étranger visible, mot de passe non changé malgré succès ou absence de contrôle au rechargement.

### F30 — Alerte au parent après absence

**Prérequis :** téléphone de test lié à l’élève ; service SMS activé ; abonnement actif si mode payant ; quota disponible ; worker/fournisseur opérationnels.

1. Comme directeur, ouvrir **Administration → Paramètres → Communication**. Si la personnalisation est autorisée, modifier le modèle d’absence avec les variables proposées et enregistrer ; sinon vérifier le mode lecture seule.
2. Comme professeur, effectuer F01/F02 et déclarer Aya absente une seule fois.
3. Attendre le traitement asynchrone et contrôler la réception sur le téléphone de test. Attendu : bon enfant, cours/date/école, aucune variable brute non remplacée.
4. Examiner le suivi SMS disponible à l’administration ; comparer destinataire et résultat à la réception.
5. Vérifier qu’aucune alerte d’absence n’est envoyée pour Koffi laissé présent.

**Bug :** mauvais destinataire, doublon indu, message d’absence pour un présent ou panne SMS faisant échouer l’appel. Ne pas confondre absence de fournisseur/quota avec échec de sauvegarde de l’appel.

### F31 — Abonnements Alertes Parents

**Prérequis :** directeur/agent avec création, renouvellement et annulation ; mode payant ET souscriptions ouverts par IvoirEdu ; tarif 1 000 FCFA/enfant/mois ; élève sans abonnement concurrent.

1. Ouvrir **Finance → Abonnements parents**, **Nouvel abonnement**. Choisir un parent enregistré ou **Ajouter un autre parent**, saisir identité et téléphone. Un numéro court doit être refusé.
2. **Continuer**, choisir classe et enfant, durée 2 mois. Attendu pour un enfant : total 2 000 FCFA.
3. **Continuer**, vérifier mode de paiement et **Paiement reçu maintenant**, puis **Créer l’abonnement**. Attendu : succès, accès affichés seulement si nouveau compte ; fermer et recharger pour voir l’abonnement actif.
4. Sur sa ligne, **Voir dossier** ; contrôler enfants, dates, montant et historique.
5. Sur un abonnement créé depuis moins de sept jours, menu **Actions → Annuler l’abonnement** ; sans motif, confirmation impossible. Saisir un motif et confirmer. Attendu : annulation tracée, sans suppression de l’historique.
6. **Renouveler l’accès**, vérifier projection/durée/montant et confirmer. Recharger : abonnement actif et nouvelles dates cohérentes.
7. Ouvrir **Finance → Revenus abonnements** et contrôler les mouvements de la recette. Depuis le compte parent, seule la consultation du statut est attendue.

**Bug :** total ne tenant pas compte du nombre d’enfants, renouvellement perdu, annulation hors délai acceptée, compte existant réinitialisé ou menu exposé sans activation.

## Pilotage de la direction et contrôle des accès

### F32 — Tableau de bord de direction

**Prérequis :** directeur ; cours, absences, salaires, frais et notes connus pour le jour/période.

1. Ouvrir **Pilotage → Tableau de bord**. Attendu : présence du jour, alertes, finance et état pédagogique chargés, ou un état vide/erreur explicite.
2. Comparer un compteur aux données détaillées : ouvrir le lien de suivi des professeurs depuis le tableau des présences.
3. Vérifier une action prioritaire liée à une anomalie existante : le lien doit mener à l’écran permettant de la traiter.
4. Corriger cette anomalie, revenir et recharger. Attendu : données actualisées après le calcul requis, aucune donnée d’une autre école.
5. Avec un staff limité, vérifier que les accès et actions respectent les permissions.

**Bug :** zéro masquant une erreur de chargement, lien mort, économie de paie calculée sur des heures déjà effectuées ou informations financières exposées sans droit.

### F33 — Règles de vigilance

**Prérequis :** directeur/agent avec modification des risques ; données d’absences, moyennes et impayés connues.

1. Ouvrir **Administration → Paramètres → Risques**.
2. Modifier un seuil d’absence élève, de baisse de moyenne, d’impayé ou d’absence professeur ; enregistrer puis recharger. Attendu : valeur et activation conservées.
3. Choisir un seuil dépassé par les données QA et consulter les compteurs/alertes du tableau de bord après actualisation.
4. Désactiver la règle, enregistrer et vérifier l’effet après actualisation.
5. Essayer une valeur hors limites et un rôle sans droit de modification. Attendu : refus.

**Bug :** règle non sauvegardée, seuil appliqué à la mauvaise catégorie ou rôle non autorisé pouvant modifier. L’écran ne promet pas une liste nominative des élèves à risque.

### F34 — Comptes administratifs, postes et droits

**Prérequis :** directeur ; quota de comptes/postes disponible ; second profil de navigateur.

1. Ouvrir **Administration → Paramètres → Personnel**. Créer un compte administratif de recette et conserver temporairement ses accès.
2. Créer un poste autorisant uniquement la consultation des salles, puis l’attribuer au compte.
3. Se connecter comme cet agent. Attendu : consultation des salles possible ; création/suppression et finance interdites.
4. Comme directeur, retirer le poste ; recharger la session agent et tenter de rouvrir les salles. Attendu : accès refusé.
5. Attribuer les droits de bulletins ou de décision de conduite à un agent affecté, reconnecter et vérifier les menus correspondants.
6. Réinitialiser le mot de passe via la commande prévue, vérifier le nouvel accès puis supprimer/désactiver le compte QA. Attendu : connexion ultérieure refusée.

**Bug :** droits partiellement filtrés à la connexion, révocation inefficace, permissions héritées d’un autre poste ou agent capable d’administrer ses propres droits.

## Mise en route et migration

### F35 — Assistant de première configuration

**Prérequis :** directeur d’une école neuve non configurée ; aucun professeur ; pas l’école déjà utilisée pour les autres fiches.

1. Se connecter. Attendu : **Onboarding directeur**, étape 1/5. Remplir nom d’école, téléphone et adresse, **Continuer**.
2. À **Étape 2 - Professeurs**, vérifier que **Continuer** est bloqué sans professeur. Ajouter nom, matière et type avec **Ajouter le professeur** ; attendu : compteur au moins 1.
3. Recharger. Attendu : étape 2 et progression conservées. **Continuer**.
4. À l’étape élèves, tester l’import ou l’ajout si les données sont prêtes ; sinon **Passer cette étape**. Attendu : accès à l’étape 4.
5. À **Emploi du temps**, ajouter un créneau si préparé, ou **Continuer** pour compléter plus tard. Attendu : **Configuration terminée !**
6. **Accéder au tableau de bord**, puis déconnexion/reconnexion. Attendu : tableau de bord, aucune boucle obligatoire dans l’assistant.

**Bug :** étape obligatoire contournée, progression perdue après rechargement, fin non enregistrée ou import échoué annoncé comme réussi.

### F36 — Imports courants d’élèves, professeurs et EDT

**Prérequis :** directeur/staff disposant du droit d’import correspondant ; modèles et quelques lignes fictives ; classe/matière/salle de référence connues.

1. Ouvrir **Administration → Import de données**, sélectionner élèves, professeurs ou emploi du temps. Télécharger le modèle proposé et remplir quelques lignes.
2. Charger le fichier et lancer le contrôle/aperçu. Attendu : lignes valides, erreurs et conflits identifiables ; aucune écriture avant confirmation.
3. Tester une ligne incomplète et un conflit d’EDT ; corriger le fichier puis refaire le contrôle.
4. Confirmer l’import des lignes valides. Attendu : bilan explicite et nouveaux éléments dans **Élèves**, **Professeurs** ou **Emploi du temps**.
5. Consulter l’historique d’import et répéter le contrôle du même fichier. Attendu : mises à jour/doublons indiqués selon le mode, sans multiplication silencieuse des personnes.
6. Refaire pour les trois types. Un agent autorisé seulement aux élèves ne doit pas pouvoir importer les professeurs ou l’EDT.

**Bug :** écriture avant confirmation, colonne ignorée sans alerte, associations erronées, doublons ou historique absent.

### F37 — Reprise en cours d’année par IvoirEdu

**Prérequis :** super admin ; école QA dédiée ; option reprise activée ; fichiers fictifs cohérents, matricules stables ; aucun ancien bulletin à importer.

1. Ouvrir la console super admin, **Écoles**, rechercher l’école et **Config**. Cocher **Activer l’import prise en main**. Attendre la confirmation de sauvegarde automatique, puis recharger. Attendu : option conservée et onglet d’import disponible.
2. Ouvrir cet onglet. Importer dans l’ordre **niveaux → matières → salles → classes → élèves → paiements**. Pour chaque fichier : associer les colonnes, **Enregistrer les correspondances**, contrôler l’aperçu, puis confirmer.
3. Dans le fichier élèves, renseigner les coordonnées parentales : elles créent/réutilisent les comptes liés. Il n’y a pas de septième import autonome « parents ».
4. Dans l’école, vérifier les niveaux/matières et coefficients, les salles/QR, les classes et élèves ; contrôler le portail du parent lié.
5. Dans **Historique & reçus** et **Vue financière**, vérifier les montants initiaux importés contre le fichier, en distinguant dette et versement.
6. Vérifier que les anciennes notes ne sont pas importées ; désactiver l’option sur une autre école QA et vérifier le masquage/refus. Le directeur ne doit pas disposer des commandes de reprise super admin.

**Bug :** références de classes perdues, parent doublonné, coefficients ou montants tronqués, données écrites dès l’aperçu ou import possible sans activation.

## Périmètre explicitement exclu

Les quatre promesses indisponibles de l’inventaire ne doivent pas être validées comme livrées : paiement direct parent, réinscription autonome parent, fil chronologique consolidé parent, souscription autonome parent. Leur absence est attendue ; les parcours école correspondants sont couverts ci-dessus.

## Fiche de résultat à copier

| Champ | Valeur |
|---|---|
| Date / version / école QA | |
| Test Fxx / rôle / appareil / navigateur | |
| Préconditions vérifiées | |
| Résultat OK / KO / BLOQUÉ | |
| Étape et résultat observé | |
| Résultat attendu | |
| Preuve anonymisée / ticket | |
| Données créées à conserver ou nettoyer | |
