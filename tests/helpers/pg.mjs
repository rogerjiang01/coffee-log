// 在 WASM 版 Postgres 上套用全部 migration，用來驗證 schema、RLS 與約束。
//
// stub 的部分模擬 Supabase 平台既有的環境（auth、storage、三個角色），
// 那些不屬於本專案的 migration。auth.uid() 改成讀可設定的 GUC，
// 這樣測試才能扮演不同的使用者。

import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS = path.resolve(here, '../../supabase/migrations')

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null,
  public boolean default false, file_size_limit bigint
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets, name text, owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;

-- 刻意不預先授權 public schema：授權必須由專案自己的 grants migration 提供。
-- 這條讓 20260831170000_grants.sql 真的被驗到。
grant usage on schema auth, storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated;
`

export async function createDatabase() {
  const db = await new PGlite()
  await db.exec(STUB)

  const files = fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()
  for (const file of files) {
    try {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
    }
    catch (error) {
      throw new Error(`migration ${file} 套用失敗：${error.message}`)
    }
  }

  return {
    db,
    migrationCount: files.length,
    rows: async sql => (await db.query(sql)).rows,
    exec: sql => db.exec(sql),
    query: sql => db.query(sql),
    /** 扮演某個使用者，之後的查詢都會受 RLS 限制 */
    async as(userId) {
      await db.exec('reset role')
      await db.exec(`select set_config('test.uid', '${userId}', false)`)
      await db.exec('set role authenticated')
    },
    /** 回到超級使用者，用來旁路 RLS 做複查 */
    async asSuperuser() {
      await db.exec('reset role')
    },
    async createUser(email) {
      const result = await db.query(`insert into auth.users (email) values ('${email}') returning id`)
      return result.rows[0].id
    },
    close: () => db.close(),
  }
}
