-- varieties 與 regions 的系統內建清單（§10 的 seed 補完）。
--
-- 範圍以「台灣咖啡愛好者實際會在豆袋上看到的」為準，不追求分類學完整性。
-- 下拉選單在手機上塞不下幾百個選項，這與 countries 只收 42 個產國同一個理由。
--
-- 註：Heirloom 是衣索比亞未分類原生種的統稱，不是特定品種。
-- 這段說明目前只能留在這裡——varieties 表依 §3.8 沒有 description 欄位，
-- 要讓它顯示在介面上必須先改 schema，不在本次範圍內自行新增。

insert into varieties (user_id, name, aliases, sort_order) values
  (null, 'Typica 鐵比卡',      array['Typica','鐵比卡','鐵皮卡'], 10),
  (null, 'Bourbon 波旁',       array['Bourbon','波旁','波本'], 11),
  (null, 'Heirloom 原生種',    array['Heirloom','原生種','衣索比亞原生種','Ethiopian Heirloom'], 12),

  (null, 'Gesha 藝伎',         array['Gesha','Geisha','藝伎','藝妓','瑰夏','翡翠莊園'], 20),
  (null, '74110',              array['74110'], 21),
  (null, '74158',              array['74158'], 22),
  (null, 'Kurume',             array['Kurume','庫魯美'], 23),

  (null, 'SL28',               array['SL28','SL-28'], 30),
  (null, 'SL34',               array['SL34','SL-34'], 31),
  (null, 'Ruiru 11',           array['Ruiru','Ruiru 11'], 32),
  (null, 'Batian',             array['Batian','巴蒂安'], 33),

  (null, 'Caturra 卡杜拉',      array['Caturra','卡杜拉','卡度拉'], 40),
  (null, 'Catuai 卡杜艾',       array['Catuai','Catuaí','卡杜艾'], 41),
  (null, 'Mundo Novo',         array['Mundo Novo','新世界'], 42),
  (null, 'Pacamara 帕卡瑪拉',   array['Pacamara','帕卡瑪拉'], 43),
  (null, 'Pacas',              array['Pacas','帕卡斯'], 44),
  (null, 'Villa Sarchi',       array['Villa Sarchi','維拉薩奇'], 45),
  (null, 'Maragogype 象豆',     array['Maragogype','Maragogipe','象豆','馬拉哥吉佩'], 46),

  (null, 'Castillo',           array['Castillo','卡斯提優'], 50),
  (null, 'Colombia',           array['Colombia','哥倫比亞種'], 51),
  (null, 'Catimor 卡帝汶',      array['Catimor','卡帝汶','卡提摩'], 52),
  (null, 'Sarchimor',          array['Sarchimor','莎奇摩'], 53),
  (null, 'Marsellesa',         array['Marsellesa'], 54),

  (null, 'Java',               array['Java','爪哇'], 60),
  (null, 'S795',               array['S795','S-795'], 61),
  (null, 'Sidikalang',         array['Sidikalang','西達卡朗'], 62),

  (null, 'Robusta 羅布斯塔',    array['Robusta','羅布斯塔','羅豆','Canephora'], 70);

-- regions：依 iso_code 對應到已 seed 的產國。
--
-- 台灣的產區標示是「縣市＋鄉鎮」兩層，與進口豆的「國家＋產區」結構不同。
-- 不為此在 schema 加一層，直接把縣市與鄉鎮合併成單一 region 名稱，
-- 並把鄉鎮單獨放進 aliases，因為使用者多半只會打「阿里山」。
-- 莊園名稱不進 regions。

insert into regions (user_id, country_id, name, aliases, sort_order)
select null, c.id, v.name, v.aliases, v.sort_order
from (values
  ('ET', '耶加雪菲',      array['Yirgacheffe','耶加'],                    10),
  ('ET', '西達摩',        array['Sidamo','Sidama'],                       11),
  ('ET', '古吉',          array['Guji'],                                  12),
  ('ET', '哈拉',          array['Harrar','Harar'],                        13),
  ('ET', '林姆',          array['Limu'],                                  14),
  ('ET', '金比',          array['Gimbi','Djimmah'],                       15),

  ('KE', '涅里',          array['Nyeri'],                                 20),
  ('KE', '基里尼亞加',    array['Kirinyaga'],                             21),
  ('KE', '恩布',          array['Embu'],                                  22),
  ('KE', '基安布',        array['Kiambu'],                                23),

  ('PA', '波奎特',        array['Boquete'],                               30),
  ('PA', '沃肯',          array['Volcan','Volcán'],                       31),

  ('CR', '塔拉珠',        array['Tarrazu','Tarrazú'],                     40),
  ('CR', '西部谷地',      array['West Valley'],                           41),
  ('CR', '中央谷地',      array['Central Valley'],                        42),

  ('GT', '安提瓜',        array['Antigua'],                               50),
  ('GT', '薇薇特南果',    array['Huehuetenango','薇薇'],                  51),
  ('GT', '阿蒂特蘭',      array['Atitlan','Atitlán'],                     52),
  ('GT', '法拉罕內斯',    array['Fraijanes'],                             53),

  ('CO', '惠蘭',          array['Huila'],                                 60),
  ('CO', '娜玲瓏',        array['Narino','Nariño'],                       61),
  ('CO', '考卡',          array['Cauca'],                                 62),
  ('CO', '安蒂奧基亞',    array['Antioquia'],                             63),

  ('BR', '喜拉朵',        array['Cerrado'],                               70),
  ('BR', '摩吉安納',      array['Mogiana'],                               71),
  ('BR', '南米納斯',      array['Sul de Minas','South Minas'],            72),

  ('ID', '曼特寧',        array['Mandheling','北蘇門答臘','林東','Lintong','North Sumatra'], 80),
  ('ID', '亞齊',          array['Aceh','Gayo Aceh'],                      81),
  ('ID', '迦佑',          array['Gayo'],                                  82),
  ('ID', '托拉查',        array['Toraja'],                                83),
  ('ID', '爪哇',          array['Java'],                                  84),

  ('YE', '摩卡',          array['Mocha','Mokha'],                         90),
  ('YE', '巴尼馬塔爾',    array['Bani Matar'],                            91),

  ('SV', '阿帕內卡',      array['Apaneca'],                               100),
  ('SV', '聖安娜',        array['Santa Ana'],                             101),

  ('HN', '馬卡拉',        array['Marcala'],                               110),
  ('HN', '聖塔芭芭拉',    array['Santa Barbara','Santa Bárbara'],         111),

  ('PE', '卡哈馬卡',      array['Cajamarca'],                             120),
  ('PE', '普諾',          array['Puno'],                                  121),

  ('TW', '嘉義阿里山',    array['阿里山','Alishan'],                      130),
  ('TW', '嘉義石棹',      array['石棹'],                                  131),
  ('TW', '南投國姓',      array['國姓'],                                  132),
  ('TW', '南投惠蓀林場',  array['惠蓀林場','惠蓀'],                       133),
  ('TW', '雲林古坑',      array['古坑'],                                  134),
  ('TW', '雲林草嶺',      array['草嶺'],                                  135),
  ('TW', '台南東山',      array['東山'],                                  136),
  ('TW', '屏東泰武',      array['泰武'],                                  137),
  ('TW', '屏東三地門',    array['三地門'],                                138),
  ('TW', '高雄六龜',      array['六龜'],                                  139),
  ('TW', '台東太麻里',    array['太麻里'],                                140),
  ('TW', '花蓮瑞穗',      array['瑞穗'],                                  141),

  ('RW', '胡耶',          array['Huye'],                                  150),
  ('BI', '卡揚札',        array['Kayanza'],                               160)
) as v(iso, name, aliases, sort_order)
join countries c on c.iso_code = v.iso;
