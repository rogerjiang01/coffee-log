-- §11 步驟 7：beans（§3.4）
-- 除了 name 之外全部允許為空，這是首次使用流程能否成立的關鍵。
-- 不得對其他欄位加上 not null。

create table beans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,                          -- 唯一必填欄位
  photo_path text,                             -- Supabase Storage 路徑，列表首圖
  roaster text,
  roast_date date,
  roast_level roast_level,
  country_id uuid references countries on delete set null,
  region_id uuid references regions on delete set null,
  processing_method_id uuid references processing_methods on delete set null,
  variety_id uuid references varieties on delete set null,
  official_notes text,                         -- 袋上印的風味描述
  is_finished boolean not null default false,  -- 已喝完
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on beans (user_id, is_finished, created_at desc);
