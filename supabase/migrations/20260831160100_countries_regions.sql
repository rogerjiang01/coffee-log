-- §11 步驟 2：countries → regions
-- countries 為純系統表，無 user_id，全域唯讀（§3.8）。
-- regions 為混合表，結構同查表型，另加 country_id。

create table countries (
  id uuid primary key default gen_random_uuid(),
  iso_code char(2) not null unique,
  name_zh text not null,
  name_en text not null,
  sort_order int default 0
);

create table regions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,  -- NULL = 系統內建
  country_id uuid references countries on delete set null,
  name text not null,
  aliases text[] default '{}',
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create index on regions (user_id);
