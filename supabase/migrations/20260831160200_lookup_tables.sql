-- §11 步驟 3：processing_methods、varieties、flavor_tags、brew_methods
-- 皆為混合表：user_id IS NULL 代表系統內建，所有人可讀；
-- 非 NULL 代表使用者自建，僅本人可讀寫（policy 見 §6.3）。

create table processing_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  aliases text[] default '{}',
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create table varieties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  aliases text[] default '{}',
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create table flavor_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  aliases text[] default '{}',
  category text,                        -- 酸質／甜感／口感／風味／缺陷，用於分組顯示
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create table brew_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  aliases text[] default '{}',          -- 供模糊比對，減少重複建立
  description text,
  default_ratio numeric,                -- 預設粉水比（水/粉）
  step_template jsonb,                  -- 比例制分段模板，見 §3.7
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create index on processing_methods (user_id);
create index on varieties (user_id);
create index on flavor_tags (user_id);
create index on brew_methods (user_id);
