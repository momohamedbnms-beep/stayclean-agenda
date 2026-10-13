-- Ma Paperasse — installation côté Supabase (projet de StayClean Agenda).
-- À exécuter UNE fois : Supabase → SQL Editor → coller ce fichier → Run.
-- Sans danger si on le relance (tout est « if not exists » / « or replace »).
--
-- Ce que ça crée (tout est préfixé mp_ / mp-, rien d'existant n'est modifié) :
--   mp_items       dossiers, documents, preuves, réglages, plan des rappels (JSON), un compte = ses lignes
--   mp-files       stockage privé des photos et PDF (dossier = identifiant du compte)
--   mp_push_subs   téléphones abonnés aux rappels
--   mp_push_log    un rappel envoyé par jour au maximum
--   mp_config      clés internes (secret du cron, clés VAPID) — lisible seulement par le serveur
--   tâche cron     toutes les heures, appelle la fonction mp-push (qui décide s'il faut prévenir)
-- Sécurité : RLS partout ; chaque compte ne voit que ses propres lignes et fichiers.

-- 0) Extensions (planificateur + appels HTTP)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 1) Données
create table if not exists public.mp_items (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('dossiers', 'documents', 'proofs', 'settings', 'remind')),
  id         text not null check (char_length(id) between 1 and 80),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 800000),
  deleted    boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);
create index if not exists mp_items_sync on public.mp_items (user_id, updated_at);
create index if not exists mp_items_remind on public.mp_items (kind, id) where kind = 'remind';

create or replace function public.mp_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists mp_items_touch on public.mp_items;
create trigger mp_items_touch before insert or update on public.mp_items
  for each row execute function public.mp_touch();

alter table public.mp_items enable row level security;
drop policy if exists mp_items_own on public.mp_items;
create policy mp_items_own on public.mp_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.mp_items from anon;
grant select, insert, update, delete on public.mp_items to authenticated;

-- 2) Rappels : abonnements et journal d'envoi
create table if not exists public.mp_push_subs (
  endpoint   text primary key check (endpoint like 'https://%'),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fails      int not null default 0
);
create index if not exists mp_push_subs_user on public.mp_push_subs (user_id);
alter table public.mp_push_subs enable row level security;
drop policy if exists mp_push_subs_own on public.mp_push_subs;
create policy mp_push_subs_own on public.mp_push_subs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.mp_push_subs from anon;
grant select, insert, update, delete on public.mp_push_subs to authenticated;

create table if not exists public.mp_push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  sent_at timestamptz not null default now(),
  n       int,
  primary key (user_id, day)
);
alter table public.mp_push_log enable row level security;
drop policy if exists mp_push_log_read on public.mp_push_log;
create policy mp_push_log_read on public.mp_push_log for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.mp_push_log from anon;
grant select on public.mp_push_log to authenticated;

-- 3) Configuration interne (aucun accès depuis l'appli : seulement le serveur)
create table if not exists public.mp_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.mp_config enable row level security;
revoke all on public.mp_config from anon, authenticated;
insert into public.mp_config (key, value)
values ('cron_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- 3 bis) Droits du serveur (fonction mp-push). Supabase ne donne plus ces droits
--        automatiquement aux nouvelles tables : on les accorde explicitement.
grant select, insert, update, delete on public.mp_items, public.mp_push_subs, public.mp_push_log, public.mp_config to service_role;

-- 4) Fichiers : bucket privé, un dossier par compte
insert into storage.buckets (id, name, public, file_size_limit)
values ('mp-files', 'mp-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists mp_files_select on storage.objects;
drop policy if exists mp_files_insert on storage.objects;
drop policy if exists mp_files_update on storage.objects;
drop policy if exists mp_files_delete on storage.objects;
create policy mp_files_select on storage.objects for select to authenticated
  using (bucket_id = 'mp-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy mp_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'mp-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy mp_files_update on storage.objects for update to authenticated
  using (bucket_id = 'mp-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'mp-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy mp_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mp-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 5) Toutes les heures (à :07), le serveur appelle mp-push.
--    L'adresse de la fonction est enregistrée par mp-push elle-même à sa première utilisation :
--    tant qu'elle n'existe pas, la tâche ne fait rien.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ma-paperasse-push') then
    perform cron.unschedule('ma-paperasse-push');
  end if;
  perform cron.schedule('ma-paperasse-push', '7 * * * *', $cmd$
    select net.http_post(
      url := u.value,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-mp-secret', s.value),
      body := '{"action":"cron"}'::jsonb,
      timeout_milliseconds := 60000
    )
    from public.mp_config u, public.mp_config s
    where u.key = 'push_url' and s.key = 'cron_secret'
  $cmd$);
end $$;

-- Vérification rapide (doit renvoyer 1 ligne « ma-paperasse-push ») :
-- select jobname, schedule from cron.job where jobname = 'ma-paperasse-push';
