-- 內建手法改名，四六法第一注改成 pour。
--
-- 一、名稱去掉「沖法」。手法名稱會直接顯示在選單裡，而「沖法」這個詞
--     其他地方都沒用；選單的脈絡已經說明那是手法，不需要每個名稱都重複。
--     詞彙見《04-詞彙表》。
--
--       三段式沖法       → 三段式
--       四六沖法         → 四六法
--       五段式沖法       → 五段式 Rao Spin
--       攪拌流五段沖法   → Perger 攪拌流
--       肥尾沖法         → 肥尾法
--
--     舊名稱放進 aliases，自建時打舊名稱仍比對得到；與新名稱相同的別名拿掉，
--     別名是「名稱以外的叫法」。
--
-- 二、四六法第一注的 type 從 bloom 改成 pour。這是資料錯誤，不只是用詞：
--     粕谷哲刻意不把第一注當悶蒸，那正是四六法用 total 基準、其他手法用
--     dose 基準的理由（《01》§3.7）。標成 bloom 會讓畫面顯示「悶蒸」。
--     只改模板，**不改使用者既有紀錄的 brew_steps**——那些是已經存下來的紀錄。
--
-- 比照 20260917100000：寫入前先比對現值，任何一項與預期不同就整支中止。
-- 只寫 name、aliases 與第一段的 type，水量與停水時間不動。

do $$
declare
  plan record;
  found_count int;
  first_type jsonb;
begin
  for plan in
    select * from (values
      ('三段式沖法',     '三段式',          array['三段式', 'Three-Pour', '傳統三段'],
                                            array['三段式沖法', 'Three-Pour', '傳統三段']),
      ('四六沖法',       '四六法',          array['4:6', '46法', '四六法', 'Tetsu 4:6', '粕谷哲'],
                                            array['四六沖法', '4:6', '46法', 'Tetsu 4:6', '粕谷哲']),
      ('五段式沖法',     '五段式 Rao Spin', array['Rao Spin', '五段式', '5-Pour', 'Scott Rao'],
                                            array['五段式沖法', 'Rao Spin', '五段式', '5-Pour', 'Scott Rao']),
      ('攪拌流五段沖法', 'Perger 攪拌流',   array['Perger', 'Matt Perger', '攪拌流', '十字攪拌'],
                                            array['攪拌流五段沖法', 'Perger', 'Matt Perger', '攪拌流', '十字攪拌']),
      ('肥尾沖法',       '肥尾法',          array['肥尾', '火山沖法', 'Devil Method', '6-Pour', '粕谷哲惡魔'],
                                            array['肥尾沖法', '肥尾', '火山沖法', 'Devil Method', '6-Pour', '粕谷哲惡魔'])
    ) as t(old_name, new_name, expected_aliases, new_aliases)
  loop
    select count(*) into found_count
      from brew_methods m
     where m.user_id is null and m.name = plan.old_name and m.aliases = plan.expected_aliases;
    if found_count <> 1 then
      raise exception '找不到名稱為 %、別名為 % 的內建手法（找到 % 筆）。現況與預期不同，停止改名',
        plan.old_name, plan.expected_aliases, found_count;
    end if;

    if exists (select 1 from brew_methods m where m.user_id is null and m.name = plan.new_name) then
      raise exception '內建手法裡已經有「%」，停止改名', plan.new_name;
    end if;

    update brew_methods m
       set name = plan.new_name, aliases = plan.new_aliases
     where m.user_id is null and m.name = plan.old_name;
  end loop;

  -- 四六法：第一段必須目前是 bloom、total 基準，才改成 pour
  select m.step_template -> 'steps' -> 0 -> 'type' into first_type
    from brew_methods m
   where m.user_id is null and m.name = '四六法'
     and m.step_template -> 'steps' -> 0 ->> 'basis' = 'total';
  if first_type is distinct from '"bloom"'::jsonb then
    raise exception '四六法第一段的 type 是 %，預期 "bloom"（且 basis 為 total）。停止修改', first_type;
  end if;

  update brew_methods m
     set step_template = jsonb_set(m.step_template, '{steps,0,type}', '"pour"'::jsonb)
   where m.user_id is null and m.name = '四六法';
end $$;
