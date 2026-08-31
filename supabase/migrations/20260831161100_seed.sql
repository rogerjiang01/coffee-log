-- §11 步驟 12：Seed 資料（§10）
--
-- 系統內建資料以 user_id = NULL 寫入（混合表），所有使用者皆可讀、不可改。
-- 本檔只寫入規格中已明確列出且經核實的內容。
--
-- 刻意不 seed：
--   brew_methods  — 表已建立，step_template 數值待專案負責人提供（§10.5）
--   varieties     — 規格未提供清單，不由實作者推測填入（§10 前言）
--   regions       — 同上

-- ============================================================
-- countries（§3.8：ISO 3166-1）
-- 範圍取咖啡產國。ISO 代碼為事實資料，但「收哪些國家」是實作判斷，
-- 需要增刪請直接告知。
-- ============================================================

insert into countries (iso_code, name_zh, name_en, sort_order) values
  ('ET', '衣索比亞', 'Ethiopia', 10),
  ('KE', '肯亞', 'Kenya', 11),
  ('TZ', '坦尚尼亞', 'Tanzania', 12),
  ('RW', '盧安達', 'Rwanda', 13),
  ('BI', '蒲隆地', 'Burundi', 14),
  ('UG', '烏干達', 'Uganda', 15),
  ('CD', '剛果民主共和國', 'DR Congo', 16),
  ('MW', '馬拉威', 'Malawi', 17),
  ('ZM', '尚比亞', 'Zambia', 18),
  ('CM', '喀麥隆', 'Cameroon', 19),
  ('CI', '象牙海岸', 'Cote d''Ivoire', 20),
  ('ZW', '辛巴威', 'Zimbabwe', 21),
  ('GT', '瓜地馬拉', 'Guatemala', 30),
  ('CR', '哥斯大黎加', 'Costa Rica', 31),
  ('HN', '宏都拉斯', 'Honduras', 32),
  ('SV', '薩爾瓦多', 'El Salvador', 33),
  ('NI', '尼加拉瓜', 'Nicaragua', 34),
  ('PA', '巴拿馬', 'Panama', 35),
  ('MX', '墨西哥', 'Mexico', 36),
  ('JM', '牙買加', 'Jamaica', 37),
  ('DO', '多明尼加', 'Dominican Republic', 38),
  ('CU', '古巴', 'Cuba', 39),
  ('HT', '海地', 'Haiti', 40),
  ('CO', '哥倫比亞', 'Colombia', 50),
  ('BR', '巴西', 'Brazil', 51),
  ('PE', '秘魯', 'Peru', 52),
  ('EC', '厄瓜多', 'Ecuador', 53),
  ('BO', '玻利維亞', 'Bolivia', 54),
  ('VE', '委內瑞拉', 'Venezuela', 55),
  ('ID', '印尼', 'Indonesia', 70),
  ('VN', '越南', 'Vietnam', 71),
  ('IN', '印度', 'India', 72),
  ('PG', '巴布亞紐幾內亞', 'Papua New Guinea', 73),
  ('TH', '泰國', 'Thailand', 74),
  ('CN', '中國', 'China', 75),
  ('PH', '菲律賓', 'Philippines', 76),
  ('LA', '寮國', 'Laos', 77),
  ('MM', '緬甸', 'Myanmar', 78),
  ('TL', '東帝汶', 'Timor-Leste', 79),
  ('YE', '葉門', 'Yemen', 80),
  ('NP', '尼泊爾', 'Nepal', 81),
  ('TW', '臺灣', 'Taiwan', 82)
on conflict (iso_code) do nothing;

-- ============================================================
-- processing_methods（§10.4）
-- 清單與順序完全依規格。「特殊處理法」是刻意保留的 catch-all，排最後。
-- aliases 填入常見英文對照，服務 §10 的模糊比對機制。
-- ============================================================

insert into processing_methods (user_id, name, aliases, sort_order) values
  (null, '水洗',     array['Washed', 'Wet Process', '水洗處理'], 10),
  (null, '日曬',     array['Natural', 'Dry Process', '日曬處理'], 20),
  (null, '蜜處理',   array['Honey', 'Honey Process', 'Miel'], 30),
  (null, '紅蜜',     array['Red Honey'], 31),
  (null, '黃蜜',     array['Yellow Honey'], 32),
  (null, '黑蜜',     array['Black Honey'], 33),
  (null, '白蜜',     array['White Honey'], 34),
  (null, '厭氧日曬', array['Anaerobic Natural', '厭氧日曬處理'], 40),
  (null, '厭氧水洗', array['Anaerobic Washed'], 41),
  (null, '酒桶發酵', array['Barrel Aged', 'Barrel Fermented', '桶內發酵'], 50),
  (null, '濕刨法',   array['Wet Hulled', 'Giling Basah'], 60),
  (null, '特殊處理法', array['Experimental', 'Other'], 999);

-- ============================================================
-- flavor_tags（§10.6 建議分組）
-- 規格註明「實際條目由專案負責人確認」，此處先依建議清單寫入。
-- 目的不只是輸入輔助，更是給新手的詞彙教學。
-- ============================================================

insert into flavor_tags (user_id, name, category, sort_order) values
  (null, '柑橘',         '酸質', 10),
  (null, '莓果',         '酸質', 11),
  (null, '青蘋果',       '酸質', 12),
  (null, '發酵酸',       '酸質', 13),
  (null, '檸檬',         '酸質', 14),
  (null, '蜂蜜',         '甜感', 20),
  (null, '蔗糖',         '甜感', 21),
  (null, '焦糖',         '甜感', 22),
  (null, '紅棗',         '甜感', 23),
  (null, '透明的甜',     '甜感', 24),
  (null, '薄',           '口感', 30),
  (null, '圓潤',         '口感', 31),
  (null, '豆漿般的黏稠', '口感', 32),
  (null, '絲滑',         '口感', 33),
  (null, '粗糙',         '口感', 34),
  (null, '堅果',         '風味', 40),
  (null, '可可',         '風味', 41),
  (null, '花香',         '風味', 42),
  (null, '茶感',         '風味', 43),
  (null, '香草',         '風味', 44),
  (null, '木質',         '風味', 45),
  (null, '澀',           '缺陷', 50),
  (null, '雜味',         '缺陷', 51),
  (null, '過萃的苦',     '缺陷', 52),
  (null, '水感',         '缺陷', 53);

-- ============================================================
-- equipment_catalog：磨豆機（§10.1，已核實，直接照表寫入）
--
-- 四欄制：increment 為 null 代表連續無段（不檢查倍數，範圍檢查照常）；
-- max 為 null 代表無上限；三者皆 null 代表面板完全無刻度標示。
-- ============================================================

insert into equipment_catalog
  (type, brand, model, variant,
   grind_scale_min, grind_scale_max, grind_scale_increment,
   grind_scale_suggested_min, grind_scale_suggested_max,
   grind_scale_note, sort_order) values
  ('grinder', 'Comandante', 'C40',       null, 0,    40,   1,    null, null, '一圈 40 格', 10),
  ('grinder', '1Zpresso',   'JX',        null, 0,    120,  1,    null, null, null, 20),
  ('grinder', '1Zpresso',   'JX-Pro',    null, 0,    200,  1,    null, null, null, 21),
  ('grinder', '1Zpresso',   'J-Max',     null, 0,    450,  1,    null, null, null, 22),
  ('grinder', '1Zpresso',   'K-Ultra',   null, 0,    150,  1,    null, null, null, 23),
  ('grinder', '1Zpresso',   'K-Plus',    null, 0,    220,  1,    null, null, null, 24),
  ('grinder', '1Zpresso',   'Q2',        null, 0,    90,   1,    null, null, null, 25),
  ('grinder', 'Timemore',   'C2',        null, 0,    36,   1,    6,    30,   null, 30),
  ('grinder', 'Timemore',   'C3',        null, 0,    30,   1,    8,    30,   null, 31),
  ('grinder', 'Timemore',   '栗子X',      null, 0,    120,  1,    null, null, null, 32),
  ('grinder', 'Kinu',       'M47',       null, 0,    200,  null, null, null,
     '無段微調；面板 0–9 大字，一圈 50 小格，約可轉 4 圈', 40),
  ('grinder', 'Fellow',     'Ode',       'Gen 1', 1, 11,   null, null, null,
     '每格可再微調 3 段，共 31 段', 50),
  ('grinder', 'Fellow',     'Ode',       'Gen 2', 1, 11,   null, null, null,
     '每格可再微調 3 段，共 31 段', 51),
  ('grinder', 'Baratza',    'Encore',    null, 1,    40,   1,    null, null, null, 60),
  ('grinder', 'Baratza',    'Virtuoso+', null, 1,    40,   1,    null, null, null, 61),
  ('grinder', 'Wilfa',      'Uniform',   null, 1,    41,   1,    null, null, null, 70),
  ('grinder', 'Niche',      'Zero',      null, 0,    null, null, null, null,
     '無段；超過 50 可繼續旋轉至更粗', 80),
  ('grinder', 'Mahlkönig',  'EK43',      null, 1,    16,   0.1,  null, null,
     '無段微調，可對齊至 0.1', 90),
  ('grinder', 'Mahlkönig',  'X54',       null, 1,    35,   null, null, null,
     '面板數字僅供視覺參考', 91),
  ('grinder', '小富士',      'R440',      null, 1,    10,   0.5,  null, null,
     '有半格定位，共 19 檔', 100),
  ('grinder', '楊家', '小飛馬 600N', null, 1, 8,    0.5,  null, null,
     '標準平刀；有物理定位點，可對齊半格', 110),
  ('grinder', '楊家', '小飛馬 610N', null, 1, 8,    0.5,  null, null,
     '鬼齒刀盤；有物理定位點，可對齊半格。粉末立體、細粉少', 111),
  ('grinder', '楊家', '小飛馬 601N', null, 1, 10,   null, null, null,
     '高硬度合金平鋸刀；無段微調，面板數字僅供對位參考', 112),
  ('grinder', '楊家', '小飛馬 690N', null, 1, 10,   null, null, null,
     '螺旋平刀；無段微調，面板數字僅供參考', 113),
  ('grinder', '楊家', '小飛馬 500N', null, null, null, null, null, null,
     '家用加強義式；轉盤面板無刻度標示，建議自行標記參考點後記錄', 114);

-- ============================================================
-- equipment_catalog：濾杯（§10.2）
-- 濾杯不需要刻度欄位，型錄對它僅有省去打字的作用。
-- 規格給的是扁平清單，brand / model 的拆分為實作判斷。
-- ============================================================

insert into equipment_catalog (type, brand, model, sort_order) values
  ('dripper', 'Hario',      'V60 01',        10),
  ('dripper', 'Hario',      'V60 02',        11),
  ('dripper', 'Hario',      'V60 03',        12),
  ('dripper', 'Kalita',     'Wave 155',      20),
  ('dripper', 'Kalita',     'Wave 185',      21),
  ('dripper', 'Origami',    '錐形',           30),
  ('dripper', 'Origami',    '蛋糕',           31),
  ('dripper', 'Chemex',     'Chemex',        40),
  ('dripper', 'Kono',       '名門',           50),
  ('dripper', 'Mr. Clever', '聰明濾杯',        60),
  ('dripper', 'CAFEC',      'Flower Dripper', 70),
  ('dripper', 'Timemore',   '冰瞳 B75',       80),
  ('dripper', 'Orea',       'V3',            90),
  ('dripper', 'Melitta',    'Melitta',       100);

-- ============================================================
-- equipment_catalog：手沖壺（§10.3）
-- ============================================================

insert into equipment_catalog (type, brand, model, sort_order) values
  ('kettle', 'Hario',    'Buono',     10),
  ('kettle', 'Fellow',   'Stagg EKG', 20),
  ('kettle', 'Brewista', '溫控壺',     30),
  ('kettle', 'Timemore', 'Fish 系列',  40),
  ('kettle', 'Kalita',   '鶴嘴',       50),
  ('kettle', 'Takahiro', 'Takahiro',  60),
  ('kettle', 'Bonavita', 'Bonavita',  70);
