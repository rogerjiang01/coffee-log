-- 手法模板的停水秒數依台灣主流教學交叉比對調整。只改 duration，
-- 水量（basis、factor）、段數、段落備註一律不動。
--
-- **這些數值仍是依網路資料交叉比對的估算，尚未經實機沖煮核實。**
-- 比 20260914110000「舊定義一律減 15 秒」的推算有依據，但同樣屬於
-- CLAUDE.md 階段備註裡「手法模板數值待核實」那一批，核實後再以新的 migration 覆寫。
--
-- 只寫 duration、不整份覆寫 step_template：整份覆寫等於把水量又寫一次，
-- 這支 migration 沒有要動水量，不該有機會改到它。
--
-- 覆寫前先比對現值。遠端的值與預期不同（例如有人在 dashboard 手動改過），
-- 整支 migration 中止，不在不知道現況的情況下蓋掉。
--
--   手法              目前                  改為
--   三段式沖法        30 / 30               30 / 35
--   四六沖法          40 / 30 / 30 / 30     38 / 33 / 33 / 33
--   五段式沖法        40 / 25 / 25 / 25     33 / 20 / 20 / 20
--   攪拌流五段沖法    25 / 25 / 25 / 25     25 / 20 / 20 / 20
--   肥尾沖法          40 / 30 / 5 / 5 / 5   35 / 25 / 5 / 5 / 5
--
-- 最後一段維持 null（沒有下一注）。

do $$
declare
  plan record;
  current_durations jsonb;
begin
  for plan in
    select * from (values
      ('三段式沖法',     '[30, 30, null]'::jsonb,             '[30, 35, null]'::jsonb),
      ('四六沖法',       '[40, 30, 30, 30, null]'::jsonb,     '[38, 33, 33, 33, null]'::jsonb),
      ('五段式沖法',     '[40, 25, 25, 25, null]'::jsonb,     '[33, 20, 20, 20, null]'::jsonb),
      ('攪拌流五段沖法', '[25, 25, 25, 25, null]'::jsonb,     '[25, 20, 20, 20, null]'::jsonb),
      ('肥尾沖法',       '[40, 30, 5, 5, 5, null]'::jsonb,    '[35, 25, 5, 5, 5, null]'::jsonb)
    ) as t(method_name, expected, updated)
  loop
    select jsonb_agg(e.step -> 'duration' order by e.position)
      into current_durations
      from brew_methods m,
           jsonb_array_elements(m.step_template -> 'steps') with ordinality as e(step, position)
     where m.user_id is null and m.name = plan.method_name;

    if current_durations is distinct from plan.expected then
      raise exception '%：目前的 duration 是 %，預期 %。現況與預期不同，停止覆寫',
        plan.method_name, current_durations, plan.expected;
    end if;

    update brew_methods m
       set step_template = jsonb_set(
         m.step_template,
         '{steps}',
         (select jsonb_agg(jsonb_set(e.step, '{duration}', plan.updated -> (e.position::int - 1))
                           order by e.position)
            from jsonb_array_elements(m.step_template -> 'steps') with ordinality as e(step, position))
       )
     where m.user_id is null and m.name = plan.method_name;
  end loop;
end $$;

-- 五段式與攪拌流是台灣常見的變體，不是提倡者本人的原版。
-- 在說明裡用一句話講清楚來源，其餘描述手法本身的內容保留。
update brew_methods
   set description = '台灣社群的五段變體，融合 Scott Rao 的搖晃濾杯技術；Rao 本人提倡的是單次或兩段注水。悶蒸水量固定為粉重的三倍，其餘等分四注，配合晃動濾杯讓粉床平整、減少通道效應。'
 where user_id is null and name = '五段式沖法';

update brew_methods
   set description = '台灣常見的五段結構，源自 Matt Perger 的攪拌手法；他在 WBC 使用的是三段。適合淺烘焙。前段十字攪拌強迫排氣，後段多次小水量，突出花果香與明亮酸質。'
 where user_id is null and name = '攪拌流五段沖法';
