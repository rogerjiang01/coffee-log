-- 記錄耗時拆成參數與品飲兩段（《01》§9、《02》§5）。
--
-- form_duration_seconds 混在一起，分不出「參數記錄一兩分鐘內完成」有沒有達成：
-- 品飲那段本來就慢——強度要想、風味詞要挑、心得要寫——那不是效率問題，
-- 卻會把總耗時整個拉高。要判斷目標達成與否，得把兩段分開看。
--
-- 三個欄位的關係：params + tasting <= form_duration_seconds。
-- 差額是日期這類不歸任何一段的欄位（豆袋照片的裁切也算在差額裡，
-- 它可能花很久，算進參數會讓數字失真）。
--
-- form_duration_seconds 的算法一個字都沒有改：兩個新欄位是同一批互動間隔的
-- 再分配，不是另一套量法。改了的話新舊資料會再斷一次，
-- 而 2026-09-17 之前的資料已經因為定義變更不能與之後的混合統計了。
--
-- 既有紀錄不回填，維持 NULL——那些紀錄沒有留下任何可以還原區段的痕跡，
-- 用估算值回填會產生看起來像量測結果的假資料。
-- NULL 的意思是「這筆沒有分段資料」，不是 0。
--
-- 可逆：純新增欄位，沒有 drop、沒有覆寫既有資料。
-- RLS 與授權不必另外處理：brews 既有的 policy 限定只能讀寫自己的列，
-- grants migration 是整張表授予，新欄位自動涵蓋。

alter table brews
  add column params_duration_seconds int,
  add column tasting_duration_seconds int;

comment on column brews.params_duration_seconds is
  '產品指標（§9）：這一筆花在參數欄位上的互動秒數，使用者不可見。只在新增時寫入，既有紀錄為 NULL';

comment on column brews.tasting_duration_seconds is
  '產品指標（§9）：這一筆花在品飲欄位上的互動秒數，使用者不可見。只在新增時寫入，既有紀錄為 NULL';
