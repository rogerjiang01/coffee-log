-- §11 步驟 10：所有 RLS policy（§6）
--
-- 本專案的 Supabase 已開啟 automatic RLS event trigger，新表會自動啟用 RLS，
-- 但此處仍明確寫出每一張表的 enable 與 policy，不依賴 trigger。
--
-- 三類寫法：
--   6.1 純使用者表      auth.uid() = user_id
--   6.2 brews           select 需考慮 visibility
--   6.3 混合表          讀得到系統項目＋自己的；寫入只能寫自己的
--   6.4 純系統表        只給 select

-- ============================================================
-- 6.1 純使用者資料表
-- ============================================================

-- profiles：主鍵就是 auth.users.id，因此比對的是 id 而非 user_id
alter table profiles enable row level security;

create policy "使用者讀取自己的個人資料"
  on profiles for select using (auth.uid() = id);
create policy "使用者新增自己的個人資料"
  on profiles for insert with check (auth.uid() = id);
create policy "使用者修改自己的個人資料"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "使用者刪除自己的個人資料"
  on profiles for delete using (auth.uid() = id);

alter table user_equipment enable row level security;

create policy "使用者讀取自己的器材"
  on user_equipment for select using (auth.uid() = user_id);
create policy "使用者新增自己的器材"
  on user_equipment for insert with check (auth.uid() = user_id);
create policy "使用者修改自己的器材"
  on user_equipment for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "使用者刪除自己的器材"
  on user_equipment for delete using (auth.uid() = user_id);

alter table beans enable row level security;

create policy "使用者讀取自己的豆子"
  on beans for select using (auth.uid() = user_id);
create policy "使用者新增自己的豆子"
  on beans for insert with check (auth.uid() = user_id);
create policy "使用者修改自己的豆子"
  on beans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "使用者刪除自己的豆子"
  on beans for delete using (auth.uid() = user_id);

alter table brew_steps enable row level security;

create policy "使用者讀取自己的分段"
  on brew_steps for select using (auth.uid() = user_id);
create policy "使用者新增自己的分段"
  on brew_steps for insert with check (auth.uid() = user_id);
create policy "使用者修改自己的分段"
  on brew_steps for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "使用者刪除自己的分段"
  on brew_steps for delete using (auth.uid() = user_id);

alter table brew_flavor_tags enable row level security;

create policy "使用者讀取自己的風味標記"
  on brew_flavor_tags for select using (auth.uid() = user_id);
create policy "使用者新增自己的風味標記"
  on brew_flavor_tags for insert with check (auth.uid() = user_id);
create policy "使用者修改自己的風味標記"
  on brew_flavor_tags for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "使用者刪除自己的風味標記"
  on brew_flavor_tags for delete using (auth.uid() = user_id);

-- ============================================================
-- 6.2 brews：select 現在就寫成考慮 visibility 的形式
-- 第一版所有紀錄都是 private，未來開放分享時不必改核心權限邏輯。
-- ============================================================

alter table brews enable row level security;

create policy "讀取自己的或公開的沖煮紀錄"
  on brews for select using (auth.uid() = user_id or visibility = 'public');
create policy "只能新增自己的沖煮紀錄"
  on brews for insert with check (auth.uid() = user_id);
create policy "只能修改自己的沖煮紀錄"
  on brews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "只能刪除自己的沖煮紀錄"
  on brews for delete using (auth.uid() = user_id);

-- ============================================================
-- 6.3 混合表（最容易寫錯）
--
-- insert / update / delete 的 `user_id is not null` 不可省略。
-- 少了它使用者可以建立 user_id = NULL 的項目，等同偽造系統項目
-- 讓所有使用者都看得到。這是本專案最可能出現的權限漏洞。
-- ============================================================

alter table processing_methods enable row level security;

create policy "讀取系統處理法與自己建立的"
  on processing_methods for select
  using (user_id is null or auth.uid() = user_id);
create policy "只能新增自己的處理法"
  on processing_methods for insert
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能修改自己建立的處理法"
  on processing_methods for update
  using (auth.uid() = user_id and user_id is not null)
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能刪除自己建立的處理法"
  on processing_methods for delete
  using (auth.uid() = user_id and user_id is not null);

alter table varieties enable row level security;

create policy "讀取系統品種與自己建立的"
  on varieties for select
  using (user_id is null or auth.uid() = user_id);
create policy "只能新增自己的品種"
  on varieties for insert
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能修改自己建立的品種"
  on varieties for update
  using (auth.uid() = user_id and user_id is not null)
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能刪除自己建立的品種"
  on varieties for delete
  using (auth.uid() = user_id and user_id is not null);

alter table regions enable row level security;

create policy "讀取系統產區與自己建立的"
  on regions for select
  using (user_id is null or auth.uid() = user_id);
create policy "只能新增自己的產區"
  on regions for insert
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能修改自己建立的產區"
  on regions for update
  using (auth.uid() = user_id and user_id is not null)
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能刪除自己建立的產區"
  on regions for delete
  using (auth.uid() = user_id and user_id is not null);

alter table flavor_tags enable row level security;

create policy "讀取系統風味標籤與自己建立的"
  on flavor_tags for select
  using (user_id is null or auth.uid() = user_id);
create policy "只能新增自己的風味標籤"
  on flavor_tags for insert
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能修改自己建立的風味標籤"
  on flavor_tags for update
  using (auth.uid() = user_id and user_id is not null)
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能刪除自己建立的風味標籤"
  on flavor_tags for delete
  using (auth.uid() = user_id and user_id is not null);

alter table brew_methods enable row level security;

create policy "讀取系統手法與自己建立的"
  on brew_methods for select
  using (user_id is null or auth.uid() = user_id);
create policy "只能新增自己的手法"
  on brew_methods for insert
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能修改自己建立的手法"
  on brew_methods for update
  using (auth.uid() = user_id and user_id is not null)
  with check (auth.uid() = user_id and user_id is not null);
create policy "只能刪除自己建立的手法"
  on brew_methods for delete
  using (auth.uid() = user_id and user_id is not null);

-- ============================================================
-- 6.4 純系統表
--
-- 依 §6.4，刻意「不建立 insert / update / delete policy」。
-- RLS 已啟用且無寫入 policy，因此一般使用者的寫入一律被拒。
-- 型錄維護透過 Supabase 後台或 service role 進行。
-- ============================================================

alter table equipment_catalog enable row level security;

create policy "所有登入使用者可讀取器材型錄"
  on equipment_catalog for select to authenticated using (true);

alter table countries enable row level security;

create policy "所有登入使用者可讀取產國"
  on countries for select to authenticated using (true);
