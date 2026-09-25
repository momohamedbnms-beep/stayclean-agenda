-- StayClean — renforcements côté Supabase (à exécuter par Mohamed dans
-- Supabase → SQL Editor). Facultatif : l'app fonctionne sans.
-- Vérifié le 26/09/2026 avec la clé publique : agenda_state, sc_demandes,
-- sc_fenetres, sc_bloques, sc_config ne renvoient AUCUNE ligne, et sc_devis
-- est refusé. Les données clients ne sont donc pas lisibles publiquement.

-- 1) Empêcher définitivement une plage en double (même si deux appareils
--    publient exactement en même temps).
delete from sc_fenetres a using sc_fenetres b
 where a.ctid < b.ctid and a.jour = b.jour and a.debut = b.debut and a.fin = b.fin;
create unique index if not exists sc_fenetres_unique on sc_fenetres (jour, debut, fin);

delete from sc_bloques a using sc_bloques b
 where a.ctid < b.ctid and a.jour = b.jour;
create unique index if not exists sc_bloques_unique on sc_bloques (jour);
