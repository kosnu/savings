-- RLSが保護しない一括削除権限を、通常の利用者ロールから除外する。
revoke truncate on table
  public.users,
  public.books,
  public.book_members,
  public.categories,
  public.payments,
  public.monthly_budgets,
  public.category_budgets,
  public.category_pins
from public, anon, authenticated;

-- 本人境界を維持し、JWTのユーザーIDをstatementごとに評価する。
alter policy "Users can read own row" on public.users
  using (auth_user_id = (select auth.uid()));

alter policy "Users can update own profile" on public.users
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- Bookを先頭に持つ既存indexではcategory単独の外部キー検索をカバーしない。
create index idx_category_budgets_category_id
  on public.category_budgets (category_id);
