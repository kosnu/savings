do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.category_budgets'::regclass
      and tgname = 'trg_10_set_category_budget_ownership'
  ) then
    create trigger trg_10_set_category_budget_ownership
      before insert on public.category_budgets
      for each row
      execute function public.set_category_budget_ownership();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.category_budgets'::regclass
      and tgname = 'trg_10_keep_category_budget_book_id'
  ) then
    create trigger trg_10_keep_category_budget_book_id
      before update on public.category_budgets
      for each row
      execute function public.keep_category_budget_book_id();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.category_budgets'::regclass
      and tgname = 'trg_20_ensure_category_budget_category_book'
  ) then
    create trigger trg_20_ensure_category_budget_category_book
      before insert or update of book_id, category_id on public.category_budgets
      for each row
      execute function public.ensure_category_budget_category_book();
  end if;

  drop trigger if exists trg_set_category_budget_ownership on public.category_budgets;
  drop trigger if exists trg_keep_category_budget_book_id on public.category_budgets;
  drop trigger if exists trg_ensure_category_budget_category_book on public.category_budgets;

  if not exists (
    select 1
    from pg_trigger ownership_trigger
    join pg_trigger validation_trigger
      on validation_trigger.tgrelid = ownership_trigger.tgrelid
    where ownership_trigger.tgrelid = 'public.category_budgets'::regclass
      and ownership_trigger.tgname = 'trg_10_set_category_budget_ownership'
      and validation_trigger.tgname = 'trg_20_ensure_category_budget_category_book'
      and ownership_trigger.tgname < validation_trigger.tgname
  ) then
    raise exception 'category_budgets insert ownership trigger must run before category book validation.';
  end if;

  if not exists (
    select 1
    from pg_trigger keep_trigger
    join pg_trigger validation_trigger
      on validation_trigger.tgrelid = keep_trigger.tgrelid
    where keep_trigger.tgrelid = 'public.category_budgets'::regclass
      and keep_trigger.tgname = 'trg_10_keep_category_budget_book_id'
      and validation_trigger.tgname = 'trg_20_ensure_category_budget_category_book'
      and keep_trigger.tgname < validation_trigger.tgname
  ) then
    raise exception 'category_budgets update book ownership trigger must run before category book validation.';
  end if;
end $$;
