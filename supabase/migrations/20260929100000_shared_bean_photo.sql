-- 分享頁顯示豆袋照片（《01》§14.5、《02》§7.2）。
--
-- 照片在 private bucket（bean-photos），policy 以路徑第一層的 auth.uid() 判斷擁有者，
-- 匿名的人讀不到。簽名網址只有 Storage 能產生，資料庫裡做不出來，所以照片由伺服器端
-- （server/api/shared-photo）以 service role 讀出來再交給瀏覽器。這支函式是伺服器端
-- 唯一的查詢：用分享代碼換儲存路徑。
--
-- **只給 service_role 執行。** 回傳值是儲存路徑，路徑的第一段就是 user_id——
-- 那兩樣都不能讓用戶端拿到（《01》§14.2 的「不回傳任何 uuid」）。anon 與 authenticated
-- 一律沒有執行權，前端無論有沒有登入都叫不動它。
--
-- 有效的條件與 get_shared_brew 相同：代碼格式正確、那一列存在、revoked_at 是 null。
-- 紀錄刪除時 brew_shares 會 cascade 掉，豆子刪除時紀錄會 cascade 掉，所以兩種情況都查不到。
-- 找不到、沒有照片，一律 null，不分原因。
--
-- 不寫開啟事件：開啟由 get_shared_brew 記，一次開啟一列（《01》§14.1）。
-- 因此是 stable。
--
-- 可逆性：只有 create function 與 grant／revoke，不動任何資料表與既有資料。
-- 還原：drop function public.get_shared_bean_photo_path(text);

create function public.get_shared_bean_photo_path(share_code text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path text;
begin
  if share_code is null or share_code !~ '^[A-Za-z0-9_-]{22}$' then
    return null;
  end if;

  select be.photo_path into path
  from public.brew_shares s
  join public.brews b on b.id = s.brew_id
  join public.beans be on be.id = b.bean_id
  where s.code = share_code and s.revoked_at is null;

  return nullif(btrim(path), '');
end
$$;

-- 先 revoke 再 grant（20260923100000_function_grants.sql 的原則）。
-- service_role 本來就從 alter default privileges 拿到了執行權，這裡照樣明寫，不依賴那件事
revoke all on function public.get_shared_bean_photo_path(text) from public, anon, authenticated;
grant execute on function public.get_shared_bean_photo_path(text) to service_role;
