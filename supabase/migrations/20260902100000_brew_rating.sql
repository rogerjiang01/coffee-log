-- 「好喝」拆成兩個獨立欄位。
--
-- 原本 is_favorite 一個 boolean 同時承擔「好喝」與「想再沖」兩種語意。
-- 拆開後：
--   rating       1–5 星，可留空代表未評分
--   is_favorite  收藏／常沖，二元，代表想再沖一次
--
-- 舊資料不做值的轉換：既有的 is_favorite = true 就維持為收藏，
-- rating 留空。把布林值硬轉成某個星數等於替使用者虛構他沒給過的評價。

alter table brews add column rating int;

-- 星等是封閉集合，超出範圍沒有意義。這與 §3.2「刻度驗證只是提示」
-- 是不同性質的東西：那裡擋的是「看起來不太對的值」，這裡擋的是
-- 「在定義上不存在的值」。
alter table brews add constraint rating_range check (rating is null or rating between 1 and 5);
