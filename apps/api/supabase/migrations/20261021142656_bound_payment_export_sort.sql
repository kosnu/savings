create or replace function public.export_payments(
  p_book_id bigint,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  exclusive_end date;
  result jsonb;
begin
  if p_book_id is null or p_start_date is null or p_end_date is null
      or not isfinite(p_start_date) or not isfinite(p_end_date)
      or p_start_date > p_end_date then
    raise exception 'Invalid payment export period' using errcode = '22023';
  end if;

  -- 2月29日開始は翌年3月1日未満とし、両端を含めた最大1年を検証する。
  exclusive_end := case
    when extract(month from p_start_date) = 2 and extract(day from p_start_date) = 29
      then make_date(extract(year from p_start_date)::int + 1, 3, 1)
    else make_date(extract(year from p_start_date)::int + 1,
      extract(month from p_start_date)::int, extract(day from p_start_date)::int)
  end;
  if p_end_date >= exclusive_end then
    raise exception 'Shorten payment export period to at most one year' using errcode = '22023';
  end if;

  -- 件数判定とデータを同一SELECTのsnapshotで読み、上限超過時は一部も返さない。
  with candidates as materialized (
    select p.id, p.book_id, p.date, p.amount, p.note, p.category_id
    from public.payments p
    where p.book_id = p_book_id
      and p.date >= p_start_date and p.date <= p_end_date
    -- 上限判定前は整列せず、後段のソート対象を候補上限以内に抑える。
    limit 10001
  )
  select jsonb_build_object(
    'count', count(*),
    'payments', case when count(*) > 10000 then '[]'::jsonb
      else coalesce(jsonb_agg(
        to_jsonb(p) || jsonb_build_object('category',
          case when c.id is null then null else
            jsonb_build_object('id', c.id, 'book_id', c.book_id, 'name', c.name) end)
        order by p.date, p.id), '[]'::jsonb) end
  ) into result
  from candidates p
  left join public.categories c on c.id = p.category_id and c.book_id = p.book_id;

  return result;
end;
$$;

revoke all on function public.export_payments(bigint, date, date) from public, anon;
grant execute on function public.export_payments(bigint, date, date) to authenticated, service_role;
