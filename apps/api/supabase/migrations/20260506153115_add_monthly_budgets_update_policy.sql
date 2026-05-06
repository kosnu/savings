create policy "Users can update own monthly budgets"
  on monthly_budgets for update
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text))
  with check (user_id in (select id from users where external_id = auth.uid()::text));

create or replace function update_monthly_budget_updated_at()
returns trigger as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_update_monthly_budget_updated_at
  before update on monthly_budgets
  for each row
  execute function update_monthly_budget_updated_at();
