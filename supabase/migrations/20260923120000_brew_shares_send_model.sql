-- 分享改成「傳送模型」（《01》§14、《02》§7.1）。
--
-- 分享的本質是傳送，像 LINE 傳出去的訊息：送出就是送出，沒有回頭修改。
-- 所以每次分享都產生一條新連結，「包含心得筆記」跟著那一次傳送固定，之後不能改。
--
-- 前一版（20260923110000_brew_shares.sql）是「一筆紀錄一條連結、設定隨時可改」。
-- 重複使用同一條連結唯一的價值，是之後能一次切斷所有收到的人——我們不做連結管理，
-- 換不到這個好處。成本卻是實在的：代碼必須在點擊當下由用戶端產生（iOS 的系統分享
-- 等不了網路請求），要重複使用既有連結就得在開對話框時先查，查詢還沒回來就按下分享，
-- 會撞上唯一索引而建立失敗。
--
-- 這支 migration 做三件事：
--   一、拿掉「一筆紀錄只能有一條生效中的連結」的部分唯一索引
--   二、create_brew_share 每次都新增一列，不再回傳既有代碼
--   三、移除 set_brew_share_notes——include_notes 建立之後沒有任何寫入路徑
--
-- **既有資料一列都不動。** brew_shares 與 brew_share_events 不刪、不改；
-- event 的 check 保留 'toggle_notes'，前一版寫進去的事件才不會違反限制。
-- 之後不會再產生新的 toggle_notes。revoked_at 維持保留、不寫入。
--
-- 不可逆的部分：drop index 與 drop function 都不動資料，但要還原得重建
-- （指令見本輪回報）。重建部分唯一索引之前要先確認沒有同一筆紀錄的多條生效中連結，
-- 這支 migration 推上去之後那種資料就會開始出現。

-- ── 一、同一筆紀錄可以有多條連結 ─────────────────────────────────

drop index if exists public.brew_shares_live;

-- 原本部分唯一索引兼作 brew_id 的查詢索引（ON DELETE CASCADE 要用它找列）
create index brew_shares_brew_id_idx on public.brew_shares (brew_id);

-- ── 二、create_brew_share：每次都新增一列 ──────────────────────────
--
-- 簽名不變，前端不必改呼叫方式。擁有者檢查不變。
--
-- 唯一剩下的衝突是代碼本身（brew_shares.code 的 unique）。兩種情況：
--   同一個使用者、同一筆紀錄、同一個代碼：「再試一次」重送，而第一次其實已經成功、
--     只是回應沒回來。回傳同一個代碼，不新增、不寫事件——重送必須是冪等的，
--     否則使用者會一直看到失敗，而那條連結其實早就能開了
--   其他：代碼撞到別筆（128 bits 亂數，實務上不會發生）。照樣 raise
--
-- 設定以第一次建立的為準：重送時帶的 p_include_notes 不會覆蓋既有的列。
-- 前端的「再試一次」本來就帶同一個設定，這裡只是不讓它有改設定的路。

create or replace function public.create_brew_share(p_brew_id uuid, p_code text, p_include_notes boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null or not exists (
    select 1 from public.brews where id = p_brew_id and user_id = uid
  ) then
    -- 不靜默 return：靜默會讓前端以為成功，使用者拿到一個不存在的連結
    raise exception '找不到這筆紀錄' using errcode = '42501';
  end if;

  begin
    insert into public.brew_shares (brew_id, user_id, code, include_notes)
    values (p_brew_id, uid, p_code, coalesce(p_include_notes, false))
    returning id into new_id;
  exception when unique_violation then
    if exists (
      select 1 from public.brew_shares
      where code = p_code and brew_id = p_brew_id and user_id = uid
    ) then
      return p_code;
    end if;
    raise;
  end;

  insert into public.brew_share_events (share_id, event, include_notes)
  values (new_id, 'create', coalesce(p_include_notes, false));

  return p_code;
end
$$;

-- create or replace 保留既有的權限，這裡照規則再寫一次，不依賴那件事
revoke all on function public.create_brew_share(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.create_brew_share(uuid, text, boolean) to authenticated;

-- ── 三、include_notes 建立之後不能改 ──────────────────────────────

drop function if exists public.set_brew_share_notes(uuid, boolean);
