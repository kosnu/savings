alter table public.users
  add column language text check (language in ('en', 'ja'));

revoke update on table public.users from authenticated;
grant update (name, language) on table public.users to authenticated;

drop trigger if exists trg_update_user_updated_at on public.users;
create trigger trg_update_user_updated_at
  before update of name, language on public.users
  for each row
  execute function public.update_user_updated_at();

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
  );
