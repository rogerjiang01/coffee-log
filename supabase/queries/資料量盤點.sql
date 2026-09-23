-- 資料量盤點：只增不減的三張表各佔多少，以及整個資料庫的用量。
--
-- 為什麼是這三張：它們是事件與傳送紀錄，每用一次就多幾列，沒有任何介面會刪它們——
--   brew_shares        每按一次「分享」或「複製連結」就多一列（傳送模型，《01》§14）
--   brew_share_events  每次建立一列、每次有人開連結一列
--   brew_save_events   每次儲存沖煮紀錄一列（《01》§9.2）
-- 只有刪除那筆沖煮紀錄時才會跟著 cascade 掉。
--
-- 這一版不做清理機制，先看量。拿來判斷的對照：Supabase 免費方案的資料庫上限是 500 MB。
--
-- 在 Supabase SQL Editor 直接執行。只讀，不動任何資料。
-- 列數用 count(*) 算精確值（這三張表還小）；空間含 TOAST 與索引。

select 'brew_shares' as 項目,
       (select count(*) from public.brew_shares) as 列數,
       pg_size_pretty(pg_total_relation_size('public.brew_shares')) as 總空間,
       pg_size_pretty(pg_relation_size('public.brew_shares')) as 資料,
       pg_size_pretty(pg_indexes_size('public.brew_shares')) as 索引

union all
select 'brew_share_events',
       (select count(*) from public.brew_share_events),
       pg_size_pretty(pg_total_relation_size('public.brew_share_events')),
       pg_size_pretty(pg_relation_size('public.brew_share_events')),
       pg_size_pretty(pg_indexes_size('public.brew_share_events'))

union all
select 'brew_save_events',
       (select count(*) from public.brew_save_events),
       pg_size_pretty(pg_total_relation_size('public.brew_save_events')),
       pg_size_pretty(pg_relation_size('public.brew_save_events')),
       pg_size_pretty(pg_indexes_size('public.brew_save_events'))

union all
select '（整個資料庫）',
       null,
       pg_size_pretty(pg_database_size(current_database())),
       null,
       null;
