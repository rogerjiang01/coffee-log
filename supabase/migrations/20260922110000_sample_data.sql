-- 新註冊的使用者一開始就有範例資料（《01》§13、《02》§9）。
--
-- 為什麼要有：第一次進來看到一片空白，使用者得先建豆子、建器材、填沖煮、
-- 填品飲才看得到任何東西，而首次使用正是風險最高的一段（《02》§9）。
-- 範例讓他先看到「記完之後長什麼樣子」，再決定要不要自己記一筆。
--
-- 範圍：只有這支 migration 推上去之後註冊的人才有。**既有使用者不補。**
-- 補了等於在別人已經在用的資料裡塞三筆他沒建立的東西。
--
-- 範例是他自己的資料：可以編輯、可以刪除、可以複製，行為與一般資料完全相同。
-- is_sample 只做兩件事——顯示「範例」標籤、從統計裡排除。
--
-- **範例標記不因編輯而消失。** 「改過就變成真的」使用者猜不到——
-- 改了豆名算不算？改了刻度算不算？規則要能預測，所以標記只跟著資料本身。
--
-- 可逆性：新增三個欄位（可為空、有預設值）、一個新欄位在 profiles、
-- 一個新函式，並以 create or replace 換掉 handle_new_user。
-- 沒有 drop、沒有覆寫既有資料的 update／delete。

-- ── 一、範例標記 ───────────────────────────────────────────
--
-- 三張表各一個，預設 false。既有資料全部自動是 false，不需要搬資料。
-- 不違反「必填只有三個」：那條管的是使用者必須填寫的內容，
-- 這個欄位沒有人需要填（同 beans.is_finished、user_equipment.is_default）。

alter table beans          add column is_sample boolean not null default false;
alter table user_equipment add column is_sample boolean not null default false;
alter table brews          add column is_sample boolean not null default false;

comment on column beans.is_sample is
  '註冊時自動建立的範例資料。只用於顯示「範例」標籤與排除統計，不影響編輯、刪除、複製';
comment on column user_equipment.is_sample is '同 beans.is_sample';
comment on column brews.is_sample is
  '同 beans.is_sample。從範例紀錄複製出來的新紀錄不帶這個標記——那是使用者自己沖的';

-- 每位使用者只建立一次。刪掉範例之後不會再被建立：
-- 判斷的依據是「建立過沒有」，不是「現在還有沒有」。
alter table profiles add column sample_seeded boolean not null default false;

comment on column profiles.sample_seeded is
  '是否已經建立過範例資料。既有使用者維持 false 但不會被補建——只有註冊 trigger 會呼叫建立函式';

-- ── 二、範例內容 ───────────────────────────────────────────
--
-- **所有文字與數值集中在下面的 declare 區塊**，改內容只改那裡。
--
-- 分段的水量與停水秒數是「三段式」的模板套 15g／1:15 算出來的結果
-- （utils/brewSteps.ts 的 stepsFromTemplate），不是另外編的數字——
-- tests/db/sample-data.test.mjs 會拿模板重算一次比對，模板改了就會紅。
--
-- security definer：要寫入受 RLS 保護的表，與 handle_new_user 同樣的理由。
-- search_path = '' 避免注入，所以表名全部寫合格名稱。

create function public.create_sample_data(uid uuid)
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
  bean_name       text := '衣索比亞 耶加雪菲';
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

comment on function public.create_sample_data(uuid) is
  '建立一位使用者的範例資料（磨豆機、豆子、沖煮紀錄）。只有註冊 trigger 會呼叫；重複呼叫不會重複建立';

-- ── 三、掛在註冊流程上 ─────────────────────────────────────
--
-- **範例建立失敗時註冊必須照樣成功。** 例外包在自己的 block 裡，
-- 只記 warning 不往上拋：註冊失敗的代價是使用者根本進不來，
-- 遠高於少三筆範例。profile 的 insert 不包——那是註冊本身的一部分。

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);

  begin
    perform public.create_sample_data(new.id);
  exception when others then
    raise warning '[sample] 範例資料建立失敗，註冊照樣完成：% %', sqlstate, sqlerrm;
  end;

  return new;
end;
$$;
