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
group by 1
order by 1;
