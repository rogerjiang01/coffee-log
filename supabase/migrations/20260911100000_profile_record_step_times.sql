-- 使用者偏好：記錄分段時間（《01》§3.1、《02》§5 區塊三）。
--
-- 分段時間是進階參數，預設不顯示。空欄位會讓沒有記錄習慣的使用者產生
-- 義務感，填出憑回想的數字，而那會污染比較資料；真正會刻意調整停水時間
-- 的人則需要它。所以由使用者明確宣告要不要用。
--
-- 為什麼放 profiles 而不是 localStorage：
--   這是「使用者宣告自己記不記錄時間」，屬於人，不屬於裝置。
--   localStorage 在 iOS 上 Safari 與加到主畫面的 app 是兩份各自的儲存，
--   Safari 七天沒互動還可能被系統清掉。會打開這個開關的正是最在意時間的
--   進階使用者——設定悄悄變回關閉，他的時間欄位就不見了，而他不一定察覺。
--   代價只有這一支 migration 與表單多一次查詢（有快取）。
--
-- NOT NULL DEFAULT false：這是偏好，沒有「還沒決定」這個第三態；
-- 既有的 profile 一律取得 false，也就是預設關閉。
-- 不違反「必填只有三個」：那條管的是使用者必須填寫的內容，這裡沒有人需要填。
--
-- RLS 與授權都不必另外處理：profiles 既有的 policy 限定只能讀寫自己那一列，
-- grants migration 是整張表授予，新欄位自動涵蓋。

alter table profiles
  add column record_step_times boolean not null default false;

comment on column profiles.record_step_times is
  '沖煮表單是否顯示分段的停留秒數欄位。只影響表單顯示，不影響已記錄的時間';
