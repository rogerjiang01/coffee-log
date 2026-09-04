<script setup lang="ts">
// 器材管理（《02-功能規格》§3：列表、新增、設定預設）。
//
// 規格的頁面清單只有 /equipment 一條路由，因此新增與編輯都在這一頁內完成，
// 不另開 /equipment/new 與 /equipment/[id]。

interface EquipmentRow {
  id: string
  catalog_id: string | null
  type: EquipmentType
  custom_name: string | null
  is_default: boolean
  note: string | null
  equipment_catalog: { brand: string; model: string; variant: string | null } | null
}

const supabase = useSupabaseClient()
const userId = useCurrentUserId()

const items = ref<EquipmentRow[]>([])
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')

// null = 沒在編輯；'new' = 新增；其餘為該筆 id
const editing = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
const confirmId = ref<string | null>(null)
const deleting = ref(false)

const form = reactive({
  type: 'grinder' as EquipmentType,
  catalog_id: null as string | null,
  custom_name: '',
  note: '',
  is_default: false,
})
const selectedCatalog = ref<CatalogRow | null>(null)

const scaleSpec = computed<GrindScaleSpec>(() => {
  const c = selectedCatalog.value
  if (!c) return emptyGrindScale
  return {
    min: c.grind_scale_min,
    max: c.grind_scale_max,
    increment: c.grind_scale_increment,
    suggestedMin: c.grind_scale_suggested_min,
    suggestedMax: c.grind_scale_suggested_max,
    note: c.grind_scale_note,
  }
})

function displayName(row: EquipmentRow) {
  if (row.equipment_catalog) {
    const c = row.equipment_catalog
    return `${c.brand} ${c.model}${c.variant ? ` ${c.variant}` : ''}`
  }
  return row.custom_name ?? '未命名器材'
}

const grouped = computed(() =>
  equipmentTypes
    .map(type => ({ type, rows: items.value.filter(item => item.type === type) }))
    .filter(group => group.rows.length > 0),
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    // 排序寫死：預設器材在前，再依建立時間，最後用 id 當決勝鍵
    const { data, error } = await supabase
      .from('user_equipment')
      .select('id, catalog_id, type, custom_name, is_default, note, equipment_catalog ( brand, model, variant )')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    items.value = (data ?? []) as unknown as EquipmentRow[]
  }
  catch (e) {
    loadError.value = e instanceof Error ? `讀不到器材：${e.message}` : '讀不到器材'
  }
  finally {
    // 放在 finally，任何失敗都不會讓頁面停在讀取中而看不到新增入口
    loading.value = false
  }
}

onMounted(load)

function startCreate() {
  editing.value = 'new'
  formError.value = ''
  selectedCatalog.value = null
  Object.assign(form, { type: 'grinder', catalog_id: null, custom_name: '', note: '', is_default: false })
}

function startEdit(row: EquipmentRow) {
  editing.value = row.id
  formError.value = ''
  selectedCatalog.value = null
  Object.assign(form, {
    type: row.type,
    catalog_id: row.catalog_id,
    custom_name: row.custom_name ?? '',
    note: row.note ?? '',
    is_default: row.is_default,
  })
}

function cancel() {
  editing.value = null
  formError.value = ''
}

/**
 * 每個類型只能有一個預設（DB 有 partial unique index）。
 * 先把同類型的既有預設清掉再設新的，否則會撞上唯一約束，
 * 把資料庫層的錯誤訊息丟到使用者面前。
 */
async function clearDefault(type: EquipmentType, exceptId?: string) {
  if (!userId.value) return
  let request = supabase
    .from('user_equipment')
    .update({ is_default: false } as never)
    .eq('user_id', userId.value)
    .eq('type', type)
    .eq('is_default', true)
  if (exceptId) request = request.neq('id', exceptId)
  const { error } = await request
  if (error) throw new Error(error.message)
}

async function save() {
  if (!userId.value) {
    formError.value = '登入狀態好像過期了，重新登入一次再試'
    return
  }
  // 型錄與自訂名稱至少要有一個（DB 的 name_or_catalog check 也擋，
  // 但不該讓使用者看到資料庫的錯誤訊息）
  if (!form.catalog_id && !form.custom_name.trim()) {
    formError.value = '選一個型號，或自己打一個名字'
    return
  }

  saving.value = true
  formError.value = ''
  try {
    if (form.is_default) await clearDefault(form.type, editing.value === 'new' ? undefined : editing.value!)

    const row = {
      user_id: userId.value,
      type: form.type,
      catalog_id: form.catalog_id,
      custom_name: form.catalog_id ? null : form.custom_name.trim(),
      note: form.note.trim() || null,
      is_default: form.is_default,
    }

    const { error } = editing.value === 'new'
      ? await supabase.from('user_equipment').insert(row as never)
      : await supabase.from('user_equipment').update(row as never).eq('id', editing.value!)
    if (error) throw new Error(error.message)

    editing.value = null
    await load()
  }
  catch (e) {
    formError.value = e instanceof Error ? `沒有存起來：${e.message}` : '沒有存起來'
  }
  finally {
    saving.value = false
  }
}

/** 列表上直接切換預設 */
async function toggleDefault(row: EquipmentRow, next: boolean) {
  actionError.value = ''
  try {
    if (next) await clearDefault(row.type, row.id)
    const { error } = await supabase
      .from('user_equipment')
      .update({ is_default: next } as never)
      .eq('id', row.id)
    if (error) throw new Error(error.message)
    await load()
  }
  catch (e) {
    actionError.value = e instanceof Error ? `沒有改成功：${e.message}` : '沒有改成功'
  }
}

async function destroy() {
  if (!confirmId.value) return
  deleting.value = true
  const { error } = await supabase.from('user_equipment').delete().eq('id', confirmId.value)
  deleting.value = false
  confirmId.value = null
  if (error) {
    actionError.value = `沒有刪成功：${error.message}`
    return
  }
  await load()
}

const inputStyle = {
  minHeight: '44px',
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-32" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">器材</h1>
      <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </div>

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>
    <p v-if="actionError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ actionError }}
    </p>

    <!-- 新增／編輯表單。與豆子、沖煮表單同一套分組卡片。 -->
    <div v-if="editing" class="mt-6">
      <FormCard :title="editing === 'new' ? '新增器材' : '編輯器材'">
        <FormRow>
          <label class="block text-sm" for="equipment-type">
            類型
            <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
            <span class="sr-only">必填</span>
          </label>
          <SelectField>
            <select
              id="equipment-type"
              v-model="form.type"
              class="mt-1 block w-full field py-2.5"
              :style="inputStyle"
            >
              <option v-for="type in equipmentTypes" :key="type" :value="type">
                {{ equipmentLabels[type] }}
              </option>
            </select>
          </SelectField>
        </FormRow>

        <FormRow>
          <CatalogSelect
            v-model="form.catalog_id"
            :type="form.type"
            @selected="selectedCatalog = $event"
          />
          <!-- 型錄存在的唯一目的是讓刻度這個數字可以被正確解讀（§3.2） -->
          <div
            v-if="form.type === 'grinder' && selectedCatalog"
            class="mt-3 rounded-sm px-3 py-3 text-sm"
            :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }"
          >
            <p v-if="isFreeformScale(scaleSpec)">這台面板沒有刻度標示，刻度可自由填寫。</p>
            <template v-else>
              <p class="tabular-nums">
                刻度範圍 {{ grindScaleRangeLabel(scaleSpec) }}
                <span v-if="scaleSpec.increment !== null" class="ml-3">最小間隔 {{ scaleSpec.increment }}</span>
                <span v-else class="ml-3">連續無段</span>
              </p>
              <p v-if="grindScaleSuggestionLabel(scaleSpec)" class="mt-1 tabular-nums">
                {{ grindScaleSuggestionLabel(scaleSpec) }}
              </p>
            </template>
            <p v-if="scaleSpec.note" class="mt-1">{{ scaleSpec.note }}</p>
          </div>
        </FormRow>

        <FormRow>
          <label class="block text-sm" for="equipment-name">
            自訂名稱
            <span v-if="!form.catalog_id" :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
            <span v-if="!form.catalog_id" class="sr-only">必填</span>
          </label>
          <input
            id="equipment-name"
            v-model="form.custom_name"
            type="text"
            :disabled="!!form.catalog_id"
            class="mt-1 block w-full field py-2.5 disabled:opacity-60"
            :style="inputStyle"
          >
          <p class="mt-1 text-xs text-muted">
            {{ form.catalog_id ? '已選型號，用型錄的名稱' : '型錄裡沒有的機器就打在這裡' }}
          </p>
        </FormRow>

        <FormRow>
          <label class="block text-sm" for="equipment-note">備註</label>
          <input
            id="equipment-note"
            v-model="form.note"
            type="text"
            class="mt-1 block w-full field py-2.5"
            :style="inputStyle"
          >
          <p class="mt-1 text-xs text-muted">換刀盤、加裝配件這類個體差異記在這裡</p>
        </FormRow>

        <FormRow>
          <ToggleSwitch v-model="form.is_default" label="設為這個類型的預設" />
        </FormRow>
      </FormCard>

      <button
        type="button"
        :disabled="saving"
        class="mt-4 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: '44px' }"
        @click="save"
      >
        {{ saving ? '儲存中' : '儲存' }}
      </button>

      <p v-if="formError" role="alert" class="mt-3 rounded-sm border px-3 py-3 text-sm" :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }">
        {{ formError }}
      </p>

      <button
        type="button"
        class="mt-3 w-full rounded-sm border px-4 py-3"
        :style="{ borderColor: 'var(--border)', minHeight: '44px' }"
        @click="cancel"
      >
        取消
      </button>
    </div>

    <div v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 space-y-6">
      <section v-for="n in 2" :key="n">
        <SkeletonBlock width="4rem" height="0.875rem" />
        <div class="mt-3 space-y-3">
          <SkeletonBlock v-for="row in 2" :key="row" height="3.5rem" radius="4px" />
        </div>
      </section>
    </div>

    <p v-else-if="!items.length && !loadError" class="mt-6 text-muted">
      設定常用器材，之後新增紀錄時會自動帶入。
    </p>

    <div v-else class="mt-6 space-y-6">
      <section v-for="group in grouped" :key="group.type">
        <h2 class="text-sm text-muted">{{ equipmentLabels[group.type] }}</h2>
        <ul class="mt-2 space-y-3">
          <li
            v-for="row in group.rows"
            :key="row.id"
            class="rounded-md border p-4"
            :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
          >
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="min-w-0 flex-1 truncate font-medium">{{ displayName(row) }}</h3>
              <button
                type="button"
                class="shrink-0 text-sm underline"
                :style="{ color: 'var(--accent)' }"
                @click="startEdit(row)"
              >
                編輯
              </button>
            </div>

            <p v-if="row.note" class="mt-1 text-sm text-muted">{{ row.note }}</p>

            <div class="mt-3">
              <ToggleSwitch
                :model-value="row.is_default"
                label="預設"
                @update:model-value="toggleDefault(row, $event)"
              />
            </div>

            <button
              type="button"
              class="mt-3 text-sm"
              :style="{ color: 'var(--danger)' }"
              @click="confirmId = row.id"
            >
              刪除
            </button>
          </li>
        </ul>
      </section>
    </div>

    <NuxtLink
      to="#"
      aria-label="新增器材"
      class="fixed right-5 bottom-20 z-30 flex size-14 items-center justify-center rounded-lg"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--overlay-shadow)' }"
      @click.prevent="startCreate"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </NuxtLink>

    <ConfirmDialog
      :open="confirmId !== null"
      title="刪除這個器材？"
      body="刪掉之後沒辦法復原。已經記錄過的沖煮不會消失，只是那筆紀錄上的器材欄位會變成空的。"
      confirm-label="刪除這個器材"
      :busy="deleting"
      @cancel="confirmId = null"
      @confirm="destroy"
    />

    <BottomNav />
  </main>
</template>
