# Mon Programme (« Le Camp ») dans StayClean Agenda

Quatrième carte de l'accueil : **MON PROGRAMME**, à la place de MES CALORIES (23/11/2026, demande de Mohamed). Six séances d'athlète en rotation, la nutrition et le poids. On appuie sur **Je m'entraîne aujourd'hui**, l'appli donne la séance du jour.

Rien à installer : Mon Programme utilise **ton compte** et **ton serveur Supabase** déjà réglés dans l'agenda, et la table `cal_items` de Mes Calories (aucun SQL à lancer).

## L'appli

- **Aujourd'hui** : la séance suivante dans la rotation (J1 → J6, puis un jour de repos). Le jour de la semaine ne compte pas : du lundi au samedi ou du dimanche au vendredi, c'est pareil. Un jour raté, on reprend où on s'était arrêté. Jamais deux séances le même jour.
- **La séance** : chaque exercice avec son dessin, séries × répétitions, repos, consigne de charge (garde 2 reps / dernière série à fond), une pastille par série à cocher, minuteur de repos qui part tout seul, case « Charge » (kg) et « La dernière fois : … kg ». Une séance commencée se retrouve si on ferme l'appli.
- **Ajustements automatiques** : semaines 1–2 et semaine 7 = une série de moins ; Ramadan (8 février – 9 mars 2027) = J1, J3, J4, J6 seulement, trois séries max, pas de finisher ni de La Totale ; niveau de La Totale et du gilet lesté selon la semaine.
- **Programme** : les 6 séances, les règles (lourd oui, échec non), le gilet, les semaines spéciales, l'historique.
- **Assiette** : le menu fixe (bol, shake, assiette ≈ 2 000 kcal, 182 g de protéines), la cible calculée pour le profil et les ajouts éventuels, les échanges, le Ramadan.
- **Poids** : pesée du jour, courbe avec le plan (≈ 1 kg par semaine), moyenne 7 jours et verdict.

## Partager à un ami

Profil (⚙︎) → **Partager le lien** : `sport.html?ami=1`. L'ami crée son profil (son poids, son objectif) et tout reste **sur son téléphone** :

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
| `sport/app.css`, `sport/pics.css` | Styles (même univers que le PDF « Opération 87 »). |
| `sport/data.js` | **Généré** : séances, repas et dessins. Ne pas modifier à la main. |
| `sport/sources/` | `program.py` (les séances), `plan.py` (repas), `fig.py` (moteur des dessins), `gen_sport.py` (génère `data.js` et `pics.css`). |
| `tests/sport/test_sport.py` | Banc d'essai : lien ami sans réseau, rotation sur plusieurs jours, repos après J6, charges retenues, compte relié avec faux Supabase, 2e appareil, carte de l'accueil. |

Changer une séance : modifier `sport/sources/program.py`, puis `python3 sport/sources/gen_sport.py .` depuis la racine du dépôt (Python 3, aucune dépendance).
