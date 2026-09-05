<script setup lang="ts">
// 器材的全頁選擇器。
//
// 以覆蓋層實作而不是換路由：規格要求就地新增「不得跳離頁面導致已填內容
// 遺失」，沖煮表單的其他欄位必須原封不動，所以整個流程都在同一個頁面裡。
//
// 清單只做一種：使用者自己的器材。截圖裡 Beanconqueror 有個「Current」
// 分類標籤，看不出是否還有其他頁籤，就不臆測其他分類邏輯。

const props = defineProps<{
  open: boolean
  type: EquipmentType
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [string | null]
  'close': []
  'created': []
}>()

const supabase = useSupabaseClient()
const cache = useQueryCache()
const userId = useCurrentUserId()

const items = ref<EquipmentOption[]>([])
const lastUsed = ref<Map<string, string>>(new Map())
const loading = ref(true)
const loadError = ref('')

// 選擇是暫存的，按「選好了」才送出去
const draftId = ref<string | null>(null)

const mode = ref<'list' | 'create'>('list')
const form = reactive({ catalog_id: null as string | null, custom_name: '', note: '', is_default: false })
const saving = ref(false)
const formError = ref('')

const title = computed(() => `選擇${equipmentLabels[props.type]}`)

// 改用原生 <dialog> 的 showModal()：焦點鎖定、Esc 關閉、背景 inert、
// 捲動鎖定全部由瀏覽器負責。原本是 div + 手動改 body.overflow，
// 沒有焦點鎖定也沒有 Esc——鍵盤使用者一旦 tab 出去就回不來。
const dialog = ref<HTMLDialogElement | null>(null)

// immediate 不可省略：父層用 v-if 掛載這個元件，掛載時 props.open 已經
// 是 true，沒有 immediate 的話這個 watch 等的 false→true 永遠不會發生，
// load() 一次都不會被呼叫，畫面就永遠停在「讀取中」。
// 一併監看 type，直接切換器材類型時也要重新載入。
watch([() => props.open, () => props.type], ([open]) => {
  if (open) {
    draftId.value = props.modelValue
    mode.value = 'list'
    load()
  }
  // showModal() 要等 <dialog> 真的進到 DOM 才叫得動
  nextTick(() => {
    const el = dialog.value
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  })
}, { immediate: true })

async function fetchPickerData(type: string) {
  // 器材清單與「最後使用日期」都只靠 type，互不相依，一起發
  const column = `${type}_id`
  const [listResult, brewResult] = await Promise.all([
    supabase
      .from('user_equipment')
      .select('id, type, custom_name, is_default, catalog_id, equipment_catalog ( brand, model, variant, grind_scale_min, grind_scale_max, grind_scale_increment, grind_scale_suggested_min, grind_scale_suggested_max, grind_scale_note )')
      .eq('type', type)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('brews')
      .select(`${column}, brewed_at`)
      .not(column, 'is', null)
      .order('brewed_at', { ascending: false }),
  ])
  if (listResult.error) throw toError(listResult.error)

  // 最後使用日期取不到不該讓整個選擇器失敗
  const lastUsedPairs: [string, string][] = []
  const seen = new Set<string>()
  for (const row of (brewResult.data ?? []) as unknown as Record<string, string>[]) {
    const id = row[column]
    if (id && !seen.has(id)) {
      seen.add(id)
      lastUsedPairs.push([id, row.brewed_at!])
    }
  }

  return {
    items: (listResult.data ?? []) as unknown as EquipmentOption[],
    lastUsed: lastUsedPairs,
  }
}

async function load() {
  loadError.value = ''
  const type = props.type
  const { hit, settled } = cache.swr(cacheKeys.equipment(type), () => fetchPickerData(type), {
    apply: ({ items: rows, lastUsed: pairs }) => {
      items.value = rows
      lastUsed.value = new Map(pairs)
    },
    onError: (e) => { loadError.value = `讀不到器材：${errorText(e)}` },
  })
  loading.value = !hit
  await settled
  loading.value = false
}

function formatUsed(id: string) {
  const iso = lastUsed.value.get(id)
  if (!iso) return null
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `最後使用 ${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

function confirmChoice() {
  emit('update:modelValue', draftId.value)
  emit('close')
}

function startCreate() {
  mode.value = 'create'
  formError.value = ''
  Object.assign(form, { catalog_id: null, custom_name: '', note: '', is_default: false })
}

async function create() {
  if (!userId.value) {
    formError.value = SESSION_EXPIRED
    return
  }
  if (!form.catalog_id && !form.custom_name.trim()) {
    formError.value = '選一個型號，或直接填名稱'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    // 同類型只能有一個預設，先清掉既有的再設，避免撞上唯一索引
    if (form.is_default) {
      const { error } = await supabase
        .from('user_equipment')
        .update({ is_default: false } as never)
        .eq('user_id', userId.value)
        .eq('type', props.type)
        .eq('is_default', true)
      if (error) throw toError(error)
    }

    const { data, error } = await supabase
      .from('user_equipment')
      .insert({
        user_id: userId.value,
        type: props.type,
        catalog_id: form.catalog_id,
        custom_name: form.catalog_id ? null : form.custom_name.trim(),
        note: form.note.trim() || null,
        is_default: form.is_default,
      } as never)
      .select('id')
      .single()
    if (error) throw toError(error)
    if (!data) throw new Error('沒有拿到新建立的器材')

    const created = (data as unknown as { id: string }).id
    await load()
    // 新增完直接選起來，不要求使用者再點一次
    draftId.value = created
    mode.value = 'list'
    cache.invalidateAfter({ kind: 'equipment' })
    emit('created')
  }
  catch (e) {
    formError.value = `儲存失敗：${errorText(e)}`
  }
  finally {
    saving.value = false
  }
}

const inputStyle = { minHeight: 'var(--touch-min)' }
</script>

<template>
  <!-- .sheet：與對話框共用 <dialog> 的焦點鎖定與 Esc，但鋪滿視窗不置中。
       Esc 會觸發 cancel，導回 close 讓父層收掉 pickerType。 -->
  <dialog
    ref="dialog"
    class="sheet"
    :aria-label="title"
    @cancel.prevent="emit('close')"
  >
    <div class="flex flex-col" :style="{ background: 'var(--bg)' }">
      <!-- 標題列 -->
      <header
        class="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        :style="{ borderColor: 'var(--border)' }"
      >
        <button
          type="button"
          :style="{ minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' }"
          :aria-label="mode === 'create' ? '回到清單' : '返回'"
          @click="mode === 'create' ? (mode = 'list') : emit('close')"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" class="mx-auto">
            <path d="M12 4l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>

        <h2 class="flex-1 truncate font-serif text-lg font-bold">
          {{ mode === 'create' ? `新增${equipmentLabels[type]}` : title }}
        </h2>

        <button
          v-if="mode === 'list'"
          type="button"
          :style="{ minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)', color: 'var(--accent)' }"
          :aria-label="`新增${equipmentLabels[type]}`"
          @click="startCreate"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" class="mx-auto">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <!-- 清單 -->
      <div v-if="mode === 'list'" class="min-h-0 flex-1 overflow-y-auto">
        <p v-if="loadError" role="alert" class="px-5 py-4 text-sm" :style="{ color: 'var(--danger)' }">
          {{ loadError }}
        </p>
        <!-- 骨架而不是「讀取中」文字，與全站其他清單一致。
             §6 不做進場動畫，所以是靜態色塊。 -->
        <ul v-else-if="loading" aria-busy="true" aria-label="讀取中" class="px-5 py-3">
          <li v-for="n in 4" :key="n" class="flex items-center gap-3 py-3">
            <SkeletonBlock width="1.25rem" height="1.25rem" radius="999px" />
            <div class="min-w-0 flex-1">
              <SkeletonBlock width="55%" height="1rem" />
              <SkeletonBlock width="30%" height="0.75rem" class="mt-2" />
            </div>
          </li>
        </ul>
        <p v-else-if="!items.length" class="px-5 py-4 text-muted">
          還沒有{{ equipmentLabels[type] }}，按右上角的加號建一個。
        </p>

        <ul v-else class="px-3 py-2">
          <li v-for="item in items" :key="item.id">
            <label
              class="flex items-center gap-3 rounded-md px-2 py-3"
              :style="{ minHeight: 'var(--touch-min)', background: draftId === item.id ? 'var(--accent-wash)' : undefined }"
            >
              <EquipmentIcon :type="item.type" />

              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ equipmentOptionName(item) }}</span>
                <span v-if="formatUsed(item.id)" class="block text-xs tabular-nums text-muted">
                  {{ formatUsed(item.id) }}
                </span>
                <span v-else-if="item.is_default" class="block text-xs text-muted">預設器材</span>
              </span>

              <input
                type="radio"
                name="equipment-choice"
                class="size-5 shrink-0"
                :style="{ accentColor: 'var(--accent)' }"
                :checked="draftId === item.id"
                @change="draftId = item.id"
              >
            </label>
          </li>
        </ul>
      </div>

      <!-- 就地新增：留在同一個覆蓋層裡，沖煮表單完全不動 -->
      <div v-else class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <CatalogSelect v-model="form.catalog_id" :type="type" />

        <div v-if="type === 'grinder' && form.catalog_id" class="mt-3">
          <p class="text-xs text-muted">刻度規格會跟著型號一起帶進來</p>
        </div>

        <div class="mt-5">
          <label class="block text-sm" for="picker-name">
            自訂名稱
            <span v-if="!form.catalog_id" :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
            <span v-if="!form.catalog_id" class="sr-only">必填</span>
          </label>
          <input
            id="picker-name"
            v-model="form.custom_name"
            type="text"
            :disabled="!!form.catalog_id"
            class="mt-1 block w-full field px-3 py-2.5 disabled:opacity-60"
            :style="inputStyle"
          >
          <p class="mt-1 text-xs text-muted">
            {{ form.catalog_id ? '已選型號，用型錄的名稱' : '型錄裡沒有的直接填名稱' }}
          </p>
        </div>

        <div class="mt-5">
          <label class="block text-sm" for="picker-note">備註</label>
          <input
            id="picker-note"
            v-model="form.note"
            type="text"
            class="mt-1 block w-full field px-3 py-2.5"
            :style="inputStyle"
          >
        </div>

        <div class="mt-5">
          <ToggleSwitch v-model="form.is_default" label="設為預設" />
        </div>

        <p v-if="formError" role="alert" class="mt-4 rounded-sm border px-3 py-3 text-sm" :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }">
          {{ formError }}
        </p>
      </div>

      <!-- 底部動作 -->
      <footer class="flex shrink-0 gap-3 border-t px-5 py-3" :style="{ borderColor: 'var(--border)' }">
        <button
          type="button"
          class="flex-1 rounded-sm border px-4 py-3"
          :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
          @click="mode === 'create' ? (mode = 'list') : emit('close')"
        >
          取消
        </button>
        <button
          v-if="mode === 'list'"
          type="button"
          class="flex-1 rounded-sm px-4 py-3 font-medium"
          :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
          @click="confirmChoice"
        >
          選好了
        </button>
        <button
          v-else
          type="button"
          :disabled="saving"
          class="flex-1 rounded-sm px-4 py-3 font-medium disabled:opacity-60"
          :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
          @click="create"
        >
          {{ saving ? '儲存中' : '儲存' }}
        </button>
      </footer>
    </div>
  </dialog>
</template>
