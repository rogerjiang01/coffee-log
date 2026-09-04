-- 使用者自建了哪些項目？
--
-- 用途：決定哪些自建名稱該升格成系統條目（見《01-資料庫規格》§3.2 的收錄粒度）。
-- 在 Supabase SQL Editor 直接執行。
--
-- 這幾支查詢跨所有使用者彙總，**必須以 service role 或在 SQL Editor 執行**——
-- 從前端用 anon key 跑會被 RLS 擋成只看得到自己的資料，那樣的計數沒有意義。
-- 也因此它們只放在這裡，不進應用程式。
--
-- 兩張表判斷「自建」的方式不同：
--   user_equipment  沒有對到型錄 → catalog_id is null
--   混合查表        不是系統內建 → user_id is not null


-- ══ 1. 自建器材（沒有對到型錄的）════════════════════════════
-- 依類型與名稱分組。同名但不同類型要分開看：
-- 「V60」可能同時被建成濾杯與濾紙。
select
  type                                             as 類型,
  custom_name                                      as 名稱,
  count(*)                                         as 建立人次,
  count(distinct user_id)                          as 幾個人建過,
  count(*) filter (where note is not null)         as 有寫備註的,
  min(created_at)::date                            as 最早,
  max(created_at)::date                            as 最近
from user_equipment
where catalog_id is null
  and custom_name is not null
  and btrim(custom_name) <> ''
group by type, custom_name
order by count(*) desc, custom_name;


-- ══ 2. 自建處理法 ═══════════════════════════════════════════
select
  name                    as 名稱,
  count(*)                as 建立人次,
  count(distinct user_id) as 幾個人建過,
  min(created_at)::date   as 最早,
  max(created_at)::date   as 最近
from processing_methods
where user_id is not null
group by name
order by count(*) desc, name;


-- ══ 3. 自建品種 ═════════════════════════════════════════════
select
  name                    as 名稱,
  count(*)                as 建立人次,
  count(distinct user_id) as 幾個人建過,
  min(created_at)::date   as 最早,
  max(created_at)::date   as 最近
from varieties
where user_id is not null
group by name
order by count(*) desc, name;


-- ══ 4. 自建風味標籤 ═════════════════════════════════════════
-- 帶上 category：沒有分類的標籤在介面上會落到「我建立的」那一組，
-- 要升格成系統項目時得先決定它屬於哪一類。
select
  name                          as 名稱,
  coalesce(category, '（未分類）') as 分類,
  count(*)                      as 建立人次,
  count(distinct user_id)       as 幾個人建過,
  min(created_at)::date         as 最早,
  max(created_at)::date         as 最近
from flavor_tags
where user_id is not null
group by name, category
order by count(*) desc, name;


-- ══ 5. 自建沖煮手法 ═════════════════════════════════════════
-- step_template 有沒有填是關鍵：有模板的才有升格價值，
-- 只有名字的手法升格上去也帶不出分段。
select
  name                                          as 名稱,
  count(*)                                      as 建立人次,
  count(distinct user_id)                       as 幾個人建過,
  count(*) filter (where step_template is not null) as 有分段模板的,
  min(created_at)::date                         as 最早,
  max(created_at)::date                         as 最近
from brew_methods
where user_id is not null
group by name
order by count(*) desc, name;


-- ══ 6. 一次看完（想快速掃一眼時用）══════════════════════════
select '器材'   as 表, custom_name as 名稱, count(*) as 建立人次
  from user_equipment where catalog_id is null and btrim(coalesce(custom_name,'')) <> '' group by custom_name
union all
select '處理法', name, count(*) from processing_methods where user_id is not null group by name
union all
select '品種',   name, count(*) from varieties          where user_id is not null group by name
union all
select '風味標籤', name, count(*) from flavor_tags      where user_id is not null group by name
union all
select '沖煮手法', name, count(*) from brew_methods     where user_id is not null group by name
order by 建立人次 desc, 表, 名稱;
