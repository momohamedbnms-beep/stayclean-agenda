# Mon Programme (« Le Camp ») dans StayClean Agenda

Quatrième carte de l'accueil : **MON PROGRAMME**, à la place de MES CALORIES (23/11/2026, demande de Mohamed). Six séances d'athlète en rotation, la nutrition et le poids. On appuie sur **Je m'entraîne aujourd'hui**, l'appli donne la séance du jour.

Rien à installer : Mon Programme utilise **ton compte** et **ton serveur Supabase** déjà réglés dans l'agenda, et la table `cal_items` de Mes Calories (aucun SQL à lancer).

## L'appli (v2, « le coach », 23/11/2026)

- **Séances** : le tableau des 6 (J1 → J6). On fait la suivante, le jour qu'on veut : le jour de la semaine ne compte pas, le repos se prend quand on peut. Une séance faite se **barre d'une croix rouge** ; « Déjà faite ? Aujourd'hui / Hier » barre une séance faite sans l'appli. Les 6 barrées = semaine bouclée ; le lendemain, tableau neuf.
- **GO** = le coach, plein écran, un exercice à la fois : dessin animé du mouvement, série X/Y, répétitions en très gros, intensité (LOURD · garde 2 reps, CONTRÔLÉ, EXPLOSIF, 🔥 À FOND sur la dernière série, ☠ FINISHER), charge proposée avec − / +, puis **FAIT** → repos chronométré avec la suite affichée. Minuteurs automatiques pour le gainage, la corde, les cordes ondulatoires, les sprints et La Totale (enchaînement sans pause) ; chrono « tiens au max » pour la suspension ; durée pour le tapis et la nage.
- **Coach** : voix française (coupable), bips des 3 dernières secondes, vibration, écran qui reste allumé. Après chaque exercice chargé : « C'était comment ? » 🥵 / 💪 / 😎 ; « facile » = la charge monte toute seule la fois suivante. Records 🏆 en fin de séance.
- **Ajustements automatiques** : semaines 1–2 et 7 = une série de moins ; Ramadan (8 février – 9 mars 2027) = J1, J3, J4, J6, trois séries max, sans finisher ni La Totale ; niveau de La Totale et du gilet selon la semaine.
- **Assiette** : les 3 repas illustrés avec les grammes, la cible calculée pour le profil, les échanges, 4 règles.
- **Poids** : − / + puis Enregistrer, courbe avec le plan, moyenne 7 jours, verdict en une ligne.
- Fonctionne sans réseau à la salle : polices embarquées (`sport/fonts/`, licence OFL), aucun code extérieur hormis supabase-js pour la synchro.

## Partager à un ami

Profil → **Envoyer le programme à un ami** : `sport.html?ami=Prénom` (le prénom est prérempli). L'ami crée son profil (son poids, son objectif) et tout reste **sur son téléphone** :

- aucun compte, aucune connexion à Supabase, aucune lecture des réglages de l'agenda ;
- pas de flèche vers l'agenda, pas de lien vers Mes Calories ;
- « Ajouter à l'écran d'accueil » installe l'icône **Le Camp** (`sport/manifest.webmanifest`).

Il ne peut donc rien voir ni toucher de StayClean : il n'a aucun identifiant.

## Données

| Où | Quoi |
|---|---|
| `localStorage` « sp.state.v1 » | Copie sur l'appareil : profil, séances faites, charges, pesées, séance en cours, envois en attente. |
| `cal_items`, kind `weights`, id `w-AAAA-MM-JJ` | Les pesées : **les mêmes que Mes Calories** (même format `{ id, date, kg, at }`). |
| `cal_items`, kind `settings`, id `sport` | Profil, séances faites, charges. Fusion par entrée (la plus récente gagne) entre téléphone et Mac. |
| `localStorage` « sp.summary.v1 » | Résumé pour la carte de l'accueil (prochaine séance, séance faite, dernier poids). |

Mes Calories ne lit plus que `settings/main` (elle ignorait déjà le reste ; correctif d'une ligne dans `calories/app.js`). `calories.html` reste accessible depuis le profil de Mon Programme.

## Comment c'est construit

| Élément | Rôle |
|---|---|
| `sport.html` | La page (même appli installée que l'agenda ; manifeste à part pour l'ami). |
| `sport/app.js` | Le code, sans compilation. `window.__SP` sert aux tests. |
| `sport/app.css`, `sport/pics.css`, `sport/fonts/` | Styles (même univers que le PDF « Opération 87 »), polices Anton et DM Sans embarquées. |
| `sport/data.js` | **Généré** : séances compilées (mode, séries, repos, intensité, charge, pas), repas illustrés, dessins en deux images (départ, effort). Ne pas modifier à la main. |
| `sport/sources/` | `program.py` (les séances), `plan.py` (repas), `fig.py` (moteur des dessins), `build.py` + `css.py` (illustrations des repas), `gen_sport.py` (génère `data.js` et `pics.css`). |
| `tests/sport/test_sport.py` | Banc d'essai (41 vérifications) : lien ami sans réseau, séance barrée « hier », coach de bout en bout, reprise après fermeture, charges et records, semaine bouclée puis tableau neuf, migration v1, compte relié avec faux Supabase, 2e appareil, carte de l'accueil. |

Changer une séance : modifier `sport/sources/program.py`, puis `python3 sport/sources/gen_sport.py .` depuis la racine du dépôt (Python 3, aucune dépendance).
