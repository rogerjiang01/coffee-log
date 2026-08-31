-- §11 步驟 1：建立所有 enum 型別
-- 依《01-資料庫規格》§0.6，enum 僅用於第 3 節明確寫死的欄位，其餘一律查表＋外鍵。

create type equipment_type as enum ('grinder', 'dripper', 'filter', 'kettle', 'server');
create type roast_level   as enum ('light', 'medium_light', 'medium', 'medium_dark', 'dark');
create type visibility    as enum ('private', 'public');
create type step_type     as enum ('bloom', 'pour', 'stir', 'wait');
create type pour_pattern  as enum ('center', 'circle', 'spiral');
