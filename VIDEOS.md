# Vidéos à publier

Section de StayClean Agenda (carte de l'accueil, juste sous STAYCLEAN). Créée le 12/11/2026.

## But
Deux vidéos courtes par jour sur TikTok, Instagram et Snapchat. Les vidéos envoient vers le site (réservation, devis), jamais vers les messages privés.

## Fichiers
- `videos.html` : la page.
- `videos/app.js`, `videos/app.css` : l'écran (Aujourd'hui, Banque, Calendrier, Guide).
- `videos/data.js` : **tout le contenu**. Repères de prix, plans à filmer, formats, appels à réserver, et la liste `videos`.

## Ajouter ou terminer une vidéo
Dans `videos/data.js`, une vidéo a un `statut` :
- absent ou `"script"` : le texte est prêt, les images manquent ;
- `"pret"` avec `file: "https://…mp4"` : la vidéo est montée, l'app affiche le lecteur et le bouton « Télécharger ».

Une vidéo datée porte `fenetre: ["AAAA-MM-JJ", "AAAA-MM-JJ"]` : elle prend la place du soir le premier jour possible de sa période.

## Calendrier
30 jours, 2 par jour (12:15 et 19:30, heure de Bruxelles). Jours 1 à 14 : version A. Jours 15 à 28 : version B (autre début, autre couverture, plans dans l'ordre inverse). Jours 29 et 30 : à choisir d'après les chiffres.

## Règles
- Chaque chiffre vient du site. Un prix qui change sur le site doit changer dans `reperes` et dans les vidéos qui le citent.
- Aucune image créée par IA présentée comme un vrai chantier.
- Aucune promesse sur les taches ni sur la santé.
- Deux vidéos qui se suivent n'ont jamais le même textile.

## Données sur l'appareil
`vd.state.v1` (date de départ, publications cochées) et `vd.summary.v1` (résumé de la carte). Rien ne part vers Supabase.
