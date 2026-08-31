-- §11 步驟 5：profiles ＋ 註冊 trigger
-- 第一版不需要頭像、簡介等欄位（§3.1）。

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 註冊時自動建立對應的 profile。
-- security definer 才能寫入受 RLS 保護的 public.profiles；
-- search_path 設為空字串避免 search_path 注入，因此表名全部寫成合格名稱。
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
