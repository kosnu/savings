drop function if exists public.update_category_with_budget(bigint, text, bigint, integer);
drop function if exists public.create_category_with_budget(text, date, integer);

alter table categories
  alter column book_id set default get_authenticated_default_book_id();

drop table if exists public.category_budgets cascade;

drop function if exists public.update_category_budget_updated_at();
drop function if exists public.ensure_category_budget_category_book();
drop function if exists public.ensure_category_budget_category_membership();
drop function if exists public.keep_category_budget_book_id();
drop function if exists public.set_category_budget_ownership();
drop function if exists public.set_category_budget_user_id();
