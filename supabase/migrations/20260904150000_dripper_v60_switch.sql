-- Hario V60 Switch。
--
-- 收錄理由見《01-資料庫規格》§3.2 的收錄粒度：Switch 底部有閥門，
-- 可以浸泡後再濾過，是不同的沖煮方式，不是材質或版本差異——
-- 正是「影響沖煮行為」這一層要收的。
--
-- 尺寸只收 01 與 03：Hario 沒有出 02 的 Switch。
-- sort_order 接在 V60 01/02/03（10–12）之後，讓它排在同一組裡。

insert into equipment_catalog (type, brand, model, sort_order) values
  ('dripper', 'Hario', 'V60 Switch 01', 13),
  ('dripper', 'Hario', 'V60 Switch 03', 14);
