# StayClean Agenda — architecture

Application web installable (PWA), en JavaScript sans framework, hébergée sur GitHub Pages.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | L'application. Elle contient l'agenda, les clients, les demandes, les devis, la compta de base, les réglages et la synchronisation. |
| `business.js` | Les modules « Business OS » : fiche client 360°, paiement en un geste, facture express, bénéfice, centre « À payer ». |
| `finance.js` | Les modules « StayClean Finance » : profil fiscal, caisse, revenus et attestations, notes de crédit, journal. |
| `origine-google-ads.js` | Badge et compteur des demandes venues de Google Ads. Lecture seule. |
| `dispo.html` | Page publique des disponibilités. Elle lit `sc_dispo`, `sc_fermes` et `sc_reglages`. |
| `reserver.html` | Redirige vers stayclean.be. L'ancienne page de réservation est retirée ; elle reste dans l'historique Git. |
| `sw.js` | Service worker : le réseau d'abord, le cache seulement hors ligne. |
| `tests/` | Banc d'essai automatisé. Il utilise un faux Supabase et des données fictives, jamais la production. |

`business.js` et `finance.js` sont chargés après le script principal. Ils utilisent ses fonctions globales (`DB`, `save`, `renderAll`, `esc`, `todayStr`…).

## Données : où, qui écrit, qui lit

- **`DB`** (dans `localStorage`, clé `stayclean-agenda-v1`) contient :
  - les RDV, tâches, demandes, congés et la corbeille ;
  - la compta : `cpt.dep` (dépenses), `cpt.ven` (factures et notes de crédit), `cpt.caisse`, `cpt.attest`, `cpt.oblig`, `cpt.profil` ;
  - les réglages.
- **Cloud** : table Supabase `agenda_state`, une ligne par utilisateur connecté. Voir la section « Synchronisation » ci-dessous.
- **Publication vers le site** (`sitePublierEtat`), après chaque changement d'agenda :
  - `sc_fenetres` : les plages libres des jours qui ont une exception. Le site les lit via la vue `sc_dispo`.
  - `sc_bloques` : les jours complets.
  - `sc_config` : les réglages et les durées. Le site les lit via `sc_reglages`.
- **Demandes du site** : `sc_demandes`, relevées toutes les 3 minutes par `siteRecevoir`.
- **Devis** : table `sc_devis`. La page `stayclean.be/reservation/?d=…` lit un devis par son jeton.

## Sources de vérité (une donnée = un endroit)

| Donnée | Source | Utilisée par |
|---|---|---|
| **Durées** | Réglages → Durées (`DB.settings.durations`) | L'agenda (`computeDuration`, `placeBooking`) et le site, qui reçoit la grille dans `sc_reglages.durees` via `siteDurees()`. |
| **Horaires, tampon de déplacement, jours ouverts** | `DB.settings.site` | Les plages publiées, le placement des RDV et le site. |
| **Prix** | `DB.settings.pricing` dans l'app ; `PRODUCTS` sur le site | Les grilles sont identiques. Toute modification doit être faite **aux deux endroits**. |
| **Taux de TVA** | `tvaPresta()` / `SCF.tauxPresta()` | Toute la compta. 21 % par défaut, 0 % en franchise. |

Pour les durées, un mot-clé plus précis gagne toujours sur un mot-clé plus général : « canape 8 » passe avant « canape ». La moquette se compte par tranche de 30 m², comme sur le site.

## Synchronisation (fusion sans perte)

- **Au démarrage** : une seule tournée. L'app lit le cloud, puis publie les disponibilités, et seulement si la lecture a réussi. Tant que cette lecture n'est pas faite, rien n'est modifié automatiquement (`autoTerminer` attend).
- **Modifications locales** : elles sont comptées par un compteur (`seq`), jamais par l'horloge, parce qu'une horloge fausse ne doit rien décider.
- **Avant d'envoyer** : l'app relit le cloud. Si un autre appareil a écrit, elle fait une **fusion à trois voies** (même principe que Git) :
  - modifié seulement ailleurs → on prend la version d'ailleurs ;
  - modifié seulement ici → on garde celle d'ici ;
  - supprimé d'un côté et inchangé de l'autre → supprimé ;
  - modifié des deux côtés → le plus récent gagne.
- **Écriture conditionnelle** : si quelqu'un a écrit entre la lecture et l'envoi, l'app relit, refusionne et réessaie.
- **Hors ligne** : pas de relance en boucle. La synchro repart au retour du réseau ou quand on revient sur l'app.
- **Ce qui ne part jamais** : les clés d'IA et les paramètres de connexion.
- **Publications vers le site** :
  - une seule à la fois, et les demandes arrivées pendant une publication sont regroupées ;
  - mise à jour par différence : ajouter, puis retirer. Un jour n'apparaît jamais « vide » au site ;
  - les doublons déjà en ligne sont nettoyés.

## Règles métier codées

- **Journée longue** : une prestation plus longue qu'une journée de travail commence à l'ouverture. Le site réserve le 1er jour complet ; la suite se planifie par téléphone.
- **Facture** :
  - Le brouillon reprend le prix convenu. Le total TTC est exact au centime et la TVA en est déduite.
  - Le numéro est attribué à la validation : la date du jour, l'année de cette date, une suite continue.
  - Une facture validée ne se supprime pas ; on l'annule par une note de crédit.
- **Revenus** :
  - Une intervention terminée compte comme payée, sauf si « non payé » est noté.
  - Une intervention facturée n'est comptée qu'une fois, via sa facture.
  - Une facture annulée par une note de crédit ne compte plus.

## Tests

```
pip install playwright   # Chromium déjà présent
python3 tests/test_suite.py
```
