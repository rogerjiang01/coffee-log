-- 分享沖煮紀錄（《01》§14、《02》§7.1、§7.2）。
--
-- **核心約束：匿名的人碰不到任何一張表。** 讀取只有一個入口 get_shared_brew，
-- 只回傳分享頁實際顯示的欄位；寫入也只走函式。兩張新表對 anon 一律沒有
-- table privilege，對 authenticated 只有 brew_shares 的 select（本人讀自己的列）。
--
-- 分享不動 brews 的 RLS，也不改 visibility（《01》§3.5）：做成 visibility = 'public'
-- 會讓那筆紀錄對所有登入者可讀，範圍比「拿到連結的人」大得多。
--
-- **第一版沒有停止分享。** revoked_at 欄位與部分唯一索引留著，日後加回時不必改表，
-- 但這一版沒有任何寫入它的路徑：沒有函式寫它，也沒有任何角色有 update 權限。
-- event 的 check 也不含 'revoke'——沒有寫入路徑的值不先開。
--
-- 可逆性：整支只有 create table／index／policy／function 與 grant／revoke，
-- 沒有 drop、沒有 update、沒有 delete，不動任何既有資料。

-- ── 兩張表 ─────────────────────────────────────────────────────

create table brew_shares (
  id uuid primary key default gen_random_uuid(),
  brew_id uuid not null references brews on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- 網址上那一段：128 bits 亂數轉 base64url，22 個字元，由用戶端產生（《02》§7.1）。
  -- 不得由 id、brew_id 或任何已知值推導出來
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{22}$'),
  include_notes boolean not null default false,
  -- null ＝ 生效中。第一版沒有寫入路徑，一律是 null
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 一筆紀錄同時只能有一個生效中的連結。
-- 「重複分享沿用同一個連結」不是靠程式記得去查，是靠這條索引保證
create unique index brew_shares_live on brew_shares (brew_id) where revoked_at is null;
create index brew_shares_user_id_idx on brew_shares (user_id);

comment on table brew_shares is
  '一筆沖煮紀錄的分享連結（《01》§14）。匿名不得直接查詢，讀取只走 get_shared_brew';

-- 原始事件，怎麼解讀留到查詢時（§9.2 的原則）。本人的開啟記成 owner，
-- 查朋友的開啟次數一律 viewer <> 'owner'
create table brew_share_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references brew_shares on delete cascade,
  event text not null check (event in ('create', 'toggle_notes', 'open')),
  include_notes boolean,                                       -- create／toggle_notes：當下（改之後）的狀態
  viewer text check (viewer in ('anon', 'member', 'owner')),   -- open：開啟者的身分
  occurred_at timestamptz not null default now()
);

create index brew_share_events_share_idx on brew_share_events (share_id, occurred_at);

comment on table brew_share_events is
  '分享的原始事件（《01》§14.1）：建立、切換「包含心得筆記」、開啟。介面不讀取';

-- ── RLS ────────────────────────────────────────────────────────
--
-- brew_shares 只有一條 select：紀錄詳情頁要知道「這筆分享了沒、目前勾了沒」。
-- brew_share_events 一條都不寫：介面不讀它，盤點在 SQL Editor 做——
-- 沒有 policy 又沒有 privilege 的表，security definer 函式以外碰不到。

alter table brew_shares enable row level security;
alter table brew_share_events enable row level security;

create policy "只能讀自己的分享"
  on brew_shares for select
  using (auth.uid() = user_id);

-- ── table privilege ────────────────────────────────────────────
--
-- 20260831170000_grants.sql 的 alter default privileges 會讓新表自動拿到
-- grant all（含 anon）。先全部收回，再只給該給的。寫入一律走下面的函式。

revoke all on table brew_shares from anon, authenticated;
revoke all on table brew_share_events from anon, authenticated;
grant select on table brew_shares to authenticated;

-- ── anon 對分享碰得到的資料表：一律收回 ─────────────────────────
--
-- 《01》§14.2：anon 對這些表「一律沒有 table privilege。不是靠 policy 擋，是連表都碰不到」。
-- 在這之前 anon 其實有：20260831170000_grants.sql 對 public schema 的所有表
-- `grant all … to anon`（當時的理由是平台慣例，實際把關交給 RLS），
-- 所以匿名 select brews 拿到的是「0 列」，不是 permission denied。
--
-- 分享上線之後，未登入的人第一次有了一個進到這個產品裡的正當理由（點開朋友的連結），
-- 這幾張表的防線不該只剩 RLS 一層。收回的範圍照《01》§14.2 列的：存著紀錄內容的
-- 五張既有表（加上上面已經收回的 brew_shares）。查表類的系統表（風味標籤、手法、
-- 型錄）不在這一輪的範圍。
--
-- 不影響任何既有流程：未登入時唯一會碰資料庫的頁面是登入、註冊（走 auth，不查表）
-- 與這次的分享頁（走 get_shared_brew，security definer，不需要呼叫者的 table privilege）。
-- authenticated 的權限一個字都不動。
--
-- 還原：grant all on table brews, brew_steps, beans, user_equipment, brew_flavor_tags to anon;
revoke all on table brews, brew_steps, beans, user_equipment, brew_flavor_tags from anon;

-- ── 讀取：get_shared_brew ──────────────────────────────────────
--
-- **回傳的 key ＝ 分享頁實際顯示的欄位，一欄都不能多**（《01》§14.2）。
-- 回傳了卻沒顯示的欄位，開發者工具裡看得到，等於不知不覺多公開了資料。
-- 要多顯示一個欄位：先改《01》§14.2 的表，再改這裡，最後改頁面。
-- utils/share.ts 的 SHARED_BREW_KEYS 是同一份清單，tests/db/shares.test.mjs 比對兩邊。
--
-- 只吃 share_code，不吃 brew_id——吃了就是一個可以指定任意紀錄的後門。
-- security definer 繞過 RLS，所以所有檢查都在這裡做完。
--
-- 找不到就是找不到：代碼不存在、格式不對、紀錄已刪除，一律 null，不分原因。
-- 分原因等於告訴逐一試代碼的人「這一個曾經存在」。
--
-- 開啟事件由這支函式自己寫，前端不另外呼叫。因此是 volatile（預設值）。

create function public.get_shared_brew(share_code text)
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
      'roast_date', be.roast_date
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

-- ── 寫入：create_brew_share ────────────────────────────────────
--
-- 代碼由用戶端產生：iOS Safari 的系統分享必須在點擊的同一個事件裡同步呼叫，
-- 等不了這一趟請求（《02》§7.1）。這裡對代碼只靠 check 與 unique 約束把關。
-- 使用者只能替自己的紀錄指定代碼，選爛代碼只傷得到自己；**跨使用者的那一層是
-- p_brew_id 的擁有者檢查**，不能省。
--
-- 已有生效中的連結 → 回傳既有代碼，不寫事件、不改 include_notes。
-- 回傳值可能不是送進來的那個（別的裝置先分享過），前端要比對。
-- 用同一個代碼重送（「再試一次」，或第一次其實成功了只是回應沒回來）時，
-- 找到的就是自己剛建的那一列，回傳同一個代碼。

create function public.create_brew_share(p_brew_id uuid, p_code text, p_include_notes boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing text;
  new_id uuid;
begin
  if uid is null or not exists (
    select 1 from public.brews where id = p_brew_id and user_id = uid
  ) then
    -- 不靜默 return：靜默會讓前端以為成功，使用者拿到一個不存在的連結
    raise exception '找不到這筆紀錄' using errcode = '42501';
  end if;

  select code into existing from public.brew_shares
  where brew_id = p_brew_id and revoked_at is null;
  if found then
    return existing;
  end if;

  begin
    insert into public.brew_shares (brew_id, user_id, code, include_notes)
    values (p_brew_id, uid, p_code, coalesce(p_include_notes, false))
    returning id into new_id;
  exception when unique_violation then
    -- 兩個請求同時建立同一筆紀錄的分享：另一個先成功了，回傳它的代碼
    select code into existing from public.brew_shares
    where brew_id = p_brew_id and revoked_at is null;
    if found then
      return existing;
    end if;
    raise;
  end;

  insert into public.brew_share_events (share_id, event, include_notes)
  values (new_id, 'create', coalesce(p_include_notes, false));

  return p_code;
end
$$;

-- ── 寫入：set_brew_share_notes ─────────────────────────────────
--
-- 已經分享過時，「包含心得筆記」一變更就立即儲存（《02》§7.1）。
-- 值真的變了才寫事件。沒有生效中的連結時 raise：前端只在分享過之後呼叫它，
-- 走到這裡代表畫面與資料庫對不上，不能假裝成功。

create function public.set_brew_share_notes(p_brew_id uuid, p_include boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  share public.brew_shares%rowtype;
begin
  if uid is null or not exists (
    select 1 from public.brews where id = p_brew_id and user_id = uid
  ) then
    raise exception '找不到這筆紀錄' using errcode = '42501';
  end if;
  if p_include is null then
    raise exception 'p_include 不可為 null' using errcode = '22004';
  end if;

  select * into share from public.brew_shares
  where brew_id = p_brew_id and revoked_at is null
  for update;
  if not found then
    raise exception '這筆紀錄還沒有分享' using errcode = 'P0002';
  end if;

  if share.include_notes is distinct from p_include then
    update public.brew_shares set include_notes = p_include where id = share.id;
    insert into public.brew_share_events (share_id, event, include_notes)
    values (share.id, 'toggle_notes', p_include);
  end if;
end
$$;

-- ── 函式的執行權 ───────────────────────────────────────────────
--
-- 每一支都先 revoke 再 grant（20260923100000_function_grants.sql 的原則）：
-- PostgreSQL 的內建預設是 EXECUTE 給 PUBLIC，grants migration 的
-- alter default privileges 又會再給 anon。不 revoke 的話，寫入函式
-- anon 也叫得動——擁有者檢查會擋住，但「擋得住」與「碰不到」是兩件事。
--
-- get_shared_brew 給 anon 與 authenticated：朋友不論有沒有登入都能看。
-- 兩支寫入函式只給 authenticated。

revoke all on function public.get_shared_brew(text) from public, anon, authenticated;
grant execute on function public.get_shared_brew(text) to anon, authenticated;

revoke all on function public.create_brew_share(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.create_brew_share(uuid, text, boolean) to authenticated;

revoke all on function public.set_brew_share_notes(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_brew_share_notes(uuid, boolean) to authenticated;
