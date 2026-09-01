-- 產區從查表改為自由文字：beans.region_id (fk) → beans.region (text)，
-- 並刪除 regions 表。
--
-- 判斷依據：封閉集合用查表，開放集合用自由文字。
--   處理法、品種是封閉集合——條目有限、社群有共識，值得結構化，維持查表。
--   產區是開放集合——每個國家幾十個產區，往下還有莊園細分，本質上收不完。
--   加上翻譯歧異（耶加雪菲／耶加雪夫／Yirgacheffe 都會出現在台灣豆袋上，
--   沒有哪個是「對的」），用 aliases 維護會失控。
--
-- V1 的比較功能是同一支豆子的不同沖法，不是跨豆子的產區聚合，
-- 所以不需要結構化。未來若要做聚合，從使用者實際填過的文字正規化更準確。

alter table beans add column region text;

-- 先把既有資料搬過去，不要讓已填的產區在改版時消失
update beans
set region = regions.name
from regions
where beans.region_id = regions.id;

alter table beans drop column region_id;

-- policy 與索引會隨表一起消失
drop table regions;
