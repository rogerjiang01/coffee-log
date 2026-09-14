-- 手法模板的 duration 改成純停水秒數（配合 20260914100000）。
--
-- 舊語意是「段落總歷時」（含注水），新語意是「注完到下一注之間的純停水」。
-- 換算方式：一律減 15 秒，悶蒸段只減 5 秒。悶蒸的注水量小（粉重的 2 到 3 倍），
-- 注水時間短，所以含不含注水的差距在悶蒸這段最小。
-- 最後一段原本是 0（沒有下一注），改成 null。
--
-- **這些數值是從舊定義估算而來的，尚未經實機沖煮核實**，與磨豆機刻度規格
-- 同屬「待核實」那一批（見 CLAUDE.md 階段備註）。核實後再以新的 migration 覆寫。
--
-- 純停水不受粉重影響：停 30 秒對 15g 與 25g 都是 30 秒，物理意義不變，
-- 所以這些數值可移植，不需要跟著粉重換算。

update brew_methods set step_template = '{"steps":[
  {"type":"bloom","basis":"dose","factor":2,"duration":30,"note":"讓粉床完全濕透"},
  {"type":"pour","basis":"remaining","factor":0.6,"duration":30,"note":"主萃取，帶出風味前調"},
  {"type":"pour","basis":"remaining","factor":0.4,"duration":null,"note":"補足後段醇厚度"}
]}'::jsonb
where user_id is null and name = '三段式沖法';

update brew_methods set step_template = '{"steps":[
  {"type":"bloom","basis":"total","factor":0.1667,"duration":40,"note":"前 40% 第一注。此注水量少，甜感較高"},
  {"type":"pour","basis":"total","factor":0.2333,"duration":30,"note":"前 40% 第二注，完成酸甜比設定"},
  {"type":"pour","basis":"total","factor":0.2,"duration":30,"note":"後 60% 開始，等流乾再注"},
  {"type":"pour","basis":"total","factor":0.2,"duration":30,"note":"等流乾再注"},
  {"type":"pour","basis":"total","factor":0.2,"duration":null,"note":"等流乾再注"}
]}'::jsonb
where user_id is null and name = '四六沖法';

update brew_methods set step_template = '{"steps":[
  {"type":"bloom","basis":"dose","factor":3,"duration":40,"note":"注完抓起濾杯順時針晃動，讓粉水完全融合"},
  {"type":"pour","basis":"remaining","factor":0.25,"duration":25,"note":"等水流下約三分之一再注下一段"},
  {"type":"pour","basis":"remaining","factor":0.25,"duration":25},
  {"type":"pour","basis":"remaining","factor":0.25,"duration":25},
  {"type":"pour","basis":"remaining","factor":0.25,"duration":null,"note":"注完再次輕晃濾杯，讓粉床平整下落"}
]}'::jsonb
where user_id is null and name = '五段式沖法';

update brew_methods set step_template = '{"steps":[
  {"type":"bloom","basis":"dose","factor":2.5,"duration":25,"note":"注完立即用攪拌棒十字攪拌"},
  {"type":"pour","basis":"remaining","factor":0.2,"duration":25,"note":"大水流破壞粉層"},
  {"type":"pour","basis":"remaining","factor":0.26,"duration":25,"note":"改為輕柔細水流"},
  {"type":"pour","basis":"remaining","factor":0.26,"duration":25},
  {"type":"pour","basis":"remaining","factor":0.28,"duration":null,"note":"注完抓起濾杯輕敲桌面一下"}
]}'::jsonb
where user_id is null and name = '攪拌流五段沖法';

-- 肥尾的後四注「不等流乾、快速補水」，舊值 20 秒減 15 之後是 5 秒。
-- 沒有任何段落變成 0 或負數，但 5 秒是這批裡最短的，核實時優先看這幾段。
update brew_methods set step_template = '{"steps":[
  {"type":"bloom","basis":"dose","factor":2.5,"duration":40},
  {"type":"pour","basis":"remaining","factor":0.2,"duration":30},
  {"type":"pour","basis":"remaining","factor":0.2,"duration":5,"note":"以下四注不等流乾，快速補水"},
  {"type":"pour","basis":"remaining","factor":0.2,"duration":5},
  {"type":"pour","basis":"remaining","factor":0.2,"duration":5},
  {"type":"pour","basis":"remaining","factor":0.2,"duration":null}
]}'::jsonb
where user_id is null and name = '肥尾沖法';
