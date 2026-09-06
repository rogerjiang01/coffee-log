-- 產國加上洲別分組，並依台灣市場的常見度重排。
--
-- 為什麼需要：42 筆平鋪的清單要使用者自己找。分成三洲之後，
-- 他先確定「這支豆子是非洲的」再在十來筆裡挑，比在 42 筆裡掃快得多。
--
-- 排序不用字母序也不用 ISO 碼序，用**常見度**：衣索比亞、肯亞這種
-- 每週都會遇到的排最前面，喀麥隆、辛巴威這種幾年遇到一次的排後面。
-- 字母序對使用者沒有意義——他不是在查字典，是在找他手上那包豆子。
--
-- sort_order 沿用既有欄位，不新增排序欄位。三洲各佔一個號段
--（非洲 10–、美洲 100–、亞洲 200–），任何地方平鋪列出時順序也合理。

create type continent as enum ('africa', 'americas', 'asia');

alter table countries add column continent continent;

-- ══ 非洲 ══════════════════════════════════════════════════
--
-- **葉門放非洲組是刻意的，請不要「修正」成亞洲。**
-- 它地理上屬西亞，但咖啡產區的慣例是與非洲東岸一起討論——
-- 摩卡港是衣索比亞豆輸出的歷史門戶，兩地的品種與風味論述長期綁在一起。
-- 使用者找葉門豆時的心智位置在非洲那一區，不在亞洲。
update countries set continent = 'africa', sort_order = 10  where iso_code = 'ET'; -- 衣索比亞
update countries set continent = 'africa', sort_order = 11  where iso_code = 'KE'; -- 肯亞
update countries set continent = 'africa', sort_order = 12  where iso_code = 'RW'; -- 盧安達
update countries set continent = 'africa', sort_order = 13  where iso_code = 'BI'; -- 蒲隆地
update countries set continent = 'africa', sort_order = 14  where iso_code = 'TZ'; -- 坦尚尼亞
update countries set continent = 'africa', sort_order = 15  where iso_code = 'UG'; -- 烏干達
update countries set continent = 'africa', sort_order = 16  where iso_code = 'CD'; -- 剛果民主共和國
update countries set continent = 'africa', sort_order = 17  where iso_code = 'MW'; -- 馬拉威
update countries set continent = 'africa', sort_order = 18  where iso_code = 'ZM'; -- 尚比亞
update countries set continent = 'africa', sort_order = 19  where iso_code = 'YE'; -- 葉門（見上方說明）
-- 以下三國不在指定的常見度清單內，接在該組後面，維持既有相對順序
update countries set continent = 'africa', sort_order = 20  where iso_code = 'CM'; -- 喀麥隆
update countries set continent = 'africa', sort_order = 21  where iso_code = 'CI'; -- 象牙海岸
update countries set continent = 'africa', sort_order = 22  where iso_code = 'ZW'; -- 辛巴威

-- ══ 美洲 ══════════════════════════════════════════════════
update countries set continent = 'americas', sort_order = 100 where iso_code = 'PA'; -- 巴拿馬
update countries set continent = 'americas', sort_order = 101 where iso_code = 'CO'; -- 哥倫比亞
update countries set continent = 'americas', sort_order = 102 where iso_code = 'GT'; -- 瓜地馬拉
update countries set continent = 'americas', sort_order = 103 where iso_code = 'CR'; -- 哥斯大黎加
update countries set continent = 'americas', sort_order = 104 where iso_code = 'BR'; -- 巴西
update countries set continent = 'americas', sort_order = 105 where iso_code = 'SV'; -- 薩爾瓦多
update countries set continent = 'americas', sort_order = 106 where iso_code = 'HN'; -- 宏都拉斯
update countries set continent = 'americas', sort_order = 107 where iso_code = 'PE'; -- 秘魯
update countries set continent = 'americas', sort_order = 108 where iso_code = 'NI'; -- 尼加拉瓜
update countries set continent = 'americas', sort_order = 109 where iso_code = 'MX'; -- 墨西哥
update countries set continent = 'americas', sort_order = 110 where iso_code = 'BO'; -- 玻利維亞
update countries set continent = 'americas', sort_order = 111 where iso_code = 'EC'; -- 厄瓜多
update countries set continent = 'americas', sort_order = 112 where iso_code = 'JM'; -- 牙買加
update countries set continent = 'americas', sort_order = 113 where iso_code = 'DO'; -- 多明尼加
-- 不在指定清單內，接在後面
update countries set continent = 'americas', sort_order = 114 where iso_code = 'CU'; -- 古巴
update countries set continent = 'americas', sort_order = 115 where iso_code = 'HT'; -- 海地
update countries set continent = 'americas', sort_order = 116 where iso_code = 'VE'; -- 委內瑞拉

-- ══ 亞洲 ══════════════════════════════════════════════════
--
-- 巴布亞紐幾內亞地理上屬大洋洲，併入亞洲組：42 國裡只有它一個，
-- 為單一項目開一個洲別分組，瀏覽成本高於它換來的準確度。
update countries set continent = 'asia', sort_order = 200 where iso_code = 'TW'; -- 臺灣
update countries set continent = 'asia', sort_order = 201 where iso_code = 'ID'; -- 印尼
update countries set continent = 'asia', sort_order = 202 where iso_code = 'VN'; -- 越南
update countries set continent = 'asia', sort_order = 203 where iso_code = 'IN'; -- 印度
update countries set continent = 'asia', sort_order = 204 where iso_code = 'TH'; -- 泰國
update countries set continent = 'asia', sort_order = 205 where iso_code = 'LA'; -- 寮國
update countries set continent = 'asia', sort_order = 206 where iso_code = 'PG'; -- 巴布亞紐幾內亞（見上方說明）
update countries set continent = 'asia', sort_order = 207 where iso_code = 'PH'; -- 菲律賓
update countries set continent = 'asia', sort_order = 208 where iso_code = 'CN'; -- 中國
update countries set continent = 'asia', sort_order = 209 where iso_code = 'TL'; -- 東帝汶
-- 不在指定清單內，接在後面
update countries set continent = 'asia', sort_order = 210 where iso_code = 'MM'; -- 緬甸
update countries set continent = 'asia', sort_order = 211 where iso_code = 'NP'; -- 尼泊爾

-- 全部歸完類才加約束。之後新增產國時忘記填洲別會直接失敗，
-- 而不是默默從分組清單裡消失。
alter table countries alter column continent set not null;

create index on countries (continent, sort_order);
