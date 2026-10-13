# Mes Calories dans StayClean Agenda

Quatrième carte de l'accueil : **MES CALORIES**. Tu dis ce que tu as mangé, l'appli calcule les calories ; tu te pèses, elle trace ton évolution et ta date d'arrivée.

Rien de nouveau à connecter : Mes Calories utilise **ton compte**, **ton serveur Supabase** et **ta clé d'IA (Claude ou Gemini)** déjà réglés dans l'agenda.

## L'appli

- **Aujourd'hui** : anneau « kcal restantes » (objectif 2 000 par défaut), protéines du jour, gros bouton **Dire ce que j'ai mangé**, repas habituels en un toucher, carte Poids, 7 derniers jours.
- **Repas en 3 gestes** : 🎤 → tu parles → *Terminé* → l'IA liste les aliments (portions ajustables avec − et +) → *Enregistrer*. Aussi : écrire, photo du plat, ou entrer les kcal toi-même (sans clé d'IA).
- **Évolution** : poids actuel, progression vers l'objectif, courbe (pesées + tendance lissée), rythme en kg par semaine, date d'arrivée, IMC, listes par pesée / semaine / mois, calories des 14 derniers jours, et « Ce que dit la science » (métabolisme, dépense estimée puis **mesurée**, rythme sain, protéines, scénarios plus rapides mais sains).
- `calories.html` ; la flèche **‹** en haut à gauche revient à l'accueil.

## Les calculs

| | Méthode |
|---|---|
| Métabolisme de base | Mifflin-St Jeor : 10 × kg + 6,25 × cm − 5 × âge + 5 (homme) / − 161 (femme) |
| Dépense par jour | métabolisme × activité (1,2 · 1,375 · 1,55 · 1,725) |
| Graisse | 1 kg ≈ 7 700 kcal |
| Tendance | moyenne lissée des pesées (10 % par jour), pour le graphique |
| Rythme | droite des moindres carrés sur les pesées des 28 derniers jours, sans la 1re semaine de suivi (eau) ; ≥ 14 jours et ≥ 4 pesées |
| Dépense mesurée | même période : apport moyen des jours bien notés (≥ 50 % de l'objectif) − pente × 7 700 ; ignorée si invraisemblable |
| Date d'arrivée | au rythme réel quand il existe (≈ 3 semaines de suivi), sinon projection semaine par semaine (la dépense baisse avec le poids) |
| Rythme sain | 0,5 à 1 % du poids par semaine ; jamais sous 1 500 kcal sans suivi médical |
| Protéines | ≈ 1,6 g par kg de poids visé (modifiable) |

## Installation (une seule fois)

1. **Base de données** : Supabase → SQL Editor → colle [`supabase/mes-calories.sql`](supabase/mes-calories.sql) → **Run**. Il crée seulement la table `cal_items` (RLS : chaque compte ne voit que ses lignes). On peut le relancer sans risque.
2. **Mise en ligne** : publier sur `main` → GitHub Pages. Le service worker passe en v37.
3. Sur l'iPhone : ouvre StayClean Agenda **depuis l'icône** → MES CALORIES → *Configurer* (poids, objectif, taille, âge) si ce n'est pas déjà fait.

La dictée utilise la reconnaissance vocale du téléphone. Si elle est refusée ou absente, l'appli passe à l'écrit : le micro du clavier de l'iPhone permet de dicter.

## Comment c'est construit

| Élément | Rôle |
|---|---|
| `calories.html` | La page (même portée que l'agenda : même appli installée, même session). |
| `calories/app.js` | Le code, lisible, sans étape de compilation (modules mis bout à bout, sections « ===== »). |
| `calories/app.css` | Styles (mêmes bases que Ma Paperasse, teinte orange). |
| `supabase/mes-calories.sql` | Table `cal_items`, RLS, droits. |

**Données** (privées au compte connecté) : `cal_items`, une ligne par repas (`meals`), par pesée (`weights`, une par jour : `w-AAAA-MM-JJ`) et les réglages (`settings/main`). Synchro incrémentale par `updated_at` (posé par le serveur), suppression = `deleted = true`. Copie locale dans IndexedDB (`mes-calories`) pour un affichage immédiat ; résumé de la carte d'accueil dans `ct.summary.v1`. Les photos ne sont jamais stockées.

**IA** : le moteur réglé dans l'agenda. Claude : `claude-sonnet-5-5` (repli `claude-sonnet-4-6`), JSON en texte ; Gemini : `gemini-2.5-flash`. Ce qui est dicté ou photographié est traité comme une donnée, jamais comme une consigne.

## Dépannage

- **Bandeau « pas encore installée sur ton serveur »** : l'étape 1 n'a pas été faite (ou pas sur le bon projet).
- **« Tu n'es pas connecté »** : connecte-toi dans l'agenda (Réglages → Synchronisation).
- **Le micro ne s'ouvre pas** : autorise le micro et la reconnaissance vocale pour l'appli, ou utilise « Écrire » et le micro du clavier.
