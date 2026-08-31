-- §11 步驟 4：equipment_catalog（系統表，全域唯讀）
-- 這張表存在的唯一目的是讓「刻度」這個數字可以被正確解讀（§3.2）。
--
-- 刻度採四欄制（範圍 × 精度兩個獨立維度），不是「有段／無段」的二分：
--   grind_scale_increment  null = 連續無段；否則為最小刻度間隔
--   grind_scale_max        null = 無上限
--   三個刻度欄位皆 null    完全無刻度標示的機型（如楊家小飛馬 500N）
-- 所有驗證都是前端提示，不阻擋儲存。

create table equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  type equipment_type not null,
  brand text not null,
  model text not null,
  variant text,                          -- 僅在「刻度意義改變」時建立
  grind_scale_min numeric,               -- 僅 grinder
  grind_scale_max numeric,               -- null = 無上限
  grind_scale_increment numeric,         -- null = 連續無段；否則為最小刻度間隔
  grind_scale_suggested_min numeric,     -- 選填，實用範圍下限
  grind_scale_suggested_max numeric,     -- 選填，實用範圍上限
  grind_scale_note text,                 -- 面板結構說明，顯示於輸入欄位旁
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create index on equipment_catalog (type);
