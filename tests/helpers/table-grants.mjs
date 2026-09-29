// public schema 每張資料表對三個角色的 table privilege 白名單。
//
// tests/db/table-grants.test.mjs 拿它比對 migration 建出來的資料庫：多一個、少一個都失敗。
// supabase/queries/資料表權限盤點.sql 的 allowed 是同一份清單（給正式庫用），
// tests/unit/table-audit-query.test.mjs 比對兩邊。
//
// **anon 不在任何一張表上**，這是刻意的（20261001100000_table_default_privileges.sql）。
// 匿名的人只透過 get_shared_brew 這支函式讀資料，不碰表。要給 anon 一張表之前先問：
// 能不能改成一支只回傳必要欄位的 security definer 函式？
//
// 新增資料表時：建表的 migration 寫 revoke all ＋ grant，再把這裡與盤點查詢一起改。
// service_role 只在伺服器端程式需要直接存取那張表時才給（CLAUDE.md）。
//
// 既有 15 張表的 authenticated 與 service_role 照 2026-09-29 的現況記錄，沒有收斂：
// authenticated 多給的（truncate、references、trigger 與介面用不到的寫入）記在 CLAUDE.md 的暫緩；
// service_role 的全部權限是補產生縮圖的腳本（讀 beans）與型錄維護（《01》§6.4）用的。

export const PRIVILEGES = ['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']
const ALL = PRIVILEGES

export const ROLES = ['anon', 'authenticated', 'service_role']

/** @type {Record<string, Partial<Record<'anon' | 'authenticated' | 'service_role', string[]>>>} */
export const TABLE_GRANTS = {
  // 使用者資料
  profiles:           { authenticated: ALL, service_role: ALL },
  beans:              { authenticated: ALL, service_role: ALL },
  brews:              { authenticated: ALL, service_role: ALL },
  brew_steps:         { authenticated: ALL, service_role: ALL },
  brew_flavor_tags:   { authenticated: ALL, service_role: ALL },
  user_equipment:     { authenticated: ALL, service_role: ALL },
  // 混合表（系統項目 ＋ 使用者自建）
  brew_methods:       { authenticated: ALL, service_role: ALL },
  flavor_tags:        { authenticated: ALL, service_role: ALL },
  processing_methods: { authenticated: ALL, service_role: ALL },
  varieties:          { authenticated: ALL, service_role: ALL },
  // 純系統表
  countries:          { authenticated: ALL, service_role: ALL },
  equipment_catalog:  { authenticated: ALL, service_role: ALL },
  // 量測：只能新增，介面不讀（《01》§9.2）
  brew_save_events:   { authenticated: ['insert'], service_role: ALL },
  // 分享：寫入只走函式，本人只讀自己的列（《01》§14.4）
  brew_shares:        { authenticated: ['select'], service_role: ALL },
  brew_share_events:  { service_role: ALL },
}
