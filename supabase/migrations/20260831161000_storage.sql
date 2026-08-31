-- §11 步驟 11：Storage bucket 與 policy（§7）
--
-- 兩個 bucket 皆為 private。擁有者依路徑第一層判斷：
--   bean-photos  {user_id}/{bean_id}.{ext}
--   brew-photos  {user_id}/{brew_id}.{ext}
--
-- file_size_limit 對應 §7 明訂的「單檔上限 2MB」，在伺服器端擋住。
-- allowed_mime_types 留空：§7 要求前端轉 WebP，但若轉檔失敗就完全上傳不了，
-- 代價高於容忍其他圖片格式。

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('bean-photos', 'bean-photos', false, 2097152),
  ('brew-photos', 'brew-photos', false, 2097152)
on conflict (id) do nothing;

-- for all 且省略 with check 時，PostgreSQL 會以 using 運算式同時作為
-- 可見列與新增列的判斷，因此讀寫皆受同一條件保護。
create policy "使用者只能存取自己的豆袋照片"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'bean-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "使用者只能存取自己的沖煮照片"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'brew-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
