// 每週記錄目標與總覽卡片（utils/weeklyGoal.ts、utils/dashboard.ts，《02》§4）。
//
// 週一開始、瀏覽器的本地時間。日期一律用本地時間的建構式寫，不寫 UTC 字串，
// 測試在哪個時區跑都一樣。

import {
  GOAL_DEFAULT, GOAL_MAX, GOAL_MIN, clampGoal, currentGoal, goalForWeek, monthRange, needsGoalSetup,
  ringLaps, weekEnd, weekStart, weekdayIndex,
} from '../../utils/weeklyGoal.ts'
import { lastBeanCard, monthCard, recordCount, summaryRing, totalsCard, weekCard, weekTopCard, type StatBrew } from '../../utils/dashboard.ts'
import { createReport } from '../helpers/report.mjs'

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min)
const iso = (date: Date) => date.toISOString()
const goal = (cups: number, date: Date) => ({ cups, created_at: iso(date) })

// 2026-10-05 是週一
const MON = at(2026, 10, 5)
const WED = at(2026, 10, 7, 20)
const SUN = at(2026, 10, 11, 23, 59)

let n = 0
function brew(date: Date, over: Partial<StatBrew> = {}): StatBrew {
  n++
  return {
    id: `r${String(n).padStart(3, '0')}`, bean_id: 'b1', brewed_at: iso(date), rating: null, dose: 15, is_sample: false,
    beans: { name: '耶加雪菲', photo_path: null, roast_level: 'light', is_finished: false },
    ...over,
  }
}

export default function run() {
  const r = createReport('每週記錄目標與總覽卡片')

  r.section('週一開始')
  r.check(weekStart(WED).getTime() === MON.setHours(0, 0, 0, 0) && weekStart(WED).getDay() === 1, '週三 → 那一週的週一 00:00')
  r.check(weekStart(SUN).getTime() === at(2026, 10, 5, 0).getTime(), '週日 23:59 仍屬於同一週（週日是最後一天）')
  r.check(weekStart(at(2026, 10, 12, 0, 0)).getTime() === at(2026, 10, 12, 0).getTime(), '下週一 00:00 是新的一週')
  r.check(weekEnd(WED).getTime() === at(2026, 10, 12, 0).getTime(), '週的結束是下週一 00:00')
  r.check(weekStart(at(2026, 1, 1)).getTime() === at(2025, 12, 29, 0).getTime(), '跨年：2026/1/1（週四）屬於 2025/12/29 那一週')
  r.check(weekdayIndex(at(2026, 10, 5)) === 0 && weekdayIndex(at(2026, 10, 11)) === 6, '週一是第 0 天、週日是第 6 天')
  const [from, to] = monthRange(WED)
  r.check(from.getTime() === at(2026, 10, 1, 0).getTime() && to.getTime() === at(2026, 11, 1, 0).getTime(), '本月：1 日到下個月 1 日')

  r.section('目前的目標＝最新的一列')
  const history = [goal(3, at(2026, 9, 1)), goal(5, at(2026, 9, 20)), goal(7, at(2026, 10, 7, 12))]
  r.check(currentGoal([]) === null, '沒有任何目標：null')
  r.check(currentGoal(history) === 7, '最新的一列')
  r.check(currentGoal([...history].reverse()) === 7, '不依陣列順序，依建立時間')

  r.section('某一週的目標＝那一週結束前最後一次修改的值')
  r.check(goalForWeek(history, WED) === 7, '本週中途改成 7：本週立刻是 7')
  r.check(goalForWeek(history, at(2026, 10, 6)) === 7, '同一週的任何一天都是 7（看的是週結束前，不是那一天之前）')
  r.check(goalForWeek(history, at(2026, 9, 30)) === 5, '上一週：5（那一週結束前最後一次是 9/20 的 5）')
  r.check(goalForWeek(history, at(2026, 9, 10)) === 3, '9/7 那一週：3')
  r.check(goalForWeek(history, at(2026, 8, 20)) === null, '第一次設定之前的週：null，不拿之後的值回推')
  r.check(goalForWeek([goal(4, at(2026, 10, 12, 0, 0))], WED) === null, '下週一 00:00 才設的：不算本週')
  r.check(goalForWeek([goal(4, at(2026, 10, 11, 23, 59))], WED) === 4, '週日 23:59 設的：算本週')

  r.section('杯數 1–21，預設 3')
  r.check(GOAL_MIN === 1 && GOAL_MAX === 21 && GOAL_DEFAULT === 3, '範圍與預設')
  r.check(clampGoal(0) === 1 && clampGoal(22) === 21 && clampGoal(5) === 5, '超出範圍時夾在邊界')

  r.section('目標環的兩圈')
  r.check(JSON.stringify(ringLaps(0, 3)) === JSON.stringify({ first: 0, second: 0 }), '0 杯：空的')
  r.check(ringLaps(3, 3).first === 1 && ringLaps(3, 3).second === 0, '剛好達成：第一圈滿')
  r.check(ringLaps(4, 3).first === 1 && Math.abs(ringLaps(4, 3).second - 1 / 3) < 1e-9, '超過：第二圈畫出超出的部分')
  r.check(ringLaps(10, 3).second === 1, '第二圈最多一圈')

  r.section('目標設定頁的出現時機')
  r.check(needsGoalSetup('/', true, false), '已登入、沒有目標：導向目標設定頁')
  r.check(!needsGoalSetup('/', true, true), '已經有目標：不導向')
  r.check(!needsGoalSetup('/', true, null), '還不知道有沒有（查詢中或失敗）：不擋')
  r.check(!needsGoalSetup('/', false, false), '沒登入：不導向（交給登入導向）')
  r.check(!needsGoalSetup('/s/abc', true, false), '分享頁不受影響')
  r.check(!needsGoalSetup('/goal', true, false), '目標設定頁本身不導向')
  r.check(!needsGoalSetup('/login', true, false) && !needsGoalSetup('/signup', true, false), '登入、註冊頁不導向')
  r.check(needsGoalSetup('/brews/new', true, false) && needsGoalSetup('/settings', true, false), '其他頁面都導向')

  r.section('目標環卡片')
  const week = [brew(MON), brew(WED), brew(WED), brew(SUN), brew(at(2026, 10, 4, 23)), brew(at(2026, 10, 12, 0, 1))]
  const card = weekCard(week, history, WED)
  r.check(card?.count === 4 && card.goal === 7, `本週 4 杯（上週日與下週一不算）：${card?.count}`)
  r.check(card?.days.join() === '1,0,2,0,0,0,1', `每日長條：${card?.days.join()}`)
  r.check(weekCard([], [goal(3, MON)], WED)?.count === 0, '有目標就顯示，0 杯也顯示')
  r.check(weekCard(week, [], WED) === null, '沒有目標：不顯示')
  r.check(weekCard([brew(WED, { is_sample: true })], [goal(3, MON)], WED)?.count === 0, '範例紀錄不算')

  r.section('上一杯')
  const finished = { name: '已喝完的豆子', photo_path: null, roast_level: null, is_finished: true }
  const b2 = { name: '肯亞', photo_path: 'u/b2.jpg', roast_level: 'medium' as const, is_finished: false }
  const last = lastBeanCard([
    brew(MON), brew(WED, { bean_id: 'b2', beans: b2 }), brew(SUN, { bean_id: 'b3', beans: finished }),
    brew(at(2026, 10, 8), { bean_id: 'b2', beans: b2 }), brew(SUN, { bean_id: 'b2', is_sample: true, beans: b2 }),
  ])
  r.check(last?.beanId === 'b2' && last.bean.name === '肯亞', '未喝完的豆子裡最近一筆所屬的豆子（已喝完的、範例紀錄都跳過）')
  r.check(last?.count === 2, `第 N 杯＝這支豆子的紀錄數，不含範例：${last?.count}`)
  r.check(lastBeanCard([brew(WED, { bean_id: 'b3', beans: finished })]) === null, '只有已喝完的豆子：不顯示')
  r.check(lastBeanCard([brew(WED, { is_sample: true })]) === null, '只有範例紀錄：不顯示')

  r.section('本週最高分')
  const t1 = brew(MON, { rating: 4 })
  const t2 = brew(WED, { rating: 4 })
  const t3 = brew(at(2026, 10, 6), { rating: 3 })
  r.check(weekTopCard([t1, t2, t3], SUN)?.id === t2.id, '同分取最近的一筆')
  r.check(weekTopCard([t1, t3, brew(at(2026, 10, 1), { rating: 5 })], SUN)?.id === t1.id, '上週的 5 星不算（以沖煮日期計算）')
  r.check(weekTopCard([brew(WED)], SUN) === null, '本週沒有任何有評分的紀錄：不顯示')
  r.check(weekTopCard([brew(WED, { rating: 5, is_sample: true }), t3], SUN)?.id === t3.id, '範例紀錄不算')

  r.section('累計')
  r.check(JSON.stringify(totalsCard([brew(MON), brew(WED), brew(WED, { bean_id: 'b2' }), brew(SUN, { is_sample: true, bean_id: 'b9' })]))
    === JSON.stringify({ records: 3, beans: 2 }), 'N 筆紀錄、喝過 N 支豆子（有紀錄的豆子數），不含範例')
  r.check(totalsCard([]) === null && totalsCard([brew(WED, { is_sample: true })]) === null, '0 筆：不顯示')
  r.check(recordCount([brew(MON), brew(WED, { is_sample: true })]) === 1, '第 N 筆紀錄：不含範例')

  r.section('本月')
  const month = monthCard([brew(at(2026, 10, 1, 0, 0), { dose: 15.1 }), brew(WED, { dose: 15.2 }), brew(WED, { dose: null }),
    brew(at(2026, 9, 30, 23, 59), { dose: 99 }), brew(WED, { dose: 50, is_sample: true })], WED)
  r.check(month?.cups === 3 && month.dose === 30.3, `本月 3 杯、30.3 g（9/30 與範例不算；沒填粉重算 0）：${month?.cups} 杯 ${month?.dose} g`)
  r.check(monthCard([brew(at(2026, 9, 30))], WED) === null, '本月 0 杯：不顯示')

  r.section('結算頁的目標環')
  const goals3 = [goal(3, at(2026, 9, 1))]
  const crossing = [brew(MON), brew(WED)]
  const newest = brew(at(2026, 10, 8))
  const ring = summaryRing([...crossing, newest], goals3, newest.id, at(2026, 10, 8, 10))
  r.check(ring?.before === 2 && ring.after === 3 && ring.crossed, '2 → 3／3：剛好跨過目標')
  const beyond = brew(at(2026, 10, 9))
  const over = summaryRing([...crossing, newest, beyond], goals3, beyond.id, at(2026, 10, 9, 10))
  r.check(over?.before === 3 && over.after === 4 && !over.crossed, '已經達成之後：照樣前進，不算跨過')
  const early = summaryRing([brew(MON), newest], goals3, newest.id, at(2026, 10, 8, 10))
  r.check(early?.after === 2 && !early.crossed, '還沒達成：不算跨過')
  const old = brew(at(2026, 9, 28))
  r.check(summaryRing([old], goals3, old.id, WED) === null, '這一筆的沖煮日期不在本週：不顯示環')
  r.check(summaryRing([newest], [], newest.id, WED) === null, '沒有目標：不顯示環')

  return r.finish()
}
