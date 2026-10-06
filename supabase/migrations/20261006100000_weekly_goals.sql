-- 每週記錄目標（《01》§15、《02》§4）。
--
-- **存修改歷程，不存目前的值。** 每次設定或修改都新增一列，既有的列不改、不刪。
-- 目前的目標＝最新的一列；某一週的目標＝那一週結束前最後一次修改的值。
-- 只存目前的值的話，過去每一週當時的目標就永遠找不回來——
-- 第二批要算「每週都達標」的連續週數，需要的正是那些值。
--
-- 週的邊界不在資料庫算：時間一律存 UTC，時區轉換在前端（《01》§0 第 7 條），
-- 週一開始，用瀏覽器的本地時間（utils/weeklyGoal.ts）。
--
-- cups not null：一列目標沒有杯數就沒有意義，而且這一列只會從目標設定頁與
-- 修改目標的對話框寫入，兩處都有預設值、使用者不會面對一個空欄位。
-- 不違反「必填只有三個」——那條管的是使用者記錄豆子與沖煮時必須填寫的內容。
--
-- 可逆性：整支只有 create table / create index / create policy / revoke / grant，
-- 沒有 drop、沒有 update、沒有 delete，不動任何既有資料。

create table weekly_goals (
  id uuid primary key default gen_random_uuid(),
  -- 帳號刪除時一併刪除
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cups smallint not null check (cups between 1 and 21),
  created_at timestamptz not null default now()
);

-- 「最新的一列」與「某一週結束前的最後一列」都是依使用者、依時間找
create index weekly_goals_user_created_idx on weekly_goals (user_id, created_at);

comment on table weekly_goals is
  '每週記錄目標的修改歷程：每次設定或修改新增一列，不修改、不刪除。目前的目標是最新的一列';
comment on column weekly_goals.cups is '每週記錄幾杯，1–21';

-- ── RLS：只能讀、只能新增自己的列 ─────────────────────────────
--
-- 沒有 update / delete policy 是刻意的：這是歷程，改掉舊的一列等於改寫過去某一週的目標。
--
-- 新增時 created_at 必須是資料庫的現在時間：用戶端不帶這一欄時預設值就是 now()，
-- 同一個交易裡相等；帶了別的時間（把目標改在過去）會被擋下來。
-- 「某一週的目標」完全由 created_at 決定，能自己指定的話，歷程就不可信了。

alter table weekly_goals enable row level security;

create policy "只能讀自己的每週目標"
  on weekly_goals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "只能新增自己的每週目標，時間由資料庫決定"
  on weekly_goals for insert
  to authenticated
  with check (auth.uid() = user_id and created_at = now());

-- ── table privilege（CLAUDE.md 的建表規則）────────────────────────
--
-- 新表預設沒有任何權限（20261001100000_table_default_privileges.sql），
-- 仍然先 revoke all 再逐一給：authenticated 只有 select 與 insert，
-- anon 沒有任何權限，service_role 沒有伺服器端程式要用，也不給。

revoke all on table weekly_goals from anon, authenticated, service_role;
grant select, insert on table weekly_goals to authenticated;
