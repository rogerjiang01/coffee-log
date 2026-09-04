-- 補上台灣的兩組濾杯。
--
-- 收錄粒度依《01-資料庫規格》§3.2：只收到「影響沖煮行為」的層級。
-- 星芒的三個代目肋骨結構不同，是三筆；川流的 01/02 是尺寸差異，是兩筆。
-- 材質、顏色、聯名版本一律不收，寫在 user_equipment.note。
--
-- sort_order 接在既有濾杯（10–100）之後。

insert into equipment_catalog (type, brand, model, sort_order) values
  ('dripper', '星芒濾杯', '1 代目',              110),
  ('dripper', '星芒濾杯', '2 代目「極」Kiwami',   111),
  ('dripper', '星芒濾杯', '3 代目「隼」Hayabusa', 112),
  ('dripper', '川流濾杯', '01',                  120),
  ('dripper', '川流濾杯', '02',                  121);
