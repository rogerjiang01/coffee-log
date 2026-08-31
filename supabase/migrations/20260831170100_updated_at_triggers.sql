-- updated_at 自動更新。
--
-- 規格在 profiles / beans / brews 三張表都定義了 updated_at 且
-- default now()，但沒有定義維護方式。欄位存在卻永遠停在建立時間，
-- 比沒有這個欄位更糟——它看起來可信但其實是錯的。
--
-- 交給資料庫而非應用層，是因為任何一條漏寫的 update 都會讓它失準。

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on beans
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on brews
  for each row execute function public.set_updated_at();
