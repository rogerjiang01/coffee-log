-- §11 步驟 9：brew_steps、brew_flavor_tags
--
-- brew_steps 的三個關鍵設計（§3.6），實作時不得更動：
--   一、儲存累積值不是增量值。cumulative_water 直接存磅秤上的數字。
--   二、悶蒸沒有獨立欄位，就是 step_index = 1 且 step_type = 'bloom' 的那一筆。
--   三、介面輸入「停留秒數」，資料庫只認「累積時間點」time_offset，換算在前端完成。

create table brew_steps (
  id uuid primary key default gen_random_uuid(),
  brew_id uuid not null references brews on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  step_index int not null,              -- 從 1 開始
  time_offset int not null,             -- 累積秒數，從沖煮開始起算
  cumulative_water numeric not null,    -- 累積水量 g（磅秤上的數字）
  step_type step_type not null default 'pour',
  temp_override int,                    -- V2 介面才露出；空值沿用 brews.water_temp
  pour_pattern pour_pattern,            -- V2 介面才露出
  note text,                            -- V2 介面才露出
  unique (brew_id, step_index)
);

create index on brew_steps (brew_id, step_index);

-- 風味標籤的多對多（§5）
create table brew_flavor_tags (
  brew_id uuid not null references brews on delete cascade,
  flavor_tag_id uuid not null references flavor_tags on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (brew_id, flavor_tag_id)
);
