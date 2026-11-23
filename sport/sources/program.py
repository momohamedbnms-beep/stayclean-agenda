# -*- coding: utf-8 -*-
"""Opération 87, version « camp » : 6 séances en rotation (J1 à J6), départ 106 kg.
Source unique pour le PDF et pour l'app."""

# mark : keep = garde 2 reps · keep1 = garde 1 rep · max = dernière série à fond · hold = tiens au max
SESSIONS = [
    {"id": "J1", "cls": "sA", "color": "#5f8aff", "name": "Force haut", "nick": "Le poids", "dur": "55 min",
     "tags": ["Lourd", "Haut du corps"], "pic": "incline",
     "warm": "Rameur 5 min, rotations d’épaules, deux séries légères du premier exercice.",
     "ex": [
         {"n": "Développé incliné haltères", "w": 1, "d": "5 × 5–6", "r": "2 min 30", "k": "incline", "m": "keep", "c": "Lourd. Descends en 2 secondes, pousse explosif."},
         {"n": "Rowing australien lesté", "w": 1, "d": "5 × 6–8", "r": "2 min", "k": "row", "m": "keep", "c": "Disque sur la poitrine ou gilet. Sans lest en semaines 1 et 2."},
         {"n": "Développé militaire haltères", "w": 1, "d": "4 × 6–8", "r": "2 min", "k": "press", "m": "keep", "c": "Assis, dos calé, gainé. Pas de cambrure."},
         {"n": "Tirage vertical lourd", "w": 1, "d": "4 × 6–8", "r": "2 min", "k": "pulldown", "m": "keep", "c": "Coudes vers les hanches, aucun élan."},
         {"n": "Pompes", "w": 1, "d": "3 × 10–15", "r": "90 s", "k": "pushup", "m": "keep", "c": "Avec le gilet dès que tu passes 15 propres."},
         {"n": "Élévations latérales", "w": 1, "d": "3 × 12–15", "r": "60 s", "k": "lateral", "m": "max", "c": "Léger, strict. C’est ce qui élargit les épaules."},
         {"n": "Suspension, puis négatives", "d": "3 × 20–40 s", "r": "60 s", "k": "hang", "m": "hold", "c": "Dès la semaine 5 : 3 × 3 descentes lentes de 5 secondes."},
     ],
     "fin": {"n": "Finisher : marche du fermier lourde", "w": 1, "d": "4 × 30 m", "r": "60 s", "k": "farmer", "c": "Les haltères les plus lourds que tu tiens 30 m."},
     "cardio": {"t": "Tapis incliné, gilet lesté", "d": "15 min", "c": "Pente 10 %, 5 km/h. Gilet : voir la règle."}},

    {"id": "J2", "cls": "sH", "color": "#ff6257", "name": "Le camp", "nick": "Le moteur", "dur": "45 min",
     "tags": ["Cardio de combattant", "Explosif"], "pic": "sled",
     "warm": "Corde à sauter 3 × 1 min tranquille, 30 s de pause.",
     "ex": [
         {"n": "Rameur, fractionné", "d": "6 × 250 m", "r": "90 s", "k": "rower", "m": "push", "c": "Fort, chaque 250 m au même chrono. Le dernier = le premier."},
         {"n": "Kettlebell swing", "w": 1, "d": "5 × 15", "r": "60 s", "k": "swing", "m": "keep", "c": "Les hanches claquent, pas les bras. Dos plat."},
         {"n": "Slam ballon", "w": 1, "d": "5 × 10", "r": "60 s", "k": "slam", "m": "push", "c": "Tout le corps. Tu écrases le ballon au sol."},
         {"n": "Cordes ondulatoires", "d": "6 × 20 s", "r": "40 s", "k": "ropes", "m": "push", "c": "À fond pendant 20 s. Pas de cordes : burpees sans saut × 8."},
         {"n": "Poussée de traîneau", "w": 1, "d": "6 × 20 m", "r": "90 s", "k": "sled", "m": "push", "c": "Bas, bras tendus, petits pas. Pas de traîneau : fermier 6 × 30 m."},
         {"n": "Planche", "d": "3 × 45 s", "r": "45 s", "k": "plank", "m": "clean", "c": "Fessiers serrés, bassin droit."},
     ],
     "cardio": {"t": "Retour au calme, tapis", "d": "15 min", "c": "Marche à plat, 5 km/h. Tu laisses redescendre le cœur."}},

    {"id": "J3", "cls": "sB", "color": "#ff5a93", "name": "Force bas", "nick": "Les fondations", "dur": "55 min",
     "tags": ["Lourd", "Jambes et abdos"], "pic": "goblet",
     "warm": "Vélo 5 min, 10 squats à vide, 10 ponts fessiers, une série légère du premier exercice.",
     "ex": [
         {"n": "Goblet squat lourd ou presse", "w": 1, "d": "5 × 6–8", "r": "2 min 30", "k": "goblet", "m": "keep", "c": "L’haltère le plus lourd que tu tiens propre. Presse si le dos tire."},
         {"n": "Soulevé jambes tendues haltères", "w": 1, "d": "4 × 8", "r": "2 min", "k": "rdl", "m": "keep", "c": "Fesses en arrière, dos plat. Jamais à l’échec."},
         {"n": "Fentes marchées haltères", "w": 1, "d": "4 × 10", "x": "par jambe", "r": "90 s", "k": "lunge", "m": "keep", "c": "Grand pas, buste droit, genou arrière frôle le sol."},
         {"n": "Leg curl", "w": 1, "d": "3 × 10–12", "r": "60 s", "k": "legcurl", "m": "max", "c": "Remonte en 3 secondes."},
         {"n": "Mollets debout", "w": 1, "d": "4 × 12–15", "r": "45 s", "k": "calf", "m": "max", "c": "Une seconde de pause en haut."},
         {"n": "Relevés de genoux suspendu", "d": "3 × 10–12", "r": "60 s", "k": "kneeraise", "m": "keep1", "c": "Sans balancer. Trop dur ? Chaise romaine."},
     ],
     "fin": {"n": "Finisher : traîneau lourd", "w": 1, "d": "4 × 20 m", "r": "90 s", "k": "sled", "c": "Plus lourd que le jour du camp. Ou fermier 4 × 30 m."},
     "cardio": {"t": "Tapis incliné, gilet lesté", "d": "20 min", "c": "Pente 10 %, 5 km/h. Jambes cuites : pente 6 %."}},

    {"id": "J4", "cls": "sK", "color": "#2fd6b6", "name": "L’eau", "nick": "Zéro impact", "dur": "40 min",
     "tags": ["Piscine", "Récupération active"], "pic": "swim",
     "warm": "Deux longueurs très tranquilles, n’importe quelle nage.",
     "ex": [
         {"n": "Nage continue", "d": "10 min", "r": "—", "k": "swim", "m": "easy", "c": "Tranquille, tu cherches ton souffle."},
         {"n": "Sprints dans l’eau", "d": "8 × 25 m", "r": "45 s", "k": "swim", "m": "push", "c": "À fond. Les boxeurs font ça pour le cardio sans casser les genoux."},
         {"n": "Nage continue", "d": "10 min", "r": "—", "k": "swim", "m": "easy", "c": "Tu termines relâché."},
         {"n": "Marche", "d": "20 min", "r": "—", "k": "walk", "m": "easy", "c": "Dehors ou sur tapis, pour finir tes pas."},
     ]},

    {"id": "J5", "cls": "sC", "color": "#ff9d33", "name": "Athlète", "nick": "La Totale", "dur": "50 min",
     "tags": ["Explosif", "HIIT"], "pic": "rope",
     "warm": "Corde à sauter 3 × 1 min, puis 10 swings légers.",
     "ex": [
         {"n": "Kettlebell swing lourd", "w": 1, "d": "5 × 10", "r": "75 s", "k": "swing", "m": "keep", "c": "Plus lourd que le jour du camp, moins de répétitions."},
         {"n": "Pompes", "w": 1, "d": "4 × 10–15", "r": "75 s", "k": "pushup", "m": "keep", "c": "Poitrine au sol, gainage total."},
         {"n": "Rowing australien", "d": "4 × 10–12", "r": "75 s", "k": "row", "m": "keep", "c": "Barre plus basse dès que c’est facile."},
         {"n": "Fentes arrière", "w": 1, "d": "3 × 10", "x": "par jambe", "r": "75 s", "k": "lunge", "m": "keep", "c": "Avec haltères si c’est facile."},
         {"n": "Curl, puis triceps poulie", "w": 1, "d": "3 × 12–15", "r": "60 s", "k": "curl", "m": "max", "c": "Les deux à la suite, puis le repos."},
     ],
     "totale": True,
     "cardio": {"t": "Marche en pente", "d": "15 min", "c": "Sur le tapis, juste après les sprints."}},

    {"id": "J6", "cls": "sE", "color": "#46dd88", "name": "La longue", "nick": "Le mental", "dur": "70 min",
     "tags": ["Gilet lesté", "Endurance"], "pic": "vest",
     "warm": "5 min de marche à plat, sans gilet.",
     "ex": [
         {"n": "Marche inclinée, gilet lesté", "d": "45 min", "r": "—", "k": "vest", "m": "steady", "c": "Pente 10 à 12 %, 5 km/h, sans tenir les barres. Tu dois pouvoir parler."},
     ],
     "abs": [("crunch", "Crunch", "15"), ("legraise", "Relevés de jambes", "12"), ("climber", "Mountain climbers", "30 s"), ("plank", "Planche", "45 s")],
     "cardio": None},
]

REST = {"id": "R", "name": "Repos", "c": "10 000 pas, étirements, sommeil. Le muscle se construit ce jour-là."}

VEST = [("S1–S2", "sans gilet", "30 min"), ("S3–S6", "gilet 5 kg", "40 min"), ("Dès S7", "gilet 10 kg", "45 min")]

TOTALE_LEVELS = [("Semaines 1 et 2", "4 tours", "Corde 20 s, abdos 40 s. Sprint = marche 6 km/h, pente 10 %.", "8 min"),
                 ("Semaines 3 à 6", "5 tours", "Corde 30 s, abdos 30 s. Course 8 km/h, pente 6 %.", "10 min"),
                 ("Dès la semaine 7", "6 tours", "Corde 30 s, abdos 30 s. Course 9 à 10 km/h, pente 6 %.", "12 min")]

MARKS = {"keep": ("keep", "garde 2 reps", "battery-medium"), "keep1": ("keep", "garde 1 rep", "battery-medium"),
         "max": ("max", "dernière série à fond", "fire"), "hold": ("max", "tiens au maximum", "fire"),
         "push": ("max", "intense, geste propre", "lightning"), "clean": ("keep", "stop quand le bassin tombe", "battery-medium"),
         "easy": ("keep", "tranquille", "wind"), "steady": ("keep", "tu dois pouvoir parler", "chat-circle-dots")}

RAMADAN_ORDER = ["J1", "J3", "J4", "J6"]
