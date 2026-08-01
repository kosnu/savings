alter table public.users
  add column language text;

alter table public.users
  add constraint users_language_check
  check (language in ('en', 'ja'));

revoke update on table public.users from authenticated;
revoke update (auth_user_id, created_at, email, id, legacy_external_id, name, updated_at, language)
  on table public.users from authenticated;
grant update (name, language) on table public.users to authenticated;

drop trigger if exists trg_update_user_updated_at on public.users;
create trigger trg_update_user_updated_at
  before update of name, language on public.users
  for each row
  execute function public.update_user_updated_at();
