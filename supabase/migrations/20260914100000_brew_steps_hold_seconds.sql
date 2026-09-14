-- 分段時間改存純停水秒數（《01》§3.6、《02》§5 區塊三）。
--
-- 舊模型：time_offset int not null，累積時間點。介面的「停留」等於
-- 「這段開始注水 → 下一段開始注水」的全部時間，含注水動作本身。
-- 那個定義要求使用者提供一個他不知道的數字——注水花了幾秒——
-- 兩位實機測試者都填不出來（「我以為是下沖的時間」；被告知定義之後
-- 仍然「不知道怎麼填」）。給水速率依器材與手法而異、還有行動誤差，
-- 無法預期；使用者實際在調整的是停水時間。
--
-- 新模型：hold_seconds int（可為 NULL），注完到下一注之間的純停水秒數。
-- 可空是刻意的：NOT NULL 逼得「沒記錄」與「停 0 秒」共用同一個值，
-- 才需要「全為 0 視為沒記錄」那個變通。可空之後語意由資料直接表達。
--
-- 搬移方式：先加欄位、搬資料、驗證、再刪舊欄位（比照產國那次的做法）。

alter table brew_steps add column hold_seconds int;

comment on column brew_steps.hold_seconds is
  '純停水秒數：注完之後到下一注之前，不含注水動作本身。最後一段沒有下一注，為 NULL';

-- 一、搬資料：hold_seconds[n] = time_offset[n+1] − time_offset[n]。
--
-- 這是精確的逆運算，不會有誤差。**但搬過去的數字仍是「段落總歷時」而非
-- 純停水**，會偏大——多出來的是注水時間。舊資料裡沒有注水時長的資訊，
-- 無法還原，也**不要用估計值修正**：憑空減去一個猜測的秒數比偏大更糟，
-- 那會讓使用者的紀錄變成系統編出來的數字。舊資料就讓它偏大，
-- 新記錄的資料才是乾淨的。
update brew_steps s
set hold_seconds = next.time_offset - s.time_offset
from brew_steps next
where next.brew_id = s.brew_id
  and next.step_index = s.step_index + 1;

-- 二、最後一段維持 NULL：原本就沒存過，顯示時是靠 total_time 反推的。
-- 上面的 update 沒有下一段可以 join，自然不會寫到它。

-- 三、原本 time_offset 全為 0 的紀錄是「沒記錄分段時間」，一併固化成 NULL。
-- 那些 0 是舊模型 NOT NULL 的產物，不是使用者真的停了 0 秒。
update brew_steps s
set hold_seconds = null
where not exists (
  select 1 from brew_steps t where t.brew_id = s.brew_id and t.time_offset > 0
);

-- 四、驗證資料保存：把 hold_seconds 累加回去，必須與原本的 time_offset
-- 完全相同（只檢查有記錄時間的紀錄；沒記錄的已經全部設成 NULL）。
-- 對不上就讓整支 migration 失敗，不要留下半套資料。
do $$
declare mismatched int;
begin
  select count(*) into mismatched
  from (
    select s.id,
           s.time_offset as before,
           coalesce(sum(earlier.hold_seconds), 0) as rebuilt
    from brew_steps s
    left join brew_steps earlier
      on earlier.brew_id = s.brew_id and earlier.step_index < s.step_index
    where exists (select 1 from brew_steps t where t.brew_id = s.brew_id and t.time_offset > 0)
    group by s.id, s.time_offset
  ) checked
  where before <> rebuilt;

  if mismatched > 0 then
    raise exception '分段時間搬移後對不上，有 % 列，migration 中止', mismatched;
  end if;
end $$;

alter table brew_steps drop column time_offset;
