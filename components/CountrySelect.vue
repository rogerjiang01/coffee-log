<script setup lang="ts">
// 產國。視覺與互動沿用 LookupSelect（可搜尋的下拉、同樣的分組標題樣式），
// 但有兩個關鍵差異：
//
// 1. **不能新增。** countries 是純系統表（《01》§4.4），使用者不可新增，
//    所以沒有「新增『…』」那一列。
// 2. **分組依洲別而非系統／自建。** 產國沒有自建的概念。
//
// 因此不共用 LookupSelect 而另開一支：把「可新增」與「兩種分組」硬塞進
// 同一個元件，會讓那支已經有建立流程的元件變得難以推理，
// 而它正在服務處理法與品種兩個更常用的欄位。

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const supabase = useSupabaseClient()
const systemTable = useSystemTable()

const items = ref<CountryOption[]>([])
const loading = ref(true)
const loadError = ref('')
const open = ref(false)
const query = ref('')

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const selected = computed(() => items.value.find(item => item.id === props.modelValue) ?? null)

// 比對名稱、英文名與 ISO 碼
const matches = computed(() => {
  const ids = new Set(filterLookup(query.value, toLookupShape(items.value)).map(m => m.id))
  return items.value.filter(item => ids.has(item.id))
})

// **搜尋時不分組。** 分組是給瀏覽用的；使用者已經打了字，
// 代表他知道要什麼，這時再讓他跨過三個標題找那一筆是多餘的。
const searching = computed(() => query.value.trim().length > 0)
const groups = computed(() => groupByContinent(matches.value))

async function fetchCountries() {
  // 排序在資料庫做：sort_order 是依台灣市場常見度排的，前端不重排
  const { data, error } = await supabase
    .from('countries')
    .select('id, name_zh, name_en, iso_code, continent')
    .order('sort_order')
    .order('name_zh')
  if (error) throw toError(error)
  return (data ?? []) as unknown as CountryOption[]
}

async function load() {
  try {
    // countries 是純系統表，一個工作階段內不會變
    items.value = await systemTable.read<CountryOption>('countries', fetchCountries)
  }
  catch (e) {
    loadError.value = `讀不到產國：${errorText(e)}`
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

const { style: panelStyle, isOutside } = useAnchoredPanel(root, panel, open)

// 浮層開在 <dialog> 裡面時不能送 body：那裡是 inert，點了沒反應
const portalTarget = usePortalTarget(root)

function onDocumentClick(event: MouseEvent) {
  if (open.value && isOutside(event.target as Node)) close()
}

async function toggle() {
  open.value = !open.value
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
  // 焦點還給觸發按鈕，不然會掉到 <body>
  trigger.value?.focus()
}

function pick(id: string | null) {
  emit('update:modelValue', id)
  close()
}

const optionStyle = { minHeight: 'var(--touch-min)' }
</script>

<template>
  <div ref="root" class="relative">
    <label class="block text-sm" for="bean-country">產國</label>

    <button
      id="bean-country"
      ref="trigger"
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
        {{ selected?.name_zh ?? '選填' }}
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

    <p v-if="loadError" role="alert" class="mt-1 text-xs" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <Teleport :to="portalTarget">
      <div
        v-if="open"
        ref="panel"
        class="fixed z-40 flex flex-col overflow-hidden rounded-sm border"
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

          <!-- 搜尋時直接平鋪：使用者已經知道要什麼，不必再跨過三個標題 -->
          <template v-if="searching">
            <li v-for="item in matches" :key="item.id">
              <button
                type="button"
                class="block w-full px-3 py-2 text-left"
                :style="{ ...optionStyle, background: item.id === modelValue ? 'var(--accent-wash)' : undefined }"
                @click="pick(item.id)"
              >
                {{ item.name_zh }}
              </button>
            </li>
          </template>

          <!-- 瀏覽時依洲別分組，標題用與 LookupSelect 相同的次要文字樣式 -->
          <template v-for="group in groups" v-else :key="group.key">
            <li class="px-3 pt-2 text-xs text-muted">{{ group.label }}</li>
            <li v-for="item in group.items" :key="item.id">
              <button
                type="button"
                class="block w-full px-3 py-2 text-left"
                :style="{ ...optionStyle, background: item.id === modelValue ? 'var(--accent-wash)' : undefined }"
                @click="pick(item.id)"
              >
                {{ item.name_zh }}
              </button>
            </li>
          </template>

          <li v-if="!matches.length" class="px-3 py-3 text-sm text-muted">
            找不到相符的
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>
