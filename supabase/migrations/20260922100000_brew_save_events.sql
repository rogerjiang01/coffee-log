-- 每次儲存都記一筆耗時（《01》§9.2）。
--
-- 為什麼需要這張表：brews 上的三個耗時欄位只在建立時寫入，編輯時計時器照樣
-- 在跑但數值沒有存下來。兩種真實的使用方式因此被截斷——
--   1. 每填一點就按儲存的人，只有第一次儲存前的時間被記到
--   2. 沖之前先存、沖完回來補填的人，補填的那段完全沒被記到
-- 兩種截斷都讓耗時偏短，剛好讓「參數記錄一兩分鐘內完成」看起來達成了。
-- 量測誤差偏向我們希望看到的結論，那比沒有量測更糟。
--
-- **原始資料全部記下來，「怎樣算一次記錄」留到查詢時再定義。**
-- 分段時間那次的教訓：定義寫死在儲存端，之後改定義就要搬資料，舊資料也會斷。
-- 這裡只記「第幾次儲存、從哪個入口、花了多少秒」，
-- 「同一筆紀錄在 N 分鐘內的儲存算同一次記錄」是查詢的事（supabase/queries）。
--
-- entry 用 text + check 不用 enum：入口的分法會跟著介面改（現在四種是沿用
-- 暫存 key 的分法），改 check constraint 是一行 alter，enum 加值則動不了舊值。
--
-- 三個秒數 not null：這張表沒有任何欄位由使用者填寫，計時器一定給得出數字。
-- 不違反「必填只有三個」——那條管的是使用者必須填寫的內容。
--
-- 既有紀錄不回填。改版前的資料只存在 brews 的三個欄位，
-- 用估算值造出看起來像量測結果的假資料，比缺一段更難處理。
--
-- 可逆性：整支只有 create table / create index / create policy / grant，
-- 沒有 drop、沒有 update、沒有 delete，不動任何既有資料。

create table brew_save_events (
  id uuid primary key default gen_random_uuid(),
  brew_id uuid not null references brews on delete cascade,
  user_id uuid not null references auth.users on delete cascade,

  -- 入口，沿用暫存 key 的分法（utils/draft.ts 的 brewSaveEntry）
  entry text not null check (entry in ('blank', 'bean', 'copy', 'edit')),

  -- 秒數的算法與 brews.form_duration_seconds 完全相同：同一個計時器、
  -- 同一個 60 秒門檻、同一套 data-section 歸屬。只是每次儲存都寫一列。
  params_seconds int not null,
  tasting_seconds int not null,
  total_seconds int not null,

  saved_at timestamptz not null default now()
);

-- 查詢一律以 brew_id 聚合（同一筆紀錄的多次儲存），外鍵本身不建索引
create index brew_save_events_brew_id_idx on brew_save_events (brew_id);
-- 依使用者與時間分組的盤點查詢
create index brew_save_events_user_saved_idx on brew_save_events (user_id, saved_at);

comment on table brew_save_events is
  '產品指標（§9.2）：每次儲存沖煮紀錄寫一列。使用者不可見，介面不讀取';
comment on column brew_save_events.entry is
  '入口：blank（空白新增）／bean（指定豆子）／copy（複製）／edit（編輯既有紀錄）';

-- ── RLS：只能新增自己紀錄的列，讀不到、改不了、刪不掉 ──────────
--
-- 沒有 select / update / delete policy 是刻意的：這張表是單向的量測紀錄，
-- 介面不讀它，盤點在 SQL Editor 做。少一個 policy 就少一個寫錯的機會。
-- 刪除由 brew_id 的 on delete cascade 處理，不需要 delete policy。
--
-- with check 的第二個條件擋的是「替別人的紀錄記一列」：
-- 只比對 user_id 的話，A 可以帶著自己的 user_id 對 B 的 brew_id 寫入，
-- 汙染的是 B 那筆紀錄的統計。子查詢會經過 brews 自己的 RLS，
-- 所以 A 看不到的紀錄在這裡也對不上。

alter table brew_save_events enable row level security;

create policy "只能新增自己沖煮紀錄的儲存事件"
  on brew_save_events for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from brews where brews.id = brew_id and brews.user_id = auth.uid())
  );

-- ── table privilege ────────────────────────────────────────────
--
-- 存取要通過兩層：先是 table privilege，再才是 RLS policy
--（20260831170000_grants.sql 的註解）。那支 migration 的
-- alter default privileges 會讓這張新表自動拿到 grant all，
-- 所以這裡先收回再只給 insert——RLS 已經擋住讀寫，但權限層一致比較好查問題：
-- 「這張表本來就只能 insert」比「policy 剛好沒寫」清楚。
--
-- 不給 select 的副作用：新增時不可以 returning，
-- 用戶端呼叫 insert 之後不得接 .select()，接了會 permission denied。

revoke all on table brew_save_events from anon, authenticated;
grant insert on table brew_save_events to authenticated;
