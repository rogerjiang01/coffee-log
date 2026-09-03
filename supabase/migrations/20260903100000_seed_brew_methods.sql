-- 沖煮手法的 seed（§10.5）。五個社群共識明確的手法，user_id = null。
--
-- step_template 的每一段自己宣告水量基準，不由系統統一決定：
--   dose       水量 = 粉重 × factor。悶蒸是物理需求——要讓粉床濕透、
--              排出二氧化碳，需求量由粉重決定，跟總水量無關。
--   total      水量 = 總水量 × factor。
--   remaining  水量 =（總水量 − 前面已分配）× factor。
--
-- 為什麼不能統一：把悶蒸綁比例，20g 粉配 1:12 時悶蒸只有 24ml，
-- 是粉重的 1.2 倍，粉根本濕不透；但把 4:6 的第一注改成綁粉重，
-- 又會破壞「前 40% 分兩注」這個手法的核心機制。兩者本質不同。

insert into brew_methods (user_id, name, aliases, description, default_ratio, step_template, sort_order) values
(
  null,
  '三段式沖法',
  array['三段式', 'Three-Pour', '傳統三段'],
  '最經典的教科書手法，風味結構完整。前段帶出酸甜，後段補足濃度。悶蒸水量為粉重的兩倍，實際需求會因烘焙度與新鮮度而異，淺焙新鮮豆可能需要更多。',
  15,
  '{"steps":[
    {"type":"bloom","basis":"dose","factor":2,"duration":35,"note":"讓粉床完全濕透"},
    {"type":"pour","basis":"remaining","factor":0.6,"duration":45,"note":"主萃取，帶出風味前調"},
    {"type":"pour","basis":"remaining","factor":0.4,"duration":0,"note":"補足後段醇厚度"}
  ]}'::jsonb,
  10
),
(
  null,
  '四六沖法',
  array['4:6', '46法', '四六法', 'Tetsu 4:6', '粕谷哲'],
  '2016 世界沖煮大賽冠軍粕谷哲獨創。前 40% 決定酸甜比，後 60% 決定濃度。每注等水完全流乾再注下一注。此手法刻意採純比例設計，第一注不是傳統意義的悶蒸。',
  15,
  '{"steps":[
    {"type":"bloom","basis":"total","factor":0.1667,"duration":45,"note":"前 40% 第一注。此注水量少，甜感較高"},
    {"type":"pour","basis":"total","factor":0.2333,"duration":45,"note":"前 40% 第二注，完成酸甜比設定"},
    {"type":"pour","basis":"total","factor":0.2,"duration":45,"note":"後 60% 開始，等流乾再注"},
    {"type":"pour","basis":"total","factor":0.2,"duration":45,"note":"等流乾再注"},
    {"type":"pour","basis":"total","factor":0.2,"duration":0,"note":"等流乾再注"}
  ]}'::jsonb,
  20
),
(
  null,
  '五段式沖法',
  array['Rao Spin', '五段式', '5-Pour', 'Scott Rao'],
  'Scott Rao 推廣。悶蒸水量固定為粉重的三倍，其餘等分四注，配合晃動濾杯讓粉床平整、減少通道效應。',
  15,
  '{"steps":[
    {"type":"bloom","basis":"dose","factor":3,"duration":45,"note":"注完抓起濾杯順時針晃動，讓粉水完全融合"},
    {"type":"pour","basis":"remaining","factor":0.25,"duration":40,"note":"等水流下約三分之一再注下一段"},
    {"type":"pour","basis":"remaining","factor":0.25,"duration":40},
    {"type":"pour","basis":"remaining","factor":0.25,"duration":40},
    {"type":"pour","basis":"remaining","factor":0.25,"duration":0,"note":"注完再次輕晃濾杯，讓粉床平整下落"}
  ]}'::jsonb,
  30
),
(
  null,
  '攪拌流五段沖法',
  array['Perger', 'Matt Perger', '攪拌流', '十字攪拌'],
  '世界冠軍 Matt Perger 提出，適合淺烘焙。前段十字攪拌強迫排氣，後段多次小水量，突出花果香與明亮酸質。',
  15,
  '{"steps":[
    {"type":"bloom","basis":"dose","factor":2.5,"duration":30,"note":"注完立即用攪拌棒十字攪拌"},
    {"type":"pour","basis":"remaining","factor":0.2,"duration":40,"note":"大水流破壞粉層"},
    {"type":"pour","basis":"remaining","factor":0.26,"duration":40,"note":"改為輕柔細水流"},
    {"type":"pour","basis":"remaining","factor":0.26,"duration":40},
    {"type":"pour","basis":"remaining","factor":0.28,"duration":0,"note":"注完抓起濾杯輕敲桌面一下"}
  ]}'::jsonb,
  40
),
(
  null,
  '肥尾沖法',
  array['肥尾', '火山沖法', 'Devil Method', '6-Pour', '粕谷哲惡魔'],
  '粕谷哲延伸手法。後段高頻補水不等流乾，適合高硬度豆或想放大甜感與黏稠度。',
  15,
  '{"steps":[
    {"type":"bloom","basis":"dose","factor":2.5,"duration":45},
    {"type":"pour","basis":"remaining","factor":0.2,"duration":45},
    {"type":"pour","basis":"remaining","factor":0.2,"duration":20,"note":"以下四注不等流乾，快速補水"},
    {"type":"pour","basis":"remaining","factor":0.2,"duration":20},
    {"type":"pour","basis":"remaining","factor":0.2,"duration":20},
    {"type":"pour","basis":"remaining","factor":0.2,"duration":0}
  ]}'::jsonb,
  50
);
