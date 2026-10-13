-- Mes Calories — installation côté Supabase (projet de StayClean Agenda).
-- À exécuter UNE fois : Supabase → SQL Editor → coller ce fichier → Run.
-- Sans danger si on le relance (tout est « if not exists » / « or replace »).
--
-- Ce que ça crée (préfixé cal_, rien d'existant n'est modifié) :
--   cal_items   repas, pesées et réglages (JSON) ; un compte = ses lignes
-- Aucune photo n'est stockée : une photo de plat sert seulement au calcul, dans le navigateur.
-- Sécurité : RLS ; chaque compte ne voit que ses propres lignes.

create table if not exists public.cal_items (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('meals', 'weights', 'settings')),
  id         text not null check (char_length(id) between 1 and 80),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 100000),
  deleted    boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);
create index if not exists cal_items_sync on public.cal_items (user_id, updated_at);

-- updated_at posé par le serveur (synchro incrémentale fiable, même si l'horloge du téléphone est fausse)
create or replace function public.cal_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists cal_items_touch on public.cal_items;
create trigger cal_items_touch before insert or update on public.cal_items
  for each row execute function public.cal_touch();

alter table public.cal_items enable row level security;
drop policy if exists cal_items_own on public.cal_items;
create policy cal_items_own on public.cal_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.cal_items from anon;
grant select, insert, update, delete on public.cal_items to authenticated;
-- Supabase ne donne plus ces droits automatiquement aux nouvelles tables : on les accorde explicitement.
grant select, insert, update, delete on public.cal_items to service_role;

-- Vérification rapide (doit renvoyer : cal_items | true) :
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'cal_items';
