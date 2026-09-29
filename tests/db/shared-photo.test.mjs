// 分享頁的豆袋照片：資料庫那一半（20260929100000_shared_bean_photo.sql，《01》§14.5）。
//
// get_shared_bean_photo_path 用分享代碼換儲存路徑，**只有 service_role 叫得動**——
// 路徑的第一段就是 user_id，那不能讓用戶端拿到。這裡驗：
//   誰叫得動、誰叫不動
//   有效的條件與 get_shared_brew 相同（代碼無效、紀錄已刪除、豆子已刪除，一律 null）
//   不寫開啟事件
//   匿名的人對 storage 仍然沒有任何路
// 最後把伺服器端的流程（server/utils/sharedPhoto.ts）接到這個資料庫上，從頭到尾走一次。

import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'
import { generateShareCode } from '../../utils/share.ts'
import { loadSharedPhoto, resolveSharedPhotoUrls } from '../../server/utils/sharedPhoto.ts'
import { beanThumbPath } from '../../utils/beanPhoto.ts'

const FN = 'public.get_shared_bean_photo_path(text)'

export default async function run() {
  const r = createReport('分享頁的豆袋照片（資料庫）')
  const pg = await createDatabase()

  async function asRole(role, uid = '') {
    await pg.exec('reset role')
    await pg.exec(`select set_config('test.uid', '${uid}', false)`)
    await pg.exec(`set role ${role}`)
  }
  async function photoPath(code) {
    await asRole('service_role')
    const value = (await pg.rows(`select public.get_shared_bean_photo_path(${code === null ? 'null' : `'${code.replace(/'/g, "''")}'`}) as v`))[0].v
    await pg.asSuperuser()
    return value
  }

  // ── 準備資料 ─────────────────────────────────────────────────
  await pg.asSuperuser()
  const A = await pg.createUser('photo-a@test')
  const bean = (await pg.rows(`insert into beans (user_id, name) values ('${A}', '肯亞 AA') returning id`))[0].id
  const path = `${A}/${bean}.webp`
  await pg.exec(`update beans set photo_path = '${path}' where id = '${bean}'`)
  const plainBean = (await pg.rows(`insert into beans (user_id, name) values ('${A}', '沒有照片的豆子') returning id`))[0].id

  async function share(beanId) {
    const brew = (await pg.rows(`insert into brews (user_id, bean_id, dose) values ('${A}', '${beanId}', 15) returning id`))[0].id
    const code = generateShareCode()
    await pg.as(A)
    await pg.exec(`select public.create_brew_share('${brew}', '${code}', false)`)
    await pg.asSuperuser()
    return { brew, code }
  }
  const withPhoto = await share(bean)
  const noPhoto = await share(plainBean)

  r.section('執行權：只有 service_role')
  const can = async role => (await pg.rows(`select has_function_privilege('${role}', '${FN}', 'execute') as ok`))[0].ok
  r.check(await can('service_role') === true, 'service_role 可以執行')
  r.check(await can('anon') === false, 'anon 不能執行')
  r.check(await can('authenticated') === false, 'authenticated 不能執行')
  for (const [role, uid] of [['anon', ''], ['authenticated', A]]) {
    await asRole(role, uid)
    let message = ''
    try {
      await pg.exec(`select public.get_shared_bean_photo_path('${withPhoto.code}')`)
    }
    catch (error) {
      message = error.message
    }
    await pg.asSuperuser()
    r.check(/permission denied/i.test(message), `${role === 'authenticated' ? '分享者本人（authenticated）' : 'anon'} 直接呼叫：permission denied`)
  }
  const def = (await pg.rows(`select p.prosecdef, p.provolatile, p.proconfig from pg_proc p
    where p.oid = '${FN}'::regprocedure`))[0]
  r.check(def.prosecdef === true && (def.proconfig ?? []).some(c => c.startsWith('search_path=')),
    'security definer，而且鎖了 search_path')
  r.check(def.provolatile === 's', 'stable：不寫任何東西')

  r.section('代碼換路徑')
  r.check(await photoPath(withPhoto.code) === path, '有效的代碼、豆子有照片：回傳路徑')
  r.check(await photoPath(noPhoto.code) === null, '豆子沒有照片：null')
  r.check(await photoPath(generateShareCode()) === null, '不存在的代碼：null')
  for (const bad of [null, '', 'short', `${withPhoto.code}x`, `' or '1'='1`]) {
    r.check(await photoPath(bad) === null, `格式不對的代碼（${bad === null ? 'null' : `「${bad}」`}）：null`)
  }
  await pg.exec(`update beans set photo_path = '  ' where id = '${plainBean}'`)
  r.check(await photoPath(noPhoto.code) === null, '路徑是空白字串：當作沒有照片')

  r.section('get_shared_brew 的 has_photo：只有是非值，沒有路徑')
  const shared = async code => {
    await asRole('anon')
    const value = (await pg.rows(`select public.get_shared_brew('${code}') as v`))[0].v
    await pg.asSuperuser()
    return value
  }
  const sharedWith = await shared(withPhoto.code)
  r.check(sharedWith.bean.has_photo === true, '豆子有照片：true')
  r.check((await shared(noPhoto.code)).bean.has_photo === false, '沒有照片（或路徑是空白字串）：false')
  const text = JSON.stringify(sharedWith)
  r.check(!text.includes(path) && !text.includes('.webp') && !text.includes(A), '回傳值裡沒有儲存路徑，也沒有 user_id')

  r.section('不寫開啟事件（開啟只由 get_shared_brew 記）')
  const count = async () => (await pg.rows(`select count(*)::int n from brew_share_events where event = 'open'`))[0].n
  const before = await count()
  await photoPath(withPhoto.code)
  await photoPath(withPhoto.code)
  r.check(await count() === before, `呼叫兩次，open 事件一列都沒多（${before}）`)

  r.section('換了照片：回傳新的路徑，不是分享當下的')
  const newPath = `${A}/${bean}.jpg`
  await pg.exec(`update beans set photo_path = '${newPath}' where id = '${bean}'`)
  r.check(await photoPath(withPhoto.code) === newPath, '跟著豆子目前的照片')
  await pg.exec(`update beans set photo_path = '${path}' where id = '${bean}'`)

  r.section('匿名的人對 storage 仍然沒有任何路')
  const storagePolicies = await pg.rows(`select policyname, roles from pg_policies
    where schemaname = 'storage' and tablename = 'objects'`)
  r.check(storagePolicies.length > 0 && storagePolicies.every(p => [p.roles].flat().join(',').replace(/[{}]/g, '') === 'authenticated'),
    `storage.objects 的 policy 全部只給 authenticated（${storagePolicies.length} 條）`)
  const bucket = (await pg.rows(`select public from storage.buckets where id = 'bean-photos'`))[0]
  r.check(bucket.public === false, 'bean-photos 仍然是 private')
  const anonTables = await pg.rows(`select table_name from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'
      and table_name in ('brews', 'brew_steps', 'beans', 'user_equipment', 'brew_flavor_tags', 'brew_shares', 'brew_share_events')`)
  r.check(anonTables.length === 0, `anon 對存著紀錄內容的表仍然沒有任何 privilege（${anonTables.length}）`)

  // ── 伺服器端的流程接到這個資料庫上 ──────────────────────────────
  const SECRET = 'test-secret'
  const bytes = new Uint8Array([1, 2, 3])
  const thumbBytes = new Uint8Array([4])
  const store = {
    photoPath: code => photoPath(code),
    download: async p => (p === path ? { bytes, type: 'image/webp' } : p === beanThumbPath(path) ? { bytes: thumbBytes, type: 'image/webp' } : null),
  }
  const now = 1_790_000_000
  const params = url => Object.fromEntries(new URL(url, 'https://x.test').searchParams)
  const noLeak = url => typeof url === 'string' && !url.includes(A) && !url.includes(bean) && !url.includes('.webp') && !url.includes('.thumb')

  r.section('從頭到尾：有效的分享')
  const urls = await resolveSharedPhotoUrls(store, SECRET, withPhoto.code, now)
  r.check(noLeak(urls.thumb) && noLeak(urls.full), '縮圖與原圖的網址裡都沒有儲存路徑、user_id、bean_id')
  r.check((await loadSharedPhoto(store, SECRET, withPhoto.code, params(urls.thumb), now + 1))?.bytes === thumbBytes, '縮圖網址拿到縮圖')
  r.check((await loadSharedPhoto(store, SECRET, withPhoto.code, params(urls.full), now + 1))?.bytes === bytes, '原圖網址拿到原圖')

  r.section('從頭到尾：無效的代碼')
  const fake = generateShareCode()
  const fakeUrls = await resolveSharedPhotoUrls(store, SECRET, fake, now)
  r.check(fakeUrls.thumb === null && fakeUrls.full === null, '不存在的代碼：拿不到網址')
  r.check(await loadSharedPhoto(store, SECRET, fake, params(urls.thumb), now + 1) === null, '拿別人的簽章配不存在的代碼：拿不到圖片')

  r.section('從頭到尾：網址發出去之後，紀錄被刪除')
  await pg.as(A)
  await pg.exec(`delete from brews where id = '${withPhoto.brew}'`)
  await pg.asSuperuser()
  r.check(await loadSharedPhoto(store, SECRET, withPhoto.code, params(urls.thumb), now + 1) === null
    && await loadSharedPhoto(store, SECRET, withPhoto.code, params(urls.full), now + 1) === null,
  '網址還沒過期，但縮圖與原圖都拿不到')
  r.check((await resolveSharedPhotoUrls(store, SECRET, withPhoto.code, now + 2)).thumb === null, '重新開啟：拿不到網址')

  r.section('從頭到尾：豆子被刪除（紀錄跟著 cascade）')
  const other = await share(bean)
  const second = await resolveSharedPhotoUrls(store, SECRET, other.code, now)
  r.check(second.thumb !== null, '前提：刪除之前拿得到')
  await pg.as(A)
  await pg.exec(`delete from beans where id = '${bean}'`)
  await pg.asSuperuser()
  r.check(await loadSharedPhoto(store, SECRET, other.code, params(second.thumb), now + 1) === null, '刪除之後拿不到圖片')

  await pg.close()
  return r.finish()
}
