-- Mon Coran — installation côté Supabase (projet de StayClean Agenda).
-- À exécuter UNE fois : Supabase → SQL Editor → coller ce fichier → Run.
-- Sans danger si on le relance (tout est « if not exists » / « or replace »).
--
-- Ce que ça crée (préfixé qr_, rien d'existant n'est modifié) :
--   qr_items   la progression personnelle de Mon Coran, en lignes séparées par nature :
--                prefs     préférences de lecture et d'apprentissage
--                pos       dernière position de lecture
--                fav       favoris
--                attempt   tentatives de récitation (une ligne par tentative, jamais modifiée)
--                progress  étapes d'apprentissage et jalons par sourate
--                review    calendrier de révision
--                ar_state  « Lire et écrire l'arabe » : niveau, unité en cours, notions vues, niveaux réussis et confirmés
--                          (la séance en cours reste sur le téléphone)
--                ar_att    « Lire et écrire l'arabe » : réponses aux exercices (journal des erreurs)
--                ar_exam   « Lire et écrire l'arabe » : examens blancs et de niveau
-- Les textes du Coran ne sont PAS ici : ils sont servis en fichiers statiques (coran/data/).
-- Les enregistrements de voix, l'écriture à l'écran et les photos de feuilles ne quittent jamais le téléphone.
-- Sécurité : RLS ; chaque compte ne voit que ses propres lignes.

create table if not exists public.qr_items (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null,
  id         text not null check (char_length(id) between 1 and 80),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 60000),
  deleted    boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);
create index if not exists qr_items_sync on public.qr_items (user_id, updated_at);
-- natures acceptées (contrainte remplacée à chaque exécution : une installation plus ancienne est mise à jour)
alter table public.qr_items drop constraint if exists qr_items_kind_check;
alter table public.qr_items add constraint qr_items_kind_check
  check (kind in ('prefs', 'pos', 'fav', 'attempt', 'progress', 'review', 'ar_state', 'ar_att', 'ar_exam'));

-- updated_at posé par le serveur (synchro incrémentale fiable, même si l'horloge du téléphone est fausse)
create or replace function public.qr_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists qr_items_touch on public.qr_items;
create trigger qr_items_touch before insert or update on public.qr_items
  for each row execute function public.qr_touch();

alter table public.qr_items enable row level security;
drop policy if exists qr_items_own on public.qr_items;
create policy qr_items_own on public.qr_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.qr_items from anon;
grant select, insert, update, delete on public.qr_items to authenticated;
-- Supabase ne donne plus ces droits automatiquement aux nouvelles tables : on les accorde explicitement.
grant select, insert, update, delete on public.qr_items to service_role;

-- Vérification rapide (doit renvoyer : qr_items | true) :
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'qr_items';
