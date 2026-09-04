<script setup lang="ts">
// 查表型欄位（《02-功能規格》§10）。
//
// 下拉本身可搜尋：輸入時即時過濾現有項目（含 aliases），
// 打完字沒有完全相符的才在底部出現「新增『…』」，點下去直接建立。
//
// 模糊比對的用途是即時過濾，不是事後攔截。使用者打「厭氧」就會看到
// 厭氧日曬與厭氧水洗，自然會選既有的——減少重複建立的成本由系統承擔，
// 不丟給使用者確認。

const props = defineProps<{
  modelValue: string | null
  label: string
  table: 'processing_methods' | 'varieties'
  hint?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const supabase = useSupabaseClient()
const userId = useCurrentUserId()

const items = ref<LookupItem[]>([])
const loading = ref(true)
const open = ref(false)
const query = ref('')
const saving = ref(false)
const saveError = ref('')

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const selected = computed(() => items.value.find(item => item.id === props.modelValue) ?? null)
const matches = computed(() => filterLookup(query.value, items.value))
const grouped = computed(() => splitBySource(matches.value))
const canCreate = computed(() =>
  query.value.trim().length > 0 && !hasExactMatch(query.value, items.value),
)

async function load() {
  loading.value = true
  try {
    // sort_order 在使用者自建項目上一律是預設值 0，會產生並列，
    // 因此補 name 當決勝鍵，避免每次載入順序不同
    const { data } = await supabase
      .from(props.table)
      .select('id, name, aliases, user_id')
      .order('user_id', { nullsFirst: true })
      .order('sort_order')
      .order('name')
    items.value = (data ?? []) as unknown as LookupItem[]
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

const trigger = ref<HTMLButtonElement | null>(null)

const { style: panelStyle, isOutside } = useAnchoredPanel(root, panel, open)

function onDocumentClick(event: MouseEvent) {
  // 浮層已 teleport 到 body，不能只檢查觸發元素的父層
  if (open.value && isOutside(event.target as Node)) close()
}

async function toggle() {
  open.value = !open.value
  saveError.value = ''
  if (open.value) {
    query.value = ''
    await nextTick()
    // preventScroll：取得焦點時不要把畫面捲到這個欄位
    searchInput.value?.focus({ preventScroll: true })
  }
}

function close() {
  open.value = false
  query.value = ''
  // 焦點還給觸發按鈕。不還的話焦點會掉到 <body>：
  // 使用者按 Tab 會從整份文件的最上面重來，而焦點停在 body 時
  // 按 Enter 什麼都不會發生——看起來就像「鍵盤失效」。
  trigger.value?.focus()
}

function pick(id: string | null) {
  emit('update:modelValue', id)
  close()
}

async function create() {
  const name = query.value.trim()
  if (!name || saving.value) return
  if (!userId.value) {
    saveError.value = SESSION_EXPIRED
    return
  }

  saving.value = true
  saveError.value = ''

  const row: Record<string, unknown> = { name, user_id: userId.value }

  const { data, error } = await supabase
    .from(props.table)
    .insert(row as never)
    .select('id, name, aliases, user_id')
    .single()
  saving.value = false

  if (error) {
    saveError.value = `新增失敗：${errorText(error)}`
    return
  }
  const created = data as unknown as LookupItem
  items.value = [...items.value, created]
  pick(created.id)
}

const optionStyle = { minHeight: 'var(--touch-min)' }
</script>

<template>
  <div ref="root" class="relative">
    <label class="block text-sm" :for="`lookup-${table}`">{{ label }}</label>

    <button
      ref="trigger"
      :id="`lookup-${table}`"
      type="button"
      role="combobox"
      :aria-expanded="open"
      :disabled="loading"
      class="mt-1 flex w-full items-center justify-between field px-3 py-2.5 text-left"
      data-field
      :data-filled="!!selected"
      :style="{ minHeight: 'var(--touch-min)' }"
      @click="toggle"
    >
      <!-- 未選取時用 --text-muted，避免看起來像已經填好的值 -->
      <span :style="{ color: selected ? 'var(--text)' : 'var(--text-muted)' }">
        {{ selected?.name ?? '選填' }}
      </span>
      <svg
        width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
        :style="{
          color: 'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform var(--motion-duration) var(--motion-ease)',
        }"
      >
        <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <p v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="z-40 flex flex-col overflow-hidden rounded-sm border"
        :style="{ ...panelStyle, borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
        @click.stop
        @keydown.esc="close"
      >
        <div class="shrink-0 border-b p-2" :style="{ borderColor: 'var(--border)' }">
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="搜尋"
            class="block w-full field px-3 py-2"
            :style="{ minHeight: 'var(--touch-min)' }"
          >
        </div>

        <ul class="min-h-0 flex-1 overflow-y-auto">
          <li v-if="modelValue">
            <button
              type="button"
              class="block w-full px-3 py-2 text-left text-sm"
              :style="{ ...optionStyle, color: 'var(--text-muted)' }"
              @click="pick(null)"
            >
              清除
            </button>
          </li>

          <template v-if="grouped.system.length">
            <li class="px-3 pt-2 text-xs text-muted">內建</li>
            <li v-for="item in grouped.system" :key="item.id">
              <button
                type="button"
                class="block w-full px-3 py-2 text-left"
                :style="{ ...optionStyle, background: item.id === modelValue ? 'var(--accent-wash)' : undefined }"
                @click="pick(item.id)"
              >
                {{ item.name }}
              </button>
            </li>
          </template>

          <template v-if="grouped.mine.length">
            <li class="px-3 pt-2 text-xs text-muted">我建立的</li>
            <li v-for="item in grouped.mine" :key="item.id">
              <button
                type="button"
                class="block w-full px-3 py-2 text-left"
                :style="{ ...optionStyle, background: item.id === modelValue ? 'var(--accent-wash)' : undefined }"
                @click="pick(item.id)"
              >
                {{ item.name }}
              </button>
            </li>
          </template>

          <li v-if="!matches.length && !canCreate" class="px-3 py-3 text-sm text-muted">
            找不到相符的
          </li>
        </ul>

        <div v-if="canCreate" class="border-t p-2" :style="{ borderColor: 'var(--border)' }">
          <button
            type="button"
            :disabled="saving"
            class="block w-full rounded-sm px-3 py-2 text-left disabled:opacity-60"
            :style="{ ...optionStyle, color: 'var(--accent)' }"
            @click="create"
          >
            {{ saving ? '新增中' : `新增「${query.trim()}」` }}
          </button>
        </div>

        <p v-if="saveError" class="px-3 pb-3 text-sm" :style="{ color: 'var(--danger)' }">
          {{ saveError }}
        </p>
      </div>
    </Teleport>
  </div>
</template>