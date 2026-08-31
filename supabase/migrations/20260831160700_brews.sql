-- §11 步驟 8：brews（核心主體，§3.5）
-- 唯一的主體是 brews。豆子與手法都是它的維度屬性。
--
-- visibility 第一版固定 private，介面不得提供切換。欄位存在的目的是
-- 讓未來開放分享時不必修改核心權限邏輯，policy 現在就寫成考慮它的形式。
--
-- 品飲欄位直接放在本表，不另建 tasting 表（§3.9）。
-- 衍生值一律即時計算，不建欄位（§8）。

create table brews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  bean_id uuid not null references beans on delete cascade,
  brew_method_id uuid references brew_methods on delete set null,  -- 選填

  -- 參數
  dose numeric not null,                    -- 粉重 g（第二個必填欄位）
  water_temp int,                           -- 主水溫 °C
  grinder_id uuid references user_equipment on delete set null,
  grind_setting numeric,
  dripper_id uuid references user_equipment on delete set null,
  kettle_id uuid references user_equipment on delete set null,
  filter_id uuid references user_equipment on delete set null,     -- L2/V2
  server_id uuid references user_equipment on delete set null,     -- L2/V2
  total_time int,                           -- 總沖煮時間（秒），下壺滴完為準

  -- 進階（V2 才在介面露出，結構先建立）
  water_type text,
  water_tds numeric,
  room_temp int,
  humidity int,
  beverage_weight numeric,
  beverage_tds numeric,

  -- 品飲
  is_favorite boolean not null default false,
  tasting_notes text,
  intensity jsonb,                          -- { acidity, sweetness, body, bitterness } 各 1–5，皆可省略
  brew_photo_path text,                     -- L2/V2

  -- 系統
  brewed_at timestamptz not null default now(),
  copied_from_brew_id uuid references brews on delete set null,  -- 自動 diff 的唯一資料來源
  visibility visibility not null default 'private',
  form_duration_seconds int,                -- 產品指標（§9），使用者不可見
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on brews (user_id, brewed_at desc);
create index on brews (bean_id, brewed_at desc);
create index on brews (user_id, is_favorite) where is_favorite = true;
