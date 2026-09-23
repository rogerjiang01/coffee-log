// 新使用者的範例資料（《01》§13、《02》§9）。
//
// 三件事最容易出錯：
//   一、範例建立失敗不可以讓註冊失敗——使用者連進都進不來，比少三筆範例嚴重得多
//   二、只建立一次。刪掉之後不會再冒出來，依據是「建立過沒有」不是「現在還有沒有」
//   三、範例是使用者自己的資料：編輯、刪除都照常，標記不因編輯而消失

import { createDatabase } from '../helpers/pg.mjs'
import { stepsFromTemplate } from '../../utils/brewSteps.ts'
import { createReport, equal } from '../helpers/report.mjs'

export default async function run() {
  const r = createReport('新使用者的範例資料')
  const pg = await createDatabase()
  const A = await pg.createUser('sample-a@test')
  await pg.asSuperuser()

  r.section('註冊之後就有三筆')
  const equipment = await pg.rows(`select catalog_id, type, is_default, is_sample from user_equipment where user_id='${A}'`)
  const beans = await pg.rows(`select id, name, roaster, roast_date, roast_level, region, official_notes, is_sample,
    country_id, processing_method_id, variety_id from beans where user_id='${A}'`)
  const brews = await pg.rows(`select id, dose, water_temp, grind_setting, total_time, rating, intensity,
    tasting_notes, is_sample, bean_id, grinder_id, brew_method_id,
    form_duration_seconds, params_duration_seconds, tasting_duration_seconds
    from brews where user_id='${A}'`)
  r.check(equipment.length === 1 && beans.length === 1 && brews.length === 1, '一台磨豆機、一支豆子、一筆紀錄')
  r.check(equipment[0].is_sample && beans[0].is_sample && brews[0].is_sample, '三筆都標成範例')
  r.check((await pg.rows(`select sample_seeded from profiles where id='${A}'`))[0].sample_seeded === true,
    'profiles 記下建立過了')

  r.section('內容接得上型錄與查表')
  r.check(equipment[0].type === 'grinder' && equipment[0].catalog_id !== null, '磨豆機對到型錄，不是自建名稱')
  const catalog = (await pg.rows(`select brand, model, grind_scale_min, grind_scale_max, grind_scale_increment,
    grind_scale_suggested_min, grind_scale_suggested_max from equipment_catalog where id='${equipment[0].catalog_id}'`))[0]
  r.check(catalog.grind_scale_min !== null && catalog.grind_scale_max !== null
    && catalog.grind_scale_increment !== null && catalog.grind_scale_suggested_min !== null,
    `範例磨豆機的刻度資料完整（${catalog.brand} ${catalog.model}）——範例紀錄的刻度才有脈絡可讀`)
  r.check(Number(brews[0].grind_setting) >= Number(catalog.grind_scale_suggested_min)
    && Number(brews[0].grind_setting) <= Number(catalog.grind_scale_suggested_max),
    `範例的刻度 ${brews[0].grind_setting} 落在型錄的建議範圍內`)
  r.check(beans[0].country_id !== null && beans[0].processing_method_id !== null && beans[0].variety_id !== null,
    '豆子的產國、處理法、品種都對到系統項目')
  r.check(brews[0].bean_id === beans[0].id, '範例紀錄用的是範例豆子')
  r.check(brews[0].grinder_id !== null, '也用了範例磨豆機')
  r.check(brews[0].brew_method_id !== null, '套用了一個內建手法')

  r.section('養豆天數看起來合理')
  const restDays = (await pg.rows(`select (current_date - roast_date) d from beans where id='${beans[0].id}'`))[0].d
  r.check(restDays > 0 && restDays <= 30, `烘焙日期在註冊日之前 ${restDays} 天`)

  r.section('分段注水與手法模板一致')
  const method = (await pg.rows(`select name, default_ratio, step_template from brew_methods where id='${brews[0].brew_method_id}'`))[0]
  const steps = await pg.rows(`select step_index, cumulative_water, hold_seconds, step_type, note
    from brew_steps where brew_id='${brews[0].id}' order by step_index`)
  const expected = stepsFromTemplate(method.step_template, Number(brews[0].dose), Number(method.default_ratio))
  r.check(equal(steps.map(s => Number(s.cumulative_water)), expected.steps.map(s => s.cumulativeWater)),
    `累積水量就是「${method.name}」套 ${brews[0].dose}g 算出來的：${steps.map(s => s.cumulative_water).join('／')}`)
  r.check(equal(steps.map(s => s.hold_seconds), expected.steps.map(s => s.holdSeconds)),
    `停水秒數同上，最後一段是 null：${steps.map(s => s.hold_seconds).join('／')}`)
  r.check(steps[0].step_type === 'bloom', '第一段是悶蒸')

  r.section('品飲區不是空的')
  r.check(brews[0].intensity !== null && Object.keys(brews[0].intensity).length === 4, '四個強度維度都有值')
  r.check(brews[0].rating !== null, '有評分')
  const tags = await pg.rows(`select t.name from brew_flavor_tags bt join flavor_tags t on t.id=bt.flavor_tag_id
    where bt.brew_id='${brews[0].id}'`)
  r.check(tags.length >= 2, `有 ${tags.length} 個風味標籤`)
  r.check(/範例/.test(brews[0].tasting_notes) && /照上次再沖一次/.test(brews[0].tasting_notes),
    '心得筆記說明這是範例、可以刪除，並指出複製的入口')

  r.section('範例不進統計')
  r.check(brews[0].form_duration_seconds === null && brews[0].params_duration_seconds === null
    && brews[0].tasting_duration_seconds === null, '三個耗時欄位都留空——範例不是使用者記的')
  r.check((await pg.rows(`select count(*)::int n from brew_save_events where brew_id='${brews[0].id}'`))[0].n === 0,
    '不寫 brew_save_events：那張表記的是「使用者按了儲存」')

  r.section('範例器材不設為常用')
  r.check(equipment[0].is_default === false, '常用會自動帶入每一張新表單，那是使用者自己的選擇')

  r.section('使用者可以編輯自己的範例')
  await pg.as(A)
  r.check((await pg.query(`update beans set name='我改過的豆名' where id='${beans[0].id}'`)).affectedRows === 1,
    '改得動範例豆子')
  r.check((await pg.rows(`select is_sample from beans where id='${beans[0].id}'`))[0].is_sample === true,
    '**改過之後仍然是範例**——「改過就變成真的」使用者猜不到，規則要能預測')

  r.section('從範例複製出來的是真實紀錄')
  const copy = (await pg.rows(`insert into brews (user_id, bean_id, dose, copied_from_brew_id)
    values ('${A}','${beans[0].id}',15,'${brews[0].id}') returning id, is_sample`))[0]
  r.check(copy.is_sample === false, '複製出來的不帶範例標記——那杯是使用者自己沖的')
  await pg.exec(`delete from brews where id='${copy.id}'`)

  r.section('刪掉範例之後不會重建')
  // 豆子底下還有範例紀錄：刪豆子會連帶刪掉紀錄（brews.bean_id on delete cascade），
  // 介面的刪除確認也寫明「這支豆子的 N 筆沖煮紀錄會一併刪除」
  r.check((await pg.query(`delete from beans where id='${beans[0].id}'`)).affectedRows === 1, '刪得掉範例豆子')
  await pg.asSuperuser()
  r.check((await pg.rows(`select count(*)::int n from brews where user_id='${A}'`))[0].n === 0,
    '底下的範例紀錄跟著刪掉，不留孤兒')
  r.check((await pg.rows(`select count(*)::int n from brew_steps where user_id='${A}'`))[0].n === 0, '分段也跟著刪掉')
  await pg.exec(`select public.create_sample_data('${A}')`)
  r.check((await pg.rows(`select count(*)::int n from beans where user_id='${A}'`))[0].n === 0,
    '再呼叫一次建立函式也不會重來——依據是「建立過沒有」不是「現在還有沒有」')

  r.section('既有使用者不補')
  // 改版前註冊的人：有 profile、沒有範例。模擬方式是繞過 trigger 建帳號
  await pg.exec(`alter table auth.users disable trigger on_auth_user_created`)
  const old = await pg.createUser('old@test')
  await pg.exec(`insert into profiles (id) values ('${old}')`)
  await pg.exec(`alter table auth.users enable trigger on_auth_user_created`)
  r.check((await pg.rows(`select count(*)::int n from beans where user_id='${old}'`))[0].n === 0,
    '既有使用者沒有範例——只有註冊 trigger 會呼叫建立函式，沒有任何補建流程')
  r.check((await pg.rows(`select sample_seeded from profiles where id='${old}'`))[0].sample_seeded === false,
    '他的 sample_seeded 是 false，但沒有人會因此替他建立')

  r.section('範例建立失敗，註冊照樣成功')
  // 讓建立函式必定失敗：把它依賴的型錄機型拿掉
  await pg.exec(`delete from user_equipment where catalog_id in
    (select id from equipment_catalog where brand='Timemore' and model='C2')`)
  await pg.exec(`delete from equipment_catalog where brand='Timemore' and model='C2'`)
  const C = await pg.createUser('broken@test')
  r.check((await pg.rows(`select count(*)::int n from profiles where id='${C}'`))[0].n === 1,
    '註冊成功：profile 照樣建立')
  r.check((await pg.rows(`select count(*)::int n from beans where user_id='${C}'`))[0].n === 0, '範例沒有建立')
  r.check((await pg.rows(`select sample_seeded from profiles where id='${C}'`))[0].sample_seeded === false,
    'sample_seeded 維持 false——失敗的那次不算建立過')

  await pg.close()
  return r.finish()
}
