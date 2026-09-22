-- 記錄耗時的盤點：定義變更前後、複製入口改版前後
--
-- 用途：驗證《01》§9 的核心假設（記一筆能不能壓到一兩分鐘），
-- 並看複製入口改版有沒有改變使用方式。在 Supabase SQL Editor 直接執行。
--
-- 跨使用者彙總，**必須在 SQL Editor（或以 service role）執行**——
-- 從前端用 anon key 跑會被 RLS 擋成只看得到自己的資料。
--
-- ── 兩個需要你確認的常數 ────────────────────────────────
--
-- 1. 分界時間：871815b 的 commit 時間 2026-09-17 10:31:46+08。
--    **這是 commit 時間，不是部署時間**——真正的分界是那次改動上線到 Vercel
--    的時間，一定晚於 commit。落在兩者之間的紀錄會被算進「改版後」，
--    但它們其實跑的還是舊程式。知道實際部署時間的話，改下面的 boundary。
--
-- 2. 你的帳號：以 email 判斷。如果 app 裡用的不是這個 email，改 my_email。
--
-- ── 範例資料一律排除 ───────────────────────────────────
--
-- 註冊時自動建立的那一筆沖煮紀錄（《01》§13）不是使用者記的，
-- 它的耗時欄位是空的、也沒有儲存事件，但**筆數會被算進去**——
-- 每個新帳號平白多一筆，複製佔比與「有沒有填品飲」都會被稀釋。
-- 所以每一段都加 `is_sample = false`（經由 brew_id 的那幾段用 exists 過濾）。
--
-- ── 為什麼用 created_at 不用 brewed_at ──────────────────
--
-- 分界問的是「這筆是哪一版程式寫的」，那是寫入時間。
-- brewed_at 是使用者填的沖煮日期，可以回填到任何一天，
-- 用它分界會把上週補記的紀錄算成改版前。


-- ══ 1. form_duration_seconds：定義變更前後 ═══════════════
-- 改版前是「表單開啟到送出」（含閒置），改版後是「累計互動間隔」。
-- 《01》§9 寫明兩者不可混合統計，所以這裡只分開列，不做跨期比較。

with params as (
  select
    timestamptz '2026-09-17 10:31:46+08' as boundary,
    'rogerjiang01@gmail.com'             as my_email
),
rows as (
  select
    b.form_duration_seconds                                as d,
    b.created_at < (select boundary from params)           as before,
    u.email = (select my_email from params)                as mine
  from brews b
  join auth.users u on u.id = b.user_id
  where b.form_duration_seconds is not null
    and b.is_sample = false
)
select
  case when before then '改版前（表單開啟到送出）' else '改版後（累計互動間隔）' end as 期間,
  case when mine   then '我' else '其他使用者' end                                   as 帳號,
  count(*)                                                                           as 筆數,
  min(d)                                                                             as 最小,
  round(avg(d))                                                                      as 平均,
  max(d)                                                                             as 最大
from rows
group by 1, 2
order by 1, 2;


-- ══ 2. 複製入口改版前後：總紀錄數與複製紀錄數 ═════════════
--
-- **複製紀錄數會低估。** copied_from_brew_id 在來源紀錄被刪除時會變成 null
--（on delete set null，《01》§3.5），刪過來源的複製紀錄在這裡看起來像是從零新增的。
-- 沒有別的欄位可以還原那件事——差異區塊也是靠這個欄位算的。
--
-- 分母用全部紀錄（不像第 1 段要求 form_duration_seconds 不為 null）：
-- 問的是使用方式，不是耗時。

with params as (
  select
    timestamptz '2026-09-17 10:31:46+08' as boundary,
    'rogerjiang01@gmail.com'             as my_email
),
rows as (
  select
    b.copied_from_brew_id,
    b.created_at < (select boundary from params) as before,
    u.email = (select my_email from params)      as mine
  from brews b
  join auth.users u on u.id = b.user_id
  where b.is_sample = false
)
select
  case when before then '改版前' else '改版後' end as 期間,
  case when mine   then '我' else '其他使用者' end as 帳號,
  count(*)                                         as 總紀錄數,
  count(copied_from_brew_id)                       as 複製紀錄數,
  round(100.0 * count(copied_from_brew_id) / nullif(count(*), 0), 1) as 複製佔比
from rows
group by 1, 2
order by 1, 2;


-- ══ 3. 參數與品飲各自的耗時（§9.1）═══════════════════════
-- 新欄位，只有 20260921100000 上線之後新增的紀錄才有值。
-- 在那之前執行，結果會是空的——那是對的，既有紀錄刻意不回填。

select
  case when u.email = 'rogerjiang01@gmail.com' then '我' else '其他使用者' end as 帳號,
  count(*)                                       as 筆數,
  round(avg(b.params_duration_seconds))          as 參數平均,
  max(b.params_duration_seconds)                 as 參數最大,
  round(avg(b.tasting_duration_seconds))         as 品飲平均,
  max(b.tasting_duration_seconds)                as 品飲最大,
  round(avg(b.form_duration_seconds))            as 總耗時平均,
  -- 差額＝日期這類不歸任何一段的欄位。負數代表分配有 bug
  round(avg(b.form_duration_seconds - b.params_duration_seconds - b.tasting_duration_seconds)) as 其他平均
from brews b
join auth.users u on u.id = b.user_id
where b.params_duration_seconds is not null
  and b.is_sample = false
group by 1
order by 1;


-- ══ 4.「一次記錄」的耗時（brew_save_events，§9.2）═════════
--
-- 同一筆沖煮紀錄在**建立後 N 分鐘內**的所有儲存，算同一次記錄。
-- N 是查詢的參數不是資料的定義：改 N 不必動資料，也不會讓舊資料斷掉。
--
-- 為什麼要有 N：沖之前先存、沖完回來補填是一次記錄（間隔幾分鐘）；
-- 隔了三天回來改分數是另一件事（維護，不是記錄）。N 就是這條界線。
-- 預設 30 分鐘——一杯手沖連準備帶沖煮不會超過這個數字。
--
-- 落在窗外的儲存整列忽略，不併進任何一次記錄：它們是「維護」，
-- 要看那部分請用第 5 段。

with params as (
  select
    interval '30 minutes'                as window_size,   -- 這裡改 N
    'rogerjiang01@gmail.com'             as my_email
),
first_save as (
  -- 範例紀錄排除：使用者編輯範例並儲存時也會寫下儲存事件（《01》§13）
  select e.brew_id, min(e.saved_at) as started_at
  from brew_save_events e
  join brews b on b.id = e.brew_id and b.is_sample = false
  group by e.brew_id
),
one_record as (
  select
    e.brew_id,
    u.email = (select my_email from params) as mine,
    sum(e.params_seconds)  as params_seconds,
    sum(e.tasting_seconds) as tasting_seconds,
    count(*)               as saves
  from brew_save_events e
  join first_save f on f.brew_id = e.brew_id
  join auth.users u  on u.id = e.user_id
  where e.saved_at <= f.started_at + (select window_size from params)
  group by e.brew_id, u.email
)
select
  case when mine then '我' else '其他使用者' end                         as 帳號,
  count(*)                                                               as 記錄筆數,
  round(avg(saves), 1)                                                   as 平均儲存次數,
  min(params_seconds)                                                    as 參數最短,
  percentile_cont(0.5) within group (order by params_seconds)::int       as 參數中位數,
  round(avg(params_seconds))                                             as 參數平均,
  max(params_seconds)                                                    as 參數最長,
  min(tasting_seconds)                                                   as 品飲最短,
  percentile_cont(0.5) within group (order by tasting_seconds)::int      as 品飲中位數,
  round(avg(tasting_seconds))                                            as 品飲平均,
  max(tasting_seconds)                                                   as 品飲最長
from one_record
group by 1
order by 1;


-- ══ 5. 事後補品飲的比例 ═══════════════════════════════════
--
-- 兩個不同的問題，分成兩段：
--   5a. 每次編輯裡，有多少次真的在填品飲（編輯也可能只是改個刻度）
--   5b. 有多少筆紀錄的品飲是建立之後才第一次填的
--
-- 5b 的判斷是「第一次出現品飲秒數的那一列，是不是建立的那一列」。
-- 用秒數而不是欄位內容：欄位內容只看得到最後的結果，看不出是哪一次填的。

-- 5a. 編輯裡有填品飲的比例
with params as (select 'rogerjiang01@gmail.com' as my_email)
select
  case when u.email = (select my_email from params) then '我' else '其他使用者' end as 帳號,
  count(*)                                                        as 編輯次數,
  count(*) filter (where e.tasting_seconds > 0)                   as 有填品飲的次數,
  round(100.0 * count(*) filter (where e.tasting_seconds > 0)
        / nullif(count(*), 0), 1)                                 as 佔比,
  round(avg(e.tasting_seconds) filter (where e.tasting_seconds > 0)) as 有填時的平均秒數
from brew_save_events e
join auth.users u on u.id = e.user_id
join brews b on b.id = e.brew_id and b.is_sample = false
where e.entry = 'edit'
group by 1
order by 1;

-- 5b. 品飲是建立之後才第一次填的紀錄
with params as (select 'rogerjiang01@gmail.com' as my_email),
tasting as (
  select
    e.brew_id,
    u.email = (select my_email from params)        as mine,
    min(e.saved_at) filter (where e.tasting_seconds > 0) as first_tasting_at,
    min(e.saved_at)                                as created_at
  from brew_save_events e
  join auth.users u on u.id = e.user_id
  join brews b on b.id = e.brew_id and b.is_sample = false
  group by e.brew_id, u.email
)
select
  case when mine then '我' else '其他使用者' end                        as 帳號,
  count(*)                                                              as 有儲存事件的紀錄數,
  count(*) filter (where first_tasting_at is not null)                  as 有填過品飲,
  count(*) filter (where first_tasting_at > created_at)                 as 建立後才第一次填品飲,
  round(100.0 * count(*) filter (where first_tasting_at > created_at)
        / nullif(count(*) filter (where first_tasting_at is not null), 0), 1) as 佔有填過品飲的比例
from tasting
group by 1
order by 1;
