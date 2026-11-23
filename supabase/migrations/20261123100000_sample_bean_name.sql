-- 範例的標示改成寫在豆名裡（2026-11-23，《01》§13.2、《02》§9、《03》§4.12）。
--
-- 原本豆子與紀錄旁邊各有一個「範例」標籤（SampleBadge）。改成寫在使用者可以編輯的地方——豆名：
-- 「範例-衣索比亞 耶加雪菲」。使用者改名，畫面上的「範例」就跟著消失；is_sample 本身不因編輯而改變，
-- 統計照樣排除範例紀錄。器材的名稱來自型錄、使用者改不了，所以器材維持標籤，這支不動器材。
--
-- 兩件事：
--   一、新註冊的使用者：以 create or replace 換掉 create_sample_data，只改 declare 區塊裡的 bean_name，
--       其餘逐字照 20260922110000_sample_data.sql。create or replace 保留既有的權限
--       （20260923100000_function_grants.sql 的 revoke 不會被重設），owner 也不變。
--   二、既有使用者：把範例豆子改成新的名稱，**只改還是原本名稱的**。使用者自己改過名稱的不動——
--       那是他的資料，他已經把「範例」變成自己的豆子了。
--
-- ⚠ 不可逆：第二件是覆寫使用者資料的 update（見下面「二」）。push 前先備份，步驟寫在
--   docs/改版紀錄/上線準備.md 第二節第 3 點（備份的 select、push 前後的計數與兩支權限盤點）。
--   更新完如果還有「是範例而且仍是原本名稱」的列，migration 自己中止、整支回滾。

-- ── 一、新使用者 ───────────────────────────────────────────

create or replace function public.create_sample_data(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- ══════════════ 範例內容 ══════════════
  -- 磨豆機：選刻度四欄與建議範圍都齊全的機型，範例紀錄的刻度才有脈絡可讀
  grinder_brand   text := 'Timemore';
  grinder_model   text := 'C2';

  -- 豆子
  -- 範例的標示寫在豆名裡（2026-11-23）：使用者改名，標示就跟著消失；is_sample 不變
  bean_name       text := '範例-衣索比亞 耶加雪菲';
  bean_roaster    text := '範例烘豆店';
  bean_rest_days  int  := 7;          -- 烘焙日期 = 註冊日往前幾天
  bean_roast      text := 'medium_light';
  bean_country    text := 'ET';
  bean_region     text := '耶加雪菲';
  bean_processing text := '水洗';
  bean_variety    text := 'Heirloom 原生種';
  bean_notes      text := '柑橘、花香、紅茶感';

  -- 沖煮紀錄
  brew_method     text := '三段式';
  brew_dose       numeric := 15;
  brew_temp       int  := 92;
  brew_grind      numeric := 20;
  brew_total_time int  := 150;
  brew_rating     int  := 4;
  brew_intensity  jsonb := '{"acidity":4,"sweetness":3,"body":2,"bitterness":1}'::jsonb;
  brew_notes      text := '這是範例紀錄，可以直接刪除。也可以到豆子頁按「照上次再沖一次」，試一次複製的流程。';
  brew_tags       text[] := array['柑橘', '花香', '蜂蜜'];

  -- 分段注水：三段式套 15g（1:15 → 225g）
  step_water      numeric[] := array[30, 147, 225];
  step_hold       int[]     := array[30, 35, null];
  step_type       text[]    := array['bloom', 'pour', 'pour'];
  step_note       text[]    := array['讓粉床完全濕透', '主萃取，帶出風味前調', '補足後段醇厚度'];
  -- ══════════════════════════════════════

  catalog uuid;
  bean uuid;
  grinder uuid;
  brew uuid;
  i int;
begin
  -- 只建立一次
  if exists (select 1 from public.profiles where id = uid and sample_seeded) then
    return;
  end if;

  select id into catalog from public.equipment_catalog
    where type = 'grinder' and brand = grinder_brand and model = grinder_model
    limit 1;
  if catalog is null then
    raise exception '範例磨豆機不在型錄裡：% %', grinder_brand, grinder_model;
  end if;

  -- 不設為常用：常用會自動帶入每一張新表單，那是使用者自己的選擇
  insert into public.user_equipment (user_id, catalog_id, type, is_default, is_sample)
  values (uid, catalog, 'grinder', false, true)
  returning id into grinder;

  insert into public.beans (
    user_id, name, roaster, roast_date, roast_level,
    country_id, region, processing_method_id, variety_id, official_notes, is_sample
  )
  values (
    uid, bean_name, bean_roaster, current_date - bean_rest_days, bean_roast::public.roast_level,
    (select id from public.countries where iso_code = bean_country),
    bean_region,
    (select id from public.processing_methods where user_id is null and name = bean_processing),
    (select id from public.varieties where user_id is null and name = bean_variety),
    bean_notes, true
  )
  returning id into bean;

  -- form_duration_seconds 與兩個區段欄位留空：範例不是使用者記的，
  -- 填了會汙染「記一筆要多久」。brew_save_events 同理，一列都不寫
  insert into public.brews (
    user_id, bean_id, brew_method_id, dose, water_temp,
    grinder_id, grind_setting, total_time, rating, intensity, tasting_notes, is_sample
  )
  values (
    uid, bean,
    (select id from public.brew_methods where user_id is null and name = brew_method),
    brew_dose, brew_temp, grinder, brew_grind, brew_total_time, brew_rating,
    brew_intensity, brew_notes, true
  )
  returning id into brew;

  for i in 1 .. array_length(step_water, 1) loop
    insert into public.brew_steps (brew_id, user_id, step_index, cumulative_water, hold_seconds, step_type, note)
    values (brew, uid, i, step_water[i], step_hold[i], step_type[i]::public.step_type, step_note[i]);
  end loop;

  insert into public.brew_flavor_tags (brew_id, flavor_tag_id, user_id)
  select brew, t.id, uid
  from public.flavor_tags t
  where t.user_id is null and t.name = any(brew_tags);

  update public.profiles set sample_seeded = true where id = uid;
end;
$$;

-- ── 二、既有使用者 ─────────────────────────────────────────
--
-- 條件：is_sample = true 而且名稱一字不差是原本的「衣索比亞 耶加雪菲」。
-- 不是範例的同名豆子（使用者自己建的）不動；範例豆子被改過名的也不動。

update public.beans
set name = '範例-衣索比亞 耶加雪菲'
where is_sample = true
  and name = '衣索比亞 耶加雪菲';

do $$
begin
  if exists (select 1 from public.beans where is_sample = true and name = '衣索比亞 耶加雪菲') then
    raise exception '範例豆子的名稱沒有全部改到';
  end if;
end;
$$;
