-- 分享頁不再等照片（《01》§14.2、§14.5，《03》§4.13.4）。
--
-- get_shared_brew 多回傳一個 bean.has_photo（是非值）。分享頁拿到紀錄就立刻顯示，
-- 有照片時先留好縮圖的位置，縮圖網址另外非同步要——版面不會因為照片晚到而跳動。
--
-- 只回傳「有沒有」，不回傳路徑：路徑的第一段就是 user_id。有效條件與
-- get_shared_bean_photo_path 相同（nullif(btrim(...))：空白字串當作沒有照片），兩邊不會說法不一。
--
-- 整支函式照 20260923110000_brew_shares.sql 重寫一次，只多了 has_photo 那一行。
-- 簽名不變，前端呼叫方式不變。
--
-- 可逆性：只有 create or replace function 與 grant／revoke，不動任何資料。
-- 還原：重跑 20260923110000_brew_shares.sql 裡 get_shared_brew 的那一段（改成 create or replace）。

create or replace function public.get_shared_brew(share_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share public.brew_shares%rowtype;
  viewer_id uuid := auth.uid();
  viewer_is_owner boolean;
  result jsonb;
begin
  if share_code is null or share_code !~ '^[A-Za-z0-9_-]{22}$' then
    return null;
  end if;

  -- revoked_at 這一版一律是 null；照樣檢查，日後加回停止分享時讀取端不必再改
  select * into share from public.brew_shares
  where code = share_code and revoked_at is null;
  if not found then
    return null;
  end if;

  viewer_is_owner := viewer_id is not null and viewer_id = share.user_id;

  select jsonb_build_object(
    'is_owner', viewer_is_owner,
    'bean', jsonb_build_object(
      'name', be.name,
      'roaster', be.roaster,
      'roast_level', be.roast_level,
      'roast_date', be.roast_date,
      -- 有沒有豆袋照片，只是一個是非值：分享頁用它先留好縮圖的位置，版面不跳動。
      -- 照片本身由伺服器端另外發網址（get_shared_bean_photo_path），路徑不經過這裡
      'has_photo', nullif(btrim(be.photo_path), '') is not null
    ),
    'brewed_at', b.brewed_at,
    'dose', b.dose,
    'water_temp', b.water_temp,
    -- 刻度一定連磨豆機一起給：刻度 20 在不同磨豆機上是完全不同的粗細。
    -- 磨豆機沒填時，刻度也不給
    'grind_setting', case when b.grinder_id is not null then b.grind_setting end,
    'total_time', b.total_time,
    'method', m.name,
    -- 顯示名稱在這裡組好，不回傳器材的 id 與型錄的各欄。
    -- 組法與 utils/equipment.ts 的 catalogDisplayName 相同（測試比對兩邊）
    'grinder', case when g.id is null then null
      when gc.id is not null then gc.brand || ' · ' || gc.model || coalesce(' ' || gc.variant, '')
      else g.custom_name end,
    'dripper', case when d.id is null then null
      when dc.id is not null then dc.brand || ' · ' || dc.model || coalesce(' ' || dc.variant, '')
      else d.custom_name end,
    'kettle', case when k.id is null then null
      when kc.id is not null then kc.brand || ' · ' || kc.model || coalesce(' ' || kc.variant, '')
      else k.custom_name end,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_index', st.step_index,
        'step_type', st.step_type,
        'cumulative_water', st.cumulative_water,
        'hold_seconds', st.hold_seconds,
        'note', st.note
      ) order by st.step_index)
      from public.brew_steps st where st.brew_id = b.id
    ), '[]'::jsonb),
    'rating', b.rating,
    'is_favorite', b.is_favorite,
    -- 只取四個已知的 key，不把 jsonb 欄位原樣交出去
    'intensity', nullif(jsonb_strip_nulls(jsonb_build_object(
      'acidity', b.intensity -> 'acidity',
      'sweetness', b.intensity -> 'sweetness',
      'body', b.intensity -> 'body',
      'bitterness', b.intensity -> 'bitterness'
    )), '{}'::jsonb),
    'flavor_tags', coalesce((
      select jsonb_agg(ft.name order by ft.sort_order, ft.name)
      from public.brew_flavor_tags bft
      join public.flavor_tags ft on ft.id = bft.flavor_tag_id
      where bft.brew_id = b.id
    ), '[]'::jsonb)
  )
  -- 心得筆記：沒勾、或紀錄沒有心得時，連 key 都不出現。
  -- 不是回傳之後在畫面上藏——那樣開一下開發者工具就看得到
  || case when share.include_notes and nullif(btrim(b.tasting_notes), '') is not null
       then jsonb_build_object('tasting_notes', b.tasting_notes) else '{}'::jsonb end
  -- 本人是唯一拿得到 id 的人：「前往紀錄」需要它，而他本來就讀得到那筆紀錄
  || case when viewer_is_owner then jsonb_build_object('brew_id', b.id) else '{}'::jsonb end
  into result
  from public.brews b
  join public.beans be on be.id = b.bean_id
  left join public.brew_methods m on m.id = b.brew_method_id
  left join public.user_equipment g on g.id = b.grinder_id
  left join public.equipment_catalog gc on gc.id = g.catalog_id
  left join public.user_equipment d on d.id = b.dripper_id
  left join public.equipment_catalog dc on dc.id = d.catalog_id
  left join public.user_equipment k on k.id = b.kettle_id
  left join public.equipment_catalog kc on kc.id = k.catalog_id
  where b.id = share.brew_id;

  if result is null then
    return null;
  end if;

  insert into public.brew_share_events (share_id, event, viewer)
  values (share.id, 'open', case
    when viewer_id is null then 'anon'
    when viewer_is_owner then 'owner'
    else 'member'
  end);

  return result;
end
$$;

-- create or replace 保留既有的權限，這裡照規則再寫一次，不依賴那件事
revoke all on function public.get_shared_brew(text) from public, anon, authenticated;
grant execute on function public.get_shared_brew(text) to anon, authenticated;
