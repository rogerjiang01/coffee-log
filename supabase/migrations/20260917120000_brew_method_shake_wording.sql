-- 「晃動」統一成「搖晃」（《04-詞彙表》）。
--
-- 五段式 Rao Spin 的說明同時出現「搖晃濾杯技術」與「配合晃動濾杯」，
-- 悶蒸那一段的備註也寫「晃動」。同一個動作兩種說法，只留一個。
--
-- 只改內建手法的模板與說明。**不改使用者既有紀錄的 brew_steps.note**——
-- 那些備註是當初帶入後存下來的紀錄，使用者可能改寫過，不是模板。
--
-- 比照 20260917100000：寫入前先比對現值，與預期不同就整支中止。

do $$
declare
  found_count int;
  old_note constant text := '注完抓起濾杯順時針晃動，讓粉水完全融合';
  old_description constant text := '台灣社群的五段變體，融合 Scott Rao 的搖晃濾杯技術；Rao 本人提倡的是單次或兩段注水。悶蒸水量固定為粉重的三倍，其餘等分四注，配合晃動濾杯讓粉床平整、減少通道效應。';
begin
  select count(*) into found_count
    from brew_methods
   where user_id is null
     and name = '五段式 Rao Spin'
     and description = old_description
     and step_template #>> '{steps,0,note}' = old_note;
  if found_count <> 1 then
    raise exception '五段式 Rao Spin 的說明或悶蒸備註與預期不同（符合 % 筆），中止', found_count;
  end if;

  update brew_methods
     set description = replace(description, '晃動', '搖晃'),
         step_template = jsonb_set(step_template, '{steps,0,note}',
                                   to_jsonb(replace(old_note, '晃動', '搖晃')))
   where user_id is null and name = '五段式 Rao Spin';

  -- 其他內建手法不該再有「晃動」；有的話代表這支 migration 沒涵蓋到，中止
  select count(*) into found_count
    from brew_methods
   where user_id is null
     and (description like '%晃動%' or step_template::text like '%晃動%');
  if found_count <> 0 then
    raise exception '還有 % 筆內建手法寫著「晃動」，中止', found_count;
  end if;
end $$;
