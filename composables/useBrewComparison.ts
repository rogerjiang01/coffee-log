/**
 * 「和 M/D 那一杯相比」（《02》§7）：紀錄詳情與結算頁共用。
 * 比較對象怎麼選見 utils/compareTarget.ts；差異見 utils/brewDiff.ts。
 *
 * 查詢次數：同一支豆子的紀錄只要 id 與沖煮日期（輕量），選出對象之後，
 * 對象那一筆與它的分段一起要。這一筆自己的欄位與分段由呼叫端給，不重抓。
 */

export const COMPARE_SELECT = `
  id, bean_id, brewed_at, rating, copied_from_brew_id,
  brew_method_id, grinder_id, dripper_id, kettle_id,
  dose, water_temp, grind_setting, total_time,
  brew_methods ( name ),
  grinder:grinder_id ( custom_name, equipment_catalog ( brand, model, variant ) ),
  dripper:dripper_id ( custom_name, equipment_catalog ( brand, model, variant ) ),
  kettle:kettle_id ( custom_name, equipment_catalog ( brand, model, variant ) )
`

type EquipmentNameRow = { custom_name: string | null, equipment_catalog: { brand: string, model: string, variant: string | null } | null }

export function toDiffSubject(row: Record<string, unknown>, steps: StepRow[]): DiffSubject {
  const equipmentName = (value: unknown) => (value ? equipmentOptionName(value as EquipmentNameRow) : null)
  return {
    dose: (row.dose as number | null) ?? null,
    water_temp: (row.water_temp as number | null) ?? null,
    grind_setting: (row.grind_setting as number | null) ?? null,
    total_time: (row.total_time as number | null) ?? null,
    grinder_id: (row.grinder_id as string | null) ?? null,
    dripper_id: (row.dripper_id as string | null) ?? null,
    kettle_id: (row.kettle_id as string | null) ?? null,
    brew_method_id: (row.brew_method_id as string | null) ?? null,
    grinderName: equipmentName(row.grinder),
    dripperName: equipmentName(row.dripper),
    kettleName: equipmentName(row.kettle),
    methodName: (row.brew_methods as { name: string } | null)?.name ?? null,
    steps,
  }
}

export interface Comparison {
  /** 比較對象；null 是沒有比較對象（這支豆子的第一杯） */
  target: { id: string, brewed_at: string, rating: number | null } | null
  /** 參數的差異 */
  diffs: BrewDiff[]
  /** 評分那一列：兩邊都有評分才有 */
  rating: BrewDiff | null
}

export function useBrewComparison() {
  const supabase = useSupabaseClient()

  return async function compare(
    brew: { id: string, bean_id: string | null, brewed_at: string, copied_from_brew_id: string | null, rating: number | null } & Record<string, unknown>,
    ownSteps: StepRow[],
  ): Promise<Comparison> {
    let targetId = brew.copied_from_brew_id
    if (!targetId && brew.bean_id) {
      const { data, error } = await supabase.from('brews').select('id, bean_id, brewed_at').eq('bean_id', brew.bean_id)
      if (error) throw toError(error)
      targetId = compareTargetId(brew, (data ?? []) as unknown as CompareCandidate[])
    }
    if (!targetId) return { target: null, diffs: [], rating: null }

    const [targetResult, stepResult] = await Promise.all([
      supabase.from('brews').select(COMPARE_SELECT).eq('id', targetId).maybeSingle(),
      supabase.from('brew_steps')
        .select('step_index, hold_seconds, cumulative_water, step_type, note')
        .eq('brew_id', targetId).order('step_index'),
    ])
    if (targetResult.error) throw toError(targetResult.error)
    const target = targetResult.data as unknown as Record<string, unknown> | null
    // 複製來源在這之間被刪掉了：當作沒有比較對象
    if (!target) return { target: null, diffs: [], rating: null }

    return {
      target: { id: target.id as string, brewed_at: target.brewed_at as string, rating: (target.rating as number | null) ?? null },
      diffs: computeBrewDiff(toDiffSubject(brew, ownSteps), toDiffSubject(target, (stepResult.data ?? []) as unknown as StepRow[])),
      rating: ratingDiff(target.rating as number | null, brew.rating),
    }
  }
}
