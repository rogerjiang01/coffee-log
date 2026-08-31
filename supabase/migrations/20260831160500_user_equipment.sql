-- §11 步驟 6：user_equipment（§3.3）

create table user_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  catalog_id uuid references equipment_catalog on delete set null,
  type equipment_type not null,
  custom_name text,                   -- catalog_id 為空時必填
  is_default boolean not null default false,
  note text,                          -- 改裝、個體差異記錄於此（改裝不進型錄）
  created_at timestamptz not null default now(),
  constraint name_or_catalog check (catalog_id is not null or custom_name is not null)
);

create index on user_equipment (user_id, type);

-- 確保每個類型只有一個預設器材
create unique index on user_equipment (user_id, type) where is_default = true;
